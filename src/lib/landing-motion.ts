export function mountLandingMotion(root: HTMLElement) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')
  const finePointer = matchMedia('(pointer: fine)')
  const controller = new AbortController()
  const { signal } = controller
  let momentumFrame = 0
  let progressFrame = 0
  let target = scrollY
  let position = scrollY
  let lastTime = 0

  function stop() {
    cancelAnimationFrame(momentumFrame)
    momentumFrame = 0
    target = scrollY
    position = scrollY
  }

  function advance(time: number) {
    if (Math.abs(scrollY - position) > 3) return stop()
    const elapsed = Math.min(time - lastTime, 64)
    lastTime = time
    target = Math.max(0, Math.min(target, document.documentElement.scrollHeight - innerHeight))
    const next = scrollY + (target - scrollY) * (1 - Math.exp(-elapsed / 190))
    const settled = Math.abs(target - next) < 0.5
    scrollTo({ top: settled ? target : next, behavior: 'instant' })
    position = scrollY
    momentumFrame = settled ? 0 : requestAnimationFrame(advance)
  }

  window.addEventListener(
    'wheel',
    (event) => {
      if (
        reducedMotion.matches ||
        !finePointer.matches ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !event.cancelable ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      )
        return
      if (event.target instanceof Element) {
        if (event.target.closest('input, textarea, select, [contenteditable="true"]')) return
        for (
          let node: Element | null = event.target;
          node && node !== document.body;
          node = node.parentElement
        ) {
          if (
            /(auto|scroll)/.test(getComputedStyle(node).overflowY) &&
            node.scrollHeight > node.clientHeight
          )
            return
        }
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1
      const delta = event.deltaY * unit * 1.15
      if (!delta) return
      event.preventDefault()
      if (!momentumFrame || (target - scrollY) * delta < 0) target = scrollY
      target = Math.max(
        0,
        Math.min(target + delta, document.documentElement.scrollHeight - innerHeight),
      )
      if (!momentumFrame) {
        position = scrollY
        lastTime = performance.now()
        momentumFrame = requestAnimationFrame(advance)
      }
    },
    { passive: false, signal },
  )
  window.addEventListener('pointerdown', stop, { passive: true, signal })
  window.addEventListener('touchstart', stop, { passive: true, signal })
  window.addEventListener(
    'keydown',
    (event) => {
      if (
        [
          'ArrowUp',
          'ArrowDown',
          'PageUp',
          'PageDown',
          'Home',
          'End',
          ' ',
          'Escape',
          'Tab',
        ].includes(event.key)
      )
        stop()
    },
    { signal },
  )
  root.addEventListener(
    'click',
    (event) => {
      const anchor =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
          : null
      if (!anchor) return
      const section = root.querySelector<HTMLElement>(anchor.hash)
      if (!section) return
      event.preventDefault()
      stop()
      section.scrollIntoView({
        behavior: reducedMotion.matches ? 'instant' : 'smooth',
        block: 'start',
      })
    },
    { signal },
  )
  window.addEventListener('resize', stop, { signal })
  reducedMotion.addEventListener('change', stop, { signal })
  finePointer.addEventListener('change', stop, { signal })

  const progress = root.querySelector<HTMLElement>('.progress')
  function updateProgress() {
    const total = document.documentElement.scrollHeight - innerHeight
    if (progress) progress.style.transform = `scaleX(${total > 0 ? scrollY / total : 0})`
    progressFrame = 0
  }
  window.addEventListener(
    'scroll',
    () => {
      if (!progressFrame) progressFrame = requestAnimationFrame(updateProgress)
    },
    { passive: true, signal },
  )
  window.addEventListener('resize', updateProgress, { signal })
  updateProgress()

  const links = root.querySelectorAll<HTMLAnchorElement>('.stage-index a')
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting)
          for (const link of links)
            link.setAttribute('aria-current', String(link.hash === `#${entry.target.id}`))
      }
    },
    { rootMargin: '-20% 0px -35% 0px', threshold: 0 },
  )
  root.querySelectorAll('.cards > article').forEach((section) => observer.observe(section))
  return () => {
    controller.abort()
    observer.disconnect()
    stop()
    cancelAnimationFrame(progressFrame)
  }
}
