import * as z from "zod";
import { managementRequest } from "./management-api";

const agreementsSchema = z.object({
  agreements: z
    .array(
      z.object({
        id: z.string(),
        plan_code: z.string(),
        expires_on: z.string().nullish(),
        current_period_start: z.string().nullish(),
        current_period_end: z.string().nullish(),
      }),
    )
    .nullish(),
});

export type KindeAgreement = {
  id: string;
  planCode: string;
  expiresOn: string | null;
  currentPeriod: { start: string; end: string } | null;
};

/** The customer's agreements, current and ended. One page: a customer has one current agreement. */
export async function listAgreements(
  customerId: string,
): Promise<KindeAgreement[]> {
  const result = await managementRequest(
    "getBillingAgreements",
    `/api/v1/billing/agreements?${new URLSearchParams({ customer_id: customerId, page_size: "50" })}`,
    agreementsSchema,
  );
  return (result.agreements ?? []).map((agreement) => ({
    id: agreement.id,
    planCode: agreement.plan_code,
    expiresOn: agreement.expires_on ?? null,
    currentPeriod:
      agreement.current_period_start && agreement.current_period_end
        ? {
            start: agreement.current_period_start,
            end: agreement.current_period_end,
          }
        : null,
  }));
}

const entitlementsSchema = z.object({
  entitlements: z
    .array(
      z.object({
        feature_code: z.string(),
        entitlement_limit_max: z.number().int().nullish(),
      }),
    )
    .nullish(),
  plans: z
    .array(z.object({ code: z.string(), name: z.string().nullish() }))
    .nullish(),
});

export type KindeEntitlements = {
  plans: { code: string; name: string }[];
  /** Feature code to its configured maximum, null when the plan sets none. */
  features: Map<string, number | null>;
};

// Kinde reports a feature without a maximum as the largest 32-bit integer.
const NO_LIMIT = 2_147_483_647;

export async function listEntitlements(
  customerId: string,
): Promise<KindeEntitlements> {
  const result = await managementRequest(
    "getBillingEntitlements",
    `/api/v1/billing/entitlements?${new URLSearchParams({ customer_id: customerId, expand: "plans", page_size: "100" })}`,
    entitlementsSchema,
  );
  const features = new Map<string, number | null>();
  for (const entitlement of result.entitlements ?? []) {
    const max = entitlement.entitlement_limit_max ?? null;
    features.set(
      entitlement.feature_code,
      max === null || max >= NO_LIMIT ? null : max,
    );
  }
  return {
    plans: (result.plans ?? []).map((plan) => ({
      code: plan.code,
      name: plan.name ?? plan.code,
    })),
    features,
  };
}

const meterUsageSchema = z.object({
  current_usage: z.number().int().nullish(),
});

/** Kinde's running total for the agreement's current billing cycle. */
export async function getMeterUsage(
  agreementId: string,
  featureCode: string,
): Promise<{ currentUsage: number }> {
  const result = await managementRequest(
    "getBillingMeterUsage",
    `/api/v1/billing/meter_usage?${new URLSearchParams({ customer_agreement_id: agreementId, feature_code: featureCode, page_size: "1" })}`,
    meterUsageSchema,
  );
  return { currentUsage: result.current_usage ?? 0 };
}

const createdMeterUsageSchema = meterUsageSchema.extend({ id: z.string() });

/**
 * Replaces the agreement's running total for the current cycle with `total`.
 * Kinde has no idempotency key here, which is why only absolute totals are sent.
 */
export async function recordAbsoluteMeterUsage(input: {
  agreementId: string;
  featureCode: string;
  total: number;
}): Promise<{ recordId: string; currentUsage: number | null }> {
  const result = await managementRequest(
    "createMeterUsageRecord",
    "/api/v1/billing/meter_usage",
    createdMeterUsageSchema,
    {
      method: "POST",
      body: {
        customer_agreement_id: input.agreementId,
        billing_feature_code: input.featureCode,
        meter_value: input.total,
        meter_type_code: "absolute",
      },
    },
  );
  return { recordId: result.id, currentUsage: result.current_usage ?? null };
}
