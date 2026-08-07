import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithRouter, userEvent } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import { FeedbackSheet } from './feedback-sheet'
import * as feedbackLib from '@/lib/feedback'

vi.mock('@/lib/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/feedback')>()
  return {
    ...actual,
    submitFeedback: vi.fn(),
    uploadFeedbackScreenshot: vi.fn(),
    gatherContext: vi.fn(() => ({
      route: '/inventory',
      user_agent: 'test-agent',
      viewport: { w: 390, h: 844 },
      app_version: 'test',
    })),
  }
})

const submitFeedback = vi.mocked(feedbackLib.submitFeedback)
const uploadFeedbackScreenshot = vi.mocked(feedbackLib.uploadFeedbackScreenshot)

function renderSheet(overrides: Partial<Parameters<typeof FeedbackSheet>[0]> = {}) {
  mockClerk({ user: { id: 'user_1' } })
  makeSupabaseMock()
  const onClose = vi.fn()
  const onSubmitted = vi.fn()
  renderWithRouter(
    <FeedbackSheet
      open
      onClose={onClose}
      onSubmitted={onSubmitted}
      crewId="crew_1"
      userId="user_1"
      {...overrides}
    />,
  )
  return { onClose, onSubmitted }
}

describe('FeedbackSheet', () => {
  beforeEach(() => {
    submitFeedback.mockResolvedValue({
      feedback_id: 'fb_1',
      clickup_task_url: 'https://app.clickup.com/t/abc',
      clickup_synced: true,
    })
    uploadFeedbackScreenshot.mockResolvedValue('user_1/shot.png')
  })

  it('keeps focus on the message field while typing', async () => {
    const user = userEvent.setup()
    renderSheet()
    const textarea = screen.getByLabelText(/message/i)
    await user.click(textarea)
    await user.type(textarea, 'losing focus would truncate this')
    // If the sheet re-grabbed focus on each keystroke, the value would be
    // truncated and the close button (not the textarea) would be active.
    expect(textarea).toHaveValue('losing focus would truncate this')
    expect(document.activeElement).toBe(textarea)
  })

  it('disables submit until a message is entered', () => {
    renderSheet()
    const submit = screen.getByRole('button', { name: /send feedback/i })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Something broke' },
    })
    expect(submit).toBeEnabled()
  })

  it('lets the user change the feedback type', () => {
    renderSheet()
    expect(screen.getByRole('button', { name: /^bug$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(screen.getByRole('button', { name: /^idea$/i }))
    expect(screen.getByRole('button', { name: /^idea$/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('submits the feedback and signals success', async () => {
    const { onSubmitted } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: /^idea$/i }))
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: '  Add dark mode  ' },
    })
    fireEvent.click(
      screen.getByLabelText(/ok to follow up with me/i),
    )
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
    expect(submitFeedback).toHaveBeenCalledWith(expect.anything(), {
      feedback_type: 'idea',
      message: 'Add dark mode',
      contact_ok: true,
      context: expect.objectContaining({ route: '/inventory' }),
      crew_id: 'crew_1',
      screenshot_paths: [],
      screenshot_path: null,
    })
  })

  it('uploads an attached screenshot before submitting', async () => {
    renderSheet()
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Visual glitch' },
    })
    const file = new File(['x'], 'bug.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/attach images/i), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() =>
      expect(uploadFeedbackScreenshot).toHaveBeenCalledWith(
        expect.anything(),
        'user_1',
        file,
      ),
    )
    expect(submitFeedback).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        screenshot_paths: ['user_1/shot.png'],
        screenshot_path: 'user_1/shot.png',
      }),
    )
  })

  it('uploads every attached screenshot and sends all their paths', async () => {
    uploadFeedbackScreenshot
      .mockResolvedValueOnce('user_1/a.jpg')
      .mockResolvedValueOnce('user_1/b.jpg')
    renderSheet()
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Two shots' },
    })
    const fileA = new File(['a'], 'a.png', { type: 'image/png' })
    const fileB = new File(['b'], 'b.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/attach images/i), {
      target: { files: [fileA, fileB] },
    })
    expect(screen.getByText('a.png')).toBeInTheDocument()
    expect(screen.getByText('b.png')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() => {
      expect(submitFeedback).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          screenshot_paths: ['user_1/a.jpg', 'user_1/b.jpg'],
          screenshot_path: 'user_1/a.jpg',
        }),
      )
    })
    expect(uploadFeedbackScreenshot).toHaveBeenCalledTimes(2)
  })

  it('removes an individual screenshot chip before submitting', async () => {
    renderSheet()
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'One survives' },
    })
    const fileA = new File(['a'], 'a.png', { type: 'image/png' })
    const fileB = new File(['b'], 'b.png', { type: 'image/png' })
    fireEvent.change(screen.getByLabelText(/attach images/i), {
      target: { files: [fileA, fileB] },
    })
    fireEvent.click(
      screen.getByRole('button', { name: /remove screenshot a\.png/i }),
    )
    expect(screen.queryByText('a.png')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() =>
      expect(uploadFeedbackScreenshot).toHaveBeenCalledTimes(1),
    )
    expect(uploadFeedbackScreenshot).toHaveBeenCalledWith(
      expect.anything(),
      'user_1',
      fileB,
    )
  })

  it('surfaces an error when submission fails', async () => {
    submitFeedback.mockRejectedValueOnce(new Error('network down'))
    const { onSubmitted } = renderSheet()
    fireEvent.change(screen.getByLabelText(/message/i), {
      target: { value: 'Broken thing' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send feedback/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/network down/i),
    )
    expect(onSubmitted).not.toHaveBeenCalled()
  })
})
