import { reactive } from 'vue'

const warehouseMap = {
  'KE0001': '14dd7a7536a840bd53cea8eb12df0dd8',
  'KE0028': '101d2fdcea16ca0a2b2a14cc15546cc5',
}

export const inventoryStore = reactive({
  rows: [],
  live: false,
  loading: true,
  lastUpdated: '',
  meta: { total: 0, pages: 0, current: 1, size: 1000 },
  selectedWarehouse: 'KE0001',

  getRowsByWarehouse(warehouseId) {
    return this.rows.filter(r => r.warehouseId === warehouseId)
  },

  async fetchData(warehouseCode) {
    this.loading = true
    this.selectedWarehouse = warehouseCode
    
    const warehouseId = warehouseMap[warehouseCode] || warehouseCode
    
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current: 1,
          size: 1000,
          warehouseIdList: [warehouseId],
        }),
      })
      const data = await res.json()
      
      if (data.code !== '0') throw new Error(data.message || 'Failed to load inventory')
      
      const page = data.data || {}
      this.rows = (page.records || []).map(r => ({
        ...r,
        numAvailable: Number(r.numAvailable || 0),
        numFrozen: Number(r.numFrozen || 0),
        numTotal: Number(r.numTotal || 0),
      }))
      
      this.meta = {
        total: page.total || 0,
        pages: page.pages || 0,
        current: page.current || 1,
        size: page.size || 1000,
      }
      
      this.live = true
      this.lastUpdated = new Date().toLocaleString()
    } catch (e) {
      console.error('Inventory fetch error:', e)
      this.live = false
      this.rows = []
    } finally {
      this.loading = false
    }
  },
})
