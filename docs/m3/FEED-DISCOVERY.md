# M3: feed, Following and discovery correctness

8 October 2026. **IMPLEMENTED and locally validated within M3 scope. Live Supabase remains UNKNOWN / LIVE VERIFICATION REQUIRED.** M1/M2 conclusions and the approved public-account model are preserved. No schema changes, dependency additions, live service writes, push or deployment. M4 is not started.

## Status and file map

| Work | Status | Files |
|---|---|---|
| Global For You order and strict Following | IMPLEMENTED | `lib/db/queries/feed.ts`, `lib/recommendations/feed-contract.ts`, `components/feed/feed-list.tsx`, `app/feed/page.tsx` |
| Public discovery and real account matching | IMPLEMENTED | `lib/db/queries/explore.ts`, `search.ts`, `post.ts`, `app/explore/page.tsx` |
| Source-to-reel eligibility and metadata | IMPLEMENTED | `lib/db/queries/reels.ts`, `app/reel/[postId]/page.tsx`, `lib/routes/media-links.ts`, post card, profile grid, search results, saved page |
| Signal/order/context tests | IMPLEMENTED | `tests/m3-feed.test.mjs`, `m3-discovery.test.mjs`, `tests/helpers/m3-feed-fixture.mjs`, `tests/browser/m3-feed-server.mjs`, package test command |
| Existing compatibility harness | IMPLEMENTED | M1 query loader supports extracted contracts/reel helper; reel fixtures now correctly identify their simulated video rows. Existing assertions retained |
| Stable paging across concurrent changes | PARTIAL / DEFERRED | Deterministic paging for unchanged state; no persisted ranking snapshot or cursor session |
| Full-corpus retrieval, diversity, calibrated relevance | DEFERRED | Candidate/history limits, saturation/decay, creator affinity, exploration quotas and quality evaluation are not redesigned |
| Authenticated hosted browser/service proof | BLOCKED — LIVE VERIFICATION REQUIRED | Synthetic local tests do not prove deployed schema, RLS, PostgREST or Storage |

## Following classification and ordering contract

The query emitted `source_bucket`; the server-rendered FeedList read `recommendation_bucket`. The mismatch left Following empty. A direct property rename would also have put all followed creators before higher-scoring content. M3 instead keeps `/feed` as one globally scored For You list and adds `/feed?view=following` as a distinct view. Both use the canonical typed `source_bucket`; the old property has no classification role.

Following membership is an actual `follows` row from the verified viewer to the author. That author filter runs in the database before the 80-candidate limit, and a defensive check runs before pagination and rendering. No unrelated recommendation backfills Following. An empty view explains that only followed creators belong there. Own public posts can appear in For You; they do not appear in Following because repository constraints prohibit self-follow. No special self-post boost was introduced.

The pipeline is:

1. Fetch public, published candidates ordered by `created_at DESC, id ASC`, excluding hidden IDs before the limit. Following also filters authors before that limit. For You and Following each have their own latest-80 eligible candidate window.
2. Fetch current viewer relationships and selected topics. Auxiliary `.in()` lookups supply counts/profiles; they do not retrieve or reorder a pre-ranked ID list.
3. Normalize candidates, derive category weights, score, and sort by score descending, saves descending, comments descending, timestamp descending, then ID ascending. One timestamp is used per ranking request.
4. Keep the first duplicate ID, preserving its position; apply view membership and slice 24-row pages. Clamp invalid/out-of-range page values to a valid page. Input arrays are not mutated by the page helper.
5. Pass the ranked objects through the server page to FeedList. Its card map preserves array order. There is no client sort, chronological re-sort or Following-first regroup.

Pages retain `view` and `page` in navigation/mutation return paths. Tests concatenate pages to prove no duplicates or skipped candidates **within an unchanged candidate window, signal set and scoring time**. Each page request recalculates ranking. New posts, interaction changes, hides, deletions or age-boundary changes can move items across page boundaries. This is explicit bounded offset paging, not a stable cross-refresh cursor. Results older than the current candidate window are not included.

There is no separate fallback corpus merged into For You. Non-followed and no-affinity candidates compete by the same score. They can outrank interest matches because popularity remains linear; M3 preserves that policy. An empty eligible corpus stays honestly empty instead of relaxing visibility.

## Exact personalization signal matrix

| Signal | Status | Current behavior |
|---|---|---|
| Likes | IMPLEMENTED | Current liked posts add +3/category in Feed, +2/category in Explore; candidate aggregate likes also add +2 each |
| Saves | IMPLEMENTED | Current saved posts add +5/category in Feed, +3/category in Explore; candidate aggregate saves add +4 each |
| Comments | PARTIAL | +3 per candidate comment as aggregate engagement; no personal comment affinity |
| Post/reel views, watch time, skips, completion | NOT IMPLEMENTED | No input to personalized post ranking |
| Follows | IMPLEMENTED | Feed +22 followed versus +5 non-followed (net +17); Explore +3 for followed authors |
| Learned creator affinity | NOT IMPLEMENTED | Follows are explicit relationships, not an author-affinity model learned from interactions |
| Category affinity | IMPLEMENTED | Selected topic +8 Feed / +6 Explore, plus current like/save contributions; multi-category posts contribute to each category |
| Popularity | IMPLEMENTED | Raw `2*likes + 4*saves + 3*comments`; the historical `trending` bucket is not growth-rate measurement |
| Engagement | IMPLEMENTED (basic) | Same aggregate term as popularity, not a separate independently added feature |
| Recency | IMPLEMENTED | Feed 3/2/1/0 at <=6/24/72/>72 hours; Explore 4/3/2/1/0 at <=6/24/72/168/>168 hours |
| Exploration | PARTIAL | +5 non-followed Feed term and discovery spotlights; no random injection, guaranteed exploration slots or diversity quota |
| Cold start | IMPLEMENTED | Popularity + post recency within the eligible candidate window; selected topics optionally seed affinity |

Story views separately support unseen-story presentation; they do not influence post scores. Related-post detail recommendations use shared categories (+7 each), same author (+14), aggregate engagement and recency. This is content similarity relative to the open post, not persisted view-learning.

Interaction rows persist in PostgreSQL. **Numeric category weights are rebuilt per request, not stored as learned preferences.** Duplicate desired-state like/save additions remain one row under M1 keys/M2 upserts. Distinct interactions accumulate linearly; liking and saving one post intentionally contributes both signals. Unlike/unsave removes that current-state contribution on the next query. Deleted history rows disappear through existing cascades. Hidden posts are not candidates, but a retained like/save can still express category interest until undone; hiding does not invent negative affinity.

Save history remains owner-only under repository RLS. Cross-user ranking uses the visibility-checked count-only RPC; returned feed/reel DTOs do not expose saver identities. Actual hosted enforcement remains unverified.

## Discovery and reel behavior

Explore explicitly requires public/published posts instead of relying solely on RLS, which permits an owner to read their own draft. It excludes hidden and malformed-media candidates, keeps deterministic ties, and preserves thumbnail/category/comment/ranking metadata through the page. Query/category filters retain ranking order. The current schema uses hard deletion; fixtures also prove stale deleted-status candidates are not selected. No new privacy or disabled-account model was invented.

Creator spotlights come only from real profiles with eligible retrieved posts in the active category, excluding self. Follower totals no longer create placeholder candidates. Account search independently searches public username/display name/bio instead of filtering six spotlights. It uses literal typed filters rather than interpolating user text into a raw boolean query. It retrieves up to 40 matches per field and displays six scored results, so it is not exhaustive account-search pagination. With no category selected, a public account without posts can be found. With a category selected, matches are constrained to authors of eligible posts in that category. Profile fields are public by the current model; there is no disabled-account flag. Removed profiles are absent, and no credentials/email/private interaction history are selected.

Post cards now derive media navigation context from the listing return path; search grids explicitly pass Explore/query/category and saved grids pass Saved. The reel page preserves back links and navigation query context. Its requested video must itself be public, published, non-hidden and within its requested scope; a missing/ineligible target does not produce a broad fallback.

Reel ordering has a deliberate exception: **the requested item is first**. Up to 12 related videos follow. Explore retains the filtered Explore ranking; Following retains ranked videos from the selected Following page. Both keep category/ranking metadata and reuse existing counts/author data instead of refetching those same rows. Saved/Profile/Post contexts constrain membership and use newest-related order. Default For You/Feed and Activity reel navigation also use newest-related order; the reel viewer is not a claim that the complete home-feed ranking persists through every swipe. Hidden/public/published filters apply before bounded related retrieval. Empty category/search/saved scope never widens into unrelated content.

Explore has no user-facing page cursor; its retrieved list is bounded by the backend response cap. Reels present the current bounded sequence, not a complete corpus pager. Eligibility survives those bounds, and tests cover hidden/draft rows before the 12-related limit. Full discovery pagination is deferred rather than represented as implemented.

## Cold start and explanations

With no likes, saves, follows or topics, Feed score is `2L + 4S + 3C + recency + 5`; the final +5 is constant for that viewer's candidates. Sparse/missing categories contribute zero. Public candidates remain available. Following with no relationships remains empty. Once interactions/topics exist, they enter the same score, without a fallback merge overwriting them.

Feed copy now accurately separates the story rail from post recency, describes comments as aggregate engagement, and uses “Matches your interest in …” for categories derived from mixed selected/like/save signals. The related-post reason says “Similar category …” instead of implying persistent learning from views.

## Validation and limits

| Check | Result |
|---|---|
| `npm run test:m1` | 81 PASS, including 17 ranking compatibility tests |
| `npm run test:m2` | 56 PASS |
| `npm run test:m3` | 42 PASS: 18 feed/signal/order tests and 24 discovery/context tests |
| `npm run typecheck` | PASS |
| `npm run types:check` | PASS; no migration/type-schema changes |
| `npm run build` | PASS after final scoped reel cleanup; dummy localhost public service configuration and telemetry disabled |
| Relevant ESLint, 20 changed code files | 20 existing explicit-any errors in `post.ts`, 1 existing raw-image warning in `post-card.tsx`; no new/increased diagnostic groups against the preserved audit baseline |
| Existing M2 synthetic browser fixture | 11 PASS |
| M3 synthetic two-viewer browser journey | 11 PASS |
| Final diff/security review | No concrete blocking M3 defect; no credential-pattern findings, migrations, dependency/lockfile changes or unsafe media deletion |

The existing middleware-convention warning remains. Lint is not globally clean. M1 tests use embedded PostgreSQL for SQL/RLS contracts; M3 tests execute actual TypeScript query/action/render modules against fixtures that apply relational filters/order/limits. They do not prove hosted RLS, API row caps, SQL plans, real concurrency or authenticated full-app browser behavior.

Reproduce the M3 browser fixture with `node tests/browser/m3-feed-server.mjs`, open `http://127.0.0.1:4318`, select **Run ranking journey**, then stop the local process. It exercises actual ranking queries, like/save handlers and React-rendered FeedList with synthetic database/auth and PostCard substitutes. Two isolated viewer states show that category order changes after like/save, duplicate retries do not inflate it, undo restores it and Following remains strict. This is not a hosted two-user integration test.

Required manual service follow-up: use the existing M1/M2 live checklist first; then verify actual PostgREST public/published filters, category/FK joins, hidden/follow filters before limits, literal account search, aggregate-save privacy, and all source-to-reel links with two normal users. Test new accounts, owner drafts, deletion, hide, like/save/retry/undo, unfollow and changed-state paging. Record the real schema and response limits before rollout. No live operation is authorized by this document.

## Remaining recommendation debt and M4 boundary

Deferred: full-corpus candidate/history pagination and backend cap accounting; stable ranking snapshots/cursors across updates; bounded/saturating counts, decay, learned creator affinity, diversity quotas, exposure/watch signals, measured recommendation relevance and broader query batching/performance. Popularity and heavily represented categories can dominate. Legacy unused search code remains outside active account-search behavior. Safe media garbage collection and live-service verification remain deferred from M2.

Recommended M4 remains responsive usability and accessibility: keyboard/focus behavior, tablet navigation gap, async/empty states, and core flows at mobile/tablet/desktop widths. Preserve M3 ordering, membership and privacy contracts. Performance overhaul, ranking-model redesign, deployment and M4 implementation require their own approved scope.

## Portfolio and interview wording

**Plain English:** RecoSocial ranks posts using creators you follow, topics you select, and categories of posts you currently like or save. Popularity and freshness also affect the order. Changing those inputs changes the next feed calculation. For You keeps global score order; Following shows only followed creators. New users get popularity-and-freshness-based content until they provide more signals.

**Technical interview explanation:** The server retrieves eligible candidates and current relational signals, derives category affinity per request, combines relationship, engagement and recency terms, and sorts with deterministic tie-breaking. It deduplicates and pages after ranking, and the renderer preserves that sequence. Following filters actual author membership before candidate limiting. Like/save rows are unique current-state relationships, so retries do not add extra affinity and undo removes it. Save identities remain private while a count-only RPC supplies aggregates. Tests exercise mutation-to-later-query effects, eligibility, pagination and rendered order. This is a transparent heuristic system, not machine learning.

**“Did you recreate Instagram’s recommendation algorithm?”** No. Instagram inspired the product and personalized-feed experience, but its algorithm is proprietary. I built RecoSocial's own rules-based ranking using follows, selected interests, current likes and saves, aggregate engagement and recency. It does not reproduce Meta's algorithm or use machine learning.

**Current resume bullet:** Implemented and tested interaction-driven feed ranking in Next.js and Supabase, deriving category affinity from likes and saves while preserving ranked render order, strict Following membership and private save history.

The resume claim describes repository implementation and local evidence; do not imply verified production operation, measured recommendation uplift or Meta algorithm replication.
