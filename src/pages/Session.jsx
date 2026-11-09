import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Upload, Download, Minus, Plus, X, Wifi, WifiOff } from 'lucide-react'
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
import { getSetting } from '../lib/db'

export default function Session() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const [session, setSession] = useState(null)
  const [products, setProducts] = useState([])
  const [lastProduct, setLastProduct] = useState(null)
  const [userName, setUserName] = useState('')
  const [showQR, setShowQR] = useState(false)
  const [unknownSku, setUnknownSku] = useState(null)
  const [online, setOnline] = useState(navigator.onLine)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    }
  }, [sessionId, userName, refreshProducts])

  async function handleAdjust(delta) {
    if (!lastProduct) return
    try {
      const updated = await addScan(sessionId, lastProduct.sku, delta, userName)
      if (updated) {
        setLastProduct(updated)
        await refreshProducts()
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white shadow-sm p-3 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="p-2 text-gray-600">
          <ArrowLeft size={24} />
        </button>
        <div className="text-center">
          <h1 className="font-bold text-gray-800 text-sm">{session?.name}</h1>
          <p className="text-xs text-gray-500">{totalItems} ítems contados</p>
        </div>
        <div className="flex items-center gap-1">
          {online ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-orange-500" />}
          <button onClick={() => setShowQR(!showQR)} className="p-2 text-gray-600 text-xs font-medium">
            QR
          </button>
        </div>
      </div>

      {showQR && (
        <div className="bg-white p-4 flex flex-col items-center border-b">
          <QRCodeSVG value={sessionId} size={160} />
          <p className="text-xs text-gray-500 mt-2 break-all">{sessionId}</p>
        </div>
      )}

      {error && <div className="bg-red-50 text-red-600 p-2 text-center text-sm">{error}</div>}

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
          <div className="flex-1 p-4 overflow-auto">
            {lastProduct ? (
              <div className="bg-white rounded-2xl shadow p-5 text-center">
                <p className="text-gray-500 text-sm mb-1">{lastProduct.product_name}</p>
                <p className="text-4xl font-black text-gray-900 mb-1">
                  {lastProduct.size || '-'} <span className="text-xl font-normal text-gray-500">/ {lastProduct.stile || '-'}</span>
                </p>
                <span className="inline-block bg-blue-100 text-blue-800 text-sm font-mono px-3 py-1 rounded-full mb-4">
                  {lastProduct.sku}
                </span>
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    onClick={() => handleAdjust(-1)}
                    className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center"
                  >
                    <Minus size={28} />
                  </button>
                  <span className="text-5xl font-bold w-20">{lastProduct.conteo}</span>
                  <button
                    onClick={() => handleAdjust(1)}
                    className="w-14 h-14 rounded-full bg-green-100 text-green-600 flex items-center justify-center"
                  >
                    <Plus size={28} />
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 mt-10">Escanea un producto para comenzar</p>
            )}
          </div>
          <div className="p-4 bg-white border-t flex gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-200 text-gray-800 font-semibold py-3 rounded-xl"
            >
              <Upload size={18} /> Excel
            </button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
            <button
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 rounded-xl"
            >
              <Download size={18} /> Exportar
            </button>
          </div>
        </>
      )}

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
