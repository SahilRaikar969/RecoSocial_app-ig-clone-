# M1 database setup and validation

8 October 2026. Repository M1 is implemented and locally validated. Hosted Supabase state is unknown. No hosted database, Auth, Storage or deployment changes were made.

## Scope and files

- `supabase/migrations/20261008000100_clean_install_database.sql`: 16 application tables, UUID Auth/profile identity, keys/indexes, explicit grants, RLS, provisioning and notification triggers, atomic preferences and count-only save RPCs.
- `supabase/migrations/20261008000200_media_storage.sql`: public `media` bucket, 50 MiB limit, image/video MIME allowlist, owner listing/insert/delete policies, no overwrite policy.
- `supabase/legacy-migrations/`: nine original files retained as evidence, not runnable migration history. SHA-256 manifest and a Git attribute preserve their original bytes across checkouts.
- `supabase/config.toml`, `.env.example`: local configuration and placeholders only; no live credentials.
- `actions/`, affected auth/settings/profile/reel/camera pages, `middleware.ts`, `lib/auth/`, `lib/routes/`, `lib/media/`, and active query modules: verified-session identity, safe redirects/cookies, database-owned notifications, upload screening and count-only save compatibility.
- `tests/m1-*.test.mjs`, `supabase/tests/`: application characterization and executable PostgreSQL authorization tests. The only added dependency is dev-only `@electric-sql/pglite` pinned to 0.5.8.

## Reproduce checks without Docker or a Supabase connection

From the repository, using the committed lockfile:

```sh
npm ci --ignore-scripts
npm run test:m1
npm run typecheck
npm run build
```

For a build without a running service, set `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` and `NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-local-anon-or-publishable-key` in the shell. These override local configuration for that process; never substitute an administrative/service-role key. `.env.local` is ignored. Use real local public credentials only for interactive service testing.

`npm run test:m1:db` runs the database subset. Each test database is disposable, in-process PGlite PostgreSQL. The helper creates minimal `auth.users`, `auth.uid()`, Storage contract tables and API roles, then executes the actual ordered migrations. RLS, grants, constraints and triggers execute in PostgreSQL, not mocked query responses. Auth HTTP, PostgREST, Storage HTTP and Realtime are not implemented by this harness. Separate auth/ranking tests use mocked application dependencies. There was no hosted authenticated browser test.

## Clean installation only

The active SQL is **not an upgrade for an existing project**. Before any service installation, inspect public relations, Auth users, existing Auth triggers, the `media` bucket and **all** Storage object policies. Use an isolated new project only. A future optional local Supabase CLI stack needs Docker; it was not started or forced for M1. As of M7, the unused CLI is no longer a project dependency; an operator who chooses that separate workflow must install a reviewed current CLI explicitly. Repository tests and database type generation use PGlite and do not require it. Do not link or push these migrations to the existing project.

The first migration refuses any existing public table/partitioned table/view/materialized view/foreign table or Auth user. The second refuses an existing `media` bucket or any `storage.objects` policy. Each file has its own transaction: a Storage refusal can happen after the application baseline committed. Preflight both areas before starting. If interrupted, inspect which migration committed; do not delete existing data or replay the baseline blindly. The scripts do not resolve existing migration history and contain no production reset/drop/truncate procedure.

For the existing project, export schema/policies/functions/triggers/grants/indexes and migration history through authorized read-only inspection, take a recoverable data/storage backup, and compare with these definitions. Then prepare a separate additive forward migration for the observed schema, test it against an isolated copy and obtain explicit rollout approval. No forward migration can be truthfully supplied before that inventory. See [live verification](LIVE-SUPABASE-VERIFICATION.md).

**Application rollout dependency:** onboarding now needs `save_profile_category_preferences`; queries need `get_visible_post_save_counts`; social notifications need database triggers; profile views need `record_profile_view`. Do not deploy this commit against an unreconciled database. Provision the compatible schema/permissions and verify two-user journeys first.

## Behavior and security boundaries

Profiles derive identity from verified Auth, including confirmation-enabled signup. Username conflicts never adopt another profile. Onboarding ignores a submitted profile ID. Preference replacement validates the complete category set and locks the owning profile row; concurrent replacements serialize, with the last completed replacement becoming the full set. Unique interaction keys retain one current like/save, so retries do not multiply category signals. Multi-session lock contention was not exercised by the single-connection harness.

Save identities/history are owner-only. A bounded RPC returns only counts for visible posts; the active feed, Explore, profile, lists, post and reel queries preserve their previous aggregate inputs and ordering. Likes/saves continue to influence category affinity; ranking weights, candidate logic and the known Following classification issue were not redesigned.

Follow/like/comment notifications originate from database triggers, suppress self/duplicate events and remove the relevant deleted events. Profile-view recording derives the actor from `auth.uid()` and deduplicates. Clients cannot manufacture notification rows or change their recipient/actor/type. Direct-message participants are immutable; creation/sending requires mutual follows, and existing participants retain database read access to history after unfollow. The current thread page may impose a stricter mutual-follow gate.

Public accounts are the approved M1 behavior: the setting is disabled, stale actions reject it, and the fresh schema constrains `is_private=false`. No existing live privacy flags were changed. Public media remains public. Raw media references require an owner path; absolute HTTP(S) links remain supported as public references, not assertions of ownership. Signed URLs keep their tokens and original origin. Storage mutations check both the authenticated owner and path; no update/overwrite policy is granted.

Uploads use bounded MIME/extension/signature/size screening. It is not full media decoding or malware detection. Direct Storage clients can bypass application screening; live service MIME/size and ownership enforcement must be tested. Object cleanup after failed uploads, post deletion or story expiry remains future work; a known public object URL may remain accessible. Direct uploads, deployment request limits and atomic post/category publication remain later milestone work.

## Validation recorded on 8 October 2026

| Check | Result | Limit |
|---|---|---|
| Production build | PASS | Dummy localhost configuration; existing middleware deprecation warning; not a service/deployment test |
| TypeScript | PASS | `tsc --noEmit --incremental false` |
| Auth | 41 PASS | Session/onboarding/signup/cookies/redirect characterization with mocked dependencies |
| Ranking compatibility | 17 PASS | Original query/page execution with fixtures; interaction effects and global save counts preserved |
| Media helpers | 6 PASS | Signatures, size/type failures, owner paths and signed URL preservation |
| Database/RLS | 17 PASS | Fresh replay, guards, identity, cross-user/anonymous denial, grants, notifications, preferences, private saves, DMs and Storage contracts |
| Combined suite | 81 PASS, 0 failures | `npm run test:m1` |
| Changed-file lint | 41 files checked; 141 errors and 1 warning | All remaining rule/message diagnostics match the audit baseline; no new diagnostics. Not a clean lint run |
| Diff/security review | No remaining concrete M1 repository blocker identified | Includes independent SQL review; not a hosted security certification |
| Historical SQL integrity | 9/9 SHA-256 matches | Original bytes preserved; never replay this archive |

Existing framework/dependency advisories, broad `any`/lint debt, media lifecycle defects and Following classification are not repaired by M1. Database type generation and broad typed query contracts remain outstanding; do not claim end-to-end database type safety. The canonical audit is updated only with M1 status; its original findings remain historical evidence. Nothing was pushed or deployed; M2 is not started.
