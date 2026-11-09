export function isMariaPaz(name) {
  if (!name) return false
  const normalized = name.trim().toLowerCase()
  return normalized === 'maria paz maldonado' || normalized === 'maria paz'
}

export const mariaMessages = {
  welcome: 'Hola Maria Paz ❤️ Esta app también es para ti 💕',
  first_scan: '¡Primer escaneo, mi amor! ❤️ — Leo',
  streak_10: '¡Racha de 10! Eres increíble 😍 — Leo',
  top_scanner: '¡Líder del equipo! Como siempre, la mejor 👑❤️ — Leo',
  personal_record: '¡Nuevo récord! Me enorgulleces 😘 — Leo',
  lost_lead: 'No importa, para mí siempre eres la número 1 ❤️ — Leo',
  join: '¡A contar, mi amor! 💪❤️',
}

export const mariaTheme = {
  background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
  headerBg: 'linear-gradient(90deg, #d4af37 0%, #f4d03f 100%)',
  cardBg: '#ffffff',
  accent: '#d4af37',
  heart: '#e11d48',
}
