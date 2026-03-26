import './App.css'
import { useEffect, useMemo, useRef, useState } from 'react'

function App() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<
    'idle' | 'starting' | 'live' | 'captured' | 'error'
  >('idle')
  const [error, setError] = useState<string | null>(null)

  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  const canUseCameraApi =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    window.isSecureContext

  useEffect(() => {
    if (!photoBlob) return
    const url = URL.createObjectURL(photoBlob)
    setPhotoUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [photoBlob])

  async function startCamera() {
    setError(null)
    setStatus('starting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })

      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Video element not ready')

      video.srcObject = stream
      await video.play()
      setStatus('live')
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Unable to access camera'
      setError(message)
      setStatus('error')
    }
  }

  function stopCamera() {
    const stream = streamRef.current
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
    }
    streamRef.current = null
    const video = videoRef.current
    if (video) video.srcObject = null
    if (status === 'live' || status === 'starting') setStatus('idle')
  }

  useEffect(() => stopCamera, [])

  const supportsImageCaptureFallback = useMemo(() => {
    return (
      typeof document !== 'undefined' &&
      (() => {
        const input = document.createElement('input')
        input.type = 'file'
        return 'capture' in input
      })()
    )
  }, [])

  async function captureFromVideo() {
    const video = videoRef.current
    if (!video) return
    if (video.readyState < 2) {
      setError('Camera is not ready yet. Try again in a moment.')
      setStatus('error')
      return
    }

    const canvas = document.createElement('canvas')
    const w = video.videoWidth || 1280
    const h = video.videoHeight || 720
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      setError('Canvas is not supported in this browser.')
      setStatus('error')
      return
    }

    ctx.drawImage(video, 0, 0, w, h)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.9),
    )
    if (!blob) {
      setError('Failed to capture image.')
      setStatus('error')
      return
    }

    setPhotoBlob(blob)
    setStatus('captured')
  }

  function onPickFileClick() {
    setError(null)
    fileInputRef.current?.click()
  }

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    e.target.value = ''
    if (!file) return

    setError(null)
    setPhotoBlob(file)
    setStatus('captured')
  }

  function clearPhoto() {
    setError(null)
    setPhotoBlob(null)
    setStatus(streamRef.current ? 'live' : 'idle')
  }

  return (
    <main className="page">
      <header className="header">
        <h1>Camera Capture POC</h1>
        <p className="subtitle">
          Capture a photo in a mobile browser and get a <code>Blob</code> you can
          upload.
        </p>
      </header>

      <section className="card">
        <div className="row">
          <button
            type="button"
            className="btn primary"
            onClick={startCamera}
            disabled={!canUseCameraApi || status === 'starting' || status === 'live'}
          >
            Start camera
          </button>
          <button
            type="button"
            className="btn"
            onClick={stopCamera}
            disabled={status !== 'live' && status !== 'starting'}
          >
            Stop
          </button>
          <button
            type="button"
            className="btn"
            onClick={captureFromVideo}
            disabled={status !== 'live'}
          >
            Capture
          </button>
        </div>

        <div className="preview">
          <video
            ref={videoRef}
            className="video"
            playsInline
            muted
            autoPlay
          />
        </div>

        <div className="row">
          <button
            type="button"
            className="btn"
            onClick={onPickFileClick}
            disabled={!supportsImageCaptureFallback}
          >
            Take photo (fallback)
          </button>
          <input
            ref={fileInputRef}
            className="hiddenInput"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onFilePicked}
          />
          <button
            type="button"
            className="btn danger"
            onClick={clearPhoto}
            disabled={!photoBlob}
          >
            Clear photo
          </button>
        </div>

        {!window.isSecureContext && (
          <p className="hint">
            Camera APIs require HTTPS (or <code>localhost</code>). Use a secure
            tunnel (ngrok/cloudflared) when testing on a real phone.
          </p>
        )}

        {error && <p className="error">Error: {error}</p>}
      </section>

      <section className="card">
        <h2>Captured image</h2>
        {!photoBlob && <p className="muted">No photo captured yet.</p>}
        {photoBlob && (
          <>
            <div className="photoWrap">
              {photoUrl && <img className="photo" src={photoUrl} alt="Captured" />}
            </div>
            <div className="meta">
              <div>
                <div className="k">type</div>
                <div className="v">{photoBlob.type || '(unknown)'}</div>
              </div>
              <div>
                <div className="k">size</div>
                <div className="v">{photoBlob.size.toLocaleString()} bytes</div>
              </div>
              <div>
                <div className="k">upload</div>
                <div className="v">
                  Ready: <code>FormData.append('image', blob, 'photo.jpg')</code>
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default App
