import { mkdir, readFile, writeFile } from 'node:fs/promises'

const html = await readFile(new URL('../standalone/obscura.html', import.meta.url), 'utf8')
await writeFile(new URL('../public/obscura.html', import.meta.url), html)
await writeFile(
  new URL('../standalone/worker.js', import.meta.url),
  `const html = ${JSON.stringify(html)}\n\nexport default {\n  async fetch(request) {\n    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } })\n    return new Response(request.method === 'HEAD' ? null : html, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' } })\n  }\n}\n`,
)

const pages = new URL('../.wrangler/deployment/pages/', import.meta.url)
await mkdir(pages, { recursive: true })
const showcase = html
  .replace(
    "const destination = params.get('workspace')",
    "const destination = params.get('workspace') || 'https://obscura.aarush-uae.workers.dev/'",
  )
  .replace(
    'link.href = url.href',
    "url.searchParams.set(link.hasAttribute('data-demo') ? 'sample' : 'workspace', link.hasAttribute('data-demo') ? '1' : 'live'); link.href = url.href",
  )
await writeFile(new URL('index.html', pages), showcase)
await writeFile(
  new URL('_headers', pages),
  '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n',
)
await writeFile(
  new URL('../showcase.js', pages),
  `const html = ${JSON.stringify(showcase)}\nexport default { async fetch(request) { return new Response(request.method === 'HEAD' ? null : html, { headers: { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin' } }) } }\n`,
)
await writeFile(
  new URL('../showcase.toml', pages),
  'name = "obscura-showcase"\nmain = "showcase.js"\naccount_id = "ef9d8674583500d44ec5fd99dd074a29"\ncompatibility_date = "2026-11-01"\nworkers_dev = true\n',
)
