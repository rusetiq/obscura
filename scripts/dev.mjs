import { spawn } from 'node:child_process'

const server = spawn(
  process.execPath,
  ['node_modules/vite/bin/vite.js', ...process.argv.slice(2)],
  { stdio: 'inherit', env: process.env },
)
let pending = false
let warned = false
const tick = async () => {
  if (pending) return
  pending = true
  try {
    const health = await fetch('http://127.0.0.1:5173/api/health', {
      signal: AbortSignal.timeout(5000),
    })
    if (!health.ok || !(await health.json()).local) return
    const response = await fetch(
      'http://127.0.0.1:5173/cdn-cgi/local/explorer/api/local/scheduled?worker=obscura',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron: '* * * * *', scheduled_time: Date.now() }),
        signal: AbortSignal.timeout(55000),
      },
    )
    if (!response.ok) throw new Error()
    warned = false
  } catch {
    if (!warned)
      console.error('[obscura] local scheduler could not reach the dev server; it will retry.')
    warned = true
  } finally {
    pending = false
  }
}
const timer = setInterval(tick, 60000)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    clearInterval(timer)
    server.kill(signal)
  })
server.on('exit', (code) => {
  clearInterval(timer)
  process.exit(code ?? 0)
})
