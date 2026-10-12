import { compareFeedPosts, selectFeedPage, FEED_CANDIDATE_LIMIT, type FeedBucket, type FeedView } from '@/lib/recommendations/feed-contract'
import { buildAffinity, scoreCandidate, diversify, SIGNAL_LIMIT, SIGNAL_DAYS, type InterestEvent } from '@/lib/recommendations/engine'
import { createClient } from '@/lib/supabase/server'
import { getHiddenPostIds } from '@/lib/db/queries/post-moderation'

export async function getFeedData(viewerProfileId: string | null, options: { view?: FeedView; page?: number; now?: number; candidateBefore?: number } = {}) {
  const supabase = await createClient()
  const now = options.now ?? Date.now(), view = options.view ?? 'for-you'
  const candidateBefore = options.candidateBefore ?? now
  const cutoff = new Date(now-SIGNAL_DAYS*86_400_000).toISOString()
  const empty = { data: [], error: null }
  const [hiddenPostIds, follows, preferences, likes, saves, comments] = await Promise.all([
    viewerProfileId ? getHiddenPostIds(viewerProfileId) : Promise.resolve(new Set<string>()),
    viewerProfileId ? supabase.from('follows').select('following_id').eq('follower_id',viewerProfileId) : Promise.resolve(empty),
    viewerProfileId ? supabase.from('profile_category_preferences').select('categories(id,name,slug)').eq('profile_id',viewerProfileId) : Promise.resolve(empty),
    viewerProfileId ? supabase.from('likes').select('post_id,created_at,posts(author_id,post_categories(category_id,categories(id,name,slug)))').eq('profile_id',viewerProfileId).gte('created_at',cutoff).lte('created_at',new Date(now).toISOString()).order('created_at',{ascending:false}).order('post_id',{ascending:true}).limit(SIGNAL_LIMIT) : Promise.resolve(empty),
    viewerProfileId ? supabase.from('saves').select('post_id,created_at,posts(author_id,post_categories(category_id,categories(id,name,slug)))').eq('profile_id',viewerProfileId).gte('created_at',cutoff).lte('created_at',new Date(now).toISOString()).order('created_at',{ascending:false}).order('post_id',{ascending:true}).limit(SIGNAL_LIMIT) : Promise.resolve(empty),
    viewerProfileId ? supabase.from('comments').select('id,post_id,created_at,posts(author_id,post_categories(category_id,categories(id,name,slug)))').eq('author_id',viewerProfileId).gte('created_at',cutoff).lte('created_at',new Date(now).toISOString()).order('created_at',{ascending:false}).order('id',{ascending:true}).limit(SIGNAL_LIMIT) : Promise.resolve(empty),
  ])
  for (const result of [follows,preferences,likes,saves,comments]) if (result.error) throw new Error('Unable to load recommendation signals.')
  const following = new Set((follows.data ?? []).map(row=>row.following_id))
  const unwrap = <T,>(value:T | T[] | null): T | null => Array.isArray(value) ? value[0] ?? null : value
  const events: InterestEvent[] = []
  for (const [kind,result] of [['like',likes],['save',saves],['comment',comments]] as const) {
    for (const row of result.data ?? []) {
      const post=unwrap(row.posts)
      if (post) events.push({kind,postId:row.post_id,creatorId:post.author_id,at:row.created_at,categories:(post.post_categories??[]).flatMap(c=>{const cat=unwrap(c.categories);return cat?[cat.slug]:[]})})
    }
  }
  const selected=(preferences.data??[]).flatMap(row=>{const cat=unwrap(row.categories);return cat?[cat.slug]:[]})
  const affinity=buildAffinity(selected,events,viewerProfileId,now)
  let query=supabase.from('posts').select('id,author_id,caption,media_type,media_path,thumbnail_path,created_at,profiles!posts_author_id_fkey(id,username,display_name,avatar_url),post_categories(category_id,categories(id,name,slug))')
    .eq('status','published').eq('visibility','public').lte('created_at',new Date(candidateBefore).toISOString()).order('created_at',{ascending:false}).order('id',{ascending:true})
  if(hiddenPostIds.size) query=query.not('id','in','('+[...hiddenPostIds].join(',')+')')
  if(view==='following') query=query.in('author_id',[...following])
  const candidates=view==='following'&&!following.size ? empty : await query.limit(FEED_CANDIDATE_LIMIT)
  if(candidates.error) throw new Error('Unable to load the feed.')
  const ids=(candidates.data??[]).map(row=>row.id)
  const engagement=ids.length ? await supabase.rpc('get_visible_post_engagement',{post_ids:ids}) : empty
  if(engagement.error) throw new Error('Unable to load post engagement.')
  const counts=new Map((engagement.data??[]).map(row=>[row.post_id,row]))
  const ranked=(candidates.data??[]).filter(post=>post.media_path.trim() && (post.media_type==='image'||post.media_type==='video') && !hiddenPostIds.has(post.id) && (view!=='following'||following.has(post.author_id))).map(post=>{
    const metrics=counts.get(post.id)
    const categories=(post.post_categories??[]).map(item=>({...item,categories:unwrap(item.categories)})).sort((a,b)=>(a.categories?.slug??'').localeCompare(b.categories?.slug??'') || a.category_id.localeCompare(b.category_id))
    const slugs=categories.flatMap(item=>item.categories?[item.categories.slug]:[])
    const fromFollowing=following.has(post.author_id)
    const score=scoreCandidate({creatorId:post.author_id,categories:slugs,createdAt:post.created_at,likes:metrics?.like_count??0,saves:metrics?.save_count??0,comments:metrics?.comment_count??0,followed:fromFollowing},affinity,candidateBefore)
    const matching=categories.filter(item=>(affinity.categories.get(item.categories?.slug??'')??0)>0)
    return {id:post.id,author_id:post.author_id,caption:post.caption,media_type:post.media_type,media_path:post.media_path,thumbnail_path:post.thumbnail_path,created_at:post.created_at,author:unwrap(post.profiles),post_categories:categories,like_count:metrics?.like_count??0,save_count:metrics?.save_count??0,comment_count:metrics?.comment_count??0,liked_by_me:metrics?.liked_by_me??false,saved_by_me:metrics?.saved_by_me??false,
      feed_score:score.total,reason_labels:[...(fromFollowing?['From creators you follow']:[]),...(score.creator>0?['A creator you interact with']:[]),...matching.slice(0,2).map(c=>'Matches your interest in '+c.categories!.name)].slice(0,3),source_bucket:(fromFollowing?'following':matching.length?'interest':'trending') as FeedBucket}
  }).sort(compareFeedPosts)
  const ordered=diversify(ranked)
  const {posts,...pagination}=selectFeedPage(ordered,view,options.page)
  const categoryMap=new Map(ranked.flatMap(post=>post.post_categories.flatMap(c=>c.categories?[[c.categories.slug,c.categories] as const]:[])))
  return {posts,pagination,summary:{followedCreatorCount:following.size,hiddenPostCount:hiddenPostIds.size,
    topInterestCategories:[...affinity.categories].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).flatMap(([slug])=>categoryMap.has(slug)?[categoryMap.get(slug)!]:[]).slice(0,4),
    recommendationMix:{fromFollowing:ranked.filter(p=>p.source_bucket==='following').length,byInterest:ranked.filter(p=>p.source_bucket==='interest').length,trending:ranked.filter(p=>p.source_bucket==='trending').length}}}
}
