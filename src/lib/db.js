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
