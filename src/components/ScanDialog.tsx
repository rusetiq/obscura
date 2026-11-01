import { useRef, useState, type FormEvent } from 'react'
import { ArrowUpRightIcon, FileCodeIcon, UploadSimpleIcon, XIcon } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { ErrorMessage, Modal } from './ui'

export function ScanDialog({ close, onScan }: { close: () => void; onScan: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [project, setProject] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  function choose(next?: File) {
    if (!next) return
    if (!['package.json', 'package-lock.json', 'requirements.txt'].includes(next.name)) {
      setError('choose package.json, package-lock.json, or requirements.txt.')
      return
    }
    if (next.size > 2_000_000) {
      setError('choose a file smaller than 2 mb.')
      return
    }
    setFile(next)
    setError('')
  }
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) {
      setError('choose a manifest to scan.')
      return
    }
    setBusy(true)
    setError('')
    const form = new FormData()
    form.set('manifest', file)
    form.set('project', project)
    try {
      await api('/scans', { method: 'POST', body: form })
      onScan()
    } catch (error) {
      setError((error as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Modal title="start a new scan" close={busy ? () => {} : close}>
      <form onSubmit={submit} className="scan-form">
        <div className="dialog-intro">
          <span>we’ll check exact package versions against osv’s vulnerability database.</span>
        </div>
        <label className="field">
          project name
          <input
            autoFocus
            value={project}
            onChange={(event) => setProject(event.target.value)}
            placeholder="e.g. engineering / web-platform"
            maxLength={80}
            pattern="[\w][\w ./\-]{0,79}"
            required
          />
          <span className="field-help">
            use the same name to update an existing project’s findings.
          </span>
        </label>
        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            choose(event.dataTransfer.files[0])
          }}
        >
          <input
            ref={input}
            aria-label="dependency manifest"
            type="file"
            accept=".json,.txt"
            onChange={(event) => choose(event.target.files?.[0])}
            hidden
          />
          {file ? (
            <div className="chosen-file">
              <FileCodeIcon size={28} />
              <div>
                <strong>{file.name}</strong>
                <span>{(file.size / 1024).toFixed(1)} kb · ready to scan</span>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="remove file"
                onClick={() => setFile(null)}
              >
                <XIcon size={18} />
              </button>
            </div>
          ) : (
            <button type="button" className="upload-target" onClick={() => input.current?.click()}>
              <UploadSimpleIcon size={28} />
              <strong>
                drop a manifest here, or <u>browse files</u>
              </strong>
              <span>package-lock.json, package.json, requirements.txt · up to 2 mb</span>
            </button>
          )}
        </div>
        <p className="upload-note">
          lockfiles give the fullest picture, including transitive dependencies. only pinned
          versions are scanned. files are stored privately in your workspace.
        </p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <div className="modal-actions">
          <button type="button" className="button" onClick={close} disabled={busy}>
            cancel
          </button>
          <button className="button primary" type="submit" disabled={busy || !file}>
            {busy ? 'starting scan…' : 'run vulnerability scan'}
            <ArrowUpRightIcon size={16} />
          </button>
        </div>
      </form>
    </Modal>
  )
}
