import Dexie from 'dexie'

export const db = new Dexie('InventarioCD')

db.version(1).stores({
  sessions: 'id, name, created_by, created_at, status',
  products: 'id, session_id, sku, [session_id+sku]',
  scans: '++id, session_id, product_id, sku, synced, created_at',
  settings: 'key',
})

export async function getSetting(key) {
  const row = await db.settings.get(key)
  return row?.value
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value })
}

const MAX_RECENT_SESSIONS = 5

export async function saveRecentSession(session) {
  const recent = (await getSetting('recentSessions')) || []
  const filtered = recent.filter((s) => s.id !== session.id)
  const updated = [
    { id: session.id, name: session.name, created_by: session.created_by, visited_at: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_RECENT_SESSIONS)
  await setSetting('recentSessions', updated)
}

export async function getRecentSessions() {
  return (await getSetting('recentSessions')) || []
}

export async function removeRecentSession(sessionId) {
  const recent = (await getSetting('recentSessions')) || []
  await setSetting('recentSessions', recent.filter((s) => s.id !== sessionId))
}
