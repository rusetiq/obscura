import { useState } from 'react'
import { CaretDownIcon, TrendDownIcon } from '@phosphor-icons/react'
import type { Workspace } from '../../shared/types'

const sample = [
  31, 29, 31, 28, 26, 27, 24, 24, 22, 23, 20, 22, 21, 17, 19, 17, 18, 17, 16, 18, 14, 15, 15, 13,
  14, 12, 13, 12,
]

export function TrendChart({ demo, workspace }: { demo: boolean; workspace: Workspace }) {
  const [days, setDays] = useState(30)
  const [project, setProject] = useState('')
  const projects = [
    ...new Set(
      workspace.scans.filter((scan) => scan.status === 'completed').map((scan) => scan.project),
    ),
  ]
  const selectedProject = projects.includes(project) ? project : (projects[0] ?? '')
  const [hover, setHover] = useState<number | null>(null)
  const scans = workspace.scans
    .filter(
      (scan) =>
        scan.status === 'completed' &&
        scan.project === selectedProject &&
        new Date(scan.completedAt ?? scan.createdAt).getTime() >= Date.now() - days * 86400000,
    )
    .slice()
    .sort(
      (a, b) => Date.parse(a.completedAt ?? a.createdAt) - Date.parse(b.completedAt ?? b.createdAt),
    )
  const values = demo ? sample.slice(days === 7 ? -7 : 0) : scans.map((scan) => scan.findingCount)
  const peak = Math.max(1, ...values)
  const step = Math.pow(10, Math.floor(Math.log10(peak)))
  const max = Math.max(2, Math.ceil(peak / step) * step)
  const width = 700
  const height = 156
  const timestamps = scans.map((scan) => Date.parse(scan.completedAt ?? scan.createdAt))
  const firstTime = timestamps[0] ?? 0
  const timeSpan = Math.max(1, (timestamps.at(-1) ?? 0) - firstTime)
  const points = values.map((value, index) => [
    16 +
      (demo ? index / Math.max(1, values.length - 1) : (timestamps[index] - firstTime) / timeSpan) *
        (width - 32),
    height - 12 - (value / max) * (height - 30),
  ])
  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const last = values.at(-1) ?? 0
  const reduction =
    values.length > 1 && values[0] > 0 ? Math.round(((values[0] - last) / values[0]) * 100) : 0
  const now = new Date()
  const dateLabels = demo
    ? [
        values.length - 1,
        Math.round(((values.length - 1) * 2) / 3),
        Math.round((values.length - 1) / 3),
        0,
      ].map((offset) =>
        new Date(now.getTime() - offset * 86400000).toLocaleDateString('en-us', {
          month: 'short',
          day: 'numeric',
        }),
      )
    : [scans[0], scans.at(-1)]
        .filter((scan) => scan !== undefined)
        .map((scan) =>
          new Date(scan.createdAt).toLocaleString('en-us', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }),
        )
  return (
    <section className="trend-panel" aria-label="vulnerability trend">
      <div className="panel-heading">
        <div>
          <h2>vulnerability trend</h2>
          <p>
            {demo ? 'sample finding counts over time.' : selectedProject || 'no completed scans'}
          </p>
        </div>
        <div className="chart-controls">
          {!demo && projects.length > 1 && (
            <label className="period-select">
              <span className="sr-only">chart project</span>
              <select
                aria-label="chart project"
                value={selectedProject}
                onChange={(event) => {
                  setProject(event.target.value)
                  setHover(null)
                }}
              >
                {projects.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <CaretDownIcon size={12} />
            </label>
          )}
          <label className="period-select">
            <span className="sr-only">chart period</span>
            <select
              value={days}
              onChange={(event) => {
                setDays(Number(event.target.value))
                setHover(null)
              }}
            >
              <option value={30}>last 30 days</option>
              <option value={7}>last 7 days</option>
            </select>
            <CaretDownIcon size={12} />
          </label>
        </div>
      </div>
      <div className="trend-summary">
        <span>{values.length ? last : 'n/a'}</span>
        <span className="trend-unit">
          {demo ? 'open vulnerabilities' : 'findings in latest scan'}
        </span>
        {demo && reduction > 0 && (
          <span className="trend-change">
            <TrendDownIcon size={15} />
            {reduction}% <span>vs. first {demo ? 'day' : 'scan'}</span>
          </span>
        )}
      </div>
      <div className="chart">
        <div className="chart-labels" aria-hidden="true">
          <span style={{ top: '19.2308%' }}>{max}</span>
          <span style={{ top: '55.7692%' }}>{max / 2}</span>
          <span style={{ top: '92.3077%' }}>0</span>
        </div>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${demo ? 'sample' : 'scan'} finding counts: ${values.join(', ') || 'no completed scans'}`}
          onMouseLeave={() => setHover(null)}
        >
          {[30, 87, 144].map((y) => (
            <line
              key={y}
              x1="0"
              x2={width}
              y1={y}
              y2={y}
              stroke="currentcolor"
              strokeDasharray="3 5"
            />
          ))}
          {points.length > 0 && (
            <>
              <path
                d={path}
                className="chart-line"
                fill="none"
                stroke="var(--violet)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {points.map(([x, y], index) => (
                <g key={index} onMouseEnter={() => setHover(index)}>
                  <rect x={x - 13} y="0" width="26" height={height} fill="transparent" />
                  {(index === points.length - 1 || hover === index) && (
                    <>
                      <circle
                        cx={x}
                        cy={y}
                        r="4"
                        fill="var(--lavender)"
                        stroke="var(--canvas)"
                        strokeWidth="3"
                      />
                      {hover === index && (
                        <text
                          x={Math.min(670, Math.max(25, x))}
                          y={Math.max(15, y - 14)}
                          textAnchor="middle"
                          fill="var(--text)"
                          fontSize="12"
                        >
                          {values[index]} findings
                        </text>
                      )}
                    </>
                  )}
                </g>
              ))}
            </>
          )}
          {!values.length && (
            <text x="350" y="90" textAnchor="middle" fill="var(--muted)" fontSize="13">
              no completed scans in this period.
            </text>
          )}
        </svg>
      </div>
      <div className="chart-dates">
        {dateLabels.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>
    </section>
  )
}
