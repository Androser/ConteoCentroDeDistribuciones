import { getUserColor } from '../lib/avatars'

export default function ActivityFeed({ activities }) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4 pointer-events-none">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className="bg-white/95 backdrop-blur rounded-xl shadow-lg px-4 py-2.5 mb-2 flex items-center gap-2 animate-feed-in-out"
        >
          {activity.user_avatar ? (
            <img
              src={activity.user_avatar}
              alt={activity.user_name}
              className="w-7 h-7 rounded-full shrink-0"
            />
          ) : (
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
              style={{ backgroundColor: getUserColor(activity.user_name) }}
            >
              {activity.user_name.charAt(0).toUpperCase()}
            </span>
          )}
          <p className="text-sm text-gray-800 flex-1 min-w-0">
            <span className="font-semibold">{activity.user_name}</span>
            {' '}sumó {activity.delta > 0 ? `+${activity.delta}` : activity.delta}
            {activity.size && <span className="text-gray-500"> · {activity.size}{activity.stile ? `/${activity.stile}` : ''}</span>}
          </p>
        </div>
      ))}
    </div>
  )
}
