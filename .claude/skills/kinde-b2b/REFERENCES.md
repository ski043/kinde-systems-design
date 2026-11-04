# References

Dated first-party notes for this skill. Operational rules live in the other sibling files; this file records where those rules were verified and where official pages disagree. Re-read the linked pages before treating a claim as current.

Last verified against Kinde docs: 19 August 2026.

## Primary sources

- [Kinde for different business models](https://docs.kinde.com/build/set-up-options/kinde-business-model/)
- [About organizations / multi-tenancy](https://docs.kinde.com/build/organizations/multi-tenancy-using-organizations/)
- [Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/)
- [Add and manage organizations](https://docs.kinde.com/build/organizations/add-and-manage-organizations/)
- [Manage Kinde environments](https://docs.kinde.com/build/environments/environments/)
- [Manage users across organizations](https://docs.kinde.com/manage-users/about/manage-users-across-organizations/)
- [Manage user sign up to organizations](https://docs.kinde.com/build/organizations/allow-user-signup-org/)
- [Set global access policies](https://docs.kinde.com/build/set-up-options/access-policies/)
- [Set access policies for an organization](https://docs.kinde.com/build/organizations/organization-access-policies/)
- [Disable self-sign up](https://docs.kinde.com/authenticate/custom-configurations/disable-sign-up/)
- [Invited user sign-up experience](https://docs.kinde.com/authenticate/custom-configurations/invited-user-experience/)
- [Self-serve portal for organizations](https://docs.kinde.com/build/self-service-portal/self-serve-portal-for-orgs/)
- [User roles](https://docs.kinde.com/manage-users/roles-and-permissions/user-roles/)
- [User permissions](https://docs.kinde.com/manage-users/roles-and-permissions/user-permissions/)
- [Access tokens](https://docs.kinde.com/build/tokens/about-access-tokens/)
- [Verifying JSON Web Tokens](https://docs.kinde.com/build/tokens/verifying-json-web-tokens/)
- [Protect your API](https://docs.kinde.com/developer-tools/your-apis/protect-your-api/)
- [Permissions in React and any backend](https://docs.kinde.com/developer-tools/guides/kinde-permissions-react-and-backend/)
- [Navigate between organizations](https://docs.kinde.com/authenticate/manage-authentication/navigate-between-organizations/)
- [Enterprise connections for B2B](https://docs.kinde.com/authenticate/enterprise-connections/enterprise-connections-b2b/)
- [Home realm discovery](https://docs.kinde.com/authenticate/enterprise-connections/home-realm-discovery/)
- [M2M overview](https://docs.kinde.com/machine-to-machine-applications/about-m2m/)
- [Org-scoped M2M](https://docs.kinde.com/machine-to-machine-applications/organization-scoped-m2m-apps/m2m-applications-for-organizations/)
- [Enforce org M2M in your API](https://docs.kinde.com/machine-to-machine-applications/organization-scoped-m2m-apps/enforce-org-m2m-access-in-your-api/)
- [Organization API keys](https://docs.kinde.com/manage-your-apis/about-api-keys/organization-api-keys/)
- [User-level API keys](https://docs.kinde.com/manage-your-apis/about-api-keys/user-api-keys/)
- [Account API](https://docs.kinde.com/developer-tools/account-api/about-account-api/)
- [Management API access](https://docs.kinde.com/developer-tools/kinde-api/connect-to-kinde-api/)
- [About MCP servers](https://docs.kinde.com/mcp-servers/)
- [MCP operations and scopes](https://docs.kinde.com/mcp-servers/operations-and-scopes/)

Feature-release notes (not a substitute for docs): [Kinde updates](https://updates.kinde.com/).

## Conflicts: steer to observed evidence

### Organization policy labels

Pages disagree on the organization-level self-join control's name:

- [Disable self-sign up](https://docs.kinde.com/authenticate/custom-configurations/disable-sign-up/) and the procedure on [organization access policies](https://docs.kinde.com/build/organizations/organization-access-policies/): **Allow org members to be auto-added**.
- [Manage user sign up to organizations](https://docs.kinde.com/build/organizations/allow-user-signup-org/) and [invited user experience](https://docs.kinde.com/authenticate/custom-configurations/invited-user-experience/): **Allow registrations**.
- The quick-reference table on organization access policies says **Allow self sign-up** (the environment-level phrase).

**Steer:** confirm the live dashboard label on the organization's Policies page. Treat the *behavior* (whether unknown users can join this org when `org_code` is present / domain JIT) as the contract field, not a guessed checkbox title.

### B2B and organization self-creation

- [Access policies](https://docs.kinde.com/build/set-up-options/access-policies/): allowing organization creation on sign-up is the foundation of self-serve B2B.
- [Manage user sign up to organizations](https://docs.kinde.com/build/organizations/allow-user-signup-org/): disabling org creation on sign-up is "usually only needed" by B2B.

**Steer:** B2B is two onboarding modes. Self-serve PLG turns org creation on; sales-led provisioning turns it off. The contract must pick one.

### JWKS URL

Core token docs use `https://<subdomain>.kinde.com/.well-known/jwks` (no `.json`). The Go SDK docs use `/.well-known/jwks.json`.

**Steer:** start from OpenID discovery `jwks_uri` for this environment. If a library requires a literal path, use the path it documents after confirming it serves keys.

### ID-token organization list

[Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/) describes `org_codes` on the ID token. [Navigate between organizations](https://docs.kinde.com/authenticate/manage-authentication/navigate-between-organizations/) describes an additional `organizations` `{id, name}` claim that must be enabled per application.

**Steer:** both can exist. `org_codes` is the membership id list; enable `organizations` when the product needs names in the switcher.

### Permissions helper sample

[Organizations for developers](https://docs.kinde.com/build/organizations/orgs-for-developers/) repeats a `getUserOrganizations` snippet under "access_token permissions". That is a docs copy error. The permissions claim and `getPermission` / backend JWT checks are described correctly on the permissions and protect-your-API pages.

### MCP-connection client auth

[Add a new MCP connection](https://docs.kinde.com/mcp-servers/add-mcp-connection/) documents a user API key in client Quick start. The 31 July 2026 [MCP connections announcement](https://updates.kinde.com/announcements/bring-your-own-apis-to-ai-agents) announces OAuth browser sign-in.

**Steer:** the connection's live Quick start decides which branch the client uses. Organization API keys are documented for organization-owned API access, not as MCP-connection client credentials. A user API key verifies with `user_id` and no `org_code`.

### Account versus Management billing entitlements

The Account API is scoped to the signed-in user and supports self-serve visibility. The Management API exposes billing entitlements by `customer_id`.

**Steer:** personal-plan/current-user visibility may use Account API. Organization-plan server gates use Management billing entitlements after resolving and validating the trusted billing customer id; do not generalize Account API into a cross-tenant server gate.

### Management MCP create surface

The [operations FAQ](https://docs.kinde.com/mcp-servers/operations-and-scopes/) says MCP is limited to gets and creates. The same page's operations table lists **create** only for roles, permissions, properties, feature flags, environment variables, and subscribers. Users and organizations are get-only (no create/update).

**Steer:** use the operations table, not the FAQ's generic "create new resources."

## Plan-gated behavior (confirm live plan)

- Per-organization access-policy override: documented against Kinde Scale / advanced organization.
- Organization-owned enterprise connections for users in multiple orgs: documented against Scale in the enterprise-identity guide.
- Organization self-serve portal functions (members, API keys, SSO) and MCP connections: plan or beta entitlements apply.

Absence of a feature in the dashboard is evidence; do not assume the contract can rely on a gated control.

## Deliberately out of scope here

Framework SDK setup, billing implementation, role-creation UI, SAML/OIDC field-by-field IdP config, Management API endpoint catalogs, and MCP client install stay with their owning installed skills. Invoke that owner; if unavailable, mark the implementation handoff blocked.
