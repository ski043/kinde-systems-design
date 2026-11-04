# Billing contract

Authoritative template for this skill. Fill the sections required by the selected job in step 2 of `SKILL.md`. Every in-scope field needs a concrete value or `undecided` plus the blocking question; excluded branches are `not applicable: excluded by job/contract`.

When **billing customer type** is `both`, fill the organization catalog **and** the user catalog as separate blocks. Do not collapse them.

Copy and fill.

```markdown
# Billing contract

## Tenant binding
- Tenant contract source: [kinde-b2b contract name or path]
- Isolation model: [copied]
- Environments: [prod + non-prod list]
- Tenant partition: B2B contract's trusted `org_code` source (retained verified claim by default; always required for user billing)
- Billing identity: `billing_customer_id`
- App-level user-billing mapping (if user or both): persist create response `(org_code, user_id) -> customer_id`
- User-billing write validation: [trusted store lookup matches request org_code + user_id + customer_id | blocked: mapping absent]

## Customer
- Product customer: [person | company | both]
- Billing customer type: [organization | user | both]
- Workspace word: [copied from tenant contract]
- B2B2C: [none | both catalogs required below]

## Environment
- Working environment: [non-production name | production]
- Stripe mode: [test | live]
- Production mutations authorized: [no | yes: list]

## Stripe
- Connection status: [not started | connecting | in progress | connected]
- Account provenance: [Kinde-provisioned new account]
- Collect tax automatically (account): [off | on]
- Cancellation policy (unused paid days): [refund | retain | undecided]
- Plan-change policy (uninvoiced metered usage): [charge | forgive | undecided]

## Currency
- Default currency: [ISO code]
- Lock state: [unlocked, no plan published | locked after first publish]

## Billing admin (organization catalog)
- Role key:
- Includes `org:write:billing`: [yes]
- Assign to org creator: [yes | no]
- Who else may be assigned:
- `org:read:billing`: [included | unused]. Spec picker text is source-ambiguous ("View plan and update card details"). Live-test plan change and payment-method change separately. Not labeled view-only.
- Role catalog isolation: [business-wide shared keys | separate Kinde business for experiments]
- Mutation owners: [`kinde-authorization` for role/system-permission writes; `kinde-organizations` for creator/member assignment]

## Organization catalog (required when type is organization or both)
- Plan group name / default:
- Plans (keys):
- Default plan if `billing_plan_code` omitted: [plan key: omission assigns this and creates an agreement]
- Pricing table key:
- Table live: [no | yes]
- Show table on register: [yes | no]
- Auth parameters: [pricing_table_key and/or plan_interest; is_create_org]
- Plan matrix: [filled. PLANS.md organization matrix]

## User catalog (required when type is user or both)
- Plan group name / default:
- Plans (keys):
- Default plan if `billing_plan_code` omitted: [plan key: omission assigns this and creates an agreement]
- Pricing table key:
- Table live: [no | yes]
- Show table on register: [yes | no]
- Auth parameters: [pricing_table_key and/or plan_interest]
- Plan matrix: [filled. PLANS.md user matrix]

## Features and charges
- Fixed charges (key, interval, amount, offer-as-annual): [multiple allowed; at most one Offer as annual per plan]
- Unmetered features (key → product gate):
- Metered features (key, unit, configured max, pricing model):

## Trials and tax
- Trials: [off | plan keys, length days, card-prompt days]
- Plan tax override: [use account | collect | don't collect: per plan]

## Portal
- Enabled for: [organization | user | both | none]
- Return URL:
- Billing function enabled: [yes | no]
- Deep-link `subnav` values used:

## Entitlements
- Personal-plan/current-user visibility: [Account API | not applicable]
- Organization-plan server gate: [Management API by trusted customer_id | not applicable]
- Unmetered gate: [entitlement present]
- Metered gate: [configured `entitlement_limit_*` compared to trusted current-usage source: name the source]
- Single-entitlement Account path: [integration-tested | unused: list endpoint is fallback]
- Mapping file: [see RUNTIME.md]
- JWT trial claims used only for: [trial UX | unused]

## Usage reporting
- Meter writes: [none | Management API POST meter_usage]
- Agreement resolution: [org expand=billing | persisted (`org_code`, `user_id`) → `customer_id` then GET billing/agreements]
- Missing user mapping: [not applicable | blocked until organization-qualified read exists]
- Meter type default: [delta | absolute]
- Write reliability (design advice): [outbox / durable op state / serialized absolute / reconciliation]

## Webhooks and workflows
- Endpoint:
- Events subscribed:
- Signature: [JWT via environment JWKS]
- Dedup key: [`webhook-id` header]
- Workflows: [none | user:plan_selection | user:plan_cancellation_request]

## Lifecycle
- Upgrade / downgrade path: [portal | dashboard | POST billing/agreements]
- Cancel path: [portal | dashboard | blocked]
- Proration / invoice-now defaults:
- Failure policy when payment fails:

## Control planes
- Dashboard: [catalog, Stripe, policies, tables]
- Application / SDK: [auth params for plan selection]
- Account API: [personal-plan/current-user self-serve visibility, portal_link]
- Management API: [customers, agreements, entitlements, meters]
- Stripe: [payment, invoice, tax]
- Management MCP: [unused for billing]
```
