# References

Dated first-party notes for this skill. Operational rules live in the other sibling files; this file records where those rules were verified and where official pages disagree. Re-read the linked pages before treating a claim as current.

Last verified against Kinde docs and Kinde-owned OpenAPI: 19 August 2026.

## Primary sources

- [About Kinde billing](https://docs.kinde.com/billing/about-billing/about-billing/)
- [Billing concepts and terms](https://docs.kinde.com/billing/about-billing/billing-concepts-terms/)
- [The Kinde billing model](https://docs.kinde.com/billing/about-billing/kinde-billing-model/)
- [Setup overview](https://docs.kinde.com/billing/get-started/setup-overview/)
- [Add billing role (B2B)](https://docs.kinde.com/billing/get-started/add-billing-role/)
- [Connect to Stripe and set policies](https://docs.kinde.com/billing/get-started/connect-to-stripe/)
- [Default billing currency](https://docs.kinde.com/billing/get-started/default-billing-currency/)
- [Publish plans](https://docs.kinde.com/billing/get-started/publish-plans/)
- [About plans](https://docs.kinde.com/billing/manage-plans/about-plans/)
- [Create billing plans](https://docs.kinde.com/billing/manage-plans/create-plans/)
- [Add and manage plan groups](https://docs.kinde.com/billing/manage-plans/add-manage-plan-groups/)
- [Cancel a subscription](https://docs.kinde.com/billing/manage-plans/cancel-plans/)
- [Pricing models](https://docs.kinde.com/billing/pricing/pricing-models/)
- [Build a pricing table](https://docs.kinde.com/billing/billing-user-experience/plan-selection/)
- [Pricing table display defaults](https://docs.kinde.com/billing/billing-user-experience/pricing-table-display/)
- [Update code and URLs for billing](https://docs.kinde.com/billing/billing-user-experience/add-billing-to-url-sdk/)
- [Customize the plan sign-up experience](https://docs.kinde.com/billing/billing-user-experience/customize-billing-pages/)
- [Upgrade and downgrade methods](https://docs.kinde.com/billing/manage-subscribers/upgrade-downgrade-methods/)
- [Add metered usage](https://docs.kinde.com/billing/manage-subscribers/add-metered-usage/)
- [Billing webhooks](https://docs.kinde.com/billing/manage-subscribers/manage-customer-activity-webhooks/)
- [Manage Stripe connection](https://docs.kinde.com/billing/payment-management/manage-stripe-connection/)
- [About webhooks](https://docs.kinde.com/integrate/webhooks/about-webhooks/)
- [Add and manage webhooks](https://docs.kinde.com/integrate/webhooks/add-manage-webhooks/)
- [Account API](https://docs.kinde.com/developer-tools/account-api/about-account-api/)
- [Access tokens](https://docs.kinde.com/build/tokens/about-access-tokens/)
- [Self-serve portal for organizations](https://docs.kinde.com/build/self-service-portal/self-serve-portal-for-orgs/)
- [Self-serve portal for users](https://docs.kinde.com/build/self-service-portal/self-serve-portal-for-users/)
- [Plan selection workflow](https://docs.kinde.com/workflows/example-workflows/plan-selection-workflow/)
- [Plan cancellation request workflow](https://docs.kinde.com/workflows/example-workflows/plan-cancellation-request-workflow/)
- [MCP operations and scopes](https://docs.kinde.com/mcp-servers/operations-and-scopes/)
- [Search users via the Kinde API](https://docs.kinde.com/developer-tools/kinde-api/search-users-via-api/)
- [Kinde Management API spec](https://api-spec.kinde.com/kinde-management-api-spec.yaml)
- [Kinde Account API (docs UI)](https://docs.kinde.com/kinde-apis/frontend/)
- [Kinde-owned Account API YAML](https://github.com/kinde-oss/kinde-php-sdk/blob/master/kinde-frontend-api.yaml)
- [Kinde updates](https://updates.kinde.com/)

Stale FAQ pages (do not override product docs): [Billing FAQ](https://docs.kinde.com/billing/about-billing/billing-faq/), [Top questions](https://docs.kinde.com/billing/about-billing/kinde-billing-faqs/).

## Conflicts: steer to observed evidence

### Billing intervals

- [Billing FAQ](https://docs.kinde.com/billing/about-billing/billing-faq/): "only monthly billing cycles are supported."
- [About billing](https://docs.kinde.com/billing/about-billing/about-billing/), [create plans](https://docs.kinde.com/billing/manage-plans/create-plans/), [billing model](https://docs.kinde.com/billing/about-billing/kinde-billing-model/), and [flexible billing announcement](https://updates.kinde.com/announcements/passkeys-flexible-billing-and-more): day, week, month, year, plus optional annual on a non-year charge.

**Steer:** product docs and changelog. Treat the FAQ monthly-only line as sediment.

### Published plan edits / versioning

- FAQ: published plans allow limited modifications; major changes "may require" versions.
- [About plans](https://docs.kinde.com/billing/manage-plans/about-plans/): once a plan has a subscriber it cannot be changed, only versioned; **versioning is not currently available**.

**Steer:** do not edit a subscribed plan. Add a new plan and migrate the agreement.

### DELETE billing agreements

- [Cancel a subscription](https://docs.kinde.com/billing/manage-plans/cancel-plans/) tells callers to `DELETE` `/api/v1/billing/agreements` with `agreement_id`.
- [Management API spec](https://api-spec.kinde.com/kinde-management-api-spec.yaml) (19 Aug 2026) and kinde-oss Management YAML copies expose `GET` and `POST` only on `/api/v1/billing/agreements`. POST creates a new agreement and cancels existing ones. No DELETE path.

**Steer:** unresolved destructive call. Use portal, dashboard, or POST replacement. Do not emit DELETE.

### Portal links via Management API

- [Top questions](https://docs.kinde.com/billing/about-billing/kinde-billing-faqs/) says server-side portal links use the Management API with an M2M token.
- Management OpenAPI has no portal path. Account API `GET /account_api/v1/portal_link` (user token) is specified.

**Steer:** Account API + user token. Do not invent a Management portal URL.

### Account API single-entitlement path

- Workflow tutorial calls `GET {issuer}/account_api/v1/entitlement/{featureKey}`.
- Kinde-owned Account YAML declares `/account_api/v1/entitlement` with `key` as a path parameter (malformed path item). List path `/account_api/v1/entitlements` is consistent.

**Steer:** treat the single-feature path as **source-conflicted**. Integration-test it in this environment before depending on it. Use `GET /account_api/v1/entitlements` as the fallback.

### Search users `expand=billing`

- [Search users](https://docs.kinde.com/developer-tools/kinde-api/search-users-via-api/) shows a `billing.customer_id` example on search results.
- [Management API spec](https://api-spec.kinde.com/kinde-management-api-spec.yaml) search expand enum is `organizations`, `identities`, `properties` only. `GET /api/v1/user` expand includes `billing`.

`GET /api/v1/user?id={user_id}&expand=billing` is not organization-qualified. For a user in several organizations, it cannot prove which `(org_code, user_id)` association owns the returned customer.

**Steer:** persist `(org_code, user_id) -> customer_id` from the `createUserBillingCustomer` response and validate that mapping before agreement or meter writes. A missing mapping is blocked until Kinde exposes an organization-qualified read. The unqualified GET may aid diagnosis but cannot backfill or prove the association. Do not teach `search/users?expand=billing`.

### Account API entitlement scope

The Account API returns entitlements for the signed-in user/self-serve context and prefers a personal plan. The Management API exposes billing entitlements by `customer_id`.

**Steer:** use Account API for personal-plan/current-user self-serve visibility. Organization-plan server feature gates use Management API billing entitlements by a trusted organization customer id.

### `org:read:billing` picker text

Management spec example: key `org:read:billing`, name **Read billing details**, description **View plan and update card details**. That description is not view-only.

**Steer:** do not label it view-only. Live-test plan change and payment-method change separately.

### Entitlement payload vs consumption

Account and Management entitlement schemas expose `entitlement_limit_max` / `entitlement_limit_min` as units the customer is entitled to. They do not document a current-usage field.

**Steer:** unmetered gates use presence. Metered enforcement compares a trusted usage source to the configured limit.

### Connecting an existing Stripe account

- [Manage Stripe connection](https://docs.kinde.com/billing/payment-management/manage-stripe-connection/): a new Stripe account is created; you cannot connect an existing one.
- [Connect to Stripe](https://docs.kinde.com/billing/get-started/connect-to-stripe/): production onboarding may reuse *details* from an email that already has Stripe; "no other data will come across."

**Steer:** Kinde provisions a new Stripe account. Business details may be copied; customers and products are not migrated.

### MCP subscriber create

[MCP operations](https://docs.kinde.com/mcp-servers/operations-and-scopes/) lists a subscriber create under Configuration. That is an email subscriber, not a billing customer. No billing operations appear in the table; invoke `kinde-mcp` for the exact tool.

## Capability snapshot (19 August 2026)

| Topic | Decision | Evidence |
| --- | --- | --- |
| Intervals | day / week / month / year; optional annual on one non-year fixed charge | About billing, create plans, updates |
| Quarterly / custom anniversary | Unsupported | About billing known limitations |
| Coupons / discounts / add-ons | Unsupported on individual subscriptions | About billing, about plans |
| Currencies | Almost all; one default; locked after first publish | Currency page, concepts |
| Plan versioning | Not available | About plans |
| Payment provider | Stripe only | Billing model |
| JWT entitlements | Trial claims only (`has_trial_period`, `trial_expires_on`) | Concepts, access tokens |
| Meter types | `absolute` (override), `delta` (add) | Management OpenAPI |
| Meter idempotency | Not documented. Delta pre-call keys are not exactly-once (design advice) | OpenAPI + meter docs |
| Entitlement limits | Configured plan limits, not consumption | Management + Account schemas |
| User billing create | Per user **and** org; persist `(org_code, user_id) -> customer_id`; omit `billing_plan_code` → default plan + agreement | `create:user_billing_customers` |
| Org billing create | `create:organizations`; omit `billing_plan_code` → default org plan + agreement | create organization |
| Search expand billing | Not in official search expand enum | Management spec |
| Role catalog | Business-wide; not environment-isolated | kinde-b2b / roles docs |
| Webhook idempotency | `webhook-id` header | About webhooks |
| Management billing APIs | entitlements GET; agreements GET/POST; meter_usage POST | Management spec |
| Portal theming | Not generally available | User portal page |
| MCP billing | None | MCP operations |

## Time-sensitive commercial notes

Do not hardcode these into operational steps. Confirm on [kinde.com/billing](https://kinde.com/billing/) and the live Kinde plan.

- Marketing (retrieved 19 Aug 2026) states a 0.5% transaction fee on the Scale plan, in addition to Stripe fees, and mentions free MAU when using billing. Treat as commercial snapshot, not a setup input.
- Billing itself may be plan-gated on the Kinde business. Absence in the dashboard is evidence.

## Community-reported meter limitation

Kinde community threads (not product docs) report `METER_NOT_FOUND` when a metered feature has no chargeable unit or a $0 price, because Stripe then creates no meter. Kinde staff said Kinde still stores usage. Confirm against current docs/support before designing free-tier meters around Stripe.

## Deliberately out of scope here

Generic B2B theory, JWT verification catalog, Management MCP setup, raw Stripe Billing implementation, framework SDK components, and Kinde platform pricing runbooks. Invoke the owning installed skill for those domains; unavailable owners block their implementation.
