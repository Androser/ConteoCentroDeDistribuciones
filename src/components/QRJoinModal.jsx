import { useEffect, useRef, useState } from 'react'
import { readBarcodesFromImageData } from 'zxing-wasm'
import { X } from 'lucide-react'

export default function QRJoinModal({ onJoin, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const [error, setError] = useState('')
  const scanningRef = useRef(false)
  const joinedRef = useRef(false)

  useEffect(() => {
    let stream
    let animationId
    let cancelled = false

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
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
        if (!cancelled) setError('No se pudo acceder a la cámara: ' + err.message)
        return
      }

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d', { willReadFrequently: true })

      async function scanFrame() {
        if (cancelled || joinedRef.current) return
        const video = videoRef.current
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
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
          if (results.length > 0 && !cancelled && !joinedRef.current) {
            const text = results[0].text
            const match = text.match(/\/session\/([a-f0-9-]+)/i)
            const sessionId = match ? match[1] : text
            if (/^[a-f0-9-]{36}$/i.test(sessionId)) {
              joinedRef.current = true
              if (navigator.vibrate) navigator.vibrate(50)
              onJoin(sessionId)
              return
            } else {
              setError('El QR no contiene un código de sesión válido')
            }
          }
        } catch {
          // Sin QR en este frame
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
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [onJoin])

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="font-bold text-lg">Escanear QR de sesión</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={24} />
          </button>
        </div>
        <div className="relative bg-black" style={{ height: '50vh' }}>
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-8 border-4 border-green-400 rounded-2xl pointer-events-none" />
        </div>
        <p className="p-4 text-center text-sm text-gray-600">
          {error || 'Apunta la cámara al QR de la sesión'}
        </p>
      </div>
    </div>
  )
}
