import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { safeReturnPath } from '@/lib/routes/safe-return-path'
import { createClient } from '@/lib/supabase/server'
import { cleanupFreshUploads, fileField, knownDatabaseRejection, MediaMutationError, mediaFailure, mutationId, resolveMedia, validateMedia, type MediaInput } from '@/lib/media/server-media'
import { isOwnedMediaPath } from '@/lib/media/upload-validation'

export async function POST(request: Request) {
  const client = await createClient()
  const {data:{user},error:authError} = await client.auth.getUser()
  if (authError || !user) return NextResponse.json({ok:false,error:'Sign in before publishing.'},{status:401})
  const owner = user.id
  const fresh: string[] = []
  let safeToClean = true
  let returnTo = '/feed'
  try {
    const form = await request.formData()
    const id = mutationId(form)
    const target = String(form.get('target') || '')
    const kind = String(form.get('media_type') || '')
    const caption = String(form.get('caption') || '').trim()
    returnTo = safeReturnPath(String(form.get('return_to') || '/feed'))
    if (target !== 'post' && target !== 'story') throw new MediaMutationError('Choose a post or story destination.')
    if (kind !== 'image' && kind !== 'video') throw new MediaMutationError('Choose image or video media.')
    if (caption.length > (target === 'story' ? 180 : 280)) throw new MediaMutationError('The caption is too long.')
    const categoryId = String(form.get('category_id') || '').trim()
    if (target === 'post') {
      const {data,error} = await client.from('categories').select('id').eq('id',categoryId).maybeSingle()
      if (error || !data) throw new MediaMutationError('Choose a valid post category before uploading.')
    }
    const pathInput = String(form.get('media_path') || '').trim()
    const upload = fileField(form,'media_file')
    if (!upload && !isOwnedMediaPath(pathInput,owner)) throw new MediaMutationError('Upload a capture belonging to your account.')
    const media: MediaInput = {file:upload,path:pathInput,folder:`camera-${target}-${kind === 'image' ? 'images' : 'videos'}`,kind,maxBytes:(kind === 'image' ? 12 : 45)*1024*1024}
    await validateMedia(media,owner)
    const path = (await resolveMedia(client,owner,media,fresh))!
    safeToClean = false
    if (target === 'post') {
      const {error} = await client.rpc('save_post_with_categories',{target_post_id:id,create_new:true,post_caption:caption,post_media_type:kind,post_media_path:path,post_thumbnail_path:null,category_ids:[categoryId],expected_updated_at:null})
      if (error) {
        safeToClean = knownDatabaseRejection(error)
        throw new MediaMutationError(safeToClean ? 'The post could not be published. No partial post was saved.' : 'The publication result could not be confirmed. Refresh before retrying; uploaded media was retained.')
      }
    } else {
      const {error} = await client.from('stories').upsert({id,author_id:owner,media_type:kind,media_path:path,caption:caption || null},{onConflict:'id',ignoreDuplicates:true})
      if (error) {
        safeToClean = knownDatabaseRejection(error)
        throw new MediaMutationError(safeToClean ? 'The story could not be published.' : 'The publication result could not be confirmed. Refresh before retrying; uploaded media was retained.')
      }
      const {data,error:readError} = await client.from('stories').select('media_path,caption,media_type').eq('id',id).eq('author_id',owner).maybeSingle()
      if (readError || !data || data.media_path !== path || data.caption !== (caption || null) || data.media_type !== kind) throw new MediaMutationError('The story result could not be confirmed. Refresh before retrying; uploaded media was retained.')
    }
  } catch (error) {
    const cleaned = safeToClean ? await cleanupFreshUploads(client,owner,fresh) : true
    return NextResponse.json({ok:false,error:mediaFailure(error,'Publication could not be confirmed. Refresh before retrying.')+(cleaned ? '' : ' Some unlinked uploads could not be removed; cleanup is pending.')},{status:400})
  }
  for (const path of ['/feed','/explore','/profile',`/profile/${owner}`]) revalidatePath(path)
  return NextResponse.json({ok:true,redirectTo:returnTo})
}
