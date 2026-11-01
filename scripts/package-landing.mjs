import { readFile, writeFile } from 'node:fs/promises'

const html = await readFile(new URL('../standalone/obscura.html', import.meta.url), 'utf8')
await writeFile(new URL('../public/obscura.html', import.meta.url), html)
await writeFile(
  new URL('../standalone/worker.js', import.meta.url),
  `const html = ${JSON.stringify(html)}\n\nexport default {\n  async fetch(request) {\n    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })\n    return new Response(request.method === 'HEAD' ? null : html, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' } })\n  }\n}\n`,
)
