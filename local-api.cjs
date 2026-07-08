const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const CRM_BASE = 'https://pfgatewayfra.transsion.com:9199';
const WORKBENCH_URL = 'https://workbench.transsion.com';

// Token cache
let tokenCache = { token: null, expiresAt: null };

async function getAuthToken() {
  const now = Date.now();
  if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now + 300000) {
    return tokenCache.token;
  }

  const refreshToken = process.env.VITE_CRM_RTOKEN;
  if (!refreshToken) throw new Error('VITE_CRM_RTOKEN not configured in .env');

  const response = await axios.get(
    `${CRM_BASE}/service-cc-crm-mdm/mdm/user/loginInfoByToken`,
    {
      params: { refreshToken },
      headers: {
        'P-Auth': refreshToken,
        'P-Rtoken': refreshToken,
        'P-AppId': process.env.VITE_CRM_APPID || '220801001',
        'P-EmpNo': process.env.VITE_CRM_EMPNO || '15402568',
        'P-LangId': 'en'
      }
    }
  );

  const { code, data, message } = response.data;
  if (code !== '0') throw new Error(`CRM API error: ${message}`);

  tokenCache.token = data.token;
  tokenCache.expiresAt = now + (data.expiresIn * 3600 * 1000);
  return data.token;
}

function crmHeaders(token) {
  return {
    'Content-Type': 'application/json;charset=utf-8',
    'P-Auth': token,
    'P-Rtoken': process.env.VITE_CRM_RTOKEN,
    'P-AppId': process.env.VITE_CRM_APPID || '220801001',
    'P-EmpNo': process.env.VITE_CRM_EMPNO || '15402568',
    'P-LangId': 'en'
  };
}

// POST /api/ha-report
app.post('/api/ha-report', async (req, res) => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(
      `${CRM_BASE}/service-cc-crm-report/report/haJsReport/pages`,
      req.body,
      { headers: crmHeaders(token) }
    );
    res.json(response.data);
  } catch (error) {
    console.error('ha-report error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data', details: error.message });
  }
});

// POST /api/shop-detail
app.post('/api/shop-detail', async (req, res) => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(
      `${CRM_BASE}/service-cc-crm-shop/shop/getShopDetail`,
      req.body,
      { headers: crmHeaders(token) }
    );
    res.json(response.data);
  } catch (error) {
    console.error('shop-detail error:', error.message);
    res.status(500).json({ error: 'Failed to fetch shop details', details: error.message });
  }
});

// POST /api/inventory
app.post('/api/inventory', async (req, res) => {
  try {
    const token = await getAuthToken();
    const response = await axios.post(
      `${CRM_BASE}/service-cc-crm-wms/wms/inventoryDetail/pages`,
      req.body,
      { headers: crmHeaders(token) }
    );
    res.json(response.data);
  } catch (error) {
    console.error('inventory error:', error.message);
    res.status(500).json({ error: 'Failed to fetch inventory', details: error.message });
  }
});

// GET /api/auth
app.get('/api/auth', async (req, res) => {
  try {
    const refreshToken = process.env.VITE_CRM_RTOKEN;
    if (!refreshToken) throw new Error('Refresh token not configured');

    const response = await axios.get(
      `${CRM_BASE}/service-cc-crm-mdm/mdm/user/loginInfoByToken`,
      {
        params: { refreshToken },
        headers: {
          'P-AppId': process.env.VITE_CRM_APPID || '220801001',
          'P-EmpNo': process.env.VITE_CRM_EMPNO || '15402568',
          'P-LangId': 'en'
        }
      }
    );

    const { code, data, message } = response.data;
    if (code !== '0') throw new Error(`CRM API error: ${message}`);

    res.json({
      token: data.token,
      expiresIn: data.expiresIn,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('auth error:', error.message);
    res.status(500).json({ error: 'Failed to refresh token', details: error.message });
  }
});

// GET /api/approvals
let approvalCache = { data: null, expiresAt: 0 };
app.get('/api/approvals', async (req, res) => {
  if (approvalCache.data && Date.now() < approvalCache.expiresAt) {
    return res.json(approvalCache.data);
  }

  try {
    const WORKBENCH_TOKEN = 'r_Mzg3MWVyNk1OMGljQXJ1cm1GcTdeNjM3MjU0NjY3MTYwMjk2NjQ1OTk5OTkw';
    const WORKBENCH_RTOKEN = process.env.VITE_CRM_RTOKEN;

    const response = await axios.get(`${WORKBENCH_URL}/api/todo/list`, {
      params: {
        token: WORKBENCH_TOKEN,
        rtoken: WORKBENCH_RTOKEN,
        sysCode: 'crm-fra,crm-bpm-fra',
        lang: 'en-US',
        pageSize: 50,
        pageNo: 1
      },
      headers: {
        'Authorization': `Bearer ${WORKBENCH_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    const todos = response.data?.data?.list || [];
    const approvals = todos.map(todo => ({
      id: todo.id || todo.taskId,
      type: 'approval',
      title: todo.title || todo.processName,
      code: todo.code || todo.processCode,
      applicant: todo.applicant || todo.creator,
      createTime: todo.createTime,
      timeAgo: getTimeAgo(todo.createTime),
      url: `${WORKBENCH_URL}/pc/#/todoDetail?token=***&rtoken=${WORKBENCH_RTOKEN}&sysCode=crm-fra,crm-bpm-fra&lang=en-US`
    }));

    const result = {
      count: approvals.length,
      approvals: approvals.slice(0, 20),
      lastChecked: new Date().toISOString()
    };

    approvalCache.data = result;
    approvalCache.expiresAt = Date.now() + 2 * 60 * 1000;
    res.json(result);
  } catch (error) {
    console.error('approvals error:', error.message);
    res.status(500).json({ error: 'Failed to fetch approvals', details: error.message });
  }
});

// GET /api/mentions
app.get('/api/mentions', async (req, res) => {
  try {
    const DATA_URL = process.env.NOTIF_DATA_URL || 'https://ha-dashboard-two.vercel.app/data/notifications.json';
    const url = DATA_URL + '?t=' + Date.now();
    const response = await axios.get(url, { timeout: 10000 });
    res.json(response.data);
  } catch (error) {
    console.error('mentions error:', error.message);
    res.json({
      count: 0, mentionCount: 0, dmCount: 0, approvalCount: 0,
      notifications: [], approvals: [],
      lastChecked: new Date().toISOString(),
      error: 'Failed to fetch notification data'
    });
  }
});

function getTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Local API server running on http://localhost:${PORT}`);
  console.log(`   CRM RTOKEN: ${process.env.VITE_CRM_RTOKEN ? 'configured' : 'MISSING - check .env file'}`);
});
