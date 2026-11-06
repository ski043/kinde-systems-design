import * as z from "zod";

export const billingCycleSchema = z.object({
  start: z.iso.datetime(),
  end: z.iso.datetime(),
  /** `calendar_month` only when Kinde reports no current billing period. */
  source: z.enum(["kinde", "calendar_month"]),
});

/** The workspace's plan and this cycle's AI reply usage, as Kinde Billing reports them. */
export const billingOverviewSchema = z.object({
  plan: z.object({ code: z.string(), name: z.string() }).nullable(),
  cycle: billingCycleSchema,
  aiReplies: z.object({
    /** Whether the plan includes AI replies at all. Without them the agent hands every question off. */
    available: z.boolean(),
    /** AI replies this cycle, from the usage ledger. */
    used: z.number().int(),
    /** Units included each cycle. Null when the plan sets no limit. */
    included: z.number().int().nullable(),
    /** True: replies past `included` are billed as extra. False: the agent hands off at `included`. */
    overageBilled: z.boolean(),
    /** Units past `included`, billed as extra on the next invoice. */
    extra: z.number().int(),
  }),
  /** Whether the plan includes reply suggestions for members. */
  replySuggestions: z.object({ available: z.boolean() }),
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
