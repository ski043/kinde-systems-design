# References

Dated first-party notes for this skill. Operational rules live in the other sibling files; this file records where those rules were verified and where official pages disagree. Re-read the linked pages before treating a claim as current.

Last verified against Kinde docs and published OpenAPI: 19 August 2026.

## Primary sources

- [User roles](https://docs.kinde.com/manage-users/roles-and-permissions/user-roles/)
- [User permissions](https://docs.kinde.com/manage-users/roles-and-permissions/user-permissions/)
- [Apply roles and permissions to users](https://docs.kinde.com/manage-users/roles-and-permissions/apply-roles-and-permissions-to-users/)
- [Set default user roles](https://docs.kinde.com/manage-users/roles-and-permissions/default-user-roles/)
- [About user management](https://docs.kinde.com/manage-users/about/)
- [Access tokens](https://docs.kinde.com/build/tokens/about-access-tokens/)
- [Token customization](https://docs.kinde.com/build/tokens/token-customization/)
- [Verifying JSON Web Tokens](https://docs.kinde.com/build/tokens/verifying-json-web-tokens/)
- [User token generation workflow](https://docs.kinde.com/workflows/example-workflows/user-token-generation/)
- [Protect your API](https://docs.kinde.com/developer-tools/your-apis/protect-your-api/)
- [Permissions in React and any backend](https://docs.kinde.com/developer-tools/guides/kinde-permissions-react-and-backend/)
- [Manage API scopes for users](https://docs.kinde.com/developer-tools/your-apis/user-api-scopes/)
- [Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/)
- [Organization access policies](https://docs.kinde.com/build/organizations/organization-access-policies/)
- [Self-serve portal for organizations](https://docs.kinde.com/build/self-service-portal/self-serve-portal-for-orgs/)
- [Self-serve API keys](https://docs.kinde.com/manage-your-apis/add-manage-api-keys/self-serve-api-keys/)
- [Add billing role (B2B)](https://docs.kinde.com/billing/get-started/add-billing-role/)
- [Account API](https://docs.kinde.com/developer-tools/account-api/about-account-api/)
- [Account API spec](https://api-spec.kinde.com/kinde-frontend-api-spec.yaml)
- [Management API spec](https://api-spec.kinde.com/kinde-management-api-spec.yaml)
- [Management API access](https://docs.kinde.com/developer-tools/kinde-api/connect-to-kinde-api/)
- [About scopes and Kinde API access](https://docs.kinde.com/developer-tools/kinde-api/about-m2m-scopes/)
- [MCP operations and scopes](https://docs.kinde.com/mcp-servers/operations-and-scopes/)
- [Manage Kinde account with AI agents](https://docs.kinde.com/mcp-servers/manage-kinde-account-with-ai-agents/)
- [About feature flags](https://docs.kinde.com/releases/about/about-feature-flags/)
- [Keep your product in sync with Kinde](https://docs.kinde.com/authenticate/manage-authentication/sync-with-kinde/)
- [Token structure and claims for M2M](https://docs.kinde.com/machine-to-machine-applications/about-m2m/token-structure-and-claims-for-m2m-applications/)
- [Register and manage APIs](https://docs.kinde.com/developer-tools/your-apis/register-manage-apis/)
- [Import users via CSV or JSON](https://docs.kinde.com/manage-users/add-and-edit/import-users-in-bulk/)
- [Bulk import users to Kinde](https://docs.kinde.com/get-started/switch-to-kinde/migrate-users-bulk-import/)
- [Manage organization-level auth features](https://docs.kinde.com/authenticate/custom-configurations/advanced-organization/)
- [Kinde pricing](https://kinde.com/pricing/)

Feature-release notes (not a substitute for docs): [Kinde updates](https://updates.kinde.com/).

## Conflicts: steer to observed evidence

### Roles claim shape

Official pages disagree on what `roles` contains when the additional claim is enabled:

- [User roles](https://docs.kinde.com/manage-users/roles-and-permissions/user-roles/): “an array of IDs” in the `roles` claim.
- The same page's SDK sample: `getClaim("roles")` → `{name: "roles", value: ["admin", "owner"]}` (keys).
- [User token generation workflow](https://docs.kinde.com/workflows/example-workflows/user-token-generation/): “Kinde supplies roles as an array of objects.”
- [Account API spec](https://api-spec.kinde.com/kinde-frontend-api-spec.yaml) `GET /account_api/v1/roles`: objects with `id`, `name`, `key`.

**Steer:** inspect the live access token for this application. Do not enforce on an assumed `roles` shape. Application decisions use permission keys.

### MCP “create” versus attach/assign

The [operations FAQ](https://docs.kinde.com/mcp-servers/operations-and-scopes/) says MCP is limited to gets and creates. The operations table allows role/permission **definition** creates, while role–permission and organization-user relationships are read-only.

[Manage Kinde account with AI agents](https://docs.kinde.com/mcp-servers/manage-kinde-account-with-ai-agents/) sample prompts include “create a role that can read and update posts.” The role-definition create body does not accept permission ids.

**Steer:** invoke `kinde-mcp` for its exact operations matrix. MCP can create role/permission definitions; attach and assign on dashboard or Management API.

### MCP versus Management API read scopes

- MCP organization-user relationship reads: `read:organization_users`.
- Management API: `read:organization_user_roles` and `read:organization_user_permissions`.

**Steer:** grant the scope of the plane you call. Do not treat the names as interchangeable.

### Freshness: cache invalidation versus same-token replay

- [Keep your product in sync](https://docs.kinde.com/authenticate/manage-authentication/sync-with-kinde/): tokens are cached; direct updates to profile, membership, roles, permissions, properties, and user-level flags invalidate the cache so the next issued access token can carry current claims. Inherited changes (permission added to a role; org/env flags) require `POST /api/v1/users/{user_id}/refresh_claims`.
- Roles and permissions pages: changes apply the next time the user signs in.
- [Access tokens](https://docs.kinde.com/build/tokens/about-access-tokens/): refresh may return the existing access token until expiry, logout, or revoke.

**Steer:** issued JWTs are immutable. After a *direct* write, a newly issued access token can carry current claims. After an *inherited* write, call `refreshUserClaims` then obtain a new token. Do not treat a still-valid JWT as updated. Immediate-sensitive checks use a trusted lookup, revoke, or a short lifetime.

### `refreshUserClaims` scope

[Management API spec](https://api-spec.kinde.com/kinde-management-api-spec.yaml) `refreshUserClaims` is `update:user_refresh_claims`. `update:users` is the `updateUser` operation, not this endpoint.

**Steer:** grant `update:user_refresh_claims` to the backend's Management API operation. The application/SDK obtains the subsequent new token; it does not call this operation as a token-refresh helper.

### `org:read:billing` semantics

The Management API `system_permissions` example names `org:read:billing` **Read billing details** but describes it as **View plan and update card details**.

**Steer:** do not classify it as view-only. Invoke `kinde-billing`, which tests plan-change and payment-method behavior separately.

### CSV import headers

- [Import users](https://docs.kinde.com/manage-users/add-and-edit/import-users-in-bulk/) field list: `role_key`, `permission_key`, `external_organization_id`.
- The same page's examples: `roles`, `permissions`.
- [Bulk import](https://docs.kinde.com/get-started/switch-to-kinde/migrate-users-bulk-import/) column table: `role_key`, `permission_key`.
- NDJSON schema on the import page: `organizations[].external_id`, `roles`, `permissions`.

**Steer:** use the NDJSON schema as written. For CSV, inspect the current downloadable template on the import screen; do not pick a remembered header set.

### Per-org default-role plan gate

- [Set default user roles](https://docs.kinde.com/manage-users/roles-and-permissions/default-user-roles/): Scale plan, plus advanced features activated on the organization.
- [Kinde pricing](https://kinde.com/pricing/) compare table: “Assign default roles per org” is included on Plus and Scale, not only Scale. Advanced organizations start on Plus (1 included).

**Steer:** check the live entitlement and whether advanced organizations are activated. Do not hard-code Scale.

### Include API scopes in `permissions`

[Manage API scopes for users](https://docs.kinde.com/developer-tools/your-apis/user-api-scopes/) can merge API scopes into the `permissions` claim. Permission docs describe `permissions` as user permission keys.

**Steer:** treat merge as an explicit application setting. Record it in the enforcement matrix. Prefer separate mechanisms.

## Plan-gated behavior (confirm live entitlement)

- Per-organization default roles: dedicated docs say Scale + advanced org; pricing includes the feature on Plus and Scale.
- Per-organization self-serve portal override: advanced-organization entitlement.
- API scopes and organization-owned M2M: pricing Plus and Scale. Organization API keys: pricing Pro and above.
- Organization portal functions (members, API keys, SSO) and MCP connections: plan or beta entitlements apply.

Absence of a feature in the dashboard is evidence.

## Verified non-claims (do not add later without a source)

- Management MCP does not attach permissions to roles or assign roles/permissions to users (no official tool as of this date).
- `CreateRole` has `is_default_role` and optional `assignment_permission_id`. It has no org-creator field.
- System permission keys not listed in [SYSTEM.md](SYSTEM.md) were not found on official pages or the Management API `system_permissions` example.
- No Management API list operation for a user's additional API scopes was present in the spec; dashboard lists them.
- M2M authorization uses granted `scope`, not requested `scp`. Organization API-key verification uses `scopes`.

## Deliberately out of scope here

Framework SDK setup, billing implementation, organization lifecycle, feature-flag management, Management API bootstrapping, and MCP client install stay with their owning installed skills. Invoke that owner; if unavailable, mark the implementation handoff blocked.
