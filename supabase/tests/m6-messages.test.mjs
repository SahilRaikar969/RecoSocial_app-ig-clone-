import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { asRole, createTestDatabase } from './database.mjs'
const id = n => '60000000-0000-4000-8000-' + String(n).padStart(12, '0')
const A=id(1), B=id(2), C=id(3), T=id(10), U=id(11)
let db
const as=(user,fn)=>asRole(db,'authenticated',user,fn)
const rows=async(sql,args=[]) => (await db.query(sql,args)).rows
before(async()=>{
  db=await createTestDatabase()
  for(const [user,name] of [[A,'alice'],[B,'bob'],[C,'carol']]) await db.query('insert into auth.users(id,email) values($1,$2)',[user,name+'@example.test'])
  await db.query('insert into follows(follower_id,following_id) values($1,$2),($2,$1),($1,$3),($3,$1)',[A,B,C])
  await as(A,()=>db.query('insert into direct_threads(id,profile_low_id,profile_high_id) values($1,$2,$3),($4,$2,$5)',[T,A,B,U,C]))
  await db.query("insert into direct_messages(id,thread_id,sender_id,body,created_at) values($1,$2,$3,'first','2026-10-11T10:00:00Z'),($4,$2,$3,'second','2026-10-11T10:00:00Z'),($5,$6,$7,'private','2026-10-11T10:01:00Z')",[id(100),T,B,id(101),id(102),U,C])
  await db.query("update direct_messages set created_at='2026-10-11T10:00:00Z' where id in ($1,$2)",[id(100),id(101)])
})
after(async()=>{await db?.close()})
test('inbox returns only participant threads with latest body and unread flag',async()=>{
  const inbox=await as(B,()=>rows('select * from get_direct_inbox()'))
  assert.equal(inbox.length,1);assert.equal(inbox[0].thread_id,T);assert.equal(inbox[0].last_message_id,id(101));assert.equal(inbox[0].has_unread,false)
  const own=await as(A,()=>rows('select * from get_direct_inbox()'));assert.equal(own.length,2);assert.ok(own.every(t=>t.has_unread))
  await assert.rejects(asRole(db,'anon',null,()=>rows('select * from get_direct_inbox()')),/permission denied/)
})
test('read receipts are owner-only, thread-scoped, and cannot be forged through table writes',async()=>{
  await assert.rejects(as(C,()=>rows('select mark_direct_thread_read($1,$2)',[T,id(101)])),/thread_not_found/)
  await assert.rejects(as(A,()=>rows('select mark_direct_thread_read($1,$2)',[T,id(102)])),/message_not_found/)
  await assert.rejects(as(A,()=>rows('insert into direct_thread_reads values($1,$2,now(),$3)',[T,A,id(101)])),/permission denied/)
  await as(A,()=>rows('select mark_direct_thread_read($1,$2)',[T,id(100)]))
  assert.equal((await as(A,()=>rows('select * from direct_thread_reads'))).length,1)
  assert.equal((await as(B,()=>rows('select * from direct_thread_reads'))).length,0)
  assert.equal((await as(A,()=>rows('select * from get_direct_inbox()'))).find(t=>t.thread_id===T).has_unread,true)
})
test('equal-timestamp UUID order advances monotonically, stale read cannot reintroduce unread',async()=>{
  await as(A,()=>rows('select mark_direct_thread_read($1,$2)',[T,id(101)]))
  await as(A,()=>rows('select mark_direct_thread_read($1,$2)',[T,id(100)]))
  const receipt=(await as(A,()=>rows('select * from direct_thread_reads where thread_id=$1',[T])))[0]
  assert.equal(receipt.last_read_message_id,id(101))
  assert.equal((await as(A,()=>rows('select * from get_direct_inbox()'))).find(t=>t.thread_id===T).has_unread,false)
})
test('message primary key prevents duplicate send and timestamp cannot be forged',async()=>{
  const send=()=>as(A,()=>rows('insert into direct_messages(id,thread_id,sender_id,body) values($1,$2,$3,$4)',[id(103),T,A,'safe']))
  await send();await assert.rejects(send(),/duplicate key/)
  await assert.rejects(as(A,()=>rows('insert into direct_messages(id,thread_id,sender_id,body,created_at) values($1,$2,$3,$4,now())',[id(104),T,A,'forged'])),/permission denied/)
  await assert.rejects(as(C,()=>rows('insert into direct_messages(thread_id,sender_id,body) values($1,$2,$3)',[T,C,'intrusion'])),/row-level security/)
})
test('bounded inbox keyset pages have no duplicate threads and survive history access after unfollow',async()=>{
  const first=await as(A,()=>rows('select * from get_direct_inbox(1)'))
  const second=await as(A,()=>rows('select * from get_direct_inbox(1,$1,$2)',[first[0].last_message_at,first[0].thread_id]))
  assert.equal(first.length,1);assert.equal(second.length,1);assert.notEqual(first[0].thread_id,second[0].thread_id)
  await db.query('delete from follows where follower_id=$1 and following_id=$2',[A,B])
  assert.ok((await as(A,()=>rows('select * from get_direct_inbox()'))).some(t=>t.thread_id===T))
  await as(A,()=>rows('select mark_direct_thread_read($1,$2)',[T,id(103)]))
  await assert.rejects(as(A,()=>rows('insert into direct_messages(thread_id,sender_id,body) values($1,$2,$3)',[T,A,'no longer mutual'])),/row-level security/)
})

test('server timestamp order is strictly monotonic within one transaction; client thread timestamps forbidden',async()=>{
  await as(A,()=>db.exec('begin'))
  try {
    await as(A,()=>db.query('insert into direct_messages(id,thread_id,sender_id,body) values($1,$2,$3,$4),($5,$2,$3,$4)',[id(105),U,A,'ordered',id(106)]))
    await db.exec('commit')
  } catch(error) { await db.exec('rollback'); throw error }
  const result=await rows('select (a.created_at < b.created_at) as ordered, (t.last_message_at = b.created_at) as updated from direct_messages a join direct_messages b on b.id=$2 join direct_threads t on t.id=a.thread_id where a.id=$1',[id(105),id(106)])
  assert.equal(result[0].ordered,true);assert.equal(result[0].updated,true)
  await assert.rejects(as(A,()=>rows("insert into direct_threads(profile_low_id,profile_high_id,last_message_at) values($1,$2,'2099-01-01')",[A,C])),/permission denied/)
  for(const fn of ['order_direct_message()','touch_direct_thread()']) assert.equal((await rows("select has_function_privilege('authenticated',$1,'execute') as allowed",['public.'+fn]))[0].allowed,false)
})
