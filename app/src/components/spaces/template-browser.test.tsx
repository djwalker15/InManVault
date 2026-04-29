import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { TemplateBrowser } from './template-browser'

const sampleTemplates = [
  {
    template_id: 't_kitchen',
    crew_id: null,
    name: 'Standard Kitchen',
    description: 'A common kitchen layout.',
    template_data: {
      name: 'Kitchen',
      unit_type: 'area',
      children: [
        { name: 'Pantry', unit_type: 'zone', children: [] },
      ],
    },
  },
  {
    template_id: 't_bar',
    crew_id: null,
    name: 'Bar Setup',
    description: 'A basic bar.',
    template_data: {
      name: 'Bar',
      unit_type: 'area',
      children: [],
    },
  },
]

describe('TemplateBrowser', () => {
  beforeEach(() => {
    mockClerk({ user: { id: 'user_1' } })
  })

  it('opens the dialog and lists seeded system templates', async () => {
    makeSupabaseMock({
      space_templates: { select: { data: sampleTemplates, error: null } },
    })
    render(
      <TemplateBrowser hasExistingSpaces={false} onApplied={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /use a template/i }))
    expect(
      screen.getByRole('dialog', { name: /use a template/i }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Standard Kitchen')).toBeInTheDocument()
    })
    expect(screen.getByText('Bar Setup')).toBeInTheDocument()
  })

  it('applies in merge mode without prompting when no existing spaces', async () => {
    const sb = makeSupabaseMock(
      {
        space_templates: { select: { data: sampleTemplates, error: null } },
      },
      {
        apply_space_template: { data: 5, error: null },
      },
    )
    const onApplied = vi.fn()
    render(
      <TemplateBrowser hasExistingSpaces={false} onApplied={onApplied} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /use a template/i }))
    await waitFor(() => {
      expect(screen.getByText('Standard Kitchen')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByRole('button', { name: /^apply$/i })[0])
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('apply_space_template', {
        p_template_id: 't_kitchen',
        p_mode: 'merge',
      })
    })
    expect(onApplied).toHaveBeenCalledWith(5)
  })

  it('shows the replace/merge prompt when existing spaces are present', async () => {
    makeSupabaseMock(
      {
        space_templates: { select: { data: sampleTemplates, error: null } },
      },
      { apply_space_template: { data: 7, error: null } },
    )
    render(
      <TemplateBrowser hasExistingSpaces={true} onApplied={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /use a template/i }))
    await waitFor(() => {
      expect(screen.getByText('Standard Kitchen')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByRole('button', { name: /^apply$/i })[0])
    expect(
      screen.getByRole('alertdialog', { name: /replace or merge/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^merge$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^replace$/i }),
    ).toBeInTheDocument()
  })

  it('Replace and Merge buttons each call rpc with the corresponding mode', async () => {
    const sb = makeSupabaseMock(
      {
        space_templates: { select: { data: sampleTemplates, error: null } },
      },
      { apply_space_template: { data: 7, error: null } },
    )
    render(
      <TemplateBrowser hasExistingSpaces={true} onApplied={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /use a template/i }))
    await waitFor(() => {
      expect(screen.getByText('Standard Kitchen')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByRole('button', { name: /^apply$/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /^replace$/i }))
    await waitFor(() => {
      expect(sb.rpc).toHaveBeenCalledWith('apply_space_template', {
        p_template_id: 't_kitchen',
        p_mode: 'replace',
      })
    })
  })

  it('expands a row to show the template tree preview', async () => {
    makeSupabaseMock({
      space_templates: { select: { data: sampleTemplates, error: null } },
    })
    render(
      <TemplateBrowser hasExistingSpaces={false} onApplied={() => {}} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /use a template/i }))
    await waitFor(() => {
      expect(screen.getByText('Standard Kitchen')).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByRole('button', { name: /show preview/i })[0])
    expect(screen.getByText('Kitchen')).toBeInTheDocument()
    expect(screen.getByText('Pantry')).toBeInTheDocument()
  })
})
