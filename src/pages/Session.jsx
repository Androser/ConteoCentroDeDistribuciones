import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Upload, Download, Minus, Plus, X, Wifi, WifiOff, List } from 'lucide-react'
import Scanner from '../components/Scanner'
import { exportInventory, parseInventoryFile } from '../lib/excel'
import {
  addScan,
  createQuickProduct,
  getProducts,
  getSession,
  importProducts,
  subscribeToSession,
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
  const [showQR, setShowQR] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [unknownSku, setUnknownSku] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingCount, setEditingCount] = useState(false)
  const [editValue, setEditValue] = useState('')

  const refreshProducts = useCallback(async () => {
    const data = await getProducts(sessionId)
    setProducts(data)
    return data
  }, [sessionId])

  useEffect(() => {
    getSetting('userName').then((name) => setUserName(name || 'Anónimo'))
    Promise.all([getSession(sessionId), getProducts(sessionId)])
      .then(([s, p]) => {
        setSession(s)
        setProducts(p)
        saveRecentSession(s)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))

    const unsubscribe = subscribeToSession(sessionId, refreshProducts)
    return unsubscribe
  }, [sessionId, refreshProducts])

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

  const handleScan = useCallback(async (sku) => {
    setError('')
    // Actualización optimista: buscar producto localmente primero
    const existing = products.find((p) => p.sku === sku)
    if (existing) {
      const optimistic = { ...existing, conteo: (existing.conteo || 0) + 1 }
      setLastProduct(optimistic)
      setProducts(products.map((p) => (p.sku === sku ? optimistic : p)))
    }

    try {
      const updated = await addScan(sessionId, sku, 1, userName)
      if (!updated) {
        setUnknownSku(sku)
        return
      }
      setLastProduct(updated)
      await refreshProducts()
    } catch (err) {
      setError('Error al escanear: ' + err.message)
      await refreshProducts()
    }
  }, [sessionId, userName, products, refreshProducts])

  async function handleAdjust(delta) {
    if (!lastProduct) return
    const previous = lastProduct
    const optimistic = { ...lastProduct, conteo: Math.max(0, (lastProduct.conteo || 0) + delta) }
    setLastProduct(optimistic)
    setProducts(products.map((p) => (p.sku === lastProduct.sku ? optimistic : p)))

    try {
      const updated = await addScan(sessionId, lastProduct.sku, delta, userName)
      if (updated) {
        setLastProduct(updated)
        await refreshProducts()
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
      const updated = await addScan(sessionId, lastProduct.sku, delta, userName)
      if (updated) {
        setLastProduct(updated)
        await refreshProducts()
      }
    } catch (err) {
      setLastProduct(previous)
      setProducts(products.map((p) => (p.sku === previous.sku ? previous : p)))
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
      const created = await createQuickProduct(sessionId, product, userName)
      setLastProduct(created)
      setUnknownSku(null)
      await refreshProducts()
    } catch (err) {
      setError(err.message)
    }
  }

  function handleExport() {
    exportInventory(products, `inventario_${session?.name || 'final'}.xlsx`)
  }

  const totalItems = products.reduce((sum, p) => sum + (p.conteo || 0), 0)
  const countedProducts = products.filter((p) => (p.conteo || 0) > 0).sort((a, b) => b.conteo - a.conteo)

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
      {/* Header compacto */}
      <div className="bg-white shadow-sm px-2 py-2 flex items-center justify-between shrink-0">
        <button onClick={() => navigate('/')} className="p-1.5 text-gray-600">
          <ArrowLeft size={22} />
        </button>
        <div className="text-center flex-1 min-w-0">
          <h1 className="font-bold text-gray-800 text-sm truncate">{session?.name}</h1>
          <p className="text-xs text-gray-500">{totalItems} ítems contados</p>
        </div>
        <div className="flex items-center gap-1">
          {online ? <Wifi size={16} className="text-green-500" /> : <WifiOff size={16} className="text-orange-500" />}
          <button onClick={() => setShowSummary(true)} className="p-1.5 text-gray-600" aria-label="Ver conteo">
            <List size={20} />
          </button>
          <button onClick={() => setShowQR(!showQR)} className="p-1.5 text-gray-600 text-xs font-medium">
            QR
          </button>
        </div>
      </div>

      {showQR && (
        <div className="bg-white p-3 flex flex-col items-center border-b shrink-0">
          <QRCodeSVG value={`${window.location.origin}/session/${sessionId}`} size={120} />
          <p className="text-xs text-gray-500 mt-1 break-all">{`${window.location.origin}/session/${sessionId}`}</p>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-2 text-center text-sm shrink-0">{error}</div>}

      {products.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <p className="text-gray-600 mb-4 text-center">Importa el Excel base para comenzar</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-blue-600 text-white font-semibold py-3 px-6 rounded-xl"
          >
            <Upload size={20} /> Importar Excel
          </button>
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
        </div>
      ) : (
        <>
          <Scanner onScan={handleScan} />

          {/* Tarjeta de producto compacta */}
          <div className="flex-1 p-2 overflow-auto min-h-0">
            {lastProduct ? (
              <div className="bg-white rounded-xl shadow p-3 text-center">
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
                    className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center active:bg-red-200"
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
                      className="text-4xl font-bold w-24 active:bg-gray-100 rounded"
                    >
                      {lastProduct.conteo}
                    </button>
                  )}
                  <button
                    onClick={() => handleAdjust(1)}
                    className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center active:bg-green-200"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 mt-6 text-sm">Escanea un producto para comenzar</p>
            )}
          </div>

          {/* Botones inferiores siempre visibles */}
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

      {/* Modal de resumen de conteo en tiempo real */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b shrink-0">
              <h2 className="font-bold text-lg">Conteo de la sesión</h2>
              <button onClick={() => setShowSummary(false)} className="text-gray-400">
                <X size={24} />
              </button>
            </div>
            <div className="p-3 bg-blue-50 text-center shrink-0">
              <span className="font-bold text-blue-800">{totalItems} ítems totales</span>
              <span className="text-blue-600 text-sm ml-2">({countedProducts.length} productos)</span>
            </div>
            <div className="overflow-auto flex-1">
              {countedProducts.length === 0 ? (
                <p className="text-center text-gray-500 p-6">Aún no hay productos contados</p>
              ) : (
                countedProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3 border-b">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{p.product_name}</p>
                      <p className="text-xs text-gray-500">{p.size} / {p.stile} · {p.sku}</p>
                    </div>
                    <span className="ml-3 bg-blue-100 text-blue-800 font-bold px-3 py-1 rounded-full text-sm">
                      {p.conteo}
                    </span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <form onSubmit={handleQuickCreate} className="bg-white rounded-2xl p-6 w-full max-w-sm">
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
    </div>
  )
}
