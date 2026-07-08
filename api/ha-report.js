import axios from 'axios';

// Cache for the auth token
let tokenCache = {
  token: null,
  expiresAt: null
};

async function getAuthToken() {
  const now = Date.now();
  
  // Return cached token if still valid (with 5 minute buffer)
  if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now + 300000) {
    return tokenCache.token;
  }

  // Refresh token - use refresh token as P-Auth header
  const refreshToken = process.env.VITE_CRM_RTOKEN;
  
  if (!refreshToken) {
    throw new Error('Refresh token not configured');
  }

  const response = await axios.get(
    'https://pfgatewayfra.transsion.com:9199/service-cc-crm-mdm/mdm/user/loginInfoByToken',
    {
      params: { refreshToken },
      headers: {
        'P-Auth': refreshToken,  // Use refresh token as P-Auth for refresh endpoint
        'P-Rtoken': refreshToken,
        'P-AppId': process.env.VITE_CRM_APPID || '220801001',
        'P-EmpNo': process.env.VITE_CRM_EMPNO || '15402568',
        'P-LangId': 'en'
      }
    }
  );

  const { code, data, message } = response.data;

  if (code !== '0') {
    throw new Error(`CRM API error: ${message}`);
  }

  // Cache the new token with expiration time
  tokenCache.token = data.token;
  tokenCache.expiresAt = now + (data.expiresIn * 3600 * 1000); // expiresIn is in hours

  return data.token;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = await getAuthToken();

    // Forward request to CRM API
    const response = await axios.post(
      'https://pfgatewayfra.transsion.com:9199/service-cc-crm-report/report/haJsReport/pages',
      req.body,
      {
        headers: {
          'Content-Type': 'application/json;charset=utf-8',
          'P-Auth': token,
          'P-Rtoken': process.env.VITE_CRM_RTOKEN,
          'P-AppId': process.env.VITE_CRM_APPID || '220801001',
          'P-EmpNo': process.env.VITE_CRM_EMPNO || '15402568',
          'P-LangId': 'en'
        }
      }
    );

    res.status(200).json(response.data);

  } catch (error) {
    console.error('API proxy error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch data',
      details: error.message 
    });
  }
}
