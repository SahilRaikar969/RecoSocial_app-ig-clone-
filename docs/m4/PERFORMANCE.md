# M4: navigation and data-loading performance

9 October 2026. M4 is IMPLEMENTED and locally validated. This report accompanies the single local M4 commit. No M5 work, dependency changes, schema changes, live Supabase writes, push or deployment are included. This handoff preserves the M1 security/public-account model, M2 mutation/media contracts and M3 recommendation behavior.

## Evidence and measurement scope

The baseline is the actual repository at M3 commit `20936987b7f483d82d2fc4c3401083eb3d6064ff`, rather than the original ZIP. Deterministic fixtures execute the real query/page/component code with synthetic data and count executed requests. They establish structural differences; they do not measure hosted database latency. Production build artifacts establish emitted JavaScript composition. Local browser checks exercise actual client components and a real Next router with synthetic backend responses. No live Supabase project was contacted or mutated for validation.

The original slow feeling was consistent with repeated per-card reads, eager inactive profile collections, duplicate notification lifecycle owners, eager media loading and navigation without pending feedback. No trustworthy before/after hosted TTFB, LCP, interaction latency, bandwidth saving or mobile-device benchmark was obtained. None is claimed.

## Before and after

| Journey / measurement | M3 baseline | M4 result | Cause and change |
|---|---|---|---|
| Moderation for 24 rendered non-owned feed cards | 48 table reads | 2 table reads | Two per-card lookups become one viewer-scoped hidden-ID batch and one report-ID batch |
| Default self-profile populated fixture | 19 data requests | 11 data requests | Only the active collection is loaded; inactive badges use head-only counts |
| Full inactive self-profile collections on initial Posts tab | 4 | 0 | Saved, liked, hidden and reported collections load only when selected |
| Non-default self-profile fixture | All collections loaded eagerly | 13 data requests, only selected collection loaded | Active data remains fresh; no persistent tab-data cache is introduced |
| Notification lifecycle owners in the shell | 3 mounted indicators independently own work | 1 provider-owned monitor; 3 presentational consumers | Removes duplicated verified-user reads, count refreshes and polling ownership |
| Notification work per normal refresh cycle | 3 auth reads + 3 count reads | 1 auth read + 1 count read | Identity is still verified with `getUser`; overlapping refreshes coalesce |
| Notification timers / channel setup | 3 separate effect lifecycles and channel setup attempts | 1 timer and at most 1 current verified-recipient channel per mounted shell | Prior shared-topic SDK behavior is not represented as 3 proven effective subscriptions |
| First of 13 Reels | 2 `auto`, 11 `metadata` | 1 `auto`, 1 `metadata`, 11 `none` | Only the active video receives full preload; immediate neighbor receives metadata |
| Middle of 13 Reels | 3 `auto`, 10 `metadata` | 1 `auto`, 2 `metadata`, 10 `none` | Active index controls preload policy as the viewer scrolls |
| Local `loading.tsx` boundaries | 7 | 16 | Missing social/editor/media route boundaries added; all announce status |
| Navigation intent | No link pending hint or search transition feedback | Router-driven link hint and visible/announced search pending state | Feedback appears while a cold or unfinished route request is pending; no artificial delay |

Moderation totals cover rendering moderation only, not all feed queries. Profile totals cover the deterministic populated self-profile data fixture, excluding middleware/Auth, layout, network protocol and browser notification work. Real row counts and service limits affect production totals.

## Data and rendering changes

`getViewerPostModerationStates` deduplicates rendered non-owned IDs and queries `hidden_posts` and `post_reports` concurrently, each with the verified viewer filter. Batches are capped at 200 IDs. An empty batch makes no request; a failure propagates to the route error boundary. FeedList and the hidden grid pass the returned state into cards. Direct standalone cards retain their existing fallback lookup. No ranking, filtering or order is changed by batching.

Self-profile routing resolves the active tab first, loads its full collection and requests only counts for inactive badges. Public profile routing similarly skips the liked collection until selected. Inactive collections no longer perform enrichment, aggregate save-count queries or media URL resolution. Missing/failed count reads are not silently presented as a verified empty collection. Counts keep the same viewer/visibility restrictions as their collection query. The base profile/public-post read remains shared by the current profile contract; optimizing that is deferred.

Existing independent work remains concurrent. M4 removes unnecessary enrichment chains rather than creating speculative parallel requests for tabs the user may never open. The feed still ranks its latest 80 eligible candidates and renders at most 24, using the M3 comparator and paging semantics. Following membership, hidden eligibility, private-save aggregate counts, likes/saves category affinity and Explore/Reels context remain unchanged.

## Notification sharing, authentication and cache isolation

`UnreadNotificationsProvider` lives inside the mounted application shell. Its context contains the unread count, not a global authenticated-user cache. Visual dots only consume that count. The provider dynamically imports the browser Supabase client after mounting, so optional notification code is outside the eagerly referenced root client dependency path. Routes without this shell do not start the monitor.

The monitor verifies the user for each refresh, scopes count and Realtime filters to that recipient, pauses polling while the document is hidden and refreshes when visibility returns. Concurrent poll/Realtime refreshes coalesce. Auth changes clear the old count/channel immediately and invalidate late responses by generation. Unmount removes listeners, timer, Auth subscription and channel, and suppresses pending responses. A new channel topic prevents asynchronous removal of an old same-user channel from closing a replacement after token refresh. Separate mounts start empty.

There is no `unstable_cache`, global personalized memo, cross-user feed cache or new server Auth cache. Middleware, page/action identity verification, RLS assumptions and mutation revalidation are preserved. Active tab navigation still reads fresh server data unless the existing Next client router cache can reuse its route result; M4 does not guarantee reuse or add a persistent tab cache. The notification monitor is client lifecycle sharing, not server request memoization.

## Navigation, errors and media

`NavigationLink` uses Next's `useLinkStatus` inside the link. It preserves default partial prefetch, hrefs, modified-click behavior and caller props. Its pending indicator is positioned without changing layout and animates only while pending. It covers shell/mobile navigation, feed view/paging links, profile tabs/grid and post-card links. Server pages and server-rendered children remain Server Components; the small pending indicator is an interactive client boundary.

SearchPanel and shell search wrap router updates in transitions and expose visible pending text plus an announced status. Existing loaders gain status text. New boundaries cover Saved, Messages, conversation, post detail/edit, profile edit, camera, story creation and story viewing. Prefetched route shells can appear before uncached data; no full-route forced prefetch, fake delay, Cache Components migration or experimental instant-navigation configuration is introduced.

The ordinary `app/error.tsx` fallback no longer renders nested `html`/`body` elements. Retry uses the installed Next runtime's `unstable_retry`, which refreshes the router and resets the error boundary; pending feedback accompanies it. Raw error messages are not exposed in the UI. The persistent root layout remains available.

Reels retain their URLs, posters, ordering and return context. Only the active Reel uses `auto` preload, immediate neighbors use `metadata`, and more distant videos use `none`. The current poster receives eager/high priority; other posters and decorative images are lazy. Existing M2 video, object-URL, crop and camera lifecycle behavior is preserved. `preload` is a browser hint: it does not guarantee a precise byte count or evict video data already fetched. No image proxy/optimizer, media URL rewriting, new transformed media, Storage deletion or signed-URL change is introduced.

## Production bundle evidence

The numbers below are gzip bytes summed over selected files referenced by each route's client-reference manifest. They are not complete browser transfer sizes, hydrated module memory, Core Web Vitals or timings. Framework files, shared caches and deferred imports change what a browser actually downloads. The source build and measurement script are identical before/after except for the M4 implementation.

| Client-reference artifact set | Before gzip bytes | After gzip bytes |
|---|---:|---:|
| Login | 81,412 | 27,118 |
| Feed | 91,661 | 37,367 |
| Profile | 92,352 | 38,058 |
| Explore | 93,418 | 39,274 |
| Reels | 88,016 | 33,758 |
| Create | 91,474 | 92,333 |
| Camera | 88,315 | 89,174 |
| All emitted client chunks, summed once | 351,394 | 352,439 |

All emitted chunks remain 27; raw bytes increase from 1,159,547 to 1,161,901. M4 does **not** reduce total emitted application JavaScript. The benefit is moving Supabase notification code out of the immediate root reference set. A mounted authenticated shell still downloads that deferred code after hydration; Create/Camera continue to need their feature dependencies. No blanket client-to-server conversion, framework removal or speculative memoization was performed.

These measurements were refreshed from the final passing production build after the notification reconnect fix. **BUNDLE-ARTIFACT MEASUREMENT — NOT DIRECT NETWORK TRANSFER.**

## Validation record

- Latest complete automated run: **218 passed** = M1 81 + M2 56 + M3 42 + M4 39. M4 consists of 17 data-fetching, 5 media, 7 navigation and 10 notification tests. The M1 suite includes all 17 recommendation compatibility tests and local PostgreSQL/RLS checks.
- Actual client-component browser fixture: **11 passed**, including Reel preload changes on scrolling, signed media/context preservation and shared notification lifecycle behavior. Synthetic services/files were used.
- Actual production Next router: authenticated Feed → Profile, profile Saved-tab pending → selected collection, Profile → Feed, Feed → Explore, Search pending → filtered results, search → Reels, browser Back/Forward preserving search context, Saved, post detail, profile edit and Create all rendered with the synthetic backend. Profile tabs showed “Loading page…”, search showed “Searching…”, and route shells announced their destination. An initial post-detail transition briefly remained blank; a direct reload and repeated Saved → post client transition then rendered correctly. No production latency claim is inferred. This is a manual journey record, separate from the 11 assertion-based component checks.
- Final production build, standalone TypeScript and generated database-type freshness: **PASS**. Changed-file lint: **43 files, 9 existing errors / 5 existing warnings; zero new or increased diagnostic groups** against the preserved audit baseline. Errors are six existing explicit-any diagnostics and three existing Reel effect diagnostics; warnings are existing image/hook diagnostics. The middleware deprecation warning remains.
- Global lint cleanup is outside M4. Existing `any` and image/hook warnings must be reported separately from new diagnostics; no new avoidable diagnostic groups are accepted.

Earlier attempts to start the synthetic backend and local Next server failed automatic approval review because the reviewer hit a usage limit; no safety finding was returned and neither launch ran. Their necessity and loopback/synthetic configuration were reviewed before later authorized launches succeeded through the same approval mechanism. The Next server was explicitly bound to 127.0.0.1. No approval control was bypassed. Authenticated synthetic router checks do not establish hosted Auth, RLS, Storage, PostgREST or Realtime behavior. Live Supabase remains **UNKNOWN / MANUAL LIVE VERIFICATION REQUIRED**; the [existing service checklist](../m1/LIVE-SUPABASE-VERIFICATION.md) still applies.

The production-router fixture provides synthetic responses with an 80 ms per-request delay solely to expose pending states; this delay is outside application source. Its video endpoint intentionally returns unavailable media, so those route checks do not prove real video playback. Separate real-component browser checks exercise the preload policy and media lifecycle. Actual hosted playback, reconnect delivery and media transfer costs remain manual checks. Retry behavior is covered by the focused component test and installed Next runtime inspection, not a hosted service-outage exercise.

Final source/security review found no M4 changes to middleware, server session validation, RLS/schema, ranking coefficients or mutation revalidation. No application import refers to fixtures or measurement scripts, and the selected patch contains no new credentials, debug logging or local-only application endpoint. Auth-change generation guards and unique subscription topics reject late counts and prevent delayed removal from closing a replacement; old channels are asynchronously closing, not retained as additional current owners.

Reproduce repository checks with `npm run test:m1`, `npm run test:m2`, `npm run test:m3`, `npm run test:m4`, `npm run typecheck`, `npm run types:check` and `npm run build` using safe local build configuration. Scratch instrumentation and screenshots remain outside Git.

## Changed source map

| Area | Principal files |
|---|---|
| Batched moderation | `lib/db/queries/post-moderation.ts`, `components/feed/feed-list.tsx`, `components/feed/post-card.tsx`, `components/profile/hidden-post-grid.tsx` |
| Active profile collections | `app/profile/page.tsx`, `app/profile/[profileId]/page.tsx`, `lib/db/queries/profile-collection-counts.ts` |
| Shared/deferred notifications | `lib/notifications/unread-monitor.ts`, `components/activity/unread-notifications-provider.tsx`, `activity-notification-dot.tsx`, `components/layout/root-chrome.tsx` |
| Pending navigation/search | `components/ui/navigation-link.tsx`, `components/layout/app-shell.tsx`, `mobile-nav.tsx`, `components/explore/search-panel.tsx`, `components/profile/profile-surface-tabs.tsx`, `profile-post-grid.tsx`, `app/feed/page.tsx`, `app/explore/page.tsx` |
| Route feedback | `components/ui/route-loading.tsx`, existing/new `app/**/loading.tsx`, `app/error.tsx` |
| Reels media policy | `components/reels/reel-viewer.tsx` |
| Regressions and commands | `tests/m4-data-fetching.test.mjs`, `m4-media.test.mjs`, `m4-navigation.test.mjs`, `m4-notifications.test.mjs`, relevant M3 fixture integration, `package.json` |

## Remaining debt and M5 boundary

Explore and interaction histories remain unbounded application queries subject to service response caps. Message summaries still retrieve excessive message bodies. Profile base/public-post loading can remain large even with inactive collections deferred, because existing header category highlights still use those posts. Inactive badge counts are exact visible totals, while an active collection can be truncated by the backend response cap; explicit collection pagination remains outstanding. Stable ranking snapshots/cursors, larger-corpus retrieval, database-side recommendation architecture and new indexes require separate evidence and scope decisions; no speculative indexes were added.

Responsive transformed images, measured image optimizer compatibility with signed/public Supabase URLs, complete upload-size/output variants and actual-device media/network profiling remain open. Reels preload policy reduces eager work but does not virtualize or unmount the entire distant slide list. Real hosted timing, query plans, concurrency, RLS/Auth/Storage/Realtime tests and network payload measurements remain manual verification work. Framework dependency/middleware deprecation, global lint and tutorial residue were not cleaned up in M4.

M5 is the explicitly requested major UI/UX, responsive design, accessibility and product-polish milestone. Start only after approval. Preserve legitimate Instagram-inspired social/feed patterns and independently engineered RecoSocial behavior; do not claim Meta's proprietary algorithm was reproduced. M4 does not authorize M5, README/resume work, deployment or unrelated repository cleanup.

Commit scope must exclude `.codex` measurement/browser artifacts, the copied historical audit tree and the two pre-existing ZIP deletions. This tracked handoff carries the reproducible milestone record. The canonical audit receives an M4 addendum but remains in its pre-existing untracked folder. Final intended local commit message: `perf: reduce navigation and data-loading overhead`. Do not push or deploy.
