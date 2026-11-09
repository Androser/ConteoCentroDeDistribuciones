import { getUserColor } from '../lib/avatars'

const MEDALS = ['🥇', '🥈', '🥉']

export default function SessionRanking({ ranking, currentUser }) {
  if (ranking.length === 0) return null

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-3 mb-3 border border-amber-200">
      <h3 className="text-sm font-bold text-amber-800 mb-2 text-center">Ranking del equipo</h3>
      <div className="space-y-1.5">
        {ranking.slice(0, 5).map((user, index) => (
          <div
            key={user.user_name}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${
              user.user_name === currentUser ? 'bg-amber-200/60 ring-1 ring-amber-400' : 'bg-white/60'
            } transition-all`}
          >
            <span className="text-lg w-6 text-center">{MEDALS[index] || `${index + 1}°`}</span>
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: getUserColor(user.user_name) }}
            >
              {user.user_name.charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 text-sm font-medium text-gray-800 truncate">
              {user.user_name}
              {user.user_name === currentUser && <span className="text-amber-600 text-xs ml-1">(tú)</span>}
            </span>
            <span className="font-bold text-amber-700">{user.total}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
