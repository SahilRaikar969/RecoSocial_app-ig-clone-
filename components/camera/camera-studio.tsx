'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Camera,
  CameraOff,
  Check,
  ChevronsLeftRight,
  RotateCcw,
  Video,
  Circle,
  Loader2,
  X,
} from 'lucide-react'

type CameraCategory = {
  id: string
  name: string
  slug: string
}

type CameraStudioProps = {
  returnTo: string
  categories: CameraCategory[]
}

type CaptureMode = 'photo' | 'video'
type PublishTarget = 'post' | 'story'

export function CameraStudio({
  returnTo,
  categories,
}: CameraStudioProps) {
  const router = useRouter()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [mode, setMode] = useState<CaptureMode>('photo')
  const [target, setTarget] = useState<PublishTarget>('post')
  const [caption, setCaption] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [recording, setRecording] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')

  const resolvedMediaType = useMemo(
    () => (mode === 'photo' ? 'image' : 'video'),
    [mode]
  )

  useEffect(() => {
    void startCamera()

    return () => {
      stopCamera()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [facingMode])

  function stopCamera() {
    recorderRef.current?.stop()
    recorderRef.current = null

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    setCameraReady(false)
    setRecording(false)
  }

  async function startCamera() {
    try {
      stopCamera()
      setCameraError('')

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode,
          width: { ideal: 1080 },
          height: { ideal: 1920 },
        },
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setCameraReady(true)
    } catch (error: any) {
      setCameraError(
        error?.message || 'Unable to access camera on this device/browser.'
      )
    }
  }

  function clearCapture() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }

    setCapturedFile(null)
    setPreviewUrl('')
    setPublishing(false)
  }

  async function handleTakePhoto() {
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1080
    canvas.height = video.videoHeight || 1920

    const context = canvas.getContext('2d')
    if (!context) return

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )

    if (!blob) return

    const file = new File([blob], `camera-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })

    if (previewUrl) URL.revokeObjectURL(previewUrl)

    setCapturedFile(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function startVideoRecording() {
    const stream = streamRef.current
    if (!stream) return

    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
    })

    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      const file = new File([blob], `camera-video-${Date.now()}.webm`, {
        type: 'video/webm',
      })

      if (previewUrl) URL.revokeObjectURL(previewUrl)

      setCapturedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setRecording(false)
    }

    recorderRef.current = recorder
    recorder.start()
    setRecording(true)
  }

  function stopVideoRecording() {
    recorderRef.current?.stop()
  }

  async function handlePublish() {
    if (!capturedFile) return

    try {
      setPublishing(true)

      const formData = new FormData()
      formData.set('target', target)
      formData.set('media_type', resolvedMediaType)
      formData.set('caption', caption.trim())
      formData.set('category_id', target === 'post' ? categoryId : '')
      formData.set('return_to', returnTo)
      formData.set('media_file', capturedFile)

      const response = await fetch('/api/camera/publish', {
        method: 'POST',
        body: formData,
      })

      const payload = await response.json()

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'camera_publish_failed')
      }

      router.push(payload.redirectUrl || returnTo)
      router.refresh()
    } catch (error: any) {
      setPublishing(false)
      setCameraError(error?.message || 'Failed to publish captured media.')
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-4 md:px-6 md:py-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push(returnTo || '/feed')}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Back
          </button>

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            Camera
          </div>
        </div>

        {cameraError ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/25 px-4 py-3 text-sm text-red-100">
            {cameraError}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
            <div className="relative aspect-[9/16] bg-black">
              {!previewUrl ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />

                  {!cameraReady ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-zinc-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : null}
                </>
              ) : resolvedMediaType === 'image' ? (
                <img
                  src={previewUrl}
                  alt="Captured preview"
                  className="h-full w-full object-cover"
                />
              ) : (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  className="h-full w-full object-cover"
                />
              )}

              {!previewUrl ? (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/20 to-transparent px-4 pb-4 pt-20">
                  <button
                    type="button"
                    onClick={() =>
                      setFacingMode((current) =>
                        current === 'user' ? 'environment' : 'user'
                      )
                    }
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  >
                    <ChevronsLeftRight className="h-5 w-5" />
                  </button>

                  {mode === 'photo' ? (
                    <button
                      type="button"
                      onClick={handleTakePhoto}
                      className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/10 text-white transition hover:scale-[1.02]"
                    >
                      <Camera className="h-7 w-7" />
                    </button>
                  ) : !recording ? (
                    <button
                      type="button"
                      onClick={startVideoRecording}
                      className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/20 text-red-300 transition hover:scale-[1.02]"
                    >
                      <Circle className="h-7 w-7 fill-current" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={stopVideoRecording}
                      className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-red-500 text-white transition hover:scale-[1.02]"
                    >
                      <Video className="h-7 w-7" />
                    </button>
                  )}

                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white">
                    {mode === 'photo' ? (
                      <Camera className="h-5 w-5" />
                    ) : (
                      <Video className="h-5 w-5" />
                    )}
                  </div>
                </div>
              ) : (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/20 to-transparent px-4 pb-4 pt-20">
                  <button
                    type="button"
                    onClick={clearCapture}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishing}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f3f3ff_100%)] px-6 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-70"
                  >
                    {publishing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Publish
                  </button>

                  <button
                    type="button"
                    onClick={clearCapture}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="inline-flex rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-violet-200">
                Capture mode
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('photo')
                    clearCapture()
                  }}
                  className={`rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                    mode === 'photo'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Photo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('video')
                    clearCapture()
                  }}
                  className={`rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                    mode === 'video'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Video
                </button>
              </div>
            </section>

            <section className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="inline-flex rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-cyan-200">
                Destination
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setTarget('post')}
                  className={`rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                    target === 'post'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Publish as post
                </button>

                <button
                  type="button"
                  onClick={() => setTarget('story')}
                  className={`rounded-[22px] border px-4 py-4 text-left text-sm transition ${
                    target === 'story'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-zinc-950/85 text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Publish as story
                </button>
              </div>

              <div className="mt-5 space-y-3">
                <label className="block text-sm font-medium text-zinc-300">
                  Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                  rows={4}
                  maxLength={280}
                  placeholder="Write a caption..."
                  className="min-h-[110px] w-full rounded-[22px] border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-zinc-500"
                />
              </div>

              {target === 'post' ? (
                <div className="mt-5 space-y-3">
                  <label className="block text-sm font-medium text-zinc-300">
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="w-full rounded-[22px] border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-white outline-none"
                  >
                    <option value="">No category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </section>

            <section className="rounded-[30px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.96),rgba(8,8,10,0.98))] p-5 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
              <div className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                Quick notes
              </div>

              <ul className="mt-4 space-y-3 text-sm leading-7 text-zinc-400">
                <li>Swipe right from the left edge on feed or create to open camera on mobile.</li>
                <li>Camera capture works best on HTTPS or localhost.</li>
                <li>Use post for permanent feed content and story for 6-hour media.</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}