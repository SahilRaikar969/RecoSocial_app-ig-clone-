import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import test from 'node:test'
import ts from 'typescript'

const jsx = (type, props) => ({ type, props: props || {} })
function load(file, mocks = {}, globals = {}) {
  const filename = fileURLToPath(new URL('../' + file, import.meta.url))
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const mod = { exports: {} }
  runInNewContext(output, { module: mod, exports: mod.exports, URL, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks, globals)
    throw new Error('Unexpected ' + name)
  } }, { filename })
  return mod.exports
}
const { advanceStoryTime, IMAGE_STORY_MS, isStoryExpired, storyDestination } = load('components/stories/story-timeline.ts')
function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)] }
const story=(id,kind='image')=>({id,media_type:kind,media_url:'https://example.test/'+id,caption:id,created_at:'2026-10-12',expires_at:'2099-01-01T00:00:00Z'})

test('story clock preserves elapsed time while paused or hidden, then resumes without skipping', () => {
  let elapsed = advanceStoryTime(0, 1800, IMAGE_STORY_MS, false)
  elapsed = advanceStoryTime(elapsed, 12000, IMAGE_STORY_MS, true)
  assert.equal(elapsed,1800)
  elapsed=advanceStoryTime(elapsed,4000,IMAGE_STORY_MS,false)
  assert.equal(elapsed,5800)
  assert.equal(advanceStoryTime(elapsed,500,IMAGE_STORY_MS,false),6000)
  assert.equal(advanceStoryTime(elapsed,NaN,IMAGE_STORY_MS,false),5800)
})

test('story navigation advances items, crosses authors, and ends at Feed with a bounded previous edge', () => {
  assert.equal(storyDestination(0,3,'next',null).index,1)
  assert.equal(storyDestination(2,3,'previous',null).index,1)
  assert.equal(storyDestination(2,3,'next','next-author').href,'/stories/next-author')
  assert.equal(storyDestination(0,3,'previous','previous-author').href,'/stories/previous-author')
  assert.equal(storyDestination(2,3,'next',null).href,'/feed')
  assert.equal(storyDestination(0,3,'previous',null).href,null)
})

test('expiration treats the deadline as unavailable, without inventing a new retention duration', () => {
  const deadline=Date.parse('2026-10-12T12:00:00Z')
  assert.equal(isStoryExpired('2026-10-12T12:00:00Z',deadline-1),false)
  assert.equal(isStoryExpired('2026-10-12T12:00:00Z',deadline),true)
  assert.equal(isStoryExpired('',deadline),false)
})

function hooks() {
  const cells=[],pending=[];let cursor=0
  const changed=(a,b)=>!a||!b||b.some((value,i)=>value!==a[i])
  return {
    reset(){cursor=0},flush(){while(pending.length)pending.shift()()},cleanup(){for(const c of cells)c?.cleanup?.()},
    react:{
      useState(value){const n=cursor++;if(!(n in cells))cells[n]=typeof value==='function'?value():value;return[cells[n],value=>{cells[n]=typeof value==='function'?value(cells[n]):value}]},
      useRef(value){const n=cursor++;if(!(n in cells))cells[n]={current:value};return cells[n]},
      useCallback(fn,deps){const n=cursor++;if(!cells[n]||changed(cells[n].deps,deps))cells[n]={deps,fn};return cells[n].fn},
      useEffect(fn,deps){const n=cursor++;if(!cells[n]||changed(cells[n].deps,deps))pending.push(()=>{cells[n]?.cleanup?.();cells[n]={deps,cleanup:fn()}})},
      useSyncExternalStore(_subscribe,snapshot){return snapshot()},
    }
  }
}
function viewerFixture({guest=false,reduced=false,kind='image',viewFailure=false}={}) {
  const h=hooks(), routes=[], views=[], timers=new Map();let now=0, timerId=0
  const document={hidden:false,addEventListener(){},removeEventListener(){}}
  const window={matchMedia:()=>({matches:reduced,addEventListener(){},removeEventListener(){}}),setTimeout(fn,delay){timers.set(++timerId,{fn,delay});return timerId},clearTimeout(id){timers.delete(id)},setInterval(fn,delay){timers.set(++timerId,{fn,delay,interval:true});return timerId},clearInterval(id){timers.delete(id)}}
  const router={push:href=>routes.push(href),refresh(){}}
  let activeHooks=h
  const react=new Proxy({}, {get:(_target,name)=>(...args)=>activeHooks.react[name](...args)})
  const Component=load('components/stories/story-viewer.tsx',{react,'next/navigation':{useRouter:()=>router},'next/link':{default:'a'},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/actions/stories':{markStoryViewed:async id=>{views.push(id);return{ok:!viewFailure}}}},{document,window,performance:{now:()=>now}}).StoryViewer
  const props={author:{id:'author',username:'maya',display_name:'Maya'},stories:[story('first',kind),story('second')],initialIndex:0,viewerProfileId:guest?null:'viewer',nextAuthorStoryId:'next-author'}
  return {props,views,routes,document,window,timers,h,
    render(){activeHooks=h;h.reset();const tree=Component(props);h.flush();return tree},
    advance(ms){now+=ms;for(const t of [...timers.values()])if(t.interval)t.fn()},
    getMedia(tree){return nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='StoryMedia')},
    mountMedia(node,video={}){const child=hooks();return{render(props=node.props){activeHooks=child;child.reset();const tree=node.type(props);for(const n of nodes(tree))if(n.type==='video'&&n.props.ref)n.props.ref.current=video;child.flush();return tree},cleanup(){child.cleanup()}}},
  }
}

test('Story viewer records viewed state only after loaded visible playback and never writes for guests', async () => {
  for(const guest of [false,true]) {
    const f=viewerFixture({guest});let tree=f.render()
    assert.equal(f.views.length,0)
    const media=f.getMedia(tree)
    f.document.hidden=true;media.props.onReady();assert.equal(f.views.length,0)
    f.document.hidden=false;media.props.onReady();media.props.onReady();await Promise.resolve()
    assert.deepEqual(f.views,guest?[]:['first'])
    nodes(tree).find(n=>n.props['aria-label']==='Next story').props.onClick()
    tree=f.render();assert.equal(f.getMedia(tree).props.story.id,'second')
    assert.equal(f.getMedia(tree).props.key,undefined)
    f.getMedia(tree).props.onReady();await Promise.resolve()
    assert.deepEqual(f.views,guest?[]:['first','second'])
    f.h.cleanup()
  }
})

test('Story pause, reduced motion, background, keyboard navigation, and close affect the actual viewer props', () => {
  const f=viewerFixture({reduced:true});let tree=f.render()
  assert.equal(f.getMedia(tree).props.paused,true)
  nodes(tree).find(n=>n.props['aria-label']==='Resume story').props.onClick()
  tree=f.render();assert.equal(f.getMedia(tree).props.paused,false)
  f.document.hidden=true;tree=f.render();assert.equal(f.getMedia(tree).props.paused,true)
  f.document.hidden=false;tree=f.render()
  const target={closest:()=>null}
  tree.props.onKeyDown({key:'ArrowRight',target,preventDefault(){}})
  tree=f.render();assert.equal(f.getMedia(tree).props.story.id,'second')
  tree.props.onKeyDown({key:'ArrowRight',target,preventDefault(){}})
  assert.equal(f.routes.at(-1),'/stories/next-author')
  tree.props.onKeyDown({key:'Escape',target,preventDefault(){}})
  assert.equal(f.routes.at(-1),'/feed')
  f.h.cleanup()
})

test('failed seen write remains retryable instead of claiming persisted viewed state', async () => {
  const f=viewerFixture({viewFailure:true});let tree=f.render()
  f.getMedia(tree).props.onReady();await Promise.resolve();tree=f.render()
  assert.ok(nodes(tree).some(n=>n.props.children==='Your viewed status could not be saved.'))
  f.getMedia(tree).props.onReady();await Promise.resolve()
  assert.deepEqual(f.views,['first','first'])
  f.h.cleanup()
})

test('image Story starts its clock after loading, preserves progress through pause, then advances exactly once', () => {
  const f=viewerFixture();let parent=f.render(), node=f.getMedia(parent), child=f.mountMedia(node), tree=child.render()
  f.advance(9000);assert.equal(f.views.length,0,'slow image is not viewed or timed')
  nodes(tree).find(n=>n.type==='img').props.onLoad();child.render()
  assert.deepEqual(f.views,['first'])
  f.advance(2000);parent=f.render()
  assert.equal(nodes(parent).find(n=>n.props.role==='progressbar').props['aria-valuenow'],33)
  nodes(parent).find(n=>n.props['aria-label']==='Pause story').props.onClick();parent=f.render();child.render(f.getMedia(parent).props)
  f.advance(9000);parent=f.render()
  assert.equal(nodes(parent).find(n=>n.props.role==='progressbar').props['aria-valuenow'],33)
  nodes(parent).find(n=>n.props['aria-label']==='Resume story').props.onClick();parent=f.render();child.render(f.getMedia(parent).props)
  f.advance(4000);parent=f.render()
  assert.equal(f.getMedia(parent).props.story.id,'second')
  child.cleanup();f.h.cleanup();assert.equal(f.timers.size,0)
})

test('failed or stalled Story media does not become seen and retries mount with fresh readiness', () => {
  const f=viewerFixture();let parent=f.render(), child=f.mountMedia(f.getMedia(parent)), tree=child.render()
  const loadingTimer=[...f.timers.values()].find(timer=>timer.delay===20000);loadingTimer.fn();tree=child.render()
  assert.ok(nodes(tree).some(n=>n.props.role==='alert'))
  assert.equal(f.views.length,0)
  child.cleanup()
  nodes(parent).find(n=>n.type==='button'&&n.props.children==='Retry media').props.onClick()
  parent=f.render();child=f.mountMedia(f.getMedia(parent));tree=child.render()
  assert.ok(nodes(tree).some(n=>n.type==='img'))
  nodes(tree).find(n=>n.type==='img').props.onLoad();child.render()
  assert.deepEqual(f.views,['first'])
  child.cleanup();f.h.cleanup()
})

test('Story video handles rejected playback, explicit resume, background pause, end, and unload', async () => {
  const f=viewerFixture({kind:'video'});let parent=f.render(),plays=0,pauses=0,unloads=0
  const video={pause(){pauses++},play(){plays++;return plays===1?Promise.reject(new Error('autoplay')):Promise.resolve()},removeAttribute(name){assert.equal(name,'src')},load(){unloads++}}
  const child=f.mountMedia(f.getMedia(parent),video);let tree=child.render()
  nodes(tree).find(n=>n.type==='video').props.onLoadedData();child.render();await Promise.resolve();parent=f.render()
  assert.equal(f.getMedia(parent).props.paused,true)
  assert.deepEqual(f.views, [], 'blocked video must not be recorded as viewed')
  child.render(f.getMedia(parent).props)
  nodes(parent).find(n=>n.props['aria-label']==='Resume story').props.onClick();parent=f.render();child.render(f.getMedia(parent).props)
  assert.equal(plays,2)
  const before=pauses;f.document.hidden=true;parent=f.render();child.render(f.getMedia(parent).props);assert.ok(pauses>before)
  f.document.hidden=false;parent=f.render();tree=child.render(f.getMedia(parent).props)
  nodes(tree).find(n=>n.type==='video').props.onTimeUpdate({currentTarget:{currentTime:5,duration:10}})
  parent=f.render();assert.equal(nodes(parent).find(n=>n.props.role==='progressbar').props['aria-valuenow'],50)
  nodes(tree).find(n=>n.type==='video').props.onEnded();parent=f.render();assert.equal(f.getMedia(parent).props.story.id,'second')
  child.cleanup();f.h.cleanup();assert.equal(unloads,1)
})

function queryFixture(extraRows = null) {
  const calls=[], rows=extraRows || [
    {id:'b-old',author_id:'b',created_at:'2026-10-12T01:00:00Z',expires_at:'2099-01-01',media_type:'image',media_path:'b-old.jpg'},
    {id:'b-new',author_id:'b',created_at:'2026-10-12T02:00:00Z',expires_at:'2099-01-01',media_type:'image',media_path:'b-new.jpg'},
    {id:'a-new',author_id:'a',created_at:'2026-10-12T02:00:00Z',expires_at:'2099-01-01',media_type:'image',media_path:'a-new.jpg'},
  ]
  const client={from(table){const c={table,filters:[],orders:[],limit:null};calls.push(c);const q={select(){return this},eq(key,value){c.filters.push([key,value]);return this},gt(key,value){c.expiry=[key,value];return this},in(key,value){c.filters.push([key,value]);return this},order(key,value){c.orders.push([key,value]);return this},limit(value){c.limit=value;return this},maybeSingle(){c.single=true;return this},then(resolve,reject){let data=[];if(table==='follows')data=[{following_id:'a'},{following_id:'b'}];if(table==='stories'){data=rows.filter(row=>c.filters.every(([key,value])=>Array.isArray(value)?value.includes(row[key]):row[key]===value));for(const [key,options] of [...c.orders].reverse())data.sort((a,b)=>String(a[key]).localeCompare(String(b[key]))*(options.ascending?1:-1));if(c.limit)data=data.slice(0,c.limit);if(c.single)data=data[0]||null}if(table==='profiles'){data=[{id:'a',username:'alice',display_name:'Alice'},{id:'b',username:'bob',display_name:'Bob'}];if(c.single)data=data.find(row=>c.filters.every(([key,value])=>row[key]===value))}if(table==='story_views')data=[];return Promise.resolve({data,error:null}).then(resolve,reject)}};return q}}
  const queries=load('lib/db/queries/stories.ts',{'@/lib/supabase/server':{createClient:async()=>client},'@/lib/media/get-media-url':{getMediaUrl:async value=>value}})
  return{calls,queries}
}

test('guest Story reads query only public tables and retain expiration predicates', async () => {
  const f=queryFixture();const data=await f.queries.getStoryViewerData(null,'b-old')
  assert.equal(data.viewerProfileId,null)
  assert.ok(f.calls.every(c=>!['follows','story_views'].includes(c.table)))
  assert.ok(f.calls.filter(c=>c.table==='stories').every(c=>c.expiry?.[0]==='expires_at'))
  assert.equal(data.previousAuthorStoryId,'a-new')
  assert.equal(data.nextAuthorStoryId,null)
})

test('Story rail starts at oldest unseen item and scopes private viewed lookup to bounded active IDs', async () => {
  const f=queryFixture();const rail=await f.queries.getStoriesRail('viewer')
  assert.equal(rail.find(item=>item.author.id==='b').first_story_id,'b-old')
  const stories=f.calls.find(c=>c.table==='stories');assert.equal(stories.limit,200)
  const views=f.calls.find(c=>c.table==='story_views')
  assert.ok(views.filters.some(([key,value])=>key==='viewer_id'&&value==='viewer'))
  assert.equal(views.filters.find(([key])=>key==='story_id')[1].length,3)
  assert.equal(f.calls.length,4)
})


test('a pending Story video play cannot revive media after pause, background, or unmount', async () => {
  for (const stop of ['pause','background','unmount']) {
    const f=viewerFixture({kind:'video'});let parent=f.render(),resolvePlay,pauses=0
    const video={pause(){pauses++},play:()=>new Promise(resolve=>{resolvePlay=resolve}),removeAttribute(){},load(){}}
    const child=f.mountMedia(f.getMedia(parent),video);let tree=child.render()
    nodes(tree).find(n=>n.type==='video').props.onLoadedData();child.render()
    assert.deepEqual(f.views,[],'loaded data alone is not successful video playback')
    if(stop==='unmount')child.cleanup()
    else if(stop==='background'){f.document.hidden=true;parent=f.render();child.render(f.getMedia(parent).props)}
    else {nodes(parent).find(n=>n.props['aria-label']==='Pause story').props.onClick();parent=f.render();child.render(f.getMedia(parent).props)}
    const before=pauses;resolvePlay();await Promise.resolve();await Promise.resolve()
    assert.ok(pauses>before,stop+' must pause a late successful play')
    assert.deepEqual(f.views,[])
    if(stop!=='unmount')child.cleanup()
    f.h.cleanup()
  }
})

test('Story viewer bounds one author to 200 items and retains an explicitly requested item beyond that window', async () => {
  const rows=Array.from({length:205},(_,i)=>({id:'s-'+String(i).padStart(3,'0'),author_id:'b',created_at:new Date(Date.UTC(2026,9,11,0,i)).toISOString(),expires_at:'2099-01-01',media_type:'image',media_path:'s-'+i+'.jpg'}))
  const f=queryFixture(rows),data=await f.queries.getStoryViewerData(null,'s-204')
  assert.equal(data.stories.length,200)
  assert.equal(data.stories[data.initialIndex].id,'s-204')
  assert.equal(data.initialIndex,199)
  assert.equal(data.stories[0].id,'s-000')
  assert.equal(data.stories[198].id,'s-198')
  assert.ok(f.calls.filter(c=>c.table==='stories'&&!c.single).every(c=>c.limit===200))
  assert.equal(f.calls.length,5,'bounded viewer plus rail uses fixed batched queries')
})

test('Story composer clears a retained file when its replacement fails client validation', () => {
  const h=hooks(),retained=[]
  const Form=load('components/stories/create-story-form.tsx',{react:h.react,'react-dom':{useFormStatus:()=>({pending:false})},'next/link':{default:'a'},'@/components/ui/smart-image':{SmartImage:'img'},'@/lib/media/use-object-url':{useObjectUrl:file=>file?'blob:preview':''},'@/lib/media/use-media-form-action':{useMediaFormAction(_action,_kind,_error,files){retained.push(files);return()=>{}}},'@/actions/stories':{createStory:()=>{}}}).CreateStoryForm
  function render(){h.reset();const tree=Form({});h.flush();return tree}
  let tree=render();const valid={name:'photo.jpg',size:3,type:'image/jpeg'}
  nodes(tree).find(n=>n.props.name==='media_file').props.onChange({target:{files:[valid],value:'photo.jpg'}})
  tree=render();assert.equal(retained.at(-1).media_file,valid)
  const target={files:[{name:'invalid.mp4',size:3,type:'video/mp4'}],value:'invalid.mp4'}
  nodes(tree).find(n=>n.props.name==='media_file').props.onChange({target})
  render();assert.equal(retained.at(-1).media_file,null);assert.equal(target.value,'')
  h.cleanup()
})


test('a Story video resumes after buffering reaches canplay without requiring loadeddata again', async () => {
  const f=viewerFixture({kind:'video'});const parent=f.render();let plays=0,pauses=0
  const video={pause(){pauses++},play(){plays++;return Promise.resolve()},removeAttribute(){},load(){}}
  const child=f.mountMedia(f.getMedia(parent),video);let tree=child.render()
  nodes(tree).find(n=>n.type==='video').props.onLoadedData();tree=child.render();await Promise.resolve()
  assert.equal(plays,1);assert.deepEqual(f.views,['first'])
  nodes(tree).find(n=>n.type==='video').props.onWaiting();tree=child.render();assert.ok(pauses>0)
  assert.ok(nodes(tree).some(n=>n.props.role==='status'))
  nodes(tree).find(n=>n.type==='video').props.onCanPlay();child.render();await Promise.resolve()
  assert.equal(plays,2);assert.deepEqual(f.views,['first'])
  child.cleanup();f.h.cleanup()
})
