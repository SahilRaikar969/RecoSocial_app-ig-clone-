# M2: reliable mutations, media and database contracts

8 October 2026. **Repository implementation complete within the approved M2 scope; locally validated.** Live Supabase verification is blocked on an explicitly authorized service check. No hosted project was inspected or mutated; no push or deployment was performed. M3 has not started.

## Status and changed files

| Item | Status | Implementation / limits |
|---|---|---|
| Atomic post/category publication | IMPLEMENTED | `supabase/migrations/20261008000300_atomic_post_publication.sql`, `actions/posts.ts`, camera route. Same transaction covers post metadata and category replacement; failure rolls both back |
| Social mutation reliability | IMPLEMENTED | Like/save/follow desired-state writes, safe comment results, owner filters, duplicate DM pair recovery, preference invalidation, theme row verification |
| Database and RPC contracts | IMPLEMENTED (scoped) | `lib/supabase/database.types.ts`, all four clients, `lib/db/query-types.ts`, feed/explore/search/onboarding/post-edit/messages/stories/save-count query boundaries |
| Application-wide DTO/any cleanup | PARTIAL / DEFERRED | Relevant query boundaries and mutation results typed. Unrelated UI/query casts and global lint debt remain outside M2 |
| Direct uploads and failure handling | IMPLEMENTED | `lib/media/direct-upload.ts`, `server-media.ts`, `use-media-form-action.ts`; post/profile/story/camera callers |
| Browser media correctness | IMPLEMENTED | Object URL lifecycle, crop geometry/export, camera cancellation/recorder failures, source-switch image recovery, retained files on explicit retry |
| Previously published media deletion, expiry and orphan collection | DEFERRED — SAFE MEDIA GARBAGE COLLECTION REQUIRED | No automatic old-object deletion. Public URL reuse and a check/delete race make a naive collector unsafe |
| Hosted schema/RLS/Auth/Storage/PostgREST and real concurrent sessions | BLOCKED — LIVE VERIFICATION REQUIRED | Local contracts do not establish deployed service behavior |

Other changed paths: scoped auth/error handling and redirect-decoding callers, optimistic feed/comment/reel components, `scripts/generate-database-types.mjs`, package scripts, TypeScript exclusion of the historical audit source copy, M1 auth expectations, new M2 tests and handoff documents. No dependency or lockfile changes were required. Existing M1 migrations are unchanged.

## Publication and mutation behavior

`save_post_with_categories` is SECURITY INVOKER with a fixed empty search path, explicit object qualification and authenticated-only EXECUTE. It derives the actor from `auth.uid()` and retains existing RLS. It validates the full category set, uses the caller's stable operation UUID for create, and checks identical owner/content/categories before treating a duplicate UUID as success. Conflicting reuse is rejected. Updates lock the owned post and require the expected `updated_at` version. A failed category insert cannot leave a partial post or erase the previous category set. Ordinary related constraints/triggers execute in the same PostgreSQL transaction; there is no separate application notification insert in this path.

Media uploads happen before this transaction. Storage and PostgreSQL are not one transaction; the cleanup rules below deliberately retain ambiguous objects. Metadata, ownership and direct-upload references are checked before publication. Successful publication invalidates relevant routes and then redirects outside the cleanup catch, so a Next redirect or later revalidation failure cannot delete committed media.

Likes, saves and follows express the requested state, use verified session identity and ignore duplicate adds without overwriting existing rows. Removals filter by the actor and target. Failures return bounded typed outcomes, do not pretend success and do not auto-retry uncertain writes. Comments remain successful if the insert committed but optional author decoration failed. Message success invalidates inbox/thread routes; a canonical DM pair race rereads only that pair after a unique conflict. Theme cookies change only after a profile row actually changed. Preferences retain the M1 atomic replacement and now invalidate their readers.

Comments/messages do not gain durable exactly-once delivery. Post/story operation IDs and cached uploaded paths survive retries in one mounted composer, not arbitrary reloads or devices. On ambiguous outcomes the UI tells the user to check current state. Profile version checking detects writes concurrent with that save request; it does not merge independent stale form edits.

## Media lifecycle and cleanup matrix

All files in a batch are validated before the first upload. Authenticated browser uploads use generated UUID filenames under an owner folder, with overwrite disabled; only metadata and owned relative paths are then sent to the action/route. The server checks direct-object size/type through Storage `info()` before accepting a relative path. Legacy small multipart requests still receive server validation. Existing public HTTP(S) media URLs remain supported; URL reuse is intentional. MIME/signature checks are bounded screening, not comprehensive content analysis.

| Situation | Action |
|---|---|
| Invalid selection or category before upload | Reject with a safe message; no publication |
| Browser batch upload fails before any publication submission | Best-effort remove only new paths attempted by that batch; never a cached path from an earlier submission |
| Server fallback upload fails, or a known database rejection proves rollback | Best-effort remove only this request's newly generated owner paths |
| Transport/timeout/unknown outcome after DB submission | Retain media; report uncertainty; no automatic retry or deletion |
| Direct-upload reference reaches the action, even if DB rejects it | Retain it: it may have been submitted earlier and is not a fresh server-owned compensation path |
| Profile/post replacement succeeds or fails | Keep old published objects; remove only eligible new server uploads after known failure |
| Post deletion or story expiry | Content visibility/rows follow existing rules; public objects remain |
| Cleanup attempt itself fails or page is abandoned | An unlinked object may remain; report applicable cleanup limitation; defer collection |

Declared feature limits use MiB (1024 squared bytes): post image/video 15/50, story 12/35, camera 12/45, avatar 10; post/camera thumbnail 10 and story thumbnail 8. Hosted bucket/global/proxy limits and real media HTTP behavior still require manual checks. Direct uploads avoid carrying these files in Server Action requests; this is not proof of deployed acceptance of every listed limit.

**DEFERRED — SAFE MEDIA GARBAGE COLLECTION REQUIRED.** Public URLs can be reused by another post/profile/story. A reference count followed by Storage deletion races with a new reference. A future design needs an immutable media identity/reference ledger, explicit upload staging, an enforced writer/collector claim or locking protocol preventing new references to deletion candidates, delayed collection, and recovery/retry handling for Storage failures. All reference writers must participate. Do not add deletion based only on a current count, replacement or content deletion event.

Browser lifecycle checks use synthetic files and mocked transport/camera: URL replacement/unmount cleanup; no URL churn on unrelated renders; crop callback stability and canvas pixel parity; SmartImage recovery; late camera stream disposal; authoritative optimistic counts and failure rollback; retained File submission after React form reset. Real devices and full authenticated service journeys remain manual.

## Types, errors, caching and recommendation compatibility

The generator replays actual repository migrations into the established local PGlite PostgreSQL harness, introspects tables/columns/FKs/functions and fails on unsupported PostgreSQL types. `npm run types:generate` updates contracts; `npm run types:check` detects drift. Types describe the repository schema, not the hosted project. Compile-time fixtures reject invalid table fields and RPC arguments. Runtime constraints and authorization remain necessary even with correct types.

Interactive mutations use explicit success/error contracts; media actions return a bounded failure or redirect after success. Existing form actions keep their navigation contract with safe error codes/messages. Raw database errors are not forwarded by the changed handlers. Optimistic engagement derives from refreshed authoritative props instead of retaining an independently incremented count; failures roll back and refresh. Pending controls prevent same-view double submission. Route invalidation is scoped to affected feed, explore, saved, profile, post/reel, message, notification or settings readers as appropriate; no whole-app layout invalidation was added.

Like/save category affinity, selected-interest weights, engagement coefficients and current ordering are preserved. Active search now uses the M1 count-only aggregate save RPC instead of private saver rows, keeping its coefficient unchanged. The 17 ranking compatibility tests still pass. The established Following metadata/bucket mismatch and rank-to-render product decisions remain M3. This work does not replicate or claim Meta/Instagram's proprietary algorithm.

## Validation evidence

| Check | Result | Boundary |
|---|---|---|
| `npm run test:m1` | 81 PASS | 41 auth, 17 ranking, 6 media, 17 database/RLS; preserved |
| `npm run test:m2` | 56 PASS | 7 PostgreSQL publication, 7 data-contract, 24 media/failure, 18 mutation/cache/optimistic checks |
| `npm run types:check` | PASS | Types match all three repository migrations |
| `npm run typecheck` | PASS | Includes compile-time M2 negative contract assertions |
| `npm run build` | PASS | Final build after retained-file fix; dummy localhost public service configuration, telemetry disabled; existing middleware convention deprecation remains |
| Changed-file ESLint (57 code files) | 10 errors / 13 warnings, exit 1 | All existing rule groups/counts at or below preserved audit baseline; zero new or increased diagnostic groups. Not a clean global lint result |
| Synthetic component browser fixture | 11 PASS | Actual components/hooks in browser, synthetic media, mocked actions/Storage preparation/camera. Not a full app/service end-to-end test |
| Diff/security review | PASS within scope | No concrete blocking defect found; no M1 migration edits, unsafe old-media deletion, service-role usage, new dependency, or credential committed |

Remaining lint errors are existing state-in-effect patterns in create/edit/profile/reel components; warnings concern raw images, hook dependencies and an unused feed helper. M2 did not undertake global lint cleanup. The historical audit source is excluded from application TypeScript so its copied dependencies/components do not participate in compilation.

PGlite tests execute PostgreSQL SQL/RLS with minimal Auth/Storage contracts. They are sequential local tests, not evidence of real parallel PostgREST sessions, hosted roles/triggers, Storage HTTP policies, email delivery or Realtime. The build and browser fixture do not contact live Supabase.

## Required live follow-up and remaining debt

Follow `docs/m1/LIVE-SUPABASE-VERIFICATION.md`, including its M2 addendum, only after specific authorization. Inventory/back up/reconcile the existing project before any migration. Do not run the clean-install baseline against an existing project. Application code requires the new RPC, so code and compatible database must be validated together before rollout.

Still unknown: actual live schema/migration history, Auth provisioning/refresh, effective RLS/grants and legacy triggers, PostgREST signatures/joins, owner_id population and owner/path enforcement in Storage, metadata info responses, global limits and complete two-user browser journeys. Test duplicate/concurrent saves and stale edit conflicts over distinct real connections. Do not infer service security from TypeScript or build success.

Deferred debt: safe media collection and staging; unrelated type/lint/tutorial cleanup; existing dependency advisories and middleware deprecation; UI/accessibility/performance work; persistent idempotency beyond a composer; live service verification. Private accounts remain intentionally disabled under the approved public-social baseline.

Recommended M3: characterize and repair Following bucket metadata and rendered-order contracts, verify like/save/unlike/unsave influence with a fixed two-viewer corpus, align discovery/hidden/category behavior, and make ranking explanations truthful. Decide scoring/diversity changes only after characterization and explicit approval. **Stop after M2; no M3 implementation is included.**

## Repository handling

One local M2 commit is authorized; no push or deployment. Preserve the pre-existing deletions of `part 1 recosocial .zip` and `part 2 recosocial.zip`, excluding both from the commit. The canonical `docs/recosocial-audit/RECOSOCIAL-AUDIT.md` receives an M2 addendum but remains in the pre-existing untracked historical audit directory, as in M1. This tracked handoff preserves the implementation status without committing that copied source/node_modules tree.
