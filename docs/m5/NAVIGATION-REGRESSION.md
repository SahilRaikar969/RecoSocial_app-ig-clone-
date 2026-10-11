# Production browser navigation regression

11 October 2026. This recipe guards the completed-response/client-commit hang fixed by the Next 16.3.8 update. Run it against a production build; a direct URL load alone does not test the regression.

## Setup

1. Install the committed lockfile with `npm ci`, then run `npm run test:m5`, `npm run build` and `npm run start` using the project's documented environment configuration.
2. Sign in with an authorized test account. Use a local synthetic backend or an explicitly approved test environment. Do not create or modify live Supabase data as part of this check without authorization.
3. Ensure the account follows at least one creator with public image posts. Include enough posts to exercise both Feed views and pagination. A mixture of image sizes and optional video posts makes the rendering path representative. Following and For You may overlap; each must still show its correct active view and destination content.
4. Open Home and wait for the initial feed and media to render. Keep the browser console available for errors. Do not add diagnostic code or change router behavior.

## Core sequence

1. Click **Following** using the page link. When network timing makes it visible, confirm pending/loading feedback appears. Confirm the URL selects Following, the Following link becomes current, the incoming content appears, and the pending indicator clears.
2. Click **For You** and check the same sequence. Repeat the round trip at least four times. Do not reload between transitions.
3. Navigate to the next page, when available, and back. Confirm pagination changes the displayed page and retains the selected feed view.
4. Use browser Back and Forward through the Feed view/page history. Confirm URL, current-link state and displayed content agree after every settled navigation.
5. Switch the view rapidly, then wait for the final requested destination. It must settle with the correct current link and no permanently pending control.

Checking only the URL or only the disappearance of a spinner is insufficient. The destination content must commit. If content order happens to overlap across views, also inspect the selected view, page indication and the expected posts from the test dataset.

## Adjacent journeys

- Explore: choose a topic, search, clear the query and use Back/Forward. Query text, topic selection and results must match the committed URL.
- Profile: open Posts, Saved, Liked, Hidden and Reported, then return to Posts. Each collection must settle and the selected link must match its contents.
- Open an image post detail and return. Open a Reel from Profile, pause it, and return using its contextual Back link; the originating context must be retained.
- Visit Saved, Messages, Activity, Create, Edit profile and Settings through client links. Verify empty states where the dataset is empty, visible active-route state and continued authentication. Inspect a Create preview without publishing solely for this check.
- Repeat the core sequence on phone, tablet and desktop widths. Confirm navigation remains reachable and there is no horizontal document overflow.

## Pass and failure record

Record the commit/build, Next version, browser, viewport widths, dataset shape, completed sequences and any console errors. A pass requires correct destination content, settled pending state and preserved authentication. Fast cached navigation may complete before a loading hint can be observed; do not introduce an artificial delay into application code merely to show one.

If a navigation remains pending after its response has completed, record the exact source/destination and whether the URL, selected link and content changed. Capture the failing state before a reload. Do not treat a timeout, forced document navigation, hidden loading indicator or disabled client router as a fix.

The automated `tests/m5-navigation-retry.test.mjs` exercises the installed Next renderer's synchronous retry bookkeeping. It fails on the affected Next 16.2.3 renderer and passes on 16.3.8. It complements this browser recipe; it does not establish hosted Auth, Storage or RLS correctness.
