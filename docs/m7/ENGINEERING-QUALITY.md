# M7 — codebase cleanup and engineering quality

12 October 2026. Baseline: M6.1 `512a92e329bf9e913ec4ac79b2ca1a9b5fc5d398` on `main`, following M6 `928d24e` and M5 `f143161`. M7 preserves the existing product and Recommendation V2; it is not a feature redesign. M8 full regression/real-user validation has not started. No hosted Supabase writes, push or deployment occurred.

## Inventory before editing

Git status/log confirmed M6.1 at HEAD before edits. The only pre-existing changes were two unrelated ZIP deletions and the untracked historical `docs/recosocial-audit/` evidence tree; these stay outside the M7 commit. Configuration, source domains, test harnesses, migrations and relevant audit sections were inspected before changes.

| Class | Finding and decision |
| --- | --- |
| BLOCKING for a clean M7 checkpoint | Active lint: 112 errors / 8 warnings; deprecated middleware convention. Fix without weakening rules or auth. |
| HIGH VALUE | Generated-schema query types, shared relation/profile normalization, form and media lifecycle cleanup, accurate verified-session naming, compatible dependency security patches. |
| SAFE CLEANUP | Proven unreachable modules and their unused dependencies; obsolete test mock; starter README boilerplate; archived build exclusion; explicit test commands. |
| DEFER | Ranking algorithm/weights, broad query architecture, migration/security semantics, hosted/device validation, full portfolio README, wholesale formatting and file movement. |

Ranking protection was established around `lib/recommendations/engine.ts`, `feed-contract.ts`, `lib/db/queries/feed.ts`, M1/M3/M6 recommendation tests and the M6.1 ecosystem. Those three runtime ranking files remain byte-equivalent to the baseline. The demo generator/seed/reset, SQL migrations and generated database types also remain unchanged.

## Lint, types and assertions

| Scope | Before | After |
| --- | ---: | ---: |
| Active repository source/tests/scripts | 112 errors / 8 warnings | **0 errors / 0 warnings** |
| Explicit `any` errors | 104 | **0** |
| State-setting effect errors | 8 | **0** |
| Camera hook dependency warning | 1 | **0** |
| Native-image warnings | 7 | **0** |

The original unrestricted lint command also traversed a copied historical app and its compiled output: **802 errors / 7,632 warnings overall**, including **690 / 7,624** from 406 archived files. `eslint.config.mjs` now excludes only `docs/recosocial-audit/**`, matching the existing TypeScript exclusion. This is historical evidence, not current runtime code. Active debt was repaired independently; the raw full count is not presented as thousands of code fixes. `npm run lint` now runs `eslint . --max-warnings=0`.

Supabase clients already use `Database`. Query callbacks now infer their selected columns; `JoinedPost`, `CategoryJoin`, `NormalizedCategoryJoin` and `PublicProfile` derive from the generated schema instead of `any` maps. Typed post/profile returns flow through page and hidden-grid props. Nine relation normalizers share `lib/db/normalize-relations.ts`; its null/empty/object/list behavior was compared with all nine original implementations. No select columns, filters, ordering, limits, private-save count behavior or ranking coefficients were changed.

Broad `any` and double `unknown` casts are absent from active application TypeScript. Narrow literal/discriminant assertions and non-null assertions after validated media/category/map guards were reviewed and retained where their contract is established. Required public environment variables still use the existing non-null configuration convention; this cleanup does not add a new runtime configuration system.

Native `<img>` rendering is intentional for private local blob previews, signed/external upload URLs, and media readiness/retry events. Five active sites now have line-scoped explanations rather than changing image delivery. Two warnings disappeared with the unreachable Activity component. The existing Story image exception remains. PostMedia's blanket effect suppression was removed; one line-scoped observer-unavailable fallback remains, and the existing object-URL hook still documents why an effect stores an externally created resource. No global lint rule was disabled.

## Dead code and dependency proof

Deletion review covered static imports, dynamic imports, re-exports, string-based test loaders and App Router conventions. These files were unreachable or reachable only from other removed files:

| Removed file | Reason |
| --- | --- |
| `actions/interactions.ts` | Legacy redirect action consumed only by the dead FeedActions widget |
| `app/(auth)/forgot-password-form.tsx` | Unused re-export; active auth form retained |
| `app/post/create-post-form.tsx` | Unreferenced old form/upload implementation |
| `components/activity/activity-stream.tsx` | Unreferenced alternate Activity implementation; active list/item/live owner retained |
| `components/feed/comment-form.tsx` | Unused predecessor of current comment UI |
| `components/feed/feed-actions.tsx` | Unused alternate engagement widget |
| `components/feed/like-button.tsx` | No live consumer |
| `components/feed/save-button.tsx` | Only consumer was dead FeedActions |
| `components/post/report-post-form.tsx` | Unused standalone predecessor; active moderation retained |
| `components/ui/animated-link-button.tsx` | Unused animation wrapper |
| `components/ui/animated-page.tsx` | Unused animation wrapper |
| `components/ui/animated-shell-card.tsx` | No runtime consumer; sole obsolete mock entry removed without deleting a test |
| `components/ui/app-notice.tsx` | Unused alternate notice |
| `lib/supabase/middleware.ts` | Unused duplicate auth middleware; active root gate retained as Proxy |
| `lib/utils.ts` | Unused class-name utility |

**Eight unused direct dependencies removed:** `@hookform/resolvers`, `react-hook-form`, `zod`, `class-variance-authority`, `clsx`, `tailwind-merge`, `framer-motion`, and the `supabase` CLI. The first four had no application imports; class utilities and motion belonged only to the dead module closure. The CLI was not invoked by application, build, test or generation scripts; optional operator installation is documented separately. PGlite remains the repository's local SQL/type validator. `zod` correctly remains transitively required by ESLint tooling.

| Classification | Retained dependencies |
| --- | --- |
| USED runtime | Next, React/React DOM, Supabase SSR/JS SDKs, Lucide icons |
| DEV-ONLY | TypeScript/types, ESLint/Next config, Tailwind/PostCSS, React Compiler, PGlite |
| TRANSITIVE requirement | ESLint's schema/glob packages, compiler and bundler dependencies; not removed merely for lacking app imports |
| UNUSED removed | The eight direct packages above |
| RISKY remaining | Development-only Next ESLint glob chain, described below |

Direct counts changed from 13 runtime + 11 development entries to **6 runtime + 10 development entries**. Manifest and lockfile root entries agree. All remaining local imports resolve. No framework update/downgrade, dependency override or automatic audit fix was applied. Next **16.3.8**, React/React DOM **19.2.4**, Supabase runtime versions and ESLint config version remain unchanged.

## Dependency health

The audit immediately after unused-package removal reported 15 findings overall, including three in the production dependency tree. Compatible transitive patches and removal of the unused CLI reduced this to **five overall, zero production**. All 29 updated packages satisfy an existing parent's version range; the patched filesystem helper added its required `@humanfs/types` dependency.

Selected changes: `ws` **8.19.0 → 8.22.0**, `source-map-js` **1.2.1 → 1.2.2**, `baseline-browser-mapping` **2.10.9 → 2.11.28**, `@babel/core` **7.29.0 → 7.29.7** with related compiler packages, `@humanfs/node` **0.16.7 → 0.16.8**, `brace-expansion` **1.1.14 → 1.1.21** and **5.0.5 → 5.0.12**, `browserslist` **4.28.1 → 4.29.3**, `js-yaml` **4.1.1 → 4.3.2**. The lockfile records the complete delta. Removing the unused Supabase CLI removes its exact vulnerable `tar` dependency without importing the substantially different newer CLI implementation.

The five remaining high-severity package entries represent one development-only chain: `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`. The [reviewed braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) lists stack exhaustion from deeply nested patterns and **no patched release** as checked on 12 October 2026. Latest compatible glob packages still require affected braces. The audit's proposed older Next ESLint downgrade was rejected. This is unresolved dependency debt, not a zero-vulnerability claim; do not feed untrusted arbitrary patterns into development lint tooling. Recheck upstream fixes during later dependency maintenance. The [WebSocket advisory](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) is covered by the compatible `ws` patch. Audit results describe dependency metadata, not a penetration test or hosted exposure certification.

## Naming, structure and deprecations

- Renamed root `middleware.ts` / `middleware` to **`proxy.ts` / `proxy`**, following the installed Next documentation. The auth, cookie batching, redirect, cache and exact static-fixture logic is unchanged; matcher and auth tests were updated. The production build no longer emits the middleware deprecation warning.
- Renamed misleading **`lib/auth/get-dev-session.ts` / `getDevSession`** to **`lib/auth/session.ts` / `requireSession`**, updating 44 source/test files. Its verified `auth.getUser()` boundary, profile provisioning, collision recovery and login redirect body are unchanged. `getOptionalSession` remains distinct.
- Added small domain modules: `lib/db/normalize-relations.ts`, `lib/profile/post-presentation.ts`, and `lib/media/use-muted-preference.ts`. They replace repeated category normalization, profile media/highlight presentation and stored mute handling. No giant utils module or new framework was introduced.
- Retained existing domain folders and milestone test filenames for traceability. Broad path churn, comprehensive formatting and a new generic repository/data layer were deliberately avoided.
- Removed default create-next-app/tutorial/Geist/deploy boilerplate from README, replacing it with brief factual setup and engineering links. Full portfolio README work remains M10. Legitimate Instagram-inspired behavior, history and archived evidence are preserved.

## Frontend lifecycle, error and comment cleanup

Form error-reset effects now clear previous feedback at the beginning of an input event. Previously, selecting an unsupported HEIC after a valid file could set an error that a subsequent blanket effect immediately erased. Create/Profile regression tests now verify that the new error persists until the next edit. EditPost/Profile reuse the existing object-URL lifetime hook, retaining cleanup and signed-media behavior. Media-type changes preserve the established original-thumbnail fallback without an extra state-reset effect.

Camera start/stop callbacks have complete stable dependencies while preserving acquisition generation checks, permission-race handling, background stop and track disposal. Reels and PostMedia share an SSR-safe mute preference reader; hydration never overwrites the saved preference. Only user toggles write storage, and denied storage still leaves controls usable. PostMedia viewport state subscribes to browser resize instead of initializing it through a cascading effect. Existing playback generation, source replacement, retry and preload rules remain.

No production `console.log`, `console.debug`, `console.warn` or `debugger` residue was found. Intentional CLI diagnostics remain outside browser/runtime modules. The server Supabase cookie catch now explains that Server Components cannot write cookies and Proxy owns refresh. Auth/mutation failure handling, friendly errors and uncertain-commit cleanup protections remain. Obvious dead/tutored comments disappeared with dead modules; security, ranking, lifecycle and upstream-renderer regression rationale was retained.

## Tests and commands

`npm test` executes every committed `tests/*.test.mjs` and `supabase/tests/*.test.mjs` once. `npm run test:db` isolates PostgreSQL contracts; `npm run test:recommendations` covers aggregate privacy, Feed/discovery, Recommendation V2 and the synthetic corpus. Existing milestone commands and `test:demo` remain useful scoped entry points. `npm run bundle:measure` reads the trusted local production manifest and reports the same artifact sums used in M5/M6.

Five new behavioral regressions cover Create/Profile fresh validation errors, existing signed-cover fallback, stored mute preference without hydration writes, and denied-storage/SSR behavior. Existing fixture loaders now load the extracted runtime helpers rather than replacing them with fabricated outputs. One unused shell-card mock was removed; **no existing test case was deleted**. The retained M3 browser harness's pre-V2 fixed-score assumptions were corrected to current preference ordering and duplicate-stability comparisons. Its module syntax and underlying query behavior were checked; a new browser journey was not run as M8 work.

Mock-heavy component/query tests still execute actual production modules, but do not prove browser hydration, physical devices or hosted Supabase. Existing M5 tests that inspect the installed renderer are deliberately specific: they protect the upstream navigation fix and should require review on framework upgrades. Thin compatibility actions still covered by auth/error tests were preserved rather than deleted merely because the current UI chooses newer inline actions.

## Validation and performance

| Check | Result |
| --- | --- |
| M1 | 81 pass |
| M2 | 56 pass |
| M3 | 42 pass |
| M4 | 39 pass |
| M5 | 42 pass |
| M6, including M6.1 | 132 pass, including 31 ecosystem tests |
| New M7 | 5 pass |
| **Combined `npm test`** | **397 pass, zero failures** |
| Full lint | **Zero errors / zero warnings** with warnings treated as failure |
| Production build | PASS, local placeholder Supabase configuration; no deprecation warning |
| Standalone TypeScript | PASS |
| Generated DB types | PASS, no schema/type file changes |
| Package/lock consistency and local imports | PASS |

Local SQL suites replay actual migrations and evaluate grants/RLS, private saves, notifications, ownership, seed reset and messaging in isolated PGlite with platform contract stubs. No Docker requirement or live project mutation was introduced.

M4 tests preserve the established query/lifecycle contracts: Feed moderation **48 → 2**, profile **19 → 11**, inactive collections **4 → 0**, notification owner **3 → 1**. These are retained structural baselines, not newly measured hosted latency. Reel preload remains one active auto, adjacent metadata (one at an edge, two in the middle), distant none. Existing tests retain semantic controls, labels, Story keyboard navigation, camera/message controls and focus behavior; this is not a new full accessibility/device audit.

| Build artifact metric | M6.1 baseline | M7 | Change |
| --- | ---: | ---: | ---: |
| Feed direct client gzip sum | 24,272 B | 24,695 B | +423 B / +1.7% |
| All emitted client JS gzip sum | 356,365 B | 359,733 B | +3,368 B / +0.9% |
| Emitted client JS chunks | 33 | 33 | 0 |

The small increase is accepted and reported, not characterized as a bundle reduction. The changed output includes the explicit browser-store subscriptions/stable callbacks and patched build dependencies; no extra client framework or runtime dependency was added. It was not isolated into per-change causal contributions. Artifact sums do not establish wire bytes, full first-load size, Core Web Vitals or device performance. M5's earlier Feed sum was 23,205 B for context.

## Security review, remaining debt and M8 handoff

Final review checks verified-session identity, return-path sanitization, password recovery, guest mutation boundaries, owner/participant authorization, media validation, private saves and local-only seed safeguards. Rename equivalence and protected-file equality were explicitly verified; query normalization was checked for behavioral equivalence. No service-role secret, public schema migration, RLS relaxation or client-trusted identity was added. M6.1 remains labeled deterministic demo data, manually seeded/reset only against its allowlisted local target. Existing generated media/provenance is unchanged.

Remaining debt:

- The five development dependency findings described above have no published compatible root fix.
- Hosted Auth, PostgREST, Storage, Realtime and actual local `psql`/GoTrue seed integration remain unverified.
- Feed keeps its chronological 80-candidate horizon and current-state pagination; large follow/hidden filters, exact-count work and authenticated Explore's broad reads remain documented limits.
- Private accounts remain unsupported; expired Story Storage reclamation is unchanged.
- Full accessibility, slow-network, physical camera/codec, account switching and end-to-end failure recovery require the separately authorized M8 pass. Unit/SQL success does not establish those outcomes.
- A fresh-clone install and final portfolio presentation are not claimed here. The installed tree had optional extraneous native packages; they were not force-pruned. Lockfile/root consistency was verified.

Recommended M8 scope is the requested full guest/auth and real-user journey matrix across recommendations, camera, Stories, messages, notifications, media/Reels, responsive/accessibility behavior, account switching, recovery and adverse networks/devices. Begin only after explicit approval. No M8 journey execution, hosted mutation, push or deployment is part of M7.

M7 local commit message: `refactor: clean RecoSocial codebase and engineering debt`. The canonical audit records the completed commit identity. Historical audit snapshots, local traces/browser captures, secrets and unrelated ZIP deletions remain excluded.
