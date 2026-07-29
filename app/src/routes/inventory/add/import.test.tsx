import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithRouter } from '@/test/utils'
import { mockClerk } from '@/test/clerk-mock'
import { makeSupabaseMock } from '@/test/supabase-mock'
import BulkImportPage from './import'

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }))

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const baseTables = {
  crew_members: {
    select: {
      data: [
        {
          crew_id: 'crew_abc',
          role: 'admin',
          crews: { name: 'Test', owner_id: 'user_1' },
        },
      ],
      error: null,
    },
  },
  unit_definitions: {
    select: { data: [{ unit: 'count' }, { unit: 'oz' }], error: null },
  },
  products: { select: { data: [], error: null } },
  spaces: {
    select: {
      data: [
        { space_id: 'p', name: 'My House', parent_id: null },
        { space_id: 'pan', name: 'Pantry', parent_id: 'p' },
      ],
      error: null,
    },
  },
  categories: { select: { data: [], error: null } },
}

const CSV = 'Name,Qty,Unit,Location\nTomato Paste,3,count,Pantry\nSugar,10,count,Pantry\n'

function csvFile(content = CSV) {
  return new File([content], 'items.csv', { type: 'text/csv' })
}

describe('BulkImportPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    mockClerk({ user: { id: 'user_1' } })
  })

  it('walks upload → map → preview → import and reports the summary', async () => {
    const sb = makeSupabaseMock(baseTables, {
      bulk_import_inventory: { data: { imported: 2, errors: [] }, error: null },
    })
    renderWithRouter(<BulkImportPage />)

    // Upload
    const input = await screen.findByLabelText(/spreadsheet file/i)
    fireEvent.change(input, { target: { files: [csvFile()] } })

    // Map — auto-mapped, required fields satisfied
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /preview import/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))

    // Preview — both rows ready, none skipped
    await waitFor(() => {
      expect(screen.getByText(/2 ready to import/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /import 2 items/i }))

    // Result
    await waitFor(() => {
      expect(screen.getByText(/imported 2 items/i)).toBeInTheDocument()
    })
    expect(sb.rpc).toHaveBeenCalledWith(
      'bulk_import_inventory',
      expect.objectContaining({
        p_crew_id: 'crew_abc',
        p_rows: expect.arrayContaining([
          expect.objectContaining({
            product_name: 'Tomato Paste',
            quantity: 3,
            unit: 'count',
            current_space_id: 'pan',
          }),
        ]),
      }),
    )
  })

  it('marks rows with an unknown unit as skipped and explains why in the result', async () => {
    makeSupabaseMock(baseTables, {
      bulk_import_inventory: { data: { imported: 1, errors: [] }, error: null },
    })
    renderWithRouter(<BulkImportPage />)

    const badCsv =
      'Name,Qty,Unit,Location\nGood,1,count,Pantry\nBad,2,furlong,Pantry\n'
    const input = await screen.findByLabelText(/spreadsheet file/i)
    fireEvent.change(input, { target: { files: [csvFile(badCsv)] } })

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /preview import/i }),
      ).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /preview import/i }))

    await waitFor(() => {
      expect(screen.getByText(/1 ready to import/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/1 will be skipped/i)).toBeInTheDocument()

    // Import the good row; the result step names the skipped row's issue
    // instead of only counting it.
    fireEvent.click(screen.getByRole('button', { name: /import 1 item/i }))
    await waitFor(() => {
      expect(screen.getByText(/imported 1 item/i)).toBeInTheDocument()
    })
    expect(
      screen.getByText(/row 2: unit "furlong" is not recognized/i),
    ).toBeInTheDocument()
  })
})
