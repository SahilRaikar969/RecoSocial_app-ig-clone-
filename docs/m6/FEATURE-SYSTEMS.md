# M6 feature systems

12 October 2026. M5 baseline: `f1431616599ccd88c8c46f0fe48e23df62941016`.

This milestone extends the existing Next.js 16.3.8 / React 19.2.4 / Supabase application. Server Components still load and authorize initial content; client components own capture, media, optimistic messaging and realtime lifecycles. No framework, runtime dependency, hosted service, OAuth button or ML system was added. Instagram-inspired social and discovery patterns remain intentional RecoSocial product behavior.

## Evidence boundaries

- **Repository verified:** query/action/component paths, forward migrations, grants, ownership checks, bounded Feed/Stories/messages windows and client lifecycle ownership.
- **Locally tested:** real query/action/component modules with synthetic inputs; real migrations/functions/RLS in disposable PGlite PostgreSQL with Auth/Storage contract stubs; production build and types; production browser application against disposable local HTTP/realtime fixtures.
- **Live Supabase unknown:** deployed migration history, GoTrue email/PKCE settings, Storage object policies and signed URLs, hosted PostgREST joins/limits, Realtime publication/delivery and separate-session production concurrency.
- **Manual device verification required:** physical camera permissions, actual front/rear capture, orientation/codecs, mobile browser interruptions and representative device performance.

No hosted Supabase mutation, deployment or push was performed. Local fixture behavior does not prove hosted security or delivery.

## Recommendation V2

See [RECOMMENDATION-V2.md](RECOMMENDATION-V2.md) for the exact equations, query contracts, controlled corpus and privacy tests. The earlier Feed used unbounded current like/save category sums, fixed follow/exploration bonuses, uncapped aggregate engagement and stepped freshness. V2 uses latest 200 current likes, saves and comments each within 180 days, 30-day interaction decay, capped category and creator affinity, capped logarithmic engagement, smooth freshness and a bounded local diversity pass. One event's topic weight is split between unique categories; repeated comments on one post contribute only their newest event to personal affinity.

Current likes, saves, comments, selected topics and follows influence subsequent queries. Unlike/unsave/comment deletion/unfollow remove their applicable contribution on the next query. Own-post events do not teach personal affinity. No views, dwell time, watch completion, sentiment analysis, embeddings, neural model or proprietary Meta algorithm are implemented. Hiding excludes the post; it does not erase earlier affinity or penalize a whole creator/topic. Authenticated Explore retains its separate earlier ranker; V2 is not a claim about every discovery surface.

The newest 80 eligible public posts are ranked before 24-post pagination. Following is strictly filtered before the candidate cap and has no popularity fallback. The short-lived `at` anchor fixes candidate creation cutoff and candidate recency for up to 30 minutes. Current interaction history and its decay, counts, preferences, follow membership and authorization remain current. This is not an immutable ranking snapshot: mutations or interaction decay can move posts between independently fetched pages. Older relevant content outside the 80-candidate window is unavailable to the scorer.

The core Feed path makes 8 authenticated database calls, or 2 as a guest, when candidates exist; session, Stories and rendered-card moderation are separate. Candidates carry aggregate counts and caller-owned flags, without nested saver identities or comment bodies. Follow/hidden sets retain unpaginated reads, and exact popularity counts scan matching index entries, so the bounded candidate/history windows are not a constant database-work claim.

Controlled local observations: selected fitness produced 6/8 matching top-eight results, travel 7/8, and cold start a 4/4 mix. In an interaction/removal scenario, fitness rose from score 3 to 11 after a fresh like/save, fell to 5.575425 after 60 days, and returned to 3 after removal. A repetition corpus changed the first six from one creator to three from that creator and three distinct creators. These are deterministic sanity checks, not measured retention, satisfaction or A/B relevance improvements.

## Camera

An explicit session generation prevents late permission responses from resurrecting a closed or switched stream. Every acquired track is stopped on close, switch, capture completion, unmount, page hide and backgrounding. Returning from background requires explicit retry. Device enumeration supports available cameras; denial, no device, busy device, insecure context and unsupported API have actionable copy and upload fallback.

Photo capture retains the frame aspect ratio, caps its longest edge at 1920 pixels and produces JPEG. Video recording selects a supported WebM/MP4 format, stops at 60 seconds or a 40 MiB chunk threshold and rejects empty/oversized output. Preview, retake and publishing use the existing owner-scoped validated upload path; duplicate/stale capture completion is suppressed and blob URLs/recorder resources are released. Physical permissions, orientation, codecs and actual capture-to-upload remain real-device checks. The browser fixture verified the pending-camera state and returning to upload, not a hardware permission grant.

## Stories

Images advance after **six seconds** of loaded, visible, unpaused viewing. Videos progress on playback and advance on ended. Pause, reduced motion, backgrounding, keyboard arrows/Escape/Space, swipe and previous/next navigation affect the real viewer. Source changes reset readiness and retries; loading/buffering has a timeout and explicit retry. A late play promise cannot revive paused or unmounted media. Buffering followed by `canplay` can resume without requiring a second `loadeddata` event.

Only loaded visible images or successfully playing videos can record seen state. Guests never write it, and failed authenticated writes remain retryable. The viewer route keys by requested Story ID, including direct navigation within one author. The rail chooses the oldest unseen item per author and cross-author navigation follows that rail's order.

The existing **six-hour expiry** remains authoritative. The rail contains at most 200 latest active stories; an author window contains up to 200 chronological active items, retaining a directly requested active item even outside that initial window. This is not complete pagination for very prolific authors. Rail database calls are 4 authenticated / 2 guest; viewer including rail is 8 / 5, excluding session verification and assuming populated data. Expiry hides content but does not physically delete previously public Storage objects; reclamation remains deferred.

## Messages

Initial thread history is the latest 50 rows, with older history fetched by `(created_at,id)` cursor. Inbox pages contain 50 threads, and PostgreSQL microseconds are preserved in cursor URLs. Client-generated UUIDs identify send attempts; retries reuse the same ID and reconcile with authoritative rows. Unconfirmed/retry feedback retains the message. Existing participant history remains readable after unfollow; new sends require the current mutual-follow relationship.

A viewer-scoped monitor treats Realtime events as invalidations, then reads ordered database rows from its last confirmed cursor. Each batch contains at most 100 rows, with five batches per pass. Polling every 15 seconds and foreground/online/subscribed catch-up repair missed events. Auth changes cancel subscriptions and suppress stale results. History scrolling is retained; incoming messages offer a jump-to-latest control when the reader is away from the bottom.

Both message and notification monitors verify identity with `getUser()`, then await `realtime.setAuth()` without an argument before continuing. This resets the installed SDK's cached manual realtime token and rereads current cookie-backed session state after server-action logout/login, which need not emit a browser Auth event. Both recheck stopped/generation state after the asynchronous refresh. This keeps verified identity as authority and prevents a delayed refresh from creating a stale subscription.

New owner-only read receipts point to actual messages. Their RPC derives identity from `auth.uid()`, checks membership and advances monotonically. They drive unread inbox state; no recipient-read indicator is advertised. Database inserts lock the parent thread before assigning strictly increasing server timestamps; caller-supplied message/thread timestamps are disallowed by column grants. Embedded PostgreSQL tests verify the SQL behavior, but do not prove separate-session hosted contention.

## Notifications

The existing **single viewer-scoped provider** remains the sole notification subscription owner. Activity consumes its revision and refreshes without creating another notification channel. Subscription/reconnect, periodic/foreground refresh and verified-account changes reconcile counts and clear stale data. Mark-read actions remain recipient-owned with pending/error feedback. Message subscriptions are separate from this notification lifecycle. The realtime token refresh described above applies to both owners.

## Settings and authentication

| Control | Classification | Behavior |
| --- | --- | --- |
| Edit profile | Working | Existing validated owner update with pending/error feedback |
| Edit interests | Working | Existing selections load; atomic replacement derives owner from verified session |
| Password reset | Repository flow implemented; live unknown | Recovery request and verified callback/reset flow |
| Dark appearance | Working fixed appearance | Informational; unsupported light writes rejected |
| Light appearance | Unimplemented, clearly unavailable | No misleading switch |
| Private account | Unimplemented, explicitly disabled | Public-account copy; stale direct action rejected |
| Log out | Working | Server action with pending state and checked failure |
| OAuth / magic link | Deferred | Hosted configuration and full callback lifecycle unverified; no dead buttons |

Login preserves a sanitized local return context and contextual reason; Continue browsing selects a public destination or Feed. Password fields use password-manager metadata, and signup/reset require at least eight characters. Signup/onboarding does not yet carry every login return context through account creation.

Recovery waits for the installed SDK's automatic PKCE/implicit initialization instead of exchanging a code twice, verifies the user, rejects invalid/expired callback errors and removes consumed callback credentials from history. Token-hash recovery is explicitly verified as recovery. Duplicate submits are guarded, passwords are cleared, and password update failure is distinguished from subsequent sign-out failure. Passwords are never manually persisted. Hosted recovery delivery/redirect configuration remains unverified.

## Public browsing and authorization

Guests can view Feed, Explore/search and public UUID profile/post/Reel/Story routes. Public queries explicitly filter published/public posts and use existing anon-readable tables plus the bounded aggregate RPC. They do not fetch save history, hidden/report state, private collections, messages, preferences or notifications. Like/save/comment/follow offer contextual sign-in links. Create, Messages, Activity, Settings and all mutations require verified identity. The middleware public allowlist is exact; nested edit routes remain protected.

No service-role client or relaxed RLS was added. Guest profiles expose public posts only; authenticated collections remain protected. Public post/author windows are capped at 80 and comments at 100, with authoritative post engagement counts shown separately. Complete public-history pagination is not implemented. Existing follower-count reads can meet hosted response caps; no scalable exact follower-count claim is made.

## Media and Reels

Shared playback control handles coalesced play requests, autoplay rejection, stale fulfillment/rejection, source replacement, buffering/retry, background and offscreen pause. Mobile Feed/detail remain click-to-play. Explicit Play is allowed for a partially visible tall detail video; desktop autoplay still requires 70% visibility. Playback pauses when the video leaves the viewport or the page becomes hidden.

Reels observe the actual scroll viewport and pause between settled slides when none meets 72% visibility. Named Previous/Next controls supplement gestures/keyboard; mute/play controls affect the current video. Source retries preserve exact signed URLs. SmartImage retains source-keyed reset, natural fit, skeleton/fallback and opt-in same-source retry without nesting buttons inside grid links. Image-only Reel fallback does not advertise video controls.

M4 preload policy remains: first/end selection among 13 videos gives **1 auto, 1 metadata, 11 none**; a middle selection gives **1 auto, 2 metadata, 10 none**. There is no eager-all-video workaround. These are browser preload hints, not proven network-byte savings.

## Validation

Final integrated automated checks: **361 tests pass** across M1–M6. Production build, standalone TypeScript and generated database-type freshness pass. Changed-file lint compares 92 code files against M5: **54 errors / 8 warnings → 52 errors / 5 warnings**, with **zero new or increased diagnostic groups**. Global lint remains unclean; middleware deprecation and pre-existing lint debt are deferred to M7.

The suite covers recommendation affinity/decay/caps/removal/diversity/page contracts; aggregate privacy and visibility; message replay/cursors/receipts/ordering/account lifecycle; camera permission races/track disposal; Story readiness/seen timing/pause/retry; media playback generations and source replacement; public/private route and query boundaries; recovery lifecycle; existing milestone regressions. Local database tests execute the real forward SQL under anon/authenticated roles with platform contract stubs, without Docker or live Supabase.

The route error page now uses the installed Next.js error boundary's `retry` prop. Its regression executes the actual installed `ErrorBoundaryHandler` and verifies both router refresh and boundary reset, rather than testing a fabricated callback contract. The final build and integrated checks include this correction.

Browser checks use the production app and synthetic local services. Verified journeys include guest Feed/Explore/search/profile/post, contextual login return, truthful Settings/logout, send/unconfirmed/retry without duplicate confirmed messages, Activity unread/mark-read, Story pause and decoded video playback/ended, camera-to-upload fallback, and actual Reel playback/Next/Previous/pause. After logout and login within the same application session, a new incoming message appeared exactly once without reload; a deliberately missed message was recovered after reconnect. Local fixture CORS was corrected separately from the production stale realtime-token defect; neither is presented as hosted evidence.

A synthetic 800 × 1000 image was uploaded, published and loaded in the Story viewer; pause, keyboard movement between authors and Escape were verified. A wide synthetic image was uploaded and published through Create, appeared on the profile, and its like/save controls responded. The newly saved post appeared in the Saved collection after a local fixture join was corrected.

A forced Reel video 404 produced a retry state; after its synthetic source was restored, Retry loaded the video to ready state 4 and resumed playback. A forced image 404 recovered through Retry and decoded at 800 × 1000. Real Reel unmute and pause controls were exercised. Rapid Next/Next/Previous left exactly one video playing and all others paused, with the eight-video fixture retaining 1 auto / 2 metadata / 5 none preload hints.

Feed, Saved, Login, Settings, Messages, Activity, Create, Camera, Story viewer and Reels were checked at **320, 375, 390, 600, 768, 820, 1024, 1280 and 1440 px** with no horizontal overflow in the checked states. Camera, Story viewer and Reels were also visually inspected at 320 px. These checks and the keyboard Story controls are targeted accessibility evidence; full screen-reader, physical-device and controlled slow-network testing remain manual.

The independent targeted final security review found **no new concrete must-fix security or authorization defect** in the reviewed repository code. It inspected realtime identity/token lifecycles, SQL/RLS/grants and private-data boundaries, verified-session mutations, guest query boundaries and existing regression assertions. This is a scoped code review, not evidence of hosted configuration. The final selection contains 97 M6 files. Staged whitespace checks and a targeted secret/fixture-content scan pass; excluded local artifacts and unrelated deletions were checked separately.

Browser route recovery was verified by stopping the local backend, opening Explore into its error state, restoring the backend and pressing Enter on Try again. Explore recovered without a page reload. Keyboard Tab focus on the fallback navigation link displayed a solid 2 px outline.

## Performance and bundle evidence

Feed scoring is bounded to 80 candidates and six-candidate diversity lookahead, with three 200-row personal signal windows. Feed candidate payloads omit nested interaction identities/bodies. Stories use fixed batched query counts; thread history and inbox have bounded pages; catch-up yields after 500 messages. The single notification owner and deferred Supabase client loading remain; no broad client conversion, eager media preload or added runtime dependency was introduced.

The final production build measured **24,272 summed gzip bytes** for the Feed's directly referenced client chunks, compared with M5's **23,205 bytes** (**+4.6%**). Across all emitted client JavaScript, **33 chunks** totaled **356,365 summed gzip bytes**, compared with M5's **338,150 bytes** (**+5.4%**). These are artifact sums, not wire/first-load sizes, hosted latency or device memory measurements.

## Forward database rollout and manual verification

1. Reconcile hosted schema/history with M1/M2 first. Never run the guarded clean-install baseline as an upgrade or reset a live project.
2. Review/apply `20261011000400_recommendation_windows.sql`: interaction-window indexes and `get_visible_post_engagement(uuid[])` for counts/caller flags on at most 80 visible posts. It uses an empty search path, schema-qualified references and explicit grants/revokes.
3. Review/apply `20261011000500_message_delivery.sql`: owner/participant receipt RLS, cursor index, timestamp trigger, column-level insert grants, read/inbox RPCs and guarded Realtime publication additions.
4. Verify with two authenticated accounts and anon: private saves/receipts/messages isolation, guessed IDs, public counts, caller flags, current mutual-follow sending, concurrent retries/order, notification delivery, logout/account switch and foreground/reconnect repair. Inspect hosted indexes/query plans with representative histories before latency claims.
5. Confirm hosted email redirect allowlist/PKCE recovery, Storage ownership paths and signed URLs, then run physical-device capture/media journeys before release. Missing new RPC deployment causes visible failure; it is not silently replaced by different ranking.

Both migrations are forward transactions after the established schema. No live rollout or deployment is part of M6.

## Remaining debt and handoff

- Live Supabase and physical-device verification above remains required.
- Feed's chronological 80-candidate horizon, current-data pagination and follow/hidden URL/read limits remain; authenticated Explore still has earlier broad/unbounded query behavior.
- Public collection windows do not provide complete history; follower aggregation may encounter hosted row limits.
- Story expiry does not reclaim public Storage objects. Private accounts remain intentionally unsupported.
- Signup return-context continuity, optional auth providers, full screen-reader/device coverage, controlled slow-network checks and hosted contention/load measurements remain incomplete.
- Existing global lint, typing cleanup, dead code/dependencies, tutorial residue, naming/structure, deprecations and repository hygiene belong to **M7**, which has not started.

Truthful description: “Built an interaction-driven social-feed ranker combining decayed category and creator affinity, follow relationships, capped engagement, recency, and bounded diversity reranking.” No AI/ML or Meta algorithm replication claim is supported.

Local milestone commit message: `feat: deepen RecoSocial feature systems and personalization`. The commit identity is recorded in the canonical audit and final delivery report. Only selected implementation, tests, migrations/types and tracked M6 handoffs belong in the commit. Scratch fixtures/traces, synthetic credentials/configuration, local env files, the historical untracked audit tree and unrelated ZIP deletions remain excluded. Stop after the validated local M6 commit; do not push, deploy or begin M7.
