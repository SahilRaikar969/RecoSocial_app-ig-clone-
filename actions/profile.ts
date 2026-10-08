'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getDevSession } from '@/lib/auth/get-dev-session'
import { cleanupFreshUploads, fileField, knownDatabaseRejection, MediaMutationError, mediaFailure, resolveMedia, validateMedia, type MediaInput } from '@/lib/media/server-media'

export async function updateProfile(form: FormData) {
  const { profileId } = await getDevSession()
  const client = await createClient()
  const fresh: string[] = []
  let safeToClean = true
  try {
    const username = String(form.get('username') || '').trim().toLowerCase().replace(/^@+/,'')
    const displayName = String(form.get('display_name') || form.get('displayName') || '').trim()
    const bio = String(form.get('bio') || '').trim()
    if (!/^[a-z0-9._]{1,30}$/.test(username)) throw new MediaMutationError('Use a username of 1–30 letters, numbers, dots or underscores.')
    if (!displayName || displayName.length > 60 || bio.length > 280) throw new MediaMutationError('Use a name of 1–60 characters and a bio of at most 280 characters.')
    const { data: current, error: readError } = await client.from('profiles').select('id,updated_at').eq('id',profileId).single()
    if (readError || !current) throw new MediaMutationError('Your profile could not be loaded. Refresh and try again.')
    let upload = fileField(form,'avatar_file') || fileField(form,'avatar')
    const crop = String(form.get('avatar_crop_data_url') || '')
    if (crop) {
      // Legacy small form support. Browser forms now upload the crop directly.
      if (crop.length > 14 * 1024 * 1024 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(crop)) throw new MediaMutationError('The cropped avatar is invalid or too large.')
      upload = new File([Buffer.from(crop.split(',')[1],'base64')],'avatar.jpg',{type:'image/jpeg'})
    }
    const avatar: MediaInput = { file:upload,path:String(form.get('avatar_url') || form.get('avatarUrl') || '').trim(),folder:'avatars',kind:'image',maxBytes:10*1024*1024,optional:true }
    await validateMedia(avatar,profileId)
    const path = await resolveMedia(client,profileId,avatar,fresh)
    safeToClean = false
    const { data,error } = await client.from('profiles').update({username,display_name:displayName,bio,avatar_url:path}).eq('id',profileId).eq('updated_at',current.updated_at).select('id').maybeSingle()
    if (error || !data) {
      safeToClean = !error || knownDatabaseRejection(error)
      throw new MediaMutationError(error?.code === '23505' ? 'That username is already taken.' : !error ? 'Your profile changed while saving. Reload and try again.' : safeToClean ? 'Your profile could not be saved. The previous avatar was preserved.' : 'The save result could not be confirmed. Refresh before retrying; uploaded media was retained.')
    }
  } catch (error) {
    const cleaned = safeToClean ? await cleanupFreshUploads(client,profileId,fresh) : true
    return {ok:false as const,error:mediaFailure(error,'The save result could not be confirmed. Refresh before retrying.') + (cleaned ? '' : ' Some unlinked uploads could not be removed; cleanup is pending.')}
  }
  // Retain previous public objects until a race-safe reference lifecycle exists.
  for (const path of ['/profile','/profile/edit',`/profile/${profileId}`,'/feed']) revalidatePath(path)
  redirect('/profile?profile_updated=1')
}
