# Planes and mutations

Where organization lifecycle work is performed, and the official methods that mutate it. Invoke the owning installed skill for M2M setup, MCP operation, or framework SDK work; an unavailable owner is a blocked handoff.

## Planes

| Plane | Auth | Organization job | Limit |
| --- | --- | --- | --- |
| Application / SDK | User session | Create-org and org-scoped login/register URLs; switcher re-auth; bind the B2B contract's tenant source | Invoke the loaded framework adapter; absent adapter blocks implementation |
| Kinde dashboard | Human admin | Manual create/import, members, policies, brand, connections, suspend, delete | Not an automation path |
| Management API | Global M2M + scopes | Create, update, suspend, delete, members, invites, properties, logos | Least-privilege scopes |
| Account API | User access token | Portal link; the signed-in user's own roles/permissions/entitlements | Caller sees only themselves |
| Management MCP | Environment API key | Get organizations, org users, org roles/permissions, org feature flags | No organization or member create/update/delete |

Read and plan on any plane. Record a mutation as `planned` without authorization, or `applied + observed evidence` with authorization.

## Management API: organizations

Confirm scopes on the M2M application before calling. Paths are from the Kinde-owned Management API spec.

| Job | Method | Scope |
| --- | --- | --- |
| List | `GET /api/v1/organizations` | `read:organizations` |
| Get | `GET /api/v1/organization?code={org_code}` | `read:organizations` |
| Create | `POST /api/v1/organization` | `create:organizations` |
| Update / suspend | `PATCH /api/v1/organization/{org_code}` | `update:organizations` |
| Delete | `DELETE /api/v1/organization/{org_code}` | `delete:organizations` |
| List / add / patch members | `GET\|POST\|PATCH /api/v1/organizations/{org_code}/users` | `read:organization_users` / `create:organization_users` / `update:organization_users` |
| Remove member | `DELETE /api/v1/organizations/{org_code}/users/{user_id}` | `delete:organization_users` |
| Assign role | `POST /api/v1/organizations/{org_code}/users/{user_id}/roles` body `{ "role_id" }` | `create:organization_user_roles` |
| Remove role | `DELETE /api/v1/organizations/{org_code}/users/{user_id}/roles/{role_id}` | `delete:organization_user_roles` |
| Assign permission | `POST /api/v1/organizations/{org_code}/users/{user_id}/permissions` body `{ "permission_id" }` | `create:organization_user_permissions` |
| Remove permission | `DELETE /api/v1/organizations/{org_code}/users/{user_id}/permissions/{permission_id}` | `delete:organization_user_permissions` |
| Invites | `GET\|POST /api/v1/organization/{org_code}/invites` | `read:organization_invites` / `create:organization_invites` |
| Get / revoke invite | `GET\|DELETE /api/v1/organization/{org_code}/invites/{invite_code}` | `read:organization_invites` / `delete:organization_invites` |
| Property definitions | `POST /api/v1/properties` (`context=org`) | `create:properties` |
| Org property values | `GET\|PATCH /api/v1/organizations/{org_code}/properties`; `PUT …/properties/{property_key}` | `read:organization_properties` / `update:organization_properties` |

Create is **singular** `/organization`. List is **plural** `/organizations`. Member routes are plural `/organizations/{org_code}/users`.

GET organization returns `is_default`, `is_auto_membership_enabled`, `is_suspended`, and `suspended_on`. Use those fields as the inspect source of truth.

## Suspend and unsuspend

Dashboard: organization details → Organization status → Suspend / Unsuspend.

API: `PATCH /api/v1/organization/{org_code}` with `{ "is_suspended": true }` or `false`. Scope `update:organizations`.

When suspended:

- Authorization returns `organization_suspended` and users see an auth error.
- Refresh and access tokens scoped to that organization are invalidated.
- Active end-user sessions for that organization end.
- Dashboard shows a Suspended badge and a warning banner.

The **default organization cannot be suspended**. API error: `DEFAULT_ORGANIZATION_CANNOT_BE_SUSPENDED`. Suite safety policy also blocks deleting it. See [REFERENCES.md](REFERENCES.md).

Unsuspend restores login. Previously revoked tokens are not restored. Users re-authenticate.

Member removal does **not** revoke tokens. See [MEMBERSHIP.md](MEMBERSHIP.md): Issued tokens after membership change.

## Delete

Dashboard three-dots → Delete organization, or `DELETE /api/v1/organization/{org_code}` (`delete:organizations`). Irreversible. Removes members from this org (not from Kinde), plus org settings, flags, and org data. Users who also belong elsewhere keep those memberships. Reassign or export first. The suite blocks this operation when `is_default` is true.

## Management MCP

The organization surface is get-only. It may inspect organizations, membership, assignments, and organization feature flags; it does not create or mutate organizations, users, membership, or organization property values. Catalog/config creates do not change this boundary. Invoke `kinde-mcp` and consume its operations matrix for exact tools and scopes; if unavailable, mark MCP work blocked.

## Account API

Use the user access token for the signed-in person only. Official organization-adjacent job: generate the self-serve portal link (`/account_api/v1/portal_link`). It is not an admin provisioner.
