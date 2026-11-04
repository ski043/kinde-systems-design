# Assignment and control planes

Where each authorization action is performed. Invoke `kinde-mcp` for MCP setup/operation and the owning installed Management API setup skill for bootstrapping. An unavailable owner is a blocked handoff.

Use least-privilege scopes. Record every Kinde mutation as `planned` without implementation authorization, or `applied + observed evidence` with authorization. Catalog writes are business-wide. Plan them first.

## Six actions

Keep these distinct. Creating a role is not attaching permissions. Attaching is not assigning. A default is not an assignment you already made.

| Action | What it changes | Dashboard | Management API | Management MCP |
| --- | --- | --- | --- | --- |
| Catalog create | Permission or role definition | Settings → User management → Permissions / Roles | `CreatePermission`; `CreateRole` | Definition create only; invoke `kinde-mcp` for exact tools |
| Role–permission attach | Which keys a role includes | Toggles while creating or editing a role | `UpdateRolePermissions`; `RemoveRolePermission`; `GetRolePermissions` | Read only; no attach |
| Membership assign | Roles or direct permissions on one user in one org | User → Roles / Permissions, org dropdown | `CreateOrganizationUserRole`; `DeleteOrganizationUserRole`; `CreateOrganizationUserPermission`; `DeleteOrganizationUserPermission` | Read only; no assign |
| Default roles | Role given when a user first signs up | Role → Assign to new users | `CreateRole` / `UpdateRoles` `is_default_role` | Definition create may set defaults; it does not assign existing users |
| Per-org defaults | Role given when a user joins that organization | Organization → Policies → Default roles | No dedicated endpoint verified | None |
| Runtime enforce | Allow or deny a request | - | - | - |

`CreateRole` request bodies create the definition (`name`, `description`, `key`, `is_default_role`, optional `assignment_permission_id`). They do not attach permission ids. Dashboard attach-at-create is a dashboard convenience, not part of the create operation.

Assignments require organization membership. A user without an organization cannot be given roles or permissions.

## Management MCP boundary

Management MCP can inspect the authorization catalog and selected relationships, and can create role/permission definitions. It cannot attach permissions to roles, assign roles or permissions to users, update system permissions on a role, or delete catalog objects. Invoke `kinde-mcp` and consume its exact operations matrix; if unavailable, mark MCP work blocked. Broader writes use dashboard or Management API.

MCP organization-user relationship reads use `read:organization_users`; the Management API uses `read:organization_user_roles` and `read:organization_user_permissions`. Grant the scope of the plane being called.

## Management API: verified operations

Base path `/api/v1`. Audience is the business Management API. Use only these mappings; do not infer siblings.

### Catalog lifecycle

| Operation | Method and path | Scope |
| --- | --- | --- |
| `GetPermissions` | `GET /permissions` | `read:permissions` |
| `CreatePermission` | `POST /permissions` | `create:permissions` |
| `UpdatePermissions` | `PATCH /permissions/{permission_id}` | `update:permissions` |
| `DeletePermission` | `DELETE /permissions/{permission_id}` | `delete:permissions` |
| `GetRoles` | `GET /roles` | `read:roles` |
| `CreateRole` | `POST /roles` | `create:roles` |
| `GetRole` | `GET /roles/{role_id}` | `read:roles` |
| `UpdateRoles` | `PATCH /roles/{role_id}` | `update:roles` |
| `DeleteRole` | `DELETE /roles/{role_id}` | `delete:roles` |
| `GetRolePermissions` | `GET /roles/{role_id}/permissions` | `read:role_permissions` |
| `UpdateRolePermissions` | `PATCH /roles/{role_id}/permissions` | `update:role_permissions` |
| `RemoveRolePermission` | `DELETE /roles/{role_id}/permissions/{permission_id}` | `delete:role_permissions` |

### Assignment

| Operation | Method and path | Scope |
| --- | --- | --- |
| `GetOrganizationUserRoles` | `GET /organizations/{org_code}/users/{user_id}/roles` | `read:organization_user_roles` |
| `CreateOrganizationUserRole` | `POST /organizations/{org_code}/users/{user_id}/roles` | `create:organization_user_roles` |
| `DeleteOrganizationUserRole` | `DELETE /organizations/{org_code}/users/{user_id}/roles/{role_id}` | `delete:organization_user_roles` |
| `GetOrganizationUserPermissions` | `GET /organizations/{org_code}/users/{user_id}/permissions` | `read:organization_user_permissions` |
| `CreateOrganizationUserPermission` | `POST /organizations/{org_code}/users/{user_id}/permissions` | `create:organization_user_permissions` |
| `DeleteOrganizationUserPermission` | `DELETE /organizations/{org_code}/users/{user_id}/permissions/{permission_id}` | `delete:organization_user_permissions` |

### Impact inspection and inherited refresh

| Operation | Method and path | Scope | Use |
| --- | --- | --- | --- |
| `GetRoleUsers` | `GET /roles/{role_id}/users` | `read:organization_user_roles` | Assignees across orgs after a catalog edit |
| `GetOrganizationRoleUsers` | `GET /organizations/{org_code}/roles/{role_id}/users` | `read:organization_user_roles` | Assignees in one org |
| `GetOrganizationRoleUsersCount` | `GET /organizations/{org_code}/roles/{role_id}/users/count` | `read:organization_user_roles` | Count only |
| `refreshUserClaims` | `POST /users/{user_id}/refresh_claims` | `update:user_refresh_claims` | Invalidate one user's claim cache after an inherited change |

Account API (`GET /account_api/v1/permissions`, `GET /account_api/v1/roles`) reads the signed-in user's own grants with that user's access token. It is not a provisioner.

### System permissions, API scopes, application access roles

Use this branch only when the authorization contract includes these objects. Dashboard can list user API scopes; no Management API list operation is in the spec.

| Operation | Method and path | Scope |
| --- | --- | --- |
| `GetSystemPermissions` | `GET /system_permissions` | `read:system_permissions` |
| `GetRoleSystemPermissions` | `GET /roles/{role_id}/system_permissions` | `read:role_system_permissions` |
| `UpdateRoleSystemPermissions` | `PATCH /roles/{role_id}/system_permissions` | `update:role_system_permissions` |
| `GetRoleScopes` | `GET /roles/{role_id}/scopes` | `read:role_scopes` |
| `AddRoleScope` | `POST /roles/{role_id}/scopes` | `create:role_scopes` |
| `DeleteRoleScope` | `DELETE /roles/{role_id}/scopes/{scope_id}` | `delete:role_scopes` |
| `addOrganizationUserAPIScope` | `POST /organizations/{org_code}/users/{user_id}/apis/{api_id}/scopes/{scope_id}` | `create:organization_user_api_scopes` |
| `deleteOrganizationUserAPIScope` | `DELETE /organizations/{org_code}/users/{user_id}/apis/{api_id}/scopes/{scope_id}` | `delete:organization_user_api_scopes` |
| `GetApplicationAccessRoles` | `GET /applications/{application_id}/access_roles` | `read:applications` |
| `AddApplicationAccessRole` | `POST /applications/{application_id}/access_roles/{role_id}` | `update:applications` |
| `RemoveApplicationAccessRole` | `DELETE /applications/{application_id}/access_roles/{role_id}` | `update:applications` |

Application access roles are enforced only when role-based access control is enabled for that application. Adding a role does not enable it.

Self-serve portal assignment (invite + role grant) always needs `org:write:members`. A role assignment permission applies only when `assignment_permission_id` is configured. See [SYSTEM.md](SYSTEM.md).

## Defaults and plan gates

Confirm the live billing entitlement and dashboard control. Do not hard-code a plan name.

| Control | Behavior | Gate |
| --- | --- | --- |
| Assign to new users | Role is given when a new user joins an organization during signup; a no-org user gets no assignment until membership | None documented beyond having the role |
| Per-org default roles | Organization Policies set roles for users who join *that* org | Requires the live “Assign default roles per org” / advanced-organization entitlement. Recheck [REFERENCES.md](REFERENCES.md) and verify live |
| Assign to the creator | Role is given to the user who creates an organization on the auth flow (`is_create_org`) | Documented on the dashboard / billing-role guide. Not a field on `CreateRole` |
| Permission auto-on-new-role | New roles receive that permission automatically | Dashboard permission option |
| Per-org portal function set | Which portal sections that org exposes | Advanced-organization entitlement; environment portal settings still apply unless overridden |

API scopes, organization-owned M2M, and organization API keys are plan-gated. Use those branches only when the contract includes them; recheck [REFERENCES.md](REFERENCES.md), and treat absence in the dashboard as evidence.

## Other planes

| Plane | Authorization job |
| --- | --- |
| Application / SDK | Verify JWT and exact `aud`; check permission keys; obtain the new token after refresh. Invoke the loaded framework adapter for syntax; absent adapter blocks implementation |
| Management API backend | Invoke `refreshUserClaims` with `update:user_refresh_claims` after inherited changes |
| Dashboard | Manual catalog, attach, assign, defaults, inspection |
| Bulk import | NDJSON vs CSV are different shapes. See below |

Seed assignments per environment organization. Do not treat catalog create as environment seeding.

### Import shapes

**NDJSON** (verified schema): each user has `organizations[]` objects with `external_id`, `roles`, `permissions` (and optional `scopes`). Catalog keys must already exist. Organizations must already exist with a matching `external_id`.

**CSV:** official pages disagree on headers (`role_key` / `permission_key` in the field list versus `roles` / `permissions` in examples). Inspect the current downloadable template on the import screen before writing a file. Do not copy a remembered header set.

Prose that mentions `external_organization_id` for CSV/NDJSON linking is about matching the organization's `external_id`, not a substitute for the NDJSON `organizations[].external_id` array.
