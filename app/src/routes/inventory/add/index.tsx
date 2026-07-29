import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  FileSpreadsheet,
  PackageOpen,
  Receipt,
  ScanLine,
  Search,
  Zap,
} from 'lucide-react'
import { Chip, DecisionCard } from '@/components/ds'
import { SignedInLayout } from '@/components/signed-in/signed-in-layout'

interface Method {
  to: string
  glyph: React.ReactNode
  title: string
  body: string
  /** Not yet built — render the tile disabled with a "Soon" badge. */
  comingSoon?: boolean
}

const METHODS: Method[] = [
  {
    to: '/inventory/add/quick',
    glyph: <Zap aria-hidden size={22} className="text-sage-700" />,
    title: 'Quick add',
    body: 'Log something fast — just a name and a count. Everything else can wait.',
  },
  {
    to: '/inventory/add/manual',
    glyph: <Search aria-hidden size={22} className="text-sage-700" />,
    title: 'Search & add',
    body: 'Find a product in the catalog, then capture quantity, location, cost, and more.',
  },
  {
    to: '/inventory/add/scan',
    glyph: <ScanLine aria-hidden size={22} className="text-sage-700" />,
    title: 'Scan a barcode',
    body: 'Point your camera at a UPC to pull the product straight from the catalog.',
  },
  {
    to: '/inventory/add/import',
    glyph: <FileSpreadsheet aria-hidden size={22} className="text-sage-700" />,
    title: 'Bulk import',
    body: 'Upload a spreadsheet to add many items at once with column mapping.',
  },
  {
    to: '/inventory/add/receipt',
    glyph: <Receipt aria-hidden size={22} className="text-sage-700" />,
    title: 'Scan a receipt',
    body: 'Photograph a receipt or invoice to add everything you bought, with prices.',
  },
  {
    to: '/inventory/add/package',
    glyph: <PackageOpen aria-hidden size={22} className="text-sage-700" />,
    title: 'Create a package',
    body: 'Define a multipack or variety pack and its contents, then open it into individual items.',
  },
]

export default function AddMethodPickerPage() {
  const navigate = useNavigate()

  return (
    <SignedInLayout>
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-5 pt-4 pb-12">
        <header className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back to inventory"
            onClick={() => navigate('/inventory')}
            className="flex size-10 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
          <h1 className="font-display text-[28px] font-bold leading-[34px] tracking-[-0.4px] text-ink-900">
            Add inventory
          </h1>
        </header>

        <p className="font-body text-sm text-ink-700">
          How do you want to add items?
        </p>

        <div role="radiogroup" aria-label="Add method" className="flex flex-col gap-3">
          {METHODS.map((m) => (
            <DecisionCard
              key={m.to}
              glyph={m.glyph}
              title={m.title}
              body={m.body}
              disabled={m.comingSoon}
              aria-disabled={m.comingSoon}
              badge={
                m.comingSoon ? <Chip variant="default">Soon</Chip> : undefined
              }
              className={m.comingSoon ? 'opacity-60' : undefined}
              onClick={() => {
                if (!m.comingSoon) navigate(m.to)
              }}
            />
          ))}
        </div>
      </div>
    </SignedInLayout>
  )
}
