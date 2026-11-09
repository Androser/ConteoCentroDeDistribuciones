import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Upload, Download, Minus, Plus, X, Wifi, WifiOff, List, Undo2, Check, Users, Sparkles } from 'lucide-react'
import Scanner from '../components/Scanner'
import ActivityFeed from '../components/ActivityFeed'
import SessionRanking from '../components/SessionRanking'
import AchievementToast from '../components/AchievementToast'
import { exportInventory, parseInventoryFile } from '../lib/excel'
import { demoProducts } from '../lib/demoProducts'
import { playBeep, playSuccess } from '../lib/sound'
import { getUserColor } from '../lib/avatars'
import {
  addScan,
  createQuickProduct,
  getProducts,
  getSession,
  importProducts,
  subscribeToSession,
  subscribeToScans,
  getSessionRanking,
  undoLastScan,
} from '../lib/session'
import { getSetting, saveRecentSession } from '../lib/db'

export default function Session() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [session, setSession] = useState(null)
  const [products, setProducts] = useState([])
  const [lastProduct, setLastProduct] = useState(null)
  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [unknownSku, setUnknownSku] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingCount, setEditingCount] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [activities, setActivities] = useState([])
  const [ranking, setRanking] = useState([])
  const [scanAnimation, setScanAnimation] = useState(false)
  const [showCheck, setShowCheck] = useState(false)
  const [editingProductId, setEditingProductId] = useState(null)
  const [achievement, setAchievement] = useState(null)
  const [streak, setStreak] = useState(0)
  const [personalBest, setPersonalBest] = useState(0)
  const wasLeaderRef = useRef(false)

  const refreshProducts = useCallback(async () => {
    const data = await getProducts(sessionId)
    setProducts(data)
    return data
  }, [sessionId])

  const refreshRanking = useCallback(async () => {
    const data = await getSessionRanking(sessionId)
    setRanking(data)
    // Detectar pérdida de liderazgo
    if (wasLeaderRef.current && data.length > 0 && data[0].user_name !== userName) {
      showAchievement('lost_lead', `${data[0].user_name} ahora lidera`)
    }
    wasLeaderRef.current = data.length > 0 && data[0].user_name === userName
    return data
  }, [sessionId, userName])

  useEffect(() => {
    getSetting('userName').then((name) => setUserName(name || 'Anónimo'))
    getSetting('userAvatar').then(setUserAvatar)
    Promise.all([getSession(sessionId), getProducts(sessionId), getSessionRanking(sessionId)])
      .then(([s, p, r]) => {
        setSession(s)
        setProducts(p)
        setRanking(r)
        saveRecentSession(s)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    const unsubscribeProducts = subscribeToSession(sessionId, refreshProducts)
    const unsubscribeScans = subscribeToScans(sessionId, (scan) => {
      if (scan.user_name !== userName) {
        const activity = { ...scan, id: `${scan.id}-${Date.now()}` }
        setActivities((prev) => [...prev, activity])
        setTimeout(() => {
          setActivities((prev) => prev.filter((a) => a.id !== activity.id))
        }, 1000)
      }
      refreshRanking()
    })
    return () => {
      unsubscribeProducts()
      unsubscribeScans()
    }
  }, [sessionId, refreshProducts, refreshRanking, userName])

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  function triggerScanFeedback() {
    setScanAnimation(true)
    setShowCheck(true)
    playSuccess()
    setTimeout(() => setScanAnimation(false), 250)
    setTimeout(() => setShowCheck(false), 600)
  }

  function showAchievement(type, message) {
    setAchievement({ type, message })
  }

  function checkAchievements(newTotal, newStreak, newRanking) {
    // Primer escaneo de la sesión
    if (newTotal === 1) {
      showAchievement('first_scan', 'Eres el primero en contar')
      return
    }
    // Racha de 10 productos seguidos
    if (newStreak === 10) {
      showAchievement('streak_10', '10 productos seguidos sin parar')
      return
    }
    // Récord personal
    if (newTotal > personalBest && personalBest > 0) {
      showAchievement('personal_record', `Superaste tu récord de ${personalBest}`)
      setPersonalBest(newTotal)
      return
    }
    if (newTotal > personalBest) setPersonalBest(newTotal)

    // Liderazgo
    const myRank = newRanking.findIndex((r) => r.user_name === userName)
    const isLeader = myRank === 0 && newRanking.length > 1
    if (isLeader && !wasLeaderRef.current) {
      showAchievement('top_scanner', 'Ahora lideras el ranking')
    }
    wasLeaderRef.current = isLeader
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const parsed = await parseInventoryFile(file)
      const data = await importProducts(sessionId, parsed)
      setProducts(data)
    } catch (err) {
      setError('Error importando: ' + err.message)
    }
    e.target.value = ''
  }

  async function handleLoadDemo() {
    setError('')
    try {
      const data = await importProducts(sessionId, demoProducts)
      setProducts(data)
    } catch (err) {
      setError('Error cargando demo: ' + err.message)
    }
  }

  const handleScan = useCallback(async (sku) => {
    setError('')
    const existing = products.find((p) => p.sku === sku)
    if (existing) {
      const optimistic = { ...existing, conteo: (existing.conteo || 0) + 1 }
      setLastProduct(optimistic)
      setProducts(products.map((p) => (p.sku === sku ? optimistic : p)))
    }
    triggerScanFeedback()

    try {
      const updated = await addScan(sessionId, sku, 1, userName, userAvatar)
      if (!updated) {
        setUnknownSku(sku)
        return
      }
      setLastProduct(updated)
      const newStreak = streak + 1
      setStreak(newStreak)
      const newProducts = await refreshProducts()
      const newRanking = await getSessionRanking(sessionId)
      setRanking(newRanking)
      const myTotal = newRanking.find((r) => r.user_name === userName)?.total || 0
      checkAchievements(myTotal, newStreak, newRanking)
    } catch (err) {
      setError('Error al escanear: ' + err.message)
      await refreshProducts()
    }
  }, [sessionId, userName, userAvatar, products, refreshProducts, streak, personalBest])

  async function handleAdjust(delta) {
    if (!lastProduct) return
    const previous = lastProduct
    const optimistic = { ...lastProduct, conteo: Math.max(0, (lastProduct.conteo || 0) + delta) }
    setLastProduct(optimistic)
    setProducts(products.map((p) => (p.sku === lastProduct.sku ? optimistic : p)))
    if (delta > 0) playBeep()

    try {
      const updated = await addScan(sessionId, lastProduct.sku, delta, userName, userAvatar)
      if (updated) {
        setLastProduct(updated)
        await refreshProducts()
        await refreshRanking()
      }
    } catch (err) {
      setLastProduct(previous)
      setProducts(products.map((p) => (p.sku === previous.sku ? previous : p)))
      setError(err.message)
    }
  }

  async function handleSetCount() {
    const newCount = Math.max(0, parseInt(editValue, 10) || 0)
    setEditingCount(false)
    if (!lastProduct) return
    const delta = newCount - (lastProduct.conteo || 0)
    if (delta === 0) return

    const previous = lastProduct
    const optimistic = { ...lastProduct, conteo: newCount }
    setLastProduct(optimistic)
    setProducts(products.map((p) => (p.sku === lastProduct.sku ? optimistic : p)))

    try {
      const updated = await addScan(sessionId, lastProduct.sku, delta, userName, userAvatar)
      if (updated) {
        setLastProduct(updated)
        await refreshProducts()
        await refreshRanking()
      }
    } catch (err) {
      setLastProduct(previous)
      setProducts(products.map((p) => (p.sku === previous.sku ? previous : p)))
      setError(err.message)
    }
  }

  async function handleUndo() {
    try {
      const updated = await undoLastScan(sessionId, userName)
      if (updated) {
        setLastProduct(updated)
        await refreshProducts()
        await refreshRanking()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleEditProduct(product, delta) {
    try {
      const updated = await addScan(sessionId, product.sku, delta, userName, userAvatar)
      if (updated) {
        if (lastProduct?.sku === product.sku) setLastProduct(updated)
        await refreshProducts()
        await refreshRanking()
      }
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleQuickCreate(e) {
    e.preventDefault()
    const form = new FormData(e.target)
    const product = {
      sku: unknownSku,
      item_number: form.get('item_number') || '',
      product_name: form.get('product_name') || 'Sin nombre',
      search_name: form.get('search_name') || '',
      size: form.get('size') || '',
      stile: form.get('stile') || '',
      warehouse: form.get('warehouse') || session?.warehouse || 'BODEGA-BOGOTA',
    }
    try {
      const created = await createQuickProduct(sessionId, product, userName, userAvatar)
      setLastProduct(created)
      setUnknownSku(null)
      await refreshProducts()
      await refreshRanking()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleExport() {
    exportInventory(products, `inventario_${session?.name || 'final'}.xlsx`)
  }

  const totalItems = products.reduce((sum, p) => sum + (p.conteo || 0), 0)
  const countedProducts = products.filter((p) => (p.conteo || 0) > 0).sort((a, b) => b.conteo - a.conteo)
  const activeUsers = ranking.length

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Cargando sesión...</div>
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={() => navigate('/')} className="text-blue-600 underline">Volver</button>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      <ActivityFeed activities={activities} />

      {/* Header */}
      <div className="bg-white shadow-sm px-2 py-2 flex items-center justify-between shrink-0">
        <button onClick={() => navigate('/')} className="p-1.5 text-gray-600">
          <ArrowLeft size={22} />
        </button>
        <div className="text-center flex-1 min-w-0">
          <h1 className="font-bold text-gray-800 text-sm truncate">{session?.name}</h1>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
            <span>{totalItems} ítems</span>
            {activeUsers > 0 && (
              <>
                <span>·</span>
                <Users size={12} className="text-green-500" />
                <span className="text-green-600">{activeUsers} activos</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {online ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-orange-500" />}
          <button onClick={handleUndo} className="p-1.5 text-gray-600" aria-label="Deshacer">
            <Undo2 size={18} />
          </button>
          <button onClick={() => setShowSummary(true)} className="p-1.5 text-gray-600" aria-label="Ver conteo">
            <List size={20} />
          </button>
          <button onClick={() => setShowQR(!showQR)} className="p-1.5 text-gray-600 text-xs font-medium">
            QR
          </button>
        </div>
      </div>

      {showQR && (
        <div className="bg-white p-3 flex flex-col items-center border-b shrink-0 animate-fade-in">
          <QRCodeSVG value={`${window.location.origin}/session/${sessionId}`} size={120} />
          <p className="text-xs text-gray-500 mt-1 break-all">{`${window.location.origin}/session/${sessionId}`}</p>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-2 text-center text-sm shrink-0">{error}</div>}

      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
          <p className="text-gray-600 text-center">Importa el Excel base o carga productos de prueba</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl"
          >
            <Upload size={20} /> Importar Excel
          </button>
          <button
            onClick={handleLoadDemo}
            className="flex items-center gap-2 bg-purple-600 text-white font-semibold py-3 px-6 rounded-xl"
          >
            <Sparkles size={20} /> Cargar productos de prueba
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        </div>
      ) : (
        <>
          <Scanner onScan={handleScan} />

          {/* Check animado de escaneo exitoso */}
          {showCheck && (
            <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-40">
              <div className="bg-green-500 rounded-full p-4 animate-check shadow-lg">
                <Check size={40} className="text-white" />
              </div>
            </div>
          )}

          {/* Tarjeta de producto */}
          <div className="flex-1 p-2 overflow-auto min-h-0">
            {lastProduct ? (
              <div className={`bg-white rounded-xl shadow p-3 text-center ${scanAnimation ? 'animate-pop' : ''}`}>
                <p className="text-gray-500 text-xs mb-0.5 truncate">{lastProduct.product_name}</p>
                <p className="text-2xl font-black text-gray-900 leading-tight">
                  {lastProduct.size || '-'} <span className="text-sm font-normal text-gray-500">/ {lastProduct.stile || '-'}</span>
                </p>
                <span className="inline-block bg-blue-100 text-blue-800 text-xs font-mono px-2 py-0.5 rounded-full mb-2">
                  {lastProduct.sku}
                </span>
                <div className="flex items-center justify-center gap-3">
                  <button
                    onClick={() => handleAdjust(-1)}
                    className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center active:bg-red-200 transition"
                  >
                    <Minus size={24} />
                  </button>
                  {editingCount ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={handleSetCount}
                      onKeyDown={(e) => e.key === 'Enter' && handleSetCount()}
                      autoFocus
                      className="text-4xl font-bold w-24 text-center border-b-2 border-blue-500 focus:outline-none"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setEditValue(String(lastProduct.conteo || 0))
                        setEditingCount(true)
                      }}
                      className={`text-4xl font-bold w-24 active:bg-gray-100 rounded ${scanAnimation ? 'animate-count-bounce' : ''}`}
                    >
                      {lastProduct.conteo}
                    </button>
                  )}
                  <button
                    onClick={() => handleAdjust(1)}
                    className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center active:bg-green-200 transition"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 mt-6 text-sm">Escanea un producto para comenzar</p>
            )}
          </div>

          {/* Botones inferiores */}
          <div className="p-2 bg-white border-t flex gap-2 shrink-0">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1 bg-gray-200 text-gray-800 font-semibold py-2.5 rounded-xl text-sm"
            >
              <Upload size={16} /> Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              <Download size={16} /> Exportar
            </button>
          </div>
        </>
      )}

      {/* Panel de resumen con ranking y edición */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col animate-slide-up">
            <div className="flex justify-between items-center p-4 border-b shrink-0">
              <h2 className="font-bold text-lg">Conteo de la sesión</h2>
              <button onClick={() => setShowSummary(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>

            <div className="p-3 overflow-auto flex-1">
              <SessionRanking ranking={ranking} currentUser={userName} />

              <div className="bg-blue-50 text-center rounded-xl p-2 mb-3">
                <span className="font-bold text-blue-800">{totalItems} ítems totales</span>
                <span className="text-blue-600 text-sm ml-2">({countedProducts.length} productos)</span>
              </div>

              {countedProducts.length === 0 ? (
                <p className="text-center text-gray-500 p-6">Aún no hay productos contados</p>
              ) : (
                countedProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-2 py-2 border-b">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{p.product_name}</p>
                      <p className="text-xs text-gray-500">{p.size} / {p.stile} · {p.sku}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleEditProduct(p, -1)}
                        className="w-7 h-7 rounded-full bg-red-100 text-red-600 flex items-center justify-center"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full text-sm min-w-[40px] text-center">
                        {p.conteo}
                      </span>
                      <button
                        onClick={() => handleEditProduct(p, 1)}
                        className="w-7 h-7 rounded-full bg-green-100 text-green-600 flex items-center justify-center"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t shrink-0">
              <button
                onClick={() => {
                  handleExport()
                  setShowSummary(false)
                }}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-xl"
              >
                <Download size={18} /> Exportar Inventario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de producto no reconocido */}
      {unknownSku && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <form onSubmit={handleQuickCreate} className="bg-white rounded-2xl p-6 w-full max-w-sm animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">Producto no reconocido</h2>
              <button type="button" onClick={() => setUnknownSku(null)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">SKU: <span className="font-mono">{unknownSku}</span></p>
            <input name="product_name" placeholder="Nombre del producto" required className="w-full border rounded-lg px-3 py-2 mb-2" />
            <input name="size" placeholder="Talla (ej. XS)" className="w-full border rounded-lg px-3 py-2 mb-2" />
            <input name="stile" placeholder="Estilo (ej. REGULAR)" className="w-full border rounded-lg px-3 py-2 mb-2" />
            <input name="warehouse" placeholder="Bodega" defaultValue="BODEGA-BOGOTA" className="w-full border rounded-lg px-3 py-2 mb-4" />
            <button type="submit" className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl">
              Agregar y contar +1
            </button>
          </form>
        </div>
      )}

      <AchievementToast achievement={achievement} onClose={() => setAchievement(null)} />
    </div>
  )
}
