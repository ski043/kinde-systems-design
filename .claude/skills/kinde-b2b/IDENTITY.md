# Identity

Authoritative membership, onboarding, active-organization, invitation, and SSO rules for the tenant contract. Actively invoke `kinde-organizations` for lifecycle work and the loaded framework adapter for SDK or protocol implementation. An unavailable owner is a blocked handoff.

## Membership

A user can belong to multiple organizations and hold different roles and permissions in each. Assignments are per organization; a user without an organization cannot be given roles or permissions.

Sign-in without an `org_code` in the auth request:

1. One membership → signed into that organization.
2. Several memberships → Kinde shows an organization selector (unless "sign into most recent org" is enabled).
3. Zero memberships → Kinde signs in without an organization. When the token retains `org_code`, the claim is omitted; an intentional stripping design uses the tenant contract's no-membership discriminator. See [TENANCY.md](TENANCY.md).

Passing `org_code` on login/register selects that organization (and its branding) and skips the selector. Home-realm discovery overrides this; see Enterprise SSO.

## Active organization

By default, the active organization is the verified access token's `org_code`. If the contract intentionally strips that claim, the active tenant comes only from its named trusted server-side resolver and membership check. Permissions and feature flags in the token still reflect the authentication context; they do not replace tenant proof.

Switching organizations is a new authentication into the target `org_code`. After the switch, bind data to the B2B contract's tenant source (the new token claim by default).

The refresh-token cookie is shared across browser tabs on the same domain. After a switch, other tabs pick up the new organization on their next token refresh. Treat prior tab context as stale: verify expiry and the contract's tenant source on every request.

Membership lists for a switcher come from the ID token (`org_codes`, and optionally the `organizations` array of `{id, name}` when that additional claim is enabled). Those lists are not a data partition.

## Onboarding

Pick the mode that matches the product; mix only when each path is named.

| Mode | When | Kinde lever |
| --- | --- | --- |
| Self-serve workspace | PLG B2B: "create your workspace" | Environment policy: allow self-sign-up and allow organization creation on sign-up; app starts the create-org auth request (`is_create_org`, optional `org_name`). |
| Invitation | Members add teammates | Environment policy: allow invitations and choose the invite application. See Invitations. |
| Admin / API provision | Sales-led or enterprise | Dashboard, import, or Management API creates the organization and members. Keep self-serve org creation off. |
| Domain JIT | Known email domains join an org | Organization policies: auto-add from allowed domains. Domain check runs at sign-up; contractors outside the list can still be added manually. |

Global access policies are the default for every organization. Per-organization policy override is a plan-gated capability; confirm the live plan before relying on it. Official pages disagree on some org-policy *labels*; confirm the dashboard control. See [REFERENCES.md](REFERENCES.md).

For B2B, decide explicitly whether unknown sign-ups auto-join the default organization (usually off).

## Invitations

Invitations are organization membership, not Kinde-team invites.

- Environment policies gate whether members can invite and which application invitation links use. When invitations are off, portal invite UI is hidden and accepting an existing invite is blocked.
- Inviting from the organization self-serve portal requires `org:write:members`. A member can only assign roles they are allowed to grant.
- Invitees get a tailored sign-up: name/email prefilled, email locked. They can complete registration even when environment self-sign-up is off. Organization-level registration/auto-add policy still applies when an organization is in context.
- The invitee must land in the invited organization. Treat an invite that creates a user in the default org, or in no org, as a failed onboarding path.

Invoke `kinde-organizations` for detailed portal or invitation work; this contract only names whether invitations exist and who may send them.

## Enterprise SSO

Prefer creating the enterprise connection *on the organization* (not as a shared environment connection) so access is locked to that connection, including org switches. Shared connections can be enabled on an organization when a single IdP is truly shared.

Home-realm discovery (HRD) routes the user to an IdP from the email domain. It is authentication routing, not authorization.

When HRD is active:

- The organization selector is skipped.
- "Sign into most recent org" does not apply.
- Passing `org_code` does not override the destination; the user lands in the organization linked to the matching connection.
- Home-realm domains must be unique across connections in the environment.
- Connections used only via HRD do not have to be enabled at the application level.

After routing, still enforce membership, permissions, and `org_code` on the API. Domain match at the IdP is not a substitute for those checks.

Invoke the owning installed identity/framework adapter for IdP protocol configuration (SAML/OIDC/Entra). If none is available, mark implementation blocked; this contract only chooses org-owned vs shared and whether HRD is on.
