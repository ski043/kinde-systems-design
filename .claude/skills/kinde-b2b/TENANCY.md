# Tenancy

Authoritative isolation rules and the tenant-contract template. Fill the template in step 3 of `SKILL.md`.

## Kinde mapping

| Kinde object | Maps to | Notes |
| --- | --- | --- |
| Business | One product or project | Separate products use separate businesses. Nested organizations cannot stand in for multiple products. |
| Environment | One SDLC slice (production, plus optional non-production) | Isolated config and a unique token issuer. Dashboard copy between environments is not supported; Management API seeding is. Production cannot be deleted. |
| Organization | One customer tenant / workspace | Flat. A user may belong to many organizations. |

Every business has one default organization. Its unique `org_code` cannot be changed. It cannot be suspended. Auto-assigning unknown sign-ups into it can be turned off. Typical for B2B so strangers do not land in a catch-all tenant.

Role and permission *definitions* are business-level (shared across environments). Organization records, users, applications, and token issuers are environment-scoped. See [AUTHORIZATION.md](AUTHORIZATION.md).

## Isolation models

Choose exactly one. The spoken label is not the model.

| Model | Use when | What to configure |
| --- | --- | --- |
| Default-organization (B2C-shaped) | One user pool; no customer workspaces | Keep the default organization; configure auth at business/environment level. |
| Organizations (B2B-shaped) | One product serving many companies or workspaces | One organization per customer tenant. Disable default-org auto-assign unless a true catch-all is intended. |
| Dedicated business | A customer gets an isolated product/project | Separate Kinde business (and usually a separate deploy). Not one environment per customer. |

Challenge misuse:

- Many companies sharing one app is **organizations**, even if the database is shared.
- Environments are for development/staging/production, not for customers.
- Organizations cannot nest (no org-per-project containing org-per-tenant). Use one flat org set inside a business, or multiple businesses for multiple products.

Self-serve org creation on sign-up and sales-led provisioning are both valid B2B onboarding modes. Pick one in the contract; "B2B" does not imply either. See [IDENTITY.md](IDENTITY.md).

## Data partition

Retain `org_code` in user access tokens by default. After JWT verification, bind queries, writes, caches, queues, and logs to that trusted `org_code` (`org_xxxx`).

Client input (URL slug, header, form field, subdomain) may *select* which organization to authenticate into. It is not the data key. Compare any requested tenant identifier to the contract's trusted tenant source (`org_code` by default) and reject mismatches.

For org-scoped M2M, the same `org_code` arrives as a trusted token claim. For organization API keys, the verification response's `org_code` is the partition. See [MACHINE-ACCESS.md](MACHINE-ACCESS.md).

An intentional user-token workflow may remove `org_code`. That design is valid only when the contract names a trusted server-side resolver that maps the authenticated subject to the active tenant **and current membership/authority**, plus a discriminator for “authenticated but no membership.” The resolver must be deterministic for multi-org users. URL, header, subdomain, request body, local storage, or any other client hint cannot supply or prove the tenant. Without both fields, tenant implementation is blocked.

## Missing organization

If the user belongs to no organizations, Kinde signs them in without an organization and omits `org_code` from the access token. Handle that session as authenticated-without-tenant: allow only non-tenant routes (for example account picker or "create workspace"), and keep tenant data closed.

When `org_code` is retained, omission is the no-membership discriminator. When a workflow intentionally strips it, omission no longer distinguishes “stripped” from “no membership”; use the contract's trusted server-side discriminator. Do not infer the default organization, last-used organization, or a client hint.

## Threats

Walk every row in step 4.

| Threat | Target control |
| --- | --- |
| Cross-tenant read/write via client-supplied org id | Data partition: contract's trusted server partition source; client hint never supplies it |
| Stripped or missing `org_code` with no trusted tenant source | Data partition: explicit resolver + membership check + no-membership discriminator, or blocked |
| Authenticated user with no org reaching tenant APIs | Missing organization: explicit discriminator and deny |
| Org switch leaving old token/tab on the previous tenant | [IDENTITY.md](IDENTITY.md): Active organization; reject stale tokens |
| Permission check only in the UI | [AUTHORIZATION.md](AUTHORIZATION.md): server enforcement |
| Invitation accepted onto the wrong tenant | [IDENTITY.md](IDENTITY.md): Invitations |
| SSO used as if it granted authorization | [IDENTITY.md](IDENTITY.md): Enterprise SSO |
| Global M2M or user API key used as a tenant credential | [MACHINE-ACCESS.md](MACHINE-ACCESS.md) |
| Management MCP used to fully provision a tenant | [CONTROL-PLANES.md](CONTROL-PLANES.md) |

## Tenant contract

Copy and fill the core on every run. Add only annexes that the task needs. Every core and in-scope annex field needs a value or `undecided` plus the blocking question; mark an excluded annex `not applicable: excluded by contract`.

```markdown
# Tenant contract

## Core: business and environment
- Customer: [person | company | both]
- Workspace word in the product: [organization | workspace | team | account | …]
- Detected stack: [framework or `unknown`]
- Kinde business: [one product/project name]
- Environments: [prod + non-prod list]

## Core: isolation
- Model: [default-organization | organizations | dedicated-business]
- Rejected alternatives: [model → product fact]
- Organization mapping: [one org = one …]
- Default org auto-assign: [on | off]

## Core: active tenant and no-org behavior
- User-token `org_code`: [retained: default | intentionally stripped]
- Active tenant source: [verified access-token `org_code` | named trusted server-side resolver]
- Trusted resolver + membership/authority rule: [not applicable: `org_code` retained | exact server source and rule]
- No-membership discriminator: [omitted `org_code` | exact trusted server signal]
- Switch: [re-authenticate with target `org_code` | resolver-specific server flow]
- No-org session: [routes allowed; tenant APIs denied]

## Core: data partition
- Partition key: [verified `org_code` | trusted resolver's stable tenant key]
- Applied to: [queries, writes, caches, queues, logs]
- Client tenant hints: [selection/comparison only; never proof]

## Identity annex: when membership/onboarding is in scope
- Multi-org users: [yes | no]
- Onboarding: [self-serve create-org | invitation | admin/API provision | domain JIT | mix]
- Invitations: [enabled/disabled; invite application; who may invite]
- Enterprise SSO: [none | org-owned connections | shared connections]
- Home-realm discovery: [off | on: routing only]

## Authorization annex: when protected APIs or grants are in scope
- Protected APIs: [API → registered audience → requesting application]
- Audience enforcement: [exact `aud` verified for every protected API]
- Permission keys the product codes against: [list]
- Roles: [catalog names; assignment is per organization]
- Role/permission environment isolation: [shared business catalog | separate businesses]
- User enforcement: [server permission keys after JWT verification]
- Claim freshness: [direct writes → next issued token; inherited role/flag writes → Management API refreshUserClaims + new token]

## Machine-access annex: when non-user credentials are in scope
- User access: [yes: tenant bound by `org_code`]
- Global M2M: [purpose; not a tenant credential]
- Org-scoped M2M: [yes/no; exact `aud`, token `org_code`, granted `scope`]
- Organization API keys: [yes/no; verification `org_code` + `scopes`]
- User API keys: [unused | accepted routes; `user_id`, no `org_code`]
- User-API-key tenant resolution: [not applicable | named server resolver + membership/authorization rule + no-membership behavior]

## Control-plane annex: when setup or operations are in scope
- Application/SDK: [what it owns]
- Dashboard: [what it owns]
- Management API: [operation-specific work verified in published OpenAPI]
- Account API: [signed-in-user/self-serve visibility only]
- Organization-plan server gates: [Management billing entitlements by trusted customer_id | not in scope]
- Management MCP: [read users/orgs; create catalog/config only; not a provisioner]
- MCP connections: [unused | live Quick start auth: documented user API key or offered OAuth browser flow]
- MCP connection tenant rule: [not applicable | named product-API server resolution/authorization]
- Live entitlement availability: [not applicable | gated feature → observed available/absent]
- Remaining tasks: [task → plane → invoked owner or blocked]
```
