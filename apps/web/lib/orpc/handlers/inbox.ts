import "server-only";
import {
  claimReplySuggestion,
  getConversation,
  getConversationSummary,
  listAgentTurns,
  listConversations,
  listReplySources,
  markConversationRead,
  transitionConversation,
  type AgentTurnRecord,
  type MessageDraft,
  type MessageRecord,
  type TransitionResult,
} from "@marshaldesk/db";
import {
  allowedFromStates,
  ConversationConflictError,
  ConversationNotFoundError,
  nextState,
  RETRIEVAL_CONTEXT_SIMILARITY,
  RETRIEVAL_MIN_SIMILARITY,
  SuggestionInProgressError,
  type AgentTurnSummary,
  type ConversationDetail,
  type ConversationState,
  type MemberAction,
  type ReplySuggestionEvent,
} from "@marshaldesk/shared";
import { reportReplySuggestionUsage } from "@marshaldesk/kinde";
import { ORPCError } from "@orpc/server";
import { after } from "next/server";
import {
  REPLY_SUGGESTION_MODEL,
  streamReplySuggestion,
} from "@/lib/agent/reply-suggestion";
import {
  base,
  type BaseContext,
  memberProcedure,
  requireEntitlement,
  requirePermission,
} from "../procedures";
import {
  toConversationDetail,
  toConversationSummary,
} from "./conversation-mappers";
import { publishSavedChange } from "./realtime";

const readConversations = memberProcedure.use(
  requirePermission("conversations:read"),
);
const replyToConversations = memberProcedure.use(
  requirePermission("conversations:reply"),
);

const suggestReplies = memberProcedure.use(
  requirePermission("suggestions:create"),
);

/** Authorization of the object: the conversation is the workspace's, and open. */
const requireOpenConversation = base
  .$context<BaseContext & { workspaceId: string }>()
  .middleware(async ({ context, next }, input: { conversationId: string }) => {
    const conversation = await getConversationSummary(
      context.workspaceId,
      input.conversationId,
    );
    if (!conversation) {
      throw new ConversationNotFoundError();
    }
    if (nextState(conversation.state, "reply") === null) {
      throw new ConversationConflictError({
        data: { state: conversation.state },
      });
    }
    return next();
  });

const MAX_REPLY_ATTEMPTS = 3;

function failure(result: Extract<TransitionResult, { ok: false }>): Error {
  return result.state === null
    ? new ConversationNotFoundError()
    : new ConversationConflictError({ data: { state: result.state } });
}

async function loadDetail(
  workspaceId: string,
  conversationId: string,
): Promise<ConversationDetail> {
  const record = await getConversation(workspaceId, conversationId);
  if (!record) {
    throw new ConversationNotFoundError();
  }
  const idsBy = (author: MessageRecord["author"]) =>
    record.messages
      .filter((message) => message.author === author)
      .map((message) => message.id);
  const [sources, turns] = await Promise.all([
    listReplySources(workspaceId, idsBy("agent")),
    listAgentTurns(workspaceId, idsBy("visitor")),
  ]);
  return {
    ...toConversationDetail(record),
    agentSources: Object.fromEntries(sources),
    agentTurns: Object.fromEntries(
      [...turns].map(([messageId, turn]) => [messageId, toAgentTurn(turn)]),
    ),
  };
}

/**
 * The agent answers from every chunk at or above the context threshold once
 * the best one reaches the match threshold (`retrieveKnowledge`), and only an
 * answered turn used them.
 */
function toAgentTurn(turn: AgentTurnRecord): AgentTurnSummary {
  const best = turn.matches[0]?.score ?? 0;
  const answered =
    turn.outcome === "answered" && best >= RETRIEVAL_MIN_SIMILARITY;
  return {
    classification: turn.classification,
    outcome: turn.outcome,
    handoffReason: turn.handoffReason,
    matches: turn.matches.map((match) => ({
      ...match,
      used: answered && match.score >= RETRIEVAL_CONTEXT_SIMILARITY,
    })),
    classifierModel: turn.classifierModel,
    model: turn.model,
    tokensIn: turn.tokensIn,
    tokensOut: turn.tokensOut,
    latencyMs: turn.latencyMs,
    firstTokenMs: turn.firstTokenMs,
    error: turn.error,
    createdAt: turn.createdAt,
  };
}

/** Reloads the saved conversation, publishes the change, and returns it. */
async function loadAndPublish(
  workspaceId: string,
  conversationId: string,
  change: { messageIds: readonly string[]; stateChanged: boolean },
): Promise<ConversationDetail> {
  const detail = await loadDetail(workspaceId, conversationId);
  await publishSavedChange({
    workspaceId,
    conversationId,
    messageIds: change.messageIds,
    stateChanged: change.stateChanged,
    summary: detail,
  });
  return detail;
}

/** The guard and target of a member action whose target doesn't depend on the current state. */
function transitionFor(action: Exclude<MemberAction, "reply">): {
  fromStates: ConversationState[];
  toState: ConversationState;
} {
  const fromStates = allowedFromStates(action);
  const targets = new Set(fromStates.map((state) => nextState(state, action)));
  const [toState] = targets;
  if (targets.size !== 1 || !toState) {
    throw new Error(`Action ${action} has no single target state`);
  }
  return { fromStates, toState };
}

async function applyAction(
  workspaceId: string,
  conversationId: string,
  action: Exclude<MemberAction, "reply">,
  messages: MessageDraft[],
): Promise<ConversationDetail> {
  const result = await transitionConversation(workspaceId, conversationId, {
    ...transitionFor(action),
    messages,
  });
  if (!result.ok) {
    throw failure(result);
  }
  return loadAndPublish(workspaceId, conversationId, {
    messageIds: result.messageIds,
    stateChanged: true,
  });
}

export const list = readConversations.inbox.list.handler(
  async ({ context }) => {
    const conversations = await listConversations(context.workspaceId);
    return { conversations: conversations.map(toConversationSummary) };
  },
);

export const get = readConversations.inbox.get.handler(({ context, input }) =>
  loadDetail(context.workspaceId, input.id),
);

// Replying takes over: from ai or waiting it's one guarded update that also
// records the takeover; in human it only appends. A concurrent change between
// the two guards is retried against the new state.
export const reply = replyToConversations.inbox.reply.handler(
  async ({ context, input }) => {
    const member: MessageDraft = {
      author: "member",
      body: input.body,
      memberId: context.member.id,
    };
    const takeOver = transitionFor("take_over");

    for (let attempt = 0; attempt < MAX_REPLY_ATTEMPTS; attempt++) {
      const takenOver = await transitionConversation(
        context.workspaceId,
        input.id,
        {
          ...takeOver,
          messages: [
            { author: "system", event: { kind: "taken_over" } },
            member,
          ],
        },
      );
      if (takenOver.ok) {
        return loadAndPublish(context.workspaceId, input.id, {
          messageIds: takenOver.messageIds,
          stateChanged: true,
        });
      }
      if (takenOver.state === null || !nextState(takenOver.state, "reply")) {
        throw failure(takenOver);
      }

      const appended = await transitionConversation(
        context.workspaceId,
        input.id,
        { fromStates: ["human"], toState: "human", messages: [member] },
      );
      if (appended.ok) {
        return loadAndPublish(context.workspaceId, input.id, {
          messageIds: appended.messageIds,
          stateChanged: false,
        });
      }
      if (appended.state === null || !nextState(appended.state, "reply")) {
        throw failure(appended);
      }
    }
    throw new Error(`Reply to conversation ${input.id} kept conflicting`);
  },
);

export const takeOver = replyToConversations.inbox.takeOver.handler(
  ({ context, input }) =>
    applyAction(context.workspaceId, input.id, "take_over", [
      { author: "system", event: { kind: "taken_over" } },
    ]),
);

export const handBack = replyToConversations.inbox.handBack.handler(
  ({ context, input }) =>
    applyAction(context.workspaceId, input.id, "hand_back", [
      { author: "system", event: { kind: "handed_back" } },
    ]),
);

export const close = replyToConversations.inbox.close.handler(
  ({ context, input }) =>
    applyAction(context.workspaceId, input.id, "close", [
      { author: "system", event: { kind: "closed", by: "member" } },
    ]),
);

export const markRead = readConversations.inbox.markRead.handler(
  async ({ context, input }) => {
    const marked = await markConversationRead(context.workspaceId, input.id);
    if (!marked) {
      throw new ConversationNotFoundError();
    }
    return loadAndPublish(context.workspaceId, input.id, {
      messageIds: [],
      stateChanged: false,
    });
  },
);

/** Logs instead of throwing: the reconciliation job reports a missed total later. */
async function reportUsage(workspaceId: string): Promise<void> {
  try {
    await reportReplySuggestionUsage(workspaceId);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "usage.report_failed",
        workspaceId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );
  }
}

async function* replayed(
  body: string,
): AsyncGenerator<ReplySuggestionEvent, void> {
  yield { type: "done", body, replayed: true };
}

// Authenticated, member, `suggestions:create`, open conversation in the
// workspace, entitlement, then the ledger claim. Only a claimed key reaches the model.
export const suggestReply = suggestReplies.inbox.suggestReply
  .use(requireOpenConversation)
  .use(requireEntitlement("reply_suggestions"))
  .handler(async ({ context, input, signal }) => {
    const claim = await claimReplySuggestion(context.workspaceId, {
      conversationId: input.conversationId,
      memberId: context.member.id,
      idempotencyKey: input.idempotencyKey,
      model: REPLY_SUGGESTION_MODEL.id,
    });
    switch (claim.kind) {
      case "claimed": {
        // Reported once the response is over, never from the stream loop.
        let succeeded = false;
        after(async () => {
          if (succeeded) await reportUsage(context.workspaceId);
        });
        return streamReplySuggestion(
          {
            workspaceId: context.workspaceId,
            conversationId: input.conversationId,
            suggestionId: claim.suggestionId,
            onSucceeded: () => {
              succeeded = true;
            },
          },
          signal,
        );
      }
      case "succeeded":
        return replayed(claim.body);
      case "in_progress":
        throw new SuggestionInProgressError();
      case "other_conversation":
        throw new ORPCError("BAD_REQUEST", {
          message: "This idempotency key was used for another conversation.",
        });
      default: {
        const unhandled: never = claim;
        throw new Error(`Unhandled claim: ${String(unhandled)}`);
      }
    }
  });
