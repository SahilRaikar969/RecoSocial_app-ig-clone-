'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { buildReturnUrl } from '@/lib/routes/safe-return-path'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { cleanupFreshUploads, fileField, knownDatabaseRejection, MediaMutationError, mediaFailure, mutationId, resolveMedia, validateMedia, type MediaInput } from '@/lib/media/server-media'

type Failure = { ok: false; error: string }
const MiB = 1024 * 1024
function invalidatePosts(profileId: string, postId: string) {
  for (const path of ['/feed','/explore','/profile',`/profile/${profileId}`,`/post/${postId}`]) revalidatePath(path)
}
async function savePost(form: FormData, createNew: boolean): Promise<Failure | never> {
  const { profileId } = await getDevSession()
  const client = await createClient()
  const fresh: string[] = []
  let databaseStarted = false
  let safeToClean = true
  let postId = ''
  let returnTo = '/feed'
  try {
    postId = createNew ? mutationId(form) : String(form.get('post_id') || '').trim()
    if (!profileId || !postId) throw new MediaMutationError('Sign in and select a valid post.')
    const caption = String(form.get('caption') || '').trim()
    const kind = String(form.get('media_type') || '')
    if (caption.length > 280) throw new MediaMutationError('Keep the caption within 280 characters.')
    if (kind !== 'image' && kind !== 'video') throw new MediaMutationError('Choose image or video media.')
    const names = [...new Set(form.getAll('categories').map(String).map(value => value.trim()).filter(Boolean))]
    if (!names.length || names.length > 100) throw new MediaMutationError('Choose at least one valid category.')
    const { data: categories, error: categoryError } = await client.from('categories').select('id,name').in('name', names)
    if (categoryError || !categories || categories.length !== names.length) throw new MediaMutationError('The selected categories could not be verified. Refresh and try again.')
    let version: string | null = null
    if (!createNew) {
      const { data: post, error } = await client.from('posts').select('id,author_id,updated_at').eq('id',postId).eq('author_id',profileId).maybeSingle()
      if (error || !post) throw new MediaMutationError('This post is unavailable or you cannot edit it.')
      version = String(form.get('expected_updated_at') || post.updated_at)
      returnTo = String(form.get('return_to') || `/post/${postId}`)
    }
    const media: MediaInput = { file:fileField(form,'media_file'), path:String(form.get('media_path') || '').trim(), folder:kind === 'image' ? 'images' : 'videos', kind, maxBytes:(kind === 'image' ? 15 : 50)*MiB }
    const thumbnail: MediaInput = { file:kind === 'video' ? fileField(form,'thumbnail_file') : null, path:kind === 'video' ? String(form.get('thumbnail_path') || '').trim() : '', folder:'thumbnails',kind:'image',maxBytes:10*MiB,optional:true }
    await validateMedia(media,profileId)
    await validateMedia(thumbnail,profileId)
    const mediaPath = await resolveMedia(client,profileId,media,fresh)
    const thumbnailPath = await resolveMedia(client,profileId,thumbnail,fresh)
    databaseStarted = true
    safeToClean = false
    const { error } = await client.rpc('save_post_with_categories', {
      target_post_id:postId, create_new:createNew, post_caption:caption, post_media_type:kind,
      post_media_path:mediaPath!, post_thumbnail_path:thumbnailPath, category_ids:categories.map(row=>row.id), expected_updated_at:version,
    })
    if (error) {
      safeToClean = knownDatabaseRejection(error)
      throw new MediaMutationError(error.code === '40001' ? 'This post or request has changed. Reload before trying again.' : safeToClean ? 'The post could not be saved. Your previous content was preserved.' : 'The save result could not be confirmed. Refresh before retrying; uploaded media was retained.')
    }
  } catch (error) {
    const cleaned = (!databaseStarted || safeToClean) ? await cleanupFreshUploads(client,profileId,fresh) : true
    return {ok:false,error:mediaFailure(error,'The save result could not be confirmed. Refresh before retrying.') + (cleaned ? '' : ' Some unlinked uploads could not be removed; cleanup is pending.')}
  }
  // Old/public media is deliberately retained: references can be reused/race.
  invalidatePosts(profileId,postId)
  redirect(createNew ? '/feed?post_created=1' : buildReturnUrl(returnTo,{post_updated:'1'}))
}
export async function createPost(form: FormData) { return savePost(form,true) }
export async function updatePost(form: FormData) { return savePost(form,false) }
export async function deletePost(form: FormData) {
  const { profileId } = await getDevSession()
  const client = await createClient()
  const id = String(form.get('post_id') || '').trim()
  const returnTo = String(form.get('return_to') || '/feed')
  const { data,error } = await client.from('posts').delete().eq('id',id).eq('author_id',profileId).select('id').maybeSingle()
  if (error || !data) redirect(buildReturnUrl(returnTo,{error:'The post could not be deleted. Refresh and try again.'}))
  invalidatePosts(profileId,id)
  redirect('/feed?post_deleted=1')
}
