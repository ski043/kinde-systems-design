import "server-only";
import { getWorkspace } from "@marshaldesk/db";
import { getWorkspaceBilling } from "@marshaldesk/kinde";

export type EntitledFeature = "reply_suggestions";

/**
 * Usage past a plan's included units is billed as extra, never blocked: Kinde
 * accepts meter usage above the grant and bills it on the next invoice.
 */
export type Entitlement = { kind: "not_included" } | { kind: "included" };

/** What the workspace's plan in Kinde Billing allows for `feature` right now. */
export async function checkEntitlement(
  workspaceId: string,
  feature: EntitledFeature,
): Promise<Entitlement> {
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) throw new Error(`Workspace ${workspaceId} doesn't exist`);
  const billing = await getWorkspaceBilling(workspace);
  switch (feature) {
    case "reply_suggestions":
      return billing.kind === "subscribed" && billing.replySuggestions
        ? { kind: "included" }
        : { kind: "not_included" };
    default: {
      const unhandled: never = feature;
      throw new Error(`Unhandled feature: ${String(unhandled)}`);
    }
  }
}
