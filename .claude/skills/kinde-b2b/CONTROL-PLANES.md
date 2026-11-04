# Control planes

Where a remaining task is performed. This skill selects the plane; it does not document each plane's setup.

## Planes

| Plane | Auth | Owns | Limit |
| --- | --- | --- | --- |
| Application / SDK | User session, your API | Login/register/create-org URLs, token verification, tenant binding in product code | Stack-specific files live in an adapter skill |
| Kinde dashboard | Human admin | Manual org/user/policy/connection edits, inspection | Not an automation path |
| Management API | Global M2M (client credentials + granted scopes) | Broad, operation-specific administration, including organization-plan billing entitlements by trusted `customer_id` | Bounded by operations and scopes in the published OpenAPI |
| Account API | User access token | Signed-in-user profile and self-serve visibility, including personal-plan/current-user entitlements and portal links | Caller sees themselves; not the universal server gate for organization-plan features |
| Management MCP | Environment API key (MCP-enabled) | Read users, organizations, roles, permissions, flags, properties, environment, subscribers. Create selected catalog/config objects only (roles, permissions, properties, feature flags, environment variables, subscribers) | Not a tenant provisioner. No user or organization create/update/delete. Broader mutations use Management API |
| MCP connections | Live Quick start: documented user API key or offered OAuth browser flow | Registered product-API operations as MCP tools; Kinde proxies to that API | Organization API keys are not documented client auth. Tenant operations still require the tenant contract's server-side resolution/authorization rule |

Official docs call the product-API surface **MCP connections**. Management MCP is `/mcp` with an environment API key.

## Mutation

Read and plan on any plane. For each dashboard, Management API, config, or MCP mutation, record `planned` when implementation is not authorized, or `applied + observed evidence` when it is.

## Handoff

After the tenant contract is filled:

1. Detect the stack from the repo (step 1 inventory).
2. Invoke the loaded framework adapter for framework files.
3. Invoke `kinde-organizations` for organization lifecycle.
4. Invoke `kinde-authorization` for role/permission implementation.
5. Invoke `kinde-billing` for plans and entitlements.
6. Invoke `kinde-mcp` for MCP server or connection work.
7. Mark an unavailable owner `blocked`. Keep the contract; do not reconstruct the missing domain from generic docs.

## Routing examples

| Task | Plane |
| --- | --- |
| Bind tenant queries to `org_code` | Application |
| Toggle default-org auto-assign | Dashboard or Management API |
| Seed production organization access | Management API: seed memberships and assignments; role/permission definitions already share the business catalog |
| Show the signed-in user's permissions in-app | Access token and/or Account API |
| Gate an organization-plan feature on the server | Management API billing entitlements by trusted `customer_id` |
| Ask an agent "list organizations" | Management MCP (read) |
| Create + configure + update an org end-to-end from an agent | Management API, not Management MCP |
| Let a customer's agent call your product API | MCP connection + live Quick start user API key or OAuth; tenant operations also use the contract resolver in [MACHINE-ACCESS.md](MACHINE-ACCESS.md) |
