import { useEffect, useState } from 'react'
import { X, Users } from 'lucide-react'
import { getAvatarOptions, getUserColor } from '../lib/avatars'
import { getSession, getRecentScans } from '../lib/session'
import { getSetting, setSetting } from '../lib/db'

export default function JoinSessionModal({ sessionId, onJoin, onClose }) {
  const [session, setSession] = useState(null)
  const [userName, setUserName] = useState('')
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [avatarOptions, setAvatarOptions] = useState([])
  const [activeUsers, setActiveUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getSession(sessionId), getRecentScans(sessionId, 50), getSetting('userName'), getSetting('userAvatar')])
      .then(([s, scans, name, avatar]) => {
        setSession(s)
        if (name) setUserName(name)
        const uniqueUsers = [...new Set(scans.map((sc) => sc.user_name))]
        setActiveUsers(uniqueUsers)
        if (avatar) setSelectedAvatar(avatar)
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  useEffect(() => {
    if (userName.trim()) {
      setAvatarOptions(getAvatarOptions(userName.trim()))
    } else {
      setAvatarOptions(getAvatarOptions('default'))
    }
  }, [userName])

  async function handleJoin() {
    if (!userName.trim()) return
    const avatar = selectedAvatar || avatarOptions[0]?.url || ''
    await setSetting('userName', userName.trim())
    await setSetting('userAvatar', avatar)
    onJoin(userName.trim(), avatar)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 text-center">Cargando sesión...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden animate-slide-up shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-3 right-3 text-white/70 hover:text-white">
            <X size={22} />
          </button>
          <p className="text-blue-200 text-sm mb-1">Te estás uniendo a</p>
          <h2 className="text-2xl font-bold">{session?.name}</h2>
          {activeUsers.length > 0 && (
            <div className="flex items-center justify-center gap-1 mt-3 text-blue-100 text-sm">
              <Users size={16} />
              <span>{activeUsers.length} {activeUsers.length === 1 ? 'persona' : 'personas'} contando</span>
            </div>
          )}
        </div>

        <div className="p-5">
          <label className="block mb-4">
            <span className="text-sm font-medium text-gray-700 mb-1 block">Tu nombre</span>
            <input
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder="¿Cómo te llamas?"
              autoFocus
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 text-lg"
            />
          </label>

          <p className="text-sm font-medium text-gray-700 mb-2">Elige tu avatar</p>
          <div className="grid grid-cols-4 gap-2 mb-5">
            {avatarOptions.map((opt) => (
              <button
                key={opt.style}
                onClick={() => setSelectedAvatar(opt.url)}
                className={`rounded-xl p-1 border-2 transition-all ${
                  selectedAvatar === opt.url ? 'border-blue-500 scale-105 shadow-md' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <img src={opt.url} alt={opt.style} className="w-full h-auto rounded-lg" />
              </button>
            ))}
          </div>

          <button
            onClick={handleJoin}
            disabled={!userName.trim()}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-300 disabled:to-gray-300 text-white font-bold py-4 rounded-xl text-lg transition-all active:scale-95 shadow-lg"
          >
            Unirme al conteo
          </button>
        </div>
      </div>
    </div>
  )
}
