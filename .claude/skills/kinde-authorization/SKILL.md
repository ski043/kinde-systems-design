---
name: kinde-authorization
description: >-
  Kinde authorization: designs, provisions, assigns, enforces, refreshes, and
  verifies permission-first RBAC for organizations. Use when designing roles or
  permissions; provisioning or assigning organization access; enforcing
  permission checks in APIs or application code; troubleshooting claims or
  stale access; or when another Kinde skill needs authorization work.
---

# Kinde Authorization

Consumes a **tenant contract** from `kinde-b2b`. Produces an **authorization contract**: the permission catalog, role matrix, assignment matrix, and enforcement matrix for that tenant. Application and API decisions target permission keys, not role names.

## Stance

Treat the run as design-only until the user authorizes implementation. Catalog writes are business-wide; plan them before mutating a shared business. Actively invoke the loaded framework adapter for framework syntax; absent adapter blocks implementation. Dated sources and official conflicts live in [REFERENCES.md](REFERENCES.md).

Generic JWT, tenant-binding, missing-organization, machine-credential, and plane-setup rules stay in `kinde-b2b`. This skill owns catalog, assignment, defaults, claim freshness, and permission-key enforcement.

## Guardrails

- **Permission keys.** Server decisions use verified permission keys for the active organization. Roles are a management grouping.
- **Shared catalog.** Role and permission definitions are business-level. A write in a non-production environment is the same catalog in production.
- **Membership first.** Roles and permissions assign only to a user who already belongs to that organization.
- **MCP writes stop at create.** Management MCP may create roles and permissions and read selected relationships. It does not attach permissions to roles or assign roles or permissions to users. Broader writes use dashboard or Management API. Details: [PLANES.md](PLANES.md).
- **Separate mechanisms.** User permission keys, machine scopes, feature flags, and billing entitlements are different. Invoke the owning skill for flags or billing; an unavailable owner blocks that decision branch. Details: [ENFORCEMENT.md](ENFORCEMENT.md).

## Read map

- [CATALOG.md](CATALOG.md): keys, roles as groupings, environment sharing, blast radius. Read in step 3.
- [PLANES.md](PLANES.md): catalog create, attach, assign, defaults, verified Management API table, import shapes. Read in steps 4–5.
- [ENFORCEMENT.md](ENFORCEMENT.md): audience, claims, freshness, `scope` vs `scp`, null-safe server checks. Read in steps 6–7.
- [SYSTEM.md](SYSTEM.md): verified portal, billing, member, and API-key system permissions. Read when those keys appear.
- [REFERENCES.md](REFERENCES.md): dated sources and conflicts. Read before a product claim not already recorded, or when official pages disagree.

## Workflow

Always complete step 1, then run only the steps selected by its branch map and step 8. A step is unfinished until its gate is observable.

### 1. Invoke tenancy and select one job

First, actively invoke `kinde-b2b` and consume its filled tenant contract. If it cannot be invoked, stop with `blocked: tenant-contract owner unavailable`; do not reconstruct that contract. Copy its isolation, partition/tenant source, no-membership behavior, multi-org users, machine credential classes, and listed permission keys.

Then select one job:

```
- Job: [design | provision | assign | enforce | troubleshoot]
- Branch steps:
  - design: [2, 3]
  - provision: [3 when design is missing, 4, 5-provision]
  - assign: [4, 5-assign]
  - enforce: [2, 6, 7]
  - troubleshoot: [6, 7]
```

**Gate:** the tenant contract is present, exactly one job is selected, and unselected branches are `not applicable: excluded by job`.

### 2. Inventory access decisions: design/enforce

List every privileged action the product must allow or deny. Mark each as a user permission key, a machine scope, a feature flag, or a billing entitlement.

```
| Decision | Mechanism | Resource owner | Missing today |
```

**Gate:** every privileged action has a mechanism. Flag and entitlement owners were invoked or marked blocked; neither mechanism is folded into permission keys.

### 3. Design the permission catalog and roles: design/provision

Using [CATALOG.md](CATALOG.md), fill the permission catalog and role matrix templates below. Keys are stable. Roles only group keys.

**Gate:** every inventoried user-permission decision has a key. Every role lists its keys. Blast radius of a shared-catalog write is recorded.

### 4. Select the control plane: provision/assign

Using [PLANES.md](PLANES.md), name the plane for catalog create, attach, assign, defaults, and enforcement. Confirm the live entitlement before relying on a gated control.

```
| Action | Plane | Scope or tool | Outcome (planned | applied + observed evidence | blocked) |
```

**Gate:** every remaining action has a row. Management MCP is not listed as an attach or assign plane.

### 5. Provision or assign: selected mutation branch

For `provision`, plan or, when authorized, create catalog objects and attach permissions to roles. For `assign`, require membership evidence and plan or apply assignment per user per organization. Defaults and org-creator roles are named, not implied. System keys: [SYSTEM.md](SYSTEM.md).

Record each mutation as `planned` when implementation is not authorized, or `applied + observed evidence` when authorized. **Gate:** every in-scope provision/assignment row has one of those outcomes; each assignment names user, organization, membership evidence, roles, and direct permissions. Unassigned memberships are explicit.

### 6. Enforce or troubleshoot on the server

Using [ENFORCEMENT.md](ENFORCEMENT.md), fill or diagnose the enforcement matrix. Register each protected product API, request that audience, verify exact `aud`, then require the permission key. Consume the tenant source explicitly named by the B2B contract; when `org_code` is missing and no such source is named, deny and mark implementation blocked. Invoke the loaded framework adapter for stack syntax; absent adapter blocks implementation.

**Gate:** every user-permission decision has a server check on the registered audience. UI-only checks are marked presentation.

### 7. Resolve claim freshness: enforce/troubleshoot

Name how each change reaches tokens. Direct user, membership, assigned-role, or assigned-permission writes invalidate Kinde's claim cache; the next newly issued access token can carry current claims. For inherited changes, the backend invokes the Management API `refreshUserClaims` operation (`update:user_refresh_claims`) for each affected user; the application/SDK then obtains a new token. Issued JWTs stay immutable. Immediate-sensitive checks use a trusted real-time lookup, revoke, or a short access-token lifetime.

**Gate:** each enforcement row names cache-invalidating versus inherited, whether `refreshUserClaims` is required, and the fallback while the current JWT is still valid.

### 8. Verify

Run the test matrix against the contract, and against the implementation when this run is authorized to change Kinde or code.

**Gate:** every matrix row is `pass`, `fail`, `blocked`, or `not applicable: excluded by job/contract`, with evidence for every in-scope row.

## Authorization contract

Copy and fill the matrices required by the selected job. Mark excluded matrices `not applicable: excluded by job`; every in-scope field needs a value or `undecided` plus the blocking question.

```markdown
# Authorization contract

## Permission catalog
| Key | Name | Description | Auto-on-new-role | System |

## Role matrix
| Role key | Name | Permission keys | Default new users | Org-creator | Per-org default | Assignment permission |

## Assignment matrix
| User | Org | Membership | Roles | Direct permissions | Plane |

## Enforcement matrix
| Decision | Permission key | Audience | Credential | Missing-claim behavior | Refresh |
```

## Test matrix

| Case | Observable target |
| --- | --- |
| No-org or stripped `org_code` | Consume the B2B contract's explicit tenant source. Missing `org_code` denies tenant actions unless that exact trusted server-side source and no-membership discriminator are named; otherwise implementation is blocked. |
| Same user, different orgs | The user holds different roles or permissions in org A and org B; each token carries only the active org. |
| Missing `permissions` | A verified token without a `permissions` array is denied; the check does not throw. |
| UI bypass | A direct API request lacking the required key is denied even when the UI would hide the action. |
| Wrong API audience | A verified token whose `aud` is not this registered API is denied, even when the permission key matches. |
| Stale JWT after direct assign | After a direct user, membership, role, or permission change, the existing JWT still has the prior grant; a later refresh after cache invalidation can carry the new claims. |
| Inherited role-permission change | Adding a permission to a role does not update assignee tokens until `refreshUserClaims` and a new access token. |
| Role-definition blast radius | Editing or deleting a role or permission is a shared-catalog write; isolate catalogs only with separate businesses. Role inheritors require `refreshUserClaims`; direct assignees follow the direct-write cache-invalidation path. |
| Direct permission | A user granted a permission key without the grouping role is allowed; a user with only the role name and not the key is not. |
| Global default role | A new user who joins an organization during signup receives the catalog default role (`is_default_role` / Assign to new users). A no-org user receives no assignment until membership exists. |
| Per-org default role | An existing user who joins an organization receives that org's default roles only when the live entitlement and advanced-org activation allow it. |
| Machine scope vs user permission | An M2M credential is authorized on granted `scope`, not on a user permission key or requested `scp`. An organization API key uses verification `scopes`. |
| Cross-tenant resource | A verified credential for org A is denied org B's resource even when the permission key matches. |

## Handoff names

Do not link files outside this folder. Invoke `kinde-b2b` first for the tenant contract, `kinde-organizations` for organization lifecycle and membership assignment, `kinde-billing` for plans/entitlements, `kinde-mcp` for MCP work, and the loaded framework adapter for framework files. If an owner is unavailable, mark that handoff blocked rather than reimplementing its domain.
