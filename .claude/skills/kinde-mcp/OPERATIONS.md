# Management MCP operations

Authoritative tool and scope matrix for **Management MCP** only. Source: [Operations and Scopes for Kinde MCP server](https://docs.kinde.com/mcp-servers/operations-and-scopes/), verified 19 August 2026.

MCP connections do not use this table. Their tools come from the authorized API's OpenAPI spec.

Runtime discovery still wins: if a live tool is absent, do not call it even if it appears here. If a live tool is absent from this table, do not treat it as a documented Management operation. Re-read the source page.

## Users: get-only

| Operation | Description | Scope |
| --- | --- | --- |
| GetUsers | List all users | read:users |
| GetUserData | Get user details | read:users |
| GetUserIdentities | Get linked identity providers | read:user_identities |

No user create, update, or delete tool.

## Organizations: get-only

| Operation | Description | Scope |
| --- | --- | --- |
| GetOrganizations | List all organizations | read:organizations |
| GetOrganization | Get organization details | read:organizations |
| GetOrganizationUsers | List users in org | read:organization_users |
| GetOrganizationUserRoles | Get user's roles in org | read:organization_users |
| GetOrganizationUserPermissions | Get user's permissions in org | read:organization_users |
| GetOrganizationFeatureFlags | Get org's feature flags | read:feature_flags |

No organization create, update, or delete tool. Org user/role/permission rows are reads of existing membership, not assignment.

## Roles and permissions

| Operation | Description | Scope | Class |
| --- | --- | --- | --- |
| GetRoles | List all roles | read:roles | get |
| GetRole | Get role details | read:roles | get |
| CreateRole | Create a new role | create:roles | create (catalog definition) |
| GetPermissions | List all permissions | read:permissions | get |
| CreatePermission | Create a permission | create:permissions | create (catalog definition) |
| GetRolePermissions | Get role's permissions | read:role_permissions | get |

`CreateRole` and `CreatePermission` add business-level definitions. There is no tool here that assigns a role to a user or attaches a permission to a role.

## Configuration

| Operation | Description | Scope | Class |
| --- | --- | --- | --- |
| GetEnvironment | Get environment details | read:environments | get |
| GetProperties | List custom properties | read:properties | get |
| CreateProperty | Create a custom property | create:properties | create |
| CreateFeatureFlag | Create a feature flag | create:feature_flags | create |
| CreateEnvironmentVariable | Create env variable | create:environment_variables | create |
| GetSubscribers | List subscribers | read:subscribers | get (email/lead list) |
| CreateSubscriber | Create a subscriber | create:subscribers | create (email/lead) |

There is no `GetFeatureFlags` or `GetEnvironmentVariables` on this table. `GetOrganizationFeatureFlags` is the only feature-flag read, and it is org-scoped. Example prompts that ask to "show environment variables" are not a license to invent a get tool.

`GetSubscribers` / `CreateSubscriber` read or add Kinde email/lead subscribers (newsletters, campaigns, lead gen). They are not billing customers.

## Create-enabled set

These six names are the only create tools on the current table:

- `CreateRole` (`create:roles`)
- `CreatePermission` (`create:permissions`)
- `CreateProperty` (`create:properties`)
- `CreateFeatureFlag` (`create:feature_flags`)
- `CreateEnvironmentVariable` (`create:environment_variables`)
- `CreateSubscriber` (`create:subscribers`)

## Absent from this table

The current table has no update or delete operations. It also has no tools for applications, callback URLs, connections, APIs, membership assignment, role-permission attachment, role assignment, or billing administration.

The FAQ on the same page says scopes are limited to gets and creates, and that clients can "create new resources." That sentence is generic. This table is the resource list. Users and organizations are get-only.

A setup-page sample mentions expanding related data (organizations, identities, billing) where applicable. That is a get-adjacent expand, not a billing tool.

For broader writes, actively invoke the owning skill for its Management API or dashboard branch. If that skill is unavailable, mark the handoff blocked.
