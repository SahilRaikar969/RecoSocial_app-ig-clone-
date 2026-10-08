import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { randomUUID,webcrypto } from 'node:crypto'
import test from 'node:test'
import ts from 'typescript'
const owner='10000000-0000-4000-8000-000000000001'
const other='10000000-0000-4000-8000-000000000002'
function load(path,mocks={}) {
  const filename=fileURLToPath(new URL('../'+path,import.meta.url))
  const output=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
  const mod={exports:{}}
  runInNewContext(output,{module:mod,exports:mod.exports,require(name){
    if(Object.hasOwn(mocks,name))return mocks[name]
    if(name==='node:crypto')return {randomUUID}
    if(name.startsWith('@/'))return load(name.slice(2)+'.ts',mocks)
    if(name.startsWith('./'))return load(path.slice(0,path.lastIndexOf('/')+1)+name.slice(2)+'.ts',mocks)
    throw new Error('Unexpected '+name)
  },File,Blob,FormData,Buffer,URL,URLSearchParams,Uint8Array,crypto:webcrypto,atob,process:{env:{}}},{filename})
  return mod.exports
}
class Redirect extends Error { constructor(url){super(url);this.url=url} }
function file(name='a.png'){return new File([new Uint8Array([137,80,78,71,13,10,26,10])],name,{type:'image/png'})}
function form(values){const f=new FormData();for(const [k,v] of Object.entries(values)) f.set(k,v);return f}
function fixture(options={}) {
  const uploads=[],removed=[],rpcs=[],writes=[],invalidated=[]
  const client={
    auth:{getUser:async()=>({data:{user:{id:owner}},error:null})},
    storage:{from:()=>({
      upload:async(path,value,opts)=>{uploads.push({path,value,opts});return {error:options.uploadFailure===uploads.length?{message:'internal storage secret'}:null}},
      remove:async(paths)=>{removed.push(...paths);return {error:options.cleanupFailure?{}:null}},
      info:async()=>({data:options.info || {size:8,contentType:'image/png'},error:options.infoError?{}:null}),
    })},
    from(table){
      const call={table,method:'select',payload:null,filters:[]}
      const q={select(){return this},eq(k,v){call.filters.push([k,v]);return this},in(){return this},single(){return this},maybeSingle(){return this},
        update(payload){call.method='update';call.payload=payload;return this},delete(){call.method='delete';return this},
        upsert(payload,opts){call.method='upsert';call.payload=payload;call.opts=opts;return this},
        then(resolve,reject){return Promise.resolve().then(()=>{
          writes.push(call)
          if(options.answer)return options.answer(call)
          if(table==='categories')return {data:[{id:'category',name:'Tech'}],error:null}
          if(table==='posts')return {data:{id:'post',author_id:owner,updated_at:'2026-10-08T00:00:00Z'},error:null}
          if(table==='profiles')return call.method==='update'?{data:options.updateMissing?null:{id:owner},error:options.dbError || null}:{data:{id:owner,updated_at:'2026-10-08T00:00:00Z'},error:null}
          return {data:null,error:null}
        }).then(resolve,reject)},}
      return q
    },
    async rpc(name,args){rpcs.push({name,args});if(options.transport)throw new Error('lost response');return {data:args.target_post_id,error:options.dbError || null}},
  }
  const mocks={
    '@/lib/supabase/server':{createClient:async()=>client},'@/lib/supabase/browser':{createClient:()=>client},
    '@/lib/auth/get-dev-session':{getDevSession:async()=>({profileId:owner})},
    'next/navigation':{redirect(url){throw new Redirect(url)}},'next/cache':{revalidatePath(path){invalidated.push(path)}},
  }
  return {client,mocks,uploads,removed,rpcs,writes,invalidated,actions:load('actions/posts.ts',mocks)}
}
const postForm=()=>form({mutation_id:'20000000-0000-4000-8000-000000000001',caption:'Caption',media_type:'image',categories:'Tech',media_file:file()})

test('post rejects invalid category before upload or write',async()=>{
  const f=fixture({answer:()=>({data:[],error:null})})
  assert.equal((await f.actions.createPost(postForm())).ok,false)
  assert.equal(f.uploads.length,0);assert.equal(f.rpcs.length,0)
})
test('post rejects bad thumbnail before uploading otherwise valid media',async()=>{
  const f=fixture(),data=postForm()
  data.set('media_type','video');data.set('media_file',new File([new Uint8Array([0,0,0,24,102,116,121,112])],'a.mp4',{type:'video/mp4'}))
  data.set('thumbnail_file',new File(['<script>'],'x.png',{type:'image/png'}))
  assert.equal((await f.actions.createPost(data)).ok,false)
  assert.equal(f.uploads.length,0)
})
test('second upload failure cleans only fresh request paths and never publishes',async()=>{
  const f=fixture({uploadFailure:2}),data=postForm()
  data.set('media_type','video');data.set('media_file',new File([new Uint8Array([0,0,0,24,102,116,121,112])],'a.mp4',{type:'video/mp4'}));data.set('thumbnail_file',file())
  const result=await f.actions.createPost(data)
  assert.equal(result.ok,false);assert.equal(f.rpcs.length,0)
  assert.deepEqual(f.removed,f.uploads.map(u=>u.path))
})
test('known database rejection compensates fresh uploads with no success or invalidation',async()=>{
  const f=fixture({dbError:{code:'23514',message:'private schema details'}})
  const result=await f.actions.createPost(postForm())
  assert.equal(result.ok,false);assert.doesNotMatch(result.error,/schema|23514/)
  assert.deepEqual(f.removed,f.uploads.map(u=>u.path));assert.deepEqual(f.invalidated,[])
})
for(const opts of [{transport:true},{dbError:{code:'',message:'fetch failed'}},{dbError:{code:'57014',message:'timeout'}}])test('unknown commit outcome retains uploaded media',async()=>{
  const f=fixture(opts)
  const result=await f.actions.createPost(postForm())
  assert.equal(result.ok,false);assert.equal(f.uploads.length,1);assert.deepEqual(f.removed,[])
  assert.match(result.error,/confirmed|Refresh/)
})
test('cleanup failure is visible without masking original publication failure',async()=>{
  const f=fixture({dbError:{code:'23514'},cleanupFailure:true})
  assert.match((await f.actions.createPost(postForm())).error,/cleanup is pending/)
})
test('successful publication calls only transactional RPC and invalidates before redirect',async()=>{
  const f=fixture()
  await assert.rejects(f.actions.createPost(postForm()),e=>e instanceof Redirect && e.url==='/feed?post_created=1')
  assert.equal(f.rpcs.length,1);assert.equal(f.rpcs[0].name,'save_post_with_categories')
  assert.equal(f.rpcs[0].args.create_new,true);assert.equal(f.rpcs[0].args.target_post_id,'20000000-0000-4000-8000-000000000001')
  assert.ok(f.invalidated.includes('/feed'));assert.ok(f.invalidated.includes('/explore'))
  assert.deepEqual(f.removed,[]);assert.equal(f.writes.filter(w=>w.method!=='select').length,0)
})
test('direct owned reference is checked but never deleted on rejected publication',async()=>{
  const f=fixture({dbError:{code:'23514'}}),data=postForm()
  data.delete('media_file');data.set('media_path','images/'+owner+'/already-uploaded.png')
  assert.equal((await f.actions.createPost(data)).ok,false)
  assert.deepEqual(f.removed,[]);assert.equal(f.uploads.length,0)
})
test('foreign raw path and wrong direct-upload metadata fail before publication',async()=>{
  for(const [path,opts] of [['images/'+other+'/x.png',{}],['images/'+owner+'/x.png',{info:{size:9,contentType:'text/html'}}]]){
    const f=fixture(opts),data=postForm();data.delete('media_file');data.set('media_path',path)
    assert.equal((await f.actions.createPost(data)).ok,false);assert.equal(f.rpcs.length,0)
  }
})
test('profile replacement failure retains old avatar and cleans only newly uploaded avatar',async()=>{
  const f=fixture({dbError:{code:'23505'}})
  const update=load('actions/profile.ts',f.mocks).updateProfile
  const result=await update(form({username:'alice',display_name:'Alice',avatar_file:file()}))
  assert.equal(result.ok,false);assert.match(result.error,/username/)
  assert.equal(f.removed.length,1);assert.equal(f.removed[0],f.uploads[0].path)
})
test('edit supplies form version and never deletes prior media on success',async()=>{
  const f=fixture(),data=postForm();data.set('post_id','post');data.set('expected_updated_at','2026-10-07T00:00:00Z')
  await assert.rejects(f.actions.updatePost(data),e=>e instanceof Redirect)
  assert.equal(f.rpcs[0].args.expected_updated_at,'2026-10-07T00:00:00Z');assert.deepEqual(f.removed,[])
})
test('direct browser preparation strips all file payloads and reuses upload on retry',async()=>{
  const f=fixture(),prepare=load('lib/media/direct-upload.ts',f.mocks).createMediaUploadSession(),data=postForm()
  const a=await prepare(data,'post','request'),b=await prepare(data,'post','request')
  assert.equal(f.uploads.length,1);assert.equal(a.get('media_path'),b.get('media_path'))
  assert.equal(a.get('media_file'),null);assert.equal(a.get('mutation_id'),'request')
  assert.ok([...a.values()].every(v=>typeof v==='string'));assert.equal(f.uploads[0].opts.upsert,false)
})
test('direct preparation validates whole batch before uploading',async()=>{
  const f=fixture(),prepare=load('lib/media/direct-upload.ts',f.mocks).createMediaUploadSession(),data=postForm()
  data.set('media_type','video');data.set('media_file',new File([new Uint8Array([0,0,0,24,102,116,121,112])],'a.mp4',{type:'video/mp4'}));data.set('thumbnail_file',new File(['bad'],'a.png',{type:'image/png'}))
  await assert.rejects(prepare(data,'post','request'));assert.equal(f.uploads.length,0)
})
test('direct preparation failure never cleans cached files from prior publication attempt',async()=>{
  const f=fixture({uploadFailure:2}),prepare=load('lib/media/direct-upload.ts',f.mocks).createMediaUploadSession(),data=postForm()
  const first=await prepare(data,'post','request')
  const video=new File([new Uint8Array([0,0,0,24,102,116,121,112])],'a.mp4',{type:'video/mp4'})
  const second=form({media_type:'video',media_file:video})
  await assert.rejects(prepare(second,'post','request'))
  assert.ok(!f.removed.includes(first.get('media_path')));assert.equal(f.removed.length,1)
})
test('same filename always gets distinct owner-scoped object names',async()=>{
  const f=fixture(),prepare=load('lib/media/direct-upload.ts',f.mocks).createMediaUploadSession()
  const a=await prepare(postForm(),'post','a'),b=await prepare(postForm(),'post','b')
  assert.notEqual(a.get('media_path'),b.get('media_path'));assert.ok(f.uploads.every(u=>u.path.startsWith('images/'+owner+'/')))
})
test('crop geometry always covers the square viewport for portrait, landscape and extreme offsets',()=>{
  const {avatarCropGeometry}=load('lib/media/avatar-crop.ts')
  for(const [w,h] of [[100,400],[400,100],[200,200]])for(const zoom of [1,1.15,2.5])for(const offset of [-80,0,80]){
    const g=avatarCropGeometry(w,h,zoom,offset,offset)
    assert.ok(g.x<=0 && g.y<=0);assert.ok(g.x+g.width>=512 && g.y+g.height>=512)
  }
  assert.throws(()=>avatarCropGeometry(0,100,1,0,0))
})

test('failed story insert cleans only request-local upload and reports safe error',async()=>{
  const f=fixture({answer:call=>({data:null,error:call.method==='upsert'?{code:'23514',message:'private story constraint'}:null})})
  const action=load('actions/stories.ts',f.mocks).createStory
  const result=await action(form({media_type:'image',media_file:file(),caption:'hello'}))
  assert.equal(result.ok,false);assert.doesNotMatch(result.error,/constraint/);assert.equal(f.removed.length,1);assert.deepEqual(f.invalidated,[])
})
test('story retry verifies an identical owner record without inserting a second story',async()=>{
  let row,insertions=0
  const f=fixture({answer:call=>{
    if(call.method==='upsert'){assert.equal(call.opts.ignoreDuplicates,true);if(!row){row=call.payload;insertions++}return {error:null}}
    return {data:row,error:null}
  }})
  const action=load('actions/stories.ts',f.mocks).createStory
  const data=form({mutation_id:'20000000-0000-4000-8000-000000000010',media_type:'image',media_path:'story-images/'+owner+'/retained.png',caption:'hello'})
  for(let i=0;i<2;i++)await assert.rejects(action(data),e=>e instanceof Redirect&&e.url==='/feed?story_created=1')
  assert.equal(insertions,1);assert.deepEqual(f.removed,[])
})
test('story view failure returns an explicit safe outcome',async()=>{
  const f=fixture({answer:()=>({error:{message:'private storage relation'}})})
  assert.equal((await load('actions/stories.ts',f.mocks).markStoryViewed('story')).ok,false)
})
test('camera validates category before upload and returns a bounded failure',async()=>{
  const f=fixture({answer:()=>({data:null,error:null})})
  const route=load('app/api/camera/publish/route.ts',{...f.mocks,'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status || 200})}}})
  const result=await route.POST({formData:async()=>form({target:'post',media_type:'image',media_file:file(),category_id:'bad'})})
  assert.equal(result.status,400);assert.equal(result.data.ok,false);assert.equal(f.uploads.length,0)
})
test('camera post uses transactional publication and sanitizes external return path',async()=>{
  const f=fixture({answer:()=>({data:{id:'category'},error:null})})
  const route=load('app/api/camera/publish/route.ts',{...f.mocks,'next/server':{NextResponse:{json:(data,options)=>({data,status:options?.status || 200})}}})
  const result=await route.POST({formData:async()=>form({target:'post',media_type:'image',media_file:file(),category_id:'category',return_to:'https://outside.invalid'})})
  assert.equal(result.status,200);assert.equal(result.data.redirectTo,'/feed');assert.equal(f.rpcs[0].name,'save_post_with_categories');assert.deepEqual(f.removed,[])
})

test('handled form failure retains selected File and operation ID after React clears file inputs',async()=>{
  const f=fixture(),outcomes=[]
  const {useMediaFormAction}=load('lib/media/use-media-form-action.ts',{...f.mocks,react:{useRef:value=>({current:value})}})
  const selected=file()
  const action=useMediaFormAction(async data=>{outcomes.push(data);return {ok:false,error:'retry fixture'}},'post',()=>{},{media_file:selected})
  const metadata=()=>form({media_type:'image',caption:'preserved',categories:'Tech'})
  await action(metadata());await action(metadata())
  assert.equal(outcomes.length,2);assert.equal(f.uploads.length,1)
  assert.equal(outcomes[0].get('media_path'),outcomes[1].get('media_path'))
  assert.equal(outcomes[0].get('mutation_id'),outcomes[1].get('mutation_id'))
})
