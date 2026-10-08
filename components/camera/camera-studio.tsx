'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useObjectUrl } from '@/lib/media/use-object-url'
import { createMediaUploadSession } from '@/lib/media/direct-upload'
import {
  Camera,
  CameraOff,
  Check,
  ChevronsLeftRight,
  ImagePlus,
  Loader2,
  RotateCcw,
  Upload,
  Video,
  Circle,
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
type InputSource = 'camera' | 'upload'

const ACCEPTED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const ACCEPTED_VIDEO_TYPES = new Set([
  'video/webm',
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/3gpp',
  'video/3gpp2',
  'video/ogg',
])

const ACCEPTED_IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'webp',
])

const ACCEPTED_VIDEO_EXTENSIONS = new Set([
  'webm',
  'mp4',
  'mov',
  'm4v',
  '3gp',
  '3g2',
  'ogv',
  'ogg',
])

function getFileExtension(name: string) {
  return name.includes('.')
    ? name.split('.').pop()?.toLowerCase() || 'bin'
    : 'bin'
}

function hasAcceptedTypeOrExtension(
  file: File,
  mimeTypes: Set<string>,
  extensions: Set<string>
) {
  const type = String(file.type || '').toLowerCase().trim()
  const extension = getFileExtension(file.name)

  if (type && mimeTypes.has(type)) {
    return true
  }

  return extensions.has(extension)
}

function isHeicLikeFile(file: File) {
  const type = String(file.type || '').toLowerCase().trim()
  const extension = getFileExtension(file.name)

  return (
    type.includes('heic') ||
    type.includes('heif') ||
    extension === 'heic' ||
    extension === 'heif'
  )
}

export function CameraStudio({
  returnTo,
  categories,
}: CameraStudioProps) {
  const router = useRouter()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const cameraGeneration = useRef(0)
  const publishBusy = useRef(false)
  const uploadSession = useRef<ReturnType<typeof createMediaUploadSession> | null>(null)
  const mutationId = useRef('')

  const [mode, setMode] = useState<CaptureMode>('photo')
  const [target, setTarget] = useState<PublishTarget>('post')
  const [source, setSource] = useState<InputSource>('camera')
  const [caption, setCaption] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [recording, setRecording] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [cameraSupported, setCameraSupported] = useState(true)

  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const previewUrl = useObjectUrl(capturedFile)

  const resolvedMediaType = useMemo(
    () => (mode === 'photo' ? 'image' : 'video'),
    [mode]
  )

  useEffect(() => {
    const hasCameraApi =
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'

    setCameraSupported(hasCameraApi)

    if (!hasCameraApi) {
      setCameraError('This browser/device does not support in-app camera access. Use upload instead.')
      setSource('upload')
      return
    }

    if (source === 'camera' && !capturedFile) {
      void startCamera()
    }

    return () => {
      stopCamera()
    }
  }, [facingMode, source, mode, capturedFile])

  function stopCamera() {
    cameraGeneration.current += 1
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder) {
      recorder.ondataavailable = null
      recorder.onstop = null
      recorder.onerror = null
      if (recorder.state !== 'inactive') recorder.stop()
    }
    chunksRef.current = []
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraReady(false)
    setRecording(false)
  }

  async function startCamera() {
    stopCamera()
    const generation = cameraGeneration.current
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: mode === 'video',
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      if (generation !== cameraGeneration.current) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (generation === cameraGeneration.current) setCameraReady(true)
    } catch {
      if (generation !== cameraGeneration.current) return
      stopCamera()
      setCameraError('Camera access failed. Check browser permissions or use upload.')
    }
  }

  function clearCapture() {
    if (publishBusy.current) return
    mutationId.current = ''
    setCapturedFile(null)
    setPublishing(false)
  }

  async function handleTakePhoto() {
    const generation = cameraGeneration.current
    const video = videoRef.current
    if (!video) return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth || 1920
    canvas.height = video.videoHeight || 1080

    const context = canvas.getContext('2d')
    if (!context) return

    if (facingMode === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )

    if (!blob || generation !== cameraGeneration.current) return

    const file = new File([blob], `camera-photo-${Date.now()}.jpg`, {
      type: 'image/jpeg',
    })

    mutationId.current = ''
    setCapturedFile(file)
  }

  function startVideoRecording() {
    const stream = streamRef.current
    if (!stream || recording) return
    if (typeof MediaRecorder === 'undefined') {
      setCameraError('Video recording is unavailable. Use upload instead.')
      return
    }
    const generation = cameraGeneration.current

    const mimeType = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find(type => MediaRecorder.isTypeSupported(type))
    if (!mimeType) {
      setCameraError('Video recording is unavailable. Use upload instead.')
      return
    }

    let recorder: MediaRecorder
    try { recorder = new MediaRecorder(stream, { mimeType }) } catch {
      setCameraError('Video recording could not start. Use upload instead.')
      return
    }
    chunksRef.current = []

    recorder.ondataavailable = (event) => {
      if (generation === cameraGeneration.current && event.data.size > 0) {
        chunksRef.current.push(event.data)
      }
    }

    recorder.onstop = () => {
      if (generation !== cameraGeneration.current || recorderRef.current !== recorder) return
      recorderRef.current = null
      const type = mimeType.split(';')[0]
      const blob = new Blob(chunksRef.current, { type })
      const file = new File([blob], `camera-video-${Date.now()}.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type })

      mutationId.current = ''
      setCapturedFile(file)
      setRecording(false)
    }

    recorderRef.current = recorder
    recorder.onerror = () => {
      if (recorderRef.current !== recorder) return
      stopCamera()
      setCameraError('Video recording failed. Use upload instead.')
    }
    try { recorder.start(); setRecording(true) } catch {
      stopCamera()
      setCameraError('Video recording could not start. Use upload instead.')
    }
  }

  function stopVideoRecording() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  function isAcceptedUpload(file: File) {
    if (mode === 'photo') {
      return hasAcceptedTypeOrExtension(
        file,
        ACCEPTED_IMAGE_TYPES,
        ACCEPTED_IMAGE_EXTENSIONS
      )
    }

    return hasAcceptedTypeOrExtension(
      file,
      ACCEPTED_VIDEO_TYPES,
      ACCEPTED_VIDEO_EXTENSIONS
    )
  }

  function handleUploadSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (isHeicLikeFile(file)) {
      setCameraError('HEIC and HEIF are not supported in this build yet. Use JPG, PNG, or WEBP.')
      event.target.value = ''
      return
    }

    if (!isAcceptedUpload(file)) {
      setCameraError(
        mode === 'photo'
          ? 'Use JPG, JPEG, PNG, or WEBP for photo upload.'
          : 'Use WEBM, MP4, MOV, M4V, OGG, 3GP, or 3G2 for video upload.'
      )
      event.target.value = ''
      return
    }

    setCameraError('')
    mutationId.current = ''
    setCapturedFile(file)
  }

  async function handlePublish() {
    if (!capturedFile || publishBusy.current) return
    publishBusy.current = true

    try {
      setPublishing(true)
      setCameraError('')

      const formData = new FormData()
      formData.set('target', target)
      formData.set('media_type', resolvedMediaType)
      formData.set('caption', caption.trim())
      formData.set('category_id', target === 'post' ? categoryId : '')
      formData.set('return_to', returnTo)
      formData.set('media_file', capturedFile)

      uploadSession.current ??= createMediaUploadSession()
      mutationId.current ||= crypto.randomUUID()
      const prepared = await uploadSession.current(formData, 'camera', mutationId.current)
      const response = await fetch('/api/camera/publish', {
        method: 'POST',
        body: prepared,
      })

      const payload = await response.json()

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.error || 'camera_publish_failed')
      }

      router.push(payload.redirectTo || payload.redirectUrl || returnTo)
      router.refresh()
    } catch (error: unknown) {
      setPublishing(false)
      const message = error instanceof Error ? error.message : 'Failed to publish captured media.'
      setCameraError(message || 'The publication outcome is unknown. Check your profile before retrying.')
    } finally {
      publishBusy.current = false
    }
  }

  return (
    <main className="min-h-[100svh] bg-black text-white">
      <div className="mx-auto flex min-h-[100svh] max-w-7xl flex-col gap-3 px-3 py-3 md:gap-5 md:px-5 md:py-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push(returnTo || '/feed')}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Back
          </button>

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            Camera studio
          </div>
        </div>

        {cameraError ? (
          <div className="rounded-2xl border border-red-900/40 bg-red-950/25 px-4 py-3 text-sm text-red-100">
            {cameraError}
          </div>
        ) : null}

        <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
          <section className="overflow-hidden rounded-[26px] border border-zinc-800/90 bg-black shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
            <div className="relative h-[calc(100svh-116px)] min-h-[560px] w-full overflow-hidden bg-black sm:h-[calc(100svh-120px)] md:h-[calc(100svh-132px)] xl:h-[calc(100vh-116px)] xl:min-h-[680px]">
              {!previewUrl && source === 'camera' ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`absolute inset-0 h-full w-full object-cover object-center [backface-visibility:hidden] ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />

                  {!cameraReady ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-zinc-400">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : null}
                </>
              ) : previewUrl ? (
                resolvedMediaType === 'image' ? (
                  <img
                    src={previewUrl}
                    alt="Captured preview"
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                ) : (
                  <video
                    src={previewUrl}
                    controls
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover object-center"
                  />
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-950 px-6 text-center">
                  <div className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-black text-zinc-400">
                    {cameraSupported ? (
                      <Upload className="h-7 w-7" />
                    ) : (
                      <CameraOff className="h-7 w-7" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-white">
                      {cameraSupported ? 'Upload media instead' : 'Camera unavailable'}
                    </p>
                    <p className="mt-2 text-sm leading-7 text-zinc-400">
                      {cameraSupported
                        ? 'Choose a photo or video directly from your device.'
                        : 'This browser or device cannot access the in-app camera. Upload media instead.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-2xl border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f3f3ff_100%)] px-5 py-3 text-sm font-semibold text-black transition hover:opacity-90"
                  >
                    Choose file
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept={
                  mode === 'photo'
                    ? 'image/jpeg,image/jpg,image/png,image/webp'
                    : 'video/webm,video/mp4,video/quicktime,video/x-m4v,video/3gpp,video/3gpp2,video/ogg'
                }
                className="hidden"
                onChange={handleUploadSelect}
              />

              {!previewUrl ? (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-black/90 via-black/20 to-transparent px-4 pb-4 pt-20">
                  <button
                    type="button"
                    onClick={() => {
                      if (source === 'camera') {
                        setFacingMode((current) =>
                          current === 'user' ? 'environment' : 'user'
                        )
                      } else {
                        fileInputRef.current?.click()
                      }
                    }}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  >
                    {source === 'camera' ? (
                      <ChevronsLeftRight className="h-5 w-5" />
                    ) : (
                      <ImagePlus className="h-5 w-5" />
                    )}
                  </button>

                  {source === 'camera' ? (
                    mode === 'photo' ? (
                      <button
                        type="button"
                        onClick={handleTakePhoto}
                        disabled={!cameraReady}
                        className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/10 text-white transition hover:scale-[1.02] disabled:opacity-60"
                      >
                        <Camera className="h-7 w-7" />
                      </button>
                    ) : !recording ? (
                      <button
                        type="button"
                        onClick={startVideoRecording}
                        disabled={!cameraReady}
                        className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/20 text-red-300 transition hover:scale-[1.02] disabled:opacity-60"
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
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex h-16 items-center justify-center gap-2 rounded-full border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f3f3ff_100%)] px-6 text-sm font-semibold text-black transition hover:opacity-90"
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setSource((current) => (current === 'camera' ? 'upload' : 'camera'))
                    }
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  >
                    {source === 'camera' ? (
                      <Upload className="h-5 w-5" />
                    ) : (
                      <Camera className="h-5 w-5" />
                    )}
                  </button>
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
                    disabled={publishing || (target === 'post' && !categoryId)}
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-full border border-white bg-[linear-gradient(90deg,#ffffff_0%,#f3f3ff_100%)] px-6 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60"
                  >
                    {publishing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Publishing
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Publish
                      </>
                    )}
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
            <section className="rounded-[26px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Capture mode
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMode('photo')
                    setRecording(false)
                  }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    mode === 'photo'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Photo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('video')
                    setRecording(false)
                  }}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    mode === 'video'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Video
                </button>
              </div>

              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Camera requests portrait or landscape constraints based on the screen and keeps the preview surface filled on phone and desktop.
              </p>
            </section>

            <section className="rounded-[26px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Publish target
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTarget('post')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    target === 'post'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Post
                </button>

                <button
                  type="button"
                  onClick={() => setTarget('story')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                    target === 'story'
                      ? 'border-white bg-white text-black'
                      : 'border-zinc-800 bg-black text-zinc-300 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  Story
                </button>
              </div>

              {target === 'post' ? (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-white">
                    Category
                  </label>

                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none"
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
            </section>

            <section className="rounded-[26px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
              <label className="mb-2 block text-sm font-medium text-white">
                Caption
              </label>

              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={6}
                placeholder="Write a caption..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
              />

              <div className="mt-4 rounded-2xl border border-zinc-800 bg-black px-4 py-4">
                <p className="text-sm font-medium text-white">Camera view behavior</p>
                <ul className="mt-3 space-y-2 text-sm text-zinc-400">
                  <li>• Front camera stays mirrored like a normal selfie preview.</li>
                  <li>• Live camera surface now fills the full visible frame.</li>
                  <li>• Upload fallback still stays available if capture is unstable.</li>
                </ul>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}