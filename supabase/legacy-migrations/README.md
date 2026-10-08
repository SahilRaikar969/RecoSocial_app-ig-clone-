# Historical migration archive

These nine original files are preserved byte-for-byte for audit and recovery context. They are outside the Supabase migration discovery directory and MUST NOT be replayed. SHA-256 hashes are listed in manifest.json.

The legacy history is not a reproducible baseline: 001 and 002 are truncated, 003 version numbers collide, profiles have incompatible UUID/text definitions, dependent tables are missing, and seed identifiers conflict with Auth UUID identities. Archiving does not resolve an existing project's migration history.

The ordered migrations in ../migrations are **clean-install only**. The database baseline refuses to run when public application relations or Auth users exist. The storage migration refuses existing media buckets or storage object policies. They contain no production reset, truncate, or drop-data strategy.

For an existing Supabase project:
1. Export a schema-only snapshot, migration history and policy/grant/function/trigger definitions through an authorized read-only review. Back up data using the project's established process.
2. Compare actual column types, keys, indexes, RLS policies, bucket properties and Auth profile provisioning with the clean-install definitions.
3. Write a separate, additive forward migration tailored to those differences. Inspect existing rows for constraint conflicts before applying constraints.
4. Test that migration on an isolated copy, including two-user authorization and rollback/recovery steps.
5. Obtain explicit deployment approval. Do not mark old history applied, replay this archive, reset an existing database, or run the clean-install baseline as an upgrade.

See docs/m1/LIVE-SUPABASE-VERIFICATION.md for the service-level verification checklist. The embedded tests execute PostgreSQL SQL and RLS against minimal Auth/Storage contract tables; they do not prove hosted service behavior.
