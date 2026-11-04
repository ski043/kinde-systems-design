# Policies, roles, and connections

Organization-level access rules and the touchpoints that follow them. Per-org override, org default roles, and org domain JIT are **advanced-organization / plan entitlements**. Recheck [REFERENCES.md](REFERENCES.md) and verify the live business; a missing dashboard control is evidence.

## Policy layers

**Environment (global) policies** are the default for every organization: self-sign-up, allowed domains, organization creation on sign-up, most-recent-org sign-in, invitations + invite application, profile sync.

**Per-organization override** requires the advanced-organization feature on that org (`is_enable_advanced_orgs` on update when the entitlement allows it). Official pages disagree on some *labels*; confirm the live dashboard control and, when using the API, the field name.

Behavior to configure, whatever the checkbox title:

| Behavior | Where | API field (when mutating via Management API) |
| --- | --- | --- |
| Unknown users may join this org when `org_code` is on the auth request | Org Policies | `is_auto_membership_enabled` (replaces deprecated `is_allow_registrations`) |
| Unknown sign-ups / API / import users with no org land in the default org | Default org Policies only | Dashboard: add users if no org specified |
| Restrict join to email domains | Org Policies + allowed-domains list | `allowed_domains`: enter `domain.com`, not a URL |
| Domain JIT (see below) | Org Policies | `is_auto_join_domain_list` **and** `allowed_domains` |
| Default roles for people who join this org | Org Policies → Default roles | Advanced-organization entitlement. Invoke `kinde-authorization` for keys |

## Domain JIT

Just-in-time join at **sign-up** requires all of these at once:

1. Auto-membership / registration on (`is_auto_membership_enabled`; dashboard: Allow org members to be auto-added / Allow registrations).
2. Auto-join from allowed domains on (`is_auto_join_domain_list`).
3. A matching **bare** domain in `allowed_domains` (`acme.com`, not a URL).

Omit any one and JIT does not fire. The domain check runs at sign-up. Contractors outside the list can still be added manually or via API.

## Default roles: three different controls

Do not collapse these. Invoke `kinde-authorization` for catalog design; if unavailable, block that handoff.

| Control | What it does | How it is set |
| --- | --- | --- |
| `CreateRole` / `UpdateRoles` `is_default_role` | Business-level “default for new users” when they sign up | Management API boolean, or dashboard **Assign to new users** |
| Dashboard **Assign to the creator** | Auto-assigns that role to the user who creates an org on the *self-serve auth* path | Role create/edit in the dashboard (portal/billing docs). **No Management API field** for this |
| Org Policies → Default roles | Roles assigned when users *join this organization* | Dashboard on an org with advanced-organization entitlement |

For an org created by Management API or dashboard (no self-serve creator), assign the first admin with `POST /api/v1/organizations/{org_code}/users/{user_id}/roles` and `role_id`. Do not claim an API setter for creator-default.

If the org default-roles control is missing, assign explicitly after join.

## Branding

Orgs inherit global styles until overridden. Passing `org_code` on login/register shows that org's logo and colors. Configure in dashboard **Brand**, or via Management API color fields and `POST /api/v1/organizations/{org_code}/logos/{type}`. Reset to default is a dashboard admin action.

## Enterprise connections

Prefer creating the enterprise connection **on the organization** so access is locked to that connection, including org switches. Enable a shared environment connection on an org only when one IdP is truly shared. Org-owned connections for users in multiple orgs are an advanced-organization / plan entitlement. Verify live.

Home-realm discovery routes by email domain. It is authentication routing, not authorization:

- Organization selector is skipped.
- Most-recent-org does not apply.
- Passing `org_code` does not override the destination; the user lands in the org linked to the matching connection.
- Home-realm domains must be unique across connections in the environment.
- Connections used only via HRD do not have to be enabled at the application level.

After routing, still enforce membership, permissions, and the B2B contract's tenant source. Domain match at the IdP is not a substitute. Invoke the owning installed identity/framework adapter for SAML/OIDC/Entra setup; if unavailable, mark implementation blocked.

## Self-serve portal

Environment **Self-serve portal** enables org members to manage the functions currently offered in the live dashboard, such as business details, billing, API keys, members/roles/invites, and enterprise SSO. Availability and per-org function sets are volatile plan/maturity facts; recheck [REFERENCES.md](REFERENCES.md) and verify live.

Access is a one-time link from the signed-in user's token. Official path: Account API `GET /account_api/v1/portal_link` (optional `return_url`, `subnav`). Invoke the loaded framework adapter for SDK `PortalLink` helpers; absent adapter blocks implementation.

Invoke `kinde-authorization` for portal permission roles and `kinde-billing` for billing setup; an unavailable owner blocks that slice. Assign roles on the organization. Invite gating is in [MEMBERSHIP.md](MEMBERSHIP.md).
