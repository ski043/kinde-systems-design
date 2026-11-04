# Machine access

Authoritative credential classes for the tenant contract. Invoke the owning installed skill for setup: `kinde-authorization` for scopes, `kinde-mcp` for connection auth, `kinde-organizations` for portal issuance, and the loaded framework adapter for token-request code. An unavailable owner is a blocked handoff.

## Classes

Pick each class for a named job. Do not use one credential as if it were another.

| Class | Who it represents | Tenant binding | Use |
| --- | --- | --- | --- |
| User access token | A signed-in person | `org_code` on the JWT when they have an active organization; omitted when they do not | Browser/app calls to tenant APIs |
| Global (unscoped) M2M | Your backend / admin automation | None. No `org_code` | Management API, cross-tenant admin, CI. **Not a tenant credential.** |
| Org-scoped M2M | Automation acting as one organization | Trusted `org_code` claim, set at issuance, not caller-controlled | Per-tenant agents, scoped APIs |
| Organization API key | A key owned by one organization | Trusted `org_code` on the verification response | Customer integrations, self-serve keys |
| User API key | A key owned by one user | `user_id` set; `org_code` is null | Personal automation and MCP-connection client auth when the live Quick start documents it. Tenant routes require the contract's server-side resolver |

M2M uses OAuth 2.0 client credentials. There is no refresh token; request a new access token with the client id and secret. Credentials are environment-specific.

## Tenant routes

On any org-specific resource:

- User JWT: require the tenant contract's source: retained verified `org_code` by default, or its explicit trusted server resolver. See [AUTHORIZATION.md](AUTHORIZATION.md) and [TENANCY.md](TENANCY.md).
- Org-scoped M2M: verify the JWT, require the protected API's exact `aud`, require `org_code`, match it to the resource, and authorize from granted `scope` rather than requested `scp`.
- Organization API key: verify the key, require `org_code` and the needed `scopes` in the verification response, and match the tenant to the resource.
- Global M2M: allow only system-level / admin routes. Reject tenant routes unless the contract explicitly names a break-glass admin path with extra checks (and still do not treat the credential as a tenant).
- User API key: authorize as that user (`user_id`), not as an organization. A tenant operation also requires the tenant contract's named server-side tenant/membership resolver and no-membership behavior; without them, exposure is blocked.

## Org-scoped versus global M2M

| | Global M2M | Org-scoped M2M |
| --- | --- | --- |
| Org in token | No | Yes (`org_code`) |
| Isolation | Manual in your code | Enforced at token issuance |
| Typical job | Admin scripts, seeding, Management API | Per-tenant agents and APIs |

Create org-scoped apps on the organization (dashboard: organization → M2M apps). Limit scopes. Audit `client_id` and `org_code` together.

## API keys versus M2M

Organization API keys are verified (not the same client-credentials JWT as M2M). After verification, trust `org_code` and `scopes` from the response. Users can mint keys from the organization self-serve portal when that function is enabled.

## MCP connections

Client authentication comes from that connection's live Quick start: the documented user API key branch or an offered OAuth browser flow. Organization API keys are not documented MCP-connection client credentials.

A user API key never supplies `org_code`; tenant operations therefore require the contract's trusted server-side tenant/membership resolver and authorization rule. OAuth follows the tenant context established by the product API. Do not invent OAuth tenant claims.

Actively invoke `kinde-mcp` for connection setup or operation. Invoke `kinde-organizations` for portal enablement and `kinde-authorization` for API-key scope design. An unavailable owner is a blocked handoff.
