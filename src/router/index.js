import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '../views/DashboardView.vue'
import WorkAreaView from '../views/WorkAreaView.vue'
import InventoryView from '../views/InventoryView.vue'
import CaseDetailView from '../views/CaseDetailView.vue'

const routes = [
  { path: '/', name: 'dashboard', component: DashboardView },
  { path: '/work-area', name: 'work-area', component: WorkAreaView },
  { path: '/inventory', name: 'inventory', component: InventoryView },
  { path: '/case/:jsNo', name: 'case-detail', component: CaseDetailView, props: true },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})
