# App Router implementation patterns

Read this file for auth links, server/client session data, authorization,
redirects, permissions, audiences, organizations, and portal integration.
Examples use the default `/api/auth` base; substitute the setup-contract base
when the project customizes `KINDE_AUTH_API_PATH`.

## Auth links and redirect destinations

SDK link components can render from Server Components:

```tsx
import {
  LoginLink,
  LogoutLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/components";

export function AuthLinks() {
  return (
    <nav>
      <LoginLink postLoginRedirectURL="/dashboard">Sign in</LoginLink>
      <RegisterLink postLoginRedirectURL="/welcome">Create account</RegisterLink>
      <LogoutLink>Sign out</LogoutLink>
    </nav>
  );
}
```

Prefer fixed internal paths. If a destination comes from a query parameter,
map it to a small allowlist before passing it to a Kinde component or
`/api/auth/login`:

```ts
const RETURN_PATHS = ["/dashboard", "/settings"] as const;

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }

  const candidate = new URL(value, "https://internal.invalid");
  const path = `${candidate.pathname}${candidate.search}${candidate.hash}`;
  const allowed = RETURN_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  return allowed ? path : "/dashboard";
}
```

Do not accept an arbitrary absolute URL, protocol-relative URL, backslash
variant, or encoded external destination. The current v2 source also supports
`KINDE_POST_LOGIN_ALLOWED_URL_REGEX` as defense in depth, but the primary SDK
guide does not document it. If used, anchor it, allow only intended internal
paths and exact origins, test both link-generated absolute URLs and direct
relative URLs, and record the source-level dependency.

**Gate:** Every post-login value is static or passes an internal-path allowlist;
logout and portal return destinations are not user-controlled.

## Protected Server Component

The current v2 SDK returns a session helper object synchronously, while each
helper is asynchronous:

```tsx
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const { getUser, isAuthenticated } = getKindeServerSession();

  if (!(await isAuthenticated())) {
    redirect("/api/auth/login?post_login_redirect_url=/account");
  }

  const user = await getUser();
  if (!user) {
    redirect("/api/auth/login?post_login_redirect_url=/account");
  }

  return <p>Signed in as {user.email}</p>;
}
```

Authenticate before fetching private application data. Do not write
`if (!isAuthenticated())`; that tests a Promise. Re-check installed types if a
future major makes `getKindeServerSession()` itself asynchronous.

Session-backed output is request-specific:

- Do not mark it `force-static`.
- Do not place user/session reads inside a shared cross-user cache.
- Current releases call async `cookies()` internally. If a verified older
  SDK/Next combination still prerenders the page, call `await connection()`
  before session access as a compatibility fallback and prove the fix with a
  production build. Do not add `connection()` speculatively.

**Gate:** The signed-out path redirects before private reads and the production
build treats personalized output as request-time data.

## Route Handler authorization

Enforce authentication, permission, and resource ownership in the handler:

```ts
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextResponse } from "next/server";

export async function POST() {
  const { getPermission, getUser, isAuthenticated } =
    getKindeServerSession();

  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const permission = await getPermission("invoices:write");
  if (permission?.isGranted !== true) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate input and resource ownership before the mutation.
  return NextResponse.json({ ok: true });
}
```

Use `401` for no valid session and `403` for an authenticated caller lacking
permission. A Kinde permission does not replace tenant/org or record ownership
checks.

## Server Action authorization

A page check does not protect its Server Actions. Re-check inside each action:

```ts
"use server";

import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function updateInvoice(formData: FormData) {
  const { getPermission, getUser, isAuthenticated } =
    getKindeServerSession();

  if (!(await isAuthenticated())) {
    return { ok: false, error: "Unauthorized" };
  }

  const permission = await getPermission("invoices:write");
  if (permission?.isGranted !== true) {
    return { ok: false, error: "Forbidden" };
  }

  const user = await getUser();
  if (!user) {
    return { ok: false, error: "Unauthorized" };
  }

  // Parse formData and verify resource ownership before writing.
  return { ok: true };
}
```

For repeated checks, centralize them in a `server-only` data-access module.
Return only the minimum user fields needed by the caller.

**Gate:** Direct requests to every Route Handler and Server Action fail closed
without the required session, permission, organization, and resource access.

## Null-safe permissions

Claims can be absent. Normalize before array operations:

```ts
import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";

export async function canReadReports() {
  const { getPermissions } = getKindeServerSession();
  const result = await getPermissions();
  const permissions = result?.permissions ?? [];

  return permissions.includes("reports:read");
}
```

The proxy callback must also be null-safe:

```ts
isAuthorized: ({ token }) =>
  (token.permissions ?? []).includes("reports:read")
```

Proxy authorization improves navigation behavior only. Repeat the check beside
the protected data or mutation.

## API audiences

Set `KINDE_AUDIENCE` only when the access token is intended for a registered
API:

```dotenv
KINDE_AUDIENCE=https://api.example.com
```

In Kinde:

1. Register that exact audience under environment APIs.
2. Authorize the Back-end web application for the API.
3. Request the audience through `KINDE_AUDIENCE`.
4. At a separate API boundary, validate signature, issuer, expiry, and that
   `aud` contains the expected audience before checking permissions.

For same-application cookie sessions, use server session helpers rather than
sending raw tokens to Client Components.

**Gate:** Every bearer-token API verifies its intended audience; no audience
value is added merely to make a missing-permission symptom disappear.

## Shared navbar session: client-side by default

The shared navbar is the major exception to server-first session rendering. In
nearly every app, fetch its user/session state in a small Client Component with
`useKindeBrowserClient`.

Do not call `getKindeServerSession` in a root or shared layout merely to show an
avatar, sign-in link, or account menu. The SDK reads request cookies, so that
layout gains a request-time dependency and can prevent descendant routes from
keeping their intended static or cached rendering strategy.

Keep the root layout as a Server Component. Render this client navbar beside
`children`; do not move the pages themselves into the client boundary:

```tsx
"use client";

import {
  LoginLink,
  LogoutLink,
} from "@kinde-oss/kinde-auth-nextjs/components";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";

export function AccountNav() {
  const { isAuthenticated, isLoading, user } = useKindeBrowserClient();

  if (isLoading) {
    return <nav aria-label="Account">Loading account…</nav>;
  }

  if (!isAuthenticated || !user) {
    return (
      <nav aria-label="Account">
        <LoginLink>Sign in</LoginLink>
      </nav>
    );
  }

  return (
    <nav aria-label="Account">
      <span>{user.email}</span>
      <LogoutLink>Sign out</LogoutLink>
    </nav>
  );
}
```

This client check controls presentation only. Protected page data, Route
Handlers, Server Actions, and mutations still authenticate and authorize on the
server. Do not fetch private application data merely because the navbar knows a
user is signed in.

A server-rendered navbar is an exception: use it only when the entire containing
route tree is intentionally request-time and authenticated, and record that
decision in the setup contract. Never make public/static child pages dynamic
only to personalize shared navigation.

`KindeProvider` is optional. Add it only when the setup contract identifies a
client subtree that needs provider-backed context or provider features:

```tsx
"use client";

import { KindeProvider } from "@kinde-oss/kinde-auth-nextjs";
import type { ReactNode } from "react";

export function AuthProvider({ children }: { children: ReactNode }) {
  return <KindeProvider>{children}</KindeProvider>;
}
```

Do not wrap the root merely for `AccountNav`; the current v2 browser hook has a
providerless path. If a provider-only feature is required, wrap the narrowest
client subtree. On Cloudflare/OpenNext, current Kinde guidance warns that
`KindeProvider` can break SSR; prefer the providerless navbar plus server-side
data enforcement.

### Client token refresh

- The boundary helper automatically refreshes near-expiry tokens on matched
  requests.
- In App Router, current v2 source marks
  `getKindeServerSession().refreshTokens()` as Pages Router-only.
- For on-demand App Router refresh after a server-side Kinde data change, use
  client-side `refreshData()` from `useKindeBrowserClient`; current source says
  this requires App Router on Next 14+.

```tsx
"use client";

import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";

export function RefreshClaimsButton() {
  const { refreshData } = useKindeBrowserClient();

  return (
    <button type="button" onClick={() => void refreshData()}>
      Refresh access
    </button>
  );
}
```

Do not add manual refresh calls to every render. Verify the installed version
before relying on `refreshData`; it was introduced during the v2 line and is
not equivalent to the older state-fetch behavior with the same name.

## Organizations and portal touchpoints

Route a user into an organization-aware auth flow with a trusted org code:

```tsx
import {
  CreateOrgLink,
  LoginLink,
  PortalLink,
  RegisterLink,
} from "@kinde-oss/kinde-auth-nextjs/components";

export function OrganizationLinks({ orgCode }: { orgCode: string }) {
  return (
    <nav>
      <LoginLink orgCode={orgCode}>Sign in to organization</LoginLink>
      <RegisterLink orgCode={orgCode}>Join organization</RegisterLink>
      <CreateOrgLink orgName="New organization">
        Create organization
      </CreateOrgLink>
      <PortalLink returnUrl="https://app.example.com/settings">
        Account portal
      </PortalLink>
    </nav>
  );
}
```

- Prefer an org code resolved from server-trusted application data. A query
  parameter is not proof that the caller belongs to that organization.
- Re-check the active organization and permission at each protected operation.
- `CreateOrgLink` and `PortalLink` are integration points only; do not add
  general organization lifecycle or billing behavior under this skill.
- `PortalLink.returnUrl` must be absolute. Use a fixed allowlisted application
  URL, not user input.

**Gate:** Organization-aware links choose an auth context, while server-side
checks enforce actual membership and access.
