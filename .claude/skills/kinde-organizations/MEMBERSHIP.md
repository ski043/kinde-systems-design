# Membership

Who belongs to an organization, how they join, and how they switch. Partition and no-org rules live in `kinde-b2b`; this file only records membership mechanics.

## Membership facts

A user can belong to many organizations and hold different roles and permissions in each. Assignments are per organization. A user with no organization cannot be given roles or permissions.

Sign-in without `org_code` on the auth request:

1. One membership → signed into that organization.
2. Several memberships → organization selector, unless **Sign users in to most recent org** is on.
3. Zero memberships → signed in without an organization. When the B2B contract retains `org_code`, the claim is omitted; an intentional stripping design uses that contract's no-membership discriminator.

Passing `org_code` selects that organization (and its branding) and skips the selector. Home-realm discovery overrides this; see [POLICIES.md](POLICIES.md).

## Add, import, remove

| Action | Dashboard | Management API | Notes |
| --- | --- | --- | --- |
| Add existing users | User profile: check the org | `POST /api/v1/organizations/{org_code}/users` (`create:organization_users`) | Body: user `id` plus optional role/permission **keys**. |
| Import | Re-import users with `external_organization_id` matching the org's external ID | Same as add after users exist | Import orgs first, then users. |
| Invite | Organization self-serve portal Members | `POST /api/v1/organization/{org_code}/invites` (`create:organization_invites`) | Different from add. See Invitations. |
| Patch members | User profile checkboxes | `PATCH /api/v1/organizations/{org_code}/users` (`update:organization_users`) | `operation: delete` removes. Optional role/permission **keys** on add/update rows. |
| Remove one | Uncheck the org | `DELETE /api/v1/organizations/{org_code}/users/{user_id}` (`delete:organization_users`) | User remains in Kinde and in other orgs. Issued JWTs are not rewritten. |

Adding a user in the dashboard or via `AddOrganizationUsers` is membership, not a Kinde invitation email. Welcome mail for those adds is a product/webhook concern (`user.created` with `source` `admin` or `api`).

Management MCP can list org users and their roles/permissions. It cannot add, update, or remove them.

## Move is add, then remove

There is no atomic move. Source assignments do not transfer.

1. Add the user to the destination (`POST …/users`, optional role/permission keys in that body).
2. Verify destination membership and assignments (GET org users / org-user roles).
3. Remove the user from the source (`DELETE …/users/{user_id}` or PATCH `operation: delete`).

## Issued tokens after membership change

Member remove, direct role/permission assignment, and similar UI/API user updates **do not rewrite already-issued JWTs**. Those direct writes invalidate Kinde's claim cache so the next *newly issued* access token can reflect current membership. Inherited role/flag changes require the backend Management API `refreshUserClaims` operation and then a newly issued token. Invoke `kinde-authorization` for the exact operation and scope; if unavailable, block that refresh handoff.

A refresh grant may still return the same unexpired access token (official access-token page). Confirm live refresh behavior. See [REFERENCES.md](REFERENCES.md).

For sensitive APIs, check membership in real time (Management API, or Account API for the signed-in caller) or keep access-token lifetime short.

**Suspension is different:** it revokes org-scoped access and refresh tokens and ends those sessions. Member removal does not.

## Invitations

Invitations are organization membership, not Kinde-team invites.

- Environment **Allow invitations** plus an **Invite application** gate the flow. When invitations are off, portal invite UI is hidden and accepting an existing invite is blocked.
- Portal invite requires `org:write:members`. A member can assign only roles they are allowed to grant.
- Management API create: email + role **keys** required; `send_email` defaults to **false**. Directory-sync organizations reject invite creates. Change membership in the upstream IdP.
- Assignment authority: roles that require an assignment permission cannot be granted unless the caller (or the user the token represents) holds that permission. On Kinde-hosted plans, roles outside `owner` / `admin` also require the `extended_roles` entitlement.
- Limits: a rolling 24-hour create cap and a cap on active (non-accepted, non-revoked) invites. Excess → **429**. Missing authority / entitlement → **403**. Handle both explicitly; do not retry 403.
- If `send_email` is false, securely deliver the returned `invite.invite_link` (do not log it). If true, confirm `invite.is_sent`.
- Reconcile with `GET /api/v1/organization/{org_code}/invites` (`read:organization_invites`): pending only by default; `include_revoked` / `include_accepted` when needed. Read one invite with `GET …/invites/{invite_code}`.
- Invitee experience: name/email prefilled, email locked, phone-instead hidden. Registration works even when environment self-sign-up is off. Organization-level auto-membership still applies when an org is in context.
- Accept via the invite link (invite application). Invoke the loaded framework adapter for `invitation_code` handling (some SDKs also send `is_invitation=true`); absent adapter blocks implementation.
- Error copy is deliberately vague (disabled, unusable/expired/used, email mismatch). Treat an invite that creates a user in the default org, or in no org, as a failed path.
- Revoke: portal Invitations list, or `DELETE /api/v1/organization/{org_code}/invites/{invite_code}` (`delete:organization_invites`).

## Switch

The active organization comes from the B2B contract's trusted tenant source: verified access-token `org_code` by default, or its explicit server-side resolver. Switching is a new authentication into the target `org_code`; after the switch, bind data to that contract source.

Membership lists for a switcher come from the ID token: `org_codes`, and optionally the `organizations` `{id, name}` array when that additional claim is enabled. Those lists are not a data partition.

The refresh-token cookie is shared across tabs on the same domain. Other tabs pick up the new organization on their next refresh. Treat prior tab context as stale: verify expiry and the B2B contract's tenant source on every request.

## Role assignment

Invoke `kinde-authorization` to design the catalog. If unavailable, block that handoff. Assign on this organization only.

| Operation | Identifier |
| --- | --- |
| `POST /api/v1/organizations/{org_code}/users/{user_id}/roles` (`create:organization_user_roles`) | Body `role_id` |
| `DELETE /api/v1/organizations/{org_code}/users/{user_id}/roles/{role_id}` (`delete:organization_user_roles`) | Path `role_id` |
| `POST /api/v1/organizations/{org_code}/users/{user_id}/permissions` (`create:organization_user_permissions`) | Body `permission_id` |
| `DELETE /api/v1/organizations/{org_code}/users/{user_id}/permissions/{permission_id}` (`delete:organization_user_permissions`) | Path `permission_id` |
| Bulk add / patch membership | `roles` / `permissions` arrays of **keys** |

Resolve ids from the Roles / Permissions catalog endpoints. Creator-default and new-member-default flags are named in [POLICIES.md](POLICIES.md). For an API-created organization, assign the first admin with the direct organization-user-role endpoint (`role_id`). There is no Management API setter for “assign this role to org creators.”
