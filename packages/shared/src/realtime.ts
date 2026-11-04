import * as z from "zod";
import {
  conversationSchema,
  conversationSummarySchema,
  messageSchema,
} from "./schemas/conversation";
import { sourceSchema } from "./schemas/source";

export const REALTIME_PARTIES = {
  conversation: "conversation",
  workspace: "workspace",
} as const;
export type RealtimeParty =
  (typeof REALTIME_PARTIES)[keyof typeof REALTIME_PARTIES];

export const REALTIME_TOKEN_AUDIENCE = "realtime";
export const REALTIME_TOKEN_TTL_SECONDS = 60;

/**
 * Claims of the short-lived token that opens a socket. The Worker trusts only
 * these: it has no database access and never sees Kinde tokens.
 */
export const realtimeTokenClaimsSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("member"),
    workspaceId: z.string(),
    /** Kept in the connection state, so `member.revoked` can find the member's sockets. */
    memberId: z.string(),
    /** Present when the member may join this conversation's room; checked by `realtime.getToken`. */
    conversationId: z.string().optional(),
  }),
  z.object({
    role: z.literal("visitor"),
    workspaceId: z.string(),
    visitorId: z.string(),
    conversationId: z.string(),
  }),
]);
export type RealtimeTokenClaims = z.infer<typeof realtimeTokenClaimsSchema>;

export const typingRoleSchema = z.enum(["visitor", "member"]);
export type TypingRole = z.infer<typeof typingRoleSchema>;

/**
 * Agent replies stream as chunks, batched every 50–100 ms. A completed reply
 * is saved and published as `message.created` with the same id, then `done`;
 * a discarded one only gets `done`.
 */
export const agentChunkEventSchema = z.object({
  type: z.literal("agent.chunk"),
  conversationId: z.string(),
  messageId: z.string(),
  seq: z.number().int().nonnegative(),
  /** The whole reply so far, so a client that joins mid-stream can show it. */
  text: z.string(),
});
export const agentDoneEventSchema = z.object({
  type: z.literal("agent.done"),
  conversationId: z.string(),
  messageId: z.string(),
});

/** Events delivered in a conversation room, to the visitor and any member viewing it. */
export const conversationEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message.created"),
    conversationId: z.string(),
    message: messageSchema,
  }),
  z.object({
    type: z.literal("conversation.updated"),
    conversation: conversationSchema,
  }),
  z.object({
    type: z.literal("typing"),
    conversationId: z.string(),
    role: typingRoleSchema,
    typing: z.boolean(),
  }),
  agentChunkEventSchema,
  agentDoneEventSchema,
]);
export type ConversationEvent = z.infer<typeof conversationEventSchema>;

/** Events delivered in a workspace room, to members only. */
export const workspaceEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("conversation.upserted"),
    summary: conversationSummarySchema,
  }),
  z.object({
    /** A visitor message; the dashboard notifies for waiting and human conversations (D-6). */
    type: z.literal("visitor.message"),
    summary: conversationSummarySchema,
    message: messageSchema,
  }),
  z.object({
    /** A source was added, or its status or content changed. */
    type: z.literal("source.updated"),
    source: sourceSchema,
  }),
  z.object({
    type: z.literal("source.deleted"),
    sourceId: z.string(),
  }),
  z.object({
    /** The knowledge base changed what the agent can answer from. */
    type: z.literal("knowledge.updated"),
    suggestedQuestions: z.array(z.string()),
    hasKnowledge: z.boolean(),
  }),
]);
export type WorkspaceEvent = z.infer<typeof workspaceEventSchema>;

/**
 * Published to the workspace room when a member is removed or loses
 * `conversations:read`. The Worker isn't told why: it closes every socket of
 * that member, in the workspace room and in any conversation room, with
 * `REALTIME_REVOKED_CLOSE_CODE`. It is never delivered to clients.
 */
export const memberRevokedEventSchema = z.object({
  type: z.literal("member.revoked"),
  memberId: z.string(),
});
export type MemberRevokedEvent = z.infer<typeof memberRevokedEventSchema>;

/** Everything the server may publish to a workspace room. */
export const workspacePublicationSchema = z.discriminatedUnion("type", [
  ...workspaceEventSchema.options,
  memberRevokedEventSchema,
]);
export type WorkspacePublication = z.infer<typeof workspacePublicationSchema>;

/** The close code of a revoked member's sockets. Clients reload instead of reconnecting. */
export const REALTIME_REVOKED_CLOSE_CODE = 4403;

/** The only thing clients may send. Everything persistent goes through oRPC. */
export const clientMessageSchema = z.object({
  type: z.literal("typing"),
  typing: z.boolean(),
});
export type ClientMessage = z.infer<typeof clientMessageSchema>;

/**
 * Next.js publishes by POSTing one event as JSON to
 * `${REALTIME_URL}/parties/{party}/{room}` with
 * `Authorization: Bearer ${REALTIME_PUBLISH_SECRET}`. Rooms are named by id:
 * the conversation id for `conversation`, the workspace id for `workspace`.
 */
export const REALTIME_PUBLISH_PATH_PREFIX = "parties";

export const realtimeTokenSchema = z.object({ token: z.string() });
export type RealtimeToken = z.infer<typeof realtimeTokenSchema>;
