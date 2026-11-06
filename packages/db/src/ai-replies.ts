import { getDb } from "./client";

export type AiReplyStatusValue = "pending" | "succeeded" | "failed";

/**
 * The outcome of claiming a visitor message for one AI reply. Only `claimed`
 * may call the answer model; the message was answered, or is being answered,
 * otherwise.
 */
export type AiReplyClaim =
  | { kind: "claimed"; aiReplyId: string }
  | { kind: "succeeded" }
  | { kind: "in_progress" };

export type NewAiReply = {
  conversationId: string;
  /** The visitor message being answered: the idempotency key. */
  messageId: string;
  model: string;
};

// Longer than any agent turn, so a pending row this old lost its run.
const STALE_PENDING = "5 minutes";

/**
 * Claims the visitor message for one AI reply. A new message inserts a
 * `pending` row; a `failed` one, or a `pending` one whose run died, is moved
 * back to `pending`. A `succeeded` message is never claimed again.
 */
export async function claimAiReply(
  workspaceId: string,
  input: NewAiReply,
): Promise<AiReplyClaim> {
  const db = getDb();
  const insert = db.raw.sql`
    INSERT INTO ai_replies (id, workspace_id, conversation_id, message_id, status, model)
    VALUES (uuidv7(), ${workspaceId}::uuid, ${input.conversationId}::uuid,
      ${input.messageId}::uuid, 'pending', ${input.model})
    ON CONFLICT (workspace_id, message_id) DO NOTHING
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const [inserted] = await db.runtime().query(insert);
  if (inserted) return { kind: "claimed", aiReplyId: inserted.id };

  const reclaim = db.raw.sql`
    UPDATE ai_replies
    SET status = 'pending',
        model = ${input.model},
        error = NULL,
        tokens_in = 0,
        tokens_out = 0,
        latency_ms = NULL,
        created_at = clock_timestamp(),
        finished_at = NULL
    WHERE workspace_id = ${workspaceId}::uuid
      AND message_id = ${input.messageId}::uuid
      AND (status = 'failed'
        OR (status = 'pending' AND created_at < clock_timestamp() - ${STALE_PENDING}::interval))
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const [reclaimed] = await db.runtime().query(reclaim);
  if (reclaimed) return { kind: "claimed", aiReplyId: reclaimed.id };

  const existing = await db.orm.public.AiReply.select("status")
    .where({ workspaceId, messageId: input.messageId })
    .first();
  // Deleted with its message between the insert and this read.
  if (!existing) return { kind: "in_progress" };
  switch (existing.status) {
    case "succeeded":
      return { kind: "succeeded" };
    case "pending":
    // Failed again between the reclaim and this read; a later run may retry.
    case "failed":
      return { kind: "in_progress" };
    default: {
      const unhandled: never = existing.status;
      throw new Error(`Unhandled AI reply status: ${String(unhandled)}`);
    }
  }
}

export type AiReplyResult = {
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
} & ({ status: "succeeded" } | { status: "failed"; error: string });

/**
 * Finishes a claimed AI reply. Only a `pending` row changes, so a result is
 * recorded at most once. Returns whether it was recorded.
 */
export async function finishAiReply(
  workspaceId: string,
  aiReplyId: string,
  result: AiReplyResult,
): Promise<boolean> {
  const db = getDb();
  // Non-empty when set, so '' stands for NULL.
  const error = result.status === "failed" ? result.error : "";
  const plan = db.raw.sql`
    UPDATE ai_replies
    SET status = ${result.status},
        error = NULLIF(${error}, ''),
        tokens_in = ${result.tokensIn}::int,
        tokens_out = ${result.tokensOut}::int,
        latency_ms = ${Math.round(result.latencyMs)}::int,
        finished_at = clock_timestamp()
    WHERE id = ${aiReplyId}::uuid
      AND workspace_id = ${workspaceId}::uuid
      AND status = 'pending'
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const rows = await db.runtime().query(plan);
  return rows.length > 0;
}

/** Usage: AI replies that finished successfully in `[from, to)`. */
export async function countSucceededAiReplies(
  workspaceId: string,
  cycle: { from: string; to: string },
): Promise<number> {
  const db = getDb();
  const plan = db.raw.sql`
    SELECT count(*)::int AS used
    FROM ai_replies
    WHERE workspace_id = ${workspaceId}::uuid
      AND status = 'succeeded'
      AND finished_at >= ${cycle.from}::timestamptz
      AND finished_at < ${cycle.to}::timestamptz`
    .returnsRow({ used: "pg/int4@1" })
    .build();
  const [row] = await db.runtime().query(plan);
  return row?.used ?? 0;
}
