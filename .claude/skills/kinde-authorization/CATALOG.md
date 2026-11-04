# Permission catalog

Authoritative rules for keys and roles. Assignment and planes live in [PLANES.md](PLANES.md). Token checks live in [ENFORCEMENT.md](ENFORCEMENT.md).

## Permission-first

A permission is the unit the product codes against: a unique **key**, plus a name and description. Kinde recommends the convention `[action_type]:[functional_area]` (example `read:reports`). It is not required syntax. Pick one convention and keep it.

Roles group permissions for management. A user can hold several roles in one organization. The same user can hold different roles in different organizations. Code never treats a role name as the API decision.

Create permissions first, then roles. A permission can be marked to attach automatically when a new role is created. Use that only for keys every role should carry.

Do not rename a key after it is in use. A key change breaks every check that referenced the old key. Delete removes the permission from every user who holds it directly and from every user who holds it through a role. That cannot be reversed.

## Shared business catalog

Role and permission *definitions* (name, key, description, included permissions) live at the **business** level. They are not isolated per environment. A key created while working in development is the same key in staging and production.

Organization records, users, applications, and token issuers are environment-scoped. Assignments therefore differ per environment even though the catalog does not.

To experiment on a catalog without touching production, use a separate Kinde business. Seeding assignments into another environment still uses the same catalog keys.

## Role definition blast radius

| Change | Who it hits | When tokens update |
| --- | --- | --- |
| Edit a role's included permissions | Every user assigned that role, in every organization, in every environment of this business | Inherited: `refreshUserClaims` per affected user, then a new access token. See [ENFORCEMENT.md](ENFORCEMENT.md): Freshness |
| Delete a role | The role and its permissions are removed from every assignee | Immediate on the catalog; tokens follow the inherited path unless the user's own assignment also changed |
| Edit or delete a permission | Every direct assignee and every role that included it | Direct assignees: claim cache invalidates. Role inheritors: `refreshUserClaims` |

Record this blast radius in the authorization contract before a catalog mutation.

## What belongs in the catalog

| Include | Leave out |
| --- | --- |
| Product actions the API must allow or deny | Feature-flag keys (release/config) |
| Verified Kinde system permission keys the product actually grants ([SYSTEM.md](SYSTEM.md)) | Billing entitlement keys (plan features) |
| Stable keys the server will check | Machine scopes (M2M / API-key credentials) |

A user may also hold **direct permissions** on top of roles. The catalog lists keys; the assignment matrix records whether a grant is via role, direct, or both.

## Role keys

Roles also have keys. Those keys are for management and, if the `roles` claim is enabled, for inspection. They are not the enforcement target. Prefer not to edit a role key once it is in use.
