import * as z from "zod";

export const CONVERSATION_STATES = [
  "ai",
  "waiting",
  "human",
  "closed",
] as const;
export const conversationStateSchema = z.enum(CONVERSATION_STATES);
export type ConversationState = z.infer<typeof conversationStateSchema>;

export const OPEN_CONVERSATION_STATES = [
  "ai",
  "waiting",
  "human",
] as const satisfies readonly ConversationState[];

export const HANDOFF_REASONS = [
  "low_confidence",
  "no_relevant_knowledge",
  "visitor_requested",
  "agent_off",
  "ai_reply_limit",
] as const;
export const handoffReasonSchema = z.enum(HANDOFF_REASONS);
export type HandoffReason = z.infer<typeof handoffReasonSchema>;

export const MESSAGE_CLASSIFICATIONS = [
  "support_question",
  "small_talk",
  "off_topic",
  "human_request",
] as const;
export const messageClassificationSchema = z.enum(MESSAGE_CLASSIFICATIONS);
export type MessageClassification = z.infer<typeof messageClassificationSchema>;

/** PRD L-3. */
export const MESSAGE_MAX_LENGTH = 4000;

export const messageBodySchema = z
  .string()
  .trim()
  .min(1, { error: "Write a message." })
  .max(MESSAGE_MAX_LENGTH, {
    error: `Keep messages under ${MESSAGE_MAX_LENGTH.toLocaleString("en-US")} characters.`,
  });

export const DEVICE_TYPES = ["desktop", "mobile", "tablet"] as const;

export const visitorDetailsSchema = z.object({
  /** ISO 3166-1 alpha-2, from the request's location headers. Empty locally. */
  countryCode: z.string().nullable(),
  city: z.string().nullable(),
  /** IANA time zone sent by the widget, e.g. `Europe/Berlin`. */
  timezone: z.string().nullable(),
  /** BCP 47 browser language sent by the widget, e.g. `de-DE`. */
  language: z.string().nullable(),
  device: z.enum(DEVICE_TYPES),
  browser: z.string().nullable(),
  os: z.string().nullable(),
  page: z.string().nullable(),
  referrer: z.string().nullable(),
  visitCount: z.number().int(),
});
export type VisitorDetails = z.infer<typeof visitorDetailsSchema>;

export const visitorSchema = z.object({
  id: z.string(),
  details: visitorDetailsSchema,
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});
export type Visitor = z.infer<typeof visitorSchema>;

export const systemEventSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("greeting"), body: z.string() }),
  z.object({ kind: z.literal("handoff"), reason: handoffReasonSchema }),
  z.object({ kind: z.literal("taken_over") }),
  z.object({ kind: z.literal("handed_back") }),
  z.object({
    kind: z.literal("closed"),
    by: z.enum(["member", "inactivity"]),
  }),
]);
export type SystemEvent = z.infer<typeof systemEventSchema>;

export const messageMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string(),
});
export type MessageMember = z.infer<typeof messageMemberSchema>;

const messageBase = {
  id: z.string(),
  conversationId: z.string(),
  createdAt: z.string(),
};

export const messageSchema = z.discriminatedUnion("author", [
  z.object({
    ...messageBase,
    author: z.literal("visitor"),
    body: z.string(),
    classification: messageClassificationSchema.nullable(),
    declined: z.boolean(),
  }),
  z.object({ ...messageBase, author: z.literal("agent"), body: z.string() }),
  z.object({
    ...messageBase,
    author: z.literal("member"),
    body: z.string(),
    member: messageMemberSchema,
  }),
  z.object({
    ...messageBase,
    author: z.literal("system"),
    event: systemEventSchema,
  }),
]);
export type Message = z.infer<typeof messageSchema>;
export type MessageAuthor = Message["author"];

export const conversationSchema = z.object({
  id: z.string(),
  state: conversationStateSchema,
  /** The reason recorded on the most recent move to `waiting`. */
  handoffReason: handoffReasonSchema.nullable(),
  createdAt: z.string(),
  lastMessageAt: z.string(),
  closedAt: z.string().nullable(),
  /** Changes with every state change and message; newer wins in client caches. */
  updatedAt: z.string(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const conversationSummarySchema = conversationSchema.extend({
  visitor: visitorSchema,
  unread: z.boolean(),
  /** The latest visitor, agent or member message, for the list. */
  preview: z.string().nullable(),
});
export type ConversationSummary = z.infer<typeof conversationSummarySchema>;

export const replySourceSchema = z.object({
  id: z.string(),
  /** `null` once the source has been deleted. */
  name: z.string().nullable(),
});
export type ReplySource = z.infer<typeof replySourceSchema>;

export const AGENT_TURN_OUTCOMES = [
  "answered",
  "small_talk",
  "declined",
  "handoff",
  /** A newer visitor message or a take-over replaced the reply; nothing was saved. */
  "discarded",
  "failed",
] as const;
export const agentTurnOutcomeSchema = z.enum(AGENT_TURN_OUTCOMES);
export type AgentTurnOutcome = z.infer<typeof agentTurnOutcomeSchema>;

export const agentTurnMatchSchema = z.object({
  chunkId: z.string(),
  /** Cosine similarity, 0 to 1. */
  score: z.number(),
  /** `null` once a re-ingest or deletion replaced the chunk. */
  sourceId: z.string().nullable(),
  sourceName: z.string().nullable(),
  /** Whether the chunk was part of the context the reply was answered from. */
  used: z.boolean(),
});
export type AgentTurnMatch = z.infer<typeof agentTurnMatchSchema>;

export const agentTurnSummarySchema = z.object({
  classification: messageClassificationSchema,
  outcome: agentTurnOutcomeSchema,
  handoffReason: handoffReasonSchema.nullable(),
  /** Every retrieved chunk, best first. Empty when the agent didn't search. */
  matches: z.array(agentTurnMatchSchema),
  classifierModel: z.string(),
  model: z.string().nullable(),
  tokensIn: z.number().int(),
  tokensOut: z.number().int(),
  latencyMs: z.number().int(),
  firstTokenMs: z.number().int().nullable(),
  error: z.string().nullable(),
  createdAt: z.string(),
});
export type AgentTurnSummary = z.infer<typeof agentTurnSummarySchema>;

export const conversationDetailSchema = conversationSummarySchema.extend({
  messages: z.array(messageSchema),
  /**
   * The knowledge base sources each agent reply was answered from, keyed by
   * message id. Owner-only: the widget never receives it.
   */
  agentSources: z.record(z.string(), z.array(replySourceSchema)).optional(),
  /**
   * How the agent handled each visitor message, keyed by the visitor
   * message's id. Owner-only: the widget never receives it.
   */
  agentTurns: z.record(z.string(), agentTurnSummarySchema).optional(),
});
export type ConversationDetail = z.infer<typeof conversationDetailSchema>;

// ---------------------------------------------------------------------------
// Flow C (PRD section 6): the only place conversation transitions are decided.

export type MemberAction = "take_over" | "reply" | "hand_back" | "close";

/** The state a member action leads to, or `null` when it isn't allowed. */
export function nextState(
  state: ConversationState,
  action: MemberAction,
): ConversationState | null {
  switch (action) {
    case "take_over":
      switch (state) {
        case "ai":
        case "waiting":
          return "human";
        case "human":
        case "closed":
          return null;
        default: {
          const unhandled: never = state;
          throw new Error(`Unhandled state: ${String(unhandled)}`);
        }
      }
    case "reply":
      switch (state) {
        case "ai":
        case "waiting":
        case "human":
          return "human";
        case "closed":
          return null;
        default: {
          const unhandled: never = state;
          throw new Error(`Unhandled state: ${String(unhandled)}`);
        }
      }
    case "hand_back":
      switch (state) {
        case "human":
          return "ai";
        case "ai":
        case "waiting":
        case "closed":
          return null;
        default: {
          const unhandled: never = state;
          throw new Error(`Unhandled state: ${String(unhandled)}`);
        }
      }
    case "close":
      switch (state) {
        case "ai":
        case "waiting":
        case "human":
          return "closed";
        case "closed":
          return null;
        default: {
          const unhandled: never = state;
          throw new Error(`Unhandled state: ${String(unhandled)}`);
        }
      }
    default: {
      const unhandled: never = action;
      throw new Error(`Unhandled action: ${String(unhandled)}`);
    }
  }
}

/** The states a member action may start from. Used as the guard in `WHERE state IN (...)`. */
export function allowedFromStates(action: MemberAction): ConversationState[] {
  return CONVERSATION_STATES.filter(
    (state) => nextState(state, action) !== null,
  );
}

/** The state a new conversation starts in (PRD Flow C, "Agent off"). */
export function initialConversationState(agentEnabled: boolean): {
  state: ConversationState;
  handoffReason: HandoffReason | null;
} {
  return agentEnabled
    ? { state: "ai", handoffReason: null }
    : { state: "waiting", handoffReason: "agent_off" };
}
