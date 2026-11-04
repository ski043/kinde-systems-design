import "server-only";
import { setTimeout as sleep } from "node:timers/promises";
import {
  applyAgentOutcome,
  getConversationSummary,
  getMessagesByIds,
  getWidgetSettings,
  hasKnowledge,
  isAgentTurnCurrent,
  listConversationHistory,
  recordAgentTurn,
  setMessageClassification,
  type AgentTurnOutcomeValue,
  type HandoffReasonValue,
  type MessageClassificationValue,
  type MessageRecord,
  type RetrievedChunk,
} from "@marshaldesk/db";
import {
  AGENT_HISTORY_MESSAGES,
  AGENT_MODELS,
  defaultAgentName,
} from "@marshaldesk/shared";
import {
  stepCountIs,
  streamText,
  tool,
  type LanguageModelUsage,
  type ToolSet,
} from "ai";
import { z } from "zod";
import { toMessages } from "@/lib/orpc/handlers/conversation-mappers";
import { publishSavedChange } from "@/lib/orpc/handlers/realtime";
import { publishConversationEvent } from "@/lib/realtime/publish";
import { classifyMessage } from "./classify";
import { languageModel, reasoningOptions, type AgentModelSpec } from "./models";
import {
  answerPrompt,
  answerSystem,
  CANNOT_ANSWER_DESCRIPTION,
  offTopicSystem,
  shortReplyPrompt,
  smallTalkSystem,
  type Persona,
} from "./prompts";
import { retrieveKnowledge } from "./retrieve";
import { assertNormalFinish, nonEmptyReply } from "./stream-checks";
import { ChunkPublisher } from "./stream-publisher";

const FIRST_OUTPUT_TIMEOUT_MS = 20_000;
const ANSWER_TIMEOUT_MS = 60_000;
const SHORT_REPLY_TIMEOUT_MS = 20_000;
const TURN_CHECK_INTERVAL_MS = 300;

export type AgentTurnRequest = {
  workspaceId: string;
  conversationId: string;
  visitorMessageId: string;
};

type TurnLog = {
  classification: MessageClassificationValue;
  outcome: AgentTurnOutcomeValue;
  handoffReason: HandoffReasonValue | null;
  replyMessageId: string | null;
  retrieved: RetrievedChunk[];
  /** The chunks the answer model was given, when it answered. */
  context: RetrievedChunk[];
  model: string | null;
  tokensIn: number;
  tokensOut: number;
  errors: string[];
};

type ReplyKind = "answered" | "small_talk" | "declined";

type StreamedReply =
  | { kind: "text"; text: string }
  | { kind: "cannot_answer" }
  | { kind: "obsolete" };

const answerTools: ToolSet = {
  cannot_answer: tool({
    description: CANNOT_ANSWER_DESCRIPTION,
    inputSchema: z.object({ reason: z.string() }),
  }),
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class AgentTurn {
  readonly log: TurnLog = {
    classification: "support_question",
    outcome: "failed",
    handoffReason: null,
    replyMessageId: null,
    retrieved: [],
    context: [],
    model: null,
    tokensIn: 0,
    tokensOut: 0,
    errors: [],
  };
  private publisher: ChunkPublisher | null = null;
  private readonly marks: string[] = [];

  /** Records how long the turn took to reach a stage, for the log line. */
  mark(stage: string): void {
    this.marks.push(
      `${stage}=${Math.round(performance.now() - this.startedAt)}`,
    );
  }

  /** Adds a detail to the log line. */
  note(detail: string): void {
    this.marks.push(detail);
  }

  constructor(
    readonly startedAt: number,
    readonly request: AgentTurnRequest,
    readonly persona: Persona,
    readonly message: string,
    readonly history: readonly MessageRecord[],
    readonly agentEnabled: boolean,
  ) {}

  addUsage(usage: { inputTokens?: number; outputTokens?: number }): void {
    this.log.tokensIn += usage.inputTokens ?? 0;
    this.log.tokensOut += usage.outputTokens ?? 0;
  }

  isCurrent(): Promise<boolean> {
    const { workspaceId, conversationId, visitorMessageId } = this.request;
    return isAgentTurnCurrent(workspaceId, conversationId, visitorMessageId);
  }

  async handoff(
    reason: HandoffReasonValue,
    outcome: "handoff" | "failed" = "handoff",
  ): Promise<void> {
    const { workspaceId, conversationId, visitorMessageId } = this.request;
    await this.publisher?.abandon();
    const messageIds = await applyAgentOutcome(
      workspaceId,
      conversationId,
      visitorMessageId,
      { kind: "handoff", reason },
    );
    if (!messageIds) {
      this.log.outcome = "discarded";
      return;
    }
    this.log.outcome = outcome;
    this.log.handoffReason = reason;
    await publishSavedChange({
      workspaceId,
      conversationId,
      messageIds,
      stateChanged: true,
    });
  }

  async reply(
    kind: ReplyKind,
    spec: AgentModelSpec,
    system: string,
    prompt: string,
  ): Promise<void> {
    const { workspaceId, conversationId, visitorMessageId } = this.request;
    const publisher = new ChunkPublisher(conversationId);
    this.publisher = publisher;
    this.log.model = spec.id;
    const streamed = await this.stream(publisher, {
      spec,
      system,
      prompt,
      tools: kind === "answered" ? answerTools : {},
      timeoutMs:
        kind === "answered" ? ANSWER_TIMEOUT_MS : SHORT_REPLY_TIMEOUT_MS,
    });

    switch (streamed.kind) {
      case "obsolete":
        await publisher.abandon();
        this.log.outcome = "discarded";
        return;
      case "cannot_answer":
        await this.handoff("low_confidence");
        return;
      case "text":
        break;
      default: {
        const unhandled: never = streamed;
        throw new Error(`Unhandled reply: ${String(unhandled)}`);
      }
    }

    await publisher.drain();
    const messageIds = await applyAgentOutcome(
      workspaceId,
      conversationId,
      visitorMessageId,
      { kind: "reply", messageId: publisher.messageId, body: streamed.text },
    );
    if (messageIds) {
      this.log.outcome = kind;
      this.log.replyMessageId = publisher.messageId;
      await publishSavedChange({
        workspaceId,
        conversationId,
        messageIds,
        stateChanged: false,
      });
    } else {
      this.log.outcome = "discarded";
    }
    await publisher.done();
  }

  /**
   * Streams one model reply to the room while re-checking every 300 ms that
   * the turn is still current; when it isn't, the model call is aborted. The
   * call is also aborted when the model produces nothing within 20 s, or runs
   * past `timeoutMs` overall.
   */
  private async stream(
    publisher: ChunkPublisher,
    input: {
      spec: AgentModelSpec;
      system: string;
      prompt: string;
      tools: ToolSet;
      timeoutMs: number;
    },
  ): Promise<StreamedReply> {
    if (!(await this.isCurrent())) return { kind: "obsolete" };
    this.mark("streaming");

    const controller = new AbortController();
    let obsolete = false;
    let finished = false;
    let timeoutError = null as Error | null;
    const timeOut = (message: string) => {
      timeoutError ??= new Error(message);
      controller.abort();
    };
    const firstOutputTimer = setTimeout(
      () =>
        timeOut(
          `The model produced nothing within ${FIRST_OUTPUT_TIMEOUT_MS / 1000} s`,
        ),
      FIRST_OUTPUT_TIMEOUT_MS,
    );
    const overallTimer = setTimeout(
      () => timeOut(`The reply took longer than ${input.timeoutMs / 1000} s`),
      input.timeoutMs,
    );
    const watcher = (async () => {
      while (!finished) {
        await sleep(TURN_CHECK_INTERVAL_MS);
        if (finished) return;
        try {
          if (!(await this.isCurrent())) {
            obsolete = true;
            controller.abort();
            return;
          }
        } catch {
          // A failed check isn't evidence the turn is obsolete; try again.
        }
      }
    })();

    let text = "";
    let cannotAnswer = false;
    let usage: LanguageModelUsage | null = null;
    try {
      const result = streamText({
        model: languageModel(input.spec),
        system: input.system,
        prompt: input.prompt,
        tools: input.tools,
        stopWhen: stepCountIs(1),
        providerOptions: reasoningOptions(input.spec),
        maxOutputTokens: 1500,
        maxRetries: 1,
        abortSignal: controller.signal,
        onError: () => {},
      });
      for await (const part of result.fullStream) {
        if (obsolete) break;
        if (part.type === "text-delta") {
          if (part.text !== "") clearTimeout(firstOutputTimer);
          text += part.text;
          publisher.push(part.text);
        } else if (part.type === "tool-input-start") {
          clearTimeout(firstOutputTimer);
        } else if (
          part.type === "tool-call" &&
          part.toolName === "cannot_answer"
        ) {
          clearTimeout(firstOutputTimer);
          cannotAnswer = true;
        } else if (part.type === "finish") {
          usage = part.totalUsage;
          assertNormalFinish(part.finishReason, ["stop", "tool-calls"]);
        } else if (part.type === "error") {
          throw part.error;
        } else if (part.type === "abort") {
          if (!obsolete) {
            throw timeoutError ?? new Error("The reply stream was aborted");
          }
          break;
        }
      }
    } catch (error) {
      if (!obsolete) throw timeoutError ?? error;
    } finally {
      finished = true;
      clearTimeout(firstOutputTimer);
      clearTimeout(overallTimer);
      if (usage) this.addUsage(usage);
      await watcher;
    }

    if (obsolete) return { kind: "obsolete" };
    if (cannotAnswer) return { kind: "cannot_answer" };
    return { kind: "text", text: nonEmptyReply(text) };
  }

  async finish(): Promise<void> {
    const { workspaceId, conversationId, visitorMessageId } = this.request;
    const { log } = this;
    const latencyMs = performance.now() - this.startedAt;
    const firstChunkAt = this.publisher?.firstChunkAt ?? null;
    const firstTokenMs =
      firstChunkAt === null ? null : firstChunkAt - this.startedAt;
    try {
      await recordAgentTurn(workspaceId, {
        conversationId,
        messageId: visitorMessageId,
        replyMessageId: log.replyMessageId,
        classification: log.classification,
        outcome: log.outcome,
        handoffReason: log.handoffReason,
        chunkIds: log.retrieved.map((chunk) => chunk.id),
        scores: log.retrieved.map((chunk) => chunk.score),
        sourceIds:
          log.outcome === "answered"
            ? [...new Set(log.context.map((chunk) => chunk.sourceId))]
            : [],
        classifierModel: AGENT_MODELS.classifier.id,
        model: log.model,
        tokensIn: log.tokensIn,
        tokensOut: log.tokensOut,
        latencyMs,
        firstTokenMs,
        error: log.errors.length > 0 ? log.errors.join("; ") : null,
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "agent_turn_log_failed",
          conversationId,
          visitorMessageId,
          error: errorText(error),
        }),
      );
    }
    console.info(
      `[agent] conversation=${conversationId.slice(-8)} message=${visitorMessageId.slice(-8)} classification=${log.classification} outcome=${log.outcome}${log.handoffReason ? ` reason=${log.handoffReason}` : ""} firstChunkMs=${firstTokenMs === null ? "-" : Math.round(firstTokenMs)} totalMs=${Math.round(latencyMs)}${this.marks.length > 0 ? ` ${this.marks.join(" ")}` : ""}`,
    );
  }
}

async function answerSupportQuestion(turn: AgentTurn): Promise<void> {
  const previousQuestion =
    turn.history.findLast((message) => message.author === "visitor")?.body ??
    null;
  const retrieval = await retrieveKnowledge(
    turn.request.workspaceId,
    turn.message,
    previousQuestion,
  );
  turn.mark("retrieved");
  if (retrieval.followUpScores) turn.note(retrieval.followUpScores);
  turn.log.retrieved = retrieval.retrieved;
  turn.log.tokensIn += retrieval.tokensIn;
  if (retrieval.relevant.length === 0) {
    await turn.handoff("no_relevant_knowledge");
    return;
  }
  turn.log.context = retrieval.relevant;
  await turn.reply(
    "answered",
    AGENT_MODELS.answer,
    answerSystem(turn.persona),
    answerPrompt(turn.history, retrieval.relevant, turn.message),
  );
}

async function respond(turn: AgentTurn, agentOn: boolean): Promise<void> {
  if (!agentOn) {
    await turn.handoff("agent_off");
    return;
  }
  const { persona, history, message } = turn;
  switch (turn.log.classification) {
    case "human_request":
      await turn.handoff("visitor_requested");
      return;
    case "off_topic":
      await turn.reply(
        "declined",
        AGENT_MODELS.fast,
        offTopicSystem(persona),
        shortReplyPrompt(history, message),
      );
      return;
    case "small_talk":
      await turn.reply(
        "small_talk",
        AGENT_MODELS.fast,
        smallTalkSystem(persona),
        shortReplyPrompt(history, message),
      );
      return;
    case "support_question":
      await answerSupportQuestion(turn);
      return;
    default: {
      const unhandled: never = turn.log.classification;
      throw new Error(`Unhandled classification: ${String(unhandled)}`);
    }
  }
}

async function loadTurn(
  startedAt: number,
  request: AgentTurnRequest,
): Promise<AgentTurn | null> {
  const { workspaceId, conversationId, visitorMessageId } = request;
  const [conversation, settings, [visitorMessage], history, knowledge] =
    await Promise.all([
      getConversationSummary(workspaceId, conversationId),
      getWidgetSettings(workspaceId),
      getMessagesByIds(workspaceId, conversationId, [visitorMessageId]),
      listConversationHistory(
        workspaceId,
        conversationId,
        AGENT_HISTORY_MESSAGES + 1,
      ),
      hasKnowledge(workspaceId),
    ]);
  if (
    !conversation ||
    !settings ||
    !visitorMessage ||
    visitorMessage.author !== "visitor" ||
    conversation.state !== "ai"
  ) {
    return null;
  }
  const persona = {
    agentName: settings.agentName ?? defaultAgentName(settings.workspaceName),
    workspaceName: settings.workspaceName,
  };
  const earlier = history
    .filter((message) => message.id !== visitorMessageId)
    .slice(-AGENT_HISTORY_MESSAGES);
  return new AgentTurn(
    startedAt,
    request,
    persona,
    visitorMessage.body,
    earlier,
    knowledge,
  );
}

/** Republishes the visitor message so the inbox shows it as declined. */
async function publishVisitorMessage(request: AgentTurnRequest): Promise<void> {
  const { workspaceId, conversationId, visitorMessageId } = request;
  const [record] = await getMessagesByIds(workspaceId, conversationId, [
    visitorMessageId,
  ]);
  const [message] = toMessages(record ? [record] : []);
  if (!message) return;
  await publishConversationEvent(conversationId, {
    type: "message.created",
    conversationId,
    message,
  });
}

/** Without a loaded turn, hands off so the visitor isn't left without a reply. */
async function handOffAfterLoadFailure(
  request: AgentTurnRequest,
  startedAt: number,
  error: string,
): Promise<void> {
  const { workspaceId, conversationId, visitorMessageId } = request;
  try {
    const messageIds = await applyAgentOutcome(
      workspaceId,
      conversationId,
      visitorMessageId,
      { kind: "handoff", reason: "low_confidence" },
    );
    if (!messageIds) return;
    await publishSavedChange({
      workspaceId,
      conversationId,
      messageIds,
      stateChanged: true,
    });
    await recordAgentTurn(workspaceId, {
      conversationId,
      messageId: visitorMessageId,
      replyMessageId: null,
      classification: "support_question",
      outcome: "failed",
      handoffReason: "low_confidence",
      chunkIds: [],
      scores: [],
      sourceIds: [],
      classifierModel: AGENT_MODELS.classifier.id,
      model: null,
      tokensIn: 0,
      tokensOut: 0,
      latencyMs: performance.now() - startedAt,
      firstTokenMs: null,
      error: `load: ${error}`,
    });
  } catch (handoffError) {
    console.error(
      JSON.stringify({
        event: "agent_turn_failed",
        stage: "load_handoff",
        conversationId,
        visitorMessageId,
        error: errorText(handoffError),
      }),
    );
  }
}

/**
 * Runs the agent for one visitor message (PRD Flow B): classify, then decline,
 * chat, hand off, or answer from the knowledge base. Never throws; whatever
 * fails, the visitor isn't left without a reply or a handoff.
 */
export async function runAgentTurn(request: AgentTurnRequest): Promise<void> {
  const { workspaceId, conversationId, visitorMessageId } = request;
  const startedAt = performance.now();
  let turn: AgentTurn | null = null;
  try {
    turn = await loadTurn(startedAt, request);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "agent_turn_failed",
        stage: "load",
        conversationId,
        visitorMessageId,
        error: errorText(error),
      }),
    );
    await handOffAfterLoadFailure(request, startedAt, errorText(error));
    return;
  }
  if (!turn) return;
  turn.mark("loaded");

  try {
    const classification = await classifyMessage(turn.history, turn.message);
    turn.mark("classified");
    turn.log.classification = classification.label;
    turn.addUsage({
      inputTokens: classification.tokensIn,
      outputTokens: classification.tokensOut,
    });
    if (classification.error) turn.log.errors.push(classification.error);

    const agentOn = turn.agentEnabled;
    const classified = setMessageClassification(workspaceId, visitorMessageId, {
      classification: classification.label,
      declined: false,
    }).then(
      () => true,
      (error: unknown) => {
        turn?.log.errors.push(`classification write: ${errorText(error)}`);
        return false;
      },
    );
    await respond(turn, agentOn);
    // Only a refusal that was actually saved marks the message declined.
    if ((await classified) && turn.log.outcome === "declined") {
      await setMessageClassification(workspaceId, visitorMessageId, {
        classification: classification.label,
        declined: true,
      });
      await publishVisitorMessage(request);
    }
  } catch (error) {
    turn.log.errors.push(errorText(error));
    console.error(
      JSON.stringify({
        event: "agent_turn_failed",
        stage: "respond",
        conversationId,
        visitorMessageId,
        classification: turn.log.classification,
        error: errorText(error),
      }),
    );
    try {
      await turn.handoff("low_confidence", "failed");
    } catch (handoffError) {
      turn.log.errors.push(`handoff: ${errorText(handoffError)}`);
    }
  } finally {
    await turn.finish();
  }
}
