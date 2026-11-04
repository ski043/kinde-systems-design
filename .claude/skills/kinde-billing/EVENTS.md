# Events

Meter writes, webhooks, and workflows. Read for the events or relevant lifecycle/troubleshooting branch.

## Meter writes

High-impact. Without explicit authorization, record the write as `planned`. With authorization, record `applied + observed evidence`.

`POST /api/v1/billing/meter_usage`  
Scope: `create:meter_usage`  
M2M only.

| Field | Required | Semantics |
| --- | --- | --- |
| `customer_agreement_id` | yes | `agreement_…` from organization-qualified billing expansion, GET agreements by a validated customer id, or the dashboard Billing page. Not `customer_id`. |
| `billing_feature_code` | yes | Feature **key** on the plan (dashboard: edit feature → Key). |
| `meter_value` | yes | Usage to record. Official spec types this as string. |
| `meter_usage_timestamp` | no | Date-time for the usage. Defaults to now. |
| `meter_type_code` | no | `absolute` replaces the current total. `delta` adds. |

No idempotency key is documented for this POST. **Design advice (not a Kinde guarantee):** a pre-call “already sent” key cannot make `delta` exactly-once.

For user billing, resolve the agreement only after validating the persisted `(org_code, user_id) -> customer_id` mapping. The unqualified user `expand=billing` GET cannot prove that association; a missing mapping blocks the meter write.

- **Before POST succeeds:** a crash after you mark the event done but before Kinde accepts it drops usage.
- **After POST succeeds, before you persist success:** a retry sends a second `delta` and double-counts.

Prefer a durable operation record or outbox (`pending` → POST → `succeeded` / `failed`), and reconcile. Where the product can compute a period total, serialized **absolute** writes (one writer per agreement+feature+period) avoid additive retries. Confirm totals against Kinde after incidents. Do not treat a unique event id stored *only* before the POST as exactly-once.

Community reports (not product docs) describe `METER_NOT_FOUND` when Stripe has no meter, typically a non-chargeable metered feature or a $0 charge. See [REFERENCES.md](REFERENCES.md). Prefer a chargeable metered feature on a paid plan when usage must reach Stripe.

## Meter contract

```markdown
# Meter contract

| Feature key | Unit | Source event | Type (absolute/delta) | Agreement resolution | Op state / outbox | Reconciliation | When to write |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |
```

## Webhooks

Environment-level only. Not per-organization. HTTPS endpoint. Body is a JWT (`Content-Type: application/jwt`). Verify RS256 against this environment's JWKS (`https://<subdomain>.kinde.com/.well-known/jwks` or discovery `jwks_uri`). Decode only after verify.

Billing event names (dashboard + webhook docs):

- `customer.agreement_created`
- `customer.agreement_cancelled`
- `customer.plan_assigned`
- `customer.plan_changed`
- `customer.plan_created`
- `customer.meter_usage_updated`
- `customer.payment_succeeded`
- `customer.payment_failed`
- `customer.invoice_overdue`

Return `200` when the event is accepted. Non-200 retries with backoff: immediate, 5s, 30s, 2m, 10m, 1h, 4h, then every 12h until 36h. Endpoints that fail for 72 hours are auto-disabled (email notice).

**Idempotency (documented):** header `webhook-id` is stable across attempts for the same webhook + event. Persist it and skip duplicates. Payload also has `event_id` (`event_…`) for `GET /api/v1/events/{event_id}` and a `timestamp` for replay checks.

Multiple endpoints for one event are not ordered.

## Webhook handling

```markdown
# Webhook handling

- URL:
- Events:
- Verify: JWT RS256 + environment JWKS
- Dedup: webhook-id
- On agreement_created / plan_assigned / plan_changed: refresh entitlements, provision
- On agreement_cancelled: deprovision per contract
- On meter_usage_updated: refresh usage UX / approaching-limit notices
- On payment_failed: apply failure policy
- On payment_succeeded: clear dunning / unlock
- On invoice_overdue: apply contract (often non-automatic payment)
```

## Workflows

These run **before** the change commits. They are not deprovisioning.

| Trigger | Fires when | Binding |
| --- | --- | --- |
| `user:plan_selection` | Portal or Management API plan change. Not first-time auto-assign. | `kinde.plan` `denySelection` |
| `user:plan_cancellation_request` | Portal or Management API cancel request. | `kinde.plan` `denyCancellation` |

Event context includes `currentPlanCode` / `requestedPlanCode` (selection) and `agreementId` (cancellation). Use them to block downgrades over limit or enterprise self-serve cancel.
