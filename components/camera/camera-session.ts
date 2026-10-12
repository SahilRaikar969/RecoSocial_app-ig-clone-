/** Each studio owns one session. A superseded permission request must release its tracks. */
export function createCameraSession(request: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
  let generation = 0
  let current: MediaStream | null = null
  function close() {
    generation += 1
    current?.getTracks().forEach(track => track.stop())
    current = null
  }
  return {
    close,
    async open(constraints: MediaStreamConstraints) {
      close()
      const attempt = generation
      try {
        const stream = await request(constraints)
        if (attempt !== generation) {
          stream.getTracks().forEach(track => track.stop())
          return null
        }
        current = stream
        return stream
      } catch (error) {
        if (attempt !== generation) return null
        throw error
      }
    },
  }
}

export function cameraFailureMessage(error: unknown) {
  const name = typeof error === 'object' && error !== null && 'name' in error ? error.name : ''
  switch (name) {
    case 'NotAllowedError': case 'PermissionDeniedError':
      return 'Camera or microphone permission is blocked. Allow access in your browser site settings, then retry. You can also upload a file.'
    case 'NotFoundError': case 'DevicesNotFoundError':
      return 'No camera was found. Connect a camera or upload a file.'
    case 'NotReadableError': case 'TrackStartError':
      return 'The camera is busy or unavailable. Close other camera apps, then retry.'
    case 'OverconstrainedError':
      return 'The selected camera is unavailable. Choose another camera or upload a file.'
    case 'SecurityError':
      return 'This browser has disabled camera access. Check site permissions or upload a file.'
    default:
      return 'The camera could not start. Retry or upload a file.'
  }
}

/** Keep the device orientation while bounding the longest captured edge. */
export function captureDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const scale = Math.min(1, 1920 / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}
