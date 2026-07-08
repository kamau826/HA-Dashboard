<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import ExcelJS from 'exceljs'
import { store } from '../store'

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

const uniqueShops = computed(() => {
  const shops = new Set()
  normalizedRows.value.forEach(r => {
    if (r.shop) shops.add(r.shop)
  })
  return [...shops].sort()
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
        return searchTerms.every(term => searchableText.includes(term))
      })
    }
  }
  if (tableFilter.value.shopType !== 'All') {
    result = result.filter(r => r.shop.includes(tableFilter.value.shopType))
  }
  if (tableFilter.value.shop) {
    result = result.filter(r => r.shop === tableFilter.value.shop)
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
    const valB = field === 'date' ? new Date(b.createdAt || b.createdOn).getTime() : field === 'tat' ? b.serviceTAT : a.income
    return direction === 'asc' ? valA - valB : valB - valA
  })
})

const longestPending = computed(() => normalizedRows.value.filter(r => !r.returned && r.workingDays > 7).sort((a, b) => b.workingDays - a.workingDays))

function pillClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('repair completed')) return 'pill green'
  if (s.includes('open') || s.includes('assigned')) return 'pill amber'
  return 'pill red'
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
  timer = setInterval(async () => { await store.fetchData() }, 60000)
})

onBeforeUnmount(() => { clearInterval(timer) })
</script>

<template>
  <div class="app">
    <div class="topbar">
      <div class="title">
        <h1>Work Area</h1>
        <p>Long pending cases and detailed case management</p>
      </div>
      <div :class="['status', store.live ? '' : 'warn']">{{ store.live ? `LIVE • Updated ${store.lastUpdated}` : 'OFFLINE / DEMO DATA' }}</div>
    </div>

    <!-- Long Pending Cases -->
    <div class="card" style="padding: 20px; margin-bottom: 16px;">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:14px;">
        <div>
          <strong style="color: #b91c1c; font-size: 16px;">⏳ Long Pending Cases</strong>
          <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">Cases above 7 working days (Sunday excluded, Saturday counts as half day)</p>
        </div>
        <span style="display:inline-flex; align-items:center; padding:6px 14px; border-radius:999px; background:linear-gradient(135deg, #fef2f2, #fee2e2); color:#991b1b; font-size:13px; font-weight:700; box-shadow:0 1px 3px rgba(153,27,27,0.15);">{{ longestPending.length }} cases</span>
      </div>
      <div v-if="longestPending.length === 0" style="padding: 40px; text-align: center; color: #6b7280;">
        <p>No cases pending above 7 working days. Great job!</p>
      </div>
      <div v-else style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px;">
        <RouterLink v-for="p in longestPending" :key="p.jsNo" :to="{ name: 'case-detail', params: { jsNo: p.jsNo } }" style="display:block; text-decoration:none; color:inherit;">
          <div style="padding: 14px 14px 12px; background: linear-gradient(180deg, #fff, #fff7f7); border: 1px solid #fecaca; border-left: 5px solid #dc2626; border-radius: 12px; box-shadow: 0 1px 2px rgba(0,0,0,.04); transition: transform .15s, box-shadow .15s;">
            <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px;">
              <div>
                <div style="font-weight: 700; color: #7f1d1d; font-size: 14px;">{{ p.jsNo }}</div>
                <div style="margin-top:4px; color:#6b7280; font-size:12px;">{{ p.shop }}</div>
              </div>
              <div style="text-align:right; min-width:120px;">
                <div style="font-size:22px; font-weight:800; color:#b91c1c; line-height:1;">{{ p.workingDays.toFixed(1) }}d</div>
                <div style="font-size:11px; color:#7c2d12; margin-top:4px;">working days</div>
              </div>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; font-size:11px;">
              <span style="padding:4px 8px; background:#f3f4f6; color:#374151; border-radius:999px;">{{ p.docStatus }}</span>
              <span v-if="p.category" style="padding:4px 8px; background:#eff6ff; color:#1e40af; border-radius:999px;">{{ p.category }}</span>
              <span v-if="p.model" style="padding:4px 8px; background:#ecfeff; color:#155e75; border-radius:999px;">{{ p.model }}</span>
              <span v-if="p.serialNo" style="padding:4px 8px; background:#f5f3ff; color:#6d28d9; border-radius:999px;">SN: {{ p.serialNo }}</span>
              <span v-if="p.complaint" style="padding:4px 8px; background:#fff7ed; color:#9a3412; border-radius:999px;">{{ p.complaint }}</span>
            </div>
          </div>
        </RouterLink>
      </div>
    </div>

    <!-- Data Table -->
    <div class="card table-card">
      <strong>Detailed Case Data</strong>
      <div class="filter-bar">
        <div class="filter-bar-main">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input v-model="tableFilter.search" type="text" placeholder="Search JS No, Shop, Complaint, Customer, Model, Serial, Category, Brand..." class="search-input" />
          </div>
          <div class="filter-bar-actions">
            <button @click="showFilters = !showFilters" :class="['toggle-filters-btn', showFilters ? 'active' : '']">
              {{ showFilters ? '✕ Hide Filters' : '⚙ Filters' }}
            </button>
            <button @click="exportExcel" class="export-btn" title="Export filtered data as formatted Excel">⬇ Export Excel</button>
          </div>
        </div>
        <div v-if="showFilters" class="advanced-filters">
          <div class="filter-group">
            <label>Shop Type</label>
            <select v-model="tableFilter.shopType" class="filter-select-field">
              <option value="All">All Shop Types</option>
              <option v-for="type in shopTypes" :key="type" :value="type">{{ type }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Shop</label>
            <select v-model="tableFilter.shop" class="filter-select-field">
              <option value="">All Shops</option>
              <option v-for="s in uniqueShops" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Status</label>
            <select v-model="tableFilter.status" class="filter-select-field">
              <option value="All">All Status</option>
              <option value="10-Open">Open</option>
              <option value="20-Assigned">Assigned</option>
              <option value="90-Repair Completed">Completed</option>
              <option value="100-Returned">Returned</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Warranty</label>
            <select v-model="tableFilter.warranty" class="filter-select-field">
              <option value="All">All Warranty</option>
              <option value="Under Warranty">Under Warranty</option>
              <option value="Out Warranty">Out Warranty</option>
            </select>
          </div>
          <div class="filter-group">
            <label>BR Flag</label>
            <select v-model="tableFilter.br" class="filter-select-field">
              <option value="All">All Cases</option>
              <option value="BR">BR Only</option>
              <option value="No BR">No BR</option>
            </select>
          </div>
          <div class="filter-group">
            <label>Model</label>
            <input v-model="tableFilter.model" type="text" placeholder="Filter by model..." class="filter-input-field" />
          </div>
          <div class="filter-group">
            <label>Serial No</label>
            <input v-model="tableFilter.serialNo" type="text" placeholder="Filter by serial..." class="filter-input-field" />
          </div>
          <div class="filter-group">
            <label>Customer</label>
            <input v-model="tableFilter.customer" type="text" placeholder="Filter by customer..." class="filter-input-field" />
          </div>
          <div class="filter-group">
            <label>Category</label>
            <input v-model="tableFilter.category" type="text" placeholder="Filter by category..." class="filter-input-field" />
          </div>
          <div class="filter-group">
            <label>Sort By</label>
            <select v-model="tableFilter.sort" class="filter-select-field">
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="tat_desc">Highest TAT</option>
              <option value="tat_asc">Lowest TAT</option>
              <option value="income_desc">Highest Income</option>
              <option value="income_asc">Lowest Income</option>
            </select>
          </div>
          <div class="filter-group filter-clear">
            <button @click="clearFilters" class="clear-btn">Clear All</button>
          </div>
        </div>
      </div>
      <div class="table-wrap">
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
              <th>Doc</th>
              <th>BR</th>
              <th>Model</th>
              <th>Serial No</th>
              <th>Complaint</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredRows" :key="r.jsNo + r.shop">
              <td class="js-cell">
                <RouterLink :to="{ name: 'case-detail', params: { jsNo: r.jsNo } }">{{ r.jsNo }}</RouterLink>
              </td>
              <td class="shop-cell">{{ r.shop }}</td>
              <td class="date-cell">{{ r.createdOn }}</td>
              <td>
                <span :class="['status-pill', pillClass(r.docStatus)]">{{ r.docStatus }}</span>
              </td>
              <td class="tat-cell">{{ r.workingDays.toFixed(1) }}d</td>
              <td>
                <span :class="['warranty-badge', r.warrantyStatus.includes('Under') ? 'under-warranty' : 'out-warranty']">
                  {{ r.warrantyStatus }}
                </span>
              </td>
              <td class="income-cell">{{ money(r.income) }}</td>
              <td class="icon-cell">
                <span :class="['doc-icon', r.returned ? 'returned' : 'not-returned']" :title="r.returned ? 'Document Returned' : 'Not Returned'">
                  {{ r.returned ? '✓' : '✗' }}
                </span>
              </td>
              <td class="icon-cell">
                <span v-if="r.br" class="br-icon" title="BR - Repeat Repair"></span>
                <span v-else class="no-br">-</span>
              </td>
              <td class="model-cell">{{ r.model || '-' }}</td>
              <td class="serial-cell">{{ r.serialNo || '-' }}</td>
              <td class="complaint-cell">{{ r.complaint }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="footer">Showing {{ filteredRows.length }} of {{ normalizedRows.length }} cases. Auto-refresh every 60 seconds.</div>
    </div>

    <div v-if="store.loading" class="loading">Loading…</div>
  </div>
</template>
