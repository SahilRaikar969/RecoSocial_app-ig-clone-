import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, overrides = {}, globals = {}) {
  const filename = fileURLToPath(new URL('../' + file, import.meta.url))
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const mod = { exports: {} }
  runInNewContext(output, { module: mod, exports: mod.exports, URL, Promise, ...globals, require(name) {
    if (name in overrides) return overrides[name]
    if (name.startsWith('@/lib/')) return load(name.slice(2) + '.ts', overrides, globals)
    return require(name)
  } }, { filename })
  return mod.exports
}
const { createPlaybackController } = load('lib/media/playback-controller.ts')
const tick = async () => { await Promise.resolve(); await Promise.resolve() }

function fixture(readyState = 0) {
  const listeners = new Map()
  const requests = []
  const states = []
  const video = {
    readyState, pauses: 0, loads: 0,
    play() { return new Promise((resolve, reject) => requests.push({ resolve, reject })) },
    pause() { this.pauses++; this.emit('pause') },
    load() { this.loads++ },
    addEventListener(name, fn) { listeners.set(name, fn) },
    removeEventListener(name, fn) { if (listeners.get(name) === fn) listeners.delete(name) },
    emit(name) { listeners.get(name)?.({ type: name }) },
  }
  const controller = createPlaybackController(video, state => states.push(state))
  return { video, controller, requests, listeners, states, state: () => states.at(-1) }
}
const visible = { active: true, foreground: true, autoplay: true }

test('visible autoplay requests one play without waiting for loadeddata, then reflects actual playback', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.controller.setPolicy(visible)
  assert.equal(f.requests.length, 1)
  assert.equal(f.state().buffering, true)
  f.video.emit('playing')
  f.requests[0].resolve()
  await tick()
  assert.equal(f.state().playing, true)
  assert.equal(f.state().ready, true)
  assert.equal(f.state().buffering, false)
})

test('offscreen pauses a manually started mobile/detail video, even when autoplay is disabled', async () => {
  const f = fixture()
  f.controller.setPolicy({ ...visible, autoplay: false })
  assert.equal(f.requests.length, 0)
  f.controller.toggle()
  f.requests[0].resolve()
  await tick()
  assert.equal(f.state().playing, true)
  f.controller.setPolicy({ ...visible, autoplay: false, active: false })
  assert.equal(f.state().playing, false)
  assert.ok(f.video.pauses > 0)
})

test('late play fulfillment after scrolling away cannot revive an inactive video', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.controller.setPolicy({ ...visible, active: false })
  const pauses = f.video.pauses
  f.requests[0].resolve()
  await tick()
  assert.ok(f.video.pauses > pauses)
  assert.equal(f.state().playing, false)
})

test('rapid away/back changes do not let an older play promise pause the newer permitted request', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.controller.setPolicy({ ...visible, active: false })
  f.controller.setPolicy(visible)
  const pauses = f.video.pauses
  f.requests[0].resolve()
  await tick()
  assert.equal(f.video.pauses, pauses)
  assert.equal(f.state().playing, false)
  f.requests[1].resolve()
  await tick()
  assert.equal(f.state().playing, true)
})

test('background transition pauses playback; foreground resumes permitted intent only', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.requests[0].resolve()
  await tick()
  f.controller.setPolicy({ ...visible, foreground: false })
  assert.equal(f.state().playing, false)
  f.controller.setPolicy(visible)
  assert.equal(f.requests.length, 2)
  f.requests[1].resolve()
  await tick()
  f.controller.toggle()
  f.controller.setPolicy({ ...visible, foreground: false })
  f.controller.setPolicy(visible)
  assert.equal(f.requests.length, 2, 'explicit pause persists when returning to the tab')
})

test('autoplay rejection offers a user retry and does not masquerade as a corrupt source', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.requests[0].reject(new Error('NotAllowedError'))
  await tick()
  assert.equal(f.state().blocked, true)
  assert.equal(f.state().failed, false)
  f.controller.toggle()
  f.requests[1].resolve()
  await tick()
  assert.equal(f.state().blocked, false)
  assert.equal(f.state().playing, true)
})

test('a cancelled request rejection cannot erase a newer playing state', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.controller.setPolicy({ ...visible, active: false })
  f.controller.setPolicy(visible)
  f.requests[1].resolve()
  await tick()
  f.requests[0].reject(new Error('AbortError'))
  await tick()
  assert.equal(f.state().playing, true)
  assert.equal(f.state().blocked, false)
})

test('buffering has an explicit state and clears when frames resume', async () => {
  const f = fixture(2)
  f.controller.setPolicy(visible)
  f.requests[0].resolve()
  await tick()
  f.video.emit('waiting')
  assert.equal(f.state().buffering, true)
  f.video.emit('playing')
  assert.equal(f.state().buffering, false)
})

test('failed media stops; retry reloads the same source and recovers without changing its signed URL', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.video.emit('error')
  assert.equal(f.state().failed, true)
  f.controller.setPolicy(visible)
  assert.equal(f.requests.length, 1)
  f.controller.retry()
  assert.equal(f.video.loads, 1)
  assert.equal(f.requests.length, 2)
  assert.equal(f.state().failed, false)
  f.video.emit('loadeddata')
  f.requests[1].resolve()
  await tick()
  assert.equal(f.state().ready, true)
  assert.equal(f.state().playing, true)
})

test('unexpected native playing events are stopped while offscreen or hidden', () => {
  for (const policy of [{ ...visible, active: false }, { ...visible, foreground: false }]) {
    const f = fixture()
    f.controller.setPolicy(policy)
    const pauses = f.video.pauses
    f.video.emit('playing')
    assert.ok(f.video.pauses > pauses)
    assert.equal(f.state().playing, false)
  }
})

test('unmount removes every listener, pauses, ignores state updates, and stops late fulfillment', async () => {
  const f = fixture()
  f.controller.setPolicy(visible)
  f.controller.dispose()
  const stateCount = f.states.length
  assert.equal(f.listeners.size, 0)
  f.requests[0].resolve()
  await tick()
  assert.equal(f.states.length, stateCount)
  assert.ok(f.video.pauses >= 2)
  f.controller.dispose()
  f.controller.toggle()
  assert.equal(f.requests.length, 1)
})

function hooks() {
  let cursor = 0
  const slots = [], pending = []
  return {
    render(fn) { cursor = 0; return fn() },
    flush() { for (const run of pending.splice(0)) run() },
    unmount() { slots.forEach(slot => slot?.cleanup?.()) },
    react: {
      useMemo(fn) { return fn() },
      useState(initial) { const n = cursor++; slots[n] ??= { value: initial }; return [slots[n].value, next => { slots[n].value = typeof next === 'function' ? next(slots[n].value) : next }] },
      useRef(initial) { const n = cursor++; slots[n] ??= { current: initial }; return slots[n] },
      useEffect(fn, deps) {
        const n = cursor++, old = slots[n]
        if (!old || deps.some((dep, i) => dep !== old.deps[i])) pending.push(() => { old?.cleanup?.(); slots[n] = { deps, cleanup: fn() } })
      },
    },
  }
}

test('the React adapter replaces source ownership and cleans visibility listeners on unmount', () => {
  const h = hooks()
  const visibility = new Set()
  const document = { visibilityState: 'visible', addEventListener: (name, fn) => visibility.add(fn), removeEventListener: (name, fn) => visibility.delete(fn) }
  const { useVideoPlayback } = load('lib/media/use-video-playback.ts', { react: h.react }, { document })
  let source = 'first.mp4'
  const render = () => h.render(() => useVideoPlayback(source, true, false, true))
  let output = render()
  const a = fixture(), b = fixture()
  a.controller.dispose(); b.controller.dispose()
  output.videoRef.current = a.video
  h.flush()
  output = render()
  output.toggle()
  assert.equal(a.requests.length, 1)
  source = 'second.mp4'
  output.videoRef.current = b.video
  output = render(); h.flush()
  assert.equal(a.listeners.size, 0)
  assert.equal(visibility.size, 1)
  assert.equal(b.requests.length, 0, 'new source resets manual play intent')
  output.toggle()
  assert.equal(b.requests.length, 1)
  document.visibilityState = 'hidden'
  visibility.forEach(fn => fn())
  assert.ok(b.video.pauses > 0)
  h.unmount()
  assert.equal(visibility.size, 0)
  assert.equal(b.listeners.size, 0)
})

const jsx = (type, props, key) => ({ type, props: props || {}, key })
const nodes = tree => tree && typeof tree === 'object' ? Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)] : []
test('SmartImage source keys reset failure state, and opt-in retry recreates the failed image', () => {
  const h = hooks()
  const { SmartImage } = load('components/ui/smart-image.tsx', {
    react: h.react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@/components/ui/media-skeleton': { MediaSkeleton: 'Skeleton' },
  })
  const props = { src: 'https://media.test/image.png?token=unchanged', alt: 'Landscape', className: 'object-contain', retryable: true }
  const root = SmartImage(props)
  assert.notEqual(root.key, SmartImage({ ...props, src: 'https://media.test/new.png' }).key)
  const render = () => h.render(() => root.type(root.props))
  let image = nodes(render()).find(node => node.type === 'img')
  assert.equal(image.props.style.objectFit, 'contain')
  assert.ok(nodes(render()).some(node => node.type === 'Skeleton'))
  image.props.onError()
  const failed = render()
  assert.equal(nodes(failed).filter(node => node.type === 'img').length, 0)
  nodes(failed).find(node => node.type === 'button').props.onClick()
  image = nodes(render()).find(node => node.type === 'img')
  assert.equal(image.key, 1)
  assert.equal(image.props.src, props.src)
  image.props.onLoad()
  assert.equal(nodes(render()).filter(node => node.type === 'Skeleton').length, 0)
})

test('SmartImage does not put retry buttons inside link/avatar callers unless opted in', () => {
  const h = hooks()
  const { SmartImage } = load('components/ui/smart-image.tsx', { react: h.react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/components/ui/media-skeleton': { MediaSkeleton: 'Skeleton' } })
  const root = SmartImage({ src: 'https://media.test/broken.png', alt: '', className: 'object-cover' })
  const render = () => h.render(() => root.type(root.props))
  nodes(render()).find(node => node.type === 'img').props.onError()
  assert.equal(nodes(render()).filter(node => node.type === 'button').length, 0)
})

test('a media failure that preceded hydration is surfaced instead of leaving a permanent loading state', () => {
  const f = fixture()
  f.controller.dispose()
  f.video.error = { code: 4 }
  const states = []
  const controller = createPlaybackController(f.video, state => states.push(state))
  controller.setPolicy(visible)
  assert.equal(states.at(-1).failed, true)
  assert.equal(f.requests.length, 0)
  controller.retry()
  assert.equal(f.requests.length, 1)
  assert.equal(states.at(-1).failed, false)
  controller.dispose()
})


test('partially visible PostMedia permits explicit playback while preserving the 70-percent autoplay gate', async () => {
  const h=hooks(),f=fixture();f.controller.dispose()
  let observe
  class IntersectionObserver { constructor(callback){observe=callback} observe(){} disconnect(){} }
  const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}}
  const window={innerWidth:1024,addEventListener(){},removeEventListener(){},localStorage:{getItem:()=>null,setItem(){}}}
  const Component=load('components/feed/post-media.tsx',{react:h.react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{usePathname:()=>'/feed'},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/components/ui/media-skeleton':{MediaSkeleton:'Skeleton'},'@/components/ui/smart-image':{SmartImage:'Image'}},{IntersectionObserver,document,window}).PostMedia
  function render(){const tree=h.render(()=>Component({mediaType:'video',mediaUrl:'https://example.test/video.mp4'}));for(const node of nodes(tree))if(node.props.ref)node.props.ref.current=node.type==='video'?f.video:{};h.flush();return tree}
  render();observe([{isIntersecting:true,intersectionRatio:0.25}]);let tree=render()
  assert.equal(f.requests.length,0,'a quarter-visible video must not autoplay')
  nodes(tree).find(n=>n.props['aria-label']==='Play video').props.onClick()
  assert.equal(f.requests.length,1,'manual play works even when a tall video cannot reach 70% visibility')
  f.requests[0].resolve();await tick();render()
  observe([{isIntersecting:false,intersectionRatio:0}]);render()
  const pauses=f.video.pauses
  assert.ok(pauses>0,'leaving the viewport pauses manual playback')
  h.unmount()

  const h2=hooks(),policies=[];let nextObserver
  class NextObserver { constructor(callback){nextObserver=callback} observe(){} disconnect(){} }
  const Next=load('components/feed/post-media.tsx',{react:h2.react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{usePathname:()=>'/feed'},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/components/ui/media-skeleton':{MediaSkeleton:'Skeleton'},'@/components/ui/smart-image':{SmartImage:'Image'},'@/lib/media/use-video-playback':{useVideoPlayback(_source,active,autoplay){policies.push({active,autoplay});return{videoRef:{current:null},toggle(){},retry(){}}}}},{IntersectionObserver:NextObserver,document,window}).PostMedia
  function policyRender(){const tree=h2.render(()=>Next({mediaType:'video',mediaUrl:'video.mp4'}));nodes(tree).filter(n=>n.props.ref).forEach(n=>{n.props.ref.current={}});h2.flush()}
  policyRender();nextObserver([{isIntersecting:true,intersectionRatio:0.25}]);policyRender();assert.deepEqual(policies.at(-1),{active:true,autoplay:false})
  nextObserver([{isIntersecting:true,intersectionRatio:0.8}]);policyRender();assert.deepEqual(policies.at(-1),{active:true,autoplay:true})
  nextObserver([{isIntersecting:false,intersectionRatio:0}]);policyRender();assert.deepEqual(policies.at(-1),{active:false,autoplay:false})
  h2.unmount()
})

test('guest post detail retains the authoritative comment count when only the latest 100 comments are loaded', async () => {
  const post={id:'post',author_id:'author',media_type:'image',media_path:'image.jpg',caption:'Public post',created_at:'2026-10-11',comment_count:150,like_count:0,save_count:0,comments:Array.from({length:100},(_,id)=>({id:String(id),author_id:'author',body:'Comment',created_at:'2026-10-11'}))}
  const mocks={'react/jsx-runtime':{jsx,jsxs:jsx},'next/link':{default:'a'},'next/navigation':{notFound(){throw new Error('missing')}},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/actions/comments':{deleteCommentByOwner(){}},'@/actions/posts':{deletePost(){}},'@/lib/auth/get-dev-session':{getOptionalSession:async()=>null},'@/lib/db/queries/post':{getPostPageData:async()=>post},'@/lib/db/queries/post-moderation':{getViewerPostModerationState(){throw new Error('guest moderation')}},'@/lib/media/get-media-url':{getMediaUrl:async value=>value},'@/lib/routes/media-links':{buildPostOpenHref:()=>'/post/post'}}
  for(const [file,name] of [['feed/feed-list','FeedList'],['feed/comment-thread-panel','CommentThreadPanel'],['feed/post-engagement-panel','PostEngagementPanel'],['feed/post-media','PostMedia'],['ui/feedback-banner','FeedbackBanner'],['post/copy-post-link-button','CopyPostLinkButton'],['post/post-viewer-controls','PostViewerControls']])mocks['@/components/'+file]={[name]:name}
  const Page=load('app/post/[postId]/page.tsx',mocks).default
  const tree=await Page({params:Promise.resolve({postId:'post'})})
  assert.equal(nodes(tree).find(n=>n.type==='PostEngagementPanel').props.commentCount,150)
})
