'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

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
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 })

  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!file) {
      setSourceUrl('')
      setZoom(1.15)
      setOffsetX(0)
      setOffsetY(0)
      setNaturalSize({ width: 0, height: 0 })
      onCroppedChange('')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      setSourceUrl(objectUrl)
      setZoom(1.15)
      setOffsetX(0)
      setOffsetY(0)
      setNaturalSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      })
      onErrorChange?.('')
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setSourceUrl('')
      setNaturalSize({ width: 0, height: 0 })
      onCroppedChange('')
      onErrorChange?.('Unable to prepare this avatar image.')
    }

    image.src = objectUrl

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file, onCroppedChange, onErrorChange])

  const previewTransform = useMemo(
    () => ({
      transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom})`,
    }),
    [offsetX, offsetY, zoom]
  )

  useEffect(() => {
    if (!sourceUrl || !canvasRef.current || !naturalSize.width || !naturalSize.height) {
      return
    }

    const image = new Image()

    image.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return

      const context = canvas.getContext('2d')
      if (!context) return

      canvas.width = OUTPUT_SIZE
      canvas.height = OUTPUT_SIZE

      context.clearRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)
      context.fillStyle = '#000000'
      context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

      const baseScale = Math.max(
        OUTPUT_SIZE / naturalSize.width,
        OUTPUT_SIZE / naturalSize.height
      )

      const scaledWidth = naturalSize.width * baseScale * zoom
      const scaledHeight = naturalSize.height * baseScale * zoom

      const drawX = (OUTPUT_SIZE - scaledWidth) / 2 + offsetX * 3
      const drawY = (OUTPUT_SIZE - scaledHeight) / 2 + offsetY * 3

      context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight)

      onCroppedChange(canvas.toDataURL('image/jpeg', 0.92))
    }

    image.onerror = () => {
      onErrorChange?.('Unable to prepare this avatar image.')
    }

    image.src = sourceUrl
  }, [sourceUrl, naturalSize, zoom, offsetX, offsetY, onCroppedChange, onErrorChange])

  if (!file || !sourceUrl) {
    return null
  }

  return (
    <div className="rounded-[24px] border border-zinc-800 bg-black p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
        Avatar crop
      </p>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]">
        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
          <div className="mx-auto aspect-square max-w-[320px] overflow-hidden rounded-full border border-zinc-800 bg-black">
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              <img
                src={sourceUrl}
                alt="Avatar crop preview"
                className="max-h-none max-w-none select-none"
                style={previewTransform}
                draggable={false}
              />
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
              <span>Zoom</span>
              <span>{zoom.toFixed(2)}x</span>
            </div>

            <input
              type="range"
              min={1}
              max={2.5}
              step={0.01}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-full accent-white"
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setOffsetY((value) => clamp(value - 4, -80, 80))}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
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
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              Reset
            </button>

            <button
              type="button"
              onClick={() => setOffsetY((value) => clamp(value + 4, -80, 80))}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              Down
            </button>

            <button
              type="button"
              onClick={() => setOffsetX((value) => clamp(value - 4, -80, 80))}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              Left
            </button>

            <button
              type="button"
              onClick={() => setZoom((value) => clamp(value - 0.05, 1, 2.5))}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              Zoom -
            </button>

            <button
              type="button"
              onClick={() => setOffsetX((value) => clamp(value + 4, -80, 80))}
              className="rounded-2xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
            >
              Right
            </button>
          </div>
        </div>

        <div className="rounded-[24px] border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
            Saved output
          </p>

          <div className="mt-4 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="h-36 w-36 rounded-full border border-zinc-800 bg-black"
            />
          </div>

          <p className="mt-4 text-xs leading-6 text-zinc-500">
            The cropped result above is what gets uploaded as the final avatar.
          </p>
        </div>
      </div>
    </div>
  )
}