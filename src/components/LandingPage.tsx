import { useEffect, useRef } from 'react'
import type { Theme } from '../lib/theme'

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
  const frame = useRef<HTMLIFrameElement>(null)
  const initialTheme = useRef(theme)

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return
      if (event.data?.type === 'obscura-demo') onOpenSample()
      if (event.data?.type === 'obscura-workspace') onOpenWorkspace()
      if (event.data?.type === 'obscura-theme' && event.data.theme !== theme) onToggleTheme()
    }
    window.addEventListener('message', receive)
    frame.current?.contentWindow?.postMessage({ type: 'obscura-theme', theme }, location.origin)
    return () => window.removeEventListener('message', receive)
  }, [theme, onToggleTheme, onOpenWorkspace, onOpenSample])

  return (
    <iframe
      ref={frame}
      title="obscura project showcase"
      className="landing-frame"
      src={`/obscura.html?theme=${initialTheme.current}`}
    />
  )
}
