import { PGlite } from '@electric-sql/pglite'
import { readFile, readdir } from 'node:fs/promises'

export const migrationsDirectory = new URL('../migrations/', import.meta.url)

// Contract stubs only: PostgreSQL executes actual application migrations/RLS.
// This does not implement GoTrue, PostgREST, Storage HTTP or Realtime.
const platformContract = String.raw`
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  unique (bucket_id, name)
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to anon, authenticated;
`

export async function applyMigrations(db) {
  const names = (await readdir(migrationsDirectory)).filter(name => name.endsWith('.sql')).sort()
  for (const name of names) {
    try {
      await db.exec(await readFile(new URL(name, migrationsDirectory), 'utf8'))
    } catch (error) {
      await db.exec('rollback')
      throw error
    }
  }
  return names
}

export async function createTestDatabase({ migrations = true } = {}) {
  const db = new PGlite()
  try {
    await db.exec(platformContract)
    if (migrations) await applyMigrations(db)
    return db
  } catch (error) {
    await db.close()
    throw error
  }
}

// Sequential use per database: role and JWT are connection-local.
// Never use this helper concurrently on one PGlite connection.
export async function asRole(db, role, userId, callback) {
  if (!['anon', 'authenticated'].includes(role)) throw new Error('Unsupported test role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ''])
  await db.exec('set role ' + role)
  try {
    return await callback()
  } finally {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claim.sub', '', false)")
  }
}
