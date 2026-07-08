<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import * as echarts from 'echarts'
import ExcelJS from 'exceljs'

const warehouseOptions = [
  { label: 'Kenya-MWH', value: 'KE0001', warehouseId: '14dd7a7536a840bd53cea8eb12df0dd8' },
  { label: 'Kenya-L4-HA', value: 'KE0028', warehouseId: '101d2fdcea16ca0a2b2a14cc15546cc5' },
]

const selectedWarehouse = ref('KE0001')
const loading = ref(false)
const live = ref(false)
const lastUpdated = ref('')
const inventoryRows = ref([])
const inventoryMeta = ref({ total: 0, pages: 0, current: 1, size: 1000 })
const tableFilter = ref({ search: '', category: 'All', status: 'All', stock: 'All', sort: 'available_desc' })
const appliedFilter = ref({ search: '', category: 'All', status: 'All', stock: 'All', sort: 'available_desc' })
const categoryChart = ref(null)
const statusChart = ref(null)
let timer

const warehouseLabel = computed(() => warehouseOptions.find(w => w.value === selectedWarehouse.value)?.label || selectedWarehouse.value)

const categories = computed(() => {
  const cats = new Map()
  inventoryRows.value.forEach(r => {
    const cat = r.materialGroupDescription || 'Unknown'
    cats.set(cat, (cats.get(cat) || 0) + Number(r.numAvailable || 0))
  })
  return [...cats.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty)
})

const filteredRows = computed(() => {
  let rows = [...inventoryRows.value]
  const q = appliedFilter.value.search.trim().toLowerCase()
  if (q) {
    rows = rows.filter(r => [r.materialCode, r.materialDesc, r.modelId, r.binName, r.warehouseName, r.zoneName, r.materialGroupDescription, r.materialStatusName, r.snNum1, r.snNum2].join(' ').toLowerCase().includes(q))
  }
  if (appliedFilter.value.category !== 'All') {
    rows = rows.filter(r => r.materialGroupDescription === appliedFilter.value.category)
  }
  if (appliedFilter.value.status !== 'All') {
    rows = rows.filter(r => r.materialStatusName === appliedFilter.value.status)
  }
  if (appliedFilter.value.stock === 'Low') {
    rows = rows.filter(r => Number(r.numAvailable || 0) > 0 && Number(r.numAvailable || 0) <= 2)
  } else if (appliedFilter.value.stock === 'Out') {
    rows = rows.filter(r => Number(r.numAvailable || 0) === 0)
  }
  const [field, direction] = appliedFilter.value.sort.split('_')
  rows.sort((a, b) => {
    const valA = field === 'available' ? Number(a.numAvailable || 0) : field === 'total' ? Number(a.numTotal || 0) : String(a.materialDesc || '')
    const valB = field === 'available' ? Number(b.numAvailable || 0) : field === 'total' ? Number(b.numTotal || 0) : String(b.materialDesc || '')
    if (typeof valA === 'string') return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA)
    return direction === 'asc' ? valA - valB : valB - valA
  })
  return rows
})

function applyFilters() {
  appliedFilter.value = { ...tableFilter.value }
}

function clearFilters() {
  tableFilter.value = { search: '', category: 'All', status: 'All', stock: 'All', sort: 'available_desc' }
  appliedFilter.value = { ...tableFilter.value }
}

const kpis = computed(() => {
  const total = inventoryRows.value.length || 0
  const available = inventoryRows.value.reduce((s, r) => s + Number(r.numAvailable || 0), 0)
  const frozen = inventoryRows.value.reduce((s, r) => s + Number(r.numFrozen || 0), 0)
  const lowStock = inventoryRows.value.filter(r => Number(r.numAvailable || 0) > 0 && Number(r.numAvailable || 0) <= 2).length
  const outStock = inventoryRows.value.filter(r => Number(r.numAvailable || 0) === 0).length
  return [
    { label: 'Materials', value: String(total), sub: 'Unique lines' },
    { label: 'Available Qty', value: String(available), sub: 'Ready stock' },
    { label: 'Frozen Qty', value: String(frozen), sub: 'Blocked stock' },
    { label: 'Low Stock', value: String(lowStock), sub: '1–2 available' },
    { label: 'Out Stock', value: String(outStock), sub: 'Zero available' },
    { label: 'Warehouse', value: warehouseLabel.value, sub: 'Selected store' },
  ]
})

const goodMaterialQty = computed(() => {
  return inventoryRows.value
    .filter(r => r.materialStatusName === 'Good')
    .reduce((s, r) => s + Number(r.numAvailable || 0), 0)
})

const defectiveMaterialQty = computed(() => {
  return inventoryRows.value
    .filter(r => r.materialStatusName === 'Defective' || r.materialStatusName === 'Damaged')
    .reduce((s, r) => s + Number(r.numAvailable || 0), 0)
})

const goodMaterialRows = computed(() => {
  return inventoryRows.value
    .filter(r => r.materialStatusName === 'Good' && Number(r.numAvailable || 0) > 0)
    .sort((a, b) => Number(b.numAvailable || 0) - Number(a.numAvailable || 0))
})

const defectiveMaterialRows = computed(() => {
  return inventoryRows.value
    .filter(r => r.materialStatusName === 'Defective' || r.materialStatusName === 'Damaged')
    .sort((a, b) => Number(b.numAvailable || 0) - Number(a.numAvailable || 0))
})

const expandedCard = ref(null)

function toggleCard(type) {
  expandedCard.value = expandedCard.value === type ? null : type
}

async function exportGoodMaterial() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Good Material')
  sheet.columns = [
    { header: 'Material Code', key: 'materialCode', width: 18 },
    { header: 'Description', key: 'materialDesc', width: 32 },
    { header: 'Available', key: 'numAvailable', width: 12 },
    { header: 'Bin', key: 'binName', width: 14 },
    { header: 'Category', key: 'materialGroupDescription', width: 24 },
    { header: 'Status', key: 'materialStatusName', width: 16 },
  ]
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10B981' } }
  header.alignment = { horizontal: 'center' }
  goodMaterialRows.value.forEach(r => sheet.addRow({
    materialCode: r.materialCode || '',
    materialDesc: r.materialDesc || '',
    numAvailable: r.numAvailable,
    binName: r.binName || '',
    materialGroupDescription: r.materialGroupDescription || '',
    materialStatusName: r.materialStatusName || '',
  }))
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `good-material-${new Date().toISOString().slice(0,10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportDefectiveMaterial() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Defective Material')
  sheet.columns = [
    { header: 'Material Code', key: 'materialCode', width: 18 },
    { header: 'Description', key: 'materialDesc', width: 32 },
    { header: 'Available', key: 'numAvailable', width: 12 },
    { header: 'Bin', key: 'binName', width: 14 },
    { header: 'Category', key: 'materialGroupDescription', width: 24 },
    { header: 'Status', key: 'materialStatusName', width: 16 },
  ]
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF4444' } }
  header.alignment = { horizontal: 'center' }
  defectiveMaterialRows.value.forEach(r => sheet.addRow({
    materialCode: r.materialCode || '',
    materialDesc: r.materialDesc || '',
    numAvailable: r.numAvailable,
    binName: r.binName || '',
    materialGroupDescription: r.materialGroupDescription || '',
    materialStatusName: r.materialStatusName || '',
  }))
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `defective-material-${new Date().toISOString().slice(0,10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

async function fetchInventory() {
  loading.value = true
  try {
    const warehouse = warehouseOptions.find(w => w.value === selectedWarehouse.value)
    const res = await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current: 1,
        size: 1000,
        warehouseIdList: [warehouse.warehouseId],
      }),
    })
    const data = await res.json()
    if (data.code !== '0') throw new Error(data.message || 'Failed to load inventory')
    const page = data.data || {}
    inventoryRows.value = (page.records || []).map(r => ({
      ...r,
      numAvailable: Number(r.numAvailable || 0),
      numFrozen: Number(r.numFrozen || 0),
      numTotal: Number(r.numTotal || 0),
    }))
    inventoryMeta.value = { total: page.total || 0, pages: page.pages || 0, current: page.current || 1, size: page.size || 1000 }
    live.value = true
    lastUpdated.value = new Date().toLocaleString()
    renderCharts()
  } catch (e) {
    console.error('Failed to load inventory:', e)
    inventoryRows.value = []
    inventoryMeta.value = { total: 0, pages: 0, current: 1, size: 1000 }
    live.value = false
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Inventory')
  sheet.columns = [
    { header: 'Material Code', key: 'materialCode', width: 18 },
    { header: 'Description', key: 'materialDesc', width: 32 },
    { header: 'Warehouse', key: 'warehouseName', width: 20 },
    { header: 'Bin', key: 'binName', width: 14 },
    { header: 'Zone', key: 'zoneName', width: 18 },
    { header: 'Available', key: 'numAvailable', width: 12 },
    { header: 'Frozen', key: 'numFrozen', width: 12 },
    { header: 'Total', key: 'numTotal', width: 12 },
    { header: 'Category', key: 'materialGroupDescription', width: 24 },
    { header: 'Status', key: 'materialStatusName', width: 16 },
    { header: 'Serialized', key: 'isSerialized', width: 12 },
    { header: 'SN1', key: 'snNum1', width: 20 },
    { header: 'SN2', key: 'snNum2', width: 20 },
  ]
  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } }
  header.alignment = { horizontal: 'center' }
  filteredRows.value.forEach(r => sheet.addRow({
    materialCode: r.materialCode || '',
    materialDesc: r.materialDesc || '',
    warehouseName: r.warehouseName || '',
    binName: r.binName || '',
    zoneName: r.zoneName || '',
    numAvailable: r.numAvailable,
    numFrozen: r.numFrozen,
    numTotal: r.numTotal,
    materialGroupDescription: r.materialGroupDescription || '',
    materialStatusName: r.materialStatusName || '',
    isSerialized: r.isSerialized ? 'Yes' : 'No',
    snNum1: r.snNum1 || '',
    snNum2: r.snNum2 || '',
  }))
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inventory-${selectedWarehouse.value}-${new Date().toISOString().slice(0,10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function renderCharts() {
  const categoryMap = new Map()
  const statusMap = new Map()
  inventoryRows.value.forEach(r => {
    categoryMap.set(r.materialGroupDescription || 'Unknown', (categoryMap.get(r.materialGroupDescription || 'Unknown') || 0) + Number(r.numAvailable || 0))
    statusMap.set(r.materialStatusName || 'Unknown', (statusMap.get(r.materialStatusName || 'Unknown') || 0) + Number(r.numAvailable || 0))
  })
  categoryChart.value?.setOption({
    tooltip: { trigger: 'axis' },
    grid: { left: 30, right: 10, top: 20, bottom: 30, containLabel: true },
    xAxis: { type: 'category', data: [...categoryMap.keys()].slice(0, 8), axisLabel: { rotate: 25 } },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [...categoryMap.values()].slice(0, 8), itemStyle: { color: '#2563eb', borderRadius: [6, 6, 0, 0] } }],
  })
  statusChart.value?.setOption({
    tooltip: { trigger: 'item' },
    series: [{ type: 'pie', radius: ['45%', '70%'], label: { formatter: '{b}: {d}%' }, data: [...statusMap.entries()].map(([name, value]) => ({ name, value })) }],
  })
}

function initCharts() {
  categoryChart.value = echarts.init(document.getElementById('categoryChart'))
  statusChart.value = echarts.init(document.getElementById('statusChart'))
  window.addEventListener('resize', resizeCharts)
}

function resizeCharts() {
  categoryChart.value?.resize()
  statusChart.value?.resize()
}

watch(selectedWarehouse, () => {
  fetchInventory()
})

onMounted(async () => {
  initCharts()
  await fetchInventory()
  timer = setInterval(fetchInventory, 60000)
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
        <h1>Inventory Overview</h1>
        <p>CRM WMS → Queries for Inventory → Inventory Detail</p>
      </div>
      <RouterLink to="/" class="back-link">← Back to dashboard</RouterLink>
    </div>

    <div class="card" style="margin-bottom: 16px; display:flex; gap:12px; flex-wrap:wrap; align-items:end; justify-content:space-between;">
      <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:end;">
        <div style="min-width:220px;">
          <label style="display:block; font-size:12px; color:#6b7280; margin-bottom:6px;">Store</label>
          <select v-model="selectedWarehouse" class="filter-select-field" style="min-width:220px;">
            <option v-for="w in warehouseOptions" :key="w.value" :value="w.value">{{ w.label }}</option>
          </select>
        </div>
        <div style="min-width:320px;">
          <label style="display:block; font-size:12px; color:#6b7280; margin-bottom:6px;">Search</label>
          <input v-model="tableFilter.search" type="text" placeholder="Search material, bin, model, serial, status..." class="filter-input-field" style="min-width:320px;" />
        </div>
        <div style="min-width:220px;">
          <label style="display:block; font-size:12px; color:#6b7280; margin-bottom:6px;">Category</label>
          <select v-model="tableFilter.category" class="filter-select-field" style="min-width:220px;">
            <option value="All">All Categories</option>
            <option v-for="c in categories.slice(0, 30)" :key="c.name" :value="c.name">{{ c.name }}</option>
          </select>
        </div>
        <div style="min-width:220px;">
          <label style="display:block; font-size:12px; color:#6b7280; margin-bottom:6px;">Status</label>
          <select v-model="tableFilter.status" class="filter-select-field" style="min-width:220px;">
            <option value="All">All Status</option>
            <option value="Good">Good</option>
            <option value="Defective">Defective</option>
            <option value="Damaged">Damaged</option>
            <option value="Frozen">Frozen</option>
          </select>
        </div>
        <div style="min-width:180px;">
          <label style="display:block; font-size:12px; color:#6b7280; margin-bottom:6px;">Stock</label>
          <select v-model="tableFilter.stock" class="filter-select-field" style="min-width:180px;">
            <option value="All">All Stock</option>
            <option value="Low">Low Stock</option>
            <option value="Out">Out of Stock</option>
          </select>
        </div>
        <div style="min-width:220px;">
          <label style="display:block; font-size:12px; color:#6b7280; margin-bottom:6px;">Sort</label>
          <select v-model="tableFilter.sort" class="filter-select-field" style="min-width:220px;">
            <option value="available_desc">Available Qty: High → Low</option>
            <option value="available_asc">Available Qty: Low → High</option>
            <option value="total_desc">Total Qty: High → Low</option>
            <option value="name_asc">Material Name: A → Z</option>
          </select>
        </div>
        <div style="display:flex; gap:8px; align-items:end;">
          <button class="filter-btn filter-btn-primary" @click="applyFilters">🔍 Search</button>
          <button class="filter-btn" @click="clearFilters">✕ Clear</button>
        </div>
      </div>
      <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end;">
        <div :class="['status', live ? '' : 'warn']">{{ live ? `LIVE • Updated ${lastUpdated}` : 'OFFLINE / DEMO DATA' }}</div>
        <button class="export-btn" @click="exportExcel">⬇ Export Excel</button>
      </div>
    </div>

    <div class="grid kpis">
      <div class="card kpi" v-for="k in kpis" :key="k.label"><div class="label">{{ k.label }}</div><div class="value" style="font-size: 20px;">{{ k.value }}</div><div class="sub">{{ k.sub }}</div></div>
    </div>

    <div class="grid" style="grid-template-columns: 1fr 1fr; margin-top: 16px; gap: 16px;">
      <div class="card kpi clickable-card" :class="{ 'card-active': expandedCard === 'good' }" @click="toggleCard('good')" style="border-left: 4px solid #10b981; background: linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%);">
        <div class="label" style="color: #059669; font-weight: 600;">✓ Good Material Quantity</div>
        <div class="value" style="font-size: 28px; color: #10b981; font-weight: 700;">{{ goodMaterialQty }}</div>
        <div class="sub" style="color: #059669;">Available good stock · Click to view details {{ expandedCard === 'good' ? '▲' : '▼' }}</div>
      </div>
      <div class="card kpi clickable-card" :class="{ 'card-active': expandedCard === 'defective' }" @click="toggleCard('defective')" style="border-left: 4px solid #ef4444; background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);">
        <div class="label" style="color: #dc2626; font-weight: 600;">⚠ Defective Material Quantity</div>
        <div class="value" style="font-size: 28px; color: #ef4444; font-weight: 700;">{{ defectiveMaterialQty }}</div>
        <div class="sub" style="color: #dc2626;">Defective + Damaged stock · Click to view details {{ expandedCard === 'defective' ? '▲' : '▼' }}</div>
      </div>
    </div>

    <!-- Good Material Detail List -->
    <div v-if="expandedCard === 'good'" class="card" style="margin-top: 12px; border-left: 4px solid #10b981;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <div>
          <strong style="color: #059669;">✓ Good Material Details</strong>
          <span class="muted" style="margin-left: 8px;">{{ goodMaterialRows.length }} items · {{ goodMaterialQty }} total qty</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="filter-btn filter-btn-primary" @click.stop="exportGoodMaterial" style="font-size: 12px;">⬇ Export Excel</button>
          <button class="filter-btn" @click.stop="expandedCard = null" style="font-size: 12px;">✕ Close</button>
        </div>
      </div>
      <div class="table-wrap" style="max-height: 400px; overflow-y: auto;">
        <table class="professional-table">
          <thead>
            <tr>
              <th style="width:120px;">Material Code</th>
              <th>Description</th>
              <th style="width:100px;">Available</th>
              <th style="width:80px;">Bin</th>
              <th style="width:140px;">Category</th>
              <th style="width:100px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in goodMaterialRows" :key="'good-' + (r.stockSnId || r.materialCode)">
              <td class="js-cell">{{ r.materialCode || '-' }}</td>
              <td class="complaint-cell">{{ r.materialDesc || '-' }}</td>
              <td class="stock-cell"><span class="stock-num">{{ r.numAvailable }}</span></td>
              <td class="model-cell">{{ r.binName || '-' }}</td>
              <td class="model-cell">{{ r.materialGroupDescription || '-' }}</td>
              <td><span class="status-pill pill-green">{{ r.materialStatusName }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Defective Material Detail List -->
    <div v-if="expandedCard === 'defective'" class="card" style="margin-top: 12px; border-left: 4px solid #ef4444;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <div>
          <strong style="color: #dc2626;">⚠ Defective Material Details</strong>
          <span class="muted" style="margin-left: 8px;">{{ defectiveMaterialRows.length }} items · {{ defectiveMaterialQty }} total qty</span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="filter-btn filter-btn-primary" @click.stop="exportDefectiveMaterial" style="font-size: 12px;">⬇ Export Excel</button>
          <button class="filter-btn" @click.stop="expandedCard = null" style="font-size: 12px;">✕ Close</button>
        </div>
      </div>
      <div class="table-wrap" style="max-height: 400px; overflow-y: auto;">
        <table class="professional-table">
          <thead>
            <tr>
              <th style="width:120px;">Material Code</th>
              <th>Description</th>
              <th style="width:100px;">Available</th>
              <th style="width:80px;">Bin</th>
              <th style="width:140px;">Category</th>
              <th style="width:100px;">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in defectiveMaterialRows" :key="'def-' + (r.stockSnId || r.materialCode)">
              <td class="js-cell">{{ r.materialCode || '-' }}</td>
              <td class="complaint-cell">{{ r.materialDesc || '-' }}</td>
              <td class="stock-cell"><span class="stock-num">{{ r.numAvailable }}</span></td>
              <td class="model-cell">{{ r.binName || '-' }}</td>
              <td class="model-cell">{{ r.materialGroupDescription || '-' }}</td>
              <td><span :class="['status-pill', r.materialStatusName === 'Defective' ? 'pill-red' : 'pill-amber']">{{ r.materialStatusName }}</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="grid charts" style="margin-top: 16px; grid-template-columns: 2fr 1fr 1fr;">
      <div class="card"><strong>Top Inventory Categories</strong><div id="categoryChart" class="chart"></div></div>
      <div class="card"><strong>Stock Status Mix</strong><div id="statusChart" class="chart"></div></div>
      <div class="card">
        <strong>Top Categories</strong>
        <div class="list" style="margin-top: 12px;">
          <div v-for="c in categories.slice(0, 10)" :key="c.name" style="display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid #f3f4f6;">
            <span style="font-size:13px; color:#374151;">{{ c.name }}</span>
            <strong style="font-size:13px; color:#111827;">{{ c.qty }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="card table-card" style="margin-top: 16px;">
      <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div>
          <strong>Inventory Detail Lines</strong>
          <p class="muted" style="margin: 4px 0 0;">Store: {{ warehouseLabel }}</p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <span class="stock-legend"><span class="stock-dot low-dot"></span> Low (1–2)</span>
          <span class="stock-legend"><span class="stock-dot out-dot"></span> Out of Stock</span>
        </div>
      </div>
      <div class="table-wrap">
        <table class="professional-table">
          <thead>
            <tr>
              <th style="width:110px;">Material Code</th>
              <th style="width:220px;">Description</th>
              <th style="width:140px;">Warehouse</th>
              <th style="width:80px;">Bin</th>
              <th style="width:120px;">Zone</th>
              <th style="width:90px;">Available</th>
              <th style="width:80px;">Frozen</th>
              <th style="width:80px;">Total</th>
              <th style="width:160px;">Category</th>
              <th style="width:100px;">Status</th>
              <th style="width:70px;">Serial</th>
              <th style="width:140px;">SN1</th>
              <th style="width:140px;">SN2</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in filteredRows" :key="r.stockSnId || `${r.materialCode}-${r.binId}`" :class="{ 'low-stock': r.numAvailable <= 2 && r.numAvailable > 0, 'out-of-stock': r.numAvailable === 0 }">
              <td class="js-cell">{{ r.materialCode || '-' }}</td>
              <td class="complaint-cell">{{ r.materialDesc || '-' }}</td>
              <td class="shop-cell">{{ r.warehouseName || '-' }}</td>
              <td class="model-cell">{{ r.binName || '-' }}</td>
              <td class="model-cell">{{ r.zoneName || '-' }}</td>
              <td class="stock-cell">
                <span class="stock-num">{{ r.numAvailable }}</span>
                <span v-if="r.numAvailable === 0" class="stock-badge out">OUT</span>
                <span v-else-if="r.numAvailable <= 2" class="stock-badge low">LOW</span>
              </td>
              <td>{{ r.numFrozen }}</td>
              <td>{{ r.numTotal }}</td>
              <td class="model-cell">{{ r.materialGroupDescription || '-' }}</td>
              <td><span :class="['status-pill', r.materialStatusName === 'Good' ? 'pill-green' : r.materialStatusName === 'Defective' ? 'pill-red' : 'pill-amber']">{{ r.materialStatusName || '-' }}</span></td>
              <td>{{ r.isSerialized ? 'Yes' : 'No' }}</td>
              <td class="serial-cell">{{ r.snNum1 || '-' }}</td>
              <td class="serial-cell">{{ r.snNum2 || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="footer">Showing {{ filteredRows.length }} of {{ inventoryMeta.total }} lines. Auto-refresh every 60 seconds.</div>
    </div>

    <div v-if="loading && !inventoryRows.length" class="loading">Loading…</div>
  </div>
</template>

<style scoped>
.clickable-card {
  cursor: pointer;
  transition: all 0.2s ease;
}
.clickable-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.clickable-card.card-active {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style>
