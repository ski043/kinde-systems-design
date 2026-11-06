import "server-only";
import { countSucceededAiReplies, getWorkspace } from "@marshaldesk/db";
import {
  getWorkspaceBilling,
  reportAiReplyUsage,
  type WorkspaceBilling,
} from "@marshaldesk/kinde";

export type AiReplyAllowance =
  | { kind: "allowed" }
  | {
      kind: "denied";
      reason: "limit_reached" | "not_on_plan" | "billing_unavailable";
    };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Whether the agent may answer one more support question this billing cycle.
 * A plan that bills extra replies never blocks; a plan without a price for
 * them stops at its included amount. Without billing state the agent hands
 * off rather than answer for free.
 */
export async function checkAiReplyAllowance(
  workspaceId: string,
): Promise<AiReplyAllowance> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} doesn't exist`);

  let billing: WorkspaceBilling;
  try {
    billing = await getWorkspaceBilling(workspace);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "billing.unavailable",
        workspaceId,
        error: errorText(error),
      }),
    );
    return { kind: "denied", reason: "billing_unavailable" };
  }
  if (billing.kind === "unsubscribed" || !billing.aiReplies) {
    return { kind: "denied", reason: "not_on_plan" };
  }

  const { included, overageBilled } = billing.aiReplies;
  if (overageBilled || included === null) return { kind: "allowed" };

  const used = await countSucceededAiReplies(workspaceId, {
    from: billing.cycle.start,
    to: billing.cycle.end,
  });
  return used < included
    ? { kind: "allowed" }
    : { kind: "denied", reason: "limit_reached" };
}

/** Logs instead of throwing: the reconciliation job reports a missed total later. */
export async function reportAiReplyUsageSafely(
  workspaceId: string,
): Promise<void> {
  try {
    await reportAiReplyUsage(workspaceId);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "usage.report_failed",
        workspaceId,
        error: errorText(error),
      }),
    );
  }
}
