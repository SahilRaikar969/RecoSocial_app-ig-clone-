# Recommendation Engine V2

M6 repository implementation and local validation, 2026-10-11. Baseline: M5 commit `f1431616599ccd88c8c46f0fe48e23df62941016`.

RecoSocial builds category and creator affinity from the viewer's current interactions, combines them with engagement, recency and follow relationships, then applies a bounded diversity pass before pagination. Instagram-inspired discovery is intentional. This is independently implemented deterministic heuristic ranking, not machine learning, semantic understanding, collaborative filtering, or a replication of Meta/Instagram's proprietary recommendation algorithm.

## Scope and source of truth

- `lib/recommendations/engine.ts`: pure affinity, scoring and diversity functions.
- `lib/db/queries/feed.ts`: authenticated/guest feed queries and transformation.
- `lib/recommendations/feed-contract.ts`: comparator, deduplication, pagination and time-anchor validation.
- `app/feed/page.tsx`: optional verified session, feed view and paging links.
- `supabase/migrations/20261011000400_recommendation_windows.sql`: recent-interaction indexes and aggregate-only RPC.

V2 powers the Feed's For You and strict Following views. Following still ranks the followed creators' posts; it is not a chronological-only feed. Authenticated Explore retains its separate legacy scoring implementation, including queries without explicit candidate/history limits. Guest Explore uses the public-content query path. Reels preserve their source collection ordering; they do not introduce a separate learned video model. Do not describe V2 as a replacement for every discovery query.

## M5 versus M6

| Factor | M5 Feed | M6 Feed V2 |
| --- | --- | --- |
| Selected topics | +8 per topic | +8 per unique topic, combined topic cap |
| Learned topics | Current likes +3 and saves +5; accumulated without explicit history limit or decay | Latest 200 current rows per signal in 180 days; like 3, save 5, comment 2; 30-day half-life; diminishing returns |
| Multiple post topics | An interaction added its full weight to every topic | Split one event's weight across its unique topics |
| Personal comments | No personal affinity | At most the newest comment per viewer/post contributes; comment bodies/sentiment are not analyzed |
| Creator affinity | None | Same bounded events produce a separate creator score, capped at 10 |
| Follow relationship | +22 if followed; otherwise +5 discovery | +10 if followed; otherwise +3 exploration |
| Aggregate engagement | Uncapped `2*likes + 4*saves + 3*comments` | Logarithmic, capped at 16 |
| Freshness | +3 through 6 hours, +2 through 24 hours, +1 through 72 hours | Smooth 3-day half-life, maximum 8 |
| Candidate window | Latest 80 eligible public posts | Same 80-row limit, with an optional short-lived candidate-time anchor |
| Repetition | Score sort only | Six-candidate lookahead, local creator/topic penalties, maximum 10-point promotion gap |
| Payload | Nested candidate interaction rows plus save-count RPC | Public post metadata plus one aggregate RPC; no nested saver identities or comment bodies in Feed |

## Exact model

For an event aged `d` days, decay is `2^(-d/30)`. Invalid dates, future events and events older than 180 days contribute zero. Current database rows are the evidence: this is not an immutable event log. A deleted like/save/comment stops contributing on the next request. Unfollowing removes the relationship boost and Following membership. Removing a selected preference removes its +8 seed.

Events are deduplicated by `(kind, postId)`, keeping the newest date. Thus a like and save on one post both contribute, but many comments on that same post do not multiply personal affinity. Own-post interactions do not build personal category/creator affinity. Aggregate popularity still counts ordinary database interaction rows, including valid owner interactions and repeated comments.

For each event, multiply its base weight by decay. Add that value to its creator, and divide it equally among unique nonempty category slugs. Then transform the sums:

```text
learnedTopic = min(16, 8 * log2(1 + topicEventSum / 8))
topicAffinity = min(24, learnedTopic + (selectedTopic ? 8 : 0))
creatorAffinity = min(10, 4 * log2(1 + creatorEventSum / 4))

interest = min(24, strongestMatchingTopic + 0.25 * secondStrongestMatchingTopic)
creator = affinity for the candidate's author, or 0
engagement = min(16, 4 * log2(1 + (2*likes + 4*saves + 3*comments) / 4))
recency = 8 * 2^(-candidateAgeDays / 3)
relationship = followed ? 10 : 0
exploration = followed ? 0 : 3

score = interest + creator + engagement + recency + relationship + exploration
```

Candidate categories are normalized into slug/ID order before reranking and display. More categories do not multiply one event's influence. Missing category metadata leaves engagement/recency/relationship scoring available. Creator affinity can carry some interest to a different topic by the same creator; it is weaker than the maximum content-interest contribution. Self-authored posts remain eligible public candidates.

There is no sentiment classifier: a critical comment still contributes positive affinity. There is no watch-time, impression, dwell-time, share, skip, dislike, embedding or profile-view input in V2. Hiding removes that post from the candidate set; it does not erase previous interactions with that post or penalize its entire topic/creator. Reporting remains a moderation action, not an automatic downranking signal.

## Ordering, diversity and pagination

The initial sort is score descending, save count descending, comment count descending, creation time descending, then ID ascending. `source_bucket` is explanatory membership: following, otherwise interest, otherwise trending. The renderer preserves the ordered array rather than regrouping it into bucket sections.

At each output position, at most the next six candidates compete. An alternative more than 10 raw score points below the current head cannot be promoted. Within the previous three output posts, each same-author occurrence subtracts 6 and each same first-category occurrence subtracts 2 for this choice only. The first category is the normalized first slug, not an inferred dominant topic. Strictly better adjusted scores win; ties retain the existing order. Stored/displayed raw scores are not rewritten. This is a soft local repetition reduction, not a quota or guarantee that every creator/topic appears.

Deduplication and slicing follow reranking. Pages contain 24 posts, at most four pages from the 80 candidates. Following's author filter, public/published eligibility and hidden-post exclusions are applied before the database candidate cap; no popular fallback is inserted into an empty Following feed. Invalid media rows are discarded after retrieval and can reduce the final window.

Paging URLs preserve an `at` timestamp for up to 30 minutes. A future, malformed or stale anchor is replaced with the current time. The anchor fixes the candidate creation cutoff and candidate recency clock. It does **not** freeze current interactions or their decay: new likes/saves/comments, removals, preference/follow changes, counts and authorization are read at the current request time. A fresh `/feed` visit starts a new window.

For unchanged data and clocks, ranking and page membership are deterministic, including reordered embedded category rows. This is not a stored snapshot cursor. Concurrent mutations, edits, removals or interaction decay can move posts between pages, so cross-request duplicate/skip freedom is not guaranteed under changing data. The 30-minute anchor prevents ordinary new-post insertion and candidate aging from independently reshuffling the journey.

## Query and privacy boundaries

| Work per Feed request | Bound/behavior |
| --- | --- |
| Likes, saves, comments used for personal affinity | Three owner-scoped queries; latest 200 rows each, `[now - 180 days, now]`; up to 600 rows before deduplication |
| Candidates | One public/published query; newest 80 eligible posts at or before candidate anchor; explicit stable ID tie |
| Counts/own flags | One `get_visible_post_engagement` RPC for at most 80 IDs |
| Follow set, selected topics, hidden IDs | Three other queries; follow/hidden sets retain existing unpaginated reads, so total work is not globally bounded by 600 |
| Core authenticated request count | 8 database requests when candidates exist: hidden IDs, follows, preferences, three signal windows, posts, RPC |
| Core guest request count | 2 with candidates: public posts and aggregate RPC; no personal history queries |
| Rendered-card moderation | Separate M4 batching for only visible cards; Stories/session/layout queries are outside the core counts above |

The query fixture reports 7 core authenticated calls because it mocks the hidden-ID helper; its separate production read makes 8. These are structural query counts, not measured network latency or a hosted load benchmark. Empty candidate sets skip the RPC. The algorithm is bounded to 80 candidate scores and a six-item lookahead; it creates no per-post application HTTP query loop.

The aggregate RPC returns only post ID, three counts and two caller flags. It is `SECURITY DEFINER` with an empty search path, schema-qualified tables and an explicit visibility predicate matching the existing posts read policy: public published posts, or posts owned by `auth.uid()`. The owner exception does not place drafts into Feed because the candidate query is stricter. Flags derive solely from `auth.uid()`; callers cannot nominate another viewer. Public execute is revoked and only anon/authenticated roles receive execute. Null input and arrays above 80 IDs fail; empty input returns no rows. Saver identities and other people's saved-history rows are never returned. Direct anonymous save-table reads remain denied.

Migration 004 adds `(profile_id, created_at DESC, post_id)` indexes for likes/saves and `(author_id, created_at DESC, id)` for comments. Existing post-ID interaction indexes support the aggregate subqueries. Exact counts still scan matching index entries: 80 candidate IDs does not mean constant database work for arbitrarily popular posts. This was validated functionally on local PostgreSQL, not by claiming a hosted query-plan or throughput result.

Remaining scale limits: follow/hidden reads and URL `IN` filters can become large and can meet hosted row/URL caps; repeated comments can consume much of the 200-row comment window before deduplication; authenticated Explore's independent unbounded reads are unchanged. Candidate generation is chronological, not a global relevance retrieval index, so an older highly relevant post outside the latest 80 is unavailable to the scorer.

## Controlled product-quality observations

Executed against the actual `getFeedData` implementation using `tests/helpers/m3-feed-fixture.mjs`; no live user data. The fixed clock is `2026-10-08T12:00:00Z`. Sixteen candidates `p00`–`p15` alternate fitness on even IDs and travel on odd IDs, have age `index % 3` days, one unique creator each, and no engagement except 50 saves on `p15`. Only the selected preference differs between the three profiles.

| Profile | First eight IDs after diversity | Matching-topic share in top eight | First post's raw score |
| --- | --- | --- | --- |
| Fitness selected | p15, p00, p06, p12, p04, p10, p03, p02 | 6/8 fitness | p15: 27 |
| Travel selected | p15, p03, p09, p01, p07, p13, p00, p05 | 7/8 travel | p15: 35 |
| Cold start | p15, p00, p03, p06, p09, p12, p01, p04 | 4 fitness / 4 travel | p15: 27 |

Observed: personal preferences change the mix and order, while a sufficiently popular fresh out-of-topic candidate can still lead. Cold start remains populated and uses capped popularity, freshness and diversity. This is a deterministic sanity check, not evidence of improved retention, satisfaction, relevance labels or A/B performance.

Interaction/removal scenario: two old candidates (`a-travel`, `b-fitness`) begin tied at 3, so the ID tie puts travel first. A separate hidden fitness history post supplies interactions and is excluded from candidates. There are no explicit preferences and the candidates have different creators from the history post.

| Current state | Output order | Fitness candidate score | Travel candidate score |
| --- | --- | --- | --- |
| No interactions | a-travel, b-fitness | 3 | 3 |
| Fresh like + save on fitness history | b-fitness, a-travel | 11 | 3 |
| Same interactions aged 60 days | b-fitness, a-travel | 5.575425 | 3 |
| Both interactions removed | a-travel, b-fitness | 3 | 3 |
| Follow fitness creator instead | b-fitness, a-travel | 10 | 3 |

A fresh save on another creator's fitness post produces fitness affinity `5.603518` and creator affinity `4.679700`. After 30 days these are `3.138539` and `2.801759`; after 181 days both are zero. Creator affinity can boost that creator's later travel post without falsely labeling travel as an inferred topic interest.

Repetition scenario: 12 fresh candidates have age `index/100` days; first 8 are travel posts by one creator and the last 4 are fitness posts by different creators. Plain score order starts with six from the same creator. V2's first six are `r00, r01, r02, r08, r09, r10`: three posts from that creator followed by three distinct creators. The six-candidate lookahead explains why it does not fix repetition in the first positions when alternatives are still outside the local window.

## Verification and rollout

Focused command:

```powershell
node --test tests/m6-recommendations.test.mjs tests/m3-feed.test.mjs supabase/tests/m6-recommendations.test.mjs
```

Local result: **35 passing** — 14 M6 recommendation tests, 18 existing feed contract/mutation tests and 3 PostgreSQL aggregate/privacy tests. Coverage includes decay/caps, multi-topic and repeated-comment deduplication, self-event exclusion, creator affinity, unchanged-input determinism, hidden/draft/private filtering before the cap, exact renderer order, strict Following, actual like/save mutation then retry/undo, current comment deletion, private-saver exclusion, 70 unique IDs over three pages, category join ordering, short anchor validation and fresh interactions during an anchored journey. Relevant ranking files pass focused ESLint. Whole-milestone build/type/browser results are tracked in `FEATURE-SYSTEMS.md`.

Local SQL tests execute real migrations/functions/RLS under anon/authenticated roles with platform contract stubs. They are not hosted GoTrue, PostgREST, Storage or Realtime verification. No live Supabase project was mutated by this work.

Manual rollout remains required: reconcile the existing project's migration history, back up as appropriate, review and apply the additive migration through the established database process, then release the matching application code. Do not reset hosted data or replay the clean-install baseline against an existing project. Missing RPC deployment causes a visible load failure rather than silently substituting different ranking.

On a controlled live/test project, verify anon/public and owner-only RPC visibility, private save-table denial, viewer-specific flags, index presence and query plans for representative histories; compare two accounts before/after like/save/comment/follow and removal; verify guest queries and paging with the hosted row limits. Recheck query plans/latency before making performance claims. No live rollout or production recommendation-quality claim is implied by the local tests.

Truthful description: “Built an interaction-driven social-feed ranker combining decayed category and creator affinity, follow relationships, capped engagement, recency, and bounded diversity reranking.”
