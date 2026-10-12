'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createCameraSession, cameraFailureMessage, captureDimensions } from '@/components/camera/camera-session'
import { safeReturnPath } from '@/lib/routes/safe-return-path'
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
  const cameraSession = useRef<ReturnType<typeof createCameraSession> | null>(null)
  const captureBusy = useRef(false)
  const recordedBytes = useRef(0)
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
  const [cameraSuspended, setCameraSuspended] = useState(false)
  const [deviceId, setDeviceId] = useState('')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [previewFailed, setPreviewFailed] = useState(false)

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

    setCameraSupported(hasCameraApi && window.isSecureContext)

    if (!hasCameraApi || !window.isSecureContext) {
      setCameraError(!window.isSecureContext ? 'Camera access requires a secure HTTPS connection. Use upload instead.' : 'This browser/device does not support in-app camera access. Use upload instead.')
      setSource('upload')
      return
    }

    if (source === 'camera' && !capturedFile && !cameraSuspended && !document.hidden) {
      void startCamera()
    }

    return () => {
      stopCamera()
    }
  }, [facingMode, deviceId, source, mode, capturedFile, cameraSuspended])

  useEffect(() => {
    const hide = () => {
      if (document.hidden) {
        stopCamera()
        setCameraSuspended(true)
      }
    }
    const leave = () => { stopCamera(); setCameraSuspended(true) }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', leave)
    return () => {
      document.removeEventListener('visibilitychange', hide)
      window.removeEventListener('pagehide', leave)
    }
  }, [])

  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    setRecordingSeconds(0)
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000)
      setRecordingSeconds(seconds)
      if (seconds >= 60) stopVideoRecording()
    }, 250)
    return () => window.clearInterval(timer)
  }, [recording])

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
    recordedBytes.current = 0
    cameraSession.current?.close()
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
      cameraSession.current ??= createCameraSession(constraints => navigator.mediaDevices.getUserMedia(constraints))
      const stream = await cameraSession.current.open({
        audio: mode === 'video',
        video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facingMode } }), width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      if (!stream || generation !== cameraGeneration.current) return
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      if (generation !== cameraGeneration.current) return
      setCameraReady(true)
      const activeTrack = stream.getVideoTracks()[0]
      if (activeTrack) activeTrack.onended = () => {
        if (generation !== cameraGeneration.current) return
        stopCamera()
        setCameraError('The camera disconnected. Connect it and retry, or upload a file.')
      }
      try {
        const available = await navigator.mediaDevices.enumerateDevices()
        if (generation === cameraGeneration.current) setDevices(available.filter(device => device.kind === 'videoinput'))
      } catch { /* Capture can still work when device enumeration is restricted. */ }
    } catch (error) {
      if (generation !== cameraGeneration.current) return
      stopCamera()
      setCameraError(cameraFailureMessage(error))
    }
  }

  function clearCapture() {
    if (publishBusy.current) return
    mutationId.current = ''
    setCapturedFile(null)
    setPreviewFailed(false)
    setCameraError('')
    setPublishing(false)
  }

  async function handleTakePhoto() {
    const generation = cameraGeneration.current
    const video = videoRef.current
    if (!video || !cameraReady || captureBusy.current) return
    const size = captureDimensions(video.videoWidth, video.videoHeight)
    if (!size) { setCameraError('Wait for the camera preview before taking a photo.'); return }
    captureBusy.current = true
    try {
      const canvas = document.createElement('canvas')
      canvas.width = size.width
      canvas.height = size.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('capture')
      if (facingMode === 'user') {
        context.translate(canvas.width, 0)
        context.scale(-1, 1)
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
      canvas.width = 0
      canvas.height = 0
      if (generation !== cameraGeneration.current) return
      if (!blob) throw new Error('capture')
      const file = new File([blob], 'camera-photo-' + Date.now() + '.jpg', { type: 'image/jpeg' })
      mutationId.current = ''
      stopCamera()
      setPreviewFailed(false)
      setCapturedFile(file)
    } catch {
      if (generation === cameraGeneration.current) setCameraError('The photo could not be captured. Please try again.')
    } finally { captureBusy.current = false }
  }

  function startVideoRecording() {
    const stream = streamRef.current
    if (!stream || recorderRef.current || recording) return
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
    try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000, audioBitsPerSecond: 128_000 }) } catch {
      setCameraError('Video recording could not start. Use upload instead.')
      return
    }
    chunksRef.current = []
    recordedBytes.current = 0

    recorder.ondataavailable = (event) => {
      if (generation === cameraGeneration.current && event.data.size > 0) {
        chunksRef.current.push(event.data)
        recordedBytes.current += event.data.size
        if (recordedBytes.current >= 40 * 1024 * 1024 && recorder.state === 'recording') recorder.stop()
      }
    }

    recorder.onstop = () => {
      if (generation !== cameraGeneration.current || recorderRef.current !== recorder) return
      recorderRef.current = null
      const type = mimeType.split(';')[0]
      const blob = new Blob(chunksRef.current, { type })
      const file = new File([blob], `camera-video-${Date.now()}.${type === 'video/mp4' ? 'mp4' : 'webm'}`, { type })

      mutationId.current = ''
      stopCamera()
      if (!blob.size || blob.size > 45 * 1024 * 1024) {
        setCameraError('The recording could not be used. Try a shorter video.'); return
      }
      setPreviewFailed(false)
      setCapturedFile(file)
      setRecording(false)
    }

    recorderRef.current = recorder
    recorder.onerror = () => {
      if (recorderRef.current !== recorder) return
      stopCamera()
      setCameraError('Video recording failed. Use upload instead.')
    }
    try { recorder.start(1000); setRecording(true) } catch {
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

    if (!file.size || file.size > (mode === 'photo' ? 12 : 45) * 1024 * 1024) {
      setCameraError(mode === 'photo' ? 'Choose a photo up to 12 MB.' : 'Choose a video up to 45 MB.'); event.target.value = ''; return
    }
    stopCamera()
    setCameraError('')
    setPreviewFailed(false)
    mutationId.current = ''
    setCapturedFile(file)
  }

  async function handlePublish() {
    if (!capturedFile || previewFailed || publishBusy.current) return
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

      stopCamera()
      router.push(safeReturnPath(payload.redirectTo || payload.redirectUrl || returnTo))
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
            onClick={() => { stopCamera(); router.push(safeReturnPath(returnTo)) }}
            disabled={publishing}
            className="rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm font-medium text-zinc-300 transition hover:border-zinc-700 hover:text-white"
          >
            Back
          </button>

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
            Camera studio
          </div>
        </div>

        {cameraError ? (
          <div role="alert" className="rounded-2xl border border-red-900/40 bg-red-950/25 px-4 py-3 text-sm text-red-100">
            {cameraError}
          </div>
        ) : null}
        {source === 'camera' && !capturedFile && (cameraError || cameraSuspended) ? (
          <div className="flex flex-wrap items-center gap-3">
            {cameraSuspended ? <p role="status" className="text-sm text-zinc-300">Camera stopped while the page was in the background.</p> : null}
            {cameraSupported ? <button type="button" className="rs-button" onClick={() => { if (cameraSuspended) setCameraSuspended(false); else void startCamera() }}>Retry camera</button> : null}
            <button type="button" className="rs-button" onClick={() => setSource('upload')}>Upload instead</button>
          </div>
        ) : null}

        <div className="grid flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-5">
          <section className="overflow-hidden rounded-[26px] border border-zinc-800/90 bg-black shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
            <div className="relative h-[min(72svh,760px)] min-h-[320px] w-full overflow-hidden bg-black">
              {!previewUrl && source === 'camera' ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    aria-label="Live camera preview"
                    className={`absolute inset-0 h-full w-full object-contain object-center [backface-visibility:hidden] ${
                      facingMode === 'user' ? 'scale-x-[-1]' : ''
                    }`}
                  />

                  {!cameraReady && !cameraError && !cameraSuspended ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-zinc-400">
                      <Loader2 aria-label="Starting camera" className="h-6 w-6 motion-safe:animate-spin" />
                    </div>
                  ) : null}
                </>
              ) : previewUrl ? (
                resolvedMediaType === 'image' ? (
                  <img
                    src={previewUrl}
                    alt="Captured photo preview"
                    onError={() => { setPreviewFailed(true); setCameraError('This photo could not be previewed. Choose another file.') }}
                    className="absolute inset-0 h-full w-full object-contain object-center"
                  />
                ) : (
                  <video
                    src={previewUrl}
                    onError={() => { setPreviewFailed(true); setCameraError('This video could not be previewed. Choose a supported file.') }}
                    controls
                    playsInline
                    className="absolute inset-0 h-full w-full object-contain object-center"
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
                    aria-label={source === 'camera' ? 'Switch front or rear camera' : 'Choose another file'}
                    disabled={recording}
                    onClick={() => {
                      if (source === 'camera') {
                        setDeviceId('')
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
                        aria-label="Take photo"
                        onClick={handleTakePhoto}
                        disabled={!cameraReady}
                        className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/10 text-white transition hover:scale-[1.02] disabled:opacity-60"
                      >
                        <Camera className="h-7 w-7" />
                      </button>
                    ) : !recording ? (
                      <button
                        type="button"
                        aria-label="Start video recording"
                        onClick={startVideoRecording}
                        disabled={!cameraReady}
                        className="inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-red-500 bg-red-500/20 text-red-300 transition hover:scale-[1.02] disabled:opacity-60"
                      >
                        <Circle className="h-7 w-7 fill-current" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        aria-label="Stop video recording"
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
                    aria-label={source === 'camera' ? 'Use upload' : 'Use camera'}
                    disabled={!cameraSupported && source === 'upload'}
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
                    aria-label="Retake or replace media"
                    disabled={publishing}
                    onClick={clearCapture}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  >
                    <RotateCcw className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={handlePublish}
                    disabled={publishing || previewFailed || (target === 'post' && !categoryId) || caption.length > (target === 'story' ? 180 : 280)}
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
                    aria-label="Discard capture"
                    disabled={publishing}
                    onClick={clearCapture}
                    className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white transition hover:bg-black/75"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
          </section>

          <aside className="min-w-0 space-y-5">
            {recording ? <p role="status" className="text-sm text-red-300">Recording · {recordingSeconds}s / 60s</p> : null}
            {devices.length > 1 && source === 'camera' && !capturedFile ? <div>
              <label htmlFor="camera-device" className="mb-2 block text-sm font-medium">Camera device</label>
              <select id="camera-device" value={deviceId} disabled={recording} onChange={event => setDeviceId(event.target.value)} className="rs-input">
                <option value="">Automatic front/rear selection</option>
                {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || 'Camera ' + (index + 1)}</option>)}
              </select>
            </div> : null}
            <section className="rounded-[26px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Capture mode
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={Boolean(capturedFile) || recording || publishing}
                  aria-pressed={mode === 'photo'}
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
                  disabled={Boolean(capturedFile) || recording || publishing}
                  aria-pressed={mode === 'video'}
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
            </section>

            <section className="rounded-[26px] border border-zinc-800/90 bg-[linear-gradient(180deg,rgba(18,18,24,0.98),rgba(8,8,10,0.98))] p-4 shadow-[0_14px_32px_rgba(0,0,0,0.20)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Publish target
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={target === 'post'}
                  disabled={publishing}
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
                  aria-pressed={target === 'story'}
                  disabled={publishing}
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
                  <label htmlFor="camera-category" className="mb-2 block text-sm font-medium text-white">
                    Category
                  </label>

                  <select
                    id="camera-category"
                    disabled={publishing}
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
              <label htmlFor="camera-caption" className="mb-2 block text-sm font-medium text-white">
                Caption
              </label>

              <textarea
                id="camera-caption"
                disabled={publishing}
                aria-describedby="camera-caption-length"
                maxLength={target === 'story' ? 180 : 280}
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                rows={6}
                placeholder="Write a caption..."
                className="w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
              />
              <p id="camera-caption-length" className="mt-2 text-xs text-zinc-400">{caption.length} / {target === 'story' ? 180 : 280} characters</p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  )
}
