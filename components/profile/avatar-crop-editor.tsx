'use client'

import { useEffect, useRef, useState } from 'react'
import { avatarCropGeometry } from '@/lib/media/avatar-crop'

type AvatarCropEditorProps = {
  file: File | null
  onCroppedChange: (value: string) => void
  onErrorChange?: (value: string) => void
}

const OUTPUT_SIZE = 512

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function AvatarCropEditor({
  file,
  onCroppedChange,
  onErrorChange,
}: AvatarCropEditorProps) {
  const [sourceUrl, setSourceUrl] = useState('')
  const [zoom, setZoom] = useState(1.15)
  const [offsetX, setOffsetX] = useState(0)
  const [offsetY, setOffsetY] = useState(0)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const callbacks = useRef({ onCroppedChange, onErrorChange })
  useEffect(() => { callbacks.current = { onCroppedChange, onErrorChange } }, [onCroppedChange, onErrorChange])

  useEffect(() => {
    let cancelled = false
    imageRef.current = null
    callbacks.current.onCroppedChange('')
    if (!file) return
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      if (cancelled) return
      if (!image.naturalWidth || !image.naturalHeight) {
        callbacks.current.onErrorChange?.('Unable to prepare this avatar image.')
        return
      }
      imageRef.current = image
      setSourceUrl(objectUrl)
      setZoom(1.15)
      setOffsetX(0)
      setOffsetY(0)
      callbacks.current.onErrorChange?.('')
    }
    image.onerror = () => {
      if (cancelled) return
      imageRef.current = null
      setSourceUrl('')
      callbacks.current.onCroppedChange('')
      callbacks.current.onErrorChange?.('Unable to prepare this avatar image.')
    }
    image.src = objectUrl
    return () => {
      cancelled = true
      image.onload = null
      image.onerror = null
      imageRef.current = null
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  useEffect(() => {
    const image = imageRef.current
    if (!image || !sourceUrl) return
    const geometry = avatarCropGeometry(image.naturalWidth, image.naturalHeight, zoom, offsetX, offsetY, OUTPUT_SIZE)
    // Both canvases use the identical geometry; CSS only scales the preview.
    for (const canvas of [canvasRef.current, previewCanvasRef.current]) {
      const context = canvas?.getContext('2d')
      if (!canvas || !context) continue
      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE
      context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      context.drawImage(image, geometry.x, geometry.y, geometry.width, geometry.height)
    }
    if (canvasRef.current) callbacks.current.onCroppedChange(canvasRef.current.toDataURL('image/jpeg', 0.92))
  }, [sourceUrl, zoom, offsetX, offsetY])

  if (!file || !sourceUrl) {
    return null
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-black p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
        Avatar crop
      </p>

      <div className="mt-4 grid min-w-0 gap-4">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="mx-auto aspect-square max-w-[320px] overflow-hidden rounded-full border border-zinc-800 bg-black">
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              <canvas ref={previewCanvasRef} aria-label="Avatar crop preview" className="h-full w-full" />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <label htmlFor="avatar-crop-zoom">Zoom</label>
              <span>{zoom.toFixed(2)}x</span>
            </div>

            <input
              id="avatar-crop-zoom"
              type="range"
              min={1}
              max={2.5}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="min-h-11 w-full accent-violet-500"
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setOffsetY((value) => clamp(value - 4, -80, 80))}
              className="rs-button"
            >
              Up
            </button>

            <button
              type="button"
              onClick={() => {
                setZoom(1.15)
                setOffsetX(0)
                setOffsetY(0)
              }}
              className="rs-button"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={() => setOffsetY((value) => clamp(value + 4, -80, 80))}
              className="rs-button"
            >
              Down
            </button>

            <button
              type="button"
              onClick={() => setOffsetX((value) => clamp(value - 4, -80, 80))}
              className="rs-button"
            >
              Left
            </button>

            <button
              type="button"
              onClick={() => setZoom((value) => clamp(value - 0.05, 1, 2.5))}
              className="rs-button"
            >
              Zoom -
            </button>

            <button
              type="button"
              onClick={() => setOffsetX((value) => clamp(value + 4, -80, 80))}
              className="rs-button"
            >
              Right
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Cropped photo
          </p>

          <div className="mt-4 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              aria-label="Cropped profile photo preview"
              className="h-36 w-36 rounded-full border border-zinc-800 bg-black"
            />
          </div>

          <p className="mt-4 text-xs leading-6 text-zinc-500">
            This crop will be saved as your profile photo.
          </p>
        </div>
      </div>
    </div>
  )
}