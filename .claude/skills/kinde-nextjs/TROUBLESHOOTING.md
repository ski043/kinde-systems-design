# Troubleshooting

Read this file when setup, redirects, callbacks, cookies, server helpers,
permissions, token refresh, rendering, or deployment behavior fails.

## Start with safe evidence

Collect facts in this order:

1. Run the validator shipped with this skill against the target project root:

   ```bash
   node scripts/validate-kinde-nextjs.mjs .
   ```

2. Record Node, installed Next, React, and Kinde versions plus the Kinde
   package's current peer dependencies.
3. Confirm the app root, auth route, custom auth API path, and the single
   proxy/middleware file.
4. Confirm required environment **key presence**, never print values.
5. Compare the browser origin, `KINDE_SITE_URL`, generated callback URL, and
   dashboard allowlist. It is safe to compare origins/paths; redact IDs.
6. Use `<auth-api-path>/health` only in the controlled manner described in
   [DEPLOYMENT.md](DEPLOYMENT.md).
7. Reproduce in a production build or platform preview when the failure is
   deployment-only.

Change one cause at a time.

## Install or peer-dependency failure

- Query current npm metadata; do not trust a stale compatibility table.
- Confirm the command ran in the application workspace.
- Do not use `--force`, `--legacy-peer-deps`, or a prerelease to make the
  warning disappear.
- If current stable does not accept the installed Next/React patch, prefer a
  supported security-patch upgrade. Ask before downgrading the SDK.
- If npm metadata and Kinde's compatibility page disagree, treat the package
  peer range as the installation gate and record the conflict.

## Auth route returns 404

Check:

1. The project uses App Router.
2. The file is exactly
   `<app-root>/<auth-api-path>/[kindeAuth]/route.ts`.
3. It exports `GET = handleAuth()`.
4. `KINDE_AUTH_API_PATH` and the filesystem path match.
5. A custom subroute uses only letters, digits, `_`, or `-`.
6. Proxy/middleware, rewrites, or a platform rule does not intercept the path.

The current guide uses `[kindeAuth]`; a repository playground has historically
used `[...kindeAuth]`. Do not switch shapes as a guess. Use the current guide,
installed handler types, and requested route contract.

## Invalid callback URL

- The callback is
  `<exact-site-origin><auth-api-path>/kinde_callback`.
- Match protocol, host, port, path, case, and trailing characters exactly.
- Remove whitespace in Kinde dashboard entries.
- Confirm the client ID belongs to the same Kinde application/environment.
- Redeploy after changing platform environment variables.
- Do not use the post-login page as the OAuth callback.

## Login redirects to localhost or another deployment

The runtime is not receiving the intended URL configuration.

- Confirm `KINDE_SITE_URL`, post-login URL, and post-logout URL in the target
  environment.
- On Cloudflare/OpenNext, confirm
  `nodejs_compat_populate_process_env` and worker `[vars]`.
- On Vercel preview, remove static production URL overrides from the Preview
  environment and derive URLs from the actual preview host.
- Confirm a reverse proxy forwards the expected host/protocol.

## “State not found” or state-cookie mismatch

This is a security failure, not a state value to bypass.

1. Record the host where login started.
2. Record the callback host after Kinde.
3. Confirm they are identical unless a deliberate shared-cookie subdomain
   design exists.
4. Confirm `KINDE_SITE_URL` generated that callback.
5. Confirm the callback is registered in the correct Kinde environment.
6. Inspect whether `ac-state-key` was set for the initiating host and whether
   browser privacy/domain/SameSite rules allow it on callback.
7. For sibling subdomains, verify the narrow `KINDE_COOKIE_DOMAIN`.

Fix the host/configuration mismatch before clearing cookies. Never disable
state validation.

## Redirect loop

- Ensure the login, callback, register, and setup handlers are not intercepted
  by unrelated existing auth logic.
- Confirm only one auth system owns the route set.
- Confirm a protected page awaits `isAuthenticated()` rather than testing its
  Promise.
- Confirm the post-login route exists and is not immediately denying the same
  valid session.
- Check clock skew and token-validation errors in temporary debug logs.
- Check that custom auth route names agree in environment, links, and boundary
  behavior.

Do not make the entire auth base public as a loop workaround.

## Auth link returns 204, null, or does nothing

Auth endpoints detect prefetch requests. Prefer Kinde's `LoginLink` and
`RegisterLink`. If a Next `Link` must target an auth endpoint, disable prefetch
and verify the installed SDK's prefetch handling. Current releases return a
no-content response for prefetch rather than starting OAuth.

On OpenNext/Cloudflare, also check adapter-generated prefetch headers and use a
current compatible SDK before patching the handler.

## Server auth check behaves as truthy while signed out

Kinde server helpers are asynchronous:

```ts
const { isAuthenticated } = getKindeServerSession();
const authenticated = await isAuthenticated();
```

Search for un-awaited calls to `isAuthenticated`, `getUser`, `getPermission`,
`getPermissions`, `getOrganization`, and token helpers. Authenticate before
fetching/rendering private user data.

In researched v2 releases, `getKindeServerSession()` itself is synchronous.
An upstream v3 proposal makes it asynchronous; follow the installed type
signature rather than mixing v3 proposal syntax into v2 code.

## Shared navbar made every child route request-time

Inspect the root and shared layouts. If one calls
`getKindeServerSession()` only to render an avatar, sign-in link, or account
menu, move that presentation into the client-side `AccountNav` pattern in
[PATTERNS.md](PATTERNS.md).

- Keep the root/shared layout as a Server Component.
- Render the small client navbar beside `children`; do not turn the pages into
  Client Components.
- Do not pass server-fetched session data from the common layout into the
  navbar, because the layout still reads request cookies.
- Keep protected data and mutation checks on the server.
- Run a production build and confirm public/static child routes retain their
  intended rendering and caching behavior while the navbar hydrates safely.

Keep a server-rendered shared navbar only when the entire containing route tree
is intentionally request-time and authenticated, and record that exception in
the setup contract.

## Protected page was prerendered or shows another session

- Remove `force-static` and shared caching around session-backed data.
- Confirm the session call occurs during the request and its Promise is
  awaited.
- Confirm the installed SDK uses async `cookies()` internally.
- Run a production build and inspect route output.
- For a verified affected SDK/Next combination only, call
  `await connection()` before auth access to force request-time execution, then
  add a regression test.
- Never cache decoded user/session values across users.

## Permission check throws or always denies

Normalize nullable claims:

```ts
const permissions = (await getPermissions())?.permissions ?? [];
const allowed = permissions.includes("reports:read");
```

For proxy checks, use `(token.permissions ?? []).includes(...)`.

If the permission is absent:

1. Confirm the user has the permission in the active organization.
2. Confirm the auth flow selected the intended `orgCode`.
3. If calling a registered API, confirm `KINDE_AUDIENCE` exactly matches it and
   the application is authorized.
4. Obtain a new token using the supported refresh/auth flow.
5. Re-check on the server; do not grant access because a client says it has the
   permission.

## Tokens do not refresh

Separate three mechanisms:

- **Automatic refresh:** `withAuth` refreshes near-expiry tokens on matched
  requests. Keep its matcher broad enough to run on application routes,
  including public pages where session continuity matters.
- **On-demand App Router refresh:** current v2 uses client
  `useKindeBrowserClient().refreshData()` and documents Next 14+ support.
- **Server `refreshTokens`:** current v2 source marks
  `getKindeServerSession().refreshTokens()` as Pages Router-only even though the
  SDK guide also shows a server example.

Do not use the conflicting server example in App Router. Verify the installed
source/version. If the app is on Next 13 and needs on-demand claim refresh,
upgrade within compatible ranges or use a fresh supported auth flow; do not
invent cookie mutation.

If refresh repeatedly fails, check refresh-token cookie presence, cookie
domain, HTTPS, expiry, and whether parallel requests are rotating the same
token. Avoid adding competing manual refresh loops.

## Client state hangs, flashes private UI, or breaks SSR

- Handle `isLoading` before `isAuthenticated`.
- Keep private data behind a protected server endpoint.
- Remove a root `KindeProvider` if no client context feature needs it.
- On Cloudflare/OpenNext, remove `KindeProvider` first when SSR returns a blank
  body; this is current first-party guidance.
- Confirm the client and server use the same custom auth API path.

## Debug mode

Temporarily set in a local or controlled environment:

```dotenv
KINDE_DEBUG_MODE=true
```

Reproduce once, inspect server logs, then remove/disable it. Do not ship verbose
auth logs by default or paste complete tokens, cookies, environment dumps, or
health responses into issues.

## Manual cookie clearing: last resort

Use `LogoutLink` first because it clears the local session through the SDK and
ends the Kinde session. Manual clearing is appropriate only after the root
domain/configuration problem is fixed and a stale local session prevents
testing.

The first-party guide's cookie list and current v2 source differ: the guide
mentions a client-ID-suffixed refresh cookie, while current source uses
`refresh_token` and may split token cookies across suffixed chunks. Therefore:

1. Inspect the installed SDK's cookie constants and the current browser's
   cookie **names**; never log values.
2. If a temporary clearing endpoint is required, make it same-origin `POST`
   only, check `Origin`, and guard it to non-production or an authenticated
   administrator.
3. Delete only exact Kinde cookie names and their documented split chunks.
   Never clear all application cookies or use broad unrelated prefixes.
4. Return `Cache-Control: no-store`; do not accept a user-supplied redirect.
5. Test it once, then remove the endpoint and any public-path exception.

Do not expose the guide's clearing route permanently without these controls.

## Troubleshooting completion gate

The root cause is tied to observed versions, hosts, route/config state, or
runtime behavior; the smallest fix passes the validator, production build, and
the previously failing auth flow; temporary debug and cookie-clearing controls
are removed.
