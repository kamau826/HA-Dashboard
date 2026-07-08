import axios from 'axios';

let tokenCache = {
  token: null,
  expiresAt: null
};

async function getAuthToken() {
  const now = Date.now();
  
  if (tokenCache.token && tokenCache.expiresAt && tokenCache.expiresAt > now + 300000) {
    return tokenCache.token;
  }

  const refreshToken = process.env.VITE_CRM_RTOKEN;
  
  if (!refreshToken) {
    throw new Error('Refresh token not configured');
  }

  const response = await axios.get(
    'https://pfgatewayfra.transsion.com:9199/service-cc-crm-mdm/mdm/user/loginInfoByToken',
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

  if (code !== '0') {
    throw new Error(`CRM API error: ${message}`);
  }

  tokenCache.token = data.token;
  tokenCache.expiresAt = now + (data.expiresIn * 3600 * 1000);

  return data.token;
}

export default async function handler(req, res) {
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

    const response = await axios.post(
      'https://pfgatewayfra.transsion.com:9199/service-cc-crm-shop/shop/getShopDetail',
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
    console.error('Shop detail API error:', error.message);
    res.status(500).json({ 
      error: 'Failed to fetch shop details',
      details: error.message 
    });
  }
}
