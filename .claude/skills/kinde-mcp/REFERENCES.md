# References

Dated first-party notes for this skill. Operational rules live in the other sibling files. Re-read the linked pages before treating a plan, beta, OAuth, client, or interpolation claim as current.

Last verified against Kinde docs: 19 August 2026.

## Primary sources

- [About MCP servers in Kinde](https://docs.kinde.com/mcp-servers/)
- [Manage Kinde account with AI agents](https://docs.kinde.com/mcp-servers/manage-kinde-account-with-ai-agents/)
- [Operations and Scopes for Kinde MCP server](https://docs.kinde.com/mcp-servers/operations-and-scopes/)
- [Add a new MCP connection](https://docs.kinde.com/mcp-servers/add-mcp-connection/)
- [Scopes for API keys](https://docs.kinde.com/manage-your-apis/add-manage-api-keys/scopes-for-api-keys/)
- [User-level API keys](https://docs.kinde.com/manage-your-apis/about-api-keys/user-api-keys/)
- [Manage subscribers](https://docs.kinde.com/manage-users/add-and-edit/manage-subscribers/)
- [Rotate API keys](https://docs.kinde.com/manage-your-apis/add-manage-api-keys/rotate-api-keys/) (user/org product keys)
- [Revoke API keys](https://docs.kinde.com/manage-your-apis/add-manage-api-keys/revoke-api-keys/) (user/org product keys)
- [Management API access](https://docs.kinde.com/developer-tools/kinde-api/connect-to-kinde-api/)

Feature-release notes (not a substitute for docs): [Kinde updates](https://updates.kinde.com/).

Older docs paths redirect: `/mcp-server/about-mcp-server/` and `/mcp-server/get-started/setup-mcp-server/` → the pages above.

## Maturity and naming (19 August 2026)

| Fact | Evidence | Re-check |
| --- | --- | --- |
| Two products: **MCP connections** (your APIs) and **Kinde Management MCP server** | About page comparison table | About page |
| Connections endpoint is `/mcp/<connection-id>` | About and add-connection HTML | About page raw URL |
| Management endpoint is `/mcp` with an MCP-enabled Environment API key | About + setup | Setup step 1 |
| Management server is hosted; no official npm or `kinde-oss` MCP GitHub server | Setup uses URL or third-party `mcp-remote`; no official package in docs | Setup + npm/`kinde-oss` search |
| Official Management clients: Cursor, Claude Desktop, Claude CLI, VS Code | Setup page | Setup "Configure the AI agent" |
| Claude Desktop Management snippet uses third-party `npx mcp-remote` (not Kinde-owned); native HTTP clients are documented for Cursor, VS Code, Claude CLI | Setup Claude Desktop vs Cursor/VS Code/CLI blocks | Those blocks |
| Cursor / VS Code Management snippets are HTTP `url` + `headers`; no env interpolation documented | Setup Cursor / VS Code blocks | Those blocks |
| MCP connections require Plus or higher **and** support-enabled beta | Add-connection "What you need" | That section + dashboard |
| Management setup page lists a free-account admin prerequisite and does not mark Management MCP as beta | Setup "What you need" | That section. January 2026 updates said "reach out if you want to try it". Treat current setup page as the live bar |
| Updates marketing name **Kinde Secure MCP** = MCP connections | [Bring your own APIs to AI agents](https://updates.kinde.com/announcements/bring-your-own-apis-to-ai-agents) (31 July 2026) | Updates + add-connection |
| Docs client auth for connections is API-key-centered. Updates announce OAuth SSO, DCR, protected-resource metadata, ChatGPT, custom-domain isolation | Add-connection vs [31 July 2026](https://updates.kinde.com/announcements/bring-your-own-apis-to-ai-agents) | **Steer: live connection Quick start** |
| Upstream OAuth 2.0 client credentials is Coming Soon (Kinde → the API) | Add-connection backend auth | That control. Distinct from client OAuth SSO |
| Management MCP auth remains Environment API key; the OAuth announcement is for MCP connections | Setup page vs 31 July 2026 "OAuth sign-in for MCP connections" | Setup + that heading |
| Connection host may be a custom domain; Quick start is authoritative | 31 July 2026 custom-domain isolation note | Quick start URL, not a `*.kinde.com` rule |
| `mcp-remote` is third-party ([geelen/mcp-remote](https://github.com/geelen/mcp-remote)); Kinde does not own it | Official snippet command is `npx mcp-remote` | Setup Claude Desktop. Pin if used |

## Conflicts: steer to observed evidence

### Generic "create new resources"

The operations FAQ says MCP is limited to gets and creates, and that clients can create new resources. The same page's tables list **create** only for roles, permissions, properties, feature flags, environment variables, and subscribers. Users and organizations are get-only.

**Steer:** [OPERATIONS.md](OPERATIONS.md) tables, not the FAQ sentence.

### MCP enablement label

Setup step: **Can be used by the Kinde MCP server**. Troubleshooting: **Enable for MCP Server**.

**Steer:** the live checkbox on the Environment API key.

### Example prompts vs tools

Setup examples ask to show environment variables and mention expanding billing. The operations table has `CreateEnvironmentVariable` and no `GetEnvironmentVariables`. Billing is not a tool.

**Steer:** live tool list + [OPERATIONS.md](OPERATIONS.md). Expanding billing on a get is read-adjacent only.

### Connection URL rendering and custom domains

Some rendered About/add-connection sentences show `https://<your_business>.kinde.com/mcp/` with the id eaten. Page HTML uses `https://<your_business>.kinde.com/mcp/<connection-id>`. The 31 July 2026 note says multiple connections on the same **custom domain** stay isolated via path-scoped OAuth routes.

**Steer:** live Quick start URL. Product split is path (`/mcp` vs connection path), not "must be `*.kinde.com`". Bare `/mcp` is Management.

### Client OAuth vs connection guide

The [connection guide](https://docs.kinde.com/mcp-servers/add-mcp-connection/) still describes user API key auth and Quick start replacement of `KINDE_USER_API_KEY`. [Bring your own APIs to AI agents](https://updates.kinde.com/announcements/bring-your-own-apis-to-ai-agents) (31 July 2026) announces OAuth SSO / browser sign-in for MCP connections, plus DCR, protected-resource metadata, ChatGPT connector recognition, and custom-domain isolation.

**Steer:** the connection's live Quick start. Do not invent OAuth JSON. Do not apply that OAuth flow to Management MCP. Upstream OAuth 2.0 client credentials remains Coming Soon.

The documented API-key branch uses a **user API key**. Organization API keys are not documented as MCP-connection client credentials. User API-key verification has `user_id` and no `org_code`; tenant operations need the `kinde-b2b` contract's server-side tenant/membership rule.

### January 2026 Management announcement

[Polish and new tricks](https://updates.kinde.com/announcements/polish-and-new-tricks) (30 January 2026) said agents could "create and manage properties, look up categories" and to reach out to try it.

**Steer:** current operations table (no category tools; no update/manage). Current setup page is the client list.

### Environment API key vs product API keys

Rotate/revoke docs describe Users → API keys and Organizations → API keys. Management MCP keys are created on **Kinde Management API → API Keys** and can be `active` or `revoked` per the MCP troubleshooting FAQ.

**Steer:** do not apply user/org key UI paths to Environment API keys. Confirm actions on the Management API key tab.

### Dashboard path to the Management API

Setup: Settings → APIs → Kinde Management API. About comparison: Settings → Environment → APIs → Kinde Management API → API keys.

**Steer:** same destination; confirm live nav.

## Deliberately out of scope here

Framework app implementation, tenancy contracts, Management API endpoint catalogs, and billing implementation stay with their owning installed skills. Invoke that owner; unavailable owners block those slices. Client interpolation and OAuth config remain limited to the official snippets / live Quick start.
