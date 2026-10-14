import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const output=ts.transpileModule(readFileSync(new URL('../lib/notifications/unread-monitor.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve()}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
function fixture(){
 const events=new Map(),intervals=new Set(),timeouts=[],channels=[],removed=[],counts=[],viewers=[]
 const state={viewer:'a',count:4,readCount:0,revision:0,pending:null,error:null}
 let authCallback
 const document={visibilityState:'visible',addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}
 const window={addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name),setInterval:fn=>{intervals.add(fn);return fn},clearInterval:fn=>intervals.delete(fn),setTimeout:fn=>timeouts.push(fn)}
 const fixtureModule={exports:{}}
 runInNewContext(output,{module:fixtureModule,exports:fixtureModule.exports,document,window,crypto:globalThis.crypto})
 const client={realtime:{async setAuth(...args){assert.equal(args.length,0);state.tokenReads=(state.tokenReads??0)+1;if(state.tokenPending)await state.tokenPending.promise;if(state.tokenError)throw Error('token unavailable');state.realtimeToken=state.cookieToken}},auth:{getUser:async()=>({data:{user:state.viewer?{id:state.viewer}:null},error:null}),onAuthStateChange(fn){authCallback=fn;return {data:{subscription:{unsubscribe(){state.stopped=true}}}}}},
 from(){return {select(){return this},eq(key,value){state.queriedViewer=value;return this},is(){state.readCount++;return state.pending?.promise??Promise.resolve({count:state.count,error:state.error})}}},
 channel(name){const c={name,on(type,filter,callback){this.event=callback;this.filter=filter;return this},subscribe(callback){this.status=callback;this.token=state.realtimeToken;return this}};channels.push(c);return c},removeChannel(c){removed.push(c);return Promise.resolve()}}
 const stop=fixtureModule.exports.startUnreadMonitor(client,count=>counts.push(count),{onSync:()=>state.revision++,onViewer:viewer=>viewers.push(viewer)})
 return {state,channels,removed,counts,viewers,stop,poll(){[...intervals].forEach(fn=>fn())},async auth(event,viewer){state.viewer=viewer;authCallback(event,{user:{id:viewer}});while(timeouts.length)timeouts.shift()();await settle()}}
}
test('same-owner notification events reconcile authoritative count without duplicate increments and publish Activity invalidation',async()=>{
 const f=fixture();await settle();assert.equal(f.state.revision,1)
 f.state.count=5;for(let i=0;i<5;i++)f.channels[0].event();await settle()
 assert.equal(f.counts.at(-1),5);assert.ok(f.state.revision>1);assert.equal(f.channels.length,1);f.stop()
})
test('SUBSCRIBED and reconnect catch up events missed before the subscription joined',async()=>{
 const f=fixture();await settle();f.state.count=9;f.channels[0].status('SUBSCRIBED');await settle()
 assert.equal(f.counts.at(-1),9);assert.equal(f.state.revision,2)
 f.state.count=11;f.channels[0].status('SUBSCRIBED');await settle();assert.equal(f.counts.at(-1),11);assert.equal(f.channels.length,1);f.stop()
})
test('viewer switch clears private Activity identity immediately and rejects late old result',async()=>{
 const f=fixture();await settle();const pending=deferred();f.state.pending=pending;f.poll();await settle()
 const revision=f.state.revision;await f.auth('SIGNED_IN','b');assert.equal(f.viewers.at(-1),null)
 f.state.pending=null;f.state.count=2;pending.resolve({count:99,error:null});await settle()
 assert.ok(!f.counts.includes(99));assert.equal(f.state.queriedViewer,'b');assert.equal(f.viewers.at(-1),'b');assert.equal(f.state.revision,revision+1);f.stop()
})
test('same-viewer token refresh does not hide Activity; closing topic cannot close its replacement',async()=>{
 const f=fixture();await settle();const first=f.channels[0];await f.auth('TOKEN_REFRESHED','a')
 assert.ok(!f.viewers.includes(null));assert.equal(f.channels.length,2);assert.notEqual(first.name,f.channels[1].name)
 const revision=f.state.revision;first.status('SUBSCRIBED');await settle();assert.equal(f.state.revision,revision);f.stop()
})
test('failed count query preserves indicator and cannot signal successful Activity synchronization',async()=>{
 const f=fixture();await settle();f.state.error={message:'network'};f.poll();await settle()
 assert.equal(f.counts.at(-1),4);assert.equal(f.state.revision,1)
 f.state.error=null;f.state.count=0;f.poll();await settle();assert.equal(f.counts.at(-1),0);assert.equal(f.state.revision,2);f.stop()
})
test('logout immediately clears Activity identity and unmount suppresses late status callbacks',async()=>{
 const f=fixture();await settle();await f.auth('SIGNED_OUT',null);assert.equal(f.viewers.at(-1),null);assert.equal(f.counts.at(-1),0)
 f.stop();const revision=f.state.revision;f.channels[0].status('SUBSCRIBED');await settle();assert.equal(f.state.revision,revision);assert.equal(f.state.stopped,true)
})


test('server-action cookie replacement refreshes the cached realtime token without an auth event',async()=>{
 const f=fixture();f.state.cookieToken='new-server-session';f.state.realtimeToken='old-client-session';await settle()
 assert.equal(f.channels[0].token,'new-server-session');assert.equal(f.state.readCount,1)
 f.state.cookieToken='another-server-session';f.poll();await settle()
 assert.equal(f.state.realtimeToken,'another-server-session');assert.equal(f.channels.length,1);f.stop()
})

test('logout during delayed realtime auth cannot create an old recipient subscription',async()=>{
 const f=fixture(),pending=deferred();f.state.tokenPending=pending;await settle()
 assert.equal(f.channels.length,0);await f.auth('SIGNED_OUT',null)
 delete f.state.tokenPending;pending.resolve();await settle()
 assert.equal(f.channels.length,0);assert.equal(f.state.readCount,0);assert.equal(f.viewers.at(-1),null);f.stop()
})

test('failed realtime auth retries on the next visible refresh without retaining a dead owner',async()=>{
 const f=fixture();f.state.tokenError=true;await settle();assert.equal(f.channels.length,0)
 f.state.tokenError=false;f.poll();await settle();assert.equal(f.channels.length,1);assert.equal(f.state.readCount,1);f.stop()
})
