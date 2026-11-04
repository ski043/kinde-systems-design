import * as z from "zod";

export const billingCycleSchema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  /** `calendar_month` only when Kinde reports no current billing period. */
  source: z.enum(["kinde", "calendar_month"]),
});

/** The workspace's plan and this cycle's reply suggestion usage, as Kinde Billing reports them. */
export const billingOverviewSchema = z.object({
  plan: z.object({ code: z.string(), name: z.string() }).nullable(),
  cycle: billingCycleSchema,
  replySuggestions: z.object({
    /** Whether the plan includes reply suggestions at all. */
    available: z.boolean(),
    /** Succeeded suggestions this cycle, from the usage ledger. */
    used: z.number().int(),
    /** Units included each cycle. Null when the plan sets no limit. */
    included: z.number().int().nullable(),
    /** Units past `included`, billed as extra on the next invoice. */
    extra: z.number().int(),
  }),
});
export type BillingOverview = z.infer<typeof billingOverviewSchema>;

/** Where in Kinde's self-serve portal to land. */
export const portalSectionSchema = z.enum(["plan", "payment"]);
export type PortalSection = z.infer<typeof portalSectionSchema>;

export const createPortalLinkSchema = z.object({
  section: portalSectionSchema,
});

export const portalLinkSchema = z.object({
  /** Single use, valid for 10 minutes. Open it right away. */
  url: z.url(),
});
