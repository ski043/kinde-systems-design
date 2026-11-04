# Management MCP setup

Client and key steps for **Management MCP** only. Source: [Manage Kinde account with AI agents](https://docs.kinde.com/mcp-servers/manage-kinde-account-with-ai-agents/). Recheck [REFERENCES.md](REFERENCES.md) and the live setup page for current client support before acting.

Need the other product? Use [CONNECTIONS.md](CONNECTIONS.md). Tool names: [OPERATIONS.md](OPERATIONS.md). Secrets: [SECURITY.md](SECURITY.md).

Any OAuth client flow offered for **MCP connections** does not apply here. Management MCP authenticates with an MCP-enabled Environment API key.

## Environment API key

The documented host is `https://<business>.kinde.com/mcp`. Clients send `Authorization: Bearer <key>`.

Create the key in the dashboard:

Record these configuration steps as `planned` when mutation is not authorized, or `applied + observed evidence` when authorized.

1. Settings → APIs → **Kinde Management API** → View details → **API Keys** (nav may also appear as Settings → Environment → APIs).
2. Add API Key. Name it for this client and job.
3. Enable MCP. Official copy: **Can be used by the Kinde MCP server**. Troubleshooting copy: **Enable for MCP Server**. Confirm the live checkbox.
4. Grant only the scopes required for the planned tools in [OPERATIONS.md](OPERATIONS.md).
5. Create. Copy the secret once. Store it outside the repo.

The key is an Environment API key for the Kinde Management API, not a user or organization product API key, and not an M2M client secret.

## Official clients

Prefer native remote HTTP: Cursor, VS Code, or Claude CLI. Reproduce these shapes. Replace `YOUR_BUSINESS`. Keep `YOUR_API_KEY` as a placeholder unless the user authorized a secret-bearing write.

If the client already has other MCP servers, **merge** a single `"kinde"` (or user-chosen) entry into the existing `mcpServers` / `servers` object. Do not replace the file or treat every entry as Kinde.

### Cursor

Cursor → Settings → Tools & MCP → Add custom MCP / New MCP server (`mcp.json`):

```json
{
  "mcpServers": {
    "kinde": {
      "url": "https://YOUR_BUSINESS.kinde.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

No official env interpolation is documented for this snippet. Ask before writing a real token into the file.

### VS Code

Command Palette → `MCP: Open User Configuration`:

```json
{
  "servers": {
    "kinde": {
      "type": "http",
      "url": "https://YOUR_BUSINESS.kinde.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

Same interpolation rule as Cursor. Merge `"kinde"` into existing `servers`.

### Claude CLI

```bash
claude mcp add --transport http kinde https://YOUR_BUSINESS.kinde.com/mcp \
  --header "Authorization: Bearer YOUR_API_KEY"
```

Verify with `claude mcp list`, then `/mcp`.

### Claude Desktop

Native HTTP is preferred. The setup page still shows a stdio bridge that runs **third-party** `mcp-remote` (not Kinde-owned) and passes the Environment API key into that process.

Do not paste unversioned `npx mcp-remote`. Use this shape only when the user explicitly trusts that package and you have reviewed a **pinned** version and provenance. `${auth_token}` interpolation is documented for this snippet only.

```json
{
  "mcpServers": {
    "kinde": {
      "command": "npx",
      "args": [
        "mcp-remote@<pinned-version>",
        "https://YOUR_BUSINESS.kinde.com/mcp",
        "--header",
        "Authorization: Bearer ${auth_token}"
      ],
      "env": {
        "auth_token": "YOUR_API_KEY"
      }
    }
  }
}
```

Merge the `"kinde"` object; leave other servers in `claude_desktop_config.json` as they are.

## After connect

Ask the client which Kinde tools it has. Compare the answer to [OPERATIONS.md](OPERATIONS.md) and the scopes on this key. Sample prompts on the setup page may request reads that have no `Get*` tool (environment variables) or may mention billing expand. Treat the live list and the matrix as the capability.

Inspect gates: connected, tools observed, scopes granted, secret not committed.
