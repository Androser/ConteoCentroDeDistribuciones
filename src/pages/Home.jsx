import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, QrCode, Upload, User } from 'lucide-react'
import { createSession } from '../lib/session'
import { getSetting, setSetting } from '../lib/db'

export default function Home() {
  const navigate = useNavigate()
  const [userName, setUserName] = useState('')
  const [sessionName, setSessionName] = useState('')
  const [joinId, setJoinId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSetting('userName').then((name) => {
      if (name) setUserName(name)
    })
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
      navigate(`/session/${joinId.trim()}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
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

        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700 mb-1 block">Unirse a una sesión</span>
          <input
            type="text"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="Pega el código de sesión"
            className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>
        <button
          onClick={handleJoin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 px-4 rounded-xl transition"
        >
          <QrCode size={20} />
          Unirse a Sesión
        </button>

        <p className="text-xs text-gray-400 text-center mt-6">
          <Upload size={12} className="inline mr-1" />
          El Excel se importa dentro de cada sesión
        </p>
      </div>
    </div>
  )
}
