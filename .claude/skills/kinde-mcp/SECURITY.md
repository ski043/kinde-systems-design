# Security and troubleshooting

Secret handling and failure gates for both products. Official Management FAQs: [Manage Kinde account with AI agents](https://docs.kinde.com/mcp-servers/manage-kinde-account-with-ai-agents/). User/org key rotate/revoke pages apply to **product** API keys, not automatically to Environment API keys. See [REFERENCES.md](REFERENCES.md).

## Least privilege

- One credential per client and job.
- Grant only scopes that map to tools the user needs this run.
- Management: scopes from [OPERATIONS.md](OPERATIONS.md). Connections (API-key branch): scopes generated from the OpenAPI spec; each scope is one tool.
- After a secret is shown, it is not shown again. Store it outside git.

## Redaction

Do not echo bearer tokens, API keys, or `env` values in chat, committed files, or logs. When quoting config, replace them with `YOUR_API_KEY` or `KINDE_USER_API_KEY`. Prefer placeholders in the repo. Never commit bearer tokens.

## Writing config

Open the existing client file. Merge **one** named Kinde entry. Leave unrelated MCP servers unchanged.

Official Cursor and VS Code Management snippets put `Authorization: Bearer YOUR_API_KEY` inline and document **no** env interpolation. If a real token would be written and the client has no official injection path, ask first.

Connections: paste the live Quick start. Do not invent OAuth JSON. Do not rewrite the host to `*.kinde.com`.

Prefer native remote HTTP. Claude Desktop's Management docs snippet uses third-party `mcp-remote` and passes the Environment API key into it. Require explicit trust and a pinned version/provenance. Do not paste unversioned `npx mcp-remote`. Kinde does not own that package.

## Mix-ups

| Symptom | Fix |
| --- | --- |
| Connection Quick start path with an Environment API key | Wrong product. Management uses `/mcp` and an MCP-enabled Environment API key. |
| Bare `/mcp` with a user API key or connections OAuth | Wrong product. Connections use the Quick start URL/path and that snippet's auth. |
| Connection path with an organization API key | Unsupported client credential. Use the live Quick start's documented user API key or offered OAuth flow. |
| OAuth applied to Management MCP | Wrong product. Any offered OAuth client flow is for MCP connections; Management uses its Environment API key. |
| M2M client id/secret in MCP headers | Wrong credential class. Management MCP does not use client-credentials tokens. |
| Invented `update*` / `delete*` / assignment / billing tool | Not on the Management matrix. Invoke the owning skill; unavailable owner means blocked. |
| Invented connections OAuth client JSON | Use live Quick start only. |

## Empty tools and auth failures

Official Management checks, in order:

1. Key has the scopes for the needed tools.
2. MCP enablement is on (**Can be used by the Kinde MCP server** / **Enable for MCP Server**).
3. Key status is `active`, not `revoked`.
4. Header is `Bearer <key>` (the word `Bearer` is required). No trimmed or extra characters.
5. Host and path match this Management endpoint (`https://<business>.kinde.com/mcp` in current docs).
6. Client restarted after config change.

Timeouts: confirm that URL and key, restart the client, then network. Do not switch to a connections URL to "fix" Management.

Connections empty-tools: confirm current live availability using [REFERENCES.md](REFERENCES.md); confirm the API is authorized on the connection; if Quick start uses a user API key, confirm its scopes include the operations; if Quick start offers OAuth, complete that browser flow. Compare tools to the connection Tools page.

## Audit

- Management: Kinde audit logs for MCP Server operations.
- Connections: connection **Tools audit** (user, tool, outcome, upstream status, duration, agent, IP).

## Rotate and revoke

When a secret is exposed, unused, or over-scoped:

1. Stop using it in the client (placeholder or new key).
2. **Environment API key (Management):** on the Kinde Management API → API Keys tab, confirm the live rotate/revoke actions. Official MCP copy says rotate regularly and that keys can be `active` or `revoked`. Do not follow Users → API keys paths for this key.
3. **User API key (connections):** Users → user → API keys → Revoke (or self-serve). Rotation procedures on the product API-key pages apply here. Scopes cannot be edited; issue a new key.
4. Confirm the old key no longer connects.
