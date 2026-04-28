import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

interface RouterRenderOptions {
  route?: string
}

export function renderWithRouter(
  ui: ReactElement,
  { route = '/' }: RouterRenderOptions = {},
) {
  return render(<MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>)
}

export function renderWithRoutes(routes: ReactElement, route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>{routes}</MemoryRouter>,
  )
}

export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
