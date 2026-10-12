import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Guest queries deliberately reference only tables already granted to anon. Never use a service key. */
export async function getPublicPosts(options: {id?:string; authorId?:string; category?:string}={}) {
  const db=await createClient()
  const columns='id,author_id,caption,media_type,media_path,thumbnail_path,created_at,profiles!posts_author_id_fkey(id,username,display_name,avatar_url),post_categories(category_id,categories(id,name,slug))' as const
  const topicColumns='id,author_id,caption,media_type,media_path,thumbnail_path,created_at,profiles!posts_author_id_fkey(id,username,display_name,avatar_url),post_categories!inner(category_id,categories!inner(id,name,slug))' as const
  let query=db.from('posts').select(options.category?topicColumns:columns).eq('status','published').eq('visibility','public')
  if(options.id) query=query.eq('id',options.id)
  if(options.authorId) query=query.eq('author_id',options.authorId)
  if(options.category) query=query.eq('post_categories.categories.slug',options.category)
  const result=await query.order('created_at',{ascending:false}).order('id',{ascending:true}).limit(80)
  if(result.error) throw new Error('Public posts could not be loaded.')
  const rows=(result.data??[]).filter(p=>p.media_path.trim()&&(p.media_type==='image'||p.media_type==='video'))
  const engagement=rows.length?await db.rpc('get_visible_post_engagement',{post_ids:rows.map(p=>p.id)}):{data:[],error:null}
  if(engagement.error) throw new Error('Post counts could not be loaded.')
  const countMap=new Map((engagement.data??[]).map(row=>[row.post_id,row]))
  return rows.map(row=>({...row,author:row.profiles,like_count:countMap.get(row.id)?.like_count??0,save_count:countMap.get(row.id)?.save_count??0,comment_count:countMap.get(row.id)?.comment_count??0,liked_by_me:false,saved_by_me:false}))
}
export async function getPublicExplore(category?:string) {
  const db=await createClient()
  const [posts,categories]=await Promise.all([getPublicPosts({category}),db.from('categories').select('id,name,slug').order('name')])
  if(categories.error)throw new Error('Topics could not be loaded.')
  const authors=[...new Map(posts.filter(p=>p.author).map(p=>[p.author!.id,p.author!])).values()]
  const followers=authors.length?await db.from('follows').select('following_id').in('following_id',authors.map(p=>p.id)):{data:[],error:null}
  if(followers.error)throw new Error('Creator counts could not be loaded.')
  const creators=authors.slice(0,6).map(author=>({...author,bio:'',followed_by_me:false,follower_count:(followers.data??[]).filter(f=>f.following_id===author.id).length,post_count:posts.filter(p=>p.author_id===author.id).length,latest_post_at:posts.find(p=>p.author_id===author.id)!.created_at,discovery_score:0,matched_categories:[] as Array<{name:string;slug:string}>}))
  return {posts,categories:categories.data??[],creators}
}
export async function getPublicProfile(profileId:string) {
  const db=await createClient()
  const [profile,posts,followers,following,total]=await Promise.all([
    db.from('profiles').select('id,username,display_name,bio,avatar_url,is_private,theme_preference').eq('id',profileId).maybeSingle(),getPublicPosts({authorId:profileId}),
    db.from('follows').select('*',{count:'exact',head:true}).eq('following_id',profileId),db.from('follows').select('*',{count:'exact',head:true}).eq('follower_id',profileId),
    db.from('posts').select('*',{count:'exact',head:true}).eq('author_id',profileId).eq('status','published').eq('visibility','public'),
  ])
  for(const result of [profile,followers,following,total])if(result.error)throw new Error('Public profile could not be loaded.')
  if(!profile.data)notFound()
  return {profile:{...profile.data,bio:profile.data.bio??'',is_own_profile:false,followed_by_me:false,follows_you:false,can_message:false},posts,stats:{post_count:total.count??0,saved_count:0,follower_count:followers.count??0,following_count:following.count??0}}
}
export async function getPublicPost(postId:string) {
  const db=await createClient(), post=(await getPublicPosts({id:postId}))[0]
  if(!post)return null
  const [comments,profile]=await Promise.all([
    db.from('comments').select('id,author_id,body,created_at,profiles!comments_author_id_fkey(id,username,display_name,avatar_url)').eq('post_id',postId).order('created_at',{ascending:false}).order('id',{ascending:true}).limit(100),
    getPublicProfile(post.author_id),
  ])
  if(comments.error)throw new Error('Comments could not be loaded.')
  return {...post,is_owner:false,comments:(comments.data??[]).map(c=>({...c,author:c.profiles})),reason_labels:[],author_summary:{follower_count:profile.stats.follower_count,post_count:profile.stats.post_count},related_posts:profile.posts.filter(p=>p.id!==postId).slice(0,6)}
}
