# M5: interface, responsive layout and accessibility

11 October 2026. **M5 implementation and local validation are complete.** This document records the current worktree in `C:\Users\Admin\Desktop\instagramclone_app`, based on M4 commit `aec4a96692bd4f13e62f71bde1bcf18787a97197`. This handoff accompanies the local commit `feat: polish RecoSocial interface and responsive UX`; the commit hash is available in Git history and the canonical audit. It is not a hosted deployment claim. M6 has not started. No push, deployment or live Supabase mutation is included.

The user explicitly defined M4 as performance/navigation/data loading and M5 as UI/UX, responsive design, accessibility and product polish. Earlier numbered roadmap descriptions in the historical audit do not change this approved scope. Instagram-inspired feed, profile, stories and reels patterns remain intentional. RecoSocial retains its independently implemented category-affinity ranking; no Meta algorithm or AI/ML implementation is claimed.

## Evidence and current acceptance gate

| Evidence class | Current result |
|---|---|
| Repository source | M5 changes persist in actual production files, including exact Next 16.3.8 for the confirmed upstream navigation fix |
| Automated local checks | Latest relevant suites: **260 passed** = M1 81 + M2 56 + M3 42 + M4 39 + M5 42 |
| TypeScript and database types | Standalone `npm run typecheck` and `npm run types:check` pass |
| Production build | Actual repository production build passes on stock Next 16.3.8, using local synthetic build configuration |
| Changed-file lint | 96 code files: M4 baseline **23 errors / 18 warnings**, M5 **19 errors / 9 warnings**; **zero new or increased file/rule/severity groups**. Lint is not globally clean |
| Responsive browser checks | Twelve checked surfaces at 320, 820 and 1440 px: zero document overflow, one main landmark, and one primary navigation where the shell applies; Reels intentionally has no primary navigation. Feed also passes all nine widths listed below |
| Navigation/browser acceptance | Feed repeated queries, pagination, Back/Forward and rapid navigation settle; Explore, Profile collections and the other documented journeys pass. The final media fixture matrix and Create/Edit broken-source recovery pass |
| Live services | **UNKNOWN / MANUAL LIVE VERIFICATION REQUIRED**: local fixtures do not establish hosted Auth, RLS, Storage, Realtime, deployed policies or real-device network behavior |
| Local M5 commit | Validated source and reviewed documentation; local commit message `feat: polish RecoSocial interface and responsive UX` |

The tests execute real source modules with synthetic dependencies where appropriate; local SQL checks use embedded PostgreSQL contracts. The browser uses the actual production Next application and synthetic local Auth/PostgREST/media services. Scratch scripts, proxy traces, screenshots, fixture data and local configuration remain outside application source and outside the intended commit.

## Feed navigation investigation — confirmed and fixed

**Classification: BROWSER / FRAMEWORK ENVIRONMENT QUIRK — an upstream React rendering/retry defect bundled with Next 16.2.3, relevant to production navigation.** It reproduces in both the original M4 build and current M5 in the local production browser. It is not an M5 UI regression or a harness-only failure. The local fixture timing exposes the race; this does not establish that every browser or network timing will reproduce it.

React can suspend while reading a streamed Server Component model, then yield before attaching a retry listener. If Flight receives the model during that yield, the chunk remains `resolved_model` until initialized. On resume, React unwinds and subscribes; Flight initializes the model and immediately calls the listener. The affected renderer cannot restart its stack during an active render, but also fails to record that synchronous ping. Later suspension bookkeeping clears retry eligibility, leaving complete data with no scheduled render.

The diagnostic trace confirmed this sequence: complete HTTP 200 Flight response; the relevant wakeable changing from received model to fulfilled during listener attachment; pending lanes becoming suspended/warm, with zero pinged lanes and no callback. No image commit guard or decode wait was entered in that failing transition. A roughly 664 ms completed RSC response alone had not proved successful client commit.

The disposable M4 control established causality: the original renderer failed; the single upstream branch correction completed Following → For You → Following with pending cleared; restoring the original renderer reproduced the reverse-direction failure with the same lost-ping state. Image/plain-card/source variants affected rendering timing but did not identify image decoding or SmartImage as the cause. Direct loads and shorter Profile/pathname transitions can avoid this timing and boundary sequence; they are not proof of immunity.

React [PR 36134](https://github.com/react/react/pull/36134) fixes this exact branch; Next [PR 91905](https://github.com/vercel/next.js/pull/91905) brings the corrected renderer into Next. Official npm archive inspection verified the correction in both Next 16.3.0 and 16.3.8. **Production uses the released, unmodified `next@16.3.8` package**, pinned exactly in the manifest/lockfile. Version 16.3.8 includes later [security fixes](https://github.com/vercel/next.js/releases/tag/v16.3.8); existing React/React DOM 19.2.4 and the Node requirement remain compatible. No forced reload, timeout, disabled client router or suppressed pending indicator is used.

The five-case `m5-navigation-retry.test.mjs` regression executes the installed Next renderer's real listener, ping and suspension functions in an isolated VM, extracted with the existing TypeScript parser. It asserts that completed Flight data leaves renderable work, and checks outside-render and asynchronous controls. Against official package renderers, Next 16.2.3 fails the three affected cases and passes two controls; Next 16.3.8 passes all five. It is not a version-string or source-substring assertion. Internal upstream changes require reviewing the test rather than silently skipping it.

On the rebuilt actual application with stock Next 16.3.8, four repeated Feed query cycles showed pending feedback, the destination region and images, then zero remaining pending links. Back/Forward, rapid switches and pagination also completed. Further verified journeys cover Explore topic/search/clear; Profile Posts/Saved/Liked/Hidden/Reported; Edit profile; Settings with public-only copy; Messages and Activity empty states/filter; Saved; Create with preview; post detail; and a Reel opened from Profile with retained context, pause and return navigation. Authentication and active-route state remained intact in these local journeys.

See [the browser regression recipe](NAVIGATION-REGRESSION.md) for a repeatable acceptance check without diagnostic probes. The final production artifact also passes Feed query navigation with delayed and broken media, and Create/Edit preview recovery. No timeout or full-page reload is required.

## Source and rendering controls

| Control | Observed result and implication |
|---|---|
| Unchanged M4 versus M5; image-only cards | Both reproduce the hang; M5 and video playback are not required |
| Plain server text | Settles; reducing the tree changes the triggering render timing |
| SmartImage removed; plain lazy img | Still hangs; SmartImage state/handlers are not causal |
| Same-origin minimal image without loading attribute | Initially hangs, later the same control settles; not a deterministic source/format failure |
| Inline PNG; same-origin small PNG/SVG and larger PNG | These control runs settle; they do not prove immunity to the race |
| Synthetic public Storage-shaped URLs | Responses finish with correct media type; the affected renderer can still lose the Flight retry |
| Delayed and broken images on corrected renderer | Incoming Feed tree commits and pending clears; slow images and failures handle independently |
| Lazy/eager and server/client boundary | Lazy and attribute-omitted failures, plus the renderer A/B/A proof, rule out a required image decode/event wait. A separate complete lazy-versus-eager or server-versus-client factorial comparison was not completed or needed to identify the retry defect |
| Hosted public/signed Supabase media | Not verified; requires the manual live-service check |

## Implemented interface

### Shared identity and navigation

The shared appearance uses charcoal surfaces, one violet accent, system fonts and reusable `rs-*` controls. Decorative global glows, gradients and oversized explanatory panels are removed from the changed product surfaces. Root metadata describes the actual product; the icon and package name use RecoSocial. Framework configuration is unchanged. The only direct dependency version change is the confirmed navigation fix: Next 16.2.3 → exact 16.3.8, with its required transitive updates.

The primary destinations are Home, Explore, Create, Saved and Profile. Below 768 px they occupy five persistent bottom-navigation cells with safe-area spacing and 56 px targets. From 768 to 1279 px a 76 px icon rail remains visible; at 1280 px and above it becomes a 216 px labeled sidebar. Rail/sidebar links are at least 48 px high. The header exposes camera, Messages and Activity with named 44 px controls. Search appears in the wider header and remains available through Explore at smaller widths. Nested primary routes retain active state.

`AppShell` supplies one focusable `main` and a skip link. `PageShell` supplies a content container without another main landmark or duplicate shell padding. Authentication and recovery routes bypass social chrome. The camera, full-screen reels and story viewer retain their special presentation; story creation keeps the normal shell. One existing provider continues to own unread notifications for the mounted shell, with one Activity dot consumer.

### Feed and posts

The Feed uses a compact heading, story row, For You/Following navigation and a constrained post column. Empty stories use a single Add story action rather than an empty carousel. Ranking explanation dashboards and per-card score/reason badges no longer displace content. The M3 ranking/order/membership and M4 moderation batches are unchanged.

Posts retain their content, owner actions, reactions, save and comment flows. Buttons have explicit names and pressed states; exact counts are associated with their controls. Comment fields have labels, limits, pending feedback and failure messages, while the existing mutation reconciliation and draft-retention behavior remain intact. Sharing copies the concrete post or contextual Reel destination and reports clipboard failure instead of claiming success. Post-detail disclosure uses `hidden`, `aria-expanded` and `aria-controls`, so collapsed content is excluded from focus. Empty, loading, not-found and retry presentation is shorter and uses product language; raw internal errors are not exposed on the changed surfaces.

### Images and media presentation

The image-fitting correction applies `object-fit` to the actual `img` inside `SmartImage`; applying a fit class only to its wrapper did not control image pixels. `object-contain` callers now preserve the whole picture; grid/avatar callers use cover. Source-keyed loading/error state, lazy/eager priorities and the original media URLs remain intact.

Feed images reserve a 4:5 area and contain the source, allowing letterboxing rather than stretching or silently cropping it. Video controls retain a stable 4:5 target while loading; the skeleton does not intercept the play control. Grid thumbnails intentionally crop to their grid geometry; missing video thumbnails display a truthful Watch reel fallback. This is presentation work, not a new image transformation, optimizer, URL rewriting or upload pipeline.

The final synthetic image matrix covers square (1000×1000), portrait (800×1000), landscape (1400×800), very wide (2000×500), very tall (500×1800), delayed and HTTP-404 sources across Feed, Profile, Explore, Search, Saved and Create preview. Natural dimensions and computed fitting were checked: Feed/Explore full cards and Create preserve the whole image with contain; Profile/Search/Saved intentionally crop with cover. Slow sources load, failed sources show the existing fallback, and Feed query transitions settle with both present. Avatar and Reel presentation/preload were checked separately; no exhaustive five-shape avatar/Reel matrix is claimed.

The matrix exposed native broken-image presentation in Create/Edit. Both now reuse the existing source-keyed SmartImage component with contain fitting and a concise failure message. Changing a failed URL to a valid URL restores a loaded image in both forms. This small presentation fix preserves the established media form hook, upload and mutation behavior. The synthetic backend does not implement signed Storage URLs, so Edit preview recovery was tested using an explicit fixture public URL. Local fixtures do not verify hosted Storage, signed URLs or playback reliability.

### Profiles, discovery and saved content

The profile header is renamed from `InstagramProfileHeader` to `ProfileHeader` without changing profile identity/data contracts. Bio, counts, actions, category highlights and collection links use a compact hierarchy. Grid counts are readable without hover; phone grids use two columns and larger grids use three. Collection links expose `aria-current` as normal navigation links rather than pretending to be a local ARIA tab widget. Inactive collections remain deferred.

Explore/search uses concise search and category controls, compact creators/results and consistent image grids. URL-keyed search fields reset their draft when the committed query changes, preserving Back/Forward intent without an effect-driven synchronization loop. Category links retain the search query. Saved uses the same card/grid vocabulary and retains scope when opening media. Query eligibility, independent account discovery, rank order and pagination contracts are unchanged.

### Reels and stories

Reels keep full-screen content and contextual return links. Controls are named; inactive slides are `inert` so keyboard focus stays with the active slide. Navigation honors reduced-motion preferences. Thirteen duplicate decorative blurred images are removed from the 13-Reel fixture; the 13 actual posters and their priority policy remain. First-slide preload remains one `auto`, one nearby `metadata`, eleven `none`; the middle-slide policy retains two metadata neighbors.

Story controls have distinct accessible names and disabled previous/next states where unavailable. Story creation retains its existing validation, direct upload and action contract. Camera/story/reel changes in this milestone concern presentation and labels; deep capture, playback, viewport lifecycle and failure-recovery work belongs to a separately approved M6.

### Forms, authentication and secondary surfaces

Login, signup, password recovery and reset use a shared frame and labeled controls. Password visibility is a named non-submit button, and submit controls reflect the real form pending state. Create, post edit and profile edit remove duplicate guide/preview dashboards, retain labels and clear field/status feedback, and use the established media form hook. Existing owner checks, concurrency version, signed media reference and server payload remain intact. Onboarding uses native checkboxes with the same repeated category-name payload.

Activity uses compact filters and rows. Messages/conversations use the same restrained spacing, named inputs and pending/error vocabulary. Settings states the supported dark appearance and public-account behavior truthfully: private accounts remain unavailable, and the unsupported light appearance has no active control. M5 does not add guest mode, new Auth behavior, private accounts, realtime guarantees or settings features.

## Accessibility evidence and limits

Repository/component checks cover named navigation and icon controls, selected/pressed state, form labels, native checkbox/submit behavior, one main landmark, the skip target, hidden disclosure content, inert inactive Reels, failure/status announcements and media-fit placement. Global keyboard focus is unlayered so utility outline resets do not erase it. Reduced-motion CSS suppresses nonessential transitions/animations and smooth scrolling. Shared touch controls use at least 44 px targets; the initial production shell measurements confirmed 56 px phone and 48 px rail/sidebar navigation targets.

Browser keyboard checks confirmed that Enter on Skip to content focuses the main region with a visible outline, and the disclosure can be opened and collapsed by keyboard with collapsed controls absent from the accessible surface. Twelve surfaces were checked at 320, 820 and 1440 px with zero horizontal overflow and one main landmark. Feed additionally passed 320, 375, 390, 600, 768, 820, 1024, 1280 and 1440 px; measured primary targets remain 56 px on phones and at least 48 px in the rail/sidebar. These checks and component/source assertions are not a full screen-reader audit, WCAG certification or proof that every unchanged historical control meets the same standard.

## M1–M4 preservation and performance

No M5 production change is made to `actions/`, `lib/`, `middleware.ts`, migrations/RLS or Supabase client contracts. The necessary Next navigation fix is the only direct dependency version update. M1 verified identity, owner paths and approved public-account model; M2 mutation/media reconciliation and cleanup boundaries; and M3 ranking inputs/order/context remain in force. Server pages continue to fetch their data; small interactive controls remain client components. The notification SDK remains deferred rather than imported into the immediate root dependency path.

| Guard | Passing existing fixture contract |
|---|---|
| Feed moderation, 24 non-owned cards | 48 original per-card reads → **2 batched reads** |
| Default populated self-profile | 19 original requests → **11 requests** |
| Full inactive profile collections | 4 original loads → **0** |
| Notification lifecycle ownership | 3 original owners → **1 mounted-shell monitor** |
| First of 13 Reels | **1 auto / 1 metadata / 11 none** |
| Middle of 13 Reels | **1 auto / 2 metadata / 10 none** |
| Route loading boundaries | **16**, retained |

All 39 M4 cases pass against the final M5 source. These counts describe fixed synthetic query/component fixtures, not hosted latency or wire payload savings.

Using the same artifact measurement method, the final Next 16.3.8 build reports Feed directly referenced chunks at **23,205 summed gzip bytes**, versus pre-upgrade M5 **32,377** and M4 **37,367**. All emitted client JavaScript summed once is **338,150 gzip bytes** across 29 files, versus **345,327** and **352,439** respectively. The final sums are 14,162 bytes lower for Feed and 14,289 lower overall than M4. Next changed chunk/manifest grouping, so these are **build-artifact sums, not browser transfer, complete first-load size, Core Web Vitals or measured device-performance improvements**. A mounted shell still loads its deferred notification dependency. No bundle increase was observed by this method.

## Validation details

Latest relevant automated suites pass **260 tests**: M1 81, M2 56, M3 42, M4 39 and M5 42. M5 comprises shell 8, Feed 11, forms 10, profile/media 8 and navigation retry 5. The profile/media additions cover the compact empty-story rail and post-not-found landmark. The M1 auth fixture now mocks `NavigationLink` and checks Activity's intentionally generic error copy, while retaining percent/error handling assertions for Auth/onboarding. The M4 media expectation removes only duplicate decorative images, preserving actual media/preload/priority checks.

The production build, standalone TypeScript and generated database-type check pass with Next 16.3.8. The existing middleware deprecation warning remains. Changed-file lint compares 96 code files against the M4 source baseline: **23 errors / 18 warnings → 19 errors / 9 warnings**, with no new or increased file/rule/severity group. This is a regression-free comparison, not a globally clean lint result.

Final diff review found no new security/backend-contract blocker. All 43 changed lockfile package entries belong to the old or new Next dependency/optional-dependency tree: Next/env/SWC, Sharp/libvips/WASM/runtime/semver, PostCSS/nanoid and SWC helpers. React/React DOM remain 19.2.4 and the existing lint configuration remains unchanged. No debug probes, synthetic credentials or fixture configuration are included in application source; `git diff --check` passes.

Repository commands are `npm run test:m1`, `npm run test:m2`, `npm run test:m3`, `npm run test:m4`, `npm run test:m5`, `npm run typecheck`, `npm run types:check` and `npm run build`. Continue using the established safe local PostgreSQL and synthetic validation configuration; do not reset or mutate a live project.

**Final acceptance:** the root cause, released fix, regression test, browser journeys, media matrix and source-keyed preview recovery are verified locally. Final diff review found no new security/backend blocker. Only the selected M5 changes and two M5 handoff documents belong in the local commit.

## Changed source map

| Area | Principal production/test files |
|---|---|
| Tokens, identity and metadata | `app/globals.css`, `app/layout.tsx`, `app/icon.svg`, route page metadata, package naming |
| Shell/navigation | `components/layout/app-shell.tsx`, `mobile-nav.tsx`, `navigation-items.ts`, `root-chrome.tsx`, `components/ui/page-shell.tsx` |
| Shared feedback | `components/ui/feedback-banner.tsx`, `surface-empty.tsx`, `surface-hero.tsx`, `animated-shell-card.tsx`, `route-loading.tsx`, `media-skeleton.tsx`, `app/error.tsx`, `app/not-found.tsx`, affected `loading.tsx` routes |
| Feed/post | `app/feed/page.tsx`, `components/feed/feed-list.tsx`, `post-card.tsx`, `post-media.tsx`, `post-engagement-panel.tsx`, `comment-thread-panel.tsx`, `post-detail-disclosure.tsx`, post detail/edit routes and `components/post/` controls |
| Discovery/Saved | `app/explore/page.tsx`, `app/saved/page.tsx`, `components/explore/search-panel.tsx`, `search-results.tsx`, `creator-spotlight-list.tsx` |
| Profile/networks | Self/public profile and follower/following routes, `components/profile/profile-header.tsx`, `profile-post-grid.tsx`, `profile-surface-tabs.tsx`, `profile-surface-empty.tsx`, `hidden-post-grid.tsx`, `network-profile-list.tsx`, `network-search-form.tsx`, follow/share controls |
| Forms/Auth | Auth/recovery routes, `components/auth/auth-frame.tsx`, `password-field.tsx`, `auth-submit-button.tsx`, recovery/reset forms, `components/create/create-post-form.tsx`, `components/post/edit-post-form.tsx`, profile edit/crop components, onboarding form/route |
| Reels/Stories/Camera | Reel/story/camera route presentation, `components/reels/reel-viewer.tsx`, `components/stories/story-rail.tsx`, `story-viewer.tsx`, `create-story-form.tsx`, `components/camera/camera-studio.tsx` |
| Activity/Messages/Settings | Respective route pages and Activity/message presentation components |
| Image fitting | `components/ui/smart-image.tsx` |
| Framework navigation fix | `package.json`, `package-lock.json`, `tests/m5-navigation-retry.test.mjs`, `docs/m5/NAVIGATION-REGRESSION.md` |
| Regression coverage | `tests/m5-shell.test.mjs`, `m5-feed-ui.test.mjs`, `m5-forms.test.mjs`, `m5-profile-media.test.mjs`; focused fixture updates in `m1-auth.test.mjs`, `m4-media.test.mjs` |

Confirmed unused residue removed: `components/layout/desktop-sidebar.tsx`, the component-tree Windows shortcut and five unreferenced starter SVGs (`file`, `globe`, `next`, `vercel`, `window`). The active profile header is a traceable rename, not removal of the Instagram-inspired profile pattern. No wholesale dead-code/dependency purge or history/attribution rewrite is part of M5.

## Commit scope, remaining debt and M6 boundary

The local commit includes selected M5 source/tests, this handoff and the browser regression recipe. Exclude the two pre-existing ZIP deletions, the copied historical `docs/recosocial-audit/` tree, `.codex` artifacts, local synthetic servers, `trace-proxy.cjs`, `capture-proxy.cjs`, browser traces, measurement scripts and local credentials/configuration. The canonical audit receives a dated status addendum locally while its original 7 October body remains historical. Do not stage the entire audit tree.

The navigation blocker and final M5 acceptance work are resolved. Existing global lint, framework deprecation and deeper feature/media limitations remain; local UI checks cannot make hosted Auth/RLS/Storage/Realtime claims. The [manual live-service checklist](../m1/LIVE-SUPABASE-VERIFICATION.md) still applies. M2's safe media garbage-collection boundary and M4's unbounded-history/profile/query and pagination limitations remain documented in their milestone reports.

Recommended M6, only after explicit approval, is deep feature-systems polish: camera, stories, realtime Messages/Notifications, Settings, guest/public browsing and contextual sign-in, recovery/autofill/auth friction where justified, post/reel media loading/playback/viewport behavior and retry/fallback reliability. This recommendation does not authorize implementation, deployment or live-service mutation. Finish M5's validated local commit and stop.
