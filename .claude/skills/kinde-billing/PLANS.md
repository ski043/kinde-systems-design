# Plans

Catalog rules and the plan-matrix template. Read in step 3.

## Objects

| Object | Meaning |
| --- | --- |
| Plan group | Set of related plans. Type is **organization** or **user**. Never both. |
| Plan | Packaged charges + features + settings. Has a code key. |
| Fixed charge | Recurring amount invoiced in advance. Interval: day, week, month, or year. |
| Unmetered feature | Boolean entitlement. No price badge. Used to gate access. |
| Metered feature | Unit entitlement. Optional max. Pricing: none, per-unit, or tiered-graduated. |
| Pricing table | Customer-facing comparison. One group only. Max 4 plans. |
| Customer | Billing identity (`customer_…`). Distinct from `user_id` / `org_code`. |
| Agreement | Subscription (`agreement_…`). Created in Stripe; stored on the customer. |
| Entitlement | Feature access/limit granted by the current agreement. |

B2B uses organization groups. B2C uses user groups. When billing customer type is `both`, produce **two** catalogs: an organization group + table + matrix, and a user group + table + matrix. Auth parameters and subscribers stay on one catalog. Never merge them.

There is one default organization group and one default user group. Group order in admin is not table order.

## Group and plan rules

- Creating the first plan auto-creates a group from the selected type. Type cannot be changed later.
- Plan **key** cannot change after publish.
- Features and charges are defined once (shared key) and priced per plan.
- Free plans: set a fixed charge to `0.00` so the plan still syncs to Stripe and appears on a table.
- **Ask for credit card** can be off only on plans with no charges. Any fixed or metered charge requires a card. Trial-enabled plans require the toggle on; the card is collected before trial end, not as a substitute for that setting.
- Published plans must sit on a pricing table for self-serve signup.
- Once a plan has a subscriber, it cannot be edited. Plan versioning is not available. Change price by adding a new plan and migrating agreements.

## Intervals

Fixed charges support **day, week, month, year**. Quarterly and custom anniversaries are not supported.

A plan may include **multiple** fixed charges. **Offer as annual** adds a custom yearly price on a non-year interval and may be enabled on **at most one** fixed charge per plan. If a charge's interval is already year, the toggle does not apply.

Plans that mix intervals still display a monthly average on some surfaces; a single non-month fixed charge displays its real interval price.

## Pricing tables

Path: Billing > Pricing tables. Generate from a group or build blank. Only same-group plans. Max four.

- Display copy (name, CTA, feature list, highlight) is marketing; it need not match entitlement keys.
- Prices are inherited from the plan and cannot be edited on the table.
- Tables are not versioned; overrides are not recoverable.
- **Make live** so `pricing_table_key` works. **Show by default** covers register when no key is passed.
- Hide the table on register (Settings > Environment > Billing) when the product hosts its own selector and only the portal should show Kinde's table.

### When a table is shown

| Customer | Shown when |
| --- | --- |
| User group | New user registers, or a billing user signs in with no plan |
| Org group | `is_create_org` signup, or a member with `org:write:billing` signs in and the org is a billing customer with no plan |

## Plan matrix

One matrix per required catalog. Type `both` fills **both** copies.

```markdown
# Plan matrix: organization

| Plan key | Name | Fixed charges (interval, amount, annual?) | Unmetered keys | Metered keys (unit, configured max, model) | Card ask | Trial (days / prompt days) | Tax | Table key / highlight |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |

# Plan matrix: user

| Plan key | Name | Fixed charges (interval, amount, annual?) | Unmetered keys | Metered keys (unit, configured max, model) | Card ask | Trial (days / prompt days) | Tax | Table key / highlight |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |  |
```

Metered **max** here is the plan-configured unit limit (`entitlement_limit_max`), not live consumption.

**Unsupported in the matrix:** coupons, discounts, per-subscription add-ons, quarterly intervals, custom billing anniversaries, editing a subscribed plan, a second currency.
