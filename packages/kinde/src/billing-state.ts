import type { WorkspaceRecord } from "@marshaldesk/db";
import { listAgreements, listEntitlements } from "./billing-api";

/** The Kinde feature key of reply suggestions, on every plan that includes them. */
export const REPLY_SUGGESTIONS_FEATURE = "reply_suggestions";

export type BillingCycle = {
  start: string;
  end: string;
  /** `calendar_month` only when Kinde reports no current period for the agreement. */
  source: "kinde" | "calendar_month";
};

export type ReplySuggestionsAllowance = {
  /** Units the plan includes each cycle, past which usage is billed as extra. Null: no limit set. */
  included: number | null;
};

export type WorkspaceBilling =
  | { kind: "unsubscribed"; cycle: BillingCycle }
  | {
      kind: "subscribed";
      plan: { code: string; name: string };
      agreementId: string;
      cycle: BillingCycle;
      /** Null when the plan doesn't include reply suggestions. */
      replySuggestions: ReplySuggestionsAllowance | null;
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
  const included = entitlements.features.get(REPLY_SUGGESTIONS_FEATURE);
  return {
    kind: "subscribed",
    plan,
    agreementId: agreement.id,
    cycle,
    replySuggestions: included === undefined ? null : { included },
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
 * The workspace's plan, current agreement, billing cycle, and reply
 * suggestion allowance, from Kinde Billing. Cached per billing customer for up
 * to a minute, unless `fresh` or a webhook marked it changed since.
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
  const billing = await loadBilling(customerId);
  cache.set(customerId, { billing, fetchedAt: now });
  return billing;
}
