import type { WorkspaceRecord } from "@marshaldesk/db";
import { listAgreements, listEntitlements } from "./billing-api";

/** The metered Kinde feature key of AI replies: the agent's answers to visitors. */
export const AI_REPLIES_FEATURE = "ai_replies";

/** The unmetered Kinde feature key of reply suggestions, on the plans that include them. */
export const REPLY_SUGGESTIONS_FEATURE = "reply_suggestions";

export type BillingCycle = {
  start: string;
  end: string;
  /** `calendar_month` only when Kinde reports no current period for the agreement. */
  source: "kinde" | "calendar_month";
};

export type AiRepliesAllowance = {
  /** Units the plan includes each cycle. Null: no limit set. */
  included: number | null;
  /**
   * True: replies past `included` are billed per unit. False: the plan has no
   * price for the feature, so `included` is a hard cap.
   */
  overageBilled: boolean;
};

export type WorkspaceBilling =
  | { kind: "unsubscribed"; cycle: BillingCycle }
  | {
      kind: "subscribed";
      plan: { code: string; name: string };
      agreementId: string;
      cycle: BillingCycle;
      /** Null when the plan doesn't include AI replies. */
      aiReplies: AiRepliesAllowance | null;
      replySuggestions: boolean;
    };

function calendarMonth(now: Date): BillingCycle {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
    source: "calendar_month",
  };
}

function isCurrent(expiresOn: string | null, now: Date): boolean {
  return expiresOn === null || new Date(expiresOn) > now;
}

async function loadBilling(customerId: string): Promise<WorkspaceBilling> {
  const now = new Date();
  const [agreements, entitlements] = await Promise.all([
    listAgreements(customerId),
    listEntitlements(customerId),
  ]);
  const agreement = agreements.find((candidate) =>
    isCurrent(candidate.expiresOn, now),
  );
  if (!agreement) return { kind: "unsubscribed", cycle: calendarMonth(now) };

  // Kinde may report a period whose end already passed while a cycle roll lags.
  const period = agreement.currentPeriod;
  const cycle: BillingCycle =
    period && new Date(period.end) > now
      ? {
          start: new Date(period.start).toISOString(),
          end: new Date(period.end).toISOString(),
          source: "kinde",
        }
      : calendarMonth(now);
  const plan = entitlements.plans.find(
    (candidate) => candidate.code === agreement.planCode,
  ) ?? { code: agreement.planCode, name: agreement.planCode };
  // Kinde has no hard-cap flag: a metered feature without a unit price is capped.
  const aiReplies = entitlements.features.get(AI_REPLIES_FEATURE);
  return {
    kind: "subscribed",
    plan,
    agreementId: agreement.id,
    cycle,
    aiReplies: aiReplies
      ? {
          included: aiReplies.max,
          overageBilled: (aiReplies.unitAmount ?? 0) > 0,
        }
      : null,
    replySuggestions: entitlements.features.has(REPLY_SUGGESTIONS_FEATURE),
  };
}

// Plan changes reach the app within a minute (PRD B-4): entries expire after
// 60 s, and a webhook makes them stale at once by bumping billing_changed_at.
const CACHE_TTL_MS = 60_000;

const cache = new Map<
  string,
  { billing: WorkspaceBilling; fetchedAt: number }
>();

/**
 * The workspace's plan, current agreement, billing cycle, and features, from
 * Kinde Billing. Cached per billing customer for up to a minute, unless
 * `fresh` or a webhook marked it changed since. When Kinde can't be reached,
 * a call that isn't `fresh` gets the last state it returned, however old.
 */
export async function getWorkspaceBilling(
  workspace: Pick<
    WorkspaceRecord,
    "kindeBillingCustomerId" | "billingChangedAt"
  >,
  options: { fresh?: boolean } = {},
): Promise<WorkspaceBilling> {
  const customerId = workspace.kindeBillingCustomerId;
  if (!customerId) {
    return { kind: "unsubscribed", cycle: calendarMonth(new Date()) };
  }
  const cached = cache.get(customerId);
  const now = Date.now();
  if (
    !options.fresh &&
    cached &&
    now - cached.fetchedAt < CACHE_TTL_MS &&
    cached.fetchedAt > workspace.billingChangedAt.epochMilliseconds
  ) {
    return cached.billing;
  }
  try {
    const billing = await loadBilling(customerId);
    cache.set(customerId, { billing, fetchedAt: now });
    return billing;
  } catch (error) {
    if (cached && !options.fresh) return cached.billing;
    throw error;
  }
}
