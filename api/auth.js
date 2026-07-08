import axios from 'axios';

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const refreshToken = process.env.VITE_CRM_RTOKEN;
    
    if (!refreshToken) {
      throw new Error('Refresh token not configured');
    }

    // Call the CRM login API with refresh token
    const response = await axios.get(
      'https://pfgatewayfra.transsion.com:9199/service-cc-crm-mdm/mdm/user/loginInfoByToken',
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

    if (code !== '0') {
      throw new Error(`CRM API error: ${message}`);
    }

    // Return the fresh token
    res.status(200).json({
      token: data.token,
      expiresIn: data.expiresIn,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Token refresh error:', error.message);
    res.status(500).json({ 
      error: 'Failed to refresh token',
      details: error.message 
    });
  }
}
