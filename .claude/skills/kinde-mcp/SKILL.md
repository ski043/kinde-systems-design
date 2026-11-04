---
name: kinde-mcp
description: >-
  Kinde MCP: connect, inspect, and safely operate Kinde's official MCP products.
  Use when configuring the Kinde Management MCP server in a supported client;
  inspecting or performing supported account operations through MCP;
  troubleshooting scopes, tools, or auth; exposing a product API through Kinde
  MCP connections; or when another Kinde skill needs MCP operations.
---

# Kinde MCP

Select **exactly one product** before any URL, key, or tool call. Never mix them.

Dated plan, client, and naming facts live in [REFERENCES.md](REFERENCES.md). Read it before relying on a maturity, entitlement, OAuth, or interpolation claim, and whenever official pages disagree.

This skill operates MCP; it does not redesign tenancy. For tenant operations exposed by an MCP connection, actively invoke `kinde-b2b` and consume its tenant-resolution/authorization rule. If that owner is unavailable, or the rule is absent, exposure is blocked.

## Products

| Product | Endpoint | Auth | Owns |
| --- | --- | --- | --- |
| **Management MCP** | `https://<business>.kinde.com/mcp` | MCP-enabled Environment API key only | A hosted subset of Kinde account data. Users and organizations are get-only. Creates exist only for the catalog/config tools in [OPERATIONS.md](OPERATIONS.md). |
| **MCP connections** | Connection-specific URL from that connection's Quick start (path is not bare `/mcp`; host may be a custom domain) | The live Quick start: documented **user API key** or an offered **OAuth browser** flow. Organization API keys are not documented client credentials. | The caller's registered OpenAPI operations, proxied to their API. Not Kinde account administration. |

Both servers are **hosted**. There is no official Kinde npm package or GitHub MCP server. Recheck current client support in [REFERENCES.md](REFERENCES.md) and the live Quick start before connection setup. Prefer native remote HTTP when the selected client supports it.

## Guardrails

- **Discover, then call.** The live tool list is evidence. Plan only tools that appear at runtime **and** exist in [OPERATIONS.md](OPERATIONS.md) (Management) or on the connection's Tools page (connections).
- **Create is a mutation.** Without authorization record `planned`; with authorization call it and capture observed evidence.
- **Catalog create ≠ assignment.** `CreateRole` / `CreatePermission` add definitions. They do not assign a role to a user or attach a permission to a role.
- **Subscribers are leads.** `GetSubscribers` / `CreateSubscriber` are email/lead subscribers, not billing customers.
- **Expand is not billing admin.** A docs sample that expands related billing data is a get-adjacent field. No billing tool is on the Management matrix.
- **Credential class.** An Environment API key is a global admin credential. A user API key binds to `user_id` (`org_code` is null). Consume `kinde-b2b` machine-access rules; do not treat either key as the other product's credential.
- **Tenant connection.** A user API key cannot establish a tenant. A tenant operation needs the `kinde-b2b` contract's named server-side tenant/membership resolution and authorization rule. OAuth follows tenant context established by the product API; do not invent claims.

## Read map

- [OPERATIONS.md](OPERATIONS.md): authoritative Management operation/scope matrix. Read before planning any Management tool call.
- [MANAGEMENT-SETUP.md](MANAGEMENT-SETUP.md): Environment API key and official client config. Read when the product is Management MCP and a client must be configured.
- [CONNECTIONS.md](CONNECTIONS.md): OpenAPI tools, live Quick start client auth, tenant resolution, and upstream auth. Read for connection jobs.
- [SECURITY.md](SECURITY.md): least privilege, secret handling, empty-tools, mix-ups, revoke. Read before writing config, after an auth failure, or when a secret was exposed.
- [REFERENCES.md](REFERENCES.md): dated availability, plan/beta, OAuth, client-support, and conflict notes. **Mandatory before connection setup.**

## Workflow

Complete the steps in order. A step is unfinished until its gate is observable.

### 1. Select one job

Record one row.

```
- Job: [Management setup | Management operation | Management troubleshooting | connection setup | connection operation/troubleshooting]
- Product: [management | connections: derived from job]
- Client: [name | not applicable]
- Requested inspect/call/config outcome:
```

**Gate:** exactly one job is selected. Product matches the job; client is named only when relevant. Every unselected product/branch is `not applicable: excluded by job`. An already-connected inspection or operation does not select a setup job.

### 2. Inspect capability and auth

Read only the references for the selected job:

- Management setup → [MANAGEMENT-SETUP.md](MANAGEMENT-SETUP.md) and [SECURITY.md](SECURITY.md).
- Management operation → [OPERATIONS.md](OPERATIONS.md).
- Management troubleshooting → [SECURITY.md](SECURITY.md), then [OPERATIONS.md](OPERATIONS.md) for expected capability.
- Connection setup → **first** [REFERENCES.md](REFERENCES.md), then [CONNECTIONS.md](CONNECTIONS.md), [SECURITY.md](SECURITY.md), and the live connection Quick start.
- Connection operation/troubleshooting → [CONNECTIONS.md](CONNECTIONS.md), [SECURITY.md](SECURITY.md), and the existing connection's Tools/Quick start surfaces.

Confirm live availability, endpoint, auth, and whether the requested action exists.

```
- Availability: [observed available | absent | unknown: blocking question | not applicable]
- Endpoint shape:
- Auth: [environment API key + MCP enablement | connections: user API key and/or OAuth SSO from Quick start]
- Action class: [get | Management create-on-matrix | connection write shown live | unsupported]
- Tenant operation: [no | yes. B2B resolver/authorization rule]
```

Unsupported Management writes (user/org create, update/delete, role assignment, role-permission attach, applications, callbacks, connections, APIs, billing admin) stay unsupported here. Invoke the owner for the handoff plane; if unavailable, mark it blocked. Do not invent a tool.

**Gate:** every in-scope field is filled. `unsupported` has an invoked handoff owner or is blocked. A tenant connection operation has the explicit B2B rule; no tool or claim is invented.

### 3. Configure setup jobs only

For Management setup or connection setup, inspect the client's existing MCP config. Without mutation authorization, prepare a `planned` one-entry merge. With authorization, merge **one** named Kinde entry (docs label: `kinde`) and leave every other server untouched. For operation or troubleshooting jobs, inspect the existing connection and mark configuration `not applicable: excluded by job`; do not reconfigure it merely to inspect.

- **Management:** use the current official snippet in [MANAGEMENT-SETUP.md](MANAGEMENT-SETUP.md). Auth is the Environment API key. Placeholders stay placeholders unless the user authorized a secret-bearing write.
- **Connections:** after the mandatory REFERENCES recheck, copy the live **Quick start** JSON for this connection and client. That snippet is authoritative for host, path, and whether the client uses a user API key or OAuth. Do not invent OAuth JSON. Do not require `*.kinde.com`.
- Follow only the selected client's documented secret-injection/interpolation shape. Ask before writing a real bearer token.
- Prefer native remote HTTP. Apply [SECURITY.md](SECURITY.md) before any third-party bridge.

Record `planned` when configuration mutation is not authorized. Record `applied + observed evidence` when authorized and the file (or CLI add) contains one new/updated Kinde entry, unrelated servers remain unchanged, the product path matches (`/mcp` vs Quick start connection path), and secrets are placeholders or user-authorized and uncommitted.

### 4. Discover selected capability

For setup, operation, and troubleshooting jobs where a connection is available, list tools from the live server. Compare each name to [OPERATIONS.md](OPERATIONS.md) or the connection Tools page.

```
- Connected: [yes | no]
- Tools observed:
- Missing vs granted scopes:
```

Empty tools: stop and use [SECURITY.md](SECURITY.md). Do not guess names from memory or from example prompts.

**Gate:** observed tool list is recorded. Every planned call is on that list.

### 5. Operate only when selected

Run this step only for Management operation or connection operation/troubleshooting when an operation was requested. Gets may run when the user asked to inspect. Each write needs explicit authorization for that object.

```
- Call: [tool]
- Authorization: [n/a get | authorized | not authorized]
- Outcome: [observed result | planned | applied + observed evidence | blocked]
```

An unauthorized write remains `planned`; do not call it. An authorized write is complete only as `applied + observed evidence`. For a requested write with no matching tool, invoke the owning skill; if unavailable, mark blocked rather than emulating it.

**Gate:** every requested operation has a row and every actual call was observed on the live tool list. Setup-only jobs mark this step `not applicable: excluded by job`.

### 6. Verify and revoke

Confirm the connection, the scopes that actually appeared, and the secret's status.

```
- Evidence: [tool list or get result]
- Secret location: [placeholder | user-held | written: must not be committed]
- Revoke/rotate needed: [yes path | no]
```

**Gate:** every test-matrix row is `pass`, `fail`, `blocked`, or `not applicable: excluded by job`, with evidence for every in-scope row. Exposed secrets have a revoke path from [SECURITY.md](SECURITY.md).

## Test matrix

| Case | Observable target |
| --- | --- |
| Valid connection | Chosen product connects; tools appear that match granted scopes and the matrix or Tools page. |
| Missing MCP enablement | Management key without MCP enablement yields no tools or auth failure; fix is the Management API key's MCP checkbox, not a different URL. |
| Insufficient scopes / empty tools | Client is connected but tools are empty or missing the needed get/create; next step is scopes or enablement, not an invented tool. |
| Unauthorized create plan | An unauthorized `Create*` remains `planned` and is not called. |
| Unsupported mutation handoff | User/org create, update/delete, assignment, apps, callbacks, or billing admin invokes the owning skill; an unavailable owner is blocked and MCP does not attempt it. |
| No billing-tool claim | No billing administration tool is listed or called. Billing appears only as an expand on a get, if the live tool offers it. |
| URL/key mix-up | Management is `/mcp` + Environment API key (not OAuth). Connections use the Quick start URL/path plus that snippet's user API key or OAuth. Cross-pairing is rejected. |
| Tenant operation through connection | User-API-key auth has no `org_code`; the product API applies the B2B contract's server-side tenant/membership rule. OAuth uses product-API tenant context without invented claims. |
| Secret revocation | After exposure or rotation, the old key is revoked or replaced; the client no longer uses it. |

## Handoff

Do not link files outside this folder. Invoke `kinde-b2b` for tenant rules, `kinde-organizations` for organization lifecycle, `kinde-authorization` for role/permission work, and `kinde-billing` for plans and entitlements. Broader Kinde writes use their owning skill on the Management API or dashboard. If an owner is unavailable, preserve the selected MCP job and mark the handoff blocked.
