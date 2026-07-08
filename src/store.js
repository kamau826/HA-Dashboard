import { reactive } from 'vue'
import axios from 'axios'

function calculateWorkingDays(startDate, endDate) {
  let workingDays = 0
  const current = new Date(startDate)
  const end = new Date(endDate)
  
  // If same day, return 0
  if (current.toDateString() === end.toDateString()) {
    return 0
  }
  
  // Start from next day to avoid counting creation day
  current.setDate(current.getDate() + 1)
  
  while (current <= end) {
    const dayOfWeek = current.getDay()
    if (dayOfWeek === 0) {
      // Sunday - not counted
    } else if (dayOfWeek === 6) {
      // Saturday - half day
      workingDays += 0.5
    } else {
      // Monday-Friday - full day
      workingDays += 1
    }
    current.setDate(current.getDate() + 1)
  }
  
  return workingDays
}

export const store = reactive({
  rows: [],
  live: false,
  loading: true,
  lastUpdated: '',
  filters: { dateRange: 'Today', country: 'Kenya', warranty: 'All' },
  shopDetails: {},

  getRowByJsNo(jsNo) {
    return this.rows.find(r => r.jsNo === jsNo) || null
  },

  getRelatedCases(imei, currentJsNo) {
    if (!imei) return []
    return this.rows.filter(r => r.imei === imei && r.jsNo !== currentJsNo)
  },

  getShopDetail(shopCode) {
    return this.shopDetails[shopCode] || null
  },

  async fetchShopDetail(shopCode) {
    if (this.shopDetails[shopCode]) return this.shopDetails[shopCode]
    
    try {
      const res = await axios.post('/api/shop-detail', {
        shopCode,
        country: 'KE'
      })
      
      if (res.data.code === '0' && res.data.data) {
        this.shopDetails[shopCode] = res.data.data
        return res.data.data
      }
      return null
    } catch (e) {
      console.error('Failed to fetch shop detail:', e)
      return null
    }
  },

  async fetchData() {
    this.loading = true
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 30)

      const formatDate = (d) => d.toISOString().slice(0, 10).replace(/-/g, '')

      const res = await axios.post('/api/ha-report', {
        statusCodes: [],
        countryCodes: [],
        dateType: 1,
        isShortage: '',
        localStartTime: parseInt(formatDate(startDate)),
        localEndTime: parseInt(formatDate(endDate)),
        current: 1,
        size: 500,
      })

      if (res.data.code !== '0') throw new Error(res.data.message || 'API error')

      const records = res.data.data?.records || []
      this.rows = records.map(r => {
        const createdOn = r.localCreationTime
          ? `${r.localCreationTime.toString().slice(0,4)}-${r.localCreationTime.toString().slice(4,6)}-${r.localCreationTime.toString().slice(6,8)} ${r.localCreationTime.toString().slice(8,10)}:${r.localCreationTime.toString().slice(10,12)}`
          : ''
        const createdAt = r.creationTime || 0
        const docStatus = r.statusName || ''
        const today = new Date()
        const createdDate = new Date(createdOn)
        const calendarDays = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24))
        const workingDays = calculateWorkingDays(createdDate, today)

        return {
          jsNo: r.jobSheetNo || '',
          shop: r.creatorShopName || '',
          shopCode: (r.creatorShopName || '').split('-')[0] || '',
          createdOn,
          createdAt,
          docStatus,
          serviceTAT: Number(r.serviceTat || 0),
          complaint: r.complain || '',
          warrantyStatus: r.warrantyStatusName || '',
          income: Number(r.receivableAmt || 0),
          returned: docStatus.includes('Returned') || false,
          imei: r.imeiSn1 || '',
          customerName: r.customerName || '',
          customerPhone: r.customerPhone || r.phone || '',
          category: r.categoryName || '',
          brand: r.brandName || '',
          model: r.modelName || r.model || '',
          serialNo: r.imeiSn1 || '',
          calendarDays,
          workingDays,
        }
      })

      // Calculate BR flags
      this.rows = this.rows.map(r => ({
        ...r,
        br: isBR(r, this.rows),
      }))

      this.live = true
      this.lastUpdated = new Date().toLocaleString()
    } catch (e) {
      this.live = false
      console.error('API Error:', e)
    } finally {
      this.loading = false
    }
  }
})

function isBR(item, allRows) {
  const serial = String(item.imei || '').trim()
  if (!serial) return false
  const sameDevice = allRows.filter(r => String(r.imei || '').trim() === serial)
  if (sameDevice.length <= 1) return false
  const itemTime = new Date(item.createdAt || item.createdOn).getTime()
  return sameDevice.some(r => {
    if (r === item) return false
    const t = new Date(r.createdAt || r.createdOn).getTime()
    const diffDays = Math.abs(itemTime - t) / (1000 * 60 * 60 * 24)
    return diffDays <= 30
  })
}
