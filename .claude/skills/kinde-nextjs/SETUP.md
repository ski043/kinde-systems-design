# Setup and network boundary

Read this file for installation, Kinde application configuration, auth-route
creation, custom auth paths, and proxy/middleware work.

## 1. Confirm the application package

Run checks from the package that owns the Next.js app:

```bash
node --version
node -p "require('./package.json').packageManager ?? 'not declared'"
node -p "require('next/package.json').version"
node -p "require('./package.json').dependencies?.['@kinde-oss/kinde-auth-nextjs'] ?? require('./package.json').devDependencies?.['@kinde-oss/kinde-auth-nextjs'] ?? 'not declared'"
```

If `next/package.json` is unavailable, install project dependencies first with
the existing lockfile and package manager. For a workspace, do not add Kinde to
the root package unless the root actually owns `next`.

Identify the app root:

- `app/layout.*` means the app root is `app`.
- `src/app/layout.*` means the app root is `src/app`.
- If neither exists, stop; do not create an App Router tree just to apply this
  skill.
- If only `pages/` exists, use Pages Router guidance instead.

**Gate:** Node is 20+, the application package and app root are known, and the
installed Next major is confirmed.

## 2. Resolve and install a compatible SDK

Package compatibility is time-sensitive. Query the registry:

```bash
npm view @kinde-oss/kinde-auth-nextjs dist-tags version peerDependencies --json
```

Use the current stable `latest` release only when its peer range includes the
installed Next, React, and React DOM versions. If it does not:

1. Check the official releases and the package metadata for a stable compatible
   release.
2. Prefer upgrading Next to a supported security patch when that is within the
   user's scope.
3. Otherwise ask before selecting an older SDK. Never invent a version, use a
   prerelease silently, or bypass peer checks.

Install in the application package:

```bash
# npm
npm install @kinde-oss/kinde-auth-nextjs

# pnpm
pnpm add @kinde-oss/kinde-auth-nextjs

# Yarn
yarn add @kinde-oss/kinde-auth-nextjs

# Bun
bun add @kinde-oss/kinde-auth-nextjs
```

Use only the command matching the setup contract. The lockfile is the
reproducible version record; do not hand-edit it.

**Gate:** The package is a production dependency and the package manager
reports no unresolved peer mismatch.

## 3. Configure the Kinde application

In Kinde, create or select a **Back-end web** application and choose Next.js.
For each environment, register exact values:

- Site origin: `http://localhost:3000` in the default local setup.
- Allowed callback URL:
  `<site-origin><auth-api-path>/kinde_callback`.
- Allowed logout redirect URL: normally `<site-origin>`.
- Post-login destination: an internal application URL such as
  `<site-origin>/dashboard`.

With the default auth API path, the callback is:

```text
http://localhost:3000/api/auth/kinde_callback
```

Kinde callback URLs are origin- and path-sensitive. Do not put the post-login
page in the callback allowlist in place of `kinde_callback`. Register
production and preview URLs separately; see [DEPLOYMENT.md](DEPLOYMENT.md).

Use the project's untracked local environment file for real values:

```dotenv
KINDE_CLIENT_ID=<client-id>
KINDE_CLIENT_SECRET=<client-secret>
KINDE_ISSUER_URL=https://<business-subdomain>.kinde.com
KINDE_SITE_URL=http://localhost:3000
KINDE_POST_LOGIN_REDIRECT_URL=http://localhost:3000/dashboard
KINDE_POST_LOGOUT_REDIRECT_URL=http://localhost:3000
```

Rules:

- Never prefix the client secret with `NEXT_PUBLIC_`.
- Do not place the client secret in `next.config.*`.
- A tracked `.env.example` may contain key names and obvious placeholders only.
- Ensure the real environment file is ignored before writing it.
- Add `KINDE_AUDIENCE` only for a registered API that the app is authorized to
  call; see [PATTERNS.md](PATTERNS.md).

**Gate:** The callback and logout URLs exactly match the local environment, all
six required keys exist in an untracked/secret store, and no secret is
client-visible.

## 4. Create or merge the auth route

Use the app root discovered in step 1:

```text
app/api/auth/[kindeAuth]/route.ts
# or
src/app/api/auth/[kindeAuth]/route.ts
```

The route is:

```ts
import { handleAuth } from "@kinde-oss/kinde-auth-nextjs/server";

export const GET = handleAuth();
```

If the file exists, preserve unrelated exports and comments. If it already has
a different `GET`, there is a route ownership conflict; do not overwrite it.
Move the Kinde auth base or resolve the competing route explicitly.

### Custom auth paths

The default base is `/api/auth`. To use another base:

1. Set `KINDE_AUTH_API_PATH` to a leading-slash path with no trailing slash.
2. Move the dynamic filesystem route to the same path. For example,
   `/internal/auth` maps to
   `<app-root>/internal/auth/[kindeAuth]/route.ts`.
3. Register
   `<site-origin>/internal/auth/kinde_callback` in Kinde.
4. Update app links, public-path logic, tests, and the validator expectations.
5. If client code must construct SDK URLs, verify the installed release's
   `NEXT_PUBLIC_KINDE_AUTH_API_PATH` behavior before exposing the same
   non-secret base path.

Optional subroute keys rename individual one-segment handlers:

```dotenv
KINDE_AUTH_LOGIN_ROUTE=login
KINDE_AUTH_LOGOUT_ROUTE=logout
KINDE_AUTH_REGISTER_ROUTE=register
KINDE_AUTH_CREATEORG_ROUTE=create_org
KINDE_AUTH_HEALTH_ROUTE=health
KINDE_AUTH_SETUP_ROUTE=setup
KINDE_AUTH_PORTAL_ROUTE=portal
KINDE_AUTH_ENDSESSION_ROUTE=end_session
```

Only letters, digits, `_`, and `-` are accepted by the current SDK. The callback
segment remains `kinde_callback`.

**Gate:** A GET request to the configured auth base plus `/health` or `/login`
reaches `handleAuth` rather than a Next.js 404.

## 5. Choose exactly one network-boundary file

The file sits beside `app/`:

```text
Next 16+ with app/      -> proxy.ts
Next 16+ with src/app/  -> src/proxy.ts
Next 13-15 with app/    -> middleware.ts
Next 13-15 with src/app/-> src/middleware.ts
```

The import path is the same in both branches.

### Next.js 16 and newer

```ts
import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

export default withAuth(
  async function proxy() {},
  {
    publicPaths: ["/", /^\/blog(?:\/|$)/, /^\/api\/public(?:\/|$)/],
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
```

Do not export `runtime = "edge"` from `proxy.ts`; Next.js 16 Proxy uses the
Node.js runtime and rejects that configuration.

### Next.js 13 through 15

```ts
import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

export default withAuth(
  async function middleware() {},
  {
    publicPaths: ["/", /^\/blog(?:\/|$)/, /^\/api\/public(?:\/|$)/],
  },
);

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
```

Use anchored regular expressions for route families. A string such as `/blog`
is a prefix and also matches `/blogger`. Confirm RegExp support in the installed
SDK; it was added after early v2 releases.

Do not make the entire auth base public. The SDK bypasses its login, callback,
register, and setup handlers; logout, organization, portal, and end-session
routes need session context. Expose the health route only in a controlled
diagnostic context.

**Gate:** Exactly one boundary file exists, its filename matches the Next major,
the matcher excludes framework/static assets, and the public list reflects the
route inventory rather than a copied default.

## 6. Merge existing boundary behavior

Read the existing function before choosing a composition.

### Existing behavior only applies after authentication

Pass it as the `withAuth` callback:

```ts
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuth } from "@kinde-oss/kinde-auth-nextjs/middleware";

async function existingProtectedBehavior(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("x-request-path", request.nextUrl.pathname);
  return response;
}

export default withAuth(existingProtectedBehavior, {
  publicPaths: ["/"],
});
```

In the researched v2 SDK, the callback runs only for authenticated,
non-public requests. It must return `NextResponse` when its response must be
preserved; the SDK copies refreshed cookies to that response.

### Existing behavior must also run on public routes

Do not use the callback pattern unchanged, because Kinde returns early for a
public path. Factor the old behavior into a named function and compose both
responses. For the installed SDK, verify all of these before editing:

1. Kinde still skips the callback on public paths.
2. The Kinde public response carries refreshed cookies through
   `response.cookies`.
3. Existing behavior returns `NextResponse`, with documented redirect/rewrite
   precedence.
4. The composition invokes Kinde on every matched route, copies only Kinde
   cookies onto the existing public response, and never overwrites an auth
   redirect or `401`.

If any condition is false or response precedence is ambiguous, ask for the
desired behavior. There is no safe generic merge for arbitrary rewrites,
internationalization, third-party auth, and response-header mutation.

### Existing authentication

Do not stack two independent session guards over the same route set. Decide
which system owns authentication, callbacks, and logout, then migrate or scope
the matchers. Preserve unrelated locale, CSP, experiment, or rewrite behavior.

**Gate:** Tests cover a public route, a protected route, an existing
redirect/rewrite, and refreshed session cookies; no prior behavior vanished.
