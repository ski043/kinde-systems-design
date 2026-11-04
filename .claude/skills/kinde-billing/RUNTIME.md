# Runtime

Auth parameters, portal, entitlements, and planes. Read for the runtime branch. Invoke the loaded framework adapter for framework files; absent adapter blocks implementation.

## Plan selection

Auth URL (or the SDK's equivalent fields) accepts:

| Parameter | Role |
| --- | --- |
| `pricing_table_key` | Show that live table |
| `plan_interest` | Pre-select a plan key and skip comparison |
| `is_create_org` | Organization signup (B2B table + billing admin) |

Use the parameter names on the authorize URL. An adapter maps them onto its SDK helpers; do not paste framework components here.

Three official onboarding shapes:

1. Product-hosted selector, then redirect with `plan_interest`.
2. Kinde table in the auth flow (`pricing_table_key` or default table).
3. Management API assigns a published plan; next sign-in collects payment.

Billing screens (plan selection, payment, success) inherit environment design. Plan-selection and payment pages can be replaced with custom HTML/CSS/JS. Self-serve **portal** theming is not documented as generally available.

## Portal

One-time link. Generate per click.

**Verified plane:** Account API, user access token:

`GET /account_api/v1/portal_link?return_url=<url>&subnav=<section>`

Documented `subnav` values in the Kinde-owned Account API spec: `profile`, `organization_details`, `organization_payment_details`, `organization_plan_selection`, `payment_details`, `plan_details`, `plan_selection`. Confirm the live spec before using any other value.

Enable billing on Settings > Environment > Self-serve portal. Kinde documents `org:write:billing` for billing changes, but the published `org:read:billing` description also mentions updating card details. Treat plan changes and payment-method changes as separate permission tests in the live tenant; see [SETUP.md](SETUP.md).

A marketing FAQ mentions Management API portal links with M2M. The official Management OpenAPI exposes no portal endpoint. Do not call one.

## Entitlements

JWTs may include `has_trial_period` (boolean) and `trial_expires_on` (ISO-8601) while a trial is active. They do not carry the entitlement list. Load **billing** entitlements from the appropriate API; token-claim customization belongs to `kinde-authorization`.

| Who | Plane | Auth | Endpoint |
| --- | --- | --- | --- |
| Personal-plan/current-user self-serve visibility | Account API | User access token | `GET /account_api/v1/entitlements` (list; verified fallback) |
| One personal-plan feature for current-user visibility | Account API | User access token | `GET /account_api/v1/entitlement/{feature_key}`: **source-conflicted**; integration-test before depending on it |
| Organization-plan server gate | Management API | M2M `read:billing_entitlements` | `GET /api/v1/billing/entitlements?customer_id=` using the trusted organization billing customer id |
| Other trusted customer lookup | Management API | M2M `read:billing_entitlements` | `GET /api/v1/billing/entitlements?customer_id=` |

Management list is paginated (`page_size`, `starting_after`, `ending_before`). Optional `expand=plans`. Optional `max_value` substitutes when a configured limit is null.

`entitlement_limit_max` / `entitlement_limit_min` are **configured plan limits** (units the customer is entitled to). Official schemas do not return current consumption.

- **Unmetered:** allow when the entitlement is present; deny when it is absent.
- **Metered:** allow when a **trusted current-usage source** (your store, a reconciled meter, or an agreed query) is below the configured max. Deny when usage is at or above max, or the entitlement is absent. Entitlement GET does not prove exhaustion.

Account API is scoped to the token subject and is a self-serve visibility surface. It is not a cross-tenant admin API or the universal server feature gate for organization plans. Resolve the organization billing customer id from the trusted tenant mapping, then use Management billing entitlements for server enforcement.

## Agreements and customers

Resolve ids before meter writes or admin changes.

| Need | Verified call |
| --- | --- |
| Org customer + agreements | `GET /api/v1/organization?code={org_code}&expand=billing` → `billing.billing_customer_id`, `agreements[].agreement_id` / `plan_code` |
| Resolve user id | `GET /api/v1/search/users` (`read:users`). Official expand enum is `organizations`, `identities`, `properties`, not `billing`. |
| Create and bind user billing customer | `POST /api/v1/users/{user_id}/billing_customer` with `org_code`; persist response `customer_id` as `(org_code, user_id) -> customer_id` |
| Unqualified user billing read | `GET /api/v1/user?id={user_id}&expand=billing` is not organization-qualified. It may aid diagnosis but cannot prove which organization owns the returned customer for a multi-org user |
| Agreements by customer | `GET /api/v1/billing/agreements?customer_id=` (`read:billing_agreements`) |
| Change plan | `POST /api/v1/billing/agreements` (`create:billing_agreements`) body: `customer_id`, `plan_code`, optional `is_invoice_now`, `is_prorate`. Cancels existing agreements. |
| Create org as billing customer | `POST /api/v1/organization` (`create:organizations`) with `is_create_billing_customer`, `billing_email`. `billing_plan_code` optional: **omit means the default published organization plan** and creates an agreement. User plans and unpublished plans are rejected. |
| Start user billing customer | `POST /api/v1/users/{user_id}/billing_customer` (`create:user_billing_customers`) body: `org_code`, `billing_email`. `billing_plan_code` optional: **omit means the default published user plan** and creates an agreement. Persist the response `customer_id` and `agreement_id`. Organization plans and unpublished plans are rejected. At most one billing customer per user **in that organization**. |

Omitting `billing_plan_code` is an explicit default-plan selection, not “no plan.” Record the default plan key on the contract before calling create.

User billing is scoped to `(user, organization)`. Persist the create response as `(org_code, user_id) -> customer_id` in a trusted server store. Before any agreement or meter write, validate that the request's trusted `org_code` and `user_id` resolve to the same stored `customer_id`; then use that id to resolve agreements. `user_id` alone and the unqualified user `expand=billing` response are not tenant proof. If the mapping is absent, resolution is blocked until Kinde exposes an organization-qualified read; do not guess or backfill from the unqualified GET.

Dashboard: user or organization record → Billing.

Docs mention `DELETE /api/v1/billing/agreements`. Official Management OpenAPI (19 Aug 2026) exposes GET and POST only. Do not teach DELETE. Cancel through portal or dashboard, or replace via POST.

## Planes

| Task | Plane |
| --- | --- |
| Define plans, prices, tables, Stripe, tax toggle, policies | Dashboard |
| Pass `plan_interest` / `pricing_table_key` / `is_create_org` | Application / SDK |
| Personal-plan/current-user visibility; portal link | Account API (user token) |
| Organization-plan server gate by trusted customer id | Management API billing entitlements |
| Trusted customer agreement, entitlement, meter | Management API (M2M + listed scopes) |
| Card, invoice, tax calculation | Stripe |
| Billing catalog or meter via MCP | None. Use dashboard or Management API |

Management MCP's subscriber create is for email leads, not billing customers. Invoke `kinde-mcp` for the exact tool.

## Entitlement mapping

Single source for product gates.

```markdown
# Entitlement mapping

| Product capability | Customer type | Feature key | Kind | Allow when | Deny when | Check plane | Trusted customer-id source | Usage source (metered) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  | personal \| organization |  | unmetered \| metered | unmetered: present; metered: usage < configured max | unmetered: absent; metered: absent or usage ≥ max | Account visibility \| Management server gate |  |  |
```
