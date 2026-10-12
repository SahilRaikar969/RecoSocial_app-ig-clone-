'use client'

import { useState } from 'react'
import { MediaSkeleton } from '@/components/ui/media-skeleton'

type SmartImageProps = {
  src?: string | null
  alt: string
  className: string
  fallbackClassName?: string
  fallbackText?: string
  loading?: 'lazy' | 'eager'
  retryable?: boolean
  fetchPriority?: 'auto' | 'high' | 'low'
}

function isProbablyRenderableUrl(value: string) {
  if (!value) return false
  if (value.startsWith('blob:')) return true
  if (value.startsWith('data:image/')) return true

  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

function SmartImageSource({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackText = 'Media',
  loading = 'lazy',
  fetchPriority = 'auto',
  retryable = false,
}: SmartImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [attempt, setAttempt] = useState(0)

  const normalizedSrc = String(src || '').trim()
  const shouldRender = isProbablyRenderableUrl(normalizedSrc)

  if (!shouldRender || failed) {
    return (
      <div className={fallbackClassName || className}>
        <div className="flex flex-col items-center gap-2 text-center"><span>{fallbackText}</span>
          {retryable && failed && shouldRender ? <button type="button" onClick={() => { setLoaded(false); setFailed(false); setAttempt(value => value + 1) }}
            className="min-h-11 rounded-lg bg-zinc-800 px-4 text-sm font-medium text-white">Retry image</button> : null}
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded ? <MediaSkeleton className="absolute inset-0 h-full w-full" /> : null}

      <img
        key={attempt}
        src={normalizedSrc}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        referrerPolicy="no-referrer"
        style={{ objectFit: className.includes('object-contain') ? 'contain' : 'cover' }}
        className={`h-full w-full transition duration-200 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  )
}
export function SmartImage(props: SmartImageProps) {
  const src = String(props.src || '').trim()
  return <SmartImageSource key={src} {...props} src={src} />
}
