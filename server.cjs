const http = require('http');
const fs = require('fs');
const path = require('path');
const port = process.env.PORT || 4173;
const root = path.join(__dirname, 'dist');
const mime = { '.html':'text/html; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.svg':'image/svg+xml' };
http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  filePath = path.join(root, filePath);
  if (!filePath.startsWith(root) || !fs.existsSync(filePath)) filePath = path.join(root, 'index.html');
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain; charset=utf-8' });
  res.end(fs.readFileSync(filePath));
}).listen(port, () => console.log(`Serving on http://127.0.0.1:${port}`));
