import {
  hasKindeWebhookDelivery,
  markBillingChanged,
  recordKindeWebhookDelivery,
} from "@marshaldesk/db";
import {
  BILLING_EVENT_TYPES,
  billingChangeTarget,
  verifyKindeWebhook,
} from "@/lib/kinde/webhooks";

/**
 * Kinde webhooks for billing (PRD B-4). A billing event marks the workspace's
 * cached billing state stale on every server, so the next entitlement check
 * reads Kinde again. Deliveries are deduplicated by `webhook-id`, which stays
 * the same across Kinde's retries.
 */
export async function POST(request: Request): Promise<Response> {
  const event = await verifyKindeWebhook(await request.text());
  if (!event) {
    return Response.json({ error: "invalid_signature" }, { status: 401 });
  }
  const webhookId = request.headers.get("webhook-id") ?? event.event_id;
  if (!webhookId) {
    return Response.json({ error: "missing_webhook_id" }, { status: 400 });
  }
  if (await hasKindeWebhookDelivery(webhookId)) {
    return Response.json({ duplicate: true });
  }
  if (BILLING_EVENT_TYPES.has(event.type)) {
    const target = billingChangeTarget(event.data);
    const marked = await markBillingChanged(target);
    console.info(
      JSON.stringify({
        event: "kinde_webhook.billing",
        type: event.type,
        webhookId,
        target: target.kind,
        workspaces: marked,
      }),
    );
  }
  // Recorded only once handled: a failure above returns 500 and Kinde retries.
  await recordKindeWebhookDelivery(webhookId, event.type);
  return Response.json({ received: true });
}
