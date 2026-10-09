import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const viewer = 'viewer'
const now = Date.parse('2026-10-08T12:00:00Z')
const ok = data => ({ data, error: null })
const category = slug => ({ category_id: slug, categories: { id: slug, name: slug, slug } })
const ids = posts => posts.map(post => post.id)
function post(id, overrides = {}) {
  return {
    id, author_id: `author-${id}`, caption: id, media_type: 'image', media_path: `${id}.jpg`,
    thumbnail_path: null, created_at: '2000-01-01T00:00:00Z', status: 'published', visibility: 'public',
    profiles: { id: `author-${id}`, username: id, display_name: id, avatar_url: null },
    post_categories: [category('cooking')], likes: [], saves: [], comments: [], ...overrides,
  }
}

// This fixture executes relational filters and limits instead of returning a
// canned post list. It tests query semantics; hosted RLS is verified separately.
function fixture({ posts = [], hidden = [], follows = [], likes = [], saves = [], preferences = [], counts = {}, profiles, profileId = viewer } = {}) {
  const viewerId = profileId
  const state = {
    profiles: profiles ?? [...new Map(posts.map(row => [row.profiles.id, row.profiles])).values()],
    comments: posts.flatMap(row => row.comments.map(comment => ({ ...comment, post_id: row.id }))),
    posts: structuredClone(posts), hidden: new Set(hidden),
    follows: follows.map(id => ({ follower_id: viewerId, following_id: id })),
    likes: structuredClone(likes), saves: structuredClone(saves),
    profile_category_preferences: preferences.map(slug => ({ profile_id: viewerId, ...category(slug) })),
  }
  const calls = []
  const invalidations = []
  const client = {
    calls,
    async rpc(name, args) {
      assert.equal(name, 'get_visible_post_save_counts')
      assert.deepEqual(Object.keys(args), ['post_ids'])
      calls.push({ table: 'rpc', ids: args.post_ids })
      return ok(args.post_ids.map(id => ({ post_id: id, save_count: counts[id] ?? state.saves.filter(row => row.post_id === id).length })))
    },
    from(table) {
      const query = { table, filters: [], orders: [], limit: Infinity, single: false, operation: 'select' }
      const match = row => query.filters.every(([op, key, value]) => {
        if (op === 'ilike') {
          const literal = value.slice(1, -1).replace(/\\(.)/g, '$1').toLowerCase()
          return String(row[key] ?? '').toLowerCase().includes(literal)
        }
        if (op === 'eq') return row[key] === value
        if (op === 'neq') return row[key] !== value
        if (op === 'in') return value.includes(row[key])
        if (op === 'not.in') return !value.includes(row[key])
        throw new Error(`Unexpected fixture filter: ${op}`)
      })
      const chain = {
        ilike(key, value) { query.filters.push(['ilike', key, value]); return chain },
        select(columns) { query.columns = columns; return chain },
        eq(key, value) { query.filters.push(['eq', key, value]); return chain },
        neq(key, value) { query.filters.push(['neq', key, value]); return chain },
        in(key, value) { query.filters.push(['in', key, value]); return chain },
        not(key, operator, raw) {
          assert.equal(operator, 'in')
          query.filters.push(['not.in', key, raw.replace(/^\(|\)$/g, '').split(',').map(value => value.trim().replace(/^"|"$/g, ''))])
          return chain
        },
        order(key, options = {}) { query.orders.push([key, options.ascending !== false]); return chain },
        limit(value) { query.limit = value; return chain },
        maybeSingle() { query.single = true; return chain },
        upsert(payload, options) { query.operation = 'upsert'; query.payload = payload; query.options = options; return chain },
        delete() { query.operation = 'delete'; return chain },
        then(fulfill, reject) {
          return Promise.resolve().then(() => {
            calls.push(query)
            if (query.operation === 'upsert') {
              assert.ok(table === 'likes' || table === 'saves')
              assert.equal(query.options.onConflict, 'profile_id,post_id')
              assert.equal(query.options.ignoreDuplicates, true)
              assert.equal(query.payload.profile_id, viewerId)
              if (!state[table].some(row => row.post_id === query.payload.post_id && row.profile_id === viewerId)) {
                state[table].push(query.payload)
              }
              return ok(null)
            }
            if (query.operation === 'delete') {
              state[table] = state[table].filter(row => !match(row))
              return ok(null)
            }
            let rows = state[table]
            assert.ok(Array.isArray(rows), `Unknown fixture table: ${table}`)
            rows = rows.filter(match)
            for (const [key, ascending] of [...query.orders].reverse()) {
              rows = [...rows].sort((a, b) => (a[key] < b[key] ? -1 : a[key] > b[key] ? 1 : 0) * (ascending ? 1 : -1))
            }
            rows = rows.slice(0, query.limit)
            if (table === 'likes' || table === 'saves') {
              rows = rows.map(row => ({ ...row, posts: state.posts.find(post => post.id === row.post_id) ?? null }))
            } else if (table === 'posts') {
              rows = rows.map(row => ({ ...row,
                likes: [...row.likes, ...state.likes.filter(like => like.post_id === row.id)],
                saves: [...row.saves, ...state.saves.filter(save => save.post_id === row.id && save.profile_id === viewerId)],
              }))
            }
            return ok(query.single ? rows[0] ?? null : rows)
          }).then(fulfill, reject)
        },
      }
      return chain
    },
  }
  return { state, client, calls, invalidations, viewer: viewerId }
}

function load(file, context = fixture(), overrides = {}) {
  const source = readFileSync(resolve(root, file), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  })
  const loaded = { exports: {} }
  const jsx = (type, props) => ({ type, props })
  const dependencies = {
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' },
    'next/link': { default: 'Link' },
    '@/components/ui/navigation-link': { NavigationLink: 'Link' },
    'next/cache': { revalidatePath: path => context.invalidations.push(path) },
    'next/navigation': { redirect: path => { throw new Error(`redirect:${path}`) } },
    '@/lib/supabase/server': { createClient: async () => context.client },
    '@/lib/auth/get-dev-session': { getDevSession: async () => ({ profileId: context.viewer }) },
    '@/lib/db/queries/post-moderation': {
      getHiddenPostIds: async () => context.state.hidden,
      getViewerPostModerationStates: async (_profileId, ids) => new Map(ids.map(id => [id, {
        hiddenByViewer: context.state.hidden.has(id), reportedByViewer: false,
      }])),
    },
    '@/components/feed/post-card': { PostCard: 'PostCard' },
    ...overrides,
  }
  new Function('require', 'module', 'exports', outputText)(name => {
    if (name in dependencies) return dependencies[name]
    if (name.startsWith('@/lib/')) return load(`${name.slice(2)}.ts`, context, overrides)
    throw new Error(`Unexpected test import: ${name}`)
  }, loaded, loaded.exports)
  return loaded.exports
}
const getFeed = (context, options = {}) => load('lib/db/queries/feed.ts', context).getFeedData(context.viewer, { now, ...options })
function renderedPosts(tree) {
  if (!tree || typeof tree !== 'object') return []
  if (Array.isArray(tree)) return tree.flatMap(renderedPosts)
  if (tree.type === 'PostCard') return [tree.props.post]
  return renderedPosts(tree.props?.children)
}
async function renderPosts(posts, feedView = 'for-you') {
  const tree = await load('components/feed/feed-list.tsx').FeedList({ posts, devProfileId: viewer, feedView })
  return renderedPosts(tree)
}


export { fixture, load, post, category, ids, getFeed, renderedPosts, renderPosts, viewer, now }
