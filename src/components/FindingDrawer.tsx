import { useEffect, useState } from 'react'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  CheckIcon,
  CopyIcon,
  DownloadSimpleIcon,
  EyeSlashIcon,
} from '@phosphor-icons/react'
import type { Finding } from '../../shared/types'
import { api, download } from '../lib/api'
import { sampleAnalysis } from '../lib/demo'
import { ErrorMessage, ExternalLink, Modal, SeverityBadge } from './ui'

interface Fix {
  filename: string
  content: string
  from: string
  to: string
  package: string
  instructions: string
}

export function FindingDrawer({
  finding,
  demo,
  close,
  onStatus,
  notify,
}: {
  finding: Finding
  demo: boolean
  close: () => void
  onStatus: (finding: Finding) => void
  notify: (message: string) => void
}) {
  const [analysis, setAnalysis] = useState(finding.analysis ?? '')
  const [busy, setBusy] = useState<'analysis' | 'fix' | 'status' | null>(null)
  const [error, setError] = useState('')
  const [fix, setFix] = useState<Fix | null>(null)
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  useEffect(() => {
    if (demo) return
    let active = true
    api<{ ai: boolean }>('/health')
      .then((health) => {
        if (active) setAiAvailable(health.ai)
      })
      .catch(() => {
        if (active) setAiAvailable(false)
      })
    return () => {
      active = false
    }
  }, [demo])
  async function analyze() {
    setBusy('analysis')
    setError('')
    try {
      if (demo) setAnalysis(sampleAnalysis(finding))
      else
        setAnalysis(
          (await api<{ analysis: string }>(`/findings/${finding.id}/analysis`, { method: 'POST' }))
            .analysis,
        )
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(null)
    }
  }
  async function prepareFix() {
    setBusy('fix')
    setError('')
    try {
      if (demo) {
        setError(
          'this is a sample finding. run a real scan on a pinned package.json to prepare an osv-checked manifest fix.',
        )
        return
      }
      setFix(await api<Fix>(`/findings/${finding.id}/fix`, { method: 'POST' }))
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(null)
    }
  }
  async function changeStatus() {
    setBusy('status')
    setError('')
    const status = finding.status === 'open' ? 'ignored' : 'open'
    try {
      const updated = demo
        ? { ...finding, status }
        : await api<Finding>(`/findings/${finding.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status }),
          })
      onStatus(updated as Finding)
      notify(status === 'ignored' ? 'finding moved to ignored.' : 'finding reopened.')
      close()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <Modal title="finding details" close={close} className="drawer">
      <div className="drawer-body">
        <div className="finding-meta">
          <SeverityBadge severity={finding.severity} />
          <span className="mono">{finding.advisoryId}</span>
          {demo && <span className="sample-tag">sample finding</span>}
        </div>
        <h2 className="detail-title">{finding.title}</h2>
        <div className="detail-project">
          {finding.project}
          <span>/</span>
          {finding.direct ? 'direct dependency' : 'transitive dependency'}
        </div>
        <div className="version-route">
          <div>
            <span className="eyebrow">installed version</span>
            <strong>
              {finding.package}
              <span>@{finding.version}</span>
            </strong>
          </div>
          <ArrowRightIcon size={20} />
          <div>
            <span className="eyebrow">advisory fix</span>
            <strong>{finding.fixedVersions[0] ?? 'not available'}</strong>
          </div>
        </div>
        <section className="detail-section">
          <span className="eyebrow">advisory details</span>
          <p>{finding.details}</p>
          <div className="detail-data">
            <div>
              <span>ecosystem</span>
              <strong>{finding.ecosystem}</strong>
            </div>
            <div>
              <span>cvss score</span>
              <strong>{finding.score?.toFixed(1) ?? 'not provided'}</strong>
            </div>
            <div>
              <span>dependency path</span>
              <strong className="mono">{finding.path}</strong>
            </div>
          </div>
        </section>
        <section className="analysis-section">
          <div className="section-heading">
            <h3>ai analysis</h3>
            {analysis && (
              <span className="sample-tag">{demo ? 'sample analysis' : 'ai generated'}</span>
            )}
          </div>
          <p className="muted">
            {demo
              ? 'this example is prewritten. it is not a live ai response.'
              : aiAvailable === false
                ? 'ai analysis is not configured for this workspace.'
                : 'generate a risk summary and verification steps from this advisory.'}
          </p>
          {analysis ? (
            <div className="analysis-content">{analysis}</div>
          ) : (
            <>
              {busy === 'analysis' && (
                <div className="analysis-placeholder loading" aria-label="generating analysis">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <button
                className="button analysis-button"
                onClick={analyze}
                disabled={!!busy || (!demo && aiAvailable !== true)}
              >
                {busy === 'analysis'
                  ? 'reading the advisory…'
                  : demo
                    ? 'view sample analysis'
                    : aiAvailable === null
                      ? 'checking ai connection…'
                      : aiAvailable
                        ? 'analyze with ai'
                        : 'ai unavailable'}
              </button>
            </>
          )}
          <p className="small-note">
            ai analysis uses advisory evidence. source reachability and compatibility need your
            review.
          </p>
        </section>
        {fix && (
          <section className="fix-preview">
            <h3>
              <CheckIcon size={18} />a fix is ready for review
            </h3>
            <div className="code-diff">
              <div>
                - "{fix.package}": "{fix.from}"
              </div>
              <div>
                + "{fix.package}": "{fix.to}"
              </div>
            </div>
            <p>{fix.instructions}</p>
            <button
              className="button primary"
              onClick={() => {
                download(fix.filename, fix.content)
                notify('proposed package.json downloaded. install, test, and rescan to verify.')
              }}
            >
              <DownloadSimpleIcon size={16} />
              download {fix.filename}
            </button>
          </section>
        )}
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <section className="detail-section">
          <span className="eyebrow">references</span>
          <div className="reference-links">
            <ExternalLink
              href={`https://osv.dev/vulnerability/${encodeURIComponent(finding.advisoryId)}`}
            >
              osv advisory
            </ExternalLink>
            {finding.references.slice(0, 3).map((url, index) => (
              <ExternalLink key={url} href={url}>
                {index === 0 ? 'upstream reference' : `reference ${index + 1}`}
              </ExternalLink>
            ))}
          </div>
        </section>
      </div>
      <div className="drawer-actions">
        <button className="button" onClick={changeStatus} disabled={!!busy}>
          <EyeSlashIcon size={16} />
          {finding.status === 'ignored' ? 'reopen' : 'ignore'}
        </button>
        <button
          className="icon-button"
          aria-label="copy advisory id"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(finding.advisoryId)
              notify('advisory id copied.')
            } catch {
              setError('clipboard access is unavailable. select and copy the advisory id above.')
            }
          }}
        >
          <CopyIcon size={18} />
        </button>
        <button
          className="button primary"
          disabled={!!busy || !finding.fixedVersions.length}
          onClick={prepareFix}
        >
          {busy === 'fix' ? 'checking upgrade versions…' : 'prepare a fix'}
          <ArrowUpRightIcon size={16} />
        </button>
      </div>
    </Modal>
  )
}
