# obscura showcase

open obscura.html directly for the standalone page. all styles and scripts are embedded. google fonts are optional external font downloads with local fallbacks.

for cloudflare, create a worker and paste the contents of worker.js into the worker editor, then deploy. no bindings, packages, or build step are required.

or run `npx wrangler deploy` from this folder using the included wrangler.toml.

this is the presentation page. the scanner remains a separate application. standalone buttons scroll through the process unless you pass your deployed workspace url, for example `https://your-showcase.workers.dev/?workspace=https%3A%2F%2Fyour-app.workers.dev`.

edit obscura.html and run `node scripts/package-landing.mjs` from the project root to refresh the app copy and worker.js.
