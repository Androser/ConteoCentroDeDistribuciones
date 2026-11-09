import { useEffect, useRef, useState } from 'react'
import { readBarcodesFromImageData } from 'zxing-wasm'
import { Zap, Hand, Camera, CameraOff } from 'lucide-react'

const INACTIVITY_TIMEOUT = 30000

function extractSku(code) {
  if (/^\d{13}$/.test(code) && code.startsWith('040')) {
    return code.slice(3, 12)
  }
  if (/^\d{12}$/.test(code) && code.startsWith('40')) {
    return code.slice(2, 11)
  }
  return code
}

export default function Scanner({ onScan }) {
  const [mode, setMode] = useState('burst')
  const [holding, setHolding] = useState(false)
  const [flash, setFlash] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(true)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const onScanRef = useRef(onScan)
  const modeRef = useRef(mode)
  const holdingRef = useRef(holding)
  const lastCountedSkuRef = useRef('')
  const absenceTimerRef = useRef(null)
  const inactivityTimerRef = useRef(null)
  const scanningRef = useRef(false)
  const streamRef = useRef(null)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    holdingRef.current = holding
    if (!holding && mode === 'precision') {
      lastCountedSkuRef.current = ''
    }
  }, [holding, mode])

  function resetInactivityTimer() {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    inactivityTimerRef.current = setTimeout(() => {
      stopCamera()
    }, INACTIVITY_TIMEOUT)
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = null
    }
  }

  function activateCamera() {
    setCameraActive(true)
    setCameraError('')
  }

  useEffect(() => {
    if (!cameraActive) return

    let animationId
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        resetInactivityTimer()
      } catch (err) {
        if (!cancelled) setCameraError('No se pudo acceder a la cámara: ' + err.message)
        return
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      async function scanFrame() {
        if (cancelled) return
        const video = videoRef.current
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
          animationId = requestAnimationFrame(scanFrame)
          return
        }

        if (modeRef.current === 'precision' && !holdingRef.current) {
          animationId = requestAnimationFrame(scanFrame)
          return
        }

        if (scanningRef.current) {
          animationId = requestAnimationFrame(scanFrame)
          return
        }

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        scanningRef.current = true
        try {
          const results = await readBarcodesFromImageData(imageData)
          if (results.length > 0 && !cancelled) {
            const rawCode = results[0].text
            const sku = extractSku(rawCode)

            resetInactivityTimer()

            if (absenceTimerRef.current) {
              clearTimeout(absenceTimerRef.current)
              absenceTimerRef.current = null
            }

            if (sku !== lastCountedSkuRef.current) {
              lastCountedSkuRef.current = sku
              setFlash('green')
              if (navigator.vibrate) navigator.vibrate(50)
              setTimeout(() => setFlash(null), 300)
              onScanRef.current(sku)
              if (modeRef.current === 'precision') setHolding(false)
            }
          } else if (!cancelled) {
            if (!absenceTimerRef.current) {
              absenceTimerRef.current = setTimeout(() => {
                lastCountedSkuRef.current = ''
                absenceTimerRef.current = null
              }, 1500)
            }
          }
        } catch {
          // Error decodificando este frame
        } finally {
          scanningRef.current = false
        }

        animationId = requestAnimationFrame(scanFrame)
      }

      scanFrame()
    }

    startCamera()

    return () => {
      cancelled = true
      cancelAnimationFrame(animationId)
      if (absenceTimerRef.current) clearTimeout(absenceTimerRef.current)
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
        streamRef.current = null
      }
    }
  }, [cameraActive])

  return (
    <div className="relative bg-black" style={{ height: '30vh', minHeight: '180px' }}>
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {!cameraActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900">
          <CameraOff size={40} className="mb-2 text-gray-400" />
          <p className="text-sm text-gray-400 mb-3">Cámara en reposo</p>
          <button
            onClick={activateCamera}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-xl"
          >
            <Camera size={18} /> Activar cámara
          </button>
        </div>
      )}

      {cameraActive && cameraError && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
          {cameraError}
        </div>
      )}

      {cameraActive && !cameraError && (
        <div
          className={`absolute inset-3 border-4 rounded-2xl pointer-events-none transition-colors duration-150 ${
            flash === 'green' ? 'border-green-400' : 'border-red-500'
          }`}
        />
      )}

      {cameraActive && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 flex bg-gray-900/80 rounded-full p-1 z-10">
          <button
            onClick={() => setMode('burst')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              mode === 'burst' ? 'bg-blue-600 text-white' : 'text-gray-300'
            }`}
          >
            <Zap size={14} /> Ráfaga
          </button>
          <button
            onClick={() => setMode('precision')}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
              mode === 'precision' ? 'bg-blue-600 text-white' : 'text-gray-300'
            }`}
          >
            <Hand size={14} /> Precisión
          </button>
        </div>
      )}

      {cameraActive && mode === 'precision' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
          <button
            onPointerDown={() => setHolding(true)}
            onPointerUp={() => setHolding(false)}
            onPointerLeave={() => setHolding(false)}
            className={`w-16 h-16 rounded-full border-4 border-white shadow-lg transition ${
              holding ? 'bg-red-700 scale-95' : 'bg-red-600'
            }`}
            aria-label="Mantener para escanear"
          />
        </div>
      )}
    </div>
  )
}
