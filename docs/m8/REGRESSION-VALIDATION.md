# M8 regression validation

Recorded 12–14 October 2026 (Asia/Calcutta). Baseline: M7 `cfa9cdeb4b7d139fc82549b7635459df2155b6a1`.

**M8 implementation and scoped local validation are complete: seven confirmed defects repaired, 434 tests pass, production build/TypeScript/generated types pass and lint is 0/0. Final rebuilt-browser stale-form/account-switch checks pass. This report is included in the single local M8 commit; its exact hash is recorded in the local canonical audit and final handoff.** No M9, hosted mutation, push or deployment has occurred. Earlier milestone documents describe their own historical checkpoints.

## Evidence and scope

- **B — browser:** the production Next application, real server queries/actions, ranker and components against a disposable loopback Auth/REST/Storage/Realtime fixture.
- **Q — module/query tests:** actual application modules with controlled dependencies, including behavioral component/lifecycle tests.
- **D — database:** actual migrations and seed SQL executed in isolated PostgreSQL through PGlite with minimal platform Auth/Storage contracts.
- **S — clean install:** a disposable archive of committed M7 with a fresh npm cache, followed by install/build/test/startup checks.

These are complementary forms of local evidence. The browser fixture cannot prove hosted GoTrue, RLS, Storage, trigger transactions or Realtime behavior. Its test-only sign-in personas do not change the real M6.1 seed's non-login Auth actors. It imports the exact deterministic ecosystem and generated project media; it neither replaces nor tunes the production ranker. Fixture restarts discard local sessions, uploads and interactions. No real user media, credentials, tokens or scratch harness artifacts are included in the commit.

## Journey matrix

The numbered rows cover all 42 requested final-report areas. A pass applies to the stated observation, not every possible device, race or network condition.

| # | Area | Result and evidence | Boundary |
| --- | --- | --- | --- |
| 1 | M8 status | Seven confirmed defects repaired; final 434-test suite, build, TypeScript, DB types and lint pass. Final rebuilt-browser account-switch/stale-form checks pass. | Independent security review found no blocking issue. Hosted/device boundaries remain separate. |
| 2 | Fresh clone/install | **S:** committed archive, fresh-cache `npm ci`, 375 packages, unchanged manifest/lock hashes; original 397 tests, lint, TS, build, dev/start and HTTP checks passed. Newline-only type-check failure reproduced and corrected. | Clean committed copy, not remote clone or fresh OS. Six optional native/WASM entries also appeared as extraneous after fresh install; no forced pruning. |
| 3 | Guest journey | **B:** public Feed, Explore/search, zero-post account, Profile, post, Reels, Stories and Back/Forward work. Like/Save/Comment/Follow link to contextual login. Protected Create/Story Create/Messages/Activity/Saved/Settings/Profile Edit redirect safely. | Direct unauthorized mutations additionally tested at **Q/D**; hidden controls alone are not authorization evidence. |
| 4 | Auth/signup/logout | **B:** valid login/context return, bad password, native empty/malformed validation, password visibility/keyboard and autocomplete attributes; signup→onboarding→24-post Feed; duplicate username error; repeated explicit logout/login and stable client navigation. | Fixture signup only. Actual confirmation, provider rate limits, password-manager autofill and every pending-submit race are not browser-proven. |
| 5 | Account switching | **B:** retained A Saved changes automatically to B's collection after another tab switches; reverse switch clears an unsent comment and restores A state; expired synthetic sessions clear protected tabs to login. **Q:** later and first-verification races repaired. | Latest rebuild: retain Login in tab 1, Travel logs in tab 2, stale tab 1 submits Fitness successfully; untouched tab 2 replaces three Travel saves with three Fitness saves without refresh. Verified polling is not instant cross-tab broadcast. |
| 6 | Password recovery | **B:** privacy-preserving request success; invalid recovery token shows invalid/expired alert/new-link action and removes token query. **Q:** invalid/expired/malformed and unsafe-return cases, including an old session, pass. | No real email, valid recovery token/PKCE lifecycle or password change was completed. |
| 7 | Recommendation personas | **B/Q:** Fitness 8/12 relevant; Travel 8/12; Gaming/Tech 6+6; Mixed three each across four topics; Cold Start all ten categories within 24. | Controlled corpus/clock observations, not universal quotas or measured satisfaction. |
| 8 | Interaction-driven ranking | **B:** cold-start like yields five fitness posts in first 12; authoritative unlike restores exact baseline IDs; save yields seven; unsave clears Saved membership. Food+Travel preference change persists and alters Feed. | Exact browser ranking-ID comparison after unsave/follow/comment is not recorded; numerical addition/removal contracts pass at **Q/D**. |
| 9 | Creator affinity | **Q:** historical signals affect fresh creator content across categories; caps, follow boost and removal pass. **B:** follow populates strict Following; unfollow empties it. | Browser follow result is not a separately measured creator-score experiment. |
| 10 | Diversity/exploration | **B:** strong personas retain relevant content and exploration. **Q:** creator/category repetition penalties, relevance guard, recency and engagement scenarios pass unchanged. | Reduced repetition is not a hard quota; strong-category runs of eight can remain. |
| 11 | Pagination | **B:** four pages contain 24/24/24/8 posts, 80 unique IDs; Back/Forward works. **Q:** fixed-state/clock stability for five personas. | Changed interactions/candidates/time can reorder later requests; no immutable ranking snapshot. |
| 12 | Following Feed | **B:** fitness Following contains 15 posts from its followed creator only. Authenticated cold start: empty→follow→15 eligible posts→unfollow→empty. **Q:** membership before cap and paging. | Following ranks within followed creators; it does not promise chronological order. |
| 13 | Create/edit/delete | **B:** failed portrait upload retains file/caption/category; retry publishes once. WebM publishes/plays. Uploaded media edit now accepts resolved URL; stale version reports conflict; reload/save persists caption/topics; replacement persists new landscape path; cancel returns correctly; owner deletion empties profile. Wrong-owner edit redirects with no edit/delete controls. | A new owner post is not guaranteed on personalized page one. Atomicity/compensation and direct owner checks are **Q/D**, not proved by fixture behavior alone. |
| 14 | Camera | **B:** ready video surface, generated-file upload fallback/preview and Back removing camera DOM; all nine widths fit. **Q:** acquisition races, no/denied/busy camera, switching, close/background and track/recording cleanup. | Browser ready state is not physical capture or a hardware-indicator test. |
| 15 | Stories | **B:** tall image publish→Your Story→open; contain fit, pause, Space resume, arrows previous/next and Escape; existing video readiness; broken image→Retry→same-URL recovery; all nine widths. **Q/D:** six-hour expiry, seen identity/readiness and lifecycle. | Full next-author/background/slow-media matrix was not separately rerun in this M8 browser pass; module evidence is distinct. |
| 16 | Messages | **B:** two separately signed-in browser origins exchange messages live; failed send retries once; duplicate delivery stays single; reconnect retrieves missed message; older history loads. Enter sends once; Tab/Shift+Tab visible focus. Repeated route cycles keep bounded channels. | Burst/scroll/read-receipt/account-race contracts have **Q/D** coverage; full browser matrix and hosted Realtime remain unverified. |
| 17 | Notifications | **B:** realtime Activity arrival once despite duplicate event, mark-all-read then empty Unread, keyboard target navigation and read-state reconciliation. One persistent owner after repeated route cycles. **Q:** auth refresh, reconnect and stale-generation cleanup. | Fixture trigger simulation is not database proof; actual triggers are exercised at **D**. Final rebuilt-browser logout clears the other retained Saved tab to contextual Login and leaves zero fixture subscriptions. |
| 18 | Likes/saves/comments/follows | **B:** authoritative like/unlike/save/unsave and Saved membership; comment appears once with count 1→2/draft cleared; follow/unfollow changes Following. **Q/D:** duplicate/failure/removal/ownership contracts. | Full rapid-toggle/failure cross-product is not a browser pass. |
| 19 | Profile | **B:** own/other grids, zero-post account and Reels; cropped generated avatar/display name save persists after refresh, avatar 512×512; published/replaced/deleted content reflected; nine widths fit. **Q:** lazy/private collections. | An initial false conflict was a fixture timestamp mismatch, not an application defect. |
| 20 | Explore/search | **B:** Travel category, exact escaped username/zero-post account, content results, no-results/clear, Back/Forward query restoration; Explore failed request→keyboard Retry recovers. Search/Explore fit all widths. **Q:** literal escaping, eligibility, ties/context. | Rapid-query/stale-result cases are not separately browser-measured. Initial underscore miss was fixed only in scratch fixture. |
| 21 | Reels | **B:** actual ready/playing active video; rapid Next/Next/Previous leaves one playing; mute/pause, bounded preload, source failure→same-URL retry and Back/Forward; nine widths fit. | Native autoplay rejection, hidden-tab and slow-source matrix not separately browser-proven; lifecycle tests cover controlled equivalents. |
| 22 | Image reliability | **B:** portrait upload, square camera/avatar, tall Story, very-wide post and landscape replacement; contain dimensions inspected; broken Story image recovers; cross-surface navigation did not reproduce M5 renderer hang. | Not every aspect ratio × surface × cache/delay/failure combination was exercised. |
| 23 | Video reliability | **B:** uploaded WebM playback, failed source/recovery and rapid navigation with one active player. **Q:** stale play promises, source lifecycle, offscreen/unmount and buffering/retry. | Device codecs, cellular buffering and OS audio interruption remain manual. |
| 24 | Settings | **B:** public-account copy/no private toggle, fixed dark theme/light unavailable; preferences persist on reopen and affect Feed; profile persistence, logout and nine widths pass. | Unsupported private accounts remain explicitly disabled. |
| 25 | Navigation | **B:** Feed/Following/Profile/Explore/Search/Reels/Saved/Messages/Activity/Create/Story/Camera/Settings/Post/Interests/Profile Edit, query changes, Back/Forward and client transitions work. | No reproduced permanent App Router hang; this is not proof of every transition/race. Framework remains pinned. |
| 26 | Adverse network | **B:** message retry/reconnect, upload 503 retaining input, video and Story source recovery; Feed/Explore 503 shows recoverable error and Retry restores populated results. | Controlled service faults, not complete OS offline/cellular simulation. Full latency matrix remains limited. |
| 27 | Direct URL/refresh | **B:** protected URL context; Feed/post/Profile/Reel/Saved/Story/Auth/Recovery paths and refresh; edited profile data persists. **S:** clean dev/start route/media probes. | HTTP 200 alone was not counted as a functional journey. |
| 28 | Responsive | **B:** Feed, Profile, Explore, Search, Reels, Stories, Messages, Activity, Create, Camera, Settings, Login and Signup have no horizontal overflow at all nine specified widths. | Visual screenshots inspected for Saved at 320×900 and Feed at 1440×900; no overflow and labeled demo content. This is not physical-device/touch/virtual-keyboard proof. |
| 29 | Accessibility | **B:** Tab/Shift+Tab, solid focus, skip link→main, password Space, Story Space/arrows/Escape, message Enter/controls, notification target Enter and recovery Retry keyboard. Post options disclosure opens. **Q:** semantic contracts. | No completed screen-reader/full WCAG audit. No inspectable report dialog was established, so no dialog pass is claimed. |
| 30 | Resource/lifecycle | **B:** three Feed→Messages→Thread→Feed cycles: two channels in thread, one same notification owner on Feed, no accumulation; rapid Reel navigation leaves one player; camera DOM removed. **Q:** timers/tracks/object URLs and cleanup. SDK channels return 2→0; final rebuilt-browser logout also leaves zero subscriptions and clears both retained protected tabs. | No long heap soak or instrumented count of every observer/listener/track. |
| 31 | Security/privacy | **Q/D:** verified identity, private saves/messages/notifications/seen rows, media ownership, unsafe redirects, forged IDs and seed guards. **B:** protected guest routes, wrong-owner edit and cross-tab private UI repair. | Hosted grants/RLS/JWT/Storage remain unknown. Delivered HTML may exist until successful identity verification. |
| 32 | M6.1 ecosystem | **Q/D:** 31 tests cover deterministic bounded corpus, guarded fresh/repeat seed/reset, collision refusal and unrelated-row preservation. Same corpus powers browser personas. | No hosted seed or full local-Supabase `psql` run. |
| 33 | Performance | Existing contracts pass: Feed moderation 48→2, profile 19→11, inactive collections 4→0, notification owners 3→1, bounded Reel preload. Initial identity uses existing proxy verification without extra Auth/profile request. | Root header binding makes HTML routes dynamic. No hosted latency, Core Web Vitals or performance improvement claimed. |
| 34 | Bundles | Feed direct client gzip sum 25,011 B (+316, +1.28%); all client JS 360,265 B (+532, +0.15%), 33 chunks vs M7. | Artifact sums, not initial-load/wire transfer or a latency benchmark. |
| 35 | Defects | Seven repairs have regression coverage and affected browser/contract retests; see below. | No speculative feature redesign, dependency update or ranker tuning. |
| 36 | Tests | Final integrated suite **434 pass**, zero failures/skips/cancellations; includes SQL, recommendations, demo and 37 M8 regressions. | Focused command counts overlap; do not add them to 434. |
| 37 | Build/TS/DB/lint | Latest production build, standalone TypeScript after build, generated-type check and lint pass; lint **0 errors / 0 warnings**. Final bundle measured unchanged. | Runtime upstream Gzip warning is disclosed separately; no warning-free runtime claim. |
| 38 | Physical devices | Precise [manual checklist](MANUAL-DEVICE-CHECKLIST.md) prepared. | Camera permissions/capture/codecs, mobile Safari/Android, touch, keyboards, screen readers, native autofill and cellular are unverified. |
| 39 | Live Supabase | No live project used or mutated. | Auth/email/redirects, deployed migrations/grants/RLS/triggers, Storage and Realtime need separate authorized validation. |
| 40 | Remaining M8 debt | No known blocking local defect remains in the exercised scope. Unexercised cross-products, long soak and upstream warning remain explicitly bounded. | Do not convert a narrower pass into full browser/device/hosted coverage. |
| 41 | Local commit | Included in the single local M8 commit `fix: harden RecoSocial real-user journeys and reliability`; exact hash is recorded in the canonical local audit and final handoff. | Unrelated ZIP deletions, historical audit tree, env, scratch, traces, screenshots and test credentials are excluded. No push/deploy. |
| 42 | Recommended M9 | Authorized hosted inventory/backup/forward migrations, Auth/RLS/Storage/Realtime/HTTPS/concurrency and physical-device validation. | Recommendation only. M9 has not started; no push/deploy. |

The widths are **320, 375, 390, 600, 768, 820, 1024, 1280 and 1440 CSS pixels**. Final visual spot checks also inspected Saved at 320×900 and a populated 24-post Feed at 1440×900; the final account-switch screenshot was also inspected. Screenshots remain scratch evidence, excluded from the commit. Resized desktop checks establish geometry for inspected states; they do not establish touch reachability, virtual-keyboard behavior, device safe areas or screen-reader usability.

## Recommendation results

The unchanged ecosystem contains **30 labeled synthetic actors** (20 creators and ten personas), **300 posts** (240 images, 60 Reels), ten categories, 33 follows, 808 likes, 139 private saves, 86 comments and 33 preference rows. Categories: fitness, gaming, technology, travel, food, cars, fashion, photography, music and sports. Ten generated illustrations and one project-generated silent video are reused. No scraped content or real applicant/user media was introduced.

| Persona | Rendered first-page observation |
| --- | --- |
| Fitness | Eight fitness posts among first 12; four exploration posts |
| Travel | Eight travel posts among first 12; four exploration posts |
| Gaming/tech | Six gaming and six technology among first 12 |
| Mixed | Three each travel, food, photography and music among first 12 |
| Cold start | Seven categories among first 12; all ten within first 24 |

Production Feed queries using the real Supabase JavaScript client over local HTTP independently reproduce these profiles and four pages of 80 unique candidates. Browser likes/saves and preferences change the visible mix; authoritative unlike restores the precise baseline. Current-query tests establish removal of like/save/comment contributions, creator affinity, follow boost, recency, engagement, repetition penalties and stable fixed-state pagination.

V2 is independently engineered deterministic heuristic ranking, not ML or a replication of Meta/Instagram's proprietary system. Instagram-inspired product patterns remain intentional. The 80-candidate horizon bounds current Feed opportunities; older corpus posts supply interaction histories and profile content without all entering the Feed. Following filters before ranking. Changes between page requests can reorder later results. No weight was tuned to make these fixtures pass, and no relevance/retention uplift is claimed.

## Defects and minimal repairs

| Severity | Reproduction and cause | Repair and verification |
| --- | --- | --- |
| MEDIUM | Clean committed generated types contained 540 CRLFs while the generator emits LF; check rejected identical TypeScript. | Normalize CRLF only in check comparison. Real-generator regression accepts LF/CRLF, rejects semantic drift and never rewrites during check; clean copy and primary pass. |
| MEDIUM | Story key reused A's seen/playback state when viewer became B. | Include viewer-or-guest identity in existing key. Reconciliation tests cover A→B→guest→A and same-viewer state. |
| HIGH | Feed/detail comments reused A's unsent private draft under B. | Key both comment panels by viewer and post. Regression proves clean B draft and same-user retention; reverse browser account switch clears draft. |
| HIGH | Server authorization did not remove A's already rendered Saved content after B signed in elsewhere. | Existing one-owner session monitor compares verified identities, removes descendants and reloads once. Focus/online/visibility/poll checks distinguish transient failure from logout. Browser A→B→A and expiry pass. |
| HIGH, related race | Binding baseline on first browser verification missed A-rendered HTML whose first check returned B, including initial outage→B. | Proxy overwrites internal viewer header with existing verified identity; layout passes immutable document baseline. Compare first and later successful checks. Eight regressions red→green; same-account navigation/login/logout stable. |
| MEDIUM | Uploaded storage paths in a native URL field blocked metadata Save and gave absent previews. | Resolve browser URLs while preserving original owned paths for unchanged submissions. Cover signed URLs, MIME/extension, replacement, clear/change and video→image→video compatibility; browser edit/save/stale conflict/replacement pass. |
| MEDIUM | An old login form submitted after another tab signed in hit a Proxy document redirect and an unexpected-server-response error boundary. | Limit page redirects to GET/HEAD; retain verified identity/cookies and action/API authorization. Eleven red→green tests and rebuilt-browser stale-form/cross-tab retest pass. |

The viewer header binds client document state; it is **not an authorization primitive**. Proxy overwrites supplied values for verified, guest and Auth-error renders, preserves refreshed cookies and forwards no token/secret. Server session checks and RLS remain authoritative. Root layout header access makes HTML routes request-rendered but adds no second Auth/profile request; static assets retain their bypass.

Already delivered A HTML can remain visible until successful browser verification. Detection uses initial/focus/online/visible checks and 15-second polling, not instantaneous cross-tab erasure. A transient network/Auth error retains the rendered identity until authoritative evidence arrives.

The edit repair changes presentation/form references only. Owner checks, owner-path validation, Storage metadata MIME/size checks and the atomic post/category RPC remain. Integrated testing caught and corrected a video→image→video signed-cover regression before acceptance; explicit cover clearing still clears it.

The seventh **MEDIUM** defect occurred after another tab signed in: submitting a retained login form received an unexpected-server-response error boundary because Proxy redirected the authenticated login POST as document navigation. Private content had cleared; this was a form/action recovery defect. Proxy now applies page redirects only to GET/HEAD. All matched requests still verify identity, refresh cookies, bind the document header and preserve private no-store behavior; POST reaches its independently authorized action/API. Eleven regressions ran red (nine failures) before the change and green afterward; 60 combined initial-viewer/M1/proxy checks pass. A logged-out create action rejects before database work, and camera upload rejects with 401 before reading the body. Final integrated suite/build/TypeScript/DB types/lint all pass. On the rebuilt production app, tab 1 retained Login while tab 2 signed in as Travel; submitting Fitness credentials in tab 1 succeeded at Saved without an error boundary. Untouched tab 2 automatically replaced its three Travel saves with three Fitness saves without refresh, verifying both stale-form recovery and current document/account boundaries. Final logout automatically cleared that tab to contextual Login; active fixture subscriptions returned to zero, with no new browser or server errors observed in this final run.

## Validation ledger

| Check | Result |
| --- | --- |
| Clean committed archive / fresh-cache install | 375 packages; manifest/lock hashes unchanged |
| Clean original suite / build / TS / lint | 397 pass; build/TS pass; lint 0/0 |
| Clean DB types original→repair | Newline-only failure→pass; schema/generated content unchanged |
| Final integrated `npm test` | **434/434 pass**, zero failures/skips/cancellations |
| Recommendation focused command | 91 pass; unchanged cases also included in final full suite |
| Ecosystem focused command | 31 pass; unchanged cases also included in final full suite |
| Initial-identity / edit-media focused checks | 14 pass; covered again in final integrated suite |
| Proxy stale-form regression / combined Auth checks | 11 red→green regressions / 60 pass; included in final integrated pass; stale-form/cross-tab browser retest passes |
| `npm run build` | Pass with explicit loopback public configuration |
| `npm run typecheck` | Pass, `tsc --noEmit --incremental false` |
| `npm run types:check` | Pass, contracts match migrations |
| `npm run lint` | Pass, **0 errors / 0 warnings** |
| `npm run bundle:measure` | Feed 25,011 B; all 360,265 B; 33 chunks |
| Final `git diff --check` / source-and-test secret pattern scan | Pass / 21 files checked, no matching secrets found |
| Independent final security review | No concrete blocking security or authorization regression found |
| Final rebuilt-browser stale login / cross-tab Saved | Pass; retained form submits successfully and other tab replaces Travel with Fitness without refresh |
| Final rebuilt-browser logout / cleanup | Both retained protected tabs clear to Login; zero active fixture subscriptions, no new console/server errors observed |
| Local commit | This report belongs to the single local M8 commit; exact hash in canonical local audit/final handoff |

No schema, generated database type, recommendation algorithm, demo corpus, package version or lockfile was changed. Next remains 16.3.8 and React 19.2.4. The 37 added tests target seven discovered defects; overlapping focused commands do not inflate the complete-suite count.

The clean-copy process used `git archive` of committed M7 into a disposable directory, an empty npm cache, unchanged package/lock hashes, then install/build/test/dev/start commands. This exposes reliance on missing tracked files or stale build/cache state without changing the primary checkout. It is not evidence from another OS or remote checkout.

## Environment findings and residual limits

- **Fixture-only:** production literal-underscore escaping was correct; scratch ILIKE matching was corrected with 16 matcher tests. Exact zero-post account search then passed. No application search change.
- **Fixture-only:** synthetic profiles lacked update timestamps expected by optimistic edits. Actual DB columns/triggers provide them. Fixture correction enabled persisted avatar/name browser checks; no application profile fix.
- **Environment-only:** a sandboxed clean build could not canonicalize/access SWC paths; the authorized identical build passed without dependency workaround.
- **Upstream runtime warning:** large compressed Explore responses emitted `MaxListenersExceededWarning` for Gzip drain listeners. A separate reproduction with installed Next compression/response piping and no app/backend/Auth reproduced three response-owned streams with 41 listeners each; each stream was destroyed on completion. This supports a response-scoped framework issue, not demonstrated cross-request accumulation. It neither proves long-run heap safety nor justifies suppressing the warning. No framework change or `setMaxListeners` workaround was added.
- **Minor media-validation mismatch:** external video links ending in `.m4v`, `.ogg` or `.3gp` can pass the expanded edit preview/precheck but the existing server URL validator rejects them. Owned Storage uploads remain supported and ownership validation is unchanged. No security bypass was found; the differing client/server messages remain a usability limitation.
- **Coverage limits:** physical devices, real email/recovery, actual hosted policies/services and a long-running memory soak remain unverified. Browser coverage is stated per row; full aspect-ratio/network/race cross-products and screen-reader/dialog behavior are not silently labeled passed.

The manual checklist separates local fixture observations, actual SQL tests, physical-device checks and hosted work. Later rollout must inventory the intended target and reconcile migrations before any authorized mutation. No M9 or README/portfolio work is included here.
