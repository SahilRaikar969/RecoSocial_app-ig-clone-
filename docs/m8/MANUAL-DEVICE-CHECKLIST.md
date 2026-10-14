# M8 manual device and hosted-integration checklist

Prepared 14 October 2026 (Asia/Calcutta). **All unchecked items are NOT RUN**, not failures and not pass claims. This checklist records evidence that desktop resizing, fixture-backed browser runs and module/PGlite tests cannot establish. M8 authorizes no hosted mutation, deployment or M9 rollout.

Use generated project assets and dedicated test accounts. Real M6.1 seeded actors deliberately cannot sign in; use locally provisioned sign-in accounts or the isolated test transport. Never record credentials, tokens, request headers, real user files or private conversations. Record device/OS, browser/version, app commit, target, viewport/orientation, network/permission conditions and the observed result.

## Physical camera and capture

- [ ] On iOS Safari and Android Chrome, allow, deny and dismiss camera permission, then explicitly retry. Check missing/busy camera where possible. A useful error and upload fallback remain available.
- [ ] Switch front/back camera repeatedly; capture portrait and landscape; retake/cancel; press Back; close the tab; background/foreground; rotate the device. Check hardware camera/microphone indicators turn off when the owner exits. Returning from background must follow the application's explicit retry behavior.
- [ ] Record with audio; stop manually and at duration/byte limits; cancel during recording; leave while permission is pending. Verify tracks and recording indicators stop and no late result reopens a disposed preview.
- [ ] Upload/capture and publish a generated image, video and Story. Open from a second test account. Check orientation, codec, thumbnail, audio, captions and touch controls. A desktop generated WebM pass does not prove mobile codec support.

## Reels, Stories and file handling

- [ ] Reels: first load, rapid next/previous, fast scrolling, mute/unmute, play/pause, browser Back/Forward, home/background, screen lock and audio interruptions/headphones. At most the active relevant video plays; no hidden audio continues.
- [ ] Stories: image/video progress, pause/resume, previous/next/next author, close/Escape, supported touch gestures, source error/retry and orientation. Progress stops while paused/backgrounded and begins only after readiness. Verify six-hour expiration with a controlled clock/data scenario.
- [ ] Exercise permitted image/video formats from the device picker, large/corrupt/unsupported files and cancellation. Check actionable validation and retained originals. Use generated files only.
- [ ] Test very tall/wide, portrait/square/landscape images across Feed, Profile, Explore/search, Saved, Create and Stories. Check contain/cover intent, no stretching, source replacement, cache reload and failed/delayed-source recovery.
- [ ] Edit an uploaded image/video's caption/category without replacing media; clear/change a video cover; switch image/video form mode and return; upload replacement and cancel. Confirm unchanged paths remain owned and explicit cover clearing stays cleared.

## Responsive and accessibility

- [ ] Check 320, 375, 390, 600, 768, 820, 1024, 1280 and 1440 CSS-pixel widths across Feed, Profile, Explore/search, Reels, Stories, Messages, Activity, Create/Camera, Settings, login/signup and dialogs. Record actual hardware separately from resized desktop evidence. Essential controls remain reachable without unintended horizontal scrolling.
- [ ] Open the virtual keyboard in login, comments, message composer, profile and upload forms. Check sticky navigation, errors and submit controls are not obscured. Test portrait/landscape and device safe areas.
- [ ] Use 200% zoom, large system text, reduced motion and forced colors/high contrast. Focus, selected and disabled states must remain distinguishable without color alone.
- [ ] Keyboard only: Tab/Shift+Tab, skip link, primary navigation, Feed actions, comment/upload forms, profile tabs, camera fallback, message composer, Story arrows/Escape and Reels controls. Check logical order, visible focus, usable dialogs and focus return; no unintended trap.
- [ ] NVDA with Chrome/Firefox and VoiceOver with Safari: landmarks/headings, link purpose, image alternatives, labels, errors, pending states, messages, unread indicators and media control names/states. DOM labels alone do not establish screen-reader usability.

## Authentication, credentials and direct links

- [ ] Native password manager: autofill/paste login and signup, show/hide password, empty/invalid values, duplicate submit while pending and recoverable failure. Check safe contextual return. Test private browsing/storage restrictions separately.
- [ ] **Manual credential-change handoff:** the human tester controls credentials, recovery mailbox and confirmation prompts. Test authenticated password change/reset completion and sign-in with the changed credential without storing or reporting either credential. Automation did not change a password during M8.
- [ ] Open Feed/Following, post detail, own/public Profile, category/search Explore, contextual Reels, Saved, Messages, Activity, Create and Settings directly; refresh; repeat Back/Forward. Auth, query/return context and error recovery remain correct.
- [ ] Malformed/unsafe return URL and invalid/expired recovery links fail safely. A local request-success page is not proof that email arrived or that a real token can create a recovery session.

## Cross-tab state and network recovery

- [ ] In a browser profile, retain A's Saved, unsent comment/message, Activity, conversation and Story in several tabs. Sign out and sign in as B in another tab; return/focus each old tab and wait for verified refresh. Old private content/drafts disappear; B sees correct states. Switch back. Record detection latency; do not assume an instantaneous broadcast.
- [ ] Repeat with the first verification delayed until after A→B, temporary Auth failure, expired session and pending mutations. A stale response/subscription must not restore A's private UI. Same-account token refresh must not create reload loops or erase a draft unnecessarily.
- [ ] Check independently signed-in A/B browser profiles: both-way messages, rapid sends, failure/retry, duplicate event delivery, reconnect gap and older history. One confirmed UUID appears once; read/unread reconcile; participants remain isolated.
- [ ] Slow/high-latency network, temporary offline and recovery on Feed, Explore/search, uploads, image/video/Reels/Stories, Messages and Notifications. Errors are recoverable; relevant input survives where appropriate; retries do not duplicate confirmed writes or leave endless loading.
- [ ] Repeat route entry/exit and account switches while inspecting browser connections/media. Compare baseline after owners unmount: camera tracks, active playback, owned channels, object URLs/listeners/timers and Story progression must not grow continually. Record heap/resource evidence separately; a response-scoped framework warning is not proof of either a leak or leak-free operation.

## Hosted verification — separate M9 authorization required

These steps are neither executed nor authorized by this checklist. Start only after explicit M9 approval, target identification and the agreed backup/forward-migration plan.

- [ ] Actual Supabase Auth signup/confirmation, duplicate account behavior, rate limits, logout, redirect allowlist, PKCE/token-hash callbacks and delivered reset-email expiry/single-use semantics. Record manual credential-change completion without exposing credentials.
- [ ] Inventory deployed tables/grants/policies/triggers/RPCs against reviewed migrations. Use two real JWT identities plus anon to test private saves/seen/notifications/messages, forged IDs and non-owner mutations. Never infer deployed enforcement from a browser transport fixture.
- [ ] Actual Storage owner paths, bucket policies, MIME/size rules, signed URLs and expiry/renewal, replacement compensation and uncertain upload/delete outcomes. Confirm secrets remain absent from browser bundles/logs.
- [ ] Actual Realtime publication/JWT refresh, both-way messaging, duplicate prevention, catch-up, recipient filters, account switch and cleanup. Local simulated WebSocket transport is not hosted Realtime proof.
- [ ] Production HTTPS/redirect configuration, direct routes/refresh/Back/Forward, caching, media MIME/ranges, concurrency, native devices and cellular performance. Any deployment needs its separate authorization.

## Record each outcome

| Scenario | Device / OS / browser | Commit / target | Conditions | PASS / FAIL / BLOCKED / NOT RUN + date | Follow-up |
| --- | --- | --- | --- | --- | --- |
| Complete during manual run | Not run | Not run | Not run | NOT RUN | Evidence must omit secrets/private data |

A blocked or untested item stays unverified. For a defect, record reproducible steps and the expected/observed outcome; after repair, repeat the original journey and cleanup check. Keep physical, local fixture, actual SQL and hosted evidence clearly separate.
