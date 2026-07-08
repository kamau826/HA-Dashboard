import axios from 'axios';

const WORKBENCH_URL = 'https://workbench.transsion.com';
const WORKBENCH_TOKEN = 'r_Mzg3MWVyNk1OMGljQXJ1cm1GcTdeNjM3MjU0NjY3MTYwMjk2NjQ1OTk5OTkw';
const WORKBENCH_RTOKEN = 'u_ODc3MWl1Y2NmaVhnOHZhMDdpSlReNjM3MjU0NjY3ODI1ODM4NjQ1OTk5OTkw';

// Cache for 2 minutes
let approvalCache = { data: null, expiresAt: 0 };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Return cached if fresh
  if (approvalCache.data && Date.now() < approvalCache.expiresAt) {
    return res.status(200).json(approvalCache.data);
  }

  try {
    // Fetch todo list from Workbench
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
    
    // Transform to notification format
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

    // Cache for 2 minutes
    approvalCache.data = result;
    approvalCache.expiresAt = Date.now() + 2 * 60 * 1000;

    res.status(200).json(result);
  } catch (error) {
    console.error('Approvals API error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Failed to fetch approvals', 
      details: error.message 
    });
  }
}

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
