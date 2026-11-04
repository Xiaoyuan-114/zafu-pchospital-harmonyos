// Local-only fault injection: all traffic goes to the isolated course API, except the first image upload.
const http = require('node:http');
let failedUpload = false;
http.createServer((req, res) => {
  if (!failedUpload && req.method === 'POST' && /^\/api\/v1\/forum\/posts\/[^/]+\/images(?:\?|$)/.test(req.url)) {
    failedUpload = true;
    req.resume();
    const body = JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: '验收环境：图片上传暂时不可用' } });
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) });
    res.end(body);
    console.log('Injected one image upload failure');
    return;
  }
  const upstream = http.request({ hostname: '127.0.0.1', port: 13080, method: req.method, path: req.url, headers: req.headers }, (reply) => {
    res.writeHead(reply.statusCode, reply.headers);
    reply.pipe(res);
  });
  upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(upstream);
}).listen(13081, '127.0.0.1', () => console.log('Local fault proxy listening on 127.0.0.1:13081'));
