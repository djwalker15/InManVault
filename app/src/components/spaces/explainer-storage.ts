export const SPACES_EXPLAINER_DISMISSED_KEY = 'inman:spaces-explainer-dismissed'

export function readExplainerDismissed(): boolean {
  if (typeof window === 'undefined') return false
  return window.sessionStorage.getItem(SPACES_EXPLAINER_DISMISSED_KEY) === '1'
}

export function writeExplainerDismissed(dismissed: boolean): void {
  if (typeof window === 'undefined') return
  if (dismissed) {
    window.sessionStorage.setItem(SPACES_EXPLAINER_DISMISSED_KEY, '1')
  } else {
    window.sessionStorage.removeItem(SPACES_EXPLAINER_DISMISSED_KEY)
  }
}
