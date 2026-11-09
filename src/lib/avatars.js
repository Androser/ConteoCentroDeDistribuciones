const AVATAR_STYLES = ['avataaars', 'bottts', 'adventurer', 'big-ears', 'croodles', 'fun-emoji', 'micah', 'miniavs']

export function getAvatarUrl(seed, style = 'avataaars') {
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

export function getAvatarOptions(name) {
  const base = name || 'user'
  return AVATAR_STYLES.map((style) => ({
    style,
    url: getAvatarUrl(`${base}-${style}`, style),
  }))
}

export const USER_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#9333ea',
  '#ea580c', '#0891b2', '#ca8a04', '#db2777',
]

export function getUserColor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length]
}
