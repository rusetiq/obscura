import { CheckIcon, XIcon, WarningCircleIcon, ArrowUpRightIcon } from '@phosphor-icons/react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import type { Severity } from '../../shared/types'

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand ${small ? 'brand-small' : ''}`}>
      <svg aria-hidden="true" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="8.5" fill="none" stroke="currentcolor" strokeWidth="5" />
        <circle cx="14" cy="14" r="2" fill="currentcolor" />
      </svg>
      {!small && <span>obscura</span>}
    </span>
  )
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`severity severity-${severity}`}>
      {severity === 'unknown' ? 'unrated' : severity}
    </span>
  )
}

export function ProjectMark({ name }: { name: string }) {
  return (
    <span className={`project-mark project-${name.length % 4}`} aria-hidden="true">
      {name.slice(0, 1).toLowerCase()}
    </span>
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <div className="error-message" role="alert">
      <WarningCircleIcon size={18} />
      <span>{children}</span>
    </div>
  )
}

export function Modal({
  title,
  children,
  close,
  className = '',
}: {
  title: string
  children: ReactNode
  close: () => void
  className?: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current!
    dialog.showModal()
    const cancel = (event: Event) => {
      event.preventDefault()
      close()
    }
    dialog.addEventListener('cancel', cancel)
    return () => {
      dialog.removeEventListener('cancel', cancel)
      dialog.close()
    }
  }, [close])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={`modal ${className}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <div className="modal-header">
        <h2 id={titleId}>{title}</h2>
        <button className="icon-button" aria-label="close dialog" onClick={close}>
          <XIcon size={20} />
        </button>
      </div>
      {children}
    </dialog>
  )
}

export function Toast({ message, dismiss }: { message: string; dismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(dismiss, 5000)
    return () => clearTimeout(timer)
  }, [message, dismiss])
  return (
    <div role="status" className="toast">
      <CheckIcon size={17} />
      <span>{message}</span>
      <button className="icon-button" aria-label="dismiss notification" onClick={dismiss}>
        <XIcon size={16} />
      </button>
    </div>
  )
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
      <ArrowUpRightIcon size={14} />
    </a>
  )
}
