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
  runInNewContext(output, { module: mod, exports: mod.exports, URL, File, Blob, FormData, ...globals, require(name) {
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'fragment' }
    if (name in mocks) return mocks[name]
    if (name.startsWith('@/')) return load(name.slice(2) + '.ts', mocks, globals)
    throw new Error('Unexpected ' + name)
  } }, { filename })
  return mod.exports
}
const { createCameraSession, cameraFailureMessage, captureDimensions } = load('components/camera/camera-session.ts')
function stream() {
  const tracks = [{ stops: 0, stop() { this.stops++ } }, { stops: 0, stop() { this.stops++ } }]
  return { tracks, getTracks: () => tracks, getVideoTracks: () => [tracks[0]] }
}
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b }); return { promise, resolve, reject } }

test('camera releases every track when closed, including an outstanding permission grant', async () => {
  const request = deferred(), media = stream()
  const session = createCameraSession(() => request.promise)
  const pending = session.open({ video: true })
  session.close()
  request.resolve(media)
  assert.equal(await pending, null)
  assert.deepEqual(media.tracks.map(track => track.stops), [1, 1])
})

test('switching camera closes the previous stream and rejects a superseded device response', async () => {
  const first = stream(), second = deferred(), third = deferred(), late = stream(), current = stream(), constraints = []
  const queue = [Promise.resolve(first), second.promise, third.promise]
  const session = createCameraSession(value => { constraints.push(value); return queue.shift() })
  assert.equal(await session.open({ video: { deviceId: 'first' } }), first)
  const pendingSecond = session.open({ video: { deviceId: 'second' } })
  assert.deepEqual(first.tracks.map(track => track.stops), [1, 1])
  const pendingThird = session.open({ video: { deviceId: 'third' } })
  third.resolve(current); assert.equal(await pendingThird, current)
  second.resolve(late); assert.equal(await pendingSecond, null)
  assert.deepEqual(late.tracks.map(track => track.stops), [1, 1])
  assert.deepEqual(current.tracks.map(track => track.stops), [0, 0])
  session.close(); session.close()
  assert.deepEqual(current.tracks.map(track => track.stops), [1, 1])
  assert.equal(constraints[2].video.deviceId, 'third')
})

test('permission denial is actionable and a later retry can acquire a stream', async () => {
  const failure = { name: 'NotAllowedError' }, media = stream()
  let count = 0
  const session = createCameraSession(async () => { if (++count === 1) throw failure; return media })
  await assert.rejects(session.open({ video: true }), error => error === failure)
  assert.match(cameraFailureMessage(failure), /permission is blocked.*site settings.*retry/)
  assert.equal(await session.open({ video: true }), media)
  session.close()
  assert.deepEqual(media.tracks.map(track => track.stops), [1, 1])
})

test('obsolete permission rejection cannot overwrite a newer camera session', async () => {
  const pending = deferred(), media = stream()
  let count = 0
  const session = createCameraSession(() => ++count === 1 ? pending.promise : Promise.resolve(media))
  const old = session.open({ video: true })
  await session.open({ video: true })
  pending.reject({ name: 'NotAllowedError' })
  assert.equal(await old, null)
  assert.deepEqual(media.tracks.map(track => track.stops), [0, 0])
})

test('camera failures distinguish no device, busy device, constraints, and security policy', () => {
  for (const [name, message] of [['NotFoundError', /No camera/], ['NotReadableError', /busy/], ['OverconstrainedError', /selected camera/], ['SecurityError', /disabled/]]) assert.match(cameraFailureMessage({ name }), message)
  assert.doesNotMatch(cameraFailureMessage(new Error('private hardware identifier')), /identifier/)
})

test('photo sizing retains portrait/landscape orientation and bounds memory without inventing ready frames', () => {
  assert.equal(captureDimensions(0, 1080), null)
  assert.equal(captureDimensions(NaN, 1080), null)
  assert.equal(captureDimensions(Infinity, 1080), null)
  assert.deepEqual(JSON.parse(JSON.stringify(captureDimensions(4000, 3000))), { width: 1920, height: 1440 })
  assert.deepEqual(JSON.parse(JSON.stringify(captureDimensions(1080, 1920))), { width: 1080, height: 1920 })
  assert.deepEqual(JSON.parse(JSON.stringify(captureDimensions(640, 480))), { width: 640, height: 480 })
})

function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); return [tree, ...nodes(tree.props?.children)] }
function studioFixture(extraGlobals = {}) {
  const cells=[], listeners=new Map(), pending=[], streams=[], routes=[]
  let cursor=0
  const video={srcObject:null, videoWidth:1080, videoHeight:1920, play:async()=>{}}
  const react={
    useState(value){const n=cursor++; if(!(n in cells))cells[n]=typeof value==='function'?value():value; return[cells[n],value=>{cells[n]=typeof value==='function'?value(cells[n]):value}]},
    useRef(value){const n=cursor++; if(!(n in cells))cells[n]={current:value};return cells[n]},
    useMemo(fn){return fn()},
    useCallback(fn,deps){const n=cursor++;if(!cells[n]||deps.some((value,i)=>value!==cells[n].deps[i]))cells[n]={deps,fn};return cells[n].fn},
    useEffect(fn,deps){const n=cursor++; if(!cells[n]||deps.some((value,i)=>value!==cells[n].deps[i])){pending.push(()=>{cells[n]?.cleanup?.();cells[n]={deps,cleanup:fn()}})}}
  }
  const document={hidden:false,addEventListener(name,callback){listeners.set(name,callback)},removeEventListener(name){listeners.delete(name)},createElement(){return {width:0,height:0,getContext:()=>({translate(){},scale(){},drawImage(){}}),toBlob:callback=>callback(new Blob(['image'],{type:'image/jpeg'}))}}}
  const window={isSecureContext:true,addEventListener(name,callback){listeners.set(name,callback)},removeEventListener(name){listeners.delete(name)},setInterval(){return 1},clearInterval(){}}
  const navigator={mediaDevices:{getUserMedia:async()=>{const media=stream();streams.push(media);return media},enumerateDevices:async()=>[]}}
  const Component=load('components/camera/camera-studio.tsx',{react,'next/navigation':{useRouter:()=>({push:value=>routes.push(value),refresh(){}})},'lucide-react':new Proxy({},{get:()=>()=>null}),'@/lib/media/use-object-url':{useObjectUrl:file=>file?'blob:capture':''},'@/lib/media/direct-upload':{createMediaUploadSession:()=>async f=>f}},{document,window,navigator,...extraGlobals}) .CameraStudio
  return {
    streams,routes,document,listeners,
    render(){cursor=0;const tree=Component({returnTo:'https://evil.test',categories:[]});for(const node of nodes(tree))if(node.type==='video'&&node.props.ref)node.props.ref.current=video;while(pending.length)pending.shift()();return tree},
    async settle(){for(let i=0;i<12;i++)await Promise.resolve()},
    unmount(){for(const cell of cells)cell?.cleanup?.()},
  }
}

test('camera studio stops tracks on background, requires retry, then releases them on Back', async () => {
  const f=studioFixture();f.render();await f.settle();f.render()
  assert.equal(f.streams.length,1)
  f.document.hidden=true;f.listeners.get('visibilitychange')();f.render()
  assert.deepEqual(f.streams[0].tracks.map(track=>track.stops),[1,1])
  f.document.hidden=false;f.listeners.get('visibilitychange')();let tree=f.render()
  assert.equal(f.streams.length,1,'returning to the tab must not silently restart the camera')
  const retry=nodes(tree).find(n=>n.type==='button'&&n.props.children==='Retry camera')
  retry.props.onClick();f.render();await f.settle();tree=f.render()
  assert.equal(f.streams.length,2)
  nodes(tree).find(n=>n.type==='button'&&n.props.children==='Back').props.onClick()
  assert.deepEqual(f.streams[1].tracks.map(track=>track.stops),[1,1])
  assert.equal(f.routes.at(-1),'/feed')
  f.unmount();assert.equal(f.listeners.size,0)
})

test('photo capture stops the camera before presenting preview and locks media type until retake', async () => {
  const f=studioFixture();f.render();await f.settle();let tree=f.render()
  await nodes(tree).find(n=>n.props['aria-label']==='Take photo').props.onClick()
  tree=f.render()
  assert.deepEqual(f.streams[0].tracks.map(track=>track.stops),[1,1])
  assert.equal(nodes(tree).find(n=>n.type==='img').props.src,'blob:capture')
  assert.equal(nodes(tree).find(n=>n.type==='button'&&n.props.children==='Video').props.disabled,true)
  nodes(tree).find(n=>n.props['aria-label']==='Retake or replace media').props.onClick()
  f.render();await f.settle();f.render()
  assert.equal(f.streams.length,2)
  f.unmount();assert.deepEqual(f.streams[1].tracks.map(track=>track.stops),[1,1])
})


test('video recording produces a preview and releases both camera and microphone tracks', async () => {
  const recorders=[]
  class Recorder {
    static isTypeSupported(type){return type==='video/webm'}
    constructor(){this.state='inactive';recorders.push(this)}
    start(){this.state='recording'}
    stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['recorded video'],{type:'video/webm'})});this.onstop?.()}
  }
  const f=studioFixture({MediaRecorder:Recorder});f.render();await f.settle();let tree=f.render()
  nodes(tree).find(n=>n.type==='button'&&n.props.children==='Video').props.onClick()
  f.render();await f.settle();tree=f.render()
  nodes(tree).find(n=>n.props['aria-label']==='Start video recording').props.onClick();tree=f.render()
  assert.equal(recorders[0].state,'recording')
  nodes(tree).find(n=>n.props['aria-label']==='Stop video recording').props.onClick();tree=f.render()
  assert.ok(nodes(tree).some(n=>n.type==='video'&&n.props.src==='blob:capture'&&n.props.controls))
  assert.ok(f.streams.every(media=>media.tracks.every(track=>track.stops===1)))
  f.unmount()
})
