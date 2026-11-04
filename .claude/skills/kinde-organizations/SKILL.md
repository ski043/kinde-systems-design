---
name: kinde-organizations
description: >-
  Kinde organizations: implements organization lifecycle against the
  kinde-b2b tenant contract. Use when creating or configuring Kinde tenants
  or workspaces; managing membership or invitations; switching or suspending
  organizations; setting organization policies, default roles, or SSO/portal
  touchpoints; or when another Kinde skill needs organization lifecycle work.
---

# Kinde Organizations

Runs **organization lifecycle**: create, configure, populate, switch, and suspend Kinde organizations after a tenant contract exists. This skill consumes that contract; it does not invent a second tenancy model.

## Stance

Inspect the live Kinde business, environment, application stack, onboarding mode, and authorized control plane before mutating anything. Dashboard clicks, Management API writes, and MCP creates are mutations: without authorization record `planned`; with authorization apply and capture observed evidence.

Dated sources and first-party conflicts live in [REFERENCES.md](REFERENCES.md). Read it before relying on a product claim that is not already recorded in a sibling file, and whenever two official pages disagree.

## Guardrails

- **Contract first.** Actively invoke `kinde-b2b` and consume its filled tenant contract before organization work. If that skill is unavailable, stop at a blocked contract handoff.
- **Default organization.** Every business has one. Its `org_code` cannot be changed and it cannot be suspended (`DEFAULT_ORGANIZATION_CANNOT_BE_SUSPENDED`). Suite safety policy blocks deleting it. Auto-assign of unknown sign-ups into it can be turned off, and usually should be for B2B.
- **MCP inspects.** Management MCP may list and get organizations and their users. It does not create, update, or delete organizations or members. Broader mutations use the Management API. Details: [LIFECYCLE.md](LIFECYCLE.md).
- **Assignment, not catalog.** Assigning roles/permissions to members lives here (ids on direct endpoints, keys on bulk membership). Role/permission *definitions* belong to `kinde-authorization`.
- **Adapter handoff.** Actively invoke the loaded framework adapter for auth-URL and SDK helpers (`is_create_org`, `org_code`, `org_name`, `createOrg`, switcher login). If no adapter is available, mark implementation blocked. This skill names parameters; it does not emit framework snippets.

## Read map

- [CREATION.md](CREATION.md): create paths, default organization, external IDs, property definitions vs values, environment scope, onboarding modes. Read in steps 1 and 3 when creating or choosing how tenants appear.
- [MEMBERSHIP.md](MEMBERSHIP.md): add, import, invite, remove, move, multi-org, and switch. Read in step 3 when changing who belongs where.
- [POLICIES.md](POLICIES.md): access policies, default roles, branding, enterprise connections, self-serve portal. Read in step 3 when configuring those touchpoints.
- [LIFECYCLE.md](LIFECYCLE.md): plane routing, official create/update/suspend/delete methods and scopes, Account API, MCP limits. Read in step 3 before naming a plane or calling an API.
- [REFERENCES.md](REFERENCES.md): dated sources and conflicts. Read when a product claim might have drifted or official pages disagree.

## Workflow

Complete the steps in order. A step is unfinished until its gate is observable.

### 1. Inspect the live surface

Read the product, repo, existing Kinde config, and the authorized environment. Fill this inventory; mark gaps `unknown`.

```
- Kinde business / environment:
- Detected orgs (incl. default org_code):
- Default-org auto-assign observed: [on | off | unknown]
- Allow organization creation on sign-up: [on | off | unknown]
- Invitations + invite application: [on/off; app name | unknown]
- Advanced-organization / plan entitlement visible (only if a gated control is in scope): [yes | no | unknown | not applicable]
- Stack / loaded adapter:
- Onboarding mode in product copy: [self-serve | invitation | sales/admin | domain JIT | mix | unknown]
- Authorized planes this run: [inspect-only | dashboard | Management API | Account API | application/SDK]
- Tenant contract present: [yes: source | no]
```

**Gate:** every inventory line is filled. Missing items are `unknown`, not guessed. The authorized-planes line matches what the user allowed. Observed policy values beat remembered defaults.

Do not start step 3 from an inventory that still says `unknown` for business, environment, or authorized planes.

### 2. Consume the tenant contract

Invoke `kinde-b2b`, run its contract and threat-model steps, and consume that document as authoritative. If `kinde-b2b` cannot be invoked, stop with `blocked: tenant-contract owner unavailable`. Do not reconstruct its contract from generic docs.

Confirm these organization-lifecycle fields are concrete (or `undecided` with the blocking question):

```
- Isolation model + default-org auto-assign:
- Organization mapping (one org = one …):
- Onboarding mode (mix only when each path is named):
- Invitations (enabled; invite application; who may invite):
- Multi-org users + switch behavior:
- Enterprise SSO (org-owned vs shared) + HRD:
- No-org session routes:
```

**Gate:** the contract exists, those fields are filled, and this run will not contradict them.

### 3. Plan or implement the lifecycle change

Open the sibling that matches the remaining work. Create or onboard → [CREATION.md](CREATION.md). Members, invites, or switch → [MEMBERSHIP.md](MEMBERSHIP.md). Policies, default roles, branding, portal, or connections → [POLICIES.md](POLICIES.md). Plane choice, Management/Account/MCP calls, suspend, or delete → [LIFECYCLE.md](LIFECYCLE.md).

Record every remaining task before acting:

```
| Task | Plane | Owner invoked | Outcome (planned | applied + observed evidence | blocked) |
```

Actively invoke `kinde-authorization` for catalog work and the loaded framework adapter for SDK work. An unavailable owner is `blocked`. Management MCP is not an organization provisioner.

Before relying on per-org policy override, org default roles, domain JIT, org-owned SSO, or portal member/SSO functions, recheck [REFERENCES.md](REFERENCES.md) and confirm the live entitlement. A missing dashboard control is evidence the path is `blocked`, not an invitation to improvise.

**Gate:** every remaining task has a row. Without mutation authorization, its outcome is `planned`. With authorization, it is `applied + observed evidence` and names the official method. SDK work was handled by the loaded adapter or marked blocked. Gated controls were observed, not assumed.

### 4. Verify

Run the test matrix against the live environment when this run changed Kinde or app state, and against the contract when the run is design-only.

Evidence is an observed token claim, API/dashboard field, auth error, or denied request, not an intention. Mark a row `blocked` when the authorized plane or live plan cannot produce that observation.

**Gate:** every matrix row is `pass`, `fail`, `blocked`, or `not applicable: excluded by contract`, with evidence for every in-scope row.

## Test matrix

| Case | Observable target |
| --- | --- |
| Self-serve create | After `is_create_org` (optional `org_name`) and env "Allow organization creation on sign up", a new org exists and the B2B contract's tenant source resolves the creator to it, not the default org unless intended. |
| Sales-led create | Dashboard, import, or `POST /api/v1/organization` created the org. Self-serve create-org is off or unused. Creator/admin membership matches the contract. |
| Invite join | Invitee lands in the invited org; invited email cannot be swapped; invite sign-up still works when environment self-sign-up is off. |
| Multi-org switch | Re-auth into the target organization. The B2B contract's trusted tenant source resolves that target; a tab still holding prior context is treated as stale. |
| No-org user | The B2B contract's no-membership discriminator fires. Tenant APIs deny; only the contract's no-org routes succeed. |
| Default org | Auto-assign matches the contract. Default `org_code` is unchanged. Suspend is rejected (`DEFAULT_ORGANIZATION_CANNOT_BE_SUSPENDED` or dashboard equivalent). |
| Suspended org | Login to that org fails (`organization_suspended`). Org-scoped access and refresh tokens are revoked and sessions end. Unsuspend requires a new login; old tokens stay invalid. Distinct from member removal, which does not revoke issued JWTs. |
| Removed-member stale token | After removal, the previously issued access token remains valid until expiry or explicit revocation; claim-cache invalidation and issuing a newer token do not revoke the old JWT. A newly issued token omits that org, while sensitive APIs check membership in real time until older tokens expire. |
| Role assignment | Catalog lives in `kinde-authorization`. Direct assign/remove uses `role_id` / `permission_id`. Bulk membership bodies may use role/permission keys. Creator and new-member defaults match the live entitlement. |
| Domain JIT / SSO | JIT only when auto-membership, auto-join domain list, and a matching bare allowed domain are all on. HRD is routing, not authorization. API still checks membership and the B2B tenant source. |
| Cross-tenant denial | A verified credential for org A cannot read or mutate org B. Client-supplied slugs are checked against the B2B contract's trusted tenant source and rejected on mismatch. |

## Handoff names

Do not link files outside this folder. Invoke `kinde-b2b` for the tenant contract, `kinde-authorization` for the role/permission catalog, `kinde-billing` for plans, `kinde-mcp` for MCP work, and the loaded framework adapter for SDK/auth URLs. If an owner is unavailable, mark its handoff blocked rather than reimplementing that domain.
