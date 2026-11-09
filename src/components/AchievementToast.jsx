import { useEffect } from 'react'
import confetti from 'canvas-confetti'
import { Trophy, Zap, Crown, TrendingUp, Heart } from 'lucide-react'
import { isMariaPaz, mariaMessages } from '../lib/specialMode'

const ACHIEVEMENTS = {
  first_scan: { icon: Zap, title: '¡Primer escaneo!', color: 'from-blue-500 to-blue-600' },
  streak_10: { icon: Trophy, title: '¡Racha de 10!', color: 'from-amber-500 to-orange-500' },
  top_scanner: { icon: Crown, title: '¡Líder del equipo!', color: 'from-purple-500 to-purple-600' },
  personal_record: { icon: TrendingUp, title: '¡Nuevo récord personal!', color: 'from-green-500 to-green-600' },
  lost_lead: { icon: Crown, title: 'Te quitaron el liderazgo', color: 'from-gray-500 to-gray-600' },
}

export default function AchievementToast({ achievement, onClose, userName }) {
  const specialMode = isMariaPaz(userName)

  useEffect(() => {
    if (achievement && achievement.type !== 'lost_lead') {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: specialMode
          ? ['#d4af37', '#e11d48', '#f4d03f', '#ff69b4', '#ffffff']
          : ['#2563eb', '#16a34a', '#eab308', '#dc2626', '#9333ea'],
      })
    }
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [achievement, onClose, specialMode])

  if (!achievement) return null
  const config = ACHIEVEMENTS[achievement.type]
  const Icon = specialMode ? Heart : config.icon
  const message = specialMode ? mariaMessages[achievement.type] : achievement.message
  const color = specialMode ? 'from-yellow-500 to-red-500' : config.color

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className={`bg-gradient-to-r ${color} text-white rounded-2xl shadow-2xl px-6 py-5 flex items-center gap-4 animate-slide-up pointer-events-auto`}>
        <div className="bg-white/20 rounded-full p-3">
          <Icon size={32} />
        </div>
        <div>
          <p className="text-xl font-bold">{specialMode ? '❤️' : config.title}</p>
          {message && <p className="text-white/90 text-sm">{message}</p>}
        </div>
      </div>
    </div>
  )
}
