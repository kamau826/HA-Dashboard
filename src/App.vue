<template>
  <div>
    <nav class="app-nav">
      <div class="nav-brand">
        <RouterLink to="/">HA Dashboard</RouterLink>
      </div>
      <div class="nav-links">
        <RouterLink to="/" class="nav-link" exact-active-class="active">Dashboard</RouterLink>
        <RouterLink to="/work-area" class="nav-link" exact-active-class="active">Work Area</RouterLink>
        <RouterLink to="/inventory" class="nav-link" exact-active-class="active">Inventory Overview</RouterLink>
      </div>
      <!-- Notification Bell -->
      <div class="notif-bell-wrapper" @click.stop="toggleNotifDropdown" style="position:relative;">
        <button class="notif-bell-btn" :class="{ 'has-notif': notifData.count > 0 }">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          <span v-if="notifData.count > 0" class="notif-badge">{{ notifData.count > 9 ? '9+' : notifData.count }}</span>
        </button>

        <!-- Dropdown -->
        <div v-if="showNotifDropdown" class="notif-dropdown" @click.stop>
          <div class="notif-dropdown-header">
            <strong>Notifications</strong>
            <button @click="fetchNotifs" class="notif-refresh-btn" :disabled="notifLoading">
              <svg :class="{ spinning: notifLoading }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </button>
          </div>

          <div v-if="notifLoading && !notifData.lastChecked" class="notif-loading">
            Loading notifications...
          </div>

          <div v-else-if="notifError" class="notif-error">
            {{ notifError }}
          </div>

          <div v-else-if="notifData.count === 0" class="notif-empty">
            No new notifications
          </div>

          <div v-else class="notif-list">
            <div v-if="notifData.mentionCount > 0" class="notif-section-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              Mentions ({{ notifData.mentionCount }})
            </div>
            <a v-for="m in notifData.notifications.filter(n => n.type === 'mention')" :key="m.id" :href="m.url" target="_blank" class="notif-item">
              <div class="notif-item-header">
                <span class="notif-type-badge mention-badge">@mention</span>
                <span class="notif-chat-name">{{ m.chatName }}</span>
                <span class="notif-time">{{ m.timeAgo || formatNotifTime(m.createTime) }}</span>
              </div>
              <div class="notif-item-body">
                <span class="notif-sender">{{ m.sender }}:</span>
                <span class="notif-text">{{ m.text || '(no text)' }}</span>
              </div>
            </a>

            <div v-if="notifData.dmCount > 0" class="notif-section-label" style="margin-top:8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Direct Messages ({{ notifData.dmCount }})
            </div>
            <a v-for="m in notifData.notifications.filter(n => n.type === 'dm')" :key="m.id" :href="m.url" target="_blank" class="notif-item dm-item">
              <div class="notif-item-header">
                <span class="notif-type-badge dm-badge">DM</span>
                <span class="notif-chat-name">{{ m.chatName }}</span>
                <span class="notif-time">{{ m.timeAgo || formatNotifTime(m.createTime) }}</span>
              </div>
              <div class="notif-item-body">
                <span class="notif-sender">{{ m.sender }}:</span>
                <span class="notif-text">{{ m.text || '(no text)' }}</span>
              </div>
            </a>

            <div v-if="notifData.approvalCount > 0" class="notif-section-label" style="margin-top:8px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              CRM Approvals ({{ notifData.approvalCount }})
            </div>
            <a v-for="a in notifData.approvals" :key="a.id" :href="a.url" target="_blank" class="notif-item approval-item">
              <div class="notif-item-header">
                <span class="notif-type-badge approval-badge">APPROVAL</span>
                <span class="notif-chat-name">{{ a.title }}</span>
                <span class="notif-time">{{ a.timeAgo || formatNotifTime(a.createTime) }}</span>
              </div>
              <div class="notif-item-body">
                <span class="notif-sender">{{ a.applicant }}:</span>
                <span class="notif-text">{{ a.code }}</span>
              </div>
            </a>
          </div>

          <div v-if="notifData.lastChecked" class="notif-footer">
            Last checked: {{ formatNotifTime(notifData.lastChecked) }}
          </div>
        </div>
      </div>
    </nav>
    <router-view v-slot="{ Component }">
      <keep-alive>
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import axios from 'axios'

const showNotifDropdown = ref(false)
const notifLoading = ref(false)
const notifData = ref({ count: 0, mentionCount: 0, dmCount: 0, approvalCount: 0, notifications: [], approvals: [], lastChecked: null })
const notifError = ref(null)
let notifTimer

async function fetchNotifs() {
  notifLoading.value = true
  notifError.value = null
  try {
    const res = await axios.get('/api/mentions')
    notifData.value = res.data
  } catch (e) {
    notifError.value = e.response?.data?.details || e.message
  } finally {
    notifLoading.value = false
  }
}

function toggleNotifDropdown() {
  showNotifDropdown.value = !showNotifDropdown.value
  if (showNotifDropdown.value && !notifData.value.lastChecked) {
    fetchNotifs()
  }
}

function formatNotifTime(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function handleOutsideClick(e) {
  const bell = document.querySelector('.notif-bell-wrapper')
  if (bell && !bell.contains(e.target)) {
    showNotifDropdown.value = false
  }
}

onMounted(() => {
  fetchNotifs()
  notifTimer = setInterval(fetchNotifs, 5 * 60 * 1000)
  document.addEventListener('click', handleOutsideClick)
})

onBeforeUnmount(() => {
  clearInterval(notifTimer)
  document.removeEventListener('click', handleOutsideClick)
})
</script>

<style scoped>
.app-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 60px;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-brand a {
  font-size: 18px;
  font-weight: 700;
  color: #2563eb;
  text-decoration: none;
}

.nav-links {
  display: flex;
  gap: 8px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  color: #6b7280;
  font-weight: 500;
  font-size: 14px;
  transition: all 0.15s;
}

.nav-link:hover {
  background: #f3f4f6;
  color: #111827;
}

.nav-link.active {
  background: #2563eb;
  color: white;
}

.notif-bell-wrapper {
  position: relative;
}

.notif-bell-btn {
  position: relative;
  background: none;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notif-bell-btn:hover {
  background: #f3f4f6;
  color: #111827;
  border-color: #d1d5db;
}

.notif-bell-btn.has-notif {
  color: #2563eb;
  border-color: #2563eb;
  background: #eff6ff;
}

.notif-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #ef4444;
  color: white;
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}

.notif-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 380px;
  max-height: 500px;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1), 0 4px 10px rgba(0,0,0,0.05);
  overflow-y: auto;
  z-index: 200;
}

.notif-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background: white;
  z-index: 1;
}

.notif-dropdown-header strong {
  font-size: 14px;
  color: #111827;
}

.notif-refresh-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #6b7280;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.notif-refresh-btn:hover:not(:disabled) {
  background: #f3f4f6;
  color: #111827;
}

.notif-refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.notif-loading,
.notif-error,
.notif-empty {
  padding: 24px 16px;
  text-align: center;
  color: #6b7280;
  font-size: 13px;
}

.notif-error {
  color: #dc2626;
}

.notif-list {
  padding: 8px;
}

.notif-section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.notif-item {
  display: block;
  padding: 10px 12px;
  border-radius: 8px;
  text-decoration: none;
  color: inherit;
  transition: background 0.1s;
  margin-bottom: 2px;
}

.notif-item:hover {
  background: #f3f4f6;
}

.notif-item-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.notif-type-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
}

.mention-badge {
  background: #dbeafe;
  color: #1e40af;
}

.dm-badge {
  background: #dcfce7;
  color: #166534;
}

.approval-badge {
  background: #fef3c7;
  color: #92400e;
}

.notif-chat-name {
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notif-time {
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
}

.notif-item-body {
  font-size: 12px;
  color: #4b5563;
  line-height: 1.4;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.notif-sender {
  font-weight: 600;
  margin-right: 4px;
}

.notif-text {
  color: #6b7280;
}

.notif-footer {
  padding: 10px 16px;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
  color: #9ca3af;
  text-align: center;
}
</style>
