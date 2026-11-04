# References

Dated first-party notes for this skill. Operational rules live in the other sibling files; this file records where those rules were verified and where official pages disagree. Re-read the linked pages before treating a claim as current.

Last verified against Kinde docs and the Kinde-owned Management API spec: 19 August 2026.

## Primary sources

- [About organizations / multi-tenancy](https://docs.kinde.com/build/organizations/multi-tenancy-using-organizations/)
- [Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/)
- [Add and manage organizations](https://docs.kinde.com/build/organizations/add-and-manage-organizations/)
- [Import organizations](https://docs.kinde.com/build/organizations/import-organizations/)
- [Delete an organization](https://docs.kinde.com/build/organizations/delete-organization/)
- [Allow organization creation on sign up](https://docs.kinde.com/build/organizations/allow-org-create-on-signup/)
- [Manage user sign up to organizations](https://docs.kinde.com/build/organizations/allow-user-signup-org/)
- [Set global access policies](https://docs.kinde.com/build/set-up-options/access-policies/)
- [Set access policies for an organization](https://docs.kinde.com/build/organizations/organization-access-policies/)
- [Disable self-sign up](https://docs.kinde.com/authenticate/custom-configurations/disable-sign-up/)
- [Invited user sign-up experience](https://docs.kinde.com/authenticate/custom-configurations/invited-user-experience/)
- [Send user invitations with webhooks](https://docs.kinde.com/manage-users/add-and-edit/send-invitations-webhook/)
- [Manage users across organizations](https://docs.kinde.com/manage-users/about/manage-users-across-organizations/)
- [Navigate between organizations](https://docs.kinde.com/authenticate/manage-authentication/navigate-between-organizations/)
- [Self-serve portal for organizations](https://docs.kinde.com/build/self-service-portal/self-serve-portal-for-orgs/)
- [Apply unique branding for an organization](https://docs.kinde.com/design/brand/apply-branding-for-an-organization/)
- [Organization properties](https://docs.kinde.com/properties/about-properties/organization-properties/)
- [Add and manage custom data with properties](https://docs.kinde.com/properties/work-with-properties/manage-properties/)
- [Keep your product in sync with Kinde](https://docs.kinde.com/authenticate/manage-authentication/sync-with-kinde/)
- [Access tokens](https://docs.kinde.com/build/tokens/about-access-tokens/)
- [Set default user roles](https://docs.kinde.com/manage-users/roles-and-permissions/default-user-roles/)
- [User roles](https://docs.kinde.com/manage-users/roles-and-permissions/user-roles/)
- [Apply roles and permissions to users](https://docs.kinde.com/manage-users/roles-and-permissions/apply-roles-and-permissions-to-users/)
- [Add billing role (B2B): Assign to the creator](https://docs.kinde.com/billing/get-started/add-billing-role/)
- [Kinde pricing](https://kinde.com/pricing/)
- [Enterprise connections for B2B](https://docs.kinde.com/authenticate/enterprise-connections/enterprise-connections-b2b/)
- [Home realm discovery](https://docs.kinde.com/authenticate/enterprise-connections/home-realm-discovery/)
- [Using Kinde without an SDK](https://docs.kinde.com/developer-tools/about/using-kinde-without-an-sdk/)
- [Account API](https://docs.kinde.com/developer-tools/account-api/about-account-api/)
- [Management API access](https://docs.kinde.com/developer-tools/kinde-api/connect-to-kinde-api/)
- [Management API spec (kinde-oss)](https://github.com/kinde-oss/management-api-js/blob/main/spec/kinde-mgmt-api-specs.yaml)
- [MCP operations and scopes](https://docs.kinde.com/mcp-servers/operations-and-scopes/)
- [Manage Kinde environments](https://docs.kinde.com/build/environments/environments/)

Feature-release notes (not a substitute for docs): [Kinde updates](https://updates.kinde.com/). Organization suspension announced 26 February 2026.

## Conflicts: steer to observed evidence

### Organization policy labels

Pages disagree on the organization-level self-join control's name:

- [Disable self-sign up](https://docs.kinde.com/authenticate/custom-configurations/disable-sign-up/) and the procedure on [organization access policies](https://docs.kinde.com/build/organizations/organization-access-policies/): **Allow org members to be auto-added**.
- [Manage user sign up to organizations](https://docs.kinde.com/build/organizations/allow-user-signup-org/) and [invited user experience](https://docs.kinde.com/authenticate/custom-configurations/invited-user-experience/): **Allow registrations**.
- The quick-reference table on organization access policies says **Allow self sign-up** (the environment-level phrase).
- Management API: `is_auto_membership_enabled` (deprecated alias `is_allow_registrations`).

**Steer:** confirm the live dashboard label on the organization's Policies page. Treat the *behavior* (unknown users join this org when `org_code` is present) as the contract field. Prefer the API field name when writing Management API calls.

### Domain-list field wording and JIT conjunction

The Management API `allowed_domains` description says "self-sign up to this environment" and its examples include `https://` URLs. Organization policy docs require `domain.com` (not a URL) on the **organization**.

[Organization access policies](https://docs.kinde.com/build/organizations/organization-access-policies/) procedure requires **Allow org members to be auto-added** before **Auto-add users from allowed domains** plus the allowed-domains list. The quick-reference table omits the first control and says **Allow self sign-up**.

**Steer:** enter bare domains. JIT is conjunctive: auto-membership + auto-join domain list + matching domain. Confirm saved values in the dashboard or a subsequent GET.

### Membership remove vs token revocation

[Sync with Kinde](https://docs.kinde.com/authenticate/manage-authentication/sync-with-kinde/): direct organization membership updates invalidate the token *cache*; the next issued access token gets fresh claims. Inherited role/flag changes use the backend Management API `refreshUserClaims` operation, followed by a new token. Invoke `kinde-authorization` for its exact path and scope.

[Access tokens](https://docs.kinde.com/build/tokens/about-access-tokens/): a refresh grant may return the **same** access token until it expires, the user logs out, or the token is revoked.

[Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/) / [Add and manage organizations](https://docs.kinde.com/build/organizations/add-and-manage-organizations/): **suspension** revokes org-scoped access and refresh tokens and ends sessions.

**Steer:** a removed member's previously issued JWT remains valid until expiry or explicit revocation. Claim-cache invalidation makes a later token fresh; it does not revoke the older JWT. Do not treat remove as suspend. For sensitive routes, use a real-time membership check while older tokens remain valid, and keep access-token lifetimes short.

### Default organization delete

Suspend of the default org is documented (`DEFAULT_ORGANIZATION_CANNOT_BE_SUSPENDED`). [Delete an organization](https://docs.kinde.com/build/organizations/delete-organization/) and the Management API `deleteOrganization` operation do not document a default-org exception or error code. Every business still has exactly one default org whose `org_code` cannot change.

**Source gap:** there is no first-party basis to claim Kinde refuses default-org deletion. The suite's conservative safety policy blocks that deletion and avoids a destructive probe. Do not invent `DEFAULT_ORGANIZATION_CANNOT_BE_DELETED`.

### Role identifiers

Direct organization-user-role / permission endpoints take `role_id` / `permission_id` (body or path). Bulk `AddOrganizationUsers` / `UpdateOrganizationUsers` take role/permission **keys**. [User roles](https://docs.kinde.com/manage-users/roles-and-permissions/user-roles/) says get role IDs from the Roles endpoint before Add Organization User Role.

**Steer:** match the operation. Do not send keys to the direct role endpoint or ids to the bulk membership `roles` array.

### Creator-default has no API setter

Dashboard **Assign to the creator** (portal and billing docs) applies on the self-serve `is_create_org` path. `CreateRole.is_default_role` is only “default for new users.” The spec has no creator-assignment field.

**Steer:** after Management API org create, `POST …/users/{user_id}/roles` with `role_id`.

### B2B and organization self-creation

- [Access policies](https://docs.kinde.com/build/set-up-options/access-policies/): allowing organization creation on sign-up is the foundation of self-serve B2B.
- [Manage user sign up to organizations](https://docs.kinde.com/build/organizations/allow-user-signup-org/): disabling org creation on sign-up is "usually only needed" by B2B.

**Steer:** B2B is two onboarding modes. Self-serve PLG turns org creation on; sales-led provisioning turns it off. The contract must pick one.

### Self-sign-up scope

[Manage user sign up](https://docs.kinde.com/build/organizations/allow-user-signup-org/) says disabling self-sign-up "applies to all apps in your business." [Disable self-sign up](https://docs.kinde.com/authenticate/custom-configurations/disable-sign-up/) and the Policies path (`Settings > Environment > Policies`) treat it as **environment** scope.

**Steer:** set and verify the control on the environment you are deploying. Do not assume production and non-production share it.

### Where suspension is managed

[Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/) describes suspension as Management API. [Add and manage organizations](https://docs.kinde.com/build/organizations/add-and-manage-organizations/) also documents dashboard Suspend / Unsuspend.

**Steer:** both work. Use the authorized plane. Default-org rejection is observable either as `DEFAULT_ORGANIZATION_CANNOT_BE_SUSPENDED` or a dashboard refusal.

### Invitation_code on the auth URL

JavaScript and Go SDK docs accept `invitation_code` (Go also documents `is_invitation=true`). The [without-an-SDK parameter table](https://docs.kinde.com/developer-tools/about/using-kinde-without-an-sdk/) does not list those parameters.

**Steer:** use the loaded adapter's invite helper. If calling authorize raw, confirm the live redirect accepts `invitation_code` rather than assuming the no-SDK table is complete.

### MCP create surface

The [operations FAQ](https://docs.kinde.com/mcp-servers/operations-and-scopes/) says MCP is limited to gets and creates. The same page's operations table lists creates only for selected catalog/config resources; organizations and users are get-only. MCP property create/read operations concern business catalog definitions (`context=org` is a definition), not organization value writes (`update:organization_properties`).

MCP organization-user relationship reads use `read:organization_users`. The Management API spec uses the more specific `read:organization_user_roles` / `read:organization_user_permissions`.

**Steer:** MCP capabilities from the operations table. Management API scopes from the spec. Do not treat the FAQ's "create new resources" as organization create.

### ID-token organization list

[Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/) describes `org_codes` on the ID token. [Navigate between organizations](https://docs.kinde.com/authenticate/manage-authentication/navigate-between-organizations/) describes an additional `organizations` `{id, name}` claim that must be enabled per application.

**Steer:** both can exist. `org_codes` is the membership id list; enable `organizations` when the product needs names in the switcher.

### Permissions helper sample

[Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/) repeats a `getUserOrganizations` snippet under "access_token permissions". That is a docs copy error. Permission checks belong on the permissions / protect-your-API pages and in `kinde-authorization`.

## Plan-gated behavior (verify live)

Docs often name **Kinde Scale**. [Pricing](https://kinde.com/pricing/) (19 August 2026) also includes **1 advanced organization** on Plus and **5** on Scale, with per-org domain allowlist, auto-join, and default roles listed under those entitlements, not Scale-only.

- Per-organization access-policy override: documented as Scale + Advanced organization; `is_enable_advanced_orgs` on update. Pricing: advanced orgs on Plus and Scale.
- Organization default roles / domain JIT: docs say Scale; pricing lists them with advanced organizations.
- Organization-owned enterprise connections for users in multiple orgs: documented against Scale.
- Organization self-serve portal functions and per-org portal config: docs say Scale; pricing “customer self-serve portal” is billing-oriented and listed more broadly. Confirm the org-members/SSO functions on the live portal settings page.
- Environment **Allow invitations**: shown "if member invitations are available on your plan."
- Management API invite roles outside `owner`/`admin`: spec requires `extended_roles` on Kinde-hosted plans.

Absence of a feature in the dashboard is evidence; do not assume the contract can rely on a gated control. Do not hard-code “Scale” as the only qualifying plan.

## Deliberately out of scope here

Framework SDK setup, role-catalog design, SAML/OIDC field-by-field IdP config, billing plans, Management API endpoint catalogs beyond organization lifecycle, and MCP client install. Invoke the loaded framework adapter, `kinde-authorization`, `kinde-billing`, or `kinde-mcp` as appropriate; unavailable owners block those slices.
