# Creation and onboarding

How organizations come into existence. Isolation rules and the tenant-contract template live in `kinde-b2b`; this file only records create paths and onboarding modes.

## Shape

Organizations are **flat** and **environment-scoped**. They do not nest. One Kinde business holds one flat org set; separate products use separate businesses. Dashboard copy between environments is not supported; Management API seeding is.

Every business has one **default organization**. Its `org_code` cannot be changed. It cannot be suspended (`DEFAULT_ORGANIZATION_CANNOT_BE_SUSPENDED`). Suite safety policy blocks deleting it. Its display name can change. Auto-assigning unknown sign-ups (and API/import users with no org) into it can be turned off. Typical for B2B so strangers do not land in a catch-all tenant.

`org_code` (`org_xxxx`) is the unique Kinde id. An optional **external organization ID** is the caller's id; import users by matching that value.

**Properties are two layers.** Business-level *definitions* (`context=org`, dashboard Settings → Data management → Properties) are catalog. Per-organization *values* are `GET|PATCH /api/v1/organizations/{org_code}/properties` and `PUT …/properties/{property_key}` (`read:organization_properties` / `update:organization_properties`). Management MCP can create a property definition only; it cannot set org values. Invoke `kinde-mcp` for the exact tool. See [LIFECYCLE.md](LIFECYCLE.md).

## Create paths

Official docs name three ways. Pick the path that matches the contract's onboarding mode. Management MCP is not a create path.

For the selected path, record `planned` when mutation is not authorized, or `applied + observed evidence` when it is.

| Path | When | How |
| --- | --- | --- |
| Self-serve auth | PLG: user creates a workspace | Environment policy **Allow organization creation on sign up** is on (this is the default when `is_create_org` is sent). The app starts the create-org auth request: `is_create_org`, optional `org_name`. Invoke the loaded framework adapter for its `createOrg` helper; absent adapter blocks implementation. |
| Dashboard / import | Sales-led, migration, bulk | Dashboard **Add organization** (name + optional external ID). Bulk: CSV `name,id` via **Import organizations** *before* importing users. Import can add or update. |
| Management API | Automation, seeding | `POST /api/v1/organization` (singular) with `create:organizations`. Required: `name`. Useful optionals: `external_id`, `handle`, `is_auto_membership_enabled`, branding colors. See [LIFECYCLE.md](LIFECYCLE.md). |

Self-serve create needs both the environment policy *and* the auth-URL flag. The policy alone does not create an org on a normal register.

## Onboarding modes

Pick the mode that matches the product. Mix only when each path is named in the contract.

| Mode | Kinde lever | Typical policy |
| --- | --- | --- |
| Self-serve workspace | Create-org auth path above | Allow self-sign-up + allow organization creation on sign-up. Default-org auto-assign usually off. |
| Invitation | Members invite teammates | Environment **Allow invitations** + invite application. See [MEMBERSHIP.md](MEMBERSHIP.md). |
| Sales / admin provision | Dashboard, import, or Management API | Keep self-serve org creation off. Add members after the org exists. |
| Domain JIT | Known email domains join an org | All of: auto-membership, auto-join domain list, matching bare allowed domain. See [POLICIES.md](POLICIES.md). |

"B2B" does not imply self-serve or sales-led. Official pages disagree on which is "usual"; the contract picks one. See [REFERENCES.md](REFERENCES.md).

## After create

1. Record the new `org_code` (and external ID if used).
2. Confirm the creator or first admin is a member of *this* org and the B2B contract's tenant source resolves it, not an accidental default-org landing.
3. Self-serve auth create may receive dashboard **Assign to the creator** roles automatically. API- or dashboard-created orgs do not: assign with `POST /api/v1/organizations/{org_code}/users/{user_id}/roles` and `role_id`. There is no API setter for creator-default.
4. Apply policies, org default roles, branding, and connections from [POLICIES.md](POLICIES.md) when the contract names them.
5. Invoke `kinde-authorization` for role-catalog gaps. If unavailable, block that handoff. Assign on this organization only.
