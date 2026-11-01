export type Theme = 'dark' | 'light'

export function savedTheme(): Theme {
  try {
    return (localStorage.getItem('obscura.theme') ?? localStorage.getItem('dope.theme')) === 'light'
      ? 'light'
      : 'dark'
  } catch {
    return 'dark'
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'light' ? '#f2f2f5' : '#090909')
  try {
    localStorage.setItem('obscura.theme', theme)
  } catch {}
}
