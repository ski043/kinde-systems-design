# Deployment and preview configuration

Read this file for production URLs, Vercel previews, subdomains,
Cloudflare/OpenNext, and edge-runtime constraints.

## Production contract

For each deployment environment, bind one canonical origin:

```text
KINDE_SITE_URL = canonical origin
Kinde callback = canonical origin + auth API base + /kinde_callback
KINDE_POST_LOGIN_REDIRECT_URL = canonical origin + internal path
KINDE_POST_LOGOUT_REDIRECT_URL = canonical origin or approved logout page
```

All four must use the same protocol and host for a normal flow. Register the
callback and logout URLs in the matching Kinde environment/application.

Deployment secrets:

- Store `KINDE_CLIENT_SECRET` only in the platform's encrypted secret store.
- Treat client ID, issuer, origins, audience, and cookie domain as
  configuration, not secrets.
- Do not put any secret in `next.config.*`, `vercel.json`, `wrangler.toml`,
  build output, or a tracked environment file.
- Redeploy after changing environment variables.

**Gate:** The deployed process sees all required keys, the Kinde dashboard
contains exact callback/logout URLs, and no build artifact contains the client
secret.

## Vercel preview deployments

An auth flow must return to the same preview host that set the state cookie.
Choose one strategy.

### Preferred: stable preview origin

Use a stable preview alias or dedicated test domain. Configure its Kinde
callback/logout URLs and preview environment variables exactly. This avoids an
ever-growing callback allowlist.

### Ephemeral Vercel URLs

For a per-deployment `VERCEL_URL`, derive the three non-secret URL variables at
build time only for preview builds. Merge this into the existing Next config;
never replace unrelated settings:

```js
const isPreview =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL;
const previewOrigin = isPreview
  ? `https://${process.env.VERCEL_URL}`
  : undefined;

/** @type {import("next").NextConfig} */
const nextConfig = {
  ...(previewOrigin
    ? {
        env: {
          KINDE_SITE_URL: previewOrigin,
          KINDE_POST_LOGIN_REDIRECT_URL: `${previewOrigin}/dashboard`,
          KINDE_POST_LOGOUT_REDIRECT_URL: previewOrigin,
        },
      }
    : {}),
};

module.exports = nextConfig;
```

These values are deliberately non-secret; Next's `env` option can inline them.
Never add `KINDE_CLIENT_SECRET` to this object. Adapt module syntax to the
existing config and preserve all existing keys/plugins.

Do not also define static production `KINDE_SITE_URL` or redirect values in the
Vercel **Preview** environment, or they can send the callback to another host.

The preview callback must still be allowed by Kinde:

- Prefer adding each exact callback/logout URL through a narrowly scoped
  deployment integration.
- A constrained wildcard is less secure. Kinde rejects broad shared-host
  patterns such as `*.vercel.app`; if a wildcard is used, constrain it with the
  account/team-specific prefix or suffix and verify its actual matches.
- Callback wildcards apply to the host, not arbitrary path segments.

Keep Management API automation limited to registering/removing deployment
URLs. Use a separate M2M client with only the redirect-URI scopes required, and
keep its secret in deployment secrets. Do not turn app runtime code into a
general Management API client.

**Gate:** Starting login on a preview returns to that exact preview's
`<auth-api-path>/kinde_callback`, then redirects only to an internal page on the
same preview.

## Sibling subdomains

If auth begins on one subdomain and the callback intentionally lands on another
trusted sibling, configure:

```dotenv
KINDE_COOKIE_DOMAIN=.example.com
```

Only do this when both hosts are controlled and intentionally share auth
cookies. This broadens cookie scope to sibling subdomains. It does not work
across unrelated registrable domains or unrelated preview hosts.

Register the actual callback host in Kinde and test `Secure`, `HttpOnly`,
`SameSite`, and domain attributes in the browser. Prefer a single canonical
host when cross-subdomain cookies are not required.

**Gate:** The cookie domain is the narrowest shared parent, every sibling in
scope is trusted, and the callback host receives the state cookie.

## Cloudflare Workers with OpenNext

Current first-party Kinde guidance requires Node 20+ and OpenNext's Node
compatibility environment.

In `wrangler.toml`, preserve existing settings and include:

```toml
compatibility_flags = ["nodejs_compat", "nodejs_compat_populate_process_env"]
```

Put non-secret Kinde variables under the appropriate environment's `[vars]`.
Set the secret separately:

```bash
npx wrangler secret put KINDE_CLIENT_SECRET
```

Then build and preview through the project's OpenNext scripts before deploying.
Cloudflare dashboard bindings are not automatically available through
`process.env` without `nodejs_compat_populate_process_env`.

Additional rules:

- Avoid `KindeProvider` in the root. Kinde documents blank/empty SSR output in
  this setup; use server auth patterns.
- For Next 16, keep `proxy.ts`; it is a Node-runtime boundary that OpenNext must
  adapt under the compatibility flags. Do not add `runtime = "edge"`.
- Verify login, callback cookies, and the auth health endpoint in the worker
  preview, not only in `next dev`.
- If login returns `null`, `204`, or a blank response, check the installed SDK
  release and OpenNext prefetch-header behavior before changing auth code.

**Gate:** Worker preview reads configuration through `process.env`, SSR returns
content, login reaches Kinde, and callback/session cookies persist.

## Strict Edge-runtime exception

Next.js 16 renamed Middleware to Proxy and made Proxy Node-runtime only; Proxy
does not accept a runtime override. The Next.js 16 upgrade guide says projects
that must retain the framework's Edge runtime may temporarily retain
`middleware.ts`.

That is an explicit conflict with this skill's normal Next 16 `proxy.ts`
contract. If strict Next Edge runtime is a hard requirement:

1. Stop before creating either boundary file.
2. Confirm whether the deployment actually requires Next's Edge runtime or
   merely runs on an edge platform with Node compatibility.
3. Verify the exact Next and Kinde versions against current first-party docs
   and a deployment preview.
4. Ask the user to approve the deprecated middleware exception if it is still
   required.
5. Never create both `proxy.ts` and `middleware.ts`.

For Next 13–15 middleware running at the edge, test the installed SDK in the
target runtime. Historical edge incompatibilities are not proof that the
current release works or fails.

## Other Node/serverless platforms

Confirm that:

- The platform runs the Node version required by the installed Next release.
- Server environment variables are available through `process.env`.
- The deployment does not statically export protected App Router routes.
- Requests to the callback are not cached.
- A CDN or reverse proxy preserves host/proto correctly.
- Server Actions have the required allowed origins when hosts differ.

Use a stable canonical origin where possible.

## Health endpoint in deployed environments

The SDK health handler reports whether the client secret is set correctly
without returning its value, but it also reports configuration such as client
ID, issuer, audience, cookie domain, and redirect URLs.

- Use `<auth-api-path>/health` locally or in a controlled diagnostic session.
- Do not make the whole auth API base public to reach it.
- If temporarily exposed, allow only the exact health path, restrict access at
  the platform or application layer, and remove the exception afterward.
- Check status and field presence; do not paste the full response into public
  logs or issues.

**Deployment completion gate:** Production and every supported preview pass
login, callback, protected navigation, permission denial, token refresh, and
logout on their own canonical hosts.
