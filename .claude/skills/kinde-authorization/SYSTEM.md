# System permissions

Kinde-provided keys that gate **self-serve portal** functions for organization members. They attach to custom roles the same way product permissions do. Only keys verified on official pages or the Management API spec are listed. Do not invent `org:write:sso` or other portal keys because a portal section exists.

Invoke `kinde-organizations` for portal/invitation lifecycle and `kinde-billing` for billing behavior tests. An unavailable owner blocks that slice. This file only names verified keys and how they are granted.

## Verified keys

| Key | Official meaning | Source |
| --- | --- | --- |
| `org:write:billing` | Update organization billing details | Portal docs; B2B billing-role guide |
| `org:read:billing` | Source-ambiguous: picker says “Read billing details”; description says “View plan and update card details” | Management API `system_permissions` schema |
| `org:write:members` | Open the portal Add-member flow (invite + assign roles) | Portal docs |
| `read:org:authentication` | View API keys created by the organization | Self-serve API keys docs |
| `write:org:authentication` | Create, rotate, and revoke organization API keys | Self-serve API keys docs |

Key spelling is not uniform (`org:write:billing` vs `read:org:authentication`). Use the documented string.

Account API entitlement visibility prefers a personal plan; if none, it can return the organization's plan only when the caller has `org:read:billing`. That surface is self-serve visibility, not a universal organization-plan server gate. Invoke `kinde-billing` for the exact API and to test plan changes and payment-method changes separately; do not classify `org:read:billing` as view-only.

## Grant path

Include system permissions on a custom role, then assign that role to a member of the organization.

| Plane | Capability |
| --- | --- |
| Dashboard | Role dialog → System permissions |
| Management API | Discover keys with `GET /api/v1/system_permissions` (`read:system_permissions`); read/update a role with `GET|PATCH /api/v1/roles/{role_id}/system_permissions` (`read:role_system_permissions`, `update:role_system_permissions`) |
| Management MCP | None. No system-permission tool |

For a billing-admin role, this skill defines and provisions `org:write:billing`. Invoke `kinde-organizations` for **Assign to the creator** or other creator/member assignment. See [PLANES.md](PLANES.md) for the creator-default gap on `CreateRole`.

## Assignment gating

Portal assignment always requires `org:write:members`. `assignment_permission_id` on `CreateRole` / `UpdateRoles` is optional. When it is set, the inviter also needs that permission to grant the role; roles they cannot grant appear disabled. When it is null / `NO_PERMISSION_REQUIRED`, `org:write:members` is the only documented portal gate.

Use a configured assignment permission for least privilege: the inviter cannot mint a broader role than they hold.

## Plan and environment gates

Confirm the live billing entitlement and dashboard, not a hard-coded plan name. Dedicated pages and the pricing table disagree on some gates. See [REFERENCES.md](REFERENCES.md).

- Organization portal functions (members, API keys, SSO) are plan- or beta-gated.
- Per-organization portal customization is an advanced-organization entitlement.
- MFA in the organization portal is documented as coming soon. No system key verified.

If a system permission is not visible when editing a role, do not put it in the catalog.
