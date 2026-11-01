# obscura

obscura is an ai-assisted dependency security workspace that identifies known vulnerabilities in npm and python packages using osv. upload a dependency manifest, review affected packages and advisories, and use groq-powered analysis to understand the risk and verification steps. obscura checks proposed npm upgrades against current advisories and provides a manifest download for review.

manual scans and hourly, daily, or weekly scheduled rescans keep project findings current against the latest uploaded dependencies. built with react and typescript on cloudflare workers, obscura uses d1 for scan records, r2 for private manifests and proposed fixes, and workflows for durable scan execution. the interface includes finding triage, scan history, report exports, and saved light and dark themes.
