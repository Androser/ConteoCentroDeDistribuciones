import { useEffect, useRef, useState } from 'react'
import { readBarcodesFromImageData } from 'zxing-wasm'
import { Zap, Hand } from 'lucide-react'

function extractSku(code) {
  // EAN-13: 040 + 9 dígitos SKU + verificador
  if (/^\d{13}$/.test(code) && code.startsWith('040')) {
    return code.slice(3, 12)
  }
  // UPC-A: 40 + 9 dígitos SKU + verificador
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
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const onScanRef = useRef(onScan)
  const modeRef = useRef(mode)
  const holdingRef = useRef(holding)
  const lastCountedSkuRef = useRef('')
  const absenceTimerRef = useRef(null)
  const scanningRef = useRef(false)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  useEffect(() => {
    modeRef.current = mode
  }, [mode])

  useEffect(() => {
    holdingRef.current = holding
    // En modo precisión, soltar el botón permite contar de nuevo el mismo SKU
    if (!holding && mode === 'precision') {
      lastCountedSkuRef.current = ''
    }
  }, [holding, mode])

  useEffect(() => {
    let stream
    let animationId
    let cancelled = false

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
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

            // Reiniciar temporizador de ausencia: el código sigue en vista
            if (absenceTimerRef.current) {
              clearTimeout(absenceTimerRef.current)
              absenceTimerRef.current = null
            }

            // Solo contar si es un SKU distinto al último contado
            if (sku !== lastCountedSkuRef.current) {
              lastCountedSkuRef.current = sku
              setFlash('green')
              if (navigator.vibrate) navigator.vibrate(50)
              setTimeout(() => setFlash(null), 300)
              onScanRef.current(sku)
              if (modeRef.current === 'precision') setHolding(false)
            }
          } else if (!cancelled) {
            // Sin código en este frame: si pasa 1.5s sin detectar, permitir recontar el mismo SKU
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
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  return (
    <div className="relative bg-black" style={{ height: '40vh' }}>
      <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {cameraError ? (
        <div className="absolute inset-0 flex items-center justify-center text-white text-center p-4">
          {cameraError}
        </div>
      ) : (
        <div
          className={`absolute inset-4 border-4 rounded-2xl pointer-events-none transition-colors duration-150 ${
            flash === 'green' ? 'border-green-400' : 'border-red-500'
          }`}
        />
      )}

      <div className="absolute top-3 left-1/2 -translate-x-1/2 flex bg-gray-900/80 rounded-full p-1 z-10">
        <button
          onClick={() => setMode('burst')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
            mode === 'burst' ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
        >
          <Zap size={14} /> Ráfaga
        </button>
        <button
          onClick={() => setMode('precision')}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium ${
            mode === 'precision' ? 'bg-blue-600 text-white' : 'text-gray-300'
          }`}
        >
          <Hand size={14} /> Precisión
        </button>
      </div>

      {mode === 'precision' && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onPointerDown={() => setHolding(true)}
            onPointerUp={() => setHolding(false)}
            onPointerLeave={() => setHolding(false)}
            className={`w-20 h-20 rounded-full border-4 border-white shadow-lg transition ${
              holding ? 'bg-red-700 scale-95' : 'bg-red-600'
            }`}
            aria-label="Mantener para escanear"
          />
        </div>
      )}
    </div>
  )
}
