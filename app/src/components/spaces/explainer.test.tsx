import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SpacesExplainer } from './explainer'
import {
  SPACES_EXPLAINER_DISMISSED_KEY,
  readExplainerDismissed,
  writeExplainerDismissed,
} from './explainer-storage'

describe('SpacesExplainer', () => {
  it('renders the seven hierarchy levels', () => {
    render(<SpacesExplainer onDismiss={() => {}} />)
    const list = screen.getByRole('list', { name: /seven hierarchy levels/i })
    expect(list.querySelectorAll('li')).toHaveLength(7)
    expect(screen.getByText('Premises')).toBeInTheDocument()
    expect(screen.getByText('Area')).toBeInTheDocument()
    expect(screen.getByText('Shelf')).toBeInTheDocument()
  })

  it('includes the structural-vs-portable TipCard', () => {
    render(<SpacesExplainer onDismiss={() => {}} />)
    expect(
      screen.getByText(/sub-sections are fixed; containers are portable/i),
    ).toBeInTheDocument()
  })

  it('fires onDismiss when the CTA is clicked', () => {
    const onDismiss = vi.fn()
    render(<SpacesExplainer onDismiss={onDismiss} />)
    fireEvent.click(screen.getByRole('button', { name: /got it, let's build/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders a footer slot when provided', () => {
    render(
      <SpacesExplainer
        onDismiss={() => {}}
        footer={<span data-testid="footer-slot">extra</span>}
      />,
    )
    expect(screen.getByTestId('footer-slot')).toBeInTheDocument()
  })
})

describe('explainer sessionStorage helpers', () => {
  it('round-trips the dismissed flag', () => {
    sessionStorage.removeItem(SPACES_EXPLAINER_DISMISSED_KEY)
    expect(readExplainerDismissed()).toBe(false)
    writeExplainerDismissed(true)
    expect(readExplainerDismissed()).toBe(true)
    writeExplainerDismissed(false)
    expect(readExplainerDismissed()).toBe(false)
  })
})
