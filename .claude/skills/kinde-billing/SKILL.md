---
name: kinde-billing
description: >-
  Kinde Billing: models organization or user plan groups, features, and prices;
  connects test Stripe and publishes pricing; integrates plan selection, portal,
  and entitlements; records metered usage or handles billing webhooks and
  workflows; and troubleshoots subscriptions, trials, or tax. Use for Kinde
  billing work or when another skill must invoke the billing owner.
---

# Kinde Billing

Produces a **billing contract**: customer type, environment, Stripe mode, currency, billing admin, plan group and table, features and charges, trials and tax, portal, entitlements, usage reporting, webhooks, lifecycle policies, and control planes. Consume the `kinde-b2b` **tenant contract**; do not invent a second tenancy model.

## Stance

Treat the run as design-only until the user authorizes a mutation. Default to a non-production Kinde environment and Stripe test mode. Dated sources and first-party conflicts live in [REFERENCES.md](REFERENCES.md). Read it before relying on a product claim that is not already recorded in a sibling file, and whenever two official pages disagree.

Actively invoke the loaded framework adapter for framework work. If none is available, mark implementation blocked. Keep this contract API-neutral.

## Vocabulary

Use these names; do not collapse them.

| Term | Means |
| --- | --- |
| Plan group | Organization-type or user-type catalog. Never mixed. |
| Plan | Published or draft package of charges and features. |
| Feature | Unmetered gate or metered unit. Shared key, per-plan price/limit. |
| Pricing table | Customer-facing comparison. One group, max four plans. |
| Customer | Billing identity (`customer_…` / `billing_customer_id`). |
| Agreement | Subscription (`agreement_…`). |
| Entitlement | Configured plan access or unit **limit**, not current consumption. |

## High-impact

Without explicit authorization, record these as `planned`: production Stripe connection, first plan publish (locks currency), live price change, cancellation or refund, and meter write. Apply only an explicitly authorized item and capture observed evidence. Work other setup in test.

## Verified Management surface

Scopes and bodies are in [RUNTIME.md](RUNTIME.md) and [EVENTS.md](EVENTS.md). Recheck [REFERENCES.md](REFERENCES.md) and the published OpenAPI before acting:

- `GET /api/v1/billing/entitlements?customer_id=` (`read:billing_entitlements`)
- `GET /api/v1/billing/agreements?customer_id=` (`read:billing_agreements`)
- `POST /api/v1/billing/agreements` (`create:billing_agreements`; `customer_id`, `plan_code`, optional `is_prorate`, `is_invoice_now`). Cancels existing agreements.
- `POST /api/v1/billing/meter_usage` (`create:meter_usage`; `customer_agreement_id`, `billing_feature_code`, `meter_value`, optional `absolute`/`delta`)
- `POST /api/v1/organization` (`create:organizations`; optional billing fields; omitted `billing_plan_code` selects the default org plan)
- `POST /api/v1/users/{user_id}/billing_customer` (`create:user_billing_customers`; requires `org_code`; omitted `billing_plan_code` selects the default user plan)

DELETE agreement is documented on a how-to page and absent from the OpenAPI. Record the conflict; do not call it. Details: [REFERENCES.md](REFERENCES.md).

## Guardrails

- **One customer type per group.** Organization and user catalogs never share a group, table, matrix, or subscriber. Type `both` requires both catalogs filled. Details: [PLANS.md](PLANS.md).
- **User-billing mapping.** Persist `(org_code, user_id) -> customer_id` from `createUserBillingCustomer` and validate it before agreement or meter writes. `GET /api/v1/user?id=...&expand=billing` is not organization-qualified and cannot prove a multi-org association. Missing mapping blocks the write until Kinde exposes an organization-qualified read. Details: [RUNTIME.md](RUNTIME.md).
- **High-impact mutations.** Production Stripe connection, first plan publish, currency lock, live price changes, cancellations or refunds, and meter writes require an explicit user yes and a reviewed contract. Details: [SETUP.md](SETUP.md).
- **Control planes.** Dashboard owns catalog and Stripe. Auth URL / SDK parameters own plan selection. Account API is for personal-plan/current-user self-serve visibility and portal links. Organization-plan server gates use Management API billing entitlements by trusted `customer_id`. Management API also owns agreements and meter writes where OpenAPI exposes them. Stripe owns payment, invoice, and tax. Management MCP has no billing tools. Details: [RUNTIME.md](RUNTIME.md).
- **Entitlements.** Access tokens may carry trial claims only. Unmetered: gate on entitlement presence. Metered: compare a trusted current-usage source to the configured limit. The entitlement payload is not consumption. Details: [RUNTIME.md](RUNTIME.md).
- **Authorization handoff.** This skill defines required role/system permissions. Invoke `kinde-authorization` for catalog/system-permission writes and `kinde-organizations` for creator/member assignment. An unavailable owner blocks that mutation.

## Read map

- [CONTRACT.md](CONTRACT.md): billing-contract template. Read in step 2.
- [PLANS.md](PLANS.md): plan groups, plans, features, charges, pricing tables, plan matrix. Read in step 3.
- [SETUP.md](SETUP.md): billing admin, Stripe, currency, tax, policies, test isolation. Read in step 4.
- [RUNTIME.md](RUNTIME.md): auth parameters, portal, entitlements, planes, entitlement mapping. Read in step 5.
- [EVENTS.md](EVENTS.md): meter writes, webhooks, workflows, meter and webhook templates. Read in step 6.
- [LIFECYCLE.md](LIFECYCLE.md): trials, tax timing, proration, cancel, limits, go-live checklist. Read in steps 6–7.
- [REFERENCES.md](REFERENCES.md): dated sources and conflicts. Read when a claim might have drifted.

## Workflow

Always complete step 1, then run only the branch selected there and step 8. A step is unfinished until its gate is observable.

### 1. Invoke tenancy and select one job

Actively invoke `kinde-b2b` and consume its tenant contract. If it cannot be invoked, stop with `blocked: tenant-contract owner unavailable`; do not reconstruct its contract. Copy isolation model, environments, partition, onboarding, and permission keys.

```
- Tenant contract: [present | missing]
- Isolation model:
- Environments:
- Customer in product: [person | company | both]
- Billing customer type: [organization | user | both]
- Job: [model | setup | runtime | events | lifecycle/troubleshoot | go-live]
```

Branch map:

- `model` → steps 2–3
- `setup` → steps 2 and 4
- `runtime` → steps 2 and 5
- `events` → steps 2 and 6 (event portion)
- `lifecycle/troubleshoot` → steps 2 and 6 (only relevant lifecycle/runtime/event references)
- `go-live` → steps 2 and 7

**Gate:** tenant contract is present, exactly one job is named, and every unselected branch is `not applicable: excluded by job`.

### 2. Consume or write the in-scope billing contract

Use [CONTRACT.md](CONTRACT.md). For `model` and `go-live`, fill the complete in-scope contract. Other jobs fill or inspect only the sections their branch needs. Select organization-type versus user-type plan groups explicitly. When billing customer type is `both`, organization and user branches remain separate.

**Gate:** every in-scope field has a concrete value or `undecided` plus the blocking question. Mutually exclusive customer branches are `not applicable: excluded by contract`. A `both` model/go-live job has two complete catalogs.

### 3. Model plans, features, and prices: model

Using [PLANS.md](PLANS.md), fill a plan matrix per required catalog. Type `both` produces two matrices. Name feature keys the product will gate on. A plan may have several fixed charges; at most one uses Offer as annual. Keep drafts unpublished until a separately selected setup job authorizes publishing.

**Gate:** every plan has a group type, key, charges, features, card/trial/tax settings, and a pricing-table placement. No org row shares a group or table with a user row. Type `both` has both matrices.

### 4. Configure the test environment: setup

Using [SETUP.md](SETUP.md), plan or perform only the requested setup. Invoke `kinde-authorization` for billing-role/system-permission writes and `kinde-organizations` for creator/member assignment. Role definitions are business-wide; this environment isolates billing data and Stripe, not the role catalog.

For catalog, Stripe, publish, or assignment mutations, record `planned` without authorization or `applied + observed evidence` with authorization. **Gate:** every requested setup item has one of those outcomes; unrequested setup is untouched.

### 5. Integrate runtime surfaces: runtime

Using [RUNTIME.md](RUNTIME.md), name the plane for plan selection, entitlement checks, and portal links. Fill the entitlement mapping, including the trusted current-usage source for every metered key. Account API is personal-plan/current-user self-serve visibility; organization-plan server gates use Management billing entitlements by trusted `customer_id`. For user billing, validate the persisted `(org_code, user_id) -> customer_id` mapping before agreement or meter writes. Invoke the loaded framework adapter for framework work; absent adapter blocks implementation.

**Gate:** every in-scope feature key maps to a Kinde feature key, correct check plane, and (if metered) usage source. Every in-scope user-billing write has a validated mapping. Handoffs stay API-neutral.

### 6. Handle events or lifecycle/troubleshooting

For `events`, use [EVENTS.md](EVENTS.md). For `lifecycle/troubleshoot`, open only the relevant parts of [LIFECYCLE.md](LIFECYCLE.md), [RUNTIME.md](RUNTIME.md), and [EVENTS.md](EVENTS.md). Do not force setup or go-live.

Meter and cancellation mutations are `planned` without authorization or `applied + observed evidence` with authorization. **Gate:** every selected event/lifecycle item has an outcome; unselected setup and go-live work is untouched.

### 7. Authorize production rollout: go-live

Using [LIFECYCLE.md](LIFECYCLE.md): Go-live, re-read the reviewed contract and inspect prerequisites. Every production mutation is `planned` without authorization or `applied + observed evidence` with authorization.

**Gate:** every checklist row has evidence or a blocker. Unauthorized high-impact rows remain planned and untouched.

### 8. Verify the selected branch

Walk only matrix rows relevant to the selected job and customer type.

**Gate:** every row is `pass`, `fail`, `blocked`, or `not applicable: excluded by job/contract`, with evidence for every in-scope row.

## Test matrix

| Case | Observable target |
| --- | --- |
| Org vs user separation | An organization plan cannot be assigned to a user customer; a user plan cannot be assigned to an organization. Type `both` has two groups, two tables, two matrices. |
| User-billing tenant bind | Creation includes `org_code`; its response is persisted as `(org_code, user_id) -> customer_id`. The mapping is validated before agreement/meter writes. Unqualified user `expand=billing` does not prove a multi-org association; missing mapping blocks resolution. |
| Billing-admin denial | A member without `org:write:billing` cannot change the org **plan**. A separate live check covers **payment-method** change. `org:read:billing` is not assumed view-only. |
| Free / paid / card | Free with card-ask off skips payment. Any charge or trial-enabled plan collects a card when the docs require it. |
| Trial conversion | During trial, entitlements match the paid plan. After `trial_expires_on`, Stripe conversion and payment-prompt timing match the contract. |
| Entitlement allow / deny | Unmetered: presence allows, absence denies. Metered: configured limit compared to a trusted usage source allows or denies. Entitlement GET is not treated as current consumption. JWT permission keys are not entitlements. |
| Absolute / delta usage | `absolute` replaces the period total; `delta` adds. Feature code and agreement id match the subscriber. Delta retries use durable op state / reconciliation, not a pre-call key as exactly-once. |
| Duplicate webhook | A retried delivery with the same `webhook-id` is applied once. |
| Upgrade / downgrade / proration | POST agreement change with documented `is_prorate` / `is_invoice_now` matches environment policies. |
| Cancellation / final usage | Portal or dashboard cancel follows policies for unused days and uninvoiced usage. No unverified DELETE is called. |
| Tax address timing | Before a billing country exists, tax may use the Stripe account address; after a card, it uses the customer country. |
| Stripe failure | `customer.payment_failed` is handled; access policy in the contract is applied. |
| Test / live isolation | Test Stripe and non-prod Kinde customers never share live prices or live charges. |
| No-MCP billing path | Catalog, agreements, entitlements, and meters are done via dashboard or Management API. MCP is unused for billing. |

## Handoff

Do not link files outside this folder. Invoke `kinde-b2b` for tenancy, `kinde-authorization` for role/system-permission writes, `kinde-organizations` for creator/member assignment, `kinde-mcp` when MCP boundaries are questioned, and the loaded framework adapter for framework files. An unavailable owner is a blocked handoff.
