import "server-only";
import { countSucceededReplySuggestions, getWorkspace } from "@marshaldesk/db";
import { getWorkspaceBilling } from "@marshaldesk/kinde";
import { createPortalLink as createKindePortalLink } from "@/lib/kinde/portal";
import { memberProcedure, requirePermission } from "../procedures";

const manageBilling = memberProcedure.use(requirePermission("billing:manage"));

// Always fresh from Kinde, so returning from the portal shows the new plan
// even where no webhook can reach the app (local development).
export const get = manageBilling.billing.get.handler(async ({ context }) => {
  const workspace = await getWorkspace(context.workspaceId);
  if (!workspace) {
    throw new Error(`Workspace ${context.workspaceId} doesn't exist`);
  }
  const billing = await getWorkspaceBilling(workspace, { fresh: true });
  const used = await countSucceededReplySuggestions(context.workspaceId, {
    from: billing.cycle.start,
    to: billing.cycle.end,
  });
  const allowance =
    billing.kind === "subscribed" ? billing.replySuggestions : null;
  const included = allowance?.included ?? null;
  return {
    plan: billing.kind === "subscribed" ? billing.plan : null,
    cycle: billing.cycle,
    replySuggestions: {
      available: allowance !== null,
      used,
      included,
      extra: included === null ? 0 : Math.max(0, used - included),
    },
  };
});

export const createPortalLink = manageBilling.billing.createPortalLink.handler(
  async ({ input }) => ({ url: await createKindePortalLink(input.section) }),
);
