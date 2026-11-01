import { useMemo, useState } from 'react'
import {
  ArrowDownIcon,
  ArrowRightIcon,
  CaretDownIcon,
  CaretLeftIcon,
  CaretRightIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  PackageIcon,
} from '@phosphor-icons/react'
import { severityOrder, type Finding, type Severity } from '../../shared/types'
import { EmptyState, SeverityBadge } from './ui'

export function FindingTable({
  findings,
  onSelect,
  search,
  setSearch,
  compact = false,
  severity,
  setSeverity,
}: {
  findings: Finding[]
  onSelect: (finding: Finding) => void
  search: string
  setSearch: (value: string) => void
  severity: Severity | 'all'
  setSeverity: (value: Severity | 'all') => void
  compact?: boolean
}) {
  const [tab, setTab] = useState<'open' | 'fixable' | 'ignored'>('open')
  const [project, setProject] = useState('all')
  const [page, setPage] = useState(0)
  const [ascending, setAscending] = useState(true)
  const pageSize = compact ? 5 : 8
  const projects = [...new Set(findings.map((finding) => finding.project))]
  const filtered = useMemo(
    () =>
      findings
        .filter((finding) => {
          if (tab === 'ignored' ? finding.status !== 'ignored' : finding.status !== 'open')
            return false
          if (tab === 'fixable' && !finding.fixedVersions.length) return false
          if (severity !== 'all' && finding.severity !== severity) return false
          if (project !== 'all' && finding.project !== project) return false
          return `${finding.title} ${finding.package} ${finding.advisoryId} ${finding.aliases.join(' ')} ${finding.project}`
            .toLowerCase()
            .includes(search.toLowerCase())
        })
        .sort(
          (a, b) =>
            (severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)) *
            (ascending ? 1 : -1),
        ),
    [findings, tab, severity, project, search, ascending],
  )
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))
  const rows = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const count = (name: string) =>
    findings.filter((finding) =>
      name === 'ignored'
        ? finding.status === 'ignored'
        : finding.status === 'open' && (name !== 'fixable' || finding.fixedVersions.length > 0),
    ).length
  return (
    <section className="findings-section">
      <div className="section-heading">
        <div>
          <h2>
            {compact ? 'open findings' : 'vulnerability inbox'}
            <span className="count-badge">
              {findings.filter((f) => f.status === 'open').length}
            </span>
          </h2>
        </div>
      </div>
      <div className="table-controls">
        <div className="table-tabs" role="tablist" aria-label="finding status">
          {(['open', 'fixable', 'ignored'] as const).map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={tab === name}
              className={tab === name ? 'active' : ''}
              onClick={() => {
                setTab(name)
                setPage(0)
              }}
            >
              {name === 'open' ? 'open' : name === 'fixable' ? 'fix available' : 'ignored'}
              <span>{count(name)}</span>
            </button>
          ))}
        </div>
        <div className="table-filters">
          <label className="table-search">
            <MagnifyingGlassIcon size={15} />
            <input
              aria-label="search vulnerabilities"
              placeholder="search vulnerabilities…"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(0)
              }}
            />
            <kbd>/</kbd>
          </label>
          <label className="filter-select">
            <FunnelSimpleIcon size={14} />
            <select
              aria-label="filter by severity"
              value={severity}
              onChange={(event) => {
                setSeverity(event.target.value as Severity | 'all')
                setPage(0)
              }}
            >
              <option value="all">severity</option>
              {severityOrder.map((value) => (
                <option key={value} value={value}>
                  {value === 'unknown' ? 'unrated' : value[0].toLowerCase() + value.slice(1)}
                </option>
              ))}
            </select>
            <CaretDownIcon size={11} />
          </label>
          {!compact && (
            <label className="filter-select">
              <select
                aria-label="filter by project"
                value={project}
                onChange={(event) => {
                  setProject(event.target.value)
                  setPage(0)
                }}
              >
                <option value="all">all projects</option>
                {projects.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              <CaretDownIcon size={11} />
            </label>
          )}
        </div>
      </div>
      <div className="table-scroll">
        <table className="findings-table">
          <thead>
            <tr>
              <th>
                <button
                  onClick={() => setAscending(!ascending)}
                  aria-label="reverse severity order"
                >
                  severity
                  <ArrowDownIcon
                    size={12}
                    style={{ transform: ascending ? undefined : 'rotate(180deg)' }}
                  />
                </button>
              </th>
              <th>vulnerability</th>
              <th>package</th>
              <th>project</th>
              <th>fix</th>
              <th>
                <span className="sr-only">view finding</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((finding) => (
              <tr key={finding.id} onClick={() => onSelect(finding)}>
                <td>
                  <SeverityBadge severity={finding.severity} />
                </td>
                <td>
                  <button
                    className="finding-title"
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(finding)
                    }}
                  >
                    <span>{finding.title}</span>
                    <span className="advisory-id">
                      {finding.aliases.find((alias) => alias.startsWith('CVE-')) ??
                        finding.advisoryId}
                      {finding.score !== null && (
                        <span className="cvss">cvss {finding.score.toFixed(1)}</span>
                      )}
                    </span>
                  </button>
                </td>
                <td>
                  <div className="package-cell">
                    <PackageIcon size={14} />
                    <span>{finding.package}</span>
                  </div>
                  <span className="package-version">{finding.version}</span>
                </td>
                <td>
                  <span className="project-cell">
                    <span className="project-dot" />
                    {finding.project}
                  </span>
                </td>
                <td>
                  <span className="fix-label">
                    {finding.fixedVersions.length ? (
                      <>
                        <span className="fix-dot" />
                        available
                      </>
                    ) : (
                      'no fix yet'
                    )}
                  </span>
                </td>
                <td>
                  <button
                    className="row-open icon-button"
                    aria-label={`view ${finding.advisoryId}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onSelect(finding)
                    }}
                  >
                    <ArrowRightIcon size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && (
        <EmptyState
          title={
            search || severity !== 'all' || project !== 'all'
              ? 'no matching findings'
              : tab === 'ignored'
                ? 'no ignored findings'
                : 'no findings'
          }
          text={
            search || severity !== 'all' || project !== 'all'
              ? 'try a different search or remove a filter.'
              : 'findings from your dependency scans will appear here.'
          }
          action={
            (search || severity !== 'all' || project !== 'all') && (
              <button
                className="button"
                onClick={() => {
                  setSearch('')
                  setSeverity('all')
                  setProject('all')
                }}
              >
                clear filters
              </button>
            )
          }
        />
      )}
      <div className="table-footer">
        <span>
          {filtered.length
            ? `${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, filtered.length)} of ${filtered.length} findings`
            : '0 findings'}
          <span className="footer-separator">·</span>prioritized by severity
        </span>
        <div>
          <button
            className="icon-button"
            aria-label="previous findings page"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            <CaretLeftIcon size={14} />
          </button>
          <span>
            {currentPage + 1} / {Math.max(1, Math.ceil(filtered.length / pageSize))}
          </span>
          <button
            className="icon-button"
            aria-label="next findings page"
            disabled={(currentPage + 1) * pageSize >= filtered.length}
            onClick={() => setPage(currentPage + 1)}
          >
            <CaretRightIcon size={14} />
          </button>
        </div>
      </div>
    </section>
  )
}
