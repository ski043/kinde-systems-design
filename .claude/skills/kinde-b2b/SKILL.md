---
name: kinde-b2b
description: >-
  Kinde B2B tenancy: owns the shared isolation, partition, active-tenant, and
  tenant-credential contract for organization, default-organization/B2C-shaped,
  and dedicated-business models. Use when choosing a Kinde tenancy model,
  binding data to org_code or another trusted tenant source, defining no-org
  behavior or tenant credentials, or before organization, authorization,
  billing, MCP, or framework work needs tenant boundaries.
---

# Kinde B2B

Produces a **tenant contract** for isolation, partitioning, active/no-tenant behavior, and tenant credentials. Conditional annexes carry identity, authorization, machine-access, and control-plane decisions only when those branches are in scope. Owning skills consume this contract rather than redefining its tenancy invariants.

## Stance

Treat the run as design-only until the user asks to implement. Inspect the application stack and actively invoke the loaded framework adapter for framework work. If no adapter is available, mark that implementation handoff `blocked`; keep the tenant contract as the completed design artifact.

Dated sources and first-party conflicts live in [REFERENCES.md](REFERENCES.md). Read it before relying on a product claim that is not already recorded in a sibling file, and whenever two official pages disagree.

## Guardrails

- **Tenant source.** Retain verified access-token `org_code` by default. An intentional token workflow removal requires the contract to name a trusted server-side tenant/membership resolver and a no-membership discriminator; otherwise tenant implementation is blocked. Client hints never qualify. Details: [TENANCY.md](TENANCY.md).
- **Exact API audience.** Register every protected product API, request its audience, and verify the exact `aud` before authorization. Details: [AUTHORIZATION.md](AUTHORIZATION.md).
- **Permission and scope split.** User requests use verified permission keys; M2M uses granted `scope`; organization API keys use verification-response `scopes`. Details: [AUTHORIZATION.md](AUTHORIZATION.md).
- **Credential class.** A global M2M credential and a user API key without contract-defined tenant resolution are not tenant credentials. Details: [MACHINE-ACCESS.md](MACHINE-ACCESS.md).

## Read map

- [TENANCY.md](TENANCY.md): isolation models, Kinde mapping, data partition, missing organization, threats, and the contract template. Read in steps 1–4.
- [IDENTITY.md](IDENTITY.md): membership, onboarding, invitations, active organization, enterprise SSO, home-realm discovery. Read in step 3 when filling those contract fields.
- [AUTHORIZATION.md](AUTHORIZATION.md): role/permission catalog vs assignment, JWT checks, server enforcement. Read in step 3 when filling authorization, and in step 6 for permission rows.
- [MACHINE-ACCESS.md](MACHINE-ACCESS.md): user tokens, global M2M, org-scoped M2M, organization API keys. Read in step 3 when filling machine access, and in step 6 for credential rows.
- [CONTROL-PLANES.md](CONTROL-PLANES.md): dashboard, Management API, Account API, Management MCP, MCP connections, adapter handoff. Read in step 5.
- [REFERENCES.md](REFERENCES.md): dated sources and conflicts. Read when a product claim might have drifted or official pages disagree.

## Workflow

Complete the steps in order. A step is unfinished until its gate is observable.

### 1. Inspect product and deployment

Read the product, repo, and existing Kinde config. Fill this inventory; mark gaps `unknown`.

```
- Customer: [person | company | both]
- Workspace word: [organization | workspace | team | account | …]
- Environments / deploys:
- Multi-org users: [yes | no | unknown]
- Stack:
- Existing Kinde business / env / orgs:
```

**Gate:** every inventory line is filled. Missing items are `unknown`, not guessed.

### 2. Choose the isolation model

Select one isolation model from [TENANCY.md](TENANCY.md): Isolation models. Challenge labels that do not match the product: many-company SaaS is organizations; environments are SDLC; organizations are flat.

```
- Chosen model:
- Rejected: [model → product fact]
- Default org auto-assign: [on | off]
```

**Gate:** chosen model, rejected alternatives with ruling-out facts, and default-organization auto-assign are all recorded.

### 3. Write the tenant contract

Fill the always-required core in [TENANCY.md](TENANCY.md): Tenant contract. Add the identity, authorization, machine-access, and control-plane annexes only for branches in scope, using the sibling files in the read map.

**Gate:** every core field and every field in an in-scope annex has a concrete value or `undecided` plus the blocking question. Excluded annexes are marked `not applicable: excluded by contract`; out-of-scope fields do not block the core.

### 4. Threat-model cross-tenant access

Walk the threats in [TENANCY.md](TENANCY.md): Threats. For each, record the contract control that stops it.

**Gate:** every threat has a mapped control or `not applicable: excluded by contract`. An in-scope threat without a control keeps the contract incomplete.

### 5. Route implementation

Using [CONTROL-PLANES.md](CONTROL-PLANES.md), name the plane for each remaining change and actively invoke the owning installed skill. Invoke the loaded framework adapter for framework work. An unavailable owner is a blocked handoff, not permission to reimplement that domain here.

```
| Task | Plane | Owner invoked | Outcome (planned | applied + observed evidence | blocked) |
```

**Gate:** every remaining task has a row. Each available owner was invoked; each unavailable owner is `blocked`. Management MCP is not listed as a user/organization provisioner.

### 6. Verify the design

Run the test matrix against the contract, and against the implementation when this run is authorized to change code.

**Gate:** every matrix row is `pass`, `fail`, `blocked`, or `not applicable: excluded by contract`, with evidence for every in-scope row.

## Test matrix

| Case | Observable target |
| --- | --- |
| Cross-tenant isolation | A verified credential for org A cannot read or mutate org B's data. |
| Missing or stripped tenant source | Retained-token designs deny a valid token with omitted `org_code`. Intentional stripping succeeds only through the contract's trusted server-side tenant/membership resolver and no-membership discriminator; a client hint or unnamed source blocks the design. |
| Org switch | After switching, the B2B contract's tenant source resolves the target organization (`org_code` on the new token by default); prior organization data is inaccessible in that context. |
| Wrong API audience | A validly signed token whose `aud` lacks the exact registered product API is denied. |
| Token validity | Expired, revoked, or suspended-organization tokens are rejected. Other tabs do not keep serving the old organization after refresh. |
| Claim freshness | Issued JWTs remain immutable. Direct user/membership/assignment writes invalidate cache for the next issued token; inherited role/flag changes require Management API `refreshUserClaims` and then a new token. |
| Permissions | The API denies the action when the verified `permissions` array lacks the required key, even if the UI would show it. |
| Shared-catalog blast radius | A role/permission definition write is treated as business-wide; production organization memberships and assignments are seeded without recreating definitions per environment. |
| Invitation | The invitee joins the invited organization; the invited email cannot be swapped; invite sign-up still works when environment self-sign-up is off. |
| SSO routing | Home-realm discovery routes to the connection's identity provider and its linked organization. Routing is not treated as authorization. |
| Machine authorization | Global M2M is rejected on tenant routes. Org-scoped M2M requires exact `aud`, tenant `org_code`, and granted `scope` rather than requested `scp`; organization API keys require verification `org_code` and `scopes`. |
| MCP connection tenant | A user API key has no `org_code`; tenant operations are exposed only when the contract names server-side tenant resolution and authorization. Connection OAuth follows product-API tenant context without invented claims. |

## Handoff names

Do not link files outside this folder. Actively invoke `kinde-organizations` for organization lifecycle, `kinde-authorization` for roles/permissions, `kinde-billing` for plans/entitlements, `kinde-mcp` for MCP work, and the loaded framework adapter for framework files. If an owner is unavailable, preserve the contract and mark that handoff `blocked`.
