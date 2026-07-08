<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { store } from '../store'

const route = useRoute()
const jsNo = computed(() => String(route.params.jsNo || ''))
const caseItem = computed(() => store.getRowByJsNo(jsNo.value))
const relatedCases = computed(() => caseItem.value ? store.getRelatedCases(caseItem.value.imei, caseItem.value.jsNo) : [])
const shopDetail = ref(null)
const loadingShop = ref(false)

function money(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(Number(v || 0))
}

function isRepairComplete(status) {
  const s = String(status || '').toLowerCase()
  return s.includes('repair completed') || s.includes('completed')
}

function approvalOwner(item) {
  if (!item) return 'Unknown'
  const s = String(item.docStatus || '').toLowerCase()
  if (s.includes('assigned')) return 'Technician / Assignment Queue'
  if (s.includes('open')) return 'Service Desk / Dispatcher'
  if (s.includes('repair completed')) return 'Customer / Return Desk'
  return 'Operations Review'
}

function escalationStatus(item) {
  if (!item) return 'Unknown'
  if (item.workingDays >= 7) return 'High'
  if (item.workingDays >= 3) return 'Medium'
  return 'Low'
}

function escalationClass(item) {
  const status = escalationStatus(item)
  if (status === 'High') return 'escalation-high'
  if (status === 'Medium') return 'escalation-medium'
  return 'escalation-low'
}

function approvalPending(item) {
  if (!item) return 'N/A'
  const s = String(item.docStatus || '').toLowerCase()
  if (s.includes('open')) return 'Approval pending from dispatch'
  if (s.includes('assigned')) return 'Technician action pending'
  if (s.includes('repair completed')) return 'Return approval / closure pending'
  return 'Further review required'
}

function statusClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('repair completed') || s.includes('returned')) return 'status-completed'
  if (s.includes('open') || s.includes('assigned')) return 'status-pending'
  return 'status-default'
}

async function loadShopDetail() {
  if (!caseItem.value || !isRepairComplete(caseItem.value.docStatus)) return
  
  loadingShop.value = true
  try {
    const detail = await store.fetchShopDetail(caseItem.value.shopCode)
    shopDetail.value = detail || {
      shopName: caseItem.value.shop,
      ownerName: caseItem.value.customerName || 'Not available',
      ownerPhone: caseItem.value.customerPhone || 'Not available',
      ownerEmail: 'Not available'
    }
  } catch (e) {
    console.error('Failed to load shop detail:', e)
    shopDetail.value = {
      shopName: caseItem.value.shop,
      ownerName: caseItem.value.customerName || 'Not available',
      ownerPhone: caseItem.value.customerPhone || 'Not available',
      ownerEmail: 'Not available'
    }
  } finally {
    loadingShop.value = false
  }
}

onMounted(() => {
  loadShopDetail()
})
</script>

<template>
  <div class="app" v-if="caseItem">
    <div class="topbar">
      <div class="title">
        <h1>Case Details</h1>
        <p>Comprehensive view for {{ caseItem.jsNo }}</p>
      </div>
      <RouterLink to="/" class="back-link">← Back to dashboard</RouterLink>
    </div>

    <!-- KPI Cards -->
    <div class="grid kpis">
      <div class="card kpi">
        <div class="label">JS Number</div>
        <div class="value">{{ caseItem.jsNo }}</div>
        <div class="sub">Case identifier</div>
      </div>
      <div class="card kpi">
        <div class="label">Pending Days</div>
        <div class="value">{{ caseItem.calendarDays }}d</div>
        <div class="sub">Since created</div>
      </div>
      <div class="card kpi">
        <div class="label">Escalation</div>
        <div :class="['value', escalationClass(caseItem)]">{{ escalationStatus(caseItem) }}</div>
        <div class="sub">Risk level</div>
      </div>
      <div class="card kpi">
        <div class="label">Approval Owner</div>
        <div class="value" style="font-size: 16px;">{{ approvalOwner(caseItem) }}</div>
        <div class="sub">Current owner</div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="grid detail-grid">
      <!-- Case Summary -->
      <div class="card detail-card">
        <div class="card-header">
          <strong>Case Summary</strong>
          <span :class="['status-badge', statusClass(caseItem.docStatus)]">{{ caseItem.docStatus }}</span>
        </div>
        <div class="detail-list">
          <div class="detail-row">
            <span class="detail-label">Shop</span>
            <b class="detail-value">{{ caseItem.shop }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Created</span>
            <b class="detail-value">{{ caseItem.createdOn }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Service TAT</span>
            <b class="detail-value">{{ caseItem.calendarDays }} days</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Warranty</span>
            <b class="detail-value">{{ caseItem.warrantyStatus }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Income</span>
            <b class="detail-value">{{ money(caseItem.income) }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Brand / Model</span>
            <b class="detail-value">{{ caseItem.brand }} / {{ caseItem.model || 'N/A' }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Serial Number</span>
            <b class="detail-value">{{ caseItem.serialNo || 'N/A' }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Category</span>
            <b class="detail-value">{{ caseItem.category || 'N/A' }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Complaint</span>
            <b class="detail-value">{{ caseItem.complaint || 'N/A' }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Document Status</span>
            <b class="detail-value">{{ caseItem.returned ? 'Returned' : 'Not Returned' }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">BR Flag</span>
            <b :class="['detail-value', caseItem.br ? 'br-yes' : '']">{{ caseItem.br ? 'Yes - Repeat Repair' : 'No' }}</b>
          </div>
        </div>
      </div>

      <!-- Escalation & Approval -->
      <div class="card detail-card">
        <div class="card-header">
          <strong>Escalation & Approval</strong>
        </div>
        <div class="detail-list">
          <div class="detail-row">
            <span class="detail-label">Escalation Status</span>
            <b :class="['detail-value', escalationClass(caseItem)]">{{ escalationStatus(caseItem) }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Pending Approval With</span>
            <b class="detail-value">{{ approvalOwner(caseItem) }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Pending Action</span>
            <b class="detail-value">{{ approvalPending(caseItem) }}</b>
          </div>
          <div class="detail-row">
            <span class="detail-label">Likely Next Step</span>
            <b class="detail-value">{{ caseItem.calendarDays > 5 ? 'Escalate to supervisor' : 'Follow up with current owner' }}</b>
          </div>
        </div>
      </div>
    </div>

    <!-- Shop Owner Info (only for repair completed) -->
    <div class="card detail-card" v-if="isRepairComplete(caseItem.docStatus)">
      <div class="card-header">
        <strong>Shop Owner Information</strong>
        <span v-if="loadingShop" class="loading-badge">Loading...</span>
      </div>
      <div v-if="shopDetail" class="detail-list">
        <div class="detail-row" v-if="shopDetail.shopName">
          <span class="detail-label">Shop Name</span>
          <b class="detail-value">{{ shopDetail.shopName }}</b>
        </div>
        <div class="detail-row" v-if="shopDetail.ownerName">
          <span class="detail-label">Owner Name</span>
          <b class="detail-value">{{ shopDetail.ownerName }}</b>
        </div>
        <div class="detail-row" v-if="shopDetail.ownerPhone">
          <span class="detail-label">Owner Phone</span>
          <b class="detail-value">{{ shopDetail.ownerPhone }}</b>
        </div>
        <div class="detail-row" v-if="shopDetail.ownerEmail">
          <span class="detail-label">Owner Email</span>
          <b class="detail-value">{{ shopDetail.ownerEmail }}</b>
        </div>
        <div class="detail-row" v-if="shopDetail.address">
          <span class="detail-label">Address</span>
          <b class="detail-value">{{ shopDetail.address }}</b>
        </div>
        <div class="detail-row" v-if="shopDetail.city">
          <span class="detail-label">City</span>
          <b class="detail-value">{{ shopDetail.city }}</b>
        </div>
      </div>
      <div v-else-if="!loadingShop" class="empty-state">
        <p class="muted">Shop owner information not available</p>
      </div>
    </div>

    <!-- Related Cases -->
    <div class="card detail-card">
      <div class="card-header">
        <strong>Related Cases by Same Serial Number</strong>
        <span class="badge">{{ relatedCases.length }}</span>
      </div>
      <p class="muted" v-if="!relatedCases.length">No other cases found for this serial number.</p>
      <div v-else class="related-list">
        <RouterLink 
          v-for="r in relatedCases" 
          :key="r.jsNo" 
          :to="{ name: 'case-detail', params: { jsNo: r.jsNo } }" 
          class="related-item"
        >
          <div class="related-header">
            <span class="related-jsno">{{ r.jsNo }}</span>
            <span :class="['status-badge', 'status-small', statusClass(r.docStatus)]">{{ r.docStatus }}</span>
          </div>
          <div class="related-details">
            <span>{{ r.calendarDays }}d</span>
            <span>{{ r.shop }}</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>

  <div v-else class="app">
    <div class="card">
      <h2>Case not found</h2>
      <p class="muted">The dashboard data may still be loading, or this JS number is not in the current window.</p>
      <RouterLink to="/" class="back-link">← Back to dashboard</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

@media (min-width: 900px) {
  .detail-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.detail-card {
  padding: 20px;
  overflow: hidden;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e5e7eb;
}

.card-header strong {
  font-size: 16px;
  color: #111827;
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 600;
}

.status-completed {
  background: #d1fae5;
  color: #065f46;
}

.status-pending {
  background: #fef3c7;
  color: #92400e;
}

.status-default {
  background: #f3f4f6;
  color: #374151;
}

.status-small {
  padding: 2px 8px;
  font-size: 11px;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 8px 0;
  border-bottom: 1px solid #f3f4f6;
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  min-width: 140px;
}

.detail-value {
  color: #111827;
  font-size: 13px;
  text-align: right;
  flex: 1;
  word-break: break-word;
  overflow-wrap: break-word;
  margin-left: 12px;
}

.escalation-high {
  color: #dc2626;
  font-weight: 700;
}

.escalation-medium {
  color: #f59e0b;
  font-weight: 600;
}

.escalation-low {
  color: #10b981;
  font-weight: 500;
}

.br-yes {
  color: #dc2626;
  font-weight: 600;
}

.loading-badge {
  padding: 4px 12px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  background: #2563eb;
  color: white;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
}

.empty-state {
  padding: 20px;
  text-align: center;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.related-item {
  display: block;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: all 0.15s;
  border: 1px solid #e5e7eb;
}

.related-item:hover {
  background: #f3f4f6;
  border-color: #2563eb;
  transform: translateY(-1px);
}

.related-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.related-jsno {
  font-weight: 600;
  color: #111827;
  font-size: 14px;
}

.related-details {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #6b7280;
}

.back-link {
  padding: 8px 16px;
  background: #2563eb;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.15s;
}

.back-link:hover {
  background: #1d4ed8;
}
</style>
