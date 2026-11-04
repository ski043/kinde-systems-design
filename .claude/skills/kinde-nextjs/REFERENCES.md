# First-party references

Research snapshot: 19 August 2026. Re-check package metadata and current docs
before version-sensitive edits.

## Kinde

- [Next.js App Router SDK](https://docs.kinde.com/developer-tools/sdks/backend/nextjs-sdk/)
- [Kinde Next.js SDK repository](https://github.com/kinde-oss/kinde-auth-nextjs)
- [Latest SDK releases](https://github.com/kinde-oss/kinde-auth-nextjs/releases)
- [v2.13.1 release](https://github.com/kinde-oss/kinde-auth-nextjs/releases/tag/v2.13.1)
- [SDK package metadata](https://www.npmjs.com/package/@kinde-oss/kinde-auth-nextjs)
- [v2.13.1 package metadata](https://raw.githubusercontent.com/kinde-oss/kinde-auth-nextjs/v2.13.1/package.json)
- [v2.13.1 server session implementation](https://raw.githubusercontent.com/kinde-oss/kinde-auth-nextjs/v2.13.1/src/session/index.ts)
- [v2.13.1 auth middleware implementation](https://raw.githubusercontent.com/kinde-oss/kinde-auth-nextjs/v2.13.1/src/authMiddleware/authMiddleware.ts)
- [v2.13.1 callback implementation](https://raw.githubusercontent.com/kinde-oss/kinde-auth-nextjs/v2.13.1/src/handlers/callback.ts)
- [v2.13.1 client refresh implementation](https://raw.githubusercontent.com/kinde-oss/kinde-auth-nextjs/v2.13.1/src/frontend/hooks/public/use-providerless-kinde-auth.ts)
- [Set callback and redirect URLs](https://docs.kinde.com/get-started/connect/callback-urls/)
- [Add Kinde auth to a codebase](https://docs.kinde.com/get-started/guides/byo-code/)
- [Cloudflare Workers deployment guide](https://docs.kinde.com/developer-tools/guides/deploy-on-cloudflare-workers/)
- [Register and manage APIs](https://docs.kinde.com/developer-tools/your-apis/register-manage-apis/)

## Next.js

- [Proxy file convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16)
- [Authentication guide](https://nextjs.org/docs/app/guides/authentication)
- [Data security guide](https://nextjs.org/docs/app/guides/data-security)
- [`cookies()` reference](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [`connection()` reference](https://nextjs.org/docs/app/api-reference/functions/connection)

## Verified snapshot

- npm `latest` was `@kinde-oss/kinde-auth-nextjs@2.13.1`, published
  11 August 2026.
- v2.13.1 exports `withAuth` from
  `@kinde-oss/kinde-auth-nextjs/middleware`.
- Its npm peers accept selected Next 12–15 patch lines and Next
  `>=16.0.10`; Next 16 itself requires Node `>=20.9.0`.
- Next 16 uses `proxy.ts` and a fixed Node.js runtime. Next 13–15 use
  `middleware.ts` for this skill.
- The current SDK middleware refreshes tokens near expiry and supports
  string-prefix or RegExp `publicPaths`.
- Kinde server session helpers read request cookies. Next.js documents
  `cookies()` as a request-time API whose use in a layout or page opts the route
  into dynamic rendering. The skill therefore defaults shared navbar session
  presentation to the providerless client hook, while page data and
  authorization remain server-side.

## Conflicts and uncertainty

1. **Compatibility table versus package peers.** Kinde's SDK page summarizes
   support as Next 12–16 and lists 2.11.0 as the Next 16 minimum. v2.13.1 npm
   metadata has much narrower patch ranges and, unexpectedly, does not include
   Next 13.5. Use live npm peer metadata as the install gate; do not force an
   unsupported pairing.
2. **Async factory versus async helpers.** In v2.13.1,
   `getKindeServerSession()` is synchronous, while `isAuthenticated`,
   `getUser`, permission, organization, and token helpers return Promises.
   [PR #262](https://github.com/kinde-oss/kinde-auth-nextjs/pull/262)
   proposes an async factory for a future breaking v3 release but was not the
   current implementation at this snapshot.
3. **App Router refresh.** The SDK guide shows a server `refreshTokens`
   example, but v2.13.1 source explicitly marks that helper Pages Router-only
   and directs App Router users to client `refreshData`. Follow installed
   source/types: automatic middleware refresh plus `refreshData` for
   on-demand App Router refresh.
4. **Next 16 strict Edge runtime.** Normal Next 16 integration uses
   `proxy.ts`, which cannot run in Next's Edge runtime. The Next 16 upgrade
   guide allows retaining deprecated middleware for a strict Edge requirement.
   Treat this as an explicit, user-approved exception and never create both.
5. **Auth route example drift.** Current Kinde docs use
   `[kindeAuth]/route.ts`; the SDK repository playground has used
   `[...kindeAuth]/route.ts`. The handler accepts either a string or array, but
   this skill follows the current guide and requested single-segment route.
6. **Cookie-name drift.** The Kinde guide describes a client-ID-suffixed
   refresh cookie. v2.13.1 source uses `refresh_token` and supports split token
   cookie chunks. Inspect installed source and browser cookie names before any
   last-resort clearing operation.
7. **Redirect regex documentation gap.** v2.13.1 source supports
   `KINDE_POST_LOGIN_ALLOWED_URL_REGEX`, but the primary SDK guide does not
   document it. Treat it as defense in depth tied to the installed v2 source,
   not as a substitute for validating dynamic destinations.
