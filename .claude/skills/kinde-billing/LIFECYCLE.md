# Lifecycle

Trials, tax timing, plan changes, limits, and go-live. Read only the selected lifecycle/troubleshooting or go-live branch.

Plan, cancel, refund, and other lifecycle mutations are `planned` without authorization or `applied + observed evidence` with authorization.

## Trials

Enable per paid plan. Defaults: length 30 days (min 1); ask for card this many days before end (default 3, min 0, must be less than length). **Ask for credit card** must be on.

Runtime: customer receives the plan's features immediately; Stripe subscription is in trial; no charge until expiry. Pricing table and portal show a "Free trial for N day(s)" badge. A background prompt collects the card the configured number of days before end. At expiry Stripe converts to paid if a valid payment method exists.

Access tokens may include `has_trial_period` and `trial_expires_on` during the trial. Use them for UX (badges, upgrade prompts). Do not treat them as the entitlement catalog.

## Tax timing

1. No billing country yet (often a trial before a card) → Stripe may tax against the connected account's registered address.
2. After a payment method supplies a country → Stripe Tax uses that country, given registrations exist.

Account toggle and per-plan override decide whether tax is collected at all. Calculations and invoice presentation stay in Stripe.

## Upgrade, downgrade, proration

Official change paths:

- Self-serve portal (org member needs `org:write:billing`)
- Dashboard: organization or user → Billing → Change plan
- `POST /api/v1/billing/agreements` with `customer_id` + `plan_code`, optional `is_prorate` (credit unused paid time) and `is_invoice_now` (invoice uninvoiced metered usage)

POST cancels existing agreements and opens the new one. Align the flags with environment policies. `user:plan_selection` can deny the change before it commits (for example downgrade below current usage).

Invoice timing (billing model): fixed charges in advance on the charge interval, from the original signup date; metered usage in arrears on the next invoice. Custom billing anniversaries are not supported.

## Cancellation

Official customer path: portal → plan → Cancel plan (plan management enabled; B2B needs billing permission). Policies decide unused-day credits and final metered charges.

Admin path: dashboard Billing on the customer.

API DELETE of an agreement is **not** in the official Management OpenAPI. Do not call it. If the product must end access without a replacement plan, use portal or dashboard until a documented Management operation exists.

`user:plan_cancellation_request` can deny self-serve or API-initiated cancel requests before they apply.

Refunds are Stripe operations. Treat live refunds as high-impact.

## Limits (current product)

Record here so operational steps do not drift:

- Intervals: day, week, month, year only. No quarter. No custom anniversary.
- One currency per environment after first publish.
- No per-subscription coupons, discounts, or add-ons.
- No plan versioning. A subscribed plan is not editable.
- Pricing table: one group, max 4 plans, not versioned.
- Multiple fixed charges per plan; at most one Offer as annual.
- Entitlement limits are configured plan limits, not current usage.
- Payment processor: Stripe only. Kinde does not store cards.
- Portal theming: not generally available; billing auth screens can use custom HTML/CSS/JS.
- Role catalog is business-wide; environments isolate billing data and Stripe.
- Management MCP: no billing tools.

Time-sensitive platform fees and plan gates: [REFERENCES.md](REFERENCES.md). Do not paste them into runbooks.

## Go-live checklist

Single source for step 7.

```markdown
# Go-live

- [ ] Billing contract reviewed; every in-scope field valued or `undecided` + question
- [ ] Tenant contract still matches isolation and `org_code` rules
- [ ] Type `both`: organization and user catalogs each have group, table, default plan, matrix
- [ ] Test matrix every row marked with evidence
- [ ] Test Stripe remains the only connected account until production is authorized
- [ ] Currency chosen knowing first publish locks it
- [ ] Org vs user groups still unmixed
- [ ] Billing role/system permissions handled by `kinde-authorization`; creator/member assignment handled by `kinde-organizations`; both observed or blocked
- [ ] Live tenant: plan-change and payment-method change tested separately for billing permissions
- [ ] Live pricing table keys match auth parameters
- [ ] Entitlement mapping on the server; metered keys name a trusted usage source
- [ ] Single-entitlement Account path integration-tested or unused (list is fallback)
- [ ] Meter writes authorized; agreement resolution tested; delta path uses durable op state / reconciliation (design advice)
- [ ] Webhooks verify JWT, key on webhook-id, return 200
- [ ] Plan-selection and cancellation workflows tested if used
- [ ] Tax registrations complete in Stripe if collecting tax
- [ ] Failure policy for payment_failed documented in-app
- [ ] User authorized each high-impact production row: Stripe live connect, first publish, price change, cancel/refund, meter writes
```
