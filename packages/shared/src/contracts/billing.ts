import { oc } from "@orpc/contract";
import { openapi } from "@orpc/openapi";
import { permissionErrors } from "../errors";
import {
  billingOverviewSchema,
  createPortalLinkSchema,
  portalLinkSchema,
} from "../schemas/billing";

export const billingContract = {
  get: oc
    .errors(permissionErrors)
    .meta(
      openapi({
        method: "GET",
        path: "/billing",
        summary: "Get the workspace's plan, billing cycle, and AI reply usage",
        description:
          "Reads the plan from Kinde Billing on every call, so it reflects a plan change made in the portal right away. Needs `billing:manage`.",
        tags: ["Billing"],
      }),
    )
    .output(billingOverviewSchema),
  createPortalLink: oc
    .errors(permissionErrors)
    .meta(
      openapi({
        method: "POST",
        path: "/billing/portal-link",
        summary: "Get a link to Kinde's self-serve portal for the workspace",
        description:
          "`plan` opens plan selection and `payment` the payment details. The link is single use and expires after 10 minutes, so request one per click. Needs `billing:manage`.",
        tags: ["Billing"],
      }),
    )
    .input(createPortalLinkSchema)
    .output(portalLinkSchema),
};
