import {
  countSucceededAiReplies,
  findLatestUsageReport,
  getWorkspace,
  listWorkspacesWithRecentUsage,
  recordUsageReport,
  withAdvisoryLock,
  type WorkspaceRecord,
} from "@marshaldesk/db";
import { getMeterUsage, recordAbsoluteMeterUsage } from "./billing-api";
import {
  AI_REPLIES_FEATURE,
  getWorkspaceBilling,
  type BillingCycle,
} from "./billing-state";

type MeteredWorkspace = {
  workspace: WorkspaceRecord;
  agreementId: string;
  cycle: BillingCycle;
  /** Succeeded AI replies in the cycle: the usage ledger's total. */
  ledgerTotal: number;
};

/** `not_billed`: the plan caps AI replies instead of billing extra ones, so Kinde has nothing to charge. */
export type UsageSkipReason = "not_subscribed" | "not_on_plan" | "not_billed";

/** Resolves the workspace's agreement and ledger total. Call inside the workspace's usage lock. */
async function meter(
  workspaceId: string,
  options: { fresh: boolean },
): Promise<MeteredWorkspace | UsageSkipReason> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} doesn't exist`);
  const billing = await getWorkspaceBilling(workspace, options);
  if (billing.kind === "unsubscribed") return "not_subscribed";
  if (!billing.aiReplies) return "not_on_plan";
  if (!billing.aiReplies.overageBilled) return "not_billed";
  const ledgerTotal = await countSucceededAiReplies(workspaceId, {
    from: billing.cycle.start,
    to: billing.cycle.end,
  });
  return {
    workspace,
    agreementId: billing.agreementId,
    cycle: billing.cycle,
    ledgerTotal,
  };
}

async function sendTotal(metered: MeteredWorkspace): Promise<number | null> {
  const recorded = await recordAbsoluteMeterUsage({
    agreementId: metered.agreementId,
    featureCode: AI_REPLIES_FEATURE,
    total: metered.ledgerTotal,
  });
  await recordUsageReport(metered.workspace.id, {
    feature: AI_REPLIES_FEATURE,
    kindeAgreementId: metered.agreementId,
    cycleStart: metered.cycle.start,
    cycleEnd: metered.cycle.end,
    reportedTotal: metered.ledgerTotal,
    kindeRecordId: recorded.recordId,
  });
  console.info(
    JSON.stringify({
      event: "usage.reported",
      workspaceId: metered.workspace.id,
      agreementId: metered.agreementId,
      cycleStart: metered.cycle.start,
      total: metered.ledgerTotal,
      kindeUsage: recorded.currentUsage,
    }),
  );
  return recorded.currentUsage;
}

export type UsageReportOutcome =
  | { kind: "reported"; total: number; kindeUsage: number | null }
  | { kind: "unchanged"; total: number }
  | { kind: "skipped"; reason: UsageSkipReason | "nothing_used" };

/**
 * Reports the workspace's AI reply total for its current billing cycle to
 * Kinde, as an absolute value from the usage ledger. One
 * report per workspace runs at a time, and each counts the ledger only once it
 * holds the lock, so a later report always carries a total at least as new as
 * an earlier one, and a repeated report can't double count.
 */
export async function reportAiReplyUsage(
  workspaceId: string,
): Promise<UsageReportOutcome> {
  return withAdvisoryLock("usage_report", workspaceId, async () => {
    const metered = await meter(workspaceId, { fresh: false });
    if (typeof metered === "string")
      return { kind: "skipped", reason: metered };
    // Kinde only accepts a meter value above zero.
    if (metered.ledgerTotal === 0) {
      return { kind: "skipped", reason: "nothing_used" };
    }
    const last = await findLatestUsageReport(workspaceId, {
      feature: AI_REPLIES_FEATURE,
      kindeAgreementId: metered.agreementId,
      cycleStart: metered.cycle.start,
    });
    if (last?.reportedTotal === metered.ledgerTotal) {
      return { kind: "unchanged", total: metered.ledgerTotal };
    }
    const kindeUsage = await sendTotal(metered);
    return { kind: "reported", total: metered.ledgerTotal, kindeUsage };
  });
}

export type ReconcileOutcome =
  | { kind: "match"; total: number }
  | { kind: "corrected"; ledgerTotal: number; kindeTotal: number }
  /** Kinde has usage the ledger doesn't, and Kinde can't be set back to zero. */
  | { kind: "unresolved"; ledgerTotal: 0; kindeTotal: number }
  | { kind: "skipped"; reason: UsageSkipReason }
  | { kind: "failed"; error: string };

export type ReconcileResult = {
  workspaceId: string;
  outcome: ReconcileOutcome;
};

// Longer than a monthly cycle, so every workspace whose current cycle has usage is checked.
const RECENT_USAGE_DAYS = 35;

async function reconcileWorkspace(
  workspaceId: string,
): Promise<ReconcileOutcome> {
  return withAdvisoryLock("usage_report", workspaceId, async () => {
    const metered = await meter(workspaceId, { fresh: true });
    if (typeof metered === "string")
      return { kind: "skipped", reason: metered };
    const { currentUsage: kindeTotal } = await getMeterUsage(
      metered.agreementId,
      AI_REPLIES_FEATURE,
    );
    if (kindeTotal === metered.ledgerTotal) {
      return { kind: "match", total: kindeTotal };
    }
    console.warn(
      JSON.stringify({
        event: "usage.drift",
        workspaceId,
        agreementId: metered.agreementId,
        cycleStart: metered.cycle.start,
        ledgerTotal: metered.ledgerTotal,
        kindeTotal,
      }),
    );
    if (metered.ledgerTotal === 0) {
      return { kind: "unresolved", ledgerTotal: 0, kindeTotal };
    }
    await sendTotal(metered);
    return { kind: "corrected", ledgerTotal: metered.ledgerTotal, kindeTotal };
  });
}

/**
 * Compares each recently active workspace's ledger total with the usage Kinde
 * recorded for the current cycle, and reports the ledger's total again where
 * they differ. Workspaces without recent usage make no Kinde calls,
 * which keeps M2M token use low.
 */
export async function reconcileAiReplyUsage(
  now: Date = new Date(),
): Promise<ReconcileResult[]> {
  const since = new Date(now.getTime() - RECENT_USAGE_DAYS * 86_400_000);
  const workspaces = await listWorkspacesWithRecentUsage(since.toISOString());
  const results: ReconcileResult[] = [];
  for (const { workspaceId } of workspaces) {
    const outcome = await reconcileWorkspace(workspaceId).catch(
      (error: unknown): ReconcileOutcome => ({
        kind: "failed",
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    results.push({ workspaceId, outcome });
  }
  return results;
}
