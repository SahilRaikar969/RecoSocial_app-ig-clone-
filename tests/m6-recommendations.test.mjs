import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, load, post, category, getFeed, ids, now, viewer } from './helpers/m3-feed-fixture.mjs'
const {buildAffinity,scoreCandidate,diversify,decay}=load('lib/recommendations/engine.ts')
const date=(days=0)=>new Date(now-days*86400000).toISOString()
const event=(kind='like',extra={})=>({kind,postId:'p',creatorId:'creator',categories:['travel'],at:date(),...extra})
const score=(affinity,extra={})=>scoreCandidate({creatorId:'creator',categories:['travel'],createdAt:date(4),likes:0,saves:0,comments:0,followed:false,...extra},affinity,now)
test('selected interests remain useful; repeated current interactions learn capped creator/category affinities',()=>{
 const initial=buildAffinity(['travel'],[],viewer,now),one=buildAffinity(['travel'],[event()],viewer,now)
 const many=buildAffinity(['travel'],Array.from({length:200},(_,n)=>event('save',{postId:String(n)})),viewer,now)
 assert.ok(score(one).interest>score(initial).interest)
 assert.ok(score(one).creator>0&&score(one).creator<score(one).interest)
 assert.equal(score(many).creator,10);assert.equal(score(many).interest,24)
})
test('duplicates, repeated comments on one post and repeated categories cannot inflate affinity',()=>{
 const one=buildAffinity([], [event('comment')],viewer,now)
 const duplicates=buildAffinity([], Array.from({length:20},()=>event('comment',{categories:['travel','travel']})),viewer,now)
 assert.deepEqual(duplicates,one)
 const older=event('comment',{at:date(60)}),newer=event('comment')
 assert.deepEqual(buildAffinity([],[older,newer],viewer,now),one)
 assert.deepEqual(buildAffinity([],[newer,older],viewer,now),one)
})
test('decay is deterministic, finite, bounded and excludes invalid/future/out-of-window signals',()=>{
 assert.equal(decay(date(),now),1);assert.equal(decay(date(30),now),.5)
 for(const value of [date(181),date(-1),'invalid'])assert.equal(decay(value,now),0)
 assert.ok(score(buildAffinity([],[event()],viewer,now)).interest>score(buildAffinity([],[event('like',{at:date(60)})],viewer,now)).interest)
 assert.equal(buildAffinity([],[event('like',{creatorId:viewer})],viewer,now).creators.size,0)
})
test('creator affinity generalizes to another topic but never exceeds content relevance cap',()=>{
 const a=buildAffinity(['fitness'],[event('save')],viewer,now)
 assert.ok(score(a,{categories:['science']}).creator>0)
 assert.equal(score(a,{categories:['science']}).interest,0)
 assert.ok(score(a,{creatorId:'other',categories:['fitness']}).interest>score(a,{categories:['science']}).creator)
})
test('diversity reduces consecutive creator repetition without erasing score gaps or mutating input',()=>{
 const rows=Array.from({length:12},(_,n)=>({id:String(n),author_id:n<8?'same':'other'+n,feed_score:20-n*.3,post_categories:[category(n<8?'travel':'fitness')]}))
 const original=structuredClone(rows),mixed=diversify(rows)
 assert.deepEqual(rows,original);assert.equal(new Set(ids(mixed)).size,12)
 assert.ok(mixed.slice(0,6).some(p=>p.author_id!=='same'))
 const strong=[{...rows[0],feed_score:100},...rows.slice(1)]
 assert.equal(diversify(strong)[0].id,'0')
 assert.deepEqual(diversify(rows),mixed)
})
test('controlled fitness, travel and cold-start users receive sensible different feeds',async()=>{
 const corpus=Array.from({length:16},(_,n)=>post('p'+String(n).padStart(2,'0'),{created_at:date(n%3),post_categories:[category(n%2?'travel':'fitness')]}))
 const results=[]
 for(const interest of ['fitness','travel',null]){
   const context=fixture({posts:corpus,preferences:interest?[interest]:[],counts:{p15:50}})
   results.push(await getFeed(context))
 }
 const topics=result=>result.posts.slice(0,8).map(p=>p.post_categories[0].categories.slug)
 assert.ok(topics(results[0]).filter(s=>s==='fitness').length>=5)
 assert.ok(topics(results[1]).filter(s=>s==='travel').length>=5)
 assert.notDeepEqual(ids(results[0].posts),ids(results[1].posts))
 assert.equal(results[2].posts[0].id,'p15')
 assert.ok(new Set(topics(results[2])).size===2)
 assert.ok(results.every(r=>r.posts.length===16))
})
test('actual query bounds each private signal window and retrieves aggregate counts without full interaction payload',async()=>{
 const c=fixture({posts:[post('a')],likes:Array.from({length:240},(_,n)=>({post_id:'x'+n,profile_id:viewer,created_at:date(n)}))})
 await getFeed(c)
 for(const table of ['likes','saves','comments']){
  const query=c.calls.find(q=>q.table===table)
  assert.equal(query.limit,200);assert.ok(query.filters.some(f=>f[0]==='gte'&&f[1]==='created_at'))
 }
 const candidates=c.calls.find(q=>q.table==='posts')
 assert.equal(candidates.limit,80)
 assert.doesNotMatch(candidates.columns,/likes\s*\(|saves\s*\(|comments\s*\(/)
 assert.equal(c.calls.length,7) // hidden-ID helper is separately mocked; one batched count RPC
})
test('guest feed makes no private interaction reads, Following remains empty, and flags stay false',async()=>{
 const c=fixture({posts:[post('a')],profileId:null})
 const result=await getFeed(c)
 assert.equal(result.posts.length,1);assert.equal(result.posts[0].saved_by_me,false)
 assert.deepEqual(c.calls.map(q=>q.table),['posts','rpc'])
 assert.equal((await getFeed(c,{view:'following'})).posts.length,0)
})
test('removing a follow removes both its ranking boost and Following membership',async()=>{
 const c=fixture({posts:[post('a'),post('b')],follows:['author-b']})
 assert.equal((await getFeed(c)).posts[0].id,'b')
 c.state.follows=[]
 assert.equal((await getFeed(c,{view:'following'})).posts.length,0)
 assert.deepEqual(ids((await getFeed(c)).posts),['a','b'])
})
test('diversity runs before pagination: stable fixed windows yield no duplicates or missing IDs',async()=>{
 const corpus=Array.from({length:70},(_,n)=>post('p'+String(n).padStart(3,'0'),{author_id:n<20?'same':'creator'+n,created_at:date(n%4),post_categories:[category(n%3?'travel':'fitness')]}))
 const c=fixture({posts:corpus,preferences:['travel']})
 const first=await Promise.all([1,2,3].map(page=>getFeed(c,{page})))
 const second=await Promise.all([1,2,3].map(page=>getFeed(c,{page})))
 assert.deepEqual(first,second)
 const all=first.flatMap(r=>ids(r.posts));assert.equal(all.length,70);assert.equal(new Set(all).size,70)
})

test('paging time anchors aging for 30 minutes while rejecting forged future and stale anchors', () => {
 const {feedRankingTime}=load('lib/recommendations/feed-contract.ts',fixture())
 assert.equal(feedRankingTime(String(now-1000),now),now-1000)
 for(const value of [undefined,'invalid','',String(now+1),String(now-1800001)])assert.equal(feedRankingTime(value,now),now)
})


test('candidate time anchor excludes new posts without ignoring new interaction affinity', async () => {
 const anchor=now-60_000
 const c=fixture({posts:[post('a-travel',{post_categories:[category('travel')]}),post('b-cooking'),post('history'),post('new-post',{created_at:date()})],hidden:['history']})
 const before=await getFeed(c,{candidateBefore:anchor})
 assert.deepEqual(ids(before.posts),['a-travel','b-cooking'])
 c.state.saves.push({post_id:'history',profile_id:viewer,created_at:new Date(now-1000).toISOString()})
 const after=await getFeed(c,{candidateBefore:anchor})
 assert.deepEqual(ids(after.posts),['b-cooking','a-travel'])
 assert.ok(after.posts[0].feed_score>before.posts[1].feed_score)
 assert.ok(!after.posts.some(p=>p.id==='new-post'))
 c.state.saves=[]
 assert.deepEqual(ids((await getFeed(c,{candidateBefore:anchor})).posts),['a-travel','b-cooking'])
})

test('embedded category row order cannot change diversity ranking or displayed reasons', async () => {
 const corpus=Array.from({length:18},(_,n)=>post('p'+String(n).padStart(2,'0'),{author_id:n%2?'creator-a':'creator-b',post_categories:[category('travel'),category(n%3?'fitness':'cooking')]}))
 const a=await getFeed(fixture({posts:corpus,preferences:['travel','fitness']}))
 const b=await getFeed(fixture({posts:corpus.map(p=>({...p,post_categories:[...p.post_categories].reverse()})),preferences:['travel','fitness']}))
 assert.deepEqual(a,b)
})


test('current comments influence another creator post once per post; deleting them removes the learned signal', async () => {
 const c=fixture({posts:[post('a-travel',{post_categories:[category('travel')]}),post('b-fitness',{post_categories:[category('fitness')]}),post('history',{post_categories:[category('fitness')]})],hidden:['history']})
 const baseline=await getFeed(c)
 c.state.comments=[{id:'comment-1',post_id:'history',author_id:viewer,created_at:date(),body:'Useful'}]
 const learned=await getFeed(c)
 assert.equal(learned.posts[0].id,'b-fitness')
 assert.ok(learned.posts[0].feed_score>baseline.posts.find(p=>p.id==='b-fitness').feed_score)
 c.state.comments.push({...c.state.comments[0],id:'comment-2'})
 assert.equal((await getFeed(c)).posts[0].feed_score,learned.posts[0].feed_score)
 c.state.comments=[]
 assert.deepEqual(await getFeed(c),baseline)
})
