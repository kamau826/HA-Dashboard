import axios from 'axios';

// Read notifications from the pre-generated JSON file
// This file is updated by an OpenClaw cron job every 5 minutes
const DATA_URL = process.env.NOTIF_DATA_URL || 'https://ha-dashboard-two.vercel.app/data/notifications.json';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Add cache-busting query param to avoid stale cache
    const url = DATA_URL + '?t=' + Date.now();
    const response = await axios.get(url, { timeout: 10000 });
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Notifications API error:', error.message);
    // Return empty state on error
    res.status(200).json({
      count: 0,
      mentionCount: 0,
      dmCount: 0,
      approvalCount: 0,
      notifications: [],
      approvals: [],
      lastChecked: new Date().toISOString(),
      error: 'Failed to fetch notification data'
    });
  }
}
