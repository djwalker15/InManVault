import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LabeledInput } from './labeled-input'

describe('LabeledInput', () => {
  it('calls onChange with the new input value (not the event)', async () => {
    const onChange = vi.fn()
    render(<LabeledInput label="EMAIL" value="" onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await userEvent.type(input, 'a')
    expect(onChange).toHaveBeenCalledWith('a')
  })

  it('renders helperText below the input', () => {
    render(
      <LabeledInput
        label="PASSWORD"
        value=""
        onChange={() => {}}
        helperText="Must be at least 8 characters."
      />,
    )
    expect(
      screen.getByText('Must be at least 8 characters.'),
    ).toBeInTheDocument()
  })

  it('renders the trailing slot (e.g. show/hide button)', () => {
    render(
      <LabeledInput
        label="PASSWORD"
        value=""
        onChange={() => {}}
        trailing={<button type="button">toggle</button>}
      />,
    )
    expect(screen.getByText('toggle')).toBeInTheDocument()
  })

  it('renders the icon when provided', () => {
    render(
      <LabeledInput
        label="EMAIL"
        value=""
        onChange={() => {}}
        icon={<span data-testid="icon">i</span>}
      />,
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})
