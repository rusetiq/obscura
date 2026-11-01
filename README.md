# obscura

obscura is an ai-assisted dependency security workspace that identifies known vulnerabilities in npm and python packages using osv. upload a dependency manifest, review affected packages and advisories, and use groq-powered analysis to understand the risk and verification steps. obscura checks proposed npm upgrades against current advisories and provides a manifest download for review.

manual scans and hourly, daily, or weekly scheduled rescans keep project findings current against the latest uploaded dependencies. built with react and typescript on cloudflare workers, obscura uses d1 for scan records, r2 for private manifests and proposed fixes, and workflows for durable scan execution. the interface includes finding triage, scan history, report exports, and saved light and dark themes.

## Run locally

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run db:migrate
npm run dev
```

Open [the app](http://127.0.0.1:5173). It starts in a clearly labeled sample workspace. Select **Live workspace** or **New scan** to scan your own dependencies. Local access bypasses the workspace password only when `ENVIRONMENT=development` and the request hostname is loopback.

Supported inputs are `package-lock.json` v2/v3, `package.json` with exact pinned versions, and `requirements.txt` with unconditional `name==version` entries. Files are limited to 2 MB and 1,000 dependencies. Unresolved ranges, conditional requirements, and unsupported requirement lines are skipped with coverage notes. Package manifests do not include transitive dependencies; upload a lockfile for that coverage.

## Deploy to Cloudflare

```sh
npx wrangler login
npx wrangler d1 create dope-security
npx wrangler r2 bucket create dope-security-artifacts
```

Copy the returned D1 `database_id` into `wrangler.toml`. Enable R2 in the account. The zero UUID is a local placeholder, not a provisioned production database.

Set a workspace password and a separate random session secret of at least 32 characters using Wrangler’s secret prompts:

```sh
npx wrangler secret put APP_PASSWORD
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GROQ_API_KEY
npm run db:migrate:remote
npm run deploy
```

Keep `ENVIRONMENT=production` in the deployed configuration. The app refuses production API access until both access secrets are configured. This version has one shared workspace and one shared password; it does not implement individual accounts or tenant isolation. Login and expensive requests are rate limited. Sessions use signed, secure, HttpOnly cookies.

The [Cloudflare Vite plugin](https://developers.cloudflare.com/workers/vite-plugin/) builds frontend assets and the Worker together. [Workflows](https://developers.cloudflare.com/workflows/) preserves scan progress across retries. Binding names and resources live in `wrangler.toml`.

## Scan, analyze, and fix

Scans use OSV’s [batch queries](https://google.github.io/osv.dev/post-v1-querybatch/) and paginated [package queries](https://google.github.io/osv.dev/post-v1-query/). Withdrawn advisories are excluded. Failed upstream queries fail the scan rather than returning a clean report. The inbox uses the latest completed scan for each project name. Findings count affected package installations, including separate nested versions and paths.

**Analyze with AI** sends selected advisory evidence to [Groq](https://console.groq.com/docs/text-chat) using `qwen/qwen3.8-27b` and caches the final answer in D1. It works locally and on Cloudflare when `GROQ_API_KEY` is set. Add the key to the ignored `.dev.vars` file for local use and set it through `wrangler secret put GROQ_API_KEY` for deployment. The key is never sent to the browser. Sample workspace analysis remains explicitly labeled as prewritten. Only the final answer is displayed; reasoning is excluded from the response.

The top bar switches between light and dark themes. The selection is saved in browser storage. Navigation and overlay panels use translucent backgrounds with backdrop blur.

**Prepare a fix** supports exact, direct npm dependencies uploaded as `package.json`. It collects upgrade candidates from current package advisories and checks each candidate against OSV again. It only offers a manifest when the selected package version returns no known advisories at generation time. The proposal is saved to R2 and downloaded for review. It does not modify a repository or mark a finding resolved. Replace the manifest, regenerate the lockfile with `npm install`, run your tests, and rescan. Compatibility and source reachability are not established by a dependency scan.

Transitive dependencies and lockfile entries need their owning direct dependency updated and the lockfile regenerated. Python findings include advisory release information but do not offer automatic manifest rewriting.

## Check the implementation

```sh
npm test
npm run build
npx playwright install chromium
npm run dev
```

In another terminal:

```sh
npm run test:e2e
```

Browser tests cover sample triage, filtering, project navigation, report downloads, mobile layout, theme persistence, translucent dialogs, and a real OSV scan with a proposed fix download. When Groq is configured, the live test also generates and verifies AI analysis. The live test uses the public OSV API and writes a local project named `integration-check`. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to use an existing Chromium installation.

Application source, configuration, SQL, and tests contain no comments. Sample findings and trend data are illustrative and separate from the live database.

## scheduled scans

open **schedules** in the live workspace to create hourly, daily, or weekly scans. each run rechecks the project’s latest uploaded manifest against osv. upload a new manifest when dependencies change. schedules can be edited, paused, resumed, run immediately, or removed. scan history identifies scheduled runs.

the deployed worker uses a cloudflare cron trigger every minute. apply the schedule migration before deploying. daily and weekly frequencies repeat every 24 or 168 elapsed hours from the first run; timestamps are stored in utc and shown in your browser’s timezone. missed intervals are skipped rather than replayed in a burst.

`npm run dev` starts a local scheduler alongside vite and calls the same scheduled handler every minute. local recurring scans continue while the dev process is running, even with the browser closed. cloudflare deployment is required for scans to continue after shutting down your computer.

existing d1 and r2 resource names are retained to preserve stored scans and manifests.

## live deployment

public showcase: https://obscura-showcase.aarush-uae.workers.dev

application: https://obscura.aarush-uae.workers.dev

the showcase is deployed as a separate static worker. the application worker serves the frontend and api together, with private r2 storage, d1 persistence, a durable scan workflow, and a one-minute scheduler trigger. sample data is public; live workspace api access requires the workspace password.

run `npm run deploy` to publish the application and `npm run deploy:landing` to publish the showcase. deploys require cloudflare authentication. secrets remain in cloudflare and are excluded from the repository.
