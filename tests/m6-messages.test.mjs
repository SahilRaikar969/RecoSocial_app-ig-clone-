import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const load=(file,mocks={},globals={})=>{
 const fixtureModule={exports:{}}
 const source=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText
 runInNewContext(source,{module:fixtureModule,exports:fixtureModule.exports,Date,Map,Set,Promise,crypto:globalThis.crypto,...globals,require(name){if(name in mocks)return mocks[name];throw Error('Unexpected '+name)}})
 return fixtureModule.exports
}
const state=load('lib/messages/message-state.ts')
const id=n=>'60000000-0000-4000-8000-'+String(n).padStart(12,'0')
const A=id(1),B=id(2),T=id(10)
const message=(n,extra={})=>({id:id(n),thread_id:T,sender_id:A,body:'hello',created_at:'2026-10-11T10:00:00.000Z',...extra})
test('out-of-order and duplicate messages converge in stable tuple order; foreign thread ignored',()=>{
 const result=state.mergeMessages([message(102)], [message(101),message(102),message(103,{thread_id:'other'})],T)
 assert.deepEqual(Array.from(result,x=>x.id),[id(101),id(102)])
})
test('authoritative event reconciles optimistic UUID exactly once; late failure never overwrites delivery',()=>{
 const pending=message(100,{delivery:'sending'})
 const delivered=message(100,{created_at:'2026-10-11T10:00:01Z'})
 let rows=state.mergeMessages([pending],[delivered],T)
 rows=state.mergeMessages(rows,[{...pending,delivery:'failed'}],T)
 assert.equal(rows.length,1);assert.equal(rows[0].delivery,undefined);assert.equal(rows[0].created_at,delivered.created_at)
})
function fixture({duplicate=false,conflict=false,mutual=true,insertError=null,thread=T}={}){
 const calls=[],stored=new Map(),viewer=A
 if(duplicate)stored.set(id(100),message(100,conflict?{body:'other'}:{}))
 const client={from(table){const call={table,filters:[],insert:null};return {
 select(){return this},eq(k,v){call.filters.push([k,v]);return this},maybeSingle(){return this},single(){return this},
 insert(row){call.insert=row;return this},then(resolve,reject){calls.push(call);return Promise.resolve().then(()=>{
 if(table==='direct_threads')return {data:{id:T,profile_low_id:thread===T?A:B,profile_high_id:B},error:null}
 if(call.insert){if(insertError)return {error:insertError};const row={...call.insert,created_at:'2026-10-11T10:00:00Z'};stored.set(row.id,row);return {data:row,error:null}}
 return {data:stored.get(call.filters.find(([key])=>key==='id')?.[1])??null,error:null}
 }).then(resolve,reject)}
 }}}
 const actions=load('actions/message-delivery.ts',{'@/lib/supabase/server':{createClient:async()=>client},'@/lib/auth/get-dev-session':{getDevSession:async()=>({profileId:viewer})},'@/lib/db/queries/messages':{areMutualFollowers:async()=>mutual}})
 return {actions,calls,stored}
}
test('inline send uses verified sender and supplied request UUID; replay does not insert again',async()=>{
 const f=fixture(),input={id:id(100),threadId:T,body:' hello ',senderId:B}
 const first=await f.actions.sendMessage(input),second=await f.actions.sendMessage(input)
 assert.equal(first.message.sender_id,A);assert.equal(second.message.id,id(100));assert.equal(f.calls.filter(c=>c.insert).length,1)
})
test('lost-response replay stays confirmed after unfollow; mismatched payload cannot claim success',async()=>{
 const f=fixture({duplicate:true,mutual:false});assert.ok((await f.actions.sendMessage({id:id(100),threadId:T,body:'hello'})).message)
 const conflict=fixture({duplicate:true,conflict:true});assert.ok((await conflict.actions.sendMessage({id:id(100),threadId:T,body:'hello'})).error);assert.equal(conflict.calls.filter(c=>c.insert).length,0)
})
test('nonparticipant, nonmutual, invalid and failed sends never claim delivery',async()=>{
 for(const setup of [{thread:'other'},{mutual:false},{insertError:{message:'internal secret'}}]){
  const f=fixture(setup),result=await f.actions.sendMessage({id:id(100),threadId:T,body:'hello'})
  assert.ok(result.error);assert.equal(result.message,undefined);assert.ok(!result.error.includes('secret'))
 }
 const f=fixture();assert.ok((await f.actions.sendMessage({id:'bad',threadId:T,body:'hello'})).error);assert.equal(f.calls.length,0)
})

const settle=async()=>{for(let i=0;i<35;i++)await Promise.resolve()}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
function monitorFixture(){
 const events=new Map(),timers=new Set(),timeouts=[],channels=[],removed=[],batches=[],statuses=[]
 const document={visibilityState:'visible',addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)}
 const window={setInterval:f=>{timers.add(f);return f},clearInterval:f=>timers.delete(f),setTimeout:f=>{timeouts.push(f);return f},clearTimeout(){},addEventListener:(n,f)=>events.set(n,f),removeEventListener:n=>events.delete(n)}
 const testState={viewer:A,rows:[],queries:0,changed:0,pending:null,authReads:0}
 let authCallback
 const client={realtime:{async setAuth(...args){assert.equal(args.length,0);testState.tokenReads=(testState.tokenReads??0)+1;if(testState.tokenPending)await testState.tokenPending.promise;if(testState.tokenError)throw Error('token unavailable');testState.realtimeToken=testState.cookieToken}},auth:{async getUser(){testState.authReads++;return {data:{user:testState.viewer?{id:testState.viewer}:null},error:null}},onAuthStateChange(fn){authCallback=fn;return {data:{subscription:{unsubscribe(){testState.unsubscribed=true}}}}}},
 channel(name){const c={name,handlers:[],on(event,filter,callback){this.handlers.push({filter,callback});return this},subscribe(callback){this.status=callback;this.token=testState.realtimeToken;return this}};channels.push(c);return c},removeChannel(c){removed.push(c);return Promise.resolve()},
 from(){return {select(){return this},eq(){return this},or(value){testState.cursor=value;return this},order(){return this},limit(){testState.queries++;return testState.pending?.promise??Promise.resolve({data:testState.rows,error:null})}}}
 }
 const {startMessageMonitor}=load('lib/messages/message-monitor.ts',{'@/lib/messages/message-state':state},{window,document})
 const monitor=startMessageMonitor(client,{viewerId:A,threadId:T,cursor:{id:id(99),created_at:'2026-10-11T09:00:00Z'},onMessages:rows=>batches.push(rows),onStatus:value=>statuses.push(value),onAccountChange:()=>testState.changed++})
 return {testState,monitor,channels,removed,events,timers,batches,statuses,document,async auth(event,viewer){testState.viewer=viewer;authCallback(event,{user:{id:viewer}});while(timeouts.length)timeouts.shift()();await settle()}}
}
test('incoming event triggers authoritative ordered catch-up; subscription reconnect closes the missed-event gap',async()=>{
 const f=monitorFixture();await settle();f.testState.rows=[message(100,{sender_id:B})]
 f.channels[0].handlers[0].callback({new:message(100)});await settle()
 assert.equal(f.batches.at(-1)[0].id,id(100));assert.match(f.testState.cursor,/09:00:00/)
 f.testState.rows=[];f.channels[0].status('SUBSCRIBED');await settle();assert.match(f.testState.cursor,/10:00:00/);assert.equal(f.statuses.at(-1),'connected');f.monitor.stop()
})
test('overlap coalesces and stale results cannot leak after account switch',async()=>{
 const f=monitorFixture();await settle();const pending=deferred();f.testState.pending=pending;void f.monitor.refresh();await settle()
 for(let i=0;i<6;i++)f.channels[0].handlers[0].callback({})
 assert.equal(f.testState.queries,2);await f.auth('SIGNED_IN',B);pending.resolve({data:[message(100)],error:null});await settle()
 assert.equal(f.batches.length,0);assert.equal(f.testState.changed,1);assert.equal(f.timers.size,0);assert.equal(f.removed.length,1);assert.equal(f.testState.unsubscribed,true)
})
test('token refresh uses a unique topic and old subscription callbacks cannot update new generation',async()=>{
 const f=monitorFixture();await settle();const old=f.channels[0];await f.auth('TOKEN_REFRESHED',A)
 assert.equal(f.channels.length,2);assert.notEqual(f.channels[0].name,f.channels[1].name);assert.equal(f.removed.length,1)
 const statuses=f.statuses.length;old.status('SUBSCRIBED');assert.equal(f.statuses.length,statuses);f.monitor.stop()
})
test('hidden pages suspend catch-up; visibility and online recover; stop removes all listeners',async()=>{
 const f=monitorFixture();await settle();f.document.visibilityState='hidden';await f.monitor.refresh();assert.equal(f.testState.queries,1)
 f.document.visibilityState='visible';f.events.get('visibilitychange')();await settle();assert.equal(f.testState.queries,2)
 f.events.get('online')();await settle();assert.equal(f.testState.queries,3);f.monitor.stop();assert.equal(f.events.size,0);assert.equal(f.timers.size,0)
})


const jsx=(type,props)=>({type,props:props??{}})
test('inbox route preserves PostgreSQL microseconds in its next-page cursor',async()=>{
 let received
 const {default:Page}=load('app/messages/page.tsx',{
  'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{redirect(){throw Error('Unexpected redirect')}},
  '@/components/ui/page-shell':{PageShell:()=>null},'@/components/ui/feedback-banner':{FeedbackBanner:()=>null},
  'next/link':{default:()=>null},'@/components/messages/messages-live':{MessagesLive:()=>null},'@/components/messages/conversation-list':{ConversationList:()=>null},
  '@/lib/auth/get-dev-session':{getDevSession:async()=>({profileId:A})},
  '@/lib/db/queries/messages':{getInboxData:async(viewer,cursor)=>{received=cursor;return {conversations:[],nextCursor:null}},getOrCreateDirectThread:async()=>null},
 })
 const timestamp='2026-10-11T10:00:00.123456+00:00'
 await Page({searchParams:Promise.resolve({before:timestamp,beforeId:T})})
 assert.equal(received.created_at,timestamp);assert.equal(received.id,T)
})

test('failed read receipt remains retryable after scrolling ends its previous effect',async()=>{
 const pending=deferred(),refs=[],states=[];let refIndex=0,stateIndex=0,effects=[],calls=0
 const {MessageThread}=load('components/messages/message-thread.tsx',{
  'react/jsx-runtime':{jsx,jsxs:jsx},
  react:{useState(initial){const index=stateIndex++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value}]},useRef(initial){const index=refIndex++;return refs[index]??(refs[index]={current:initial})},useCallback:fn=>fn,useEffect:fn=>effects.push(fn)},
  'next/navigation':{useRouter:()=>({refresh(){}})},'@/components/ui/smart-image':{SmartImage:()=>null},'@/components/messages/message-composer':{MessageComposer:()=>null},
  '@/lib/supabase/browser':{createClient:()=>({})},'@/lib/messages/message-monitor':{startMessageMonitor:()=>({stop(){},refresh:async()=>{}})},
  '@/lib/messages/message-state':state,
  '@/actions/message-delivery':{markThreadRead:()=>{calls++;return calls===1?pending.promise:Promise.resolve({ok:true})}},
 },{window:{setInterval:()=>1,clearInterval(){}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}}})
 const render=()=>{refIndex=0;stateIndex=0;effects=[];MessageThread({viewerProfileId:A,threadId:T,otherProfile:{id:B,username:'bob',display_name:'Bob'},messages:[message(100,{sender_id:B})],hasOlder:false,canSend:true});return effects[2]()}
 const cleanup=render();assert.equal(calls,1);cleanup()
 pending.resolve({ok:false});await settle()
 render()();assert.equal(calls,2)
})


test('server-action cookie replacement refreshes realtime before subscribe and while the monitor stays mounted',async()=>{
 const f=monitorFixture();f.testState.cookieToken='new-server-session';f.testState.realtimeToken='old-client-session';await settle()
 assert.equal(f.channels[0].token,'new-server-session');assert.equal(f.testState.queries,1)
 f.testState.cookieToken='another-server-session';await f.monitor.refresh()
 assert.equal(f.testState.realtimeToken,'another-server-session');assert.equal(f.channels.length,1);f.monitor.stop()
})

test('account switch during delayed realtime auth suppresses the old channel and catch-up',async()=>{
 const f=monitorFixture(),pending=deferred();f.testState.tokenPending=pending;await settle()
 assert.equal(f.channels.length,0);await f.auth('SIGNED_IN',B)
 delete f.testState.tokenPending;pending.resolve();await settle()
 assert.equal(f.channels.length,0);assert.equal(f.testState.queries,0);assert.equal(f.testState.changed,1)
})

test('realtime auth failure stays reconnecting and retries with a current token before queries',async()=>{
 const f=monitorFixture();f.testState.tokenError=true;await settle()
 assert.equal(f.channels.length,0);assert.equal(f.testState.queries,0);assert.equal(f.statuses.at(-1),'reconnecting')
 f.testState.tokenError=false;await f.monitor.refresh();assert.equal(f.channels.length,1);assert.equal(f.testState.queries,1);f.monitor.stop()
})
