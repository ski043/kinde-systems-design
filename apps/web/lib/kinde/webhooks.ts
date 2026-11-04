import "server-only";
import type { BillingChangeTarget } from "@marshaldesk/db";
import { createRemoteJWKSet, jwtVerify } from "jose";
import * as z from "zod";

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

// Kinde signs webhook bodies (RS256) with this environment's keys.
function kindeKeys(): ReturnType<typeof createRemoteJWKSet> {
  const issuer = z
    .url()
    .transform((url) => url.replace(/\/+$/, ""))
    .parse(process.env["KINDE_ISSUER_URL"]);
  jwks ??= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks`));
  return jwks;
}

const eventSchema = z.object({
  type: z.string(),
  event_id: z.string().optional(),
  data: z.unknown(),
});

export type KindeWebhookEvent = z.infer<typeof eventSchema>;

/** The event in a signed webhook body, or null when the signature or shape is wrong. */
export async function verifyKindeWebhook(
  body: string,
): Promise<KindeWebhookEvent | null> {
  try {
    const { payload } = await jwtVerify(body, kindeKeys(), {
      algorithms: ["RS256"],
    });
    const event = eventSchema.safeParse(payload);
    return event.success ? event.data : null;
  } catch {
    return null;
  }
}

export const BILLING_EVENT_TYPES = new Set([
  "customer.agreement_created",
  "customer.agreement_cancelled",
  "customer.plan_assigned",
  "customer.plan_changed",
  "customer.meter_usage_updated",
]);

function findString(
  value: unknown,
  matches: (key: string, text: string) => boolean,
): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, matches);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (typeof item === "string" && matches(key, item)) return item;
      const found = findString(item, matches);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Which workspaces a billing event is about. Kinde doesn't document these
 * payloads, so this looks for a billing customer id, then an organization
 * code, anywhere in the data, and otherwise marks every workspace.
 */
export function billingChangeTarget(data: unknown): BillingChangeTarget {
  const customerId = findString(data, (_key, text) =>
    /^customer_[0-9a-z]+$/.test(text),
  );
  if (customerId) return { kind: "customer", customerId };
  const orgCode = findString(
    data,
    (key, text) =>
      /(^|_)(org_)?code$/.test(key) && /^org_[0-9a-z]+$/.test(text),
  );
  if (orgCode) return { kind: "organization", orgCode };
  return { kind: "all" };
}
