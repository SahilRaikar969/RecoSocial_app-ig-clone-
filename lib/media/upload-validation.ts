const IMAGE_TYPES: Record<string, readonly string[]> = {
  'image/jpeg': ['jpg', 'jpeg'], 'image/jpg': ['jpg', 'jpeg'],
  'image/png': ['png'], 'image/webp': ['webp'], 'image/gif': ['gif'],
}
const VIDEO_TYPES: Record<string, readonly string[]> = {
  'video/mp4': ['mp4'], 'video/webm': ['webm'], 'video/quicktime': ['mov'],
  'video/x-m4v': ['m4v'], 'video/3gpp': ['3gp'], 'video/3gpp2': ['3g2'],
  'video/ogg': ['ogv', 'ogg'],
}
const STORAGE_FOLDERS = new Set([
  'images', 'videos', 'thumbnails', 'avatars', 'story-images', 'story-videos',
  'story-thumbnails', 'camera-story-images', 'camera-story-videos',
  'camera-post-images', 'camera-post-videos',
])

export function isOwnedMediaPath(value: string, profileId: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(profileId)) return false
  const parts = value.split('/')
  return parts.length === 3 && STORAGE_FOLDERS.has(parts[0]) &&
    parts[1] === profileId && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(parts[2])
}

/** Bounded signature screening, not a full decoder or malware scan. */
export async function assertMediaUpload(file: File) {
  const type = file.type.toLowerCase().split(';')[0].trim()
  const extension = file.name.split('.').pop()?.toLowerCase() || ''
  const extensions = IMAGE_TYPES[type] || VIDEO_TYPES[type]
  if (!extensions?.includes(extension) || file.size === 0 || file.size > 50 * 1024 * 1024) {
    throw new Error('invalid_media_file_type_or_size')
  }
  const bytes = new Uint8Array(await file.slice(0, 32).arrayBuffer())
  const starts = (...prefix: number[]) => prefix.every((value, i) => bytes[i] === value)
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end))
  let valid = false
  switch (type) {
    case 'image/jpeg':
    case 'image/jpg': valid = starts(0xff, 0xd8, 0xff); break
    case 'image/png': valid = starts(0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10); break
    case 'image/gif': valid = ['GIF87a', 'GIF89a'].includes(ascii(0, 6)); break
    case 'image/webp': valid = ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'; break
    case 'video/webm': valid = starts(0x1a, 0x45, 0xdf, 0xa3); break
    case 'video/ogg': valid = ascii(0, 4) === 'OggS'; break
    case 'video/quicktime':
      valid = ['ftyp', 'moov', 'mdat', 'wide'].includes(ascii(4, 8)); break
    default: valid = ascii(4, 8) === 'ftyp'
  }
  if (!valid) throw new Error('media_signature_mismatch')
}
