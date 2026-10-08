import assert from 'node:assert/strict'
import { before,after,test } from 'node:test'
import { asRole,createTestDatabase } from './database.mjs'
const A='10000000-0000-4000-8000-000000000001', B='10000000-0000-4000-8000-000000000002'
const id=n=>'20000000-0000-4000-8000-'+String(n).padStart(12,'0')
let db, categories
before(async()=>{
  db=await createTestDatabase()
  await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[A,'a@example.test',B,'b@example.test'])
  categories=(await db.query('select id from categories order by slug limit 2')).rows.map(row=>row.id)
})
after(async()=>{await db?.close()})
const as=(user,fn)=>asRole(db,'authenticated',user,fn)
const read=async(sql,args=[]) => (await db.query(sql,args)).rows
async function publish(n,{actor=A,create=true,caption='caption',path='images/'+A+'/fresh.jpg',cats=categories,version=null}={}) {
  return as(actor,()=>db.query('select save_post_with_categories($1,$2,$3,$4,$5,$6,$7,$8) as id',[id(n),create,caption,'image',path,null,cats,version]))
}
test('publication creates post and category set atomically; same request is idempotent',async()=>{
  await publish(1,{cats:[categories[0],categories[0]]})
  await publish(1,{cats:[categories[0]]})
  assert.equal((await read('select id from posts where id=$1',[id(1)])).length,1)
  assert.deepEqual(await read('select category_id from post_categories where post_id=$1',[id(1)]),[{category_id:categories[0]}])
  await assert.rejects(publish(1,{caption:'different'}),/publication_request_conflict/)
})
test('unknown category fails before either part of publication persists',async()=>{
  await assert.rejects(publish(2,{cats:[id(999)]}),/invalid_categories/)
  assert.deepEqual(await read('select id from posts where id=$1',[id(2)]),[])
})
test('secondary category failure rolls back the newly inserted post',async()=>{
  await db.exec("create function public.m2_test_fail_category() returns trigger language plpgsql as $$ begin raise exception 'fixture_category_failure'; end $$; create trigger m2_test_fail_category before insert on post_categories for each row execute function public.m2_test_fail_category();")
  try {
    await assert.rejects(publish(3),/fixture_category_failure/)
    assert.deepEqual(await read('select id from posts where id=$1',[id(3)]),[])
    assert.deepEqual(await read('select post_id from post_categories where post_id=$1',[id(3)]),[])
  } finally {await db.exec('drop trigger m2_test_fail_category on post_categories; drop function m2_test_fail_category();')}
})
test('failed update preserves prior caption and categories',async()=>{
  await publish(4,{cats:[categories[0]]})
  const [post]=await read('select updated_at from posts where id=$1',[id(4)])
  await db.exec("create function public.m2_test_fail_category() returns trigger language plpgsql as $$ begin raise exception 'fixture_category_failure'; end $$; create trigger m2_test_fail_category before insert on post_categories for each row execute function public.m2_test_fail_category();")
  try {await assert.rejects(publish(4,{create:false,caption:'changed',cats:[categories[1]],version:post.updated_at}),/fixture_category_failure/)}
  finally {await db.exec('drop trigger m2_test_fail_category on post_categories; drop function m2_test_fail_category();')}
  assert.equal((await read('select caption from posts where id=$1',[id(4)]))[0].caption,'caption')
  assert.deepEqual(await read('select category_id from post_categories where post_id=$1',[id(4)]),[{category_id:categories[0]}])
})
test('version checks reject stale or missing edit versions',async()=>{
  await publish(5)
  const [post]=await read('select updated_at from posts where id=$1',[id(5)])
  await publish(5,{create:false,caption:'new',version:post.updated_at})
  await assert.rejects(publish(5,{create:false,caption:'stale',version:post.updated_at}),/post_changed_reload/)
  await assert.rejects(publish(5,{create:false}),/post_changed_reload/)
})
test('caller cannot create or update another owner post or reference raw foreign media',async()=>{
  await publish(6)
  await assert.rejects(publish(6,{actor:B,path:'images/'+B+'/own.jpg'}),/post_not_found|row-level security/)
  await assert.rejects(publish(6,{actor:B,create:false,version:new Date().toISOString()}),/post_not_found/)
  await assert.rejects(publish(7,{actor:B}),/check constraint/)
  assert.deepEqual(await read('select id from posts where id=$1',[id(7)]),[])
  await assert.rejects(asRole(db,'anon',null,()=>db.query('select save_post_with_categories($1,true,$2,$3,$4,null,$5,null)',[id(8),'caption','image','images/'+A+'/a.jpg',categories])),/permission denied/)
})
test('invalid media update does not remove category metadata',async()=>{
  await publish(9)
  const [post]=await read('select updated_at from posts where id=$1',[id(9)])
  await assert.rejects(publish(9,{create:false,path:'images/'+B+'/other.jpg',version:post.updated_at}),/check constraint/)
  assert.equal((await read('select category_id from post_categories where post_id=$1',[id(9)])).length,2)
})
