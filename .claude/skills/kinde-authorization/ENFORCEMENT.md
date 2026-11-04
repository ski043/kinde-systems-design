# Enforcement and tokens

Runtime rules for permission-key checks. Generic JWT verification (RS256, JWKS, `iss`, `exp`) and tenant binding stay in the `kinde-b2b` tenant contract. This skill adds the authorization-specific audience and claim rules.

Invoke the loaded framework adapter for helpers and route syntax. If no adapter is available, mark implementation blocked. This file states what to check, not how a stack spells it.

## Claims for the active organization

Permissions on a user access token are for the **active** organization only (`org_code` when present). A user with different grants in two orgs receives only the active org's keys.

`permissions` is an array of permission keys. Kinde includes it by default. It can be absent or emptied:

- User token generation workflow can strip `permissions`, `feature_flags`, and `org_code` before issue.
- A no-org session omits `org_code`; do not invent organization permissions.
- Treat a missing, null, or non-array `permissions` claim as **no grants**. Deny. Do not throw.

Retain `org_code` by default. If the B2B contract intentionally strips it, consume the **exact** trusted server-side tenant/membership resolver and no-membership discriminator named there. This skill defines no exception of its own. When that source is absent, missing `org_code` denies tenant actions and implementation is blocked. If the product strips `permissions`, load authorization from a trusted control plane on the server. Client input supplies neither keys nor tenant proof.

## Audience

Every protected product API is registered in Kinde, requested as the token audience, and verified for the **exact** `aud` value. A token minted for another API is denied even when permission keys match. Do not accept a token because it is signed by this environment.

Audience registration and the request parameter are configured in the application / adapter. This skill requires the check.

## Roles claim

Roles appear on the access token only when the application's additional `roles` claim is enabled (Settings → Applications → Tokens → customize access token → Roles). Official pages disagree on the claim's shape: array of ids, array of keys, or array of objects. Record the conflict in [REFERENCES.md](REFERENCES.md). Inspect the live token. Do not branch enforcement on an assumed shape.

Account API `GET /account_api/v1/roles` returns `{id, name, key}` objects for the signed-in user, scoped with `org_code`. Use that for display. Application decisions still target permission keys.

## Freshness

Issued JWTs are immutable. A still-valid access token does not change when Kinde data changes.

**Direct writes** to a user (profile, organization membership, assigned roles, assigned permissions, properties, user-level flags) invalidate Kinde's claim cache. The next access token issued after refresh can carry current claims.

**Inherited writes** do not invalidate that cache. Official examples: a permission added to a role the user already has; feature-flag changes at organization or environment level. For those, the backend calls the Management API `refreshUserClaims` operation (`POST /api/v1/users/{user_id}/refresh_claims`, `update:user_refresh_claims`) for each affected user, then the application/SDK obtains a new access token.

Immediate-sensitive checks (payments, destructive admin) do not wait for refresh: look up grants on a trusted server plane, revoke the session, or keep a short access-token lifetime.

Role and permission product pages still say changes apply the next time the user signs in. The access-token page still says a refresh can return the same access token until expiry, logout, or revoke. Record that conflict in [REFERENCES.md](REFERENCES.md). Steer with the cache / inherited split above, and treat an already-issued JWT as stale until a new one is issued.

Find affected users after a role-definition edit with `GetRoleUsers` / `GetOrganizationRoleUsers`. That is the blast radius in [CATALOG.md](CATALOG.md).

## Server check

For each privileged user request:

1. Verify the credential using the tenant contract (user JWT, org-scoped M2M, or organization API key).
2. Require this API's registered audience on a user or M2M JWT (`aud` contains the exact value).
3. Bind the resource to the B2B contract's tenant source. No `org_code` means no tenant action unless that contract explicitly names the trusted resolver and no-membership discriminator; otherwise deny and block implementation.
4. For a **user** JWT: require the permission key in a null-safe `permissions` array. Role names are not this step.
5. For **M2M**: require the granted space-delimited `scope` claim. Do not authorize from requested `scp`.
6. For an **organization API key**: require `scopes` on the verification response. That field is not the M2M `scope` claim.
7. Load data only under the B2B contract's partition key.

Frontend helpers may hide buttons. They do not replace these steps. A direct API request is the real check.

## Mechanism split

| Mechanism | Where it lives | Authorizes |
| --- | --- | --- |
| User permission key | `permissions` on a user access token, or Account API `GET /account_api/v1/permissions` | What a person may do in the active org |
| M2M granted scope | Space-delimited `scope` on the M2M JWT | What that client may do. `scp` is the requested list |
| Organization API-key scopes | Verification response `scopes` | What that key may do |
| Feature flag | `feature_flags` claim or Account API flags | Release and config. Invoke the owning installed feature-flag skill; unavailable owner blocks that slice |
| Billing entitlement | Account API for personal-plan/current-user self-serve visibility; Management API billing by trusted `customer_id` for organization-plan server gates | Plan features. Invoke `kinde-billing` |

An application setting can merge **user API scopes** into the `permissions` claim. That mixes two mechanisms. Prefer keeping product permission keys and API scopes separate unless the contract explicitly merges them and the server still checks the resulting keys after verification.

`has()`-style helpers that accept `permissions`, `roles`, `featureFlags`, and `billingEntitlements` together are UX conveniences. The server still checks one mechanism per decision.

## Troubleshooting stale or empty access

| Symptom | First check |
| --- | --- |
| User has a role in the dashboard but the API denies | Token `permissions` for the *active* org; claim stripped; stale JWT; assignment is on another org; wrong `aud` |
| `roles` missing | Additional claim not enabled on this application |
| `roles` present but unexpected type | Live token vs official shape conflict |
| Direct grant just changed, token unchanged | Existing JWT is immutable; wait for a new access token after cache invalidation |
| Role gained a permission, token unchanged | Inherited change: call `refreshUserClaims`, then refresh |
| Machine call denied after adding a user permission | M2M uses granted `scope`; API keys use verification `scopes` |
| `org_code` missing on a tenant user | Check the B2B contract's explicit resolver/discriminator. If absent, deny and block implementation |
| Permission exists in development, missing in production code but present in dashboard | Shared catalog: the key exists; the *assignment* is per environment org |
