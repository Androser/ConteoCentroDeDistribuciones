import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, QrCode, Upload, User, History, X, ScanLine } from 'lucide-react'
import { createSession } from '../lib/session'
import { getSetting, setSetting, getRecentSessions, removeRecentSession } from '../lib/db'
import QRJoinModal from '../components/QRJoinModal'

export default function Home() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [joinId, setJoinId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [recentSessions, setRecentSessions] = useState([])
  const [showQRScanner, setShowQRScanner] = useState(false)

  useEffect(() => {
    getSetting('userName').then((name) => {
      if (name) setUserName(name)
    })
    getRecentSessions().then(setRecentSessions)
  }, [])

  async function handleCreate() {
    if (!userName.trim()) return setError('Escribe tu nombre')
    if (!sessionName.trim()) return setError('Escribe un nombre para la sesión')
    setLoading(true)
    setError('')
    try {
      await setSetting('userName', userName.trim())
      const session = await createSession(sessionName.trim(), userName.trim())
      navigate(`/session/${session.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!userName.trim()) return setError('Escribe tu nombre')
    if (!joinId.trim()) return setError('Pega el código de la sesión')
    setLoading(true)
    setError('')
    try {
      await setSetting('userName', userName.trim())
      let sessionId = joinId.trim()
      const urlMatch = sessionId.match(/\/session\/([a-f0-9-]+)/i)
      if (urlMatch) sessionId = urlMatch[1]
      navigate(`/session/${sessionId}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleQRJoin(sessionId) {
    if (!userName.trim()) {
      setShowQRScanner(false)
      setError('Escribe tu nombre antes de escanear')
      return
    }
    await setSetting('userName', userName.trim())
    setShowQRScanner(false)
    navigate(`/session/${sessionId}`)
  }

  async function handleRemoveRecent(e, sessionId) {
    e.stopPropagation()
    await removeRecentSession(sessionId)
    setRecentSessions(await getRecentSessions())
  }

  function formatDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-800 text-center mb-1">Inventario CD</h1>
        <p className="text-gray-500 text-center mb-6">Centro de Distribución - Bogotá</p>

        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

        <label className="block mb-4">
          <span className="text-sm font-medium text-gray-700 flex items-center gap-1 mb-1">
            <User size={16} /> Tu nombre
          </span>
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Ej. María"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        {recentSessions.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center gap-1 text-sm font-medium text-gray-700 mb-2">
              <History size={16} /> Conteos recientes
            </div>
            <div className="space-y-2">
              {recentSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => navigate(`/session/${s.id}`)}
                  className="flex items-center justify-between bg-gray-50 hover:bg-blue-50 border border-gray-200 rounded-xl px-4 py-3 cursor-pointer transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(s.visited_at)}</p>
                  </div>
                  <button
                    onClick={(e) => handleRemoveRecent(e, s.id)}
                    className="ml-2 text-gray-400 hover:text-red-500 p-1"
                    aria-label="Quitar de recientes"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="border-t border-gray-200 my-5" />
          </div>
        )}

        <div className="border-t border-gray-200 my-5" />

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 mb-1 block">Nueva sesión de conteo</span>
          <input
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Ej. Prendas Bloque A"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold py-3 px-4 rounded-xl transition mb-5"
        >
          <Plus size={20} />
          Crear Sesión
        </button>

        <div className="border-t border-gray-200 my-5" />

        <div className="mb-3">
          <span className="text-sm font-medium text-gray-700 mb-1 block">Unirse a una sesión</span>
          <button
            onClick={() => setShowQRScanner(true)}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-xl transition mb-3"
          >
            <ScanLine size={20} />
            Escanear QR de Sesión
          </button>
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 border-t border-gray-300" />
            <span className="text-xs text-gray-400">o pega el código</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>
          <input
            type="text"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Código de sesión o URL"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-800 font-semibold py-3 px-4 rounded-xl transition"
        >
          <QrCode size={20} />
          Unirse con Código
        </button>

        <p className="text-xs text-gray-400 text-center mt-6">
          <Upload size={12} className="inline mr-1" />
          El Excel se importa dentro de cada sesión
        </p>
      </div>

      {showQRScanner && (
        <QRJoinModal onJoin={handleQRJoin} onClose={() => setShowQRScanner(false)} />
      )}
    </div>
  )
}
