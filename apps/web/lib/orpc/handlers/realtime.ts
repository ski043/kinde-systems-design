import "server-only";
import {
  getConversationSummary,
  getMessagesByIds,
  hasConversation,
} from "@marshaldesk/db";
import type {
  Conversation,
  ConversationSummary,
  Message,
} from "@marshaldesk/shared";
import { publishInOrder, type Publication } from "@/lib/realtime/publish";
import { signRealtimeToken } from "@/lib/realtime/token";
import { memberProcedure, requirePermission } from "../procedures";
import { toConversationSummary, toMessages } from "./conversation-mappers";

const readConversations = memberProcedure.use(
  requirePermission("conversations:read"),
);

export const getToken = readConversations.realtime.getToken.handler(
  async ({ context, input, errors }) => {
    const member = {
      role: "member",
      workspaceId: context.workspaceId,
      memberId: context.member.id,
    } as const;
    if (!input.conversationId) {
      return { token: await signRealtimeToken(member) };
    }
    if (!(await hasConversation(context.workspaceId, input.conversationId))) {
      throw errors.NOT_FOUND();
    }
    return {
      token: await signRealtimeToken({
        ...member,
        conversationId: input.conversationId,
      }),
    };
  },
);

function conversationOf(summary: ConversationSummary): Conversation {
  return {
    id: summary.id,
    state: summary.state,
    handoffReason: summary.handoffReason,
    createdAt: summary.createdAt,
    lastMessageAt: summary.lastMessageAt,
    closedAt: summary.closedAt,
    updatedAt: summary.updatedAt,
  };
}

/** Strips anything beyond the summary, like a detail's messages. */
function summaryOf(summary: ConversationSummary): ConversationSummary {
  return {
    ...conversationOf(summary),
    visitor: summary.visitor,
    unread: summary.unread,
    preview: summary.preview,
  };
}

/**
 * Publishes a saved change: each new message to the conversation room, the
 * conversation when its state changed, and the fresh summary to the workspace
 * room (plus `visitor.message` for each visitor message).
 *
 * Awaited inside the request, one event at a time, so events leave in the
 * order they were written; each is time-boxed and failures only log.
 */
async function publishConversationChange(input: {
  workspaceId: string;
  summary: ConversationSummary;
  messages: readonly Message[];
  stateChanged: boolean;
}): Promise<void> {
  const summary = summaryOf(input.summary);
  const conversationId = summary.id;
  const publications: Publication[] = input.messages.map((message) => ({
    party: "conversation",
    room: conversationId,
    event: { type: "message.created", conversationId, message },
  }));
  if (input.stateChanged) {
    publications.push({
      party: "conversation",
      room: conversationId,
      event: {
        type: "conversation.updated",
        conversation: conversationOf(summary),
      },
    });
  }
  for (const message of input.messages) {
    if (message.author !== "visitor") continue;
    publications.push({
      party: "workspace",
      room: input.workspaceId,
      event: { type: "visitor.message", summary, message },
    });
  }
  publications.push({
    party: "workspace",
    room: input.workspaceId,
    event: { type: "conversation.upserted", summary },
  });
  await publishInOrder(publications);
}

/**
 * Publishes a committed write. Loads exactly the inserted messages and, unless
 * the caller already has it, the fresh summary. Never throws: the write is
 * saved, so a failure here only logs.
 */
export async function publishSavedChange(input: {
  workspaceId: string;
  conversationId: string;
  messageIds: readonly string[];
  stateChanged: boolean;
  summary?: ConversationSummary;
}): Promise<void> {
  const { workspaceId, conversationId } = input;
  try {
    const [summary, messages] = await Promise.all([
      input.summary ??
        getConversationSummary(workspaceId, conversationId).then((record) =>
          record ? toConversationSummary(record) : null,
        ),
      getMessagesByIds(workspaceId, conversationId, input.messageIds),
    ]);
    if (!summary) return;
    await publishConversationChange({
      workspaceId,
      summary,
      messages: toMessages(messages),
      stateChanged: input.stateChanged,
    });
  } catch (error) {
    console.error(
      `Real-time publish for conversation ${conversationId} failed:`,
      error,
    );
  }
}
