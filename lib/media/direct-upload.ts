import { createClient } from '@/lib/supabase/browser'
import { assertMediaUpload, isOwnedMediaPath } from '@/lib/media/upload-validation'

export type MediaFormKind = 'post' | 'story' | 'profile' | 'camera'
type Upload = { file: File; field: string; folder: string; max: number; type: 'image' | 'video' }
const MB = 1024 * 1024

/** An instance belongs to one composer. Paths survive uncertain publication retries. */
export function createMediaUploadSession() {
  let cropCache = ''
  let cropFile: File | null = null
  const cache = new Map<File, { path: string; owner: string; folder: string }>()
  return async function prepare(form: FormData, kind: MediaFormKind, mutationId: string) {
    const result = new FormData()
    for (const [key, value] of form.entries()) {
      if (typeof value === 'string' && key !== 'avatar_crop_data_url') result.append(key, value)
    }
    result.set('mutation_id', mutationId)
    const mediaType = form.get('media_type') === 'video' ? 'video' : 'image'
    const uploads: Upload[] = []
    const add = (field: string, input: string, folder: string, max: number, type: 'image' | 'video') => {
      const file = form.get(input)
      if (file instanceof File && file.size) uploads.push({ file, field, folder, max, type })
    }
    if (kind === 'profile' && form.get('remove_avatar') !== 'true') {
      const crop = form.get('avatar_crop_data_url')
      if (typeof crop === 'string' && crop.startsWith('data:image/jpeg;base64,')) {
        const bytes = Uint8Array.from(atob(crop.slice(crop.indexOf(',') + 1)), c => c.charCodeAt(0))
        // Reuse the File identity on retries of an unchanged crop.
        const file = crop === cropCache && cropFile ? cropFile : new File([bytes], 'avatar-crop.jpg', { type: 'image/jpeg' })
        cropCache = crop
        cropFile = file
        uploads.push({ file, field: 'avatar_url', folder: 'avatars', max: 10 * MB, type: 'image' })
      } else add('avatar_url', 'avatar_file', 'avatars', 10 * MB, 'image')
    } else if (kind !== 'profile') {
      const prefix = kind === 'story' ? 'story-' : kind === 'camera' ? `camera-${form.get('target') === 'story' ? 'story' : 'post'}-` : ''
      const max = kind === 'story' ? (mediaType === 'image' ? 12 : 35) : kind === 'camera' ? (mediaType === 'image' ? 12 : 45) : (mediaType === 'image' ? 15 : 50)
      add('media_path', 'media_file', prefix + (mediaType === 'image' ? 'images' : 'videos'), max * MB, mediaType)
      if (mediaType === 'video') add('thumbnail_path', 'thumbnail_file', kind === 'story' ? 'story-thumbnails' : 'thumbnails', (kind === 'story' ? 8 : 10) * MB, 'image')
      else result.set('thumbnail_path', '')
    }
    // Validate the whole batch before the first upload.
    for (const upload of uploads) {
      if (upload.file.size > upload.max || !upload.file.type.startsWith(upload.type + '/')) throw new Error('Check the media type and file size before uploading.')
      await assertMediaUpload(upload.file)
    }
    if (!uploads.length) return result
    const client = createClient()
    const { data, error } = await client.auth.getUser()
    if (error || !data.user) throw new Error('Sign in again before uploading.')
    const owner = data.user.id
    const fresh: Array<{ file: File; path: string }> = []
    try {
      for (const upload of uploads) {
        const existing = cache.get(upload.file)
        let path = existing?.owner === owner && existing.folder === upload.folder ? existing.path : ''
        if (!path) {
          const extension = upload.file.name.split('.').pop()?.toLowerCase()
          path = `${upload.folder}/${owner}/${crypto.randomUUID()}.${extension}`
          if (!isOwnedMediaPath(path, owner)) throw new Error('Unable to prepare an owned upload path.')
          // Track even an uncertain upload result: no publication has started yet.
          fresh.push({ file: upload.file, path })
          const { error: uploadError } = await client.storage.from('media').upload(path, upload.file, {
            contentType: upload.file.type.split(';')[0], cacheControl: '1800', upsert: false,
          })
          if (uploadError) throw new Error('Media upload failed. Please try again.')
          cache.set(upload.file, { path, owner, folder: upload.folder })
        }
        result.set(upload.field, path)
      }
    } catch {
      for (const item of fresh) cache.delete(item.file)
      // Only this pre-publication batch is eligible. Previously submitted paths are retained.
      if (fresh.length) {
        try { await client.storage.from('media').remove(fresh.map(item => item.path)) } catch { /* best effort; manual cleanup may be required */ }
      }
      throw new Error('Media upload failed. Please try again. Unfinished uploads may require later cleanup.')
    }
    return result
  }
}
