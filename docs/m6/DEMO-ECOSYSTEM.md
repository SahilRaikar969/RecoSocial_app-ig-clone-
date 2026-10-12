# M6.1 — synthetic social ecosystem

Verified and implemented **12 October 2026**, after M6 commit `928d24e`. This is a controlled development/demo corpus, not simulated real-user adoption. No hosted project was seeded, pushed or deployed; M7 has not started.

## Repository finding and files

M6 had useful small synthetic unit/query/browser fixtures, but no reusable ecosystem at the requested scale. The only SQL seed was an archived, incompatible three-profile prototype in `supabase/legacy-migrations/seed.sql`. It remains archived. Automatic seeding remains disabled in `supabase/config.toml`.

| File | Responsibility |
| --- | --- |
| `scripts/demo/dataset.mjs` | Pure deterministic corpus, version `recosocial-demo-v1` |
| `scripts/demo/cli.mjs` | Read-only plan and explicitly guarded local seed/reset commands |
| `scripts/demo/sql.mjs` | Transactional insertion, collision checks, private ownership manifest and selective cleanup |
| `public/demo/recosocial-v1/` | Ten generated illustrations and one project-generated silent clip |
| `scripts/demo/generate-media.mjs`, `scripts/demo/MEDIA.md` | Exact illustration generation and media provenance |
| `tests/helpers/demo-feed-fixture.mjs` | Same corpus mapped into the relational harness for the actual `getFeedData` implementation |
| `tests/m6-demo-*.test.mjs`, `supabase/tests/m6-demo-seed.test.mjs` | Corpus, ranking, media, CLI and actual PostgreSQL transaction/RLS tests |

No production ranker, application component, public schema migration, RLS policy, Storage bucket or runtime dependency changed. Middleware exempts only the exact public demo WebM path, so guest video requests do not redirect to login; neighboring protected paths are regression-tested with the installed Next matcher and actual middleware.

## Account model, scale and graph

There are **30 accounts**: two creators in each of ten categories, plus ten distinct viewer personas. Every username begins `demo_`; display names begin `Demo`; biographies say generated demo account and not a real person. Addresses use the reserved invalid domain `recosocial.invalid`. Every post caption begins `[Demo]`; comments also identify demo activity.

Seeded Auth rows are **non-sign-in actors**: no password, identity or session is created, and `banned_until` is a finite date in year 9999. The administrator-owned `raw_app_meta_data.recosocial_demo` marker identifies them for cleanup. They populate public Feed/Explore/profile/Reel content for independently created real local test users. They are not shared-login test credentials. Controlled persona rankings are exercised through the real query implementation's local harness and database role tests; no UI account-impersonation feature was added.

| Dataset relation | Rows |
| --- | ---: |
| Accounts/profiles | 30 |
| Posts | 300: 240 images, 60 Reels/videos |
| Categories used | 10 |
| Post/category links | 300 |
| Follows | 33 |
| Likes | 808 |
| Private saves | 139 |
| Comments | 86 |
| Selected category preferences | 33 |

The categories are fitness (`health-fitness`), travel, gaming, technology, cars (`cars-bikes`), food, fashion, photography, music and sports. Each has 30 posts, divided between its two creators. Viewer personas are fitness, travel, gaming/tech, cars, food, fashion, mixed, cold start, music and sports. Mixed selects travel, food, photography and music; cold start has no outgoing follows, interactions or preferences.

UUIDs derive from SHA-256 of stable versioned keys. A supplied UTC anchor fixes post/interaction times. Posts interleave categories every round; the newest 80 contain exactly eight from each category. Creator engagement varies by age round equally across topics. Viewer histories use older posts outside that 80-candidate window, transferring category/creator affinity to newer content. Creator 1 has stronger viewer history and is followed. Likes/saves/follows have no duplicate keys; interaction timestamps fall after the target post and at or before the anchor.

Eight category slugs reuse the clean baseline's existing rows; gaming and technology are added if absent. Thus a pristine 16-category baseline has 18 categories after seed, of which ten are used by this corpus. Existing same-slug category IDs/names are retained, and joins are mapped by slug. Conflicting reserved IDs/names cause refusal rather than overwriting.

Existing database notification triggers remain active: the pristine corpus produces **927 notifications** (33 follows + 808 likes + 86 comments). These notification UUIDs and server timestamps are database-generated; they are not part of the deterministic recommendation inputs. No triggers or app RLS policies are disabled.

## Media policy

The fixture-specific `.gitattributes` rules preserve LF SVG bytes and binary video bytes across Windows/Unix checkouts. The ten SVGs are original geometric category illustrations, 800 × 1000, visibly labeled **GENERATED DEMO CONTENT** and **DEMO / NOT A REAL ACCOUNT**. They contain no external resources or active markup. The checked-in 480 × 720 silent VP8 WebM is an existing project-generated geometric scene, approximately 1.425 seconds; integer duration metadata rounds up to two seconds. It has no burned-in label, so its seeded account and caption provide the explicit demo context. Its original Canvas/MediaRecorder source is preserved in `scripts/demo/reproduce-video.html`.

The 300 content rows intentionally reuse this small, bounded media set; there are not 300 unique photos/videos. No social-service scraping, random internet content, people, logos, analytics, fonts or external processing is involved. Full provenance and the clip hash are in `scripts/demo/MEDIA.md`. Fixture media is served directly by the local Next app. No Supabase Storage upload, ownership exception or bucket change is required.

```powershell
npm run demo:media  # Regenerate identical bytes for the ten fixed SVG paths.
npm run demo:plan   # Counts and fixed default anchor; no database connection.
```

## Explicit local seed and reset

Prerequisites: an operator-managed **local** Supabase/PostgreSQL instance with the reviewed RecoSocial migrations already applied, the PostgreSQL `psql` client on PATH, and the local app serving the checked-in assets. This command does not start Docker, provision a database, apply migrations or reset Supabase. Never replay the clean-install baseline on an existing project.

The only writable target allowed by the CLI is `postgres` on `127.0.0.1:54322` (or `localhost`, normalized to numeric loopback), database `postgres`. Use a genuine local disposable/demo database, never a port forward/tunnel to a hosted database. A loopback allowlist cannot establish the provenance of a manually forwarded connection. There is deliberately no hosted/production override.

From the RecoSocial repository in a non-production PowerShell session:

```powershell
$env:RECOSOCIAL_DEMO_MODE = 'local'
# Replace only the placeholder with your URL-encoded LOCAL database password.
$env:RECOSOCIAL_DEMO_DATABASE_URL = 'postgresql://postgres:<URL-encoded-local-password>@127.0.0.1:54322/postgres'

# Choose once and retain this value for identical reruns; keep it at/before now.
$demoAnchor = (Get-Date).ToUniversalTime().ToString('o')
npm run demo:seed -- --confirm=recosocial-demo-v1 "--anchor=$demoAnchor" --media-origin=http://127.0.0.1:3000

# Same anchor and media origin: verified no-op, no duplicates or graph reset.
npm run demo:seed -- --confirm=recosocial-demo-v1 "--anchor=$demoAnchor" --media-origin=http://127.0.0.1:3000

# Remove only this registered dataset; this is NOT `supabase db reset`.
npm run demo:reset -- --confirm=recosocial-demo-v1
Remove-Item Env:RECOSOCIAL_DEMO_DATABASE_URL
Remove-Item Env:RECOSOCIAL_DEMO_MODE
```

Use your app's actual local port in `--media-origin`; the default is `http://127.0.0.1:3000`. Seed requires an explicit anchor; tests/plan default to `2026-10-12T12:00:00.000Z`. A changed clock or media origin requires reset then reseed. An old anchor is useful for reproducible tests but content becomes stale in an app using the real clock. Changing the anchor without resetting is refused, preventing silent rewrites.

For a fresh visual demo: seed with a current anchor, run the app against that same local Supabase project and media origin, and open Feed as a guest or sign up normally. Content population is an explicit operator action; a new or hosted environment is not automatically seeded by installation, build, deployment or application startup.

## Safety and idempotence

- Mutation requires explicit `RECOSOCIAL_DEMO_MODE=local`, dataset confirmation, an explicit database URL and a non-production/non-Vercel process. Remote hosts, other ports/users/databases, URL query options and nonlocal media origins are rejected before spawning a process. The CLI does not load `.env` files.
- The PostgreSQL administrator credential is only consumed by this Node CLI and passed via the subprocess environment, never an argument, source fixture, application import or client bundle. No service-role API secret is used. `psql -X` ignores startup scripts; inherited `PG*` overrides are cleared, and numeric loopback is forced. Raw connection errors are not printed.
- A SQL session guard, administrator check, transaction and advisory lock protect the operation. Reserved account/email/username/content/category collisions cause rollback; existing accounts are never adopted because their names happen to look like demos.
- A private `recosocial_demo.runs` table records a full versioned manifest and digest. Public/anon/authenticated/service-role access is revoked, with table RLS enabled and no policies. It is outside the application's public schema and generated API types.
- An identical seed validates marked identities and returns without mutation. This intentionally preserves manual changes, such as an unlike during an experiment. Use reset/reseed to restore the original graph. Changed parameters or identity ownership cause refusal.
- Reset verifies Auth metadata/email and content ownership before deleting the exact registered demo Auth IDs. Their normal foreign-key cascades remove their profiles, posts, interactions and related records. Unrelated accounts and content survive. **Other local users' interactions/messages involving deleted demo actors/content also disappear through normal cascades**; use a disposable demo environment.
- Only newly created category rows are eligible for cleanup, and only while unchanged and unused by remaining posts/preferences. Pre-existing categories are retained. The empty private registry schema/table and committed static assets remain after reset. No storage objects, application tables or whole databases are dropped/truncated.
- No successful mutation is claimed when the subprocess fails or times out. A connection interruption near commit can leave the outcome uncertain; rerunning identical parameters safely reconciles it. Retain local DB diagnostics privately instead of pasting credentials into logs/issues.

## Recommendation V2 observations

The 15 new ranking/corpus tests use this exact dataset through `getFeedData`; the existing relational fixture mocks transport, not the ranking implementation. PostgreSQL seed tests separately execute the same generated payload against all real migrations. Production scoring weights, candidate horizon and diversity rules are unchanged.

| Persona | Observed first 12 results at the fixed anchor |
| --- | --- |
| Fitness | 8 fitness + 4 other topics |
| Travel | 8 travel + 4 other topics |
| Gaming/tech | 6 gaming + 6 technology |
| Mixed | 3 each: travel, food, photography, music |
| Cold start | 7 topics; all 10 appear within the first 24 |
| Cars / food / fashion / music / sports | Each has 8 matching-topic posts within its first 12 |

The first two mixes demonstrate available exploration in this controlled candidate distribution, not a universal quota or relevance guarantee. Strong single-topic personas retain eight consecutive matching posts: the existing ten-point diversity score-gap guard does not artificially promote much weaker unrelated content. Across 80 candidates, Fitness adjacent creator repeats decrease **6 → 4** after reranking; Mixed adjacent category repeats decrease **1 → 0**. Diversity is bounded, not a hard prohibition on repetition.

A cold-start viewer liking an older fitness history post raises a newer same-creator fitness candidate's score **17.7251 → 24.6300**; an isolated save raises it to **28.0083**. Candidate engagement counts do not change in that scenario: the effect is learned affinity. Unlike/unsave restores the exact baseline feed. Separate tests verify comments/deletion, selected interest alone, creator-affinity transfer to another topic, follow/unfollow and strict Following membership, recency with other factors held equal, and engagement without fabricated personal interests.

Four fixed-clock/fixed-state pages contain **24 / 24 / 24 / 8** posts, exactly 80 unique IDs in stable order. Changing interactions can reorder later requests; this is not immutable pagination under mutations. The other 220 corpus posts exercise history/profile content and older signals, not an expanded recommendation retrieval horizon. This remains an independently implemented heuristic ranker, without a Meta/Instagram algorithm replication or ML claim.

## Validation and remaining boundaries

Executed locally:

- `npm run test:demo`: **31 pass** — 15 dataset/ranking, 5 media, 6 CLI, 5 PostgreSQL seed/reset/RLS tests.
- `npm run test:m6`: **132 pass**, including those 31; `node --test tests/m3-feed.test.mjs`: **18 pass**. The additional `tests/m1-auth.test.mjs` contributes **41 passing authentication regressions**. The final combined command passed **191 distinct relevant tests**.
- Production build, standalone `npm run typecheck`, generated `npm run types:check`, and focused lint on all new M6.1 JavaScript modules: **pass**. The existing Next middleware deprecation warning remains. After the exact-path middleware correction, the final build and typecheck were repeated successfully.
- SQL tests cover counts, existing notification triggers, identical reruns, retained manual removal, reset/reseed, collision rollback, ownership refusal, unrelated data/category preservation and unchanged anon/authenticated save privacy. They execute real PostgreSQL through isolated PGlite with minimal Auth/Storage contracts.
- Production loopback HTTP smoke: all ten SVGs returned 200 with the expected MIME type and demo text; the WebM returned 200 with its exact reviewed hash, and a byte-range request returned 206 with 128 bytes. No authentication redirects occurred; the temporary local server was stopped. This verifies asset delivery, not an end-to-end seeded Supabase UI journey.
- Read-only `npm run demo:plan` executed successfully. Focused review found no concrete new seed/reset authorization defect. No ranking coefficients, public database types or migration files changed.

**Not executed:** the `psql` CLI against an actual local Supabase installation, hosted Supabase/GoTrue/PostgREST/Storage, or a hosted deployment. The available local validator is PGlite; a `psql` client is not installed in this environment. The CLI subprocess contract is tested with an injected runner, while its actual SQL runs in PostgreSQL tests. Auth ban/metadata fields are contract-verified, not evidence of actual GoTrue behavior. An operator should perform one seed/rerun/reset on a disposable local Supabase instance and confirm the app's media origin before using it for a live demo. No production mutation occurred.

Local commit message: `feat: add synthetic social ecosystem for recommendation testing`. Stop after this focused extension; do not begin M7.
