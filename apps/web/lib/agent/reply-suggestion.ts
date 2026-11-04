import "server-only";
import {
  finishReplySuggestion,
  getWidgetSettings,
  listConversationHistory,
  type ReplySuggestionResult,
} from "@marshaldesk/db";
import {
  AGENT_HISTORY_MESSAGES,
  AGENT_MODELS,
  defaultAgentName,
  type ReplySuggestionEvent,
} from "@marshaldesk/shared";
import { streamText, type LanguageModelUsage } from "ai";
import { languageModel, reasoningOptions } from "./models";
import { replySuggestionPrompt, replySuggestionSystem } from "./prompts";
import { retrieveKnowledge } from "./retrieve";
import { assertNormalFinish, nonEmptyReply } from "./stream-checks";

const FIRST_OUTPUT_TIMEOUT_MS = 20_000;
const SUGGESTION_TIMEOUT_MS = 60_000;

export const REPLY_SUGGESTION_MODEL = AGENT_MODELS.answer;

export type ReplySuggestionRequest = {
  workspaceId: string;
  conversationId: string;
  /** A `pending` usage ledger row this request claimed. */
  suggestionId: string;
  /** Called once the ledger row is `succeeded`, before `done` is sent. */
  onSucceeded?: () => void;
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Streams a reply suggestion for the conversation's latest visitor message
 * and records the outcome on its ledger row. The row becomes `succeeded` only
 * after a normal finish with a non-empty draft, before `done` is sent, so a
 * retry with the same key gets the stored draft. Anything else, including the
 * member cancelling or `signal` aborting, records `failed`.
 */
export async function* streamReplySuggestion(
  request: ReplySuggestionRequest,
  signal?: AbortSignal,
): AsyncGenerator<ReplySuggestionEvent, void> {
  const { workspaceId, conversationId, suggestionId } = request;
  const startedAt = performance.now();
  const controller = new AbortController();
  const abortSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;
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
    () =>
      timeOut(`The draft took longer than ${SUGGESTION_TIMEOUT_MS / 1000} s`),
    SUGGESTION_TIMEOUT_MS,
  );

  let tokensIn = 0;
  let tokensOut = 0;
  let succeeded = false;
  let failure: string | null = null;
  try {
    const [settings, history] = await Promise.all([
      getWidgetSettings(workspaceId),
      listConversationHistory(
        workspaceId,
        conversationId,
        AGENT_HISTORY_MESSAGES,
      ),
    ]);
    if (!settings) throw new Error(`Workspace ${workspaceId} has no settings`);
    const visitorMessages = history.filter(
      (message) => message.author === "visitor",
    );
    const question = visitorMessages.at(-1);
    if (!question) {
      throw new Error("The conversation has no visitor message to reply to");
    }
    const retrieval = await retrieveKnowledge(
      workspaceId,
      question.body,
      visitorMessages.at(-2)?.body ?? null,
    );
    tokensIn += retrieval.tokensIn;
    const persona = {
      agentName: settings.agentName ?? defaultAgentName(settings.workspaceName),
      workspaceName: settings.workspaceName,
    };

    const result = streamText({
      model: languageModel(REPLY_SUGGESTION_MODEL),
      system: replySuggestionSystem(persona),
      prompt: replySuggestionPrompt(history, retrieval.relevant),
      providerOptions: reasoningOptions(REPLY_SUGGESTION_MODEL),
      maxOutputTokens: 1500,
      maxRetries: 1,
      abortSignal,
      onError: () => {},
    });
    let text = "";
    let usage: LanguageModelUsage | null = null;
    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        if (part.text === "") continue;
        clearTimeout(firstOutputTimer);
        text += part.text;
        yield { type: "delta", text: part.text };
      } else if (part.type === "finish") {
        usage = part.totalUsage;
        tokensIn += usage.inputTokens ?? 0;
        tokensOut += usage.outputTokens ?? 0;
        assertNormalFinish(part.finishReason, ["stop"]);
      } else if (part.type === "error") {
        throw part.error;
      } else if (part.type === "abort") {
        throw (
          timeoutError ??
          new Error(
            signal?.aborted
              ? "The member cancelled the draft"
              : "The draft stream was aborted",
          )
        );
      }
    }
    if (!usage) throw new Error("The draft stream ended without finishing");
    const body = nonEmptyReply(text);

    succeeded = await finishReplySuggestion(workspaceId, suggestionId, {
      status: "succeeded",
      body,
      tokensIn,
      tokensOut,
      latencyMs: performance.now() - startedAt,
    });
    if (!succeeded) {
      throw new Error(`Reply suggestion ${suggestionId} was no longer pending`);
    }
    request.onSucceeded?.();
    yield { type: "done", body, replayed: false };
  } catch (error) {
    failure = errorText(timeoutError ?? error);
    throw timeoutError ?? error;
  } finally {
    clearTimeout(firstOutputTimer);
    clearTimeout(overallTimer);
    // Reached without an error when the member closed the stream mid-draft.
    controller.abort();
    if (!succeeded) {
      failure ??= "The member cancelled the draft";
      const failed: ReplySuggestionResult = {
        status: "failed",
        error: failure,
        tokensIn,
        tokensOut,
        latencyMs: performance.now() - startedAt,
      };
      await finishReplySuggestion(workspaceId, suggestionId, failed).catch(
        (error: unknown) => {
          console.error(
            JSON.stringify({
              event: "reply_suggestion_log_failed",
              suggestionId,
              error: errorText(error),
            }),
          );
        },
      );
    }
    console.info(
      `[suggestion] conversation=${conversationId.slice(-8)} suggestion=${suggestionId.slice(-8)} outcome=${succeeded ? "succeeded" : "failed"} model=${REPLY_SUGGESTION_MODEL.id} tokensIn=${tokensIn} tokensOut=${tokensOut} totalMs=${Math.round(performance.now() - startedAt)}${failure ? ` error=${JSON.stringify(failure)}` : ""}`,
    );
  }
}
