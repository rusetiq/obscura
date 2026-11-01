import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  ArrowRightIcon,
  ArrowUpRightIcon,
  BellIcon,
  BookOpenIcon,
  CaretDownIcon,
  CaretRightIcon,
  CheckIcon,
  ClockCounterClockwiseIcon,
  CalendarDotsIcon,
  CommandIcon,
  DownloadSimpleIcon,
  GearSixIcon,
  GitBranchIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  SidebarSimpleIcon,
  SquaresFourIcon,
  StackIcon,
  SunIcon,
  MoonIcon,
  CompassIcon,
} from '@phosphor-icons/react'
import { severityOrder, type Finding, type Severity, type Workspace } from '../shared/types'
import { api, download, relativeTime } from './lib/api'
import { applyTheme, savedTheme, type Theme } from './lib/theme'
import { demoWorkspace } from './lib/demo'
import { FindingDrawer } from './components/FindingDrawer'
import { FindingTable } from './components/FindingTable'
import { ScanDialog } from './components/ScanDialog'
import { SchedulesView } from './components/SchedulesView'
import { TrendChart } from './components/TrendChart'
import { ProjectsView, ScansView, SettingsView } from './components/WorkspaceViews'
import { EmptyState, ErrorMessage, Logo, Modal, Toast } from './components/ui'
import { LandingPage } from './components/LandingPage'

type View =
  'landing' | 'overview' | 'vulnerabilities' | 'projects' | 'scans' | 'schedules' | 'settings'
const labels: Record<View, string> = {
  landing: 'landing page',
  overview: 'overview',
  vulnerabilities: 'vulnerabilities',
  projects: 'projects',
  scans: 'scan history',
  schedules: 'schedules',
  settings: 'settings',
}
const navigation = [
  { view: 'overview', icon: SquaresFourIcon },
  { view: 'vulnerabilities', icon: ShieldWarningIcon },
  { view: 'projects', icon: GitBranchIcon },
  { view: 'scans', icon: ClockCounterClockwiseIcon },
  { view: 'schedules', icon: CalendarDotsIcon },
] as const
const emptyWorkspace: Workspace = { scans: [], findings: [], schedules: [] }

function Login({
  configurationError,
  onLogin,
  onLanding,
}: {
  configurationError: string
  onLogin: () => void
  onLanding?: () => void
}) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/session', { method: 'POST', body: JSON.stringify({ password }) })
      onLogin()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="login-screen">
      <Logo />
      <form onSubmit={submit}>
        <h1>sign in to your workspace</h1>
        <p>enter your workspace password to continue.</p>
        {configurationError ? (
          <ErrorMessage>{configurationError}</ErrorMessage>
        ) : (
          <>
            <label className="field">
              workspace password
              <input
                type="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <ErrorMessage>{error}</ErrorMessage>}
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'signing in…' : 'open workspace'}
              <ArrowRightIcon size={17} />
            </button>
          </>
        )}
        {onLanding && (
          <div className="login-landing-bar">
            <button type="button" onClick={onLanding}>
              <CompassIcon size={14} />
              <span>view landing page</span>
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(savedTheme)
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  const [session, setSession] = useState<'loading' | 'locked' | 'ready'>('loading')
  const [configurationError, setConfigurationError] = useState('')
  const [view, setView] = useState<View>(() => {
    const path = window.location.pathname.slice(1)
    return Object.hasOwn(labels, path) ? (path as View) : 'overview'
  })
  const [demo, setDemo] = useState(() => {
    const query = new URLSearchParams(location.search)
    if (query.get('sample') === '1') return true
    if (query.get('workspace') === 'live') return false
    return (
      (localStorage.getItem('obscura.workspace') ?? localStorage.getItem('dope.workspace')) !==
      'live'
    )
  })
  const [live, setLive] = useState<Workspace>(emptyWorkspace)
  const [sample, setSample] = useState<Workspace>(demoWorkspace)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanOpen, setScanOpen] = useState(false)
  const [selected, setSelected] = useState<Finding | null>(null)
  const [search, setSearch] = useState('')
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [commandOpen, setCommandOpen] = useState(false)
  const [command, setCommand] = useState('')
  const [notifications, setNotifications] = useState(false)
  const [sidebar, setSidebar] = useState(false)
  const [toast, setToast] = useState('')
  const refreshVersion = useRef(0)
  const workspace = demo ? sample : live
  const open = workspace.findings.filter((finding) => finding.status === 'open')
  const critical = open.filter((finding) => finding.severity === 'critical').length
  const latestScans = workspace.scans.filter(
    (scan, index, scans) =>
      scans.findIndex(
        (candidate) => candidate.project === scan.project && candidate.status === 'completed',
      ) === index && scan.status === 'completed',
  )
  const projects = new Set(workspace.scans.map((scan) => scan.project)).size
  const running = live.scans.some((scan) => scan.status === 'queued' || scan.status === 'scanning')
  const closeScan = useCallback(() => setScanOpen(false), [])
  const closeFinding = useCallback(() => setSelected(null), [])
  const closeCommand = useCallback(() => setCommandOpen(false), [])
  const closeNotifications = useCallback(() => setNotifications(false), [])
  const dismissToast = useCallback(() => setToast(''), [])

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current
    setLoading(true)
    try {
      const data = await api<Workspace>('/workspace')
      if (version === refreshVersion.current) {
        setLive(data)
        setError('')
      }
    } catch (error) {
      if (version === refreshVersion.current) setError((error as Error).message)
    } finally {
      if (version === refreshVersion.current) setLoading(false)
    }
  }, [])

  const loadSession = useCallback(async () => {
    try {
      const result = await api<{ authenticated: boolean }>('/session')
      setSession(result.authenticated ? 'ready' : 'locked')
      if (result.authenticated) void refresh()
    } catch (error) {
      setConfigurationError((error as Error).message)
      setSession('locked')
    }
  }, [refresh])

  useEffect(() => {
    void loadSession()
  }, [loadSession])
  useEffect(() => {
    if (session !== 'ready' || demo) return
    const timer = setInterval(
      () => {
        void refresh()
      },
      running ? 2500 : view === 'schedules' ? 5000 : 30000,
    )
    return () => clearInterval(timer)
  }, [session, demo, running, refresh, view])
  useEffect(() => {
    document.title = `${labels[view]} · obscura`
  }, [view])
  useEffect(() => {
    const pop = () => {
      const path = window.location.pathname.slice(1)
      setView(Object.hasOwn(labels, path) ? (path as View) : 'overview')
    }
    window.addEventListener('popstate', pop)
    return () => window.removeEventListener('popstate', pop)
  }, [])
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      const editable =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        setCommandOpen((value) => !value)
      }
      if (event.key === '/' && !editable && !document.querySelector('dialog[open]')) {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('[aria-label="search vulnerabilities"]')?.focus()
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [])

  function navigate(next: View) {
    setView(next)
    setSidebar(false)
    window.history.pushState(null, '', next === 'overview' ? '/' : `/${next}`)
  }
  function switchWorkspace(value: boolean) {
    setDemo(value)
    localStorage.setItem('obscura.workspace', value ? 'sample' : 'live')
    setSearch('')
    setSeverity('all')
    setSelected(null)
    if (!value) void refresh()
  }
  function statusChanged(finding: Finding) {
    if (demo)
      setSample((previous) => ({
        ...previous,
        findings: previous.findings.map((current) =>
          current.id === finding.id ? finding : current,
        ),
      }))
    else
      setLive((previous) => ({
        ...previous,
        findings: previous.findings.map((current) =>
          current.id === finding.id ? finding : current,
        ),
      }))
  }

  if (view === 'landing')
    return (
      <LandingPage
        theme={theme}
        onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        onOpenWorkspace={() => {
          switchWorkspace(false)
          navigate('overview')
        }}
        onOpenSample={() => {
          switchWorkspace(true)
          navigate('overview')
        }}
      />
    )

  if (session === 'loading')
    return (
      <div className="app-loading">
        <Logo />
        <div className="loading-track" />
        <span>opening your workspace</span>
      </div>
    )
  if (session === 'locked' && !demo)
    return (
      <Login
        configurationError={configurationError}
        onLogin={() => {
          void loadSession()
        }}
        onLanding={() => navigate('landing')}
      />
    )

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebar ? 'is-open' : ''}`}>
        <a
          href="/"
          className="brand-link"
          aria-label="obscura overview"
          onClick={(event) => {
            event.preventDefault()
            navigate('overview')
          }}
        >
          <Logo />
        </a>
        <div className="workspace-switcher">
          <span className="workspace-avatar">e</span>
          <div>
            <strong>engineering</strong>
            <select
              aria-label="workspace data source"
              value={demo ? 'sample' : 'live'}
              onChange={(event) => switchWorkspace(event.target.value === 'sample')}
            >
              <option value="sample">sample workspace</option>
              <option value="live">live workspace</option>
            </select>
          </div>
          <CaretDownIcon size={13} />
        </div>
        <button className="sidebar-search" onClick={() => setCommandOpen(true)}>
          <MagnifyingGlassIcon size={16} />
          <span>quick search</span>
          <kbd>⌘ k</kbd>
        </button>
        <nav aria-label="main navigation">
          {navigation.map(({ view: target, icon: Icon }) => (
            <button
              key={target}
              onClick={() => {
                setSearch('')
                setSeverity('all')
                navigate(target)
              }}
              className={view === target ? 'active' : ''}
            >
              <Icon size={18} weight={view === target ? 'fill' : 'regular'} />
              <span>{labels[target]}</span>
              {target === 'vulnerabilities' && open.length > 0 && (
                <span className="nav-count">{open.length}</span>
              )}
              {target === 'scans' && running && !demo && <span className="nav-count">running</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button onClick={() => navigate('landing')}>
            <CompassIcon size={18} />
            <span>landing page</span>
          </button>
          <a href="https://google.github.io/osv.dev/" target="_blank" rel="noreferrer">
            <BookOpenIcon size={18} />
            <span>documentation</span>
            <ArrowUpRightIcon size={13} />
          </a>
          <button
            className={view === 'settings' ? 'active' : ''}
            onClick={() => navigate('settings')}
          >
            <GearSixIcon size={18} />
            <span>settings</span>
          </button>
          <button className="profile" onClick={() => navigate('settings')}>
            <span className="profile-avatar">en</span>
            <span>
              <strong>engineering team</strong>
              <span>your private workspace</span>
            </span>
          </button>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-backdrop"
          aria-label="close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <button
              className="icon-button mobile-menu"
              aria-label="toggle navigation"
              onClick={() => setSidebar(!sidebar)}
            >
              <SidebarSimpleIcon size={20} />
            </button>
            <span>workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{labels[view]}</strong>
          </div>
          <div className="topbar-right">
            {demo && <span className="sample-tag topbar-sample">sample data</span>}
            <button
              className="topbar-command"
              onClick={() => setCommandOpen(true)}
              aria-label="open command menu"
            >
              <CommandIcon size={15} />
              <span>k</span>
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button theme-toggle"
              aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              {theme === 'dark' ? <SunIcon size={19} /> : <MoonIcon size={19} />}
            </button>
            <button
              className="icon-button notification-button"
              aria-label="open recent activity"
              onClick={() => setNotifications(true)}
            >
              <BellIcon size={19} />
            </button>
            <button
              className="topbar-avatar"
              aria-label="workspace settings"
              onClick={() => navigate('settings')}
            >
              en
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{view === 'overview' ? 'security overview' : labels[view]}</h1>
            </div>
            <div className="heading-actions">
              {view !== 'settings' && view !== 'schedules' && (
                <>
                  <button
                    className="button export-button"
                    aria-label="export workspace report"
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
                      setToast('workspace report downloaded.')
                    }}
                  >
                    <DownloadSimpleIcon size={16} />
                    <span>export</span>
                  </button>
                  <button className="button primary" onClick={() => setScanOpen(true)}>
                    <PlusIcon size={16} />
                    new scan
                  </button>
                </>
              )}
            </div>
          </div>
          {demo && (
            <div className="demo-banner">
              <span>
                <strong>sample workspace.</strong>
                <span>these findings are examples.</span>
              </span>
              <button onClick={() => switchWorkspace(false)}>
                go to live workspace
                <ArrowRightIcon size={14} />
              </button>
            </div>
          )}
          {!demo && error && (
            <div className="workspace-error">
              <ErrorMessage>{error}</ErrorMessage>
              <button
                className="button"
                onClick={() => {
                  void refresh()
                }}
              >
                retry
              </button>
            </div>
          )}
          {!demo && loading && live.scans.length === 0 && !error && (
            <div className="workspace-skeleton" aria-label="loading workspace">
              <span />
              <span />
              <span />
            </div>
          )}
          {view === 'overview' && (
            <>
              <div className="stats-row">
                <Stat
                  label="open vulnerabilities"
                  value={open.length}
                  icon={<ShieldWarningIcon size={18} />}
                />
                <Stat
                  label="critical findings"
                  value={critical}
                  icon={<ShieldCheckIcon size={18} />}
                />
                <Stat
                  label="dependencies scanned"
                  value={latestScans.reduce((sum, scan) => sum + scan.dependencyCount, 0)}
                  icon={<StackIcon size={18} />}
                />
                <Stat label="projects" value={projects} icon={<GitBranchIcon size={18} />} />
              </div>
              <div className="insights-grid">
                <TrendChart demo={demo} workspace={workspace} />
                <section className="severity-summary" aria-label="open findings by severity">
                  <h2>findings by severity</h2>
                  <div className="severity-summary-rows">
                    {severityOrder.map((level) => {
                      const count = open.filter((finding) => finding.severity === level).length
                      return (
                        <button
                          key={level}
                          disabled={count === 0}
                          onClick={() => {
                            setSearch('')
                            setSeverity(level)
                            navigate('vulnerabilities')
                          }}
                        >
                          <span>
                            {level === 'unknown'
                              ? 'unrated'
                              : level[0].toLowerCase() + level.slice(1)}
                          </span>
                          <strong>{count}</strong>
                          <ArrowRightIcon size={14} />
                        </button>
                      )
                    })}
                  </div>
                </section>
              </div>
              {workspace.scans.length === 0 && !loading ? (
                <EmptyState
                  title="no scans yet"
                  text="upload a dependency manifest to check its exact package versions against osv."
                  action={
                    <button className="button primary" onClick={() => setScanOpen(true)}>
                      run your first scan
                      <ArrowUpRightIcon size={16} />
                    </button>
                  }
                />
              ) : (
                <FindingTable
                  findings={workspace.findings}
                  onSelect={setSelected}
                  search={search}
                  setSearch={setSearch}
                  severity={severity}
                  setSeverity={setSeverity}
                  compact
                />
              )}
            </>
          )}
          {view === 'vulnerabilities' && (
            <FindingTable
              findings={workspace.findings}
              onSelect={setSelected}
              search={search}
              setSearch={setSearch}
              severity={severity}
              setSeverity={setSeverity}
            />
          )}
          {view === 'projects' && (
            <ProjectsView
              workspace={workspace}
              onScan={() => setScanOpen(true)}
              onProject={(name) => {
                setSearch(name)
                setSeverity('all')
                navigate('vulnerabilities')
              }}
            />
          )}
          {view === 'scans' && <ScansView workspace={workspace} onScan={() => setScanOpen(true)} />}
          {view === 'schedules' && (
            <SchedulesView
              workspace={workspace}
              demo={demo}
              onLive={() => switchWorkspace(false)}
              refresh={refresh}
              notify={setToast}
            />
          )}
          {view === 'settings' && (
            <SettingsView demo={demo} workspace={workspace} notify={setToast} />
          )}
          <footer className="page-footer">
            <a href="https://osv.dev" target="_blank" rel="noreferrer">
              vulnerability data from osv
              <ArrowUpRightIcon size={11} />
            </a>
            <button
              type="button"
              className="footer-landing-link"
              onClick={() => navigate('landing')}
            >
              landing page
            </button>
            <span>{demo ? 'sample data' : 'manifest-based dependency scans'}</span>
          </footer>
        </main>
      </div>
      {scanOpen && (
        <ScanDialog
          close={closeScan}
          onScan={() => {
            setScanOpen(false)
            switchWorkspace(false)
            navigate('scans')
            setToast('scan started. your findings will appear when osv finishes.')
            void refresh()
          }}
        />
      )}
      {selected && (
        <FindingDrawer
          key={selected.id}
          finding={selected}
          demo={demo}
          close={closeFinding}
          onStatus={statusChanged}
          notify={setToast}
        />
      )}
      {commandOpen && (
        <Modal title="search workspace" close={closeCommand} className="command-modal">
          <label className="command-input">
            <MagnifyingGlassIcon size={20} />
            <input
              autoFocus
              placeholder="search findings, projects, or pages…"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
            />
            <kbd>esc</kbd>
          </label>
          <div className="command-results">
            {Object.entries(labels)
              .filter(([, label]) => label.toLowerCase().includes(command.toLowerCase()))
              .map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    navigate(key as View)
                    closeCommand()
                    setCommand('')
                  }}
                >
                  <SquaresFourIcon size={17} />
                  <span>{label}</span>
                  <ArrowRightIcon size={15} />
                </button>
              ))}
            {workspace.findings
              .filter(
                (finding) =>
                  command &&
                  `${finding.title} ${finding.package} ${finding.advisoryId}`
                    .toLowerCase()
                    .includes(command.toLowerCase()),
              )
              .slice(0, 5)
              .map((finding) => (
                <button
                  key={finding.id}
                  onClick={() => {
                    closeCommand()
                    setSelected(finding)
                    setCommand('')
                  }}
                >
                  <ShieldWarningIcon size={17} />
                  <span>
                    {finding.title}
                    <small>
                      {finding.package} · {finding.advisoryId}
                    </small>
                  </span>
                  <ArrowRightIcon size={15} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {notifications && (
        <Modal title="recent activity" close={closeNotifications}>
          <div className="activity-list">
            {workspace.scans.length ? (
              workspace.scans.slice(0, 5).map((scan) => (
                <button
                  key={scan.id}
                  onClick={() => {
                    closeNotifications()
                    navigate('scans')
                  }}
                >
                  <CheckIcon size={18} />
                  <span>
                    <strong>{scan.project}</strong>
                    <span>
                      scan {scan.status} · {scan.findingCount} findings
                    </span>
                  </span>
                  <time>{relativeTime(scan.createdAt)}</time>
                  <CaretRightIcon size={14} />
                </button>
              ))
            ) : (
              <EmptyState title="all quiet for now." text="scan updates will appear here." />
            )}
            {demo && <p className="small-note">activity shown here is illustrative sample data.</p>}
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast} dismiss={dismissToast} />}
    </div>
  )
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <section className="stat">
      <div className="stat-label">
        <span>{label}</span>
        {icon}
      </div>
      <strong className="stat-value">{value.toLocaleString()}</strong>
    </section>
  )
}
