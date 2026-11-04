# Setup

Test-environment configuration for the setup job. Production rows stay untouched until a separately selected go-live job.

For every catalog, Stripe, publish, or policy mutation, record `planned` without authorization or `applied + observed evidence` with authorization.

## Billing admin (organization catalog)

Skip when there is no organization catalog.

Define the required billing role here (for example Billing Admin with `org:write:billing`). Invoke `kinde-authorization` for the role and system-permission write. Invoke `kinde-organizations` for **Assign to the creator** or any creator/member assignment. If either owner is unavailable, that mutation is blocked.

`org:write:billing` is the documented permission for org members who change billing in the self-serve portal. `org:read:billing` is a separate system permission. Official Management spec example text is **Read billing details** / **View plan and update card details**. That mixes read and card-update language. Do not label it view-only. In the live tenant, test **plan change** and **payment-method change** as two rows (with and without each permission). Record what the dashboard actually allows.

Role **definitions** (name, key, included permissions) are business-wide and shared across environments. Assignments are per organization in an environment. A development environment isolates billing customers, agreements, and the Stripe test account; it does not isolate the role catalog. Experiment on role keys in a **separate Kinde business** if production must not see them. This matches the `kinde-b2b` catalog rule.

## Stripe

Kinde billing uses Stripe only. Kinde provisions a **new** Stripe account for the environment. Existing Stripe customers, products, and prices do not import. In production, Stripe may offer to reuse *business details* from an email that already has a Stripe login; that is not connecting an existing Stripe account.

Work in a non-production Kinde environment first. That environment uses a Stripe test account, test cards, and no Kinde or Stripe billing fees.

Path: Settings > Environment > Billing → Connect Stripe account → Update Stripe information until status is `Connected`.

| Status | Meaning |
| --- | --- |
| Connecting | Sync in progress |
| In progress | Connected but onboarding incomplete; plans cannot go live |
| Connected | Safe to publish plans |

Disconnect is irreversible. Confirm before disconnecting a catalog that has subscribers.

## Currency

Set default currency under Settings > Environment > Billing **before** the first plan publish. Nearly all currencies are supported; one default applies to every plan and group. The value cannot be changed after the first plan in the environment is published.

## Tax

Account toggle **Collect tax automatically** is off by default. When on, new subscriptions enable Stripe Tax unless a plan overrides it (`Use account setting` / `Collect` / `Don't collect`).

Stripe Tax registrations and inclusive vs exclusive prices are configured in the Stripe Dashboard, not in Kinde. Until the customer has a billing country (typical on a card-less trial), tax may use the Stripe account's registered address.

## Policies

After Stripe is connected, set environment policies for:

- unused paid subscription days on cancel or change (refund vs retain)
- uninvoiced metered usage on cancel or change (charge vs forgive)

These are the proration / final-invoice defaults the runtime `is_prorate` and `is_invoice_now` flags should match. Exact dashboard labels: confirm live.

## Publish in test

Draft freely. Publish syncs features and charges to Stripe as products. Publish only after the matrix in [PLANS.md](PLANS.md) is reviewed. Type `both` publishes from both catalogs.

High-impact (without explicit yes and a reviewed contract, keep `planned`):

- production Stripe connection
- first plan publish (locks currency)
- live price changes
- cancellations or refunds
- meter writes

## Isolation

Keep test and live **billing data** and Stripe connections in separate Kinde environments. Do not point a production application at test price keys or a test Stripe account. Do not treat environment isolation as role-catalog isolation.
