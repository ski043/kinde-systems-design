import "server-only";
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import type { PortalSection } from "@marshaldesk/shared";
import * as z from "zod";
import { routes } from "@/lib/routes";

const envSchema = z.object({
  KINDE_ISSUER_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
  KINDE_SITE_URL: z.url().transform((url) => url.replace(/\/+$/, "")),
});

// The organization areas: the Account API resolves the billing customer
// through the access token's org_code, which is the member's workspace.
const SUBNAV: Record<PortalSection, string> = {
  plan: "organization_plan_selection",
  payment: "organization_payment_details",
};

const portalLinkSchema = z.object({ url: z.url() });

/**
 * A single-use, 10-minute link into Kinde's self-serve portal, made with the
 * member's own access token (Account API). Kinde checks `org:write:billing`
 * itself before it lets the member change the plan.
 */
export async function createPortalLink(
  section: PortalSection,
): Promise<string> {
  const env = envSchema.parse(process.env);
  const token = await getKindeServerSession().getAccessTokenRaw();
  if (!token) throw new Error("The session has no access token");
  const params = new URLSearchParams({
    subnav: SUBNAV[section],
    return_url: `${env.KINDE_SITE_URL}${routes.billing}`,
  });
  const response = await fetch(
    `${env.KINDE_ISSUER_URL}/account_api/v1/portal_link?${params}`,
    {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(
      `Kinde Account API portal_link failed (${response.status}): ${await response.text()}`,
    );
  }
  return portalLinkSchema.parse(await response.json()).url;
}
