import assert from 'node:assert/strict'
import {before,after,test} from 'node:test'
import {createTestDatabase,asRole} from './database.mjs'
let db
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
before(async()=>{
 db=await createTestDatabase()
 for(const n of [1,2,3])await db.query('insert into auth.users(id,email)values($1,$2)',[id(n),`u${n}@example.test`])
 for(const [n,status] of [[10,'published'],[11,'draft']])await db.query("insert into public.posts(id,author_id,media_type,media_path,status)values($1,$2,'image',$3,$4)",[id(n),id(1),'images/'+id(1)+'/x.jpg',status])
 await db.query('insert into public.likes(profile_id,post_id)values($1,$2)',[id(2),id(10)])
 await db.query('insert into public.saves(profile_id,post_id)values($1,$2)',[id(3),id(10)])
 await db.query("insert into public.comments(author_id,post_id,body)values($1,$2,'Hello')",[id(2),id(10)])
})
after(async()=>db?.close())
test('anon aggregates expose public counts but no saver identities, private flags or drafts',async()=>{
 const {rows}=await asRole(db,'anon',null,()=>db.query('select * from public.get_visible_post_engagement($1)',[[id(10),id(11)]]))
 assert.equal(rows.length,1);assert.equal(rows[0].post_id,id(10))
 assert.equal(Number(rows[0].like_count),1);assert.equal(Number(rows[0].save_count),1)
 assert.equal(rows[0].liked_by_me,false);assert.equal(rows[0].saved_by_me,false)
 assert.deepEqual(Object.keys(rows[0]).sort(),['post_id','like_count','save_count','comment_count','liked_by_me','saved_by_me'].sort())
 await assert.rejects(asRole(db,'anon',null,()=>db.query('select * from public.saves')),/permission denied/)
})
test('authenticated flags derive from auth.uid only and draft visibility stays owner-scoped',async()=>{
 const a=await asRole(db,'authenticated',id(3),()=>db.query('select * from public.get_visible_post_engagement($1)',[[id(10),id(11)]]))
 assert.equal(a.rows.length,1);assert.equal(a.rows[0].saved_by_me,true);assert.equal(a.rows[0].liked_by_me,false)
 const owner=await asRole(db,'authenticated',id(1),()=>db.query('select * from public.get_visible_post_engagement($1)',[[id(11)]]))
 assert.equal(owner.rows.length,1)
})
test('aggregate requests reject oversized windows and follow database removals immediately',async()=>{
 await assert.rejects(asRole(db,'anon',null,()=>db.query('select * from public.get_visible_post_engagement($1)',[Array(81).fill(id(10))])),/at most 80/)
 await asRole(db,'authenticated',id(3),()=>db.query('delete from public.saves where post_id=$1',[id(10)]))
 const {rows}=await asRole(db,'anon',null,()=>db.query('select * from public.get_visible_post_engagement($1)',[[id(10)]]))
 assert.equal(Number(rows[0].save_count),0)
})
