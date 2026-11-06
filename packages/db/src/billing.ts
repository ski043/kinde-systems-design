import { getDb } from "./client";

export type AdvisoryLockScope = "provisioning" | "usage_report";

/**
 * Runs `work` while holding a transaction-scoped Postgres advisory lock on
 * `(scope, id)`, so concurrent callers for the same id run one after another,
 * across every server instance. `work` uses its own connections; the lock's
 * transaction only holds the lock and ends with it.
 */
export async function withAdvisoryLock<T>(
  scope: AdvisoryLockScope,
  id: string,
  work: () => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const lock = db.raw.sql`
      SELECT pg_advisory_xact_lock(hashtextextended(${`${scope}:${id}`}, 0))::text AS locked`
      .returnsRow({ locked: "pg/text@1" })
      .build();
    await tx.query(lock);
    return work();
  });
}

export type BillingChangeTarget =
  | { kind: "customer"; customerId: string }
  | { kind: "organization"; orgCode: string }
  | { kind: "all" };

/**
 * Marks billing state cached before now as stale for the matching workspaces.
 * Not workspace-scoped: a Kinde billing webhook names a customer, not a
 * workspace. Returns how many workspaces it marked.
 */
export async function markBillingChanged(
  target: BillingChangeTarget,
): Promise<number> {
  const db = getDb();
  const customerId = target.kind === "customer" ? target.customerId : "";
  const orgCode = target.kind === "organization" ? target.orgCode : "";
  const plan = db.raw.sql`
    UPDATE workspaces
    SET billing_changed_at = clock_timestamp()
    WHERE kinde_billing_customer_id IS NOT NULL
      AND (${target.kind} = 'all'
        OR kinde_billing_customer_id = NULLIF(${customerId}, '')
        OR kinde_org_code = NULLIF(${orgCode}, ''))
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  const rows = await db.runtime().query(plan);
  return rows.length;
}

/**
 * Workspaces with a billing customer and an AI reply that succeeded
 * since `since`: the ones whose usage the reconciliation compares. Not
 * workspace-scoped: the schedule trigger checks every workspace.
 */
export async function listWorkspacesWithRecentUsage(
  since: string,
): Promise<{ workspaceId: string }[]> {
  const db = getDb();
  const plan = db.raw.sql`
    SELECT w.id AS workspace_id
    FROM workspaces w
    WHERE w.kinde_billing_customer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM ai_replies r
        WHERE r.workspace_id = w.id
          AND r.status = 'succeeded'
          AND r.finished_at >= ${since}::timestamptz)
    ORDER BY w.id`
    .returnsRow({ workspace_id: "pg/uuid@1" })
    .build();
  const rows = await db.runtime().query(plan);
  return rows.map((row) => ({ workspaceId: row.workspace_id }));
}

export type UsageReportRecord = {
  reportedTotal: number;
  kindeRecordId: string;
};

/** The last total reported for this agreement's billing cycle, or null if none was. */
export async function findLatestUsageReport(
  workspaceId: string,
  input: { feature: string; kindeAgreementId: string; cycleStart: string },
): Promise<UsageReportRecord | null> {
  const db = getDb();
  const plan = db.raw.sql`
    SELECT reported_total, kinde_record_id
    FROM usage_reports
    WHERE workspace_id = ${workspaceId}::uuid
      AND feature = ${input.feature}
      AND kinde_agreement_id = ${input.kindeAgreementId}
      AND cycle_start = ${input.cycleStart}::timestamptz
    ORDER BY reported_at DESC
    LIMIT 1`
    .returnsRow({ reported_total: "pg/int4@1", kinde_record_id: "pg/text@1" })
    .build();
  const [row] = await db.runtime().query(plan);
  return row
    ? { reportedTotal: row.reported_total, kindeRecordId: row.kinde_record_id }
    : null;
}

export type NewUsageReport = {
  feature: string;
  kindeAgreementId: string;
  cycleStart: string;
  cycleEnd: string;
  reportedTotal: number;
  kindeRecordId: string;
};

export async function recordUsageReport(
  workspaceId: string,
  input: NewUsageReport,
): Promise<void> {
  const db = getDb();
  const plan = db.raw.sql`
    INSERT INTO usage_reports
      (id, workspace_id, feature, kinde_agreement_id, cycle_start, cycle_end,
       reported_total, kinde_record_id, reported_at)
    VALUES (uuidv7(), ${workspaceId}::uuid, ${input.feature}, ${input.kindeAgreementId},
      ${input.cycleStart}::timestamptz, ${input.cycleEnd}::timestamptz,
      ${input.reportedTotal}::int, ${input.kindeRecordId}, clock_timestamp())
    RETURNING id`
    .returnsRow({ id: "pg/uuid@1" })
    .build();
  await db.runtime().query(plan);
}

// Not workspace-scoped: Kinde webhooks are per environment.

export async function hasKindeWebhookDelivery(
  webhookId: string,
): Promise<boolean> {
  const row = await getDb()
    .orm.public.KindeWebhookDelivery.select("webhookId")
    .where({ webhookId })
    .first();
  return Boolean(row);
}

/** Records a handled delivery. A retry recorded concurrently is a no-op. */
export async function recordKindeWebhookDelivery(
  webhookId: string,
  type: string,
): Promise<void> {
  const db = getDb();
  const plan = db.raw.sql`
    INSERT INTO kinde_webhook_deliveries (webhook_id, type, received_at)
    VALUES (${webhookId}, ${type}, clock_timestamp())
    ON CONFLICT (webhook_id) DO NOTHING
    RETURNING webhook_id`
    .returnsRow({ webhook_id: "pg/text@1" })
    .build();
  await db.runtime().query(plan);
}
