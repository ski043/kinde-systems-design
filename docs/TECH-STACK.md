# MarshalDesk: Technology stack (v2)

> **For coding agents:** this is the source of truth for _how_ MarshalDesk is built. [`PRD.md`](./PRD.md) defines _what_ it does, and [`CONTEXT.md`](../CONTEXT.md) defines the vocabulary. Read all three before implementing anything. Several libraries here are pinned to pre-release or recently released versions, and your training data describes older versions, so **fetch the linked docs instead of relying on memory** (see "Versions and documentation sources").

|                |                                                                              |
| -------------- | ---------------------------------------------------------------------------- |
| Status         | v1 agreed (Sep 26, 2026). v2 updated (Nov 4, 2026): Kinde replaces Neon Auth |
| Companion docs | [`PRD.md`](./PRD.md), [`CONTEXT.md`](../CONTEXT.md)                          |

---

## 1. Overview

| Layer                              | Choice                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| App framework (frontend + backend) | Next.js 16, App Router, no `src/` directory                                                                      |
| Language                           | TypeScript, strict mode                                                                                          |
| UI                                 | Tailwind CSS + shadcn/ui                                                                                         |
| Forms and validation               | React Hook Form + Zod                                                                                            |
| API                                | oRPC v2 (beta), contract-first, served as both RPC and OpenAPI                                                   |
| Data fetching and mutations        | TanStack Query (via `@orpc/tanstack-query`), prefetched in server components                                     |
| Database access                    | Prisma 8 (release candidate), server-side only                                                                   |
| Database                           | Neon Postgres + pgvector                                                                                         |
| Auth                               | ~~Neon Auth (Managed Better Auth)~~ v2: Kinde (`@kinde-oss/kinde-auth-nextjs`, Management API)                   |
| Billing                            | v2: Kinde Billing (plans, metered usage, self-serve portal, webhooks), shared through `packages/kinde`           |
| Real time                          | PartyKit, now Cloudflare PartyServer (`partyserver` + `partysocket`)                                             |
| AI                                 | Vercel AI SDK 7 + Neon AI Gateway (`@neon/ai-sdk-provider` for chat, Qwen3 embeddings)                           |
| Background work                    | Neon Functions (storage trigger + schedule trigger)                                                              |
| File storage                       | Neon Object Storage                                                                                              |
| Markdown rendering                 | Streamdown                                                                                                       |
| Avatars                            | DiceBear                                                                                                         |
| Hosting                            | Vercel (web app), Cloudflare (real-time), Neon (database, functions, storage, AI gateway), Kinde (auth, billing) |
| Package manager and repo           | pnpm workspaces (no Turborepo)                                                                                   |
| Linting and formatting             | ESLint (flat config) + Prettier                                                                                  |

**Explicitly not used:** Neon Data API, row-level security, server actions, Drizzle, Biome, Turborepo, LangChain, Vercel or Neon WebSockets, client-side database access.

---

## 2. Repository layout

A pnpm workspace with three deployable apps and shared packages:

```
/
├── apps/
│   ├── web/          # Next.js 16: dashboard, widget iframe page, oRPC handlers, agent orchestration  → Vercel
│   ├── realtime/     # PartyServer on Cloudflare Workers + Durable Objects                            → Cloudflare
│   └── functions/    # Neon Functions: ingest, suggested questions, auto-close                        → Neon
├── packages/
│   ├── db/           # Prisma 8 schema, migrations, generated client, workspace-scoped data access
│   ├── kinde/        # v2: Kinde Management API client, billing state, usage reporting and reconciliation
│   └── shared/       # oRPC contract, Zod schemas, real-time event types, shared constants
├── docs/             # PRD.md, TECH-STACK.md
└── CONTEXT.md
```

The widget's embed script (the small loader a customer pastes into their site) lives in `apps/web/embed/` but has its own tiny build, separate from Next.js: **esbuild** bundles it to `apps/web/public/embed.js` (git-ignored, rebuilt by `dev` and `build`), served with a five-minute cache under a stable filename.

---

## 3. Frontend

- **Next.js 16 App Router**, no `src/` directory. Server components by default. Client components only where interactivity needs them.
- **No server actions.** Every read and write goes through oRPC procedures.
- **Tailwind CSS + shadcn/ui** for the dashboard _and_ the widget: one design system.
- **React Hook Form + Zod** for dashboard forms. Zod schemas come from `packages/shared` so forms and API inputs validate identically.
- **Streamdown** renders Markdown in messages. It's built for streaming AI text, so partially streamed agent replies render cleanly.
- **Widget:** the chat UI is a Next.js route (for example `/widget/[workspaceId]`) loaded in an iframe. The embed script is a tiny vanilla TypeScript bundle that injects the launcher bubble and the iframe into the customer's page, and passes position and color settings.
- **Dashboard widget settings** use the split layout from the PRD (settings on the left, a live widget preview on the right). The preview renders the real widget components.

---

## 4. API layer: oRPC v2 + TanStack Query

### Contract-first

1. Define the API as an **oRPC contract** (`@orpc/contract`) in `packages/shared`. Inputs, outputs and errors use Zod, and every procedure carries OpenAPI route metadata.
2. **Implement** the contract in `apps/web` with `implement(contract)`.
3. Serve the same implementation through **two handlers**:
   - `RPCHandler` for the app's own clients (dashboard and widget), for example at `/rpc`
   - `OpenAPIHandler` for REST access and a generated OpenAPI spec, for example at `/api`

### Base procedures and middleware

| Base                 | Used by   | Middleware adds to context                                                                                                           |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| ~~`ownerProcedure`~~ | Dashboard | ~~Verifies the Neon Auth session, loads the owner's membership, and adds `user` and `workspaceId`~~ v2: replaced by the ladder below |
| `visitorProcedure`   | Widget    | Verifies the visitor token (checked against the workspace's allowed domains) and adds `visitor` and `workspaceId`                    |

Errors are typed with the contract's `errors` definitions and thrown as `ORPCError`.

**v2 middleware ladder** (`apps/web/lib/orpc/procedures.ts`). Three separate checks, in this order, each its own middleware with its own typed error. Don't merge them.

| Step                          | Does                                                                                                                                                       | Typed error                               |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `base`                        | Shared context and error definitions                                                                                                                       | n/a                                       |
| `authenticatedProcedure`      | Verifies the Kinde session's access token and adds `{ kindeUserId, email, name, picture, orgCode, permissions, tokenIssuedAt }`                            | `UNAUTHORIZED`                            |
| `memberProcedure`             | Resolves the workspace by `orgCode` and the member by `kindeUserId` in that workspace, then adds `workspaceId`, `member`, and the effective `permissions`  | `WORKSPACE_REQUIRED`                      |
| `requirePermission(key)`      | Checks one permission key. Never checks role names                                                                                                         | `PERMISSION_DENIED` with `{ permission }` |
| `requireEntitlement(feature)` | Reply suggestions only (`reply_suggestions`): asks `checkEntitlement` (`apps/web/lib/billing/entitlements.ts`) whether the Kinde plan includes the feature | `PLAN_REQUIRED`                           |
| `visitorProcedure`            | Unchanged from v1                                                                                                                                          | `UNAUTHORIZED`                            |

`workspaceId` only ever comes from this context, never from client input. Hiding UI is a convenience, never the control.

Errors map to HTTP statuses in `ERROR_STATUS` (`packages/shared/src/contract.ts`), which both handlers use: `PLAN_REQUIRED` is 402 and `SUGGESTION_IN_PROGRESS` 409. ~~`QUOTA_EXCEEDED` 429~~ removed in milestone 8: Pro bills usage past the included units as extra, so nothing blocks on the allowance (section 6, Kinde Billing).

**Procedures outside the ladder's last steps:**

- `member.getCurrent` (`memberProcedure`, no permission) returns the member, their workspace, and their effective `permissions`. The dashboard reads permissions from it to hide navigation and controls, such as the **Suggest reply** button.
- `workspace.create` and `workspace.acceptInvitation` run on `authenticatedProcedure`, because the person has no workspace yet. `acceptInvitation` joins the workspace whose pending invitation matches the session's verified email (`NOT_FOUND` when none does, `ROLE_UNAVAILABLE` when the role isn't set up in Kinde). Both are idempotent and return a `continueUrl` that signs in to the workspace's organization.
- `inbox.suggestReply` adds one step between the permission and the entitlement: the conversation must belong to the workspace (`NOT_FOUND`) and be open (`CONFLICT`). Its output is an oRPC event iterator (see section 8).

**Session refresh on `/rpc`.** A dashboard tab calls RPCs for hours without navigating, so `proxy.ts` also matches `/rpc` and runs Kinde's `withAuth` there, which refreshes a near-expiry access token. `/rpc` is a public path for `withAuth`, and a request without Kinde's `refresh_token` cookie (a widget visitor) skips it, so a missing or unrefreshable session reaches the procedures and gets a typed `UNAUTHORIZED`. The browser client (`lib/orpc/client.ts`) reloads the page on `UNAUTHORIZED` or `WORKSPACE_REQUIRED`, so the page gates send the person to sign-in or wherever they belong now.

### TanStack Query

- **Server:** server components call procedures directly, in the same process with no HTTP (server-side client), to **prefetch** into a TanStack Query client, then hand the data to the browser with `HydrationBoundary`. Follow oRPC's documented TanStack Query and SSR setup; don't invent one.
- **Client:** `@orpc/tanstack-query` utilities (`createTanstackQueryUtils`) for `useQuery` and `useMutation`.
- **Real-time updates:** PartyKit events write directly into the TanStack Query cache (append a message, update a conversation's state) instead of triggering refetches.

---

## 5. Data: Prisma 8 + Neon Postgres

- **Prisma 8 (release candidate)** is used for its native, typed pgvector support (`@prisma/orm-extension-pgvector`): `vector(N)` columns and typed `cosineDistance` / `cosineSimilarity` queries. Prisma 8 requires Node.js 24+, which Vercel and Neon Functions both provide.
- **Fallback:** if Prisma 8 proves unstable, drop to **Prisma 7.10** (stable), with the vector column as `Unsupported("vector")` and the two vector operations (saving chunk embeddings, similarity search) as raw SQL. The change is contained in `packages/db`.
- **`packages/db`** owns the schema, migrations, the generated client, and all data-access functions. `apps/web` and `apps/functions` import from it and never create their own clients.
- **Migrations** run against the Neon `development` branch first, then `production`.
- **Server-side only.** The browser never talks to the database.
- **Tenant isolation, with no row-level security:** every data-access function that reads or writes workspace data takes `workspaceId` as a required argument and filters on it. `workspaceId` only ever comes from the procedure context (the session or visitor token), never from client input. Vector search filters by `workspaceId` before ranking.
- **Verify at implementation:** the recommended way to connect Prisma 8 to Neon from Vercel (serverless) and from Neon Functions.

---

## 6. Auth

- ~~**Neon Auth (Managed Better Auth)** handles owner accounts: email and password, magic link (fallback: an emailed 6-digit code, or drop it), Google sign-in, email verification by 6-digit code, and password reset. Emails go through Neon's shared sender.~~ v2: **Kinde** handles sign-up and sign-in through its hosted login. Sign-in methods, verification, recovery, and auth emails are configured in Kinde, not in the app. Neon Auth is no longer used and `@neondatabase/auth` is removed.
- ~~Sessions are read **server-side** in `ownerProcedure` and in server components.~~ v2: sessions are read **server-side** in `authenticatedProcedure` and in server components.
- **Kinde Next.js SDK:** `@kinde-oss/kinde-auth-nextjs` (latest 2.13.x) for the session, login redirects, and the verified access token. Permissions, roles, and `org_code` are claims in the access token. They are a snapshot until the token refreshes. Billing entitlements are not in the token; check them server-side.
- **Organizations stay inside the Kinde adapter.** A workspace is a Kinde organization. The words "organization" and `org_code` appear only in `apps/web/lib/kinde/*`. The workspace row stores `kinde_org_code`, unique.
- **Management API client** (`apps/web/lib/kinde/management.ts`): machine-to-machine client credentials (`KINDE_M2M_CLIENT_ID`, `KINDE_M2M_CLIENT_SECRET`, audience `${KINDE_ISSUER_URL}/api`). The token is cached in memory until about 5 minutes before it expires, because the Free plan allows 2,000 M2M tokens a month, so never fetch one per request. Responses are parsed with Zod at the boundary. Credentials live on the server only.
- **Permission freshness (PRD T-7, within one minute).** The fast path trusts the token's `permissions` claim. `members.access_changed_at` is bumped on every role change. If `access_changed_at > tokenIssuedAt`, the token is stale: the server fetches live permissions from `GET /api/v1/organizations/{org_code}/users/{user_id}/permissions`, caches them per (org, user) for 30 seconds in memory, and uses those. A removed member's row is gone, so removal is immediate. This lives in one small module, because it is a teaching point of the v2 video.
- **Wrong-org tokens.** The Kinde default organization (in development: `org_a3babe37bb69`) auto-receives new sign-ups, so a fresh user's token carries its `org_code`. The app never treats it as a workspace. If the token's `org_code` has no workspace but the person has a member row elsewhere, the browser is redirected to Kinde login with that workspace's `org_code` (re-auth into the right organization). If there is no member row and a pending invitation matches their verified email, the invitation is accepted. Otherwise they go to the first-run step.
- **First-run** (`workspace.create`, idempotent): create the Kinde organization through the Management API (name = business name, `external_id` = workspace UUID), add the user to it with the `owner` role, create the workspace and member rows in one database transaction (unique constraints make retries converge), then re-auth into the new `org_code`. If the Kinde organization exists but the row doesn't, look it up by `external_id` and continue. v2 billing: the organization is created as a Kinde billing customer (`is_create_billing_customer`, billing email = the owner's email), which puts it on the default organization plan (Free), and `workspaces.kinde_billing_customer_id` stores its customer id. Kinde refuses to delete an organization once it has a billing agreement, so a losing attempt can no longer delete its organization. Instead, first-run attempts for one person run one at a time under a Postgres advisory lock (`withAdvisoryLock("provisioning", kindeUserId)` in `packages/db`), so a concurrent attempt waits and then finds the winner's membership. The Management API can't add a billing customer to an existing organization, so creating it without billing and attaching billing after the race isn't possible.
- **Invitations are app-side.** The app stores the invitation (`invitations`: lowercased email, role `support` or `billing-admin`, status `pending | accepted | revoked`, one pending per workspace and email). When the invited person signs in and their verified email matches, the app adds them to the Kinde organization with that role through the Management API and creates the member row. Kinde does not send or track the invitation.
- **Roles and permissions** are defined in Kinde: permissions `conversations:read`, `conversations:reply`, `suggestions:create`, `knowledge:manage`, `widget:manage`, `members:manage`, `billing:manage`; roles `owner` (all), `support` (`conversations:read`, `conversations:reply`, `suggestions:create`), and later `billing-admin` (`billing:manage`). The Free plan allows 2 roles and 10 permissions, so `billing-admin` is added after a Pro upgrade. Code already accepts it as a role value. `members.role` is a display copy and is never used for checks.
- **Visitor tokens** are JWTs we sign ourselves with `jose`. They're long-lived, refreshed periodically, bound to one workspace, and stored in the widget iframe's browser storage. Only a hash is stored in the database.
  - HS256, `aud: "widget"`, claims `{ sub: visitorId, wid: workspaceId, host, vsk }`, 30-day lifetime, re-issued by `widget.start` once a day. `vsk` is a random per-visitor secret; the database keeps only its SHA-256, so refreshing a token in one tab doesn't sign out another.
  - `visitorProcedure` reads the token from `Authorization: Bearer`, checks it against the stored hash, and rejects it once its `host` is no longer an allowed domain, so removing a domain cuts off tokens already issued.
  - The embed script passes the page's hostname to the iframe. `widget.start` only issues tokens for allowed domains, and `proxy.ts` sends a per-workspace `Content-Security-Policy: frame-ancestors` built from the allowed domains (exact host, any port; `'none'` when the list is empty), so browsers refuse to render the widget anywhere else. The host is reported by the page, so a script outside a browser can still claim an allowed domain and start a session; a public chat widget accepts that, and the CSP is what keeps the widget off other sites. The same goes for "snippet installed", which is recorded on the first session for an allowed domain.
  - Outside production (`NODE_ENV !== "production"`), `localhost` is allowed for every workspace in `widget.start`, `visitorProcedure` and the `frame-ancestors` policy without being stored (`lib/visitor/development-hosts.ts`), and it never marks the snippet installed.

### Kinde Billing (v2)

- **Shared adapter.** `packages/kinde` (`@marshaldesk/kinde`) holds the Management API client (one cached M2M token per process), the billing calls, the billing state cache, and usage reporting and reconciliation, because both `apps/web` and the `jobs` function need them. The words "organization", "customer", and "agreement" stay inside it and `apps/web/lib/kinde/*`.
- **Plans** live in Kinde's development environment: `free` (the default organization plan) and `pro` (a fixed monthly charge plus the metered feature `reply_suggestions`, tiered graduated). Prices and the included units are read from Kinde, never hardcoded.
- **Billing state** (`getWorkspaceBilling`): the current agreement from `GET /api/v1/billing/agreements?customer_id=` (plan code, agreement id, and `current_period_start` / `current_period_end` as the **billing cycle**) and the plan name and features from `GET /api/v1/billing/entitlements?customer_id=&expand=plans`. The cycle falls back to the calendar month (UTC) only when Kinde reports no current period, or one that already ended while its roll lags. A workspace without a billing customer, or without a current agreement, has no plan.
- **Entitlement** (`checkEntitlement`): the plan includes reply suggestions when the customer has a `reply_suggestions` entitlement. Free has none, which is `PLAN_REQUIRED`. Its `entitlement_limit_max` is the included units shown on the Billing page (Kinde reports "no maximum" as 2147483647, read as no limit). It is not a hard limit: the dev environment accepted an absolute total of 201 against a grant of 200 (`current_usage: 201`, `units_granted: 200`), so usage past it is billed as extra and never blocked (PRD checklist 33).
- **Cache and freshness (PRD B-4).** Billing state is cached in memory per billing customer for 60 seconds. `workspaces.billing_changed_at` is bumped by billing webhooks, and a cached entry fetched before it is stale on every server instance, the same pattern as `access_changed_at` for permissions. The Billing page always reads fresh, so returning from the portal shows the new plan even without webhooks. `workspaces.plan` is removed: Kinde is the source of truth, and nothing in the app needs a copy.
- **Usage reporting (PRD S-8).** After a suggestion's ledger row is `succeeded`, `inbox.suggestReply` schedules `reportReplySuggestionUsage` with `after()`. Under a per-workspace advisory lock (`usage_report`) it counts the ledger's `succeeded` rows in the Kinde cycle and sends that total to `POST /api/v1/billing/meter_usage` with `meter_type_code: "absolute"`, then records it in `usage_reports` (workspace, feature, agreement, cycle, `reported_total`, `kinde_record_id`, `reported_at`). The count happens while holding the lock, so a later report always carries a total at least as new as an earlier one. A total equal to the last report for that agreement and cycle isn't sent again, and a repeat could only replace the total with itself. Kinde rejects a value of 0, so an empty cycle sends nothing. A failed report is logged and left to reconciliation.
- **Reconciliation (PRD S-9).** `reconcileReplySuggestionUsage` runs from `/triggers/reconcile-usage` in the `jobs` function every hour (`41 * * * *`). For each workspace with a billing customer and a succeeded suggestion in the last 35 days, it compares the ledger's cycle total with Kinde's `current_usage` (`GET /api/v1/billing/meter_usage`) under the same lock, logs any `usage.drift`, and reports the ledger's total again. Kinde ahead of an empty ledger is logged as unresolved, because 0 can't be sent. It runs hourly, not every 15 minutes, because a cold function instance fetches a new M2M token and the Free plan allows 2,000 a month. Workspaces without recent usage make no Kinde calls.
- **Billing page** (`/dashboard/billing`, `billing:manage`, section `billing` in `lib/dashboard-sections.ts`, before Team so a billing admin lands there). `billing.get` returns the plan name, the cycle dates, and reply suggestions used, included, and billed as extra. **Change plan** and **Manage payment details** call `billing.createPortalLink`, which asks the Account API (`GET /account_api/v1/portal_link`, `subnav` `organization_plan_selection` or `organization_payment_details`, `return_url` = the Billing page) with the member's own access token, on every click, because links are single use and expire after 10 minutes. Kinde itself checks the owner role's `org:read:billing` and `org:write:billing` system permissions inside the portal. The composer's upgrade message links here for `billing:manage` holders.
- **Webhooks** (`app/api/webhooks/kinde/route.ts`). The body is a JWT, verified (RS256) against `${KINDE_ISSUER_URL}/.well-known/jwks` with `jose`. Unsigned or wrongly signed bodies get `401`. `customer.agreement_created`, `customer.agreement_cancelled`, `customer.plan_assigned`, `customer.plan_changed`, and `customer.meter_usage_updated` bump `billing_changed_at` for the workspace whose billing customer id (or organization code) appears in the payload, or for every billed workspace when neither does, since Kinde doesn't document these payloads. Deliveries are deduplicated by the `webhook-id` header in `kinde_webhook_deliveries`, recorded only after handling, so a failed delivery is retried. Kinde can't call `localhost`: register the webhook against a deployed preview or a tunnel (for example `cloudflared tunnel --url http://localhost:3000`) in Kinde's development environment under Settings > Webhooks, with the events above. Until then, the Billing page's fresh read and the 60-second cache keep local testing working.

---

## 7. Real time: PartyKit (Cloudflare PartyServer)

- **Source of truth for docs: [github.com/cloudflare/partykit](https://github.com/cloudflare/partykit)** (`packages/partyserver` and `packages/partysocket`). The old partykit.io docs are conceptually similar, but their package names, import paths and deployment (the PartyKit CLI instead of `wrangler`) are out of date.
- Server: `partyserver` on Cloudflare Workers + Durable Objects, deployed with `wrangler` from `apps/realtime`.
- Clients: `partysocket` in the dashboard and the widget.
- **Rooms:** two party classes, both with hibernation (`static options = { hibernate: true }`), and rooms named by id. `Conversation` (room = conversation id) carries messages, streamed agent text, typing indicators and state changes to the visitor and any member viewing it. `Workspace` (room = workspace id) carries inbox updates and notifications to members only. URLs are `/parties/{conversation|workspace}/{id}`. The event types live in `packages/shared/src/realtime.ts`.
- **Connection security:** both the dashboard and the widget open sockets with a **realtime token** minted by Next.js: jose HS256 with `REALTIME_TOKEN_SECRET`, `aud: realtime`, 60 s expiry, used only to open the socket. Claims are `{ role: "member", workspaceId, memberId, conversationId? }` or `{ role: "visitor", workspaceId, visitorId, conversationId }` (`realtimeTokenClaimsSchema`); the Worker keeps the role and the member id in the connection state. `partysocket`'s async `query` fetches a fresh one on every reconnect. Members get it from `realtime.getToken` (~~`ownerProcedure`~~ v2: requires `conversations:read`, and first confirms a conversation belongs to their workspace), visitors from `widget.getRealtimeToken` (for the conversation the widget shows, their latest by default, after checking it's theirs). The Worker doesn't verify ~~Neon Auth~~ Kinde tokens: the Worker stays auth-provider-agnostic, and a Kinde token carries `org_code`, not our `workspaceId`, so the Worker would need database access to map a user to a workspace or conversation.
- **Room checks:** `onBeforeConnect` verifies the token (missing, invalid, expired or wrong audience → 401) and its claims against the room: `workspace` only for a member of that workspace, `conversation` only for the token's `conversationId` (otherwise 403). It then strips client-sent `x-marshaldesk-*` headers and sets trusted ones, which `onConnect` stores in the connection state.
- **Publishing:** the Next.js server POSTs one event per request to the room with `Authorization: Bearer ${REALTIME_PUBLISH_SECRET}`, a separate secret the Worker checks in constant time. The body is validated against the room's event schema and broadcast. Publishing never fails the user's write: each POST is time-boxed and failures are only logged.
- **Client messages:** only typing may originate from clients, and only in a conversation room. The Worker relays it with the role from the token, never from the message. Everything else goes through oRPC.
- **Revocation (v2, milestone 7):** when a member is removed, or a role change leaves them without `conversations:read` (checked against Kinde's live permissions), the server publishes `member.revoked { memberId }` to the workspace room. The event is never broadcast. The `Workspace` room closes that member's sockets with close code `4403` (`REALTIME_REVOKED_CLOSE_CODE`), then reaches every `Conversation` room the member has open through a **conversation-room registry**: when a member's socket opens in a conversation room, that room registers itself with the workspace room (Durable Object storage key `conversation-rooms:{memberId}`), and unregisters when the member's last socket there closes. A socket that can't be registered is closed so the client retries, and a stale entry only costs one extra call at revocation. On `4403` the dashboard reloads the page instead of reconnecting. The token's 60 s expiry bounds reconnection, and `realtime.getToken` refuses the removed member.
- **Rule:** every message is saved to Postgres **before** it's published. PartyKit only delivers, and clients rebuild their state from the API when they reconnect.
- **Knowledge base events:** the workspace room also carries `source.updated`, `source.deleted` and `knowledge.updated` (suggested questions and whether the agent has knowledge), published by the web app and the `jobs` Neon Function with the same secret.
- **Development:** the dev Worker is deployed as ~~`marshaldesk-realtime-dev`~~ `marshaldesk-kinde-realtime-dev` (`pnpm realtime:deploy:dev`) and `REALTIME_URL` / `NEXT_PUBLIC_REALTIME_HOST` point at it. The Worker validates events against `packages/shared/src/realtime.ts`, so redeploy it whenever those schemas change.

---

## 8. AI

- **Vercel AI SDK 7** (`ai@7`) for every model call: classification (structured output), answers (streaming, image input), and suggested-question generation.
- **Neon AI Gateway** for every model call. Needs a Launch or Scale plan. Chat models go through `@neon/ai-sdk-provider` (`createNeon({ baseURL, apiKey })`; OpenAI models use the Responses API). Embeddings go through the gateway's OpenAI-compatible `/v1/embeddings` with `@ai-sdk/openai` 3.x (`createOpenAI({ baseURL: "<gateway>/v1" })`), because the Neon provider has no embedding models. One account limit of 200k tokens per minute covers both.
- **Models** (`packages/shared/src/agent.ts`). Every call pins its reasoning effort with `providerOptions.openai.reasoningEffort`, because the default is slow:

  | Use                                               | Model                                                        | Effort   |
  | ------------------------------------------------- | ------------------------------------------------------------ | -------- |
  | Classifier (`Output.object` with the four labels) | `gpt-5-4-nano`                                               | `none`   |
  | Off-topic refusals and small talk                 | `gpt-5-4-nano`                                               | `none`   |
  | Answers (streamed, with a `cannot_answer` tool)   | `gpt-5-6-terra`                                              | `none`   |
  | Suggested questions                               | `gpt-5-6-terra`                                              | `medium` |
  | Embeddings (chunks and queries)                   | `qwen3-embedding-0-6b`, 1024 dimensions, unit length, cosine | n/a      |

  Queries get Qwen's instruction prefix; chunks don't. No Gemini: through the Neon provider it goes via Chat Completions without structured output. Image input (AI-6) is deferred with attachments.

- **Retrieval tuning:** top 5 chunks; the best must reach cosine similarity 0.5 or the question hands off with `no_relevant_knowledge`; once it does, the others at 0.4 or more join it as context. The last 10 visitor, agent and member messages go along as history, and follow-ups of six words or fewer are embedded both alone and together with the previous visitor question, keeping whichever retrieves the better match. Search selects the workspace's chunks first (a materialized CTE), then ranks them.
- **"Can't answer":** the answer model calls the `cannot_answer` tool instead of writing text, which hands off with `low_confidence`. Nothing is published until 40 characters have arrived, so a tool call after a short lead-in is never seen; anything streamed before a later tool call is dropped (`agent.done`) and never saved.
- **Untrusted data:** each history message is its own `<message from="visitor|agent|team_member">` block with the author outside the body, and data can't open or close a block, so a visitor can't forge team member lines.
- **Streaming:** each `agent.chunk` carries the whole reply so far, batched (one publish in flight, at least 60 ms apart), so a client that joins mid-stream catches up. On success the reply is saved first and published as `message.created` with the streamed id, then `agent.done`; a discarded turn only publishes `agent.done`. The agent writes only while the conversation is `ai` and the visitor message it answers is still the conversation's newest message (`last_message_at`; checked before and every 300 ms during streaming, and again in the guarded save), so a take-over, hand-back or newer visitor message wins.
- **Reply suggestions (v2, milestone 9).** Contract `inbox.suggestReply` (`POST /conversations/{conversationId}/reply-suggestions`, input `conversationId` and a uuid `idempotencyKey`). Its output is an **oRPC event iterator** (`eventIterator(replySuggestionEventSchema)`), served by the existing `RPCHandler` and `OpenAPIHandler` as server-sent events, so the draft streams **over HTTP to the requesting member only**. It never goes through PartyKit, because the visitor's widget listens there. Events are `{ type: "delta", text }` while the model writes and one `{ type: "done", body, replayed }` at the end.
  - **Order:** authenticated, member, `suggestions:create`, conversation belongs to the workspace and is open, entitlement, ledger claim, model. Every check before the claim runs before the response starts, so its error is a normal typed error with its HTTP status, and nothing is written.
  - **Context** (`apps/web/lib/agent/reply-suggestion.ts`): the last 10 messages (`AGENT_HISTORY_MESSAGES`) plus `retrieveKnowledge` for the latest visitor message (with the previous one for short follow-ups), in the same `<conversation>` and `<knowledge_base>` blocks as the agent, so `neutralize` and the untrusted-data and sender rules apply unchanged. The relevant chunks go to the answer model (`AGENT_MODELS.answer`). There's no `cannot_answer` tool: when no chunk is relevant the block says so, and the draft says plainly that the member doesn't have that information. The draft is written as the member's own reply, in the language of the visitor's latest message.
  - **Ledger and idempotency** (`packages/db/src/reply-suggestions.ts`): `reply_suggestions` is the usage ledger. `claimReplySuggestion` runs `INSERT ... ON CONFLICT (workspace_id, idempotency_key) DO NOTHING` to claim a `pending` row. The same key already `succeeded` replays the stored body as a single `done` event with `replayed: true` and counts nothing. The same key `pending` returns `SUGGESTION_IN_PROGRESS`. The same key `failed`, or `pending` for more than 6 minutes (its request outlived the 300 s route limit), moves back to `pending` on the same row and generates again. A key is bound to its conversation; reusing it for another one is a `BAD_REQUEST`.
  - **Count once:** `finishReplySuggestion` changes only a `pending` row. A row becomes `succeeded` only after the stream finishes with `stop` and a non-empty trimmed body (the agent's `assertNormalFinish` and `nonEmptyReply` checks), and before `done` is sent, so a client that loses the connection at the very end gets the stored draft on retry. Abort, timeout (nothing within 20 s, or over 60 s), provider error, or empty output is `failed`, with the error. The member cancelling aborts the request: oRPC aborts the handler's `signal` or closes the iterator, and both end in `failed`. Each row records the model, tokens (embedding plus model), latency, and error (PRD S-10), and the server logs a `[suggestion]` line per attempt. Usage for a cycle is the count of `succeeded` rows by `finished_at`. Never report from inside the stream loop.
  - ~~**Temporary entitlement (until milestone 8):** plan from `workspaces.plan`, a `PRO_INCLUDED_SUGGESTIONS` allowance per calendar month, `QUOTA_EXCEEDED` past it.~~ Milestone 8: `checkEntitlement` reads the plan from Kinde Billing, the cycle is the agreement's billing period, and usage past the included units is billed, not blocked (section 6, Kinde Billing). Pending rows don't count. After a row is `succeeded`, the handler reports the cycle total to Kinde with `after()`.
  - **Composer** (`components/inbox/composer.tsx`, `use-reply-suggestion.ts`): **Suggest reply** shows for members with `suggestions:create` (from `member.getCurrent`) and is disabled in closed conversations. Each click makes a new idempotency key. A dropped connection or `SUGGESTION_IN_PROGRESS` is retried up to twice with the same key. The draft streams into the textarea, read-only until it finishes, and **Stop** cancels it. A cancelled or failed suggestion restores the draft it started from, because it isn't counted. `PLAN_REQUIRED` shows an upgrade message that links to the Billing page to members with `billing:manage`, and "Ask your workspace owner to upgrade" to everyone else.
- **Execution:** the widget's `sendMessage` procedure saves the message and returns right away. The agent pipeline (classify, embed, retrieve, answer) starts as soon as the message is saved and is handed to Next.js's `after()`, within the 300-second `maxDuration` of the oRPC routes, and streams text chunks to the conversation's PartyKit room. The final message is saved to Postgres when streaming finishes. Every turn writes one `agent_turns` row (AI-11).

---

## 9. Background work: Neon Functions

One Neon Function, `jobs`, in `apps/functions`, declared in the root `neon.ts` (`@neon/config/v1`) together with its triggers, and deployed with `neon deploy` (`pnpm functions:deploy:dev` targets the `development` branch and reads its env from `apps/web/.env.local`). `neon.ts` also declares `aiGateway: true` and both buckets (`uploads`, and `profile-images` as public-read). It runs on Node.js 24, imports `packages/db` as TypeScript source (bundled by the Neon CLI's esbuild; the pooled `DATABASE_URL` is injected), and routes by path:

| Route                       | Called by                                          | Auth                                                                                                  |
| --------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/triggers/source-uploaded` | Storage trigger on `uploads`, prefix `workspaces/` | `X-Neon-Trigger-Invocation-Id` (Neon strips client-sent `X-Neon-*`), or the bearer secret for replays |
| `/triggers/auto-close`      | Schedule trigger, `*/15 * * * *` UTC               | Same                                                                                                  |
| `/triggers/reconcile-usage` | Schedule trigger, `41 * * * *` UTC (v2)            | Same                                                                                                  |
| `/ingest/text`              | Web app, from `after()`                            | `Authorization: Bearer ${FUNCTIONS_SECRET}`, compared in constant time                                |
| `/suggested-questions`      | Web app after a delete                             | Same                                                                                                  |

Routes answer `202` and work in `waitUntil`. Triggers are at-least-once, so ingest is idempotent: every run claims the next `sources.revision`, reads the file or text after claiming, and swaps the chunks in one transaction only while its revision is still the latest. A storage event only carries the bucket and key, so the function parses the workspace and source ids from the key, checks the source row belongs to that workspace with that exact key, HEADs the object, and skips a pure duplicate by ETag. Status changes publish `source.updated`, and suggested questions publish `knowledge.updated`, to the workspace room. Frankfurt is a supported Functions region.

| Function            | Trigger                                                                         | Does                                                                                  |
| ------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Ingest              | Object Storage file-created trigger (text sources are sent directly by the app) | Parse → chunk → embed → save chunks and vectors → update the source's status          |
| Suggested questions | After any knowledge base change                                                 | Regenerate the workspace's four suggested questions                                   |
| Auto-close          | Schedule trigger (for example every 15 minutes)                                 | Close open conversations with no messages for 24 hours, and publish the closed notice |

- **PDF parsing:** `unpdf`. Markdown and TXT are read as-is.
- **Chunking:** a small custom splitter (by headings, then paragraphs, then sentences; about 800 tokens, estimated as characters ÷ 3.5, with about 100 tokens of overlap; each chunk starts with its heading path). No LangChain.
- **Failures** keep the previous version answering: a source that already has chunks stays `ready` with the readable reason in `error`; one without becomes `failed`. The 15-minute schedule also sweeps sources stuck in `uploaded` or `processing` for 15 minutes the same way, and an uploaded file whose source no longer exists is deleted.
- **DOCX** is deferred (PRD K-7).

---

## 10. Storage and uploads

- **Neon Object Storage** (S3-compatible) holds knowledge files, image attachments, and uploaded avatars.
- Uploads go **directly from the browser** using short-lived presigned URLs issued by an oRPC procedure, which enforces type and size first (10 MB).
- **Buckets:**
  - `profile-images` is **public-read**. It holds agent avatars (and later member photos), which the dashboard and widget load straight from the object's public URL: `${STORAGE_PUBLIC_BASE_URL}/profile-images/<key>`.
  - `uploads` is private and holds source files at `workspaces/<workspaceId>/sources/<sourceId>.<ext>` (attachments will use another prefix). `knowledge.createUpload` creates or reuses the source row first (same name, same source and key), then presigns a 5-minute PUT that signs `Content-Type` (derived from the extension) and `Content-Length`. On the development branch this bucket is inherited from the parent branch, so its CORS rule can only be changed there; the inherited rule already allows browser PUTs.
- **Agent avatars** are limited to **2 MB** (Jan's decision; the 10 MB in PRD L-3 applies to attachments and sources) and must be PNG, JPEG, WebP or GIF.
- **Avatar flow:**
  1. `createAvatarUpload` checks the declared type and size and generates the key on the server, under the workspace's prefix: `workspaces/<workspaceId>/agent-avatar/<uuid>.<ext>`. It returns a presigned PUT (valid for 2 minutes) that signs `Content-Type` and `Cache-Control: public, max-age=31536000, immutable`, which is safe because every upload gets a new key.
  2. The browser PUTs the file with exactly those headers.
  3. `confirmAvatarUpload` accepts only keys under the caller's own prefix, then HEAD-checks the stored object's real size and type. A presigned PUT can't limit size, so this is the actual 2 MB check. Rejected objects are deleted. On success it saves the key and only then deletes the previous avatar (a failed delete is logged and leaves an orphan).
  4. `removeAvatar` clears the key and deletes the object, and the widget falls back to the generated DiceBear avatar.
  - Uploads that are presigned but never confirmed are left in the bucket. That's acceptable for v1.
- **CORS** on `profile-images` (allowing PUT, GET and HEAD from `NEXT_PUBLIC_APP_URL`) is set by `pnpm --filter @marshaldesk/web storage:cors`. Pass extra origins as arguments. It's idempotent, so run it once per branch's storage and again whenever the app's origin changes.
- **SDK settings:** `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` with `forcePathStyle: true`, and `requestChecksumCalculation` and `responseChecksumValidation` set to `WHEN_REQUIRED`. Without that, the presigner signs a checksum of an empty body and every browser PUT fails.

---

## 11. Visitor details

- **Country and city:** `geolocation()` from `@vercel/functions`, which reads the location headers Vercel adds to every request. No geo-IP service, and the raw IP is never stored.
- **Timezone, local time and language:** sent by the widget from the browser, which is more accurate than IP-based guesses.
- **Device, browser and OS:** parsed from the user agent with `ua-parser-js`.

---

## 12. Tooling

- **TypeScript strict** in every package.
- **pnpm workspaces.** No Turborepo.
- **ESLint** (flat config, `eslint-config-next`) + **`eslint-config-prettier`**, and **Prettier** with `prettier-plugin-tailwindcss`. One shared config at the repo root.
- **No automated test suite in v1.** The manual checklist in the PRD (section 9) is the acceptance test. Run the type check before calling any change done, because end-to-end types are the main correctness signal.

---

## 13. Deployment and environments

| Target     | Deploys                                  | Tool                                 |
| ---------- | ---------------------------------------- | ------------------------------------ |
| Vercel     | `apps/web`                               | Vercel Git integration               |
| Cloudflare | `apps/realtime`                          | `wrangler`                           |
| Neon       | Database, functions, storage, AI gateway | Neon CLI (`neon.ts` + `neon deploy`) |
| Kinde      | Auth, organizations, roles, billing (v2) | Kinde dashboard and Management API   |

- **Neon branches:** `development` and `production`. Migrations always hit `development` first. The v2 dev project is `marshaldesk-kinde` (`muddy-silence-73909905`). v2 starts from a fresh database.
- **Kinde environments (v2):** the business is `systemsdesignlocal` on the Free plan. Development work uses its development environment (`systemsdesignlocal-dev.eu.kinde.com`), which mirrors the Neon `development` branch. Roles and permissions are business-level, so both environments share them.
- **Region:** Frankfurt preferred, Ohio is fine.
- ~~**Google sign-in** in production needs our own Google app credentials, configured per Neon branch.~~ v2: Google sign-in, if used, is configured in Kinde.

---

## 14. Versions and documentation sources

Your training data is likely out of date for these. Always check the linked source.

| Library                                                      | Version                                 | Docs                                                                                           | Watch out for                                                                                                             |
| ------------------------------------------------------------ | --------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Next.js                                                      | 16                                      | [nextjs.org/docs](https://nextjs.org/docs)                                                     | App Router, `after()`                                                                                                     |
| oRPC                                                         | **v2 beta** (`2.0.0-beta.x`, pin exact) | [orpc.dev](https://orpc.dev) ([llms.txt](https://orpc.dev/llms.txt))                           | A plain install gives **v1**. Install with `@beta`. v1 docs live at v1.orpc.dev and are wrong for v2                      |
| Prisma                                                       | **8 release candidate**                 | [prisma.io/docs/orm/v8](https://www.prisma.io/docs/orm/v8)                                     | New architecture (contracts, new CLI). Prisma 7 knowledge doesn't carry over                                              |
| Vercel AI SDK                                                | 7                                       | [ai-sdk.dev/docs](https://ai-sdk.dev/docs)                                                     | v7 released Jun 25, 2026. v6 examples may not match                                                                       |
| PartyServer                                                  | latest                                  | [github.com/cloudflare/partykit](https://github.com/cloudflare/partykit)                       | Not partykit.io                                                                                                           |
| Neon (Functions, Storage, AI Gateway; ~~Auth~~ unused in v2) | GA since Sep 18, 2026                   | [neon.com/docs](https://neon.com/docs)                                                         | `neon.ts` uses top-level `functions`, `buckets`, `triggers`; the Neon provider has no embeddings                          |
| Kinde Next.js SDK (`@kinde-oss/kinde-auth-nextjs`)           | latest 2.13.x                           | [docs.kinde.com](https://docs.kinde.com), [github.com/kinde-oss](https://github.com/kinde-oss) | Permissions, roles, and `org_code` are token claims and go stale. Entitlements aren't in the token                        |
| Kinde Management API                                         | current spec                            | [api-spec.kinde.com](https://api-spec.kinde.com/kinde-management-api-spec.yaml)                | M2M token must be cached (Free plan: 2,000 tokens a month). `POST /api/v1/billing/meter_usage` has **no idempotency key** |
| TanStack Query                                               | 5                                       | [tanstack.com/query](https://tanstack.com/query)                                               | Use it through `@orpc/tanstack-query`                                                                                     |

---

## 15. Deferred to implementation

1. ~~Models~~ Resolved: see section 8
2. ~~DOCX support~~ Resolved: deferred
3. ~~Whether magic links work with Neon's shared email sender~~ Superseded in v2 (item 9)
4. DiceBear avatar style
5. ~~PartyServer details~~ Resolved: `Conversation` and `Workspace` party classes with hibernation, rooms named by id, sockets opened with short-lived Next-minted realtime tokens checked in `onBeforeConnect`, and publishing over HTTP with a separate secret (see section 7)
6. ~~How Prisma 8 connects to Neon on Vercel and in Neon Functions~~ Resolved: the same `postgres()` runtime over `pg` with the pooled `DATABASE_URL` in both; the Neon Function bundles `packages/db` as TypeScript source. pgvector comes from `@prisma/orm-extension-pgvector` 8.0.0-rc.13, registered in `prisma.config.ts` and the client; the HNSW index is hand-written in the migration
7. ~~The embed script's bundler~~ Resolved: esbuild (see section 2). It is a single, fast devDependency with no config, and the loader is one small vanilla TypeScript file
8. ~~Whether to use `neon.ts` + `neon deploy`~~ Resolved: yes, for the `jobs` function and its triggers (section 9)
9. ~~Whether magic links work with Neon's shared email sender~~ Superseded in v2: sign-in methods are configured in Kinde
10. ~~Kinde organization creation~~ Resolved: from the first-run step through the Management API, `external_id` = workspace UUID (section 6)
11. ~~Invitations~~ Resolved: app-side. The app stores the invitation and adds the user to the Kinde organization with the role through the Management API on first sign-in (section 6)
12. ~~Permission freshness~~ Resolved: token claims on the fast path, a live Management API lookup cached for 30 seconds when `access_changed_at > tokenIssuedAt` (section 6)
13. ~~Suggestion streaming~~ Resolved: HTTP to the requesting member only, never PartyKit (section 8)
14. ~~Entitlement check~~ Resolved: Management API billing entitlements by the workspace's billing customer id, cached 60 seconds and made stale by billing webhooks; the cycle comes from the agreement's current period. Usage is reported as serialized `absolute` totals from the ledger and reconciled hourly (section 6, Kinde Billing)
15. ~~Prices~~ Resolved: set in Kinde only (Pro's fixed monthly charge and the tiered `reply_suggestions` price, units past the included ones billed). The app reads the plan name and included units from Kinde and shows no prices; the portal does
