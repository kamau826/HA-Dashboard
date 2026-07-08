<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import * as echarts from 'echarts'
import ExcelJS from 'exceljs'
import { store } from '../store'

const serviceTatChart = ref(null)
const docStatusChart = ref(null)
const warrantyIncomeChart = ref(null)
const brChart = ref(null)
const tableFilter = ref({ search: '', status: 'All', warranty: 'All', br: 'All', sort: 'date_desc', shop: '', model: '', serialNo: '', customer: '', category: '', shopType: 'All' })
const showFilters = ref(false)

function clearFilters() {
  tableFilter.value = { search: '', status: 'All', warranty: 'All', br: 'All', sort: 'date_desc', shop: '', model: '', serialNo: '', customer: '', category: '', shopType: 'All' }
}
let timer

function money(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v || 0))
}

const normalizedRows = computed(() => store.rows.map(r => ({ ...r, br: r.br, calendarDays: r.calendarDays })))

const shopTypes = computed(() => {
  const types = new Set()
  normalizedRows.value.forEach(r => {
    const shop = r.shop || ''
    if (shop.includes('OSCAR')) types.add('OSCAR')
    else if (shop.includes('ASC')) types.add('ASC')
    else if (shop.includes('L4')) types.add('L4')
    else if (shop.includes('MWH')) types.add('MWH')
    else if (shop.includes('OSRP')) types.add('OSRP')
  })
  return [...types].sort()
})

const filteredRows = computed(() => {
  let result = normalizedRows.value
  if (tableFilter.value.search) {
    const searchTerms = tableFilter.value.search.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
    if (searchTerms.length > 0) {
      result = result.filter(r => {
        const searchableText = [
          r.jsNo, r.shop, r.complaint, r.customerName,
          r.model, r.serialNo, r.category, r.brand
        ].join(' ').toLowerCase()
        
        // All terms must match (AND logic)
        return searchTerms.every(term => searchableText.includes(term))
      })
    }
  }
  if (tableFilter.value.shopType !== 'All') {
    result = result.filter(r => r.shop.includes(tableFilter.value.shopType))
  }
  if (tableFilter.value.shop) {
    result = result.filter(r => r.shop.toLowerCase().includes(tableFilter.value.shop.toLowerCase()))
  }
  if (tableFilter.value.model) {
    result = result.filter(r => r.model.toLowerCase().includes(tableFilter.value.model.toLowerCase()))
  }
  if (tableFilter.value.serialNo) {
    result = result.filter(r => r.serialNo.toLowerCase().includes(tableFilter.value.serialNo.toLowerCase()))
  }
  if (tableFilter.value.customer) {
    result = result.filter(r => r.customerName.toLowerCase().includes(tableFilter.value.customer.toLowerCase()))
  }
  if (tableFilter.value.category) {
    result = result.filter(r => r.category.toLowerCase().includes(tableFilter.value.category.toLowerCase()))
  }
  if (tableFilter.value.status !== 'All') result = result.filter(r => r.docStatus.includes(tableFilter.value.status))
  if (tableFilter.value.warranty !== 'All') result = result.filter(r => r.warrantyStatus === tableFilter.value.warranty)
  if (tableFilter.value.br === 'BR') result = result.filter(r => r.br)
  if (tableFilter.value.br === 'No BR') result = result.filter(r => !r.br)
  const [field, direction] = tableFilter.value.sort.split('_')
  return [...result].sort((a, b) => {
    const valA = field === 'date' ? new Date(a.createdAt || a.createdOn).getTime() : field === 'tat' ? a.serviceTAT : a.income
    const valB = field === 'date' ? new Date(b.createdAt || b.createdOn).getTime() : field === 'tat' ? b.serviceTAT : b.income
    return direction === 'asc' ? valA - valB : valB - valA
  })
})

function getSLAStats(rows) {
  // SLA: cases should be completed within 7 working days
  // Calculate for ALL rows, not just current month
  const totalWorkingDays = rows.reduce((s, r) => s + (r.workingDays || 0), 0)
  const avgWorkingDays = rows.length ? totalWorkingDays / rows.length : 0
  const withinSLA = rows.filter(r => (r.workingDays || 0) <= 7).length
  const slaCompliance = rows.length ? ((withinSLA / rows.length) * 100).toFixed(1) : '0.0'
  const overSLA = rows.length - withinSLA
  return { avgWorkingDays, slaCompliance, overSLA }
}

const totals = computed(() => {
  const now = new Date()
  const thisMonth = now.getMonth()
  const thisYear = now.getFullYear()
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1
  const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear
  
  const thisMonthCases = normalizedRows.value.filter(r => {
    const created = new Date(r.createdOn)
    return created.getMonth() === thisMonth && created.getFullYear() === thisYear
  }).length
  
  const lastMonthCases = normalizedRows.value.filter(r => {
    const created = new Date(r.createdOn)
    return created.getMonth() === lastMonth && created.getFullYear() === lastMonthYear
  }).length
  
  const total = normalizedRows.value.length || 1
  const notReturned = normalizedRows.value.filter(r => !r.returned).length
  const br = normalizedRows.value.filter(r => r.br).length
  const underWarranty = normalizedRows.value.filter(r => /under warranty/i.test(r.warrantyStatus)).length
  const income = normalizedRows.value.reduce((s, r) => s + Number(r.income || 0), 0)
  const slaStats = getSLAStats(normalizedRows.value)
  return { total, thisMonthCases, lastMonthCases, notReturned, br, underWarranty, income, ...slaStats }
})

const kpis = computed(() => ([
  { label: 'This Month', value: String(totals.value.thisMonthCases), sub: 'Current month bookings' },
  { label: 'Last Month', value: String(totals.value.lastMonthCases), sub: 'Previous month bookings' },
  { label: 'Avg Service TAT', value: totals.value.avgWorkingDays.toFixed(1), sub: 'Current month working days' },
  { label: 'SLA Compliance', value: `${totals.value.slaCompliance}%`, sub: `Allowed TAT 7 days | ${totals.value.overSLA} over` },
  { label: 'Not Returned Docs', value: String(totals.value.notReturned), sub: 'Attention' },
  { label: 'BR Rate', value: `${((totals.value.br / totals.value.total) * 100).toFixed(1)}%`, sub: 'Repeat <30 days' },
  { label: 'Income', value: money(totals.value.income), sub: 'Total' },
]))

const hotspots = computed(() => {
  const map = new Map()
  normalizedRows.value.forEach(r => map.set(r.category || 'Unknown', (map.get(r.category || 'Unknown') || 0) + 1))
  return [...map.entries()].map(([name, count]) => ({ name, count, share: ((count / (normalizedRows.value.length || 1)) * 100).toFixed(1) }))
})

const longestPending = computed(() => normalizedRows.value.filter(r => !r.returned && r.workingDays > 7).sort((a, b) => b.workingDays - a.workingDays))

function updateAlerts() {
  const a = []
  if (totals.value.notReturned) a.push(`${totals.value.notReturned} document(s) are not returned yet.`)
  const tatRisk = normalizedRows.value.filter(r => r.workingDays > 4 && !r.returned).length
  if (tatRisk) a.push(`${tatRisk} case(s) have Service TAT above 4 days.`)
  if (totals.value.br) a.push(`${totals.value.br} repeat repair case(s) detected within 30 days (BR risk).`)
  const outWarranty = normalizedRows.value.filter(r => /out warranty/i.test(r.warrantyStatus)).length
  if (outWarranty) a.push(`${outWarranty} out-warranty case(s) need income follow-up.`)
  const awaitingCollection = normalizedRows.value.filter(r => /repair completed|unrepairable/i.test(r.docStatus)).length
  if (awaitingCollection) a.push(`${awaitingCollection} case(s) awaiting collection (repair completed / unrepairable).`)
  const awaitingAssign = normalizedRows.value.filter(r => /\bopen\b/i.test(r.docStatus)).length
  if (awaitingAssign) a.push(`${awaitingAssign} case(s) awaiting technician assignment (open).`)
  return a
}

const alerts = computed(updateAlerts)

const expandedAlert = ref(null)

const alertCases = computed(() => {
  const cases = {
    notReturned: normalizedRows.value.filter(r => !r.returned),
    tatOverdue: normalizedRows.value.filter(r => r.workingDays > 4 && !r.returned),
    brCases: normalizedRows.value.filter(r => r.br),
    outWarranty: normalizedRows.value.filter(r => /out warranty/i.test(r.warrantyStatus)),
    awaitingCollection: normalizedRows.value.filter(r => /repair completed|unrepairable/i.test(r.docStatus)),
    awaitingAssign: normalizedRows.value.filter(r => /\bopen\b/i.test(r.docStatus))
  }
  return cases
})

function toggleAlert(index) {
  expandedAlert.value = expandedAlert.value === index ? null : index
}

function getAlertKey(index) {
  const keys = ['notReturned', 'tatOverdue', 'brCases', 'outWarranty', 'awaitingCollection', 'awaitingAssign']
  return keys[index] || null
}

const alertModalTitle = computed(() => {
  if (expandedAlert.value === null) return ''
  const key = getAlertKey(expandedAlert.value)
  const titles = {
    notReturned: 'Documents Not Returned',
    tatOverdue: 'Service TAT Above 4 Days',
    brCases: 'BR Risk - Repeat Repairs',
    outWarranty: 'Out of Warranty - Income Follow-up',
    awaitingCollection: 'Awaiting Collection (Repair Completed / Unrepairable)',
    awaitingAssign: 'Awaiting Technician Assignment (Open)'
  }
  return titles[key] || ''
})

function renderCharts() {
  const tatBuckets = { '0-1d': 0, '1-2d': 0, '2-4d': 0, '4d+': 0 }
  normalizedRows.value.forEach(r => {
    const days = r.calendarDays
    if (days <= 1) tatBuckets['0-1d']++
    else if (days <= 2) tatBuckets['1-2d']++
    else if (days <= 4) tatBuckets['2-4d']++
    else tatBuckets['4d+']++
  })
  serviceTatChart.value?.setOption({ grid: { left: 30, right: 10, top: 20, bottom: 20, containLabel: true }, xAxis: { type: 'category', data: Object.keys(tatBuckets) }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: Object.values(tatBuckets), itemStyle: { color: '#2563eb', borderRadius: [8, 8, 0, 0] } }] })
  docStatusChart.value?.setOption({ tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['45%', '70%'], label: { formatter: '{b}: {d}%' }, data: [{ value: totals.value.total - totals.value.notReturned, name: 'Returned' }, { value: totals.value.notReturned, name: 'Not Returned' }] }] })
  warrantyIncomeChart.value?.setOption({ tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['45%', '70%'], label: { formatter: '{b}: {d}%' }, data: [{ value: totals.value.underWarranty, name: 'Under Warranty' }, { value: normalizedRows.value.length - totals.value.underWarranty, name: 'Out Warranty' }] }] })
  brChart.value?.setOption({ grid: { left: 30, right: 10, top: 20, bottom: 20, containLabel: true }, xAxis: { type: 'category', data: ['BR Cases', 'Normal Cases'] }, yAxis: { type: 'value' }, series: [{ type: 'bar', data: [totals.value.br, normalizedRows.value.length - totals.value.br], itemStyle: { color: ['#ef4444', '#10b981'] } }] })
}

function initCharts() {
  serviceTatChart.value = echarts.init(document.getElementById('serviceTatChart'))
  docStatusChart.value = echarts.init(document.getElementById('docStatusChart'))
  warrantyIncomeChart.value = echarts.init(document.getElementById('warrantyIncomeChart'))
  brChart.value = echarts.init(document.getElementById('brChart'))
  window.addEventListener('resize', resizeCharts)
}

function resizeCharts() {
  serviceTatChart.value?.resize(); docStatusChart.value?.resize(); warrantyIncomeChart.value?.resize(); brChart.value?.resize()
}

function pillClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('repair completed')) return 'pill green'
  if (s.includes('open') || s.includes('assigned')) return 'pill amber'
  return 'pill red'
}

function alertClass(alert) {
  const text = String(alert || '').toLowerCase()
  if (text.includes('not returned')) return 'alert-doc'
  if (text.includes('service tat') || text.includes('above 4 days')) return 'alert-tat'
  if (text.includes('repeat repair') || text.includes('br risk')) return 'alert-br'
  if (text.includes('out-warranty') || text.includes('income follow-up')) return 'alert-income'
  if (text.includes('awaiting collection') || text.includes('repair completed') || text.includes('unrepairable')) return 'alert-collection'
  if (text.includes('awaiting technician') || text.includes('open')) return 'alert-assign'
  return 'alert-default'
}

function alertIcon(alert) {
  const text = String(alert || '').toLowerCase()
  if (text.includes('not returned')) return ''
  if (text.includes('service tat') || text.includes('above 4 days')) return '️'
  if (text.includes('repeat repair') || text.includes('br risk')) return '🔄'
  if (text.includes('out-warranty') || text.includes('income follow-up')) return ''
  if (text.includes('awaiting collection') || text.includes('repair completed') || text.includes('unrepairable')) return '📦'
  if (text.includes('awaiting technician') || text.includes('open')) return '👷'
  return '️'
}

function getStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('returned')) return 'badge-green'
  if (s.includes('repair completed') || s.includes('completed')) return 'badge-blue'
  if (s.includes('assigned')) return 'badge-amber'
  if (s.includes('open')) return 'badge-orange'
  return 'badge-gray'
}

async function exportExcel() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('HA Report')
  const headers = [
    { header: 'JS No', key: 'jsNo', width: 24 }, { header: 'Shop', key: 'shop', width: 28 }, { header: 'Created', key: 'createdOn', width: 18 }, { header: 'Status', key: 'docStatus', width: 26 }, { header: 'Service TAT (Days)', key: 'tat', width: 18 }, { header: 'Warranty', key: 'warranty', width: 16 }, { header: 'Income (KES)', key: 'income', width: 14 }, { header: 'Doc Returned', key: 'returned', width: 14 }, { header: 'BR Flag', key: 'br', width: 10 }, { header: 'Category', key: 'category', width: 16 }, { header: 'Brand', key: 'brand', width: 12 }, { header: 'Model', key: 'model', width: 18 }, { header: 'Serial Number', key: 'serialNo', width: 20 }, { header: 'Customer Name', key: 'customer', width: 20 }, { header: 'Complaint', key: 'complaint', width: 30 },
  ]
  sheet.columns = headers.map(h => ({ header: h.header, key: h.key, width: h.width }))
  const headerRow = sheet.getRow(1)
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  headerRow.height = 24
  const thinBorder = { top: { style: 'thin', color: { argb: 'FFD1D5DB' } }, left: { style: 'thin', color: { argb: 'FFD1D5DB' } }, bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }, right: { style: 'thin', color: { argb: 'FFD1D5DB' } } }
  headerRow.eachCell(cell => { cell.border = thinBorder })
  filteredRows.value.forEach(r => {
    const row = sheet.addRow({ jsNo: r.jsNo, shop: r.shop, createdOn: r.createdOn, docStatus: r.docStatus, tat: r.calendarDays, complaint: r.complaint, warranty: r.warrantyStatus, income: r.income, returned: r.returned ? 'Returned' : 'Not Returned', br: r.br ? 'BR' : '', category: r.category || '', brand: r.brand || '', model: r.model || '', serialNo: r.serialNo || '', customer: r.customerName || '' })
    row.alignment = { horizontal: 'center', vertical: 'middle' }
    row.eachCell(cell => { cell.border = thinBorder; cell.font = { size: 10 } })
    row.getCell('shop').alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell('complaint').alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    row.getCell('docStatus').alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell('customer').alignment = { horizontal: 'left', vertical: 'middle' }
    row.getCell('jsNo').alignment = { horizontal: 'left', vertical: 'middle' }
    if (row.number % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } } })
    const s = String(r.docStatus || '').toLowerCase()
    if (s.includes('repair completed') || s.includes('returned')) row.getCell('docStatus').font = { size: 10, color: { argb: 'FF166534' }, bold: true }
    else if (s.includes('open') || s.includes('assigned')) row.getCell('docStatus').font = { size: 10, color: { argb: 'FFB45309' }, bold: true }
    if (r.br) { const brCell = row.getCell('br'); brCell.font = { size: 10, color: { argb: 'FFFFFFFF' }, bold: true }; brCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } } }
    row.getCell('income').numFmt = '#,##0'
  })
  sheet.views = [{ state: 'frozen', ySplit: 1 }]
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: filteredRows.value.length + 1, column: headers.length } }
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ha-report-${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(async () => {
  await store.fetchData()
  initCharts()
  renderCharts()
  timer = setInterval(async () => { await store.fetchData(); renderCharts() }, 60000)
})

onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('resize', resizeCharts)
})
</script>

<template>
  <div class="app">
    <div class="topbar">
      <div class="title">
        <h1>Home Appliance Work Dashboard</h1>
        <p>Real-time monitoring for Service TAT, document return, BR rate, income, and warranty pressure.</p>
      </div>
      <div :class="['status', store.live ? '' : 'warn']">{{ store.live ? `LIVE • Updated ${store.lastUpdated}` : 'OFFLINE / DEMO DATA' }}</div>
    </div>

    <div class="grid kpis">
      <div class="card kpi" v-for="k in kpis" :key="k.label"><div class="label">{{ k.label }}</div><div class="value">{{ k.value }}</div><div class="sub">{{ k.sub }}</div></div>
    </div>

    <div class="grid secondary">
      <div class="card" style="padding: 20px;">
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:16px;">
          <div style="width:36px; height:36px; border-radius:10px; background:linear-gradient(135deg, #fef2f2, #fee2e2); display:flex; align-items:center; justify-content:center; font-size:18px;"></div>
          <div>
            <strong style="font-size:16px; color:#111827;">Attention Needed</strong>
            <p style="margin:2px 0 0; font-size:12px; color:#6b7280;">{{ alerts.length }} alert(s) require your action</p>
          </div>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px;">
          <div v-for="(a, i) in alerts" :key="i" class="alert-item" :class="alertClass(a)" @click="toggleAlert(i)" style="cursor:pointer;">
            <span class="alert-icon">{{ alertIcon(a) }}</span>
            <span class="alert-text" style="flex:1;">{{ a }}</span>
            <span class="alert-expand">▶</span>
          </div>
        </div>
        
        <!-- Modal for alert cases -->
        <div v-if="expandedAlert !== null" class="alert-modal-overlay" @click.self="toggleAlert(expandedAlert)">
          <div class="alert-modal">
            <div class="alert-modal-header">
              <div>
                <strong style="font-size:18px; color:#111827;">{{ alertModalTitle }}</strong>
                <p style="margin:4px 0 0; font-size:13px; color:#6b7280;">{{ alertCases[getAlertKey(expandedAlert)]?.length || 0 }} cases</p>
              </div>
              <button @click="toggleAlert(expandedAlert)" class="modal-close-btn">✕</button>
            </div>
            <div class="alert-modal-body">
              <table class="professional-table">
                <thead>
                  <tr>
                    <th>JS No</th>
                    <th>Shop</th>
                    <th>Created</th>
                    <th>Status</th>
                    <th>TAT</th>
                    <th>Warranty</th>
                    <th>Income</th>
                    <th>Model</th>
                    <th>Serial No</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="c in alertCases[getAlertKey(expandedAlert)]" :key="c.jsNo">
                    <td class="js-cell">
                      <RouterLink :to="{ name: 'case-detail', params: { jsNo: c.jsNo } }">{{ c.jsNo }}</RouterLink>
                    </td>
                    <td class="shop-cell">{{ c.shop }}</td>
                    <td class="date-cell">{{ c.createdOn }}</td>
                    <td>
                      <span :class="['status-pill', pillClass(c.docStatus)]">{{ c.docStatus }}</span>
                    </td>
                    <td class="tat-cell">{{ c.workingDays.toFixed(1) }}d</td>
                    <td>
                      <span :class="['warranty-badge', c.warrantyStatus.includes('Under') ? 'under-warranty' : 'out-warranty']">
                        {{ c.warrantyStatus }}
                      </span>
                    </td>
                    <td class="income-cell">{{ money(c.income) }}</td>
                    <td class="model-cell">{{ c.model || '-' }}</td>
                    <td class="serial-cell">{{ c.serialNo || '-' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      <div class="card" style="padding: 20px;">
        <strong style="font-size: 16px; color: #111827;">Dashboard Summary</strong>
        <p style="margin: 4px 0 16px; font-size: 12px; color: #6b7280;">Quick overview of current view</p>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #2563eb;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Total Cases</div>
            <div style="font-size: 20px; font-weight: 700; color: #111827;">{{ filteredRows.length }}</div>
          </div>
          
          <div style="padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #10b981;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Avg TAT</div>
            <div style="font-size: 20px; font-weight: 700; color: #111827;">{{ (filteredRows.reduce((s, r) => s + r.workingDays, 0) / filteredRows.length || 0).toFixed(1) }}d</div>
          </div>
          
          <div style="padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #f59e0b;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">BR Rate</div>
            <div style="font-size: 20px; font-weight: 700; color: #111827;">{{ ((filteredRows.filter(r => r.br).length / filteredRows.length || 0) * 100).toFixed(1) }}%</div>
          </div>
          
          <div style="padding: 12px; background: #f9fafb; border-radius: 8px; border-left: 3px solid #8b5cf6;">
            <div style="font-size: 11px; color: #6b7280; margin-bottom: 4px;">Total Income</div>
            <div style="font-size: 20px; font-weight: 700; color: #111827;">{{ money(filteredRows.reduce((s, r) => s + Number(r.income || 0), 0)) }}</div>
          </div>
        </div>
        
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
          <div style="font-size: 11px; color: #6b7280; margin-bottom: 8px;">Active Filters</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            <span v-if="tableFilter.shopType !== 'All'" style="padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500;">{{ tableFilter.shopType }}</span>
            <span v-if="tableFilter.status !== 'All'" style="padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500;">{{ tableFilter.status }}</span>
            <span v-if="tableFilter.warranty !== 'All'" style="padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500;">{{ tableFilter.warranty }}</span>
            <span v-if="tableFilter.br !== 'All'" style="padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500;">{{ tableFilter.br }}</span>
            <span v-if="tableFilter.shop" style="padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500;">Shop: {{ tableFilter.shop }}</span>
            <span v-if="tableFilter.category" style="padding: 4px 10px; background: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 11px; font-weight: 500;">{{ tableFilter.category }}</span>
            <span v-if="!tableFilter.shopType && tableFilter.status === 'All' && tableFilter.warranty === 'All' && tableFilter.br === 'All' && !tableFilter.shop && !tableFilter.category" style="padding: 4px 10px; background: #f3f4f6; color: #6b7280; border-radius: 12px; font-size: 11px;">No filters applied</span>
          </div>
        </div>
        
        <div style="margin-top: 12px; font-size: 11px; color: #9ca3af;">
          BR = device repaired again within 30 days
        </div>
      </div>
    </div>

    <div class="grid charts"><div class="card"><strong>Service TAT Distribution</strong><div id="serviceTatChart" class="chart"></div></div><div class="card"><strong>Document Status</strong><div id="docStatusChart" class="chart"></div></div><div class="card"><strong>Warranty vs Income Pressure</strong><div id="warrantyIncomeChart" class="chart"></div></div></div>

    <div class="grid bottom">
      <div class="card">
        <strong>BR Rate / Repeat Repairs</strong>
        <div id="brChart" class="chart"></div>
      </div>
      <div class="card">
        <strong>Key Hotspots</strong>
        <ul class="list">
          <li v-for="x in hotspots" :key="x.name">{{ x.name }} — {{ x.count }} cases <span class="muted">({{ x.share }}%)</span></li>
        </ul>
      </div>
    </div>

    <div class="card" style="margin-top: 16px; padding: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div>
          <strong style="font-size: 16px;">Quick Access</strong>
          <p class="muted" style="margin: 4px 0 0;">Jump to related views</p>
        </div>
      </div>
      <div style="display: flex; gap: 12px; flex-wrap: wrap;">
        <RouterLink to="/inventory" class="quick-link">
          <span class="quick-link-icon">📦</span>
          <span class="quick-link-text">
            <strong>Inventory Overview</strong>
            <span class="muted" style="display: block; font-size: 12px; margin-top: 2px;">Stock levels for HA & Laptops</span>
          </span>
        </RouterLink>
      </div>
    </div>



    <div v-if="store.loading" class="loading">Loading…</div>
  </div>
</template>
