# RecoSocial

RecoSocial is a social application built with Next.js, React, TypeScript and Supabase. Its Feed uses a deterministic recommendation system based on interests, interactions, follows, engagement, recency and diversity.

## Local development

Install dependencies with `npm ci`, configure the public Supabase variables from `.env.example` in `.env.local`, and run `npm run dev`. Database setup and the boundary between local validation and live service verification are documented in [Database setup](docs/m1/DATABASE-SETUP.md) and [Live Supabase verification](docs/m1/LIVE-SUPABASE-VERIFICATION.md).

## Engineering documentation

- [Recommendation V2](docs/m6/RECOMMENDATION-V2.md)
- [Feature systems](docs/m6/FEATURE-SYSTEMS.md)
- [Engineering quality and validation](docs/m7/ENGINEERING-QUALITY.md)
- [Local synthetic ecosystem and guarded seed/reset](docs/m6/DEMO-ECOSYSTEM.md)

Use `npm run build`, `npm run typecheck`, `npm run lint` and `npm run types:check` for build, TypeScript, lint and database contract checks. Run the complete local suite with `npm test`; focused database and ranking suites use `npm run test:db` and `npm run test:recommendations`. Milestone tests are available as `npm run test:m1` through `npm run test:m6`; `npm run test:demo` runs the synthetic ecosystem tests.
