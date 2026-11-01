import { useCallback, useState, type FormEvent } from 'react'
import {
  CalendarDotsIcon,
  PencilSimpleIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react'
import type { ScanSchedule, Workspace } from '../../shared/types'
import { api, relativeTime } from '../lib/api'
import { EmptyState, ErrorMessage, Modal } from './ui'

const intervalHours = { hourly: 1, daily: 24, weekly: 168 }

function localDateValue(value: string | number) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function displayTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(value))
    .toLowerCase()
}

export function SchedulesView({
  workspace,
  demo,
  onLive,
  refresh,
  notify,
}: {
  workspace: Workspace
  demo: boolean
  onLive: () => void
  refresh: () => Promise<void>
  notify: (message: string) => void
}) {
  const [editor, setEditor] = useState<ScanSchedule | 'new' | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const close = useCallback(() => setEditor(null), [])
  const projects = [...new Set(workspace.scans.map((scan) => scan.project))]
  const schedules = demo ? [] : workspace.schedules
  async function action(schedule: ScanSchedule, operation: 'toggle' | 'run' | 'delete') {
    setBusy(schedule.id)
    setError('')
    try {
      if (operation === 'toggle')
        await api(`/schedules/${schedule.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !schedule.enabled }),
        })
      if (operation === 'run') await api(`/schedules/${schedule.id}/run`, { method: 'POST' })
      if (operation === 'delete') await api(`/schedules/${schedule.id}`, { method: 'DELETE' })
      await refresh()
      notify(
        operation === 'run'
          ? 'scheduled scan started.'
          : operation === 'delete'
            ? 'schedule removed.'
            : schedule.enabled
              ? 'schedule paused.'
              : 'schedule resumed.',
      )
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(null)
    }
  }
  return (
    <section className="schedules-view">
      <div className="section-heading">
        <div>
          <h2>
            recurring scans <span className="count-badge">{schedules.length}</span>
          </h2>
        </div>
        {!demo && projects.length > 0 && (
          <button className="button primary" onClick={() => setEditor('new')}>
            <PlusIcon size={15} />
            add schedule
          </button>
        )}
      </div>
      {demo ? (
        <EmptyState
          title="schedule scans for your projects"
          text="switch to your live workspace to create recurring scans."
          action={
            <button className="button" onClick={onLive}>
              open live workspace
            </button>
          }
        />
      ) : !projects.length ? (
        <EmptyState
          title="upload a manifest first"
          text="once a project has a manifest, you can schedule recurring checks against osv."
        />
      ) : !schedules.length ? (
        <EmptyState
          title="no schedules yet"
          text="choose how often to recheck your project's latest uploaded dependencies."
          action={
            <button className="button" onClick={() => setEditor('new')}>
              create a schedule
            </button>
          }
        />
      ) : (
        <>
          <div className="schedule-list">
            {schedules.map((schedule) => (
              <article key={schedule.id} className="schedule-item">
                <div className="schedule-item-heading">
                  <CalendarDotsIcon size={19} />
                  <div>
                    <h3>{schedule.name}</h3>
                    <span>
                      {schedule.project} · {schedule.frequency}
                    </span>
                  </div>
                  <button
                    role="switch"
                    aria-checked={schedule.enabled}
                    aria-label={`${schedule.enabled ? 'pause' : 'resume'} ${schedule.name}`}
                    className={`schedule-switch ${schedule.enabled ? 'enabled' : ''}`}
                    disabled={busy === schedule.id}
                    onClick={() => void action(schedule, 'toggle')}
                  >
                    <span />
                  </button>
                  <span className="schedule-state">{schedule.enabled ? 'active' : 'paused'}</span>
                </div>
                <div className="schedule-item-details">
                  <div>
                    <span>next run</span>
                    <time dateTime={schedule.nextRunAt}>
                      {schedule.enabled ? displayTime(schedule.nextRunAt) : 'paused'}
                    </time>
                  </div>
                  <div>
                    <span>last run</span>
                    <strong>
                      {schedule.lastRunAt ? relativeTime(schedule.lastRunAt) : 'not run yet'}
                    </strong>
                  </div>
                  <div>
                    <span>last scan</span>
                    <strong>{schedule.lastScanStatus ?? 'none'}</strong>
                  </div>
                  <div className="schedule-actions">
                    <button
                      className="button"
                      aria-label={`run ${schedule.name} now`}
                      disabled={
                        busy === schedule.id ||
                        schedule.lastScanStatus === 'queued' ||
                        schedule.lastScanStatus === 'scanning'
                      }
                      onClick={() => void action(schedule, 'run')}
                    >
                      <PlayIcon size={13} />
                      run now
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`edit ${schedule.name}`}
                      disabled={busy === schedule.id}
                      onClick={() => setEditor(schedule)}
                    >
                      <PencilSimpleIcon size={16} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`remove ${schedule.name}`}
                      disabled={busy === schedule.id}
                      onClick={() => void action(schedule, 'delete')}
                    >
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
                {schedule.lastError && <ErrorMessage>{schedule.lastError}</ErrorMessage>}
              </article>
            ))}
          </div>
          <p className="schedule-timezone">
            times in {Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase()} · checked
            every minute
          </p>
        </>
      )}
      {error && <ErrorMessage>{error}</ErrorMessage>}
      {editor && (
        <ScheduleEditor
          schedule={editor === 'new' ? null : editor}
          projects={projects}
          close={close}
          onSaved={async () => {
            close()
            await refresh()
            notify('schedule saved.')
          }}
        />
      )}
    </section>
  )
}

function ScheduleEditor({
  schedule,
  projects,
  close,
  onSaved,
}: {
  schedule: ScanSchedule | null
  projects: string[]
  close: () => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(schedule?.name ?? '')
  const [project, setProject] = useState(schedule?.project ?? projects[0])
  const [frequency, setFrequency] = useState(schedule?.frequency ?? 'daily')
  const [nextRun, setNextRun] = useState(
    localDateValue(
      schedule && Date.parse(schedule.nextRunAt) > Date.now()
        ? schedule.nextRunAt
        : Date.now() + 3600000,
    ),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(schedule ? `/schedules/${schedule.id}` : '/schedules', {
        method: schedule ? 'PATCH' : 'POST',
        body: JSON.stringify({
          name,
          project,
          frequency,
          nextRunAt: new Date(nextRun).toISOString(),
        }),
      })
      await onSaved()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title={schedule ? 'edit schedule' : 'new schedule'} close={busy ? () => {} : close}>
      <form className="schedule-form" onSubmit={submit}>
        <label className="field">
          schedule name
          <input
            autoFocus
            required
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            placeholder="daily dependency check"
          />
        </label>
        <label className="field">
          project
          <select
            aria-label="project"
            value={project}
            disabled={!!schedule}
            onChange={(event) => setProject(event.target.value)}
          >
            {projects.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <div className="schedule-form-grid">
          <label className="field">
            repeat
            <select
              aria-label="repeat"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value as ScanSchedule['frequency'])}
            >
              <option value="hourly">hourly</option>
              <option value="daily">daily</option>
              <option value="weekly">weekly</option>
            </select>
          </label>
          <label className="field">
            first run
            <input
              type="datetime-local"
              aria-label="first run"
              required
              value={nextRun}
              onChange={(event) => setNextRun(event.target.value)}
            />
          </label>
        </div>
        <p className="upload-note">
          rechecks the latest uploaded manifest every {intervalHours[frequency]}{' '}
          {intervalHours[frequency] === 1 ? 'hour' : 'hours'}. upload an updated manifest when
          dependencies change. times are shown in{' '}
          {Intl.DateTimeFormat().resolvedOptions().timeZone.toLowerCase()}.
        </p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="modal-actions">
          <button className="button" type="button" disabled={busy} onClick={close}>
            cancel
          </button>
          <button className="button primary" type="submit" disabled={busy}>
            {busy ? 'saving…' : 'save schedule'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
