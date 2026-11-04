import { getDb } from "./client";

export type ReplySuggestionStatusValue = "pending" | "succeeded" | "failed";

/**
 * The outcome of claiming an idempotency key. `claimed` means this request
 * owns a `pending` row and may call the model; the others never do.
 */
export type ReplySuggestionClaim =
  | { kind: "claimed"; suggestionId: string }
  | { kind: "succeeded"; suggestionId: string; body: string }
  | { kind: "in_progress" }
  | { kind: "other_conversation" };

export type NewReplySuggestion = {
  conversationId: string;
  memberId: string;
  idempotencyKey: string;
  model: string;
};

// Longer than the 300 s route limit, so a pending row this old lost its request.
const STALE_PENDING = "6 minutes";

/**
 * Claims `idempotencyKey` for one generation. A new key inserts a `pending`
 * row; a `failed` key, or a `pending` one whose request died, is moved back to
 * `pending`. A `succeeded` key returns its stored body.
 */
export async function claimReplySuggestion(
  workspaceId: string,
  input: NewReplySuggestion,
): Promise<ReplySuggestionClaim> {
  const db = getDb();
  const insert = db.raw.sql`
    INSERT INTO reply_suggestions
      (id, workspace_id, conversation_id, member_id, idempotency_key, status, model)
    VALUES (uuidv7(), ${workspaceId}::uuid, ${input.conversationId}::uuid,
      ${input.memberId}::uuid, ${input.idempotencyKey}, 'pending', ${input.model})
    ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const [inserted] = await db.runtime().query(insert);
  if (inserted) return { kind: "claimed", suggestionId: inserted.id };

  const reclaim = db.raw.sql`
    UPDATE reply_suggestions
    SET status = 'pending',
        member_id = ${input.memberId}::uuid,
        model = ${input.model},
        body = NULL,
        error = NULL,
        tokens_in = 0,
        tokens_out = 0,
        latency_ms = NULL,
        created_at = clock_timestamp(),
        finished_at = NULL
    WHERE workspace_id = ${workspaceId}::uuid
      AND idempotency_key = ${input.idempotencyKey}
      AND conversation_id = ${input.conversationId}::uuid
      AND (status = 'failed'
        OR (status = 'pending' AND created_at < clock_timestamp() - ${STALE_PENDING}::interval))
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const [reclaimed] = await db.runtime().query(reclaim);
  if (reclaimed) return { kind: "claimed", suggestionId: reclaimed.id };

  const existing = await db.orm.public.ReplySuggestion.select(
    "id",
    "conversationId",
    "status",
    "body",
  )
    .where({ workspaceId, idempotencyKey: input.idempotencyKey })
    .first();
  if (!existing) {
    throw new Error(
      `Reply suggestion key ${input.idempotencyKey} conflicted but has no row`,
    );
  }
  if (existing.conversationId !== input.conversationId) {
    return { kind: "other_conversation" };
  }
  switch (existing.status) {
    case "succeeded":
      if (existing.body === null) {
        throw new Error(
          `Reply suggestion ${existing.id} succeeded without a body`,
        );
      }
      return {
        kind: "succeeded",
        suggestionId: existing.id,
        body: existing.body,
      };
    case "pending":
      return { kind: "in_progress" };
    case "failed":
      // Failed again between the reclaim and this read; the caller may retry.
      return { kind: "in_progress" };
    default: {
      const unhandled: never = existing.status;
      throw new Error(
        `Unhandled reply suggestion status: ${String(unhandled)}`,
      );
    }
  }
}

export type ReplySuggestionResult = {
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
} & (
  { status: "succeeded"; body: string } | { status: "failed"; error: string }
);

/**
 * Finishes a claimed suggestion. Only a `pending` row changes, so a result is
 * recorded at most once. Returns whether it was recorded.
 */
export async function finishReplySuggestion(
  workspaceId: string,
  suggestionId: string,
  result: ReplySuggestionResult,
): Promise<boolean> {
  const db = getDb();
  // Both are non-empty when set, so '' stands for NULL.
  const body = result.status === "succeeded" ? result.body : "";
  const error = result.status === "failed" ? result.error : "";
  const plan = db.raw.sql`
    UPDATE reply_suggestions
    SET status = ${result.status},
        body = NULLIF(${body}, ''),
        error = NULLIF(${error}, ''),
        tokens_in = ${result.tokensIn}::int,
        tokens_out = ${result.tokensOut}::int,
        latency_ms = ${Math.round(result.latencyMs)}::int,
        finished_at = clock_timestamp()
    WHERE id = ${suggestionId}::uuid
      AND workspace_id = ${workspaceId}::uuid
      AND status = 'pending'
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const rows = await db.runtime().query(plan);
  return rows.length > 0;
}

/** Usage: suggestions that finished successfully in `[from, to)`. */
export async function countSucceededReplySuggestions(
  workspaceId: string,
  cycle: { from: string; to: string },
): Promise<number> {
  const db = getDb();
  const plan = db.raw.sql`
    SELECT count(*)::int AS used
    FROM reply_suggestions
    WHERE workspace_id = ${workspaceId}::uuid
      AND status = 'succeeded'
      AND finished_at >= ${cycle.from}::timestamptz
      AND finished_at < ${cycle.to}::timestamptz`
    .returnsRow({ used: "pg/int4@1" })
    .build();
  const [row] = await db.runtime().query(plan);
  return row?.used ?? 0;
}
