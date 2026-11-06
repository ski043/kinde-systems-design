import "server-only";
import { countSucceededAiReplies, getWorkspace } from "@marshaldesk/db";
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
  const used = await countSucceededAiReplies(context.workspaceId, {
    from: billing.cycle.start,
    to: billing.cycle.end,
  });
  const subscribed = billing.kind === "subscribed" ? billing : null;
  const allowance = subscribed?.aiReplies ?? null;
  const included = allowance?.included ?? null;
  const overageBilled = allowance?.overageBilled ?? false;
  return {
    plan: subscribed?.plan ?? null,
    cycle: billing.cycle,
    aiReplies: {
      available: allowance !== null,
      used,
      included,
      overageBilled,
      extra:
        included === null || !overageBilled ? 0 : Math.max(0, used - included),
    },
    replySuggestions: { available: subscribed?.replySuggestions ?? false },
  };
});

export const createPortalLink = manageBilling.billing.createPortalLink.handler(
  async ({ input }) => ({ url: await createKindePortalLink(input.section) }),
);
