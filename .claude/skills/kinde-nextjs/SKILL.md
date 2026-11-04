---
name: kinde-nextjs
description: >-
  Implements and repairs Kinde authentication in existing Next.js App Router
  projects. Use for Kinde plus App Router setup; route protection or merging a
  Next.js 16 proxy.ts or older middleware.ts; server auth data or client-side
  navbar sessions; organization-aware auth and portal links; production,
  preview, subdomain, or edge deployment configuration; and Kinde SDK,
  callback, cookie, token-refresh, or compatibility troubleshooting.
---

# Kinde authentication for Next.js App Router

Use a **setup contract**: inspect the project, record the decisions that control
the integration, then implement only against that contract.

## Boundaries

- This skill is for an existing Next.js App Router application on Node 20+.
- Do not apply Pages Router or Kinde SDK v1 examples. If the project is
  Pages-only or uses v1 imports/routes, identify it and hand off to the matching
  migration or Pages Router guidance.
- Keep `KINDE_CLIENT_SECRET` server-only and out of tracked files, logs, client
  code, `next.config.*`, and every `NEXT_PUBLIC_*` variable.
- Treat proxy/middleware checks as navigation and token-refresh assistance, not
  the final authorization boundary. Re-authorize in every Route Handler, Server
  Action, and server-side data operation.
- **Navbar exception.** In nearly every app, fetch shared navbar session state
  in a small Client Component with `useKindeBrowserClient`. Do not call
  `getKindeServerSession` from a root or shared layout solely to render account
  navigation; that introduces a request-time cookie dependency across its route
  tree. Keep page data and authorization server-first while preserving each
  child route's intended static or dynamic rendering strategy.
- Preserve existing behavior. Never replace an existing auth route,
  `proxy.ts`, or `middleware.ts` without reading and deliberately merging it.

## Read the branch that applies

- Read [SETUP.md](SETUP.md) when installing the SDK, configuring Kinde,
  creating the auth route, choosing a compatible version, or selecting
  `proxy.ts` versus `middleware.ts`.
- Read [PATTERNS.md](PATTERNS.md) when adding auth links, protected server
  pages, Route Handler or Server Action checks, client auth state, permissions,
  audiences, organizations, or portal links.
- Read [DEPLOYMENT.md](DEPLOYMENT.md) when configuring production, Vercel
  previews, custom subdomains, Cloudflare/OpenNext, or another nonstandard
  runtime.
- Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md) when auth redirects, callback
  state, cookies, token refresh, static rendering, health checks, or SDK
  compatibility fail.
- Read [REFERENCES.md](REFERENCES.md) when a time-sensitive claim needs
  re-verification or the installed SDK conflicts with an example. It records
  the first-party research snapshot and unresolved upstream conflicts.

## Workflow

### 1. Inspect without editing

Work from the application package, not an assumed repository root.

1. Detect the package manager from `packageManager` and lockfiles. In a
   workspace, identify the package that owns `next`.
2. Read `package.json`, the installed `next/package.json` when available, and
   the installed Kinde package metadata. Record Node, Next, React, and Kinde
   versions; do not infer a major from memory.
3. Confirm `app/` or `src/app/` contains App Router files. Locate
   `<app-root>/api/auth/[kindeAuth]/route.*` under that same app root.
4. Locate every root- or `src/`-level `proxy.*` and `middleware.*`. Read their
   matchers, redirects, rewrites, headers, cookies, locale handling, and auth
   behavior.
5. Inspect root/shared layouts and navbar components. Flag any Kinde server
   session read used only to show sign-in, avatar, or account controls. Record
   which descendant routes must remain static or independently cacheable.
6. Inventory routes and classify each as public, authenticated, or
   permission-protected. Include API routes, Server Actions, webhooks, health
   endpoints, and static assets.
7. Identify environment file conventions by filename and key name only. Never
   print values. Inspect `.gitignore`, deployment configuration, custom
   domains, and preview-host behavior.
8. Query current package metadata before installing:

   ```bash
   npm view @kinde-oss/kinde-auth-nextjs version peerDependencies --json
   ```

   Confirm that the candidate stable release accepts the project's installed
   Next and React versions. Do not use force/legacy-peer-deps to hide a
   mismatch.

**Inspection gate:** Do not edit until the actual app root, package manager,
Next major, compatible SDK release, network-boundary file, existing boundary
behavior, route policy, navbar session strategy, static child routes to
preserve, environment convention, and deployment target are known.

### 2. Write the setup contract

Record this compact contract in working notes:

```text
Application package:
Package manager:
Node / Next / React:
App root:
Kinde SDK candidate and verified peer range:
Auth API base path:
Network boundary: proxy.ts | middleware.ts
Existing boundary behavior to preserve:
Public routes:
Authenticated routes:
Permission-protected operations:
Server auth consumers:
Client auth consumers:
Shared navbar session: client useKindeBrowserClient (default) | server exception + reason
Static/cached child routes to preserve:
Deployment and preview hosts:
Callback / logout / post-login destinations:
```

Decide these points explicitly:

- Next 16+ uses exactly one `proxy.ts`; Next 13–15 uses exactly one
  `middleware.ts`. Place it beside `app/`, either at the project root or in
  `src/`. The Kinde import remains
  `@kinde-oss/kinde-auth-nextjs/middleware`.
- A strict Next.js Edge-runtime requirement is an exception, not a reason to
  create both files. Stop and follow the edge branch in
  [DEPLOYMENT.md](DEPLOYMENT.md).
- Choose public paths deliberately. A string public path is a prefix except
  `/`, which is exact; use anchored `RegExp` entries when exact boundaries
  matter and the installed SDK supports them.
- Prefer Server Components for page data, protected content, and server-only
  authorization.
- Keep shared navbar session presentation client-side by default. Leave the
  root/shared layout as a Server Component and render a small client navbar
  beside `children`; do not make the whole route tree request-time just to show
  account controls.
- Add `KindeProvider` only for a concrete client-context requirement. Do not
  wrap the root merely to support the navbar; the current v2 browser hook has a
  providerless path.
- Accept dynamic post-login destinations only after mapping them to a small
  allowlist of internal paths.

**Planning gate:** Every protected operation has a server-side enforcement
point, every existing proxy/middleware behavior has a stated merge plan, and a
shared navbar does not read the Kinde server session in a common layout unless
the entire subtree is deliberately request-time and the contract records why.

### 3. Implement in dependency order

1. Follow [SETUP.md](SETUP.md) to install the verified stable SDK with the
   detected package manager and configure the Kinde Back-end web application.
2. Create or merge the matching
   `<app-root>/api/auth/[kindeAuth]/route.ts`. If a custom auth API base is
   selected, make the filesystem route and environment setting agree.
3. Create or merge only the setup-contract boundary file:
   - Next 16+: `proxy.ts`
   - Next 13–15: `middleware.ts`
4. Preserve existing behavior and matcher coverage. If generic composition
   cannot preserve response precedence, rewrites, headers, and refreshed Kinde
   cookies, stop and ask for the intended precedence instead of silently
   dropping behavior.
5. Add environment key placeholders only to the project's established example
   file. Put real secrets in `.env.local` or the deployment secret store, never
   in a committed file.
6. Follow [PATTERNS.md](PATTERNS.md) for each requested UI and authorization
   integration. Implement shared navbar session state with the client pattern
   by default. Await every server session helper used elsewhere before using
   its result, and authenticate before fetching private data.

**Implementation gate:** The SDK is compatible, the auth route resolves, one
correct boundary file preserves prior behavior, secret handling is safe, and
all private operations enforce authorization on the server.

### 4. Verify

Run the deterministic validator shipped with this skill against the target
project root:

```bash
node scripts/validate-kinde-nextjs.mjs .
```

Then run the project's existing formatter/linter, typecheck, tests, and
production build with its detected package manager. Do not invent scripts.

Verify manually in an environment whose URLs are registered in Kinde:

1. Public page loads while signed out.
2. Protected page redirects to Kinde and returns to the intended internal path.
3. Registration, login, logout, and callback complete on the same host.
4. Protected Route Handlers return `401` when signed out and `403` when signed
   in without permission.
5. A permitted user succeeds; missing `permissions` claims do not throw.
6. Refreshing a protected page preserves the session.
7. The shared navbar hydrates signed-in/signed-out state on the client without
   exposing private data or forcing unrelated child routes into request-time
   rendering.
8. Other client auth loading and signed-out states render safely when used.
9. Production or preview callback and logout URLs match the deployment exactly.

**Completion gate:** The validator, project checks, build, and applicable
manual flows pass. Report changed files, dashboard/deployment actions still
requiring the user, and any first-party conflict that affected the result.
