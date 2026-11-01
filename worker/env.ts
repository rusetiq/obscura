export interface Env {
  DB: D1Database
  ARTIFACTS: R2Bucket
  ASSETS: Fetcher
  GROQ_API_KEY?: string
  GROQ_MODEL?: string
  SCAN_WORKFLOW: Workflow<{ scanId: string }>
  AUTH_LIMITER: RateLimit
  WORK_LIMITER: RateLimit
  ENVIRONMENT: string
  APP_PASSWORD?: string
  SESSION_SECRET?: string
}
