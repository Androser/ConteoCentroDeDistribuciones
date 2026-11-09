import { supabase } from './supabase'
import { db } from './db'

export async function createSession(name, userName) {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ name, created_by: userName })
    .select()
    .single()
  if (error) throw error
  await db.sessions.put(data)
  return data
}

export async function getSession(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single()
  if (error) throw error
  await db.sessions.put(data)
  return data
}

export async function getProducts(sessionId) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('session_id', sessionId)
    .order('product_name')
  if (error) throw error
  await db.products.bulkPut(data)
  return data
}

export async function importProducts(sessionId, products) {
  const rows = products.map((p) => ({ ...p, session_id: sessionId, conteo: 0 }))
  const { error } = await supabase.from('products').upsert(rows, {
    onConflict: 'session_id,sku',
  })
  if (error) throw error
  return getProducts(sessionId)
}

export async function addScan(sessionId, sku, delta, userName) {
  const { data: product, error: findError } = await supabase
    .from('products')
    .select('*')
    .eq('session_id', sessionId)
    .eq('sku', sku)
    .single()

  if (findError && findError.code !== 'PGRST116') throw findError
  if (!product) return null

  const newConteo = Math.max(0, (product.conteo || 0) + delta)
  const { error: updateError } = await supabase
    .from('products')
    .update({ conteo: newConteo })
    .eq('id', product.id)
  if (updateError) throw updateError

  const { error: scanError } = await supabase.from('scans').insert({
    session_id: sessionId,
    product_id: product.id,
    sku,
    delta,
    user_name: userName,
  })
  if (scanError) throw scanError

  return { ...product, conteo: newConteo }
}

export async function createQuickProduct(sessionId, product, userName) {
  const { data, error } = await supabase
    .from('products')
    .insert({ ...product, session_id: sessionId, conteo: 1 })
    .select()
    .single()
  if (error) throw error
  await supabase.from('scans').insert({
    session_id: sessionId,
    product_id: data.id,
    sku: data.sku,
    delta: 1,
    user_name: userName,
  })
  return data
}

export function subscribeToSession(sessionId, onProductsChange) {
  const channel = supabase
    .channel(`session:${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products', filter: `session_id=eq.${sessionId}` },
      () => onProductsChange(),
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeToScans(sessionId, onNewScan) {
  const channel = supabase
    .channel(`scans:${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'scans', filter: `session_id=eq.${sessionId}` },
      (payload) => onNewScan(payload.new),
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export async function getRecentScans(sessionId, limit = 10) {
  const { data, error } = await supabase
    .from('scans')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

export async function getSessionRanking(sessionId) {
  const { data, error } = await supabase
    .from('scans')
    .select('user_name, delta')
    .eq('session_id', sessionId)
  if (error) throw error
  const ranking = {}
  for (const scan of data) {
    ranking[scan.user_name] = (ranking[scan.user_name] || 0) + scan.delta
  }
  return Object.entries(ranking)
    .map(([user_name, total]) => ({ user_name, total }))
    .sort((a, b) => b.total - a.total)
}

export async function undoLastScan(sessionId, userName) {
  const { data: lastScan, error } = await supabase
    .from('scans')
    .select('*')
    .eq('session_id', sessionId)
    .eq('user_name', userName)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error || !lastScan) return null

  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', lastScan.product_id)
    .single()
  if (!product) return null

  const newConteo = Math.max(0, (product.conteo || 0) - lastScan.delta)
  await supabase.from('products').update({ conteo: newConteo }).eq('id', product.id)
  await supabase.from('scans').delete().eq('id', lastScan.id)
  return { ...product, conteo: newConteo }
}
