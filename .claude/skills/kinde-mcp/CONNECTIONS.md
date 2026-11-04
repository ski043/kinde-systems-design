# MCP connections

Product-API MCP only. Official docs name: **MCP connections**. Updates also say **Kinde Secure MCP**. This is not Management MCP and does not grant Kinde account or billing administration.

Source: [Add a new MCP connection](https://docs.kinde.com/mcp-servers/add-mcp-connection/). Dated entitlement and OAuth notes: [REFERENCES.md](REFERENCES.md).

## Availability

Before **connection setup**, read [REFERENCES.md](REFERENCES.md) and recheck the live dashboard for the current plan, maturity, enablement, OAuth, and client-support state. Those facts are volatile. The upstream API must be reachable at a live base URL.

Absence from **MCP Servers → Connections** is evidence that setup is unavailable in this business/environment. Mark it blocked.

## What it exposes

Kinde hosts a **connection-specific** URL. Docs examples look like `https://<business>.kinde.com/mcp/<connection-id>`. The live **Quick start** for that connection is authoritative for host and path, including a custom domain. Do not reject a Quick start URL because the host is not `*.kinde.com`. Distinguish products by path: Management is bare `/mcp`; a connection is not.

Kinde turns operations in the authorized API's OpenAPI spec into MCP tools, proxies each call to the upstream API, and writes a Tools audit row.

## Client auth: two branches

Keep these separate from **upstream** auth (Kinde → the API) below.

1. **User API key.** Each selected scope maps to one tool; tools without a matching scope are hidden. Keys are immutable. Change scopes by creating a new key. Verification has `user_id` and no `org_code`. Before exposing a tenant operation, invoke `kinde-b2b` and require its named server-side tenant/membership resolution and authorization rule; absent owner or rule blocks exposure.
2. **OAuth browser flow.** Use it only when the live Quick start offers it. OAuth follows the tenant context established by the product API; do not invent `org_code` or other tenant claims.

The connection guide and announcement can drift. **Steer to the live Quick start** for this connection and client. Paste that JSON. Do not invent an OAuth client snippet. Organization API keys are not documented connection client credentials.

Any OAuth branch shown here applies to **MCP connections only**. Management MCP stays on an Environment API key.

## Configure the connection

For each configuration mutation, record `planned` without authorization or `applied + observed evidence` with authorization.

1. Register the API (Settings → Environment → APIs) and upload an OpenAPI spec (JSON or YAML, max 20MB). Kinde generates scopes and tool metadata.
2. MCP Servers → Connections → Add new connection. Name it and select the API.
3. Set **backend authentication** (Kinde → upstream), then extra headers if needed.
4. If Quick start uses API-key auth, issue a user API key for that API and copy it once.
5. Copy the live **Quick start** JSON for the selected client. Merge one named entry into the existing client config. Replace its secret placeholder only when authorized.

OpenAPI tool names prefer a sanitized `operationId`; otherwise Kinde derives a name from API, method, and path. Duplicates are disambiguated.

Dashboard permissions: view connections/tools/audit needs `read:apis`; create/delete/authorize/configure backend auth needs `update:apis`. Those are admin permissions, not MCP tools.

Prefer native remote HTTP when the live Quick start supports it. If Quick start emits a stdio/`mcp-remote` bridge, apply the third-party trust and pinning rule in [SECURITY.md](SECURITY.md).

## Upstream auth (Kinde → the API)

Not client sign-in. Use only backend-auth types currently offered by the live connection UI after the mandatory [REFERENCES.md](REFERENCES.md) recheck.

| Type | Behavior |
| --- | --- |
| Pass through user token | Forwards the MCP client's user API key as `Authorization: Bearer` |
| Static bearer token | Sends a configured bearer token |
| API key (`X-Api-Key`) | Sends a configured `X-Api-Key` |
| Static headers only | No auth header; extra headers only |
| OAuth 2.0 client credentials | Use only if the live UI marks it available; otherwise choose an offered type |

Extra header templates documented today: `{{kinde.user.id}}`, `{{kinde.user.username}}`, `{{kinde.user.email}}`, `{{kinde.user.firstname}}`, `{{kinde.user.lastname}}`.

## After connect

List live tools and compare them to the connection **Tools** page and the credential's scopes. Inspect **Tools audit** for user, tool, outcome, upstream status, and duration.

A connections config uses the Quick start URL (connection path, any documented host). Bare `/mcp` plus an Environment API key is Management MCP. Wrong product.
