'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { cleanupFreshUploads, fileField, knownDatabaseRejection, MediaMutationError, mediaFailure, mutationId, resolveMedia, validateMedia, type MediaInput } from '@/lib/media/server-media'

export async function createStory(form: FormData) {
  const { profileId } = await getDevSession()
  const client = await createClient()
  const fresh: string[] = []
  let safeToClean = true
  try {
    const id = mutationId(form)
    const kind = String(form.get('media_type') || '')
    const caption = String(form.get('caption') || '').trim()
    if (kind !== 'image' && kind !== 'video') throw new MediaMutationError('Choose image or video media.')
    if (caption.length > 180) throw new MediaMutationError('Keep the story caption within 180 characters.')
    const media: MediaInput = {file:fileField(form,'media_file'),path:String(form.get('media_path') || '').trim(),folder:kind === 'image' ? 'story-images' : 'story-videos',kind,maxBytes:(kind === 'image' ? 12 : 35)*1024*1024}
    const thumbnail: MediaInput = {file:kind === 'video' ? fileField(form,'thumbnail_file') : null,path:kind === 'video' ? String(form.get('thumbnail_path') || '').trim() : '',folder:'story-thumbnails',kind:'image',maxBytes:8*1024*1024,optional:true}
    await validateMedia(media,profileId)
    await validateMedia(thumbnail,profileId)
    const path = await resolveMedia(client,profileId,media,fresh)
    const thumbnailPath = await resolveMedia(client,profileId,thumbnail,fresh)
    safeToClean = false
    const payload = {id,author_id:profileId,media_type:kind,media_path:path!,thumbnail_path:thumbnailPath,caption:caption || null}
    const {error} = await client.from('stories').upsert(payload,{onConflict:'id',ignoreDuplicates:true})
    if (error) {
      safeToClean = knownDatabaseRejection(error)
      throw new MediaMutationError(safeToClean ? 'The story could not be saved.' : 'The save result could not be confirmed. Refresh before retrying; uploaded media was retained.')
    }
    const {data:stored,error:readError} = await client.from('stories').select('author_id,media_type,media_path,thumbnail_path,caption').eq('id',id).eq('author_id',profileId).maybeSingle()
    if (readError || !stored || stored.media_path !== path || stored.thumbnail_path !== thumbnailPath || stored.media_type !== kind || stored.caption !== payload.caption) {
      throw new MediaMutationError('The story result could not be confirmed. Refresh before retrying; uploaded media was retained.')
    }
  } catch (error) {
    const cleaned = safeToClean ? await cleanupFreshUploads(client,profileId,fresh) : true
    return {ok:false as const,error:mediaFailure(error,'The story result could not be confirmed. Refresh before retrying.')+(cleaned ? '' : ' Some unlinked uploads could not be removed; cleanup is pending.')}
  }
  revalidatePath('/feed')
  revalidatePath('/stories')
  redirect('/feed?story_created=1')
}

export async function markStoryViewed(storyId: string) {
  const {profileId} = await getDevSession()
  const client = await createClient()
  if (!storyId) return {ok:false as const,error:'The story is unavailable.'}
  const {error} = await client.from('story_views').upsert({story_id:storyId,viewer_id:profileId},{onConflict:'story_id,viewer_id',ignoreDuplicates:true})
  return error ? {ok:false as const,error:'The story view could not be recorded.'} : {ok:true as const}
}
