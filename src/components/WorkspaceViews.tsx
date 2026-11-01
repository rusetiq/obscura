import { useEffect, useState } from 'react'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckCircleIcon,
  CodeIcon,
  DatabaseIcon,
  DownloadSimpleIcon,
  FileCodeIcon,
  GitBranchIcon,
  HardDrivesIcon,
  PlusIcon,
  CpuIcon,
  StackIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import type { Workspace } from '../../shared/types'
import { api, download, relativeTime } from '../lib/api'
import { EmptyState, ErrorMessage, ExternalLink, ProjectMark } from './ui'

export function ProjectsView({
  workspace,
  onScan,
  onProject,
}: {
  workspace: Workspace
  onScan: () => void
  onProject: (name: string) => void
}) {
  const projects = [...new Set(workspace.scans.map((scan) => scan.project))]
  return (
    <section className="projects-view">
      <div className="section-heading">
        <div>
          <h2>
            projects<span className="count-badge">{projects.length}</span>
          </h2>
          <p>manifest-based projects. upload a new lockfile whenever your dependencies change.</p>
        </div>
        <button className="button" onClick={onScan}>
          <PlusIcon size={15} />
          add project
        </button>
      </div>
      {!projects.length && (
        <EmptyState
          title="no projects yet"
          text="upload a dependency manifest to add a project."
          action={
            <button className="button primary" onClick={onScan}>
              scan a project
              <ArrowUpRightIcon size={16} />
            </button>
          }
        />
      )}
      <div className="project-grid">
        {projects.map((project) => {
          const latest = workspace.scans.find((scan) => scan.project === project)!
          const findings = workspace.findings.filter(
            (finding) => finding.project === project && finding.status === 'open',
          )
          return (
            <button key={project} className="project-card" onClick={() => onProject(project)}>
              <div className="project-card-top">
                <ProjectMark name={project} />
                <ArrowUpRightIcon size={19} />
              </div>
              <h3>{project}</h3>
              <span className="project-branch">
                <GitBranchIcon size={13} />
                manifest upload<span>·</span>
                {latest.filename}
              </span>
              <div className="project-card-stats">
                <div>
                  <span>dependencies</span>
                  <strong>{latest.dependencyCount}</strong>
                </div>
                <div>
                  <span>open findings</span>
                  <strong>{findings.length}</strong>
                </div>
              </div>
              <div className="project-card-footer">
                <span className="project-status">{latest.status}</span>
                <span>{relativeTime(latest.createdAt)}</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function ScansView({ workspace, onScan }: { workspace: Workspace; onScan: () => void }) {
  return (
    <section className="scans-view">
      <div className="section-heading">
        <div>
          <h2>
            scans<span className="count-badge">{workspace.scans.length}</span>
          </h2>
          <p>your scan history, including coverage notes and service errors.</p>
        </div>
        <button className="button" onClick={onScan}>
          <PlusIcon size={15} />
          new scan
        </button>
      </div>
      {!workspace.scans.length && (
        <EmptyState
          title="no scans yet"
          text="run your first dependency scan to see its results here."
        />
      )}
      <div className="scan-list">
        {workspace.scans.map((scan) => (
          <article key={scan.id} className="scan-item">
            <div className="scan-icon">
              {scan.status === 'completed' ? (
                <CheckCircleIcon size={21} />
              ) : scan.status === 'failed' ? (
                <WarningCircleIcon size={21} />
              ) : (
                <StackIcon size={21} />
              )}
            </div>
            <div className="scan-item-main">
              <div>
                <strong>{scan.project}</strong>
                <span className={`scan-status ${scan.status}`}>{scan.status}</span>
              </div>
              <p>
                <FileCodeIcon size={13} />
                {scan.filename}
                {scan.trigger === 'scheduled' && (
                  <span className="scheduled-scan-tag">scheduled</span>
                )}
                <span>·</span>
                {scan.dependencyCount} dependencies<span>·</span>
                {scan.findingCount} findings
              </p>
              {scan.error && <ErrorMessage>{scan.error}</ErrorMessage>}
              {scan.warnings.length > 0 && (
                <details>
                  <summary>
                    {scan.warnings.length} coverage {scan.warnings.length === 1 ? 'note' : 'notes'}
                  </summary>
                  {scan.warnings.map((warning, index) => (
                    <p key={index} className="coverage-note">
                      {warning}
                    </p>
                  ))}
                </details>
              )}
            </div>
            <time dateTime={scan.createdAt}>{relativeTime(scan.createdAt)}</time>
          </article>
        ))}
      </div>
    </section>
  )
}

interface Health {
  database: boolean
  storage: boolean
  ai: boolean
  local: boolean
  aiProvider: string
  aiModel: string
}

export function SettingsView({
  demo,
  workspace,
  notify,
}: {
  demo: boolean
  workspace: Workspace
  notify: (message: string) => void
}) {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api<Health>('/health')
      .then(setHealth)
      .catch((error) => setError(error.message))
  }, [])
  return (
    <div className="settings-view">
      <section className="settings-section">
        <div>
          <h2>workspace</h2>
          <p>one private workspace for your team’s dependency security.</p>
        </div>
        <div className="settings-content">
          <div className="setting-row">
            <span>workspace name</span>
            <strong>engineering</strong>
          </div>
          <div className="setting-row">
            <span>data source</span>
            <span className="sample-tag">{demo ? 'sample workspace' : 'live osv scans'}</span>
          </div>
          <div className="setting-row">
            <span>scan coverage</span>
            <strong>npm + pypi · exact versions</strong>
          </div>
          <div className="setting-row">
            <span>workspace report</span>
            <button
              className="button"
              onClick={() => {
                download(
                  `obscura-${demo ? 'sample' : 'report'}.json`,
                  JSON.stringify(
                    {
                      source: demo ? 'sample' : 'osv',
                      exportedAt: new Date().toISOString(),
                      ...workspace,
                    },
                    null,
                    2,
                  ),
                )
                notify('workspace report downloaded.')
              }}
            >
              <DownloadSimpleIcon size={15} />
              export json
            </button>
          </div>
          {health && !health.local && (
            <div className="setting-row">
              <span>workspace access</span>
              <button
                className="button"
                onClick={async () => {
                  try {
                    await api('/session', { method: 'DELETE' })
                    window.location.reload()
                  } catch (error) {
                    setError((error as Error).message)
                  }
                }}
              >
                sign out
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>services</h2>
          <p>application services in your cloudflare account.</p>
        </div>
        <div className="settings-content">
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {[
            {
              name: 'cloudflare d1',
              description: 'scans, findings, and analysis',
              icon: DatabaseIcon,
              status: health?.database,
            },
            {
              name: 'cloudflare r2',
              description: 'private manifests and proposed fixes',
              icon: HardDrivesIcon,
              status: health?.storage,
            },
            {
              name: 'groq',
              description: health?.aiModel ?? 'vulnerability analysis',
              icon: CpuIcon,
              status: health?.ai,
            },
          ].map((service) => (
            <div className="service-row" key={service.name}>
              <service.icon size={22} />
              <div>
                <strong>{service.name}</strong>
                <span>{service.description}</span>
              </div>
              <span className="service-status">
                {!health
                  ? 'checking…'
                  : service.status
                    ? service.name === 'groq'
                      ? 'configured'
                      : 'connected'
                    : service.name === 'groq'
                      ? 'not configured'
                      : 'unavailable'}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>scan coverage</h2>
          <p>understand what a scan can tell you.</p>
        </div>
        <div className="settings-content settings-notes">
          <p>
            <CodeIcon size={18} />
            lockfiles include resolved transitive dependencies. package manifests cover exact direct
            versions only.
          </p>
          <p>
            <GitBranchIcon size={18} />
            projects are tracked by name. your inbox uses the latest completed scan for each
            project.
          </p>
          <p>
            <ArrowRightIcon size={18} />
            fixes are proposed manifest downloads. install, test, and rescan to verify them.
          </p>
          <ExternalLink href="https://google.github.io/osv.dev/">osv documentation</ExternalLink>
        </div>
      </section>
    </div>
  )
}
