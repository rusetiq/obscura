import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import type { Theme } from '../lib/theme'
import { mountLandingMotion } from '../lib/landing-motion'

interface LandingPageProps {
  theme: Theme
  onToggleTheme: () => void
  onOpenWorkspace: () => void
  onOpenSample: () => void
}

export function LandingPage({
  theme,
  onToggleTheme,
  onOpenWorkspace,
  onOpenSample,
}: LandingPageProps) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => (root.current ? mountLandingMotion(root.current) : undefined), [])
  function activate(event: MouseEvent<HTMLDivElement>) {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('[data-demo]')) {
      event.preventDefault()
      onOpenSample()
    }
    if (target.closest('[data-workspace]')) {
      event.preventDefault()
      onOpenWorkspace()
    }
    if (target.closest('.theme')) {
      onToggleTheme()
    }
  }
  return (
    <div className="landing-page" ref={root} onClick={activate}>
      <div className="progress" aria-hidden="true"></div>
      <div className="ambient" aria-hidden="true">
        <svg viewBox="0 0 800 1000" preserveAspectRatio="xMidYMid slice">
          <path
            id="routes"
            d="M100 0V180L300 380V550L550 800V1000M430 0V250L650 470V720L800 870M750 0V170L560 360V560L760 760V1000M0 650H240L450 860V1000M0 160H180L400 380V660L200 860V1000"
          />
          <use
            href="#routes"
            className="trace"
            style={{ stroke: 'var(--accent)', strokeWidth: 1, fill: 'none' }}
          />
        </svg>
      </div>
      <nav aria-label="landing navigation">
        <a className="brand" href="#top">
          <span className="brand-mark" aria-hidden="true"></span>obscura
        </a>
        <div className="nav-links">
          <a href="#inside">how it works</a>
          <button
            className="theme"
            aria-label={theme === 'dark' ? 'switch to light mode' : 'switch to dark mode'}
          >
            {theme === 'dark' ? '☼' : '☾'}
          </button>
          <a href="/app?workspace=live" data-workspace>
            open workspace ↗
          </a>
        </div>
      </nav>
      <main id="top">
        <section className="hero">
          <h1>
            know what’s
            <br />
            in your <em>dependencies.</em>
          </h1>
          <p className="intro">
            from a vulnerable version to a reviewed fix.
            <br />
            osv finds it. ai helps explain it. you make the call.
          </p>
          <div className="actions">
            <a className="primary" href="/app?sample=1" data-demo>
              explore the demo <span>↗</span>
            </a>
            <a href="#inside">follow the process ↓</a>
          </div>
          <div className="hero-foot">
            <span>workers / d1 / r2</span>
            <a className="scroll-cue" href="#inside">
              keep scrolling <span aria-hidden="true"></span>
            </a>
          </div>
        </section>
        <section className="walkthrough" id="inside" aria-label="scan workflow">
          <div className="section-intro">
            <h2>
              the path from
              <br />
              finding to fix.
            </h2>
            <p>
              scan dependencies, review the context, and decide what changes. one workspace for the
              whole process.
            </p>
            <div className="stage-index">
              <a href="#scan" aria-current="true">
                <span>01</span>scan
              </a>
              <a href="#understand" aria-current="false">
                <span>02</span>understand
              </a>
              <a href="#fix" aria-current="false">
                <span>03</span>fix
              </a>
            </div>
          </div>
          <div className="cards">
            <article className="feature-card" id="scan">
              <span className="card-number" aria-hidden="true">
                01
              </span>
              <div className="example" aria-label="illustrative scan example">
                <div className="example-row">
                  <small>package.json</small>
                  <small>installed version</small>
                </div>
                <div className="example-row">
                  <span>cross-spawn</span>
                  <span>7.0.3</span>
                </div>
                <div className="example-row warning">
                  <span>known advisory found</span>
                  <small>review required</small>
                </div>
              </div>
              <h3>
                start with what
                <br />
                you ship.
              </h3>
              <p>
                upload a manifest. obscura checks your pinned dependency versions against the osv
                vulnerability database.
              </p>
            </article>
            <article className="feature-card" id="understand">
              <span className="card-number" aria-hidden="true">
                02
              </span>
              <div className="example analysis" aria-label="illustrative analysis example">
                <strong>regular expression denial of service</strong>check whether untrusted input
                reaches process spawning. review input validation and test the upgraded dependency.
              </div>
              <h3>
                give the advisory
                <br />
                some context.
              </h3>
              <p>
                groq helps explain the advisory, potential exposure, and verification steps. review
                that guidance against your own application.
              </p>
            </article>
            <article className="feature-card" id="fix">
              <span className="card-number" aria-hidden="true">
                03
              </span>
              <div className="example" aria-label="illustrative candidate fix">
                <div className="example-row removed">− "cross-spawn": "7.0.3"</div>
                <div className="example-row added">+ "cross-spawn": "7.0.6"</div>
                <div className="example-row">
                  <small>candidate manifest · review and test</small>
                </div>
              </div>
              <h3>
                a change you
                <br />
                can inspect.
              </h3>
              <p>
                candidate upgrades for direct npm dependencies are checked against osv again.
                download the proposed manifest, test locally, and rescan.
              </p>
            </article>
          </div>
        </section>
        <section className="details" aria-label="project details">
          <h2>
            security work continues
            <br />
            after the first scan.
          </h2>
          <div className="detail-grid">
            <article className="feature-card">
              <span className="card-number" aria-hidden="true">
                04
              </span>
              <h3>scan on your schedule.</h3>
              <p>
                hourly, daily, or weekly rescans of saved manifests. pause a schedule or run it
                whenever you need.
              </p>
            </article>
            <article className="feature-card">
              <span className="card-number" aria-hidden="true">
                05
              </span>
              <h3>keep the trail.</h3>
              <p>
                project history, finding triage, and json exports. manifests and candidate fixes are
                stored in r2.
              </p>
            </article>
            <article className="feature-card">
              <span className="card-number" aria-hidden="true">
                06
              </span>
              <h3>bring your manifest.</h3>
              <p>
                pinned package.json dependencies, npm lockfiles v2 and v3, and pinned
                requirements.txt packages.
              </p>
            </article>
          </div>
        </section>
        <section className="closing">
          <h2>take a look inside.</h2>
          <p>explore the workspace with sample findings.</p>
          <div className="actions">
            <a className="primary" href="/app?sample=1" data-demo>
              explore the demo <span>↗</span>
            </a>
            <a href="#top">back to top ↑</a>
          </div>
        </section>
      </main>
      <footer>
        <div>
          <a className="brand" href="#top">
            <span className="brand-mark" aria-hidden="true"></span>obscura
          </a>
          <p>dependency security, with context.</p>
        </div>
        <div className="footer-links">
          <a href="https://osv.dev" target="_blank" rel="noreferrer">
            osv ↗
          </a>
          <a href="https://groq.com" target="_blank" rel="noreferrer">
            groq ↗
          </a>
        </div>
      </footer>
    </div>
  )
}
