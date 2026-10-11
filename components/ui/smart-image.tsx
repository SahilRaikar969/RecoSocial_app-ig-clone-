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
}: SmartImageProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const normalizedSrc = String(src || '').trim()
  const shouldRender = isProbablyRenderableUrl(normalizedSrc)

  if (!shouldRender || failed) {
    return (
      <div className={fallbackClassName || className}>
        <span>{fallbackText}</span>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded ? <MediaSkeleton className="absolute inset-0 h-full w-full" /> : null}

      <img
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
