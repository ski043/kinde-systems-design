# Authorization

Authoritative authorization invariants for the tenant contract. Actively invoke `kinde-authorization` for catalog, assignment, and enforcement work, and the loaded framework adapter for SDK syntax. An unavailable owner is a blocked implementation handoff.

## Catalog versus assignment

Roles group permissions. Definitions (name, key, description, included permissions) live at the **business** level. Assignment to a user happens at the **organization** level. The same user can be admin in org A and member in org B.

Roles and permissions are **not** isolated per environment. A key created while working in development is the same key in production. To experiment on a catalog without touching production, use a separate Kinde business.

Permissions are included on the user access token as the `permissions` array for the **active** organization only. Roles appear on the access token only when the additional `roles` claim is enabled for the application.

Code against **permission keys** (for example `invite:users`). Role names are a management grouping, not the API check.

UI permission checks are presentation. Every privileged action is decided again on the server after JWT verification.

## JWT checks

Verify tokens on the API that serves tenant data. Use a JWT library. Kinde signs with RS256 (RSA 2048 + SHA-256). HMAC signing is not supported.

Required checks for user access tokens:

| Check | Target |
| --- | --- |
| Signature | JWKS for this environment. Canonical docs path: `https://<subdomain>.kinde.com/.well-known/jwks`. Prefer the issuer's `jwks_uri` from OpenID discovery when a library needs an exact URL. See [REFERENCES.md](REFERENCES.md). |
| Algorithm | RS256 |
| Issuer (`iss`) | This environment's issuer (unique per environment) |
| Audience (`aud`) | Exact audience of this protected product API (array; require the expected value) |
| Expiry (`exp`) | Reject expired tokens |
| Permissions | Required permission key present in `permissions` |
| Tenant | Contract source resolves the resource's tenant: retained `org_code` by default, or the explicitly named trusted server resolver |

Register **every** protected product API in Kinde, configure the calling application to request that audience, and reject tokens whose `aud` does not contain the exact value. A valid signature from the right environment is insufficient. Store tokens on the server side of the app.

Access-token lifetime is configurable per application; keep it short. A refresh may return the same access token until it expires, the user logs out, or the token is revoked. Organization suspension invalidates refresh and access tokens scoped to that organization and ends those sessions. The default organization cannot be suspended.

Permissions, feature flags, and `org_code` can be stripped through a user token generation workflow. Default to retaining `org_code`. If permissions are stripped, the API loads authorization from a trusted server control plane. If `org_code` is intentionally stripped, use only the trusted tenant/membership source and no-membership discriminator explicitly named in the tenant contract; without them, implementation is blocked. Client input supplies neither grants nor tenant proof.

## Claim freshness

Issued JWTs are immutable.

- Direct user, membership, assigned-role, assigned-permission, property, or user-level flag writes invalidate Kinde's claim cache. The **next newly issued** token can carry the change; the current token does not change.
- Inherited changes, including a permission added to an assigned role and organization/environment flag changes, require the Management API `refreshUserClaims` operation (`POST /api/v1/users/{user_id}/refresh_claims`, `update:user_refresh_claims`) for every affected user, followed by the application/SDK obtaining a new token.
- Immediate-sensitive decisions use a trusted real-time lookup, revocation, or short token lifetime rather than treating refresh as mutation of an existing JWT.

## Enforcement shape

For each tenant route:

1. Verify the credential (user JWT, org-scoped M2M JWT, or organization API key verification). See [MACHINE-ACCESS.md](MACHINE-ACCESS.md) for non-user credentials.
2. For JWTs, require this protected API's exact registered `aud`.
3. Bind the request to the tenant source named in the contract.
4. Require the permission key for a user, granted `scope` for M2M (not requested `scp`), or verification-response `scopes` for an organization API key.
5. Load data only under the contract's partition key.

Frontend permission helpers may read the same claims for UX. They do not replace steps 1–5.
