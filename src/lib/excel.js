import * as XLSX from 'xlsx'

const HEADERS = [
  'code SKU',
  'Item Number',
  'product Name',
  'Conteo',
  'search name',
  'size',
  'stile',
  'warehouse',
]

export function parseInventoryFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
        if (rows.length < 2) {
          reject(new Error('El archivo no tiene filas de datos'))
          return
        }
        const products = rows.slice(1).map((row) => ({
          sku: String(row[0] ?? '').trim(),
          item_number: String(row[1] ?? '').trim(),
          product_name: String(row[2] ?? '').trim(),
          conteo: Number(row[3]) || 0,
          search_name: String(row[4] ?? '').trim(),
          size: String(row[5] ?? '').trim(),
          stile: String(row[6] ?? '').trim(),
          warehouse: String(row[7] ?? '').trim(),
        })).filter((p) => p.sku)
        resolve(products)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function exportInventory(products, filename = 'inventario_final.xlsx') {
  const rows = products.map((p) => [
    p.sku,
    p.item_number,
    p.product_name,
    p.conteo,
    p.search_name,
    p.size,
    p.stile,
    p.warehouse,
  ])
  const worksheet = XLSX.utils.aoa_to_sheet([HEADERS, ...rows])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventario')
  XLSX.writeFile(workbook, filename)
}
