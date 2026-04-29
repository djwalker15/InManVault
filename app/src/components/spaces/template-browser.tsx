import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Layers, X } from 'lucide-react'
import { PrimaryButton, SecondaryButton, TextButton } from '@/components/ds'
import { useSupabase } from '@/lib/supabase'
import { Tree } from './tree'
import { UNIT_TYPE_LABEL, type SpaceNode, type UnitType } from './types'

interface TemplateRow {
  template_id: string
  crew_id: string | null
  name: string
  description: string | null
  template_data: TemplateNode
}

interface TemplateNode {
  name: string
  unit_type: UnitType
  children?: TemplateNode[]
}

interface TemplateBrowserProps {
  /** True when the active crew has any spaces beyond a Premises — drives
   *  the merge/replace prompt. */
  hasExistingSpaces: boolean
  /** Called after a successful apply so the parent can refetch the tree. */
  onApplied: (insertedCount: number) => void | Promise<void>
}

export function TemplateBrowser({
  hasExistingSpaces,
  onApplied,
}: TemplateBrowserProps) {
  const supabase = useSupabase()
  const [open, setOpen] = useState(false)
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<TemplateRow | null>(null)
  const [applying, setApplying] = useState(false)
  const [applyError, setApplyError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function loadTemplates() {
      setLoadError(null)
      const { data, error } = await supabase
        .from('space_templates')
        .select('template_id, crew_id, name, description, template_data')
        .is('deleted_at', null)
        .order('name', { ascending: true })
      if (cancelled) return
      if (error) {
        setLoadError(error.message ?? 'Failed to load templates.')
        return
      }
      setTemplates(Array.isArray(data) ? (data as TemplateRow[]) : [])
    }
    void loadTemplates()
    return () => {
      cancelled = true
    }
  }, [open, supabase])

  function close() {
    setOpen(false)
    setExpandedId(null)
    setPendingTemplate(null)
    setApplyError(null)
  }

  async function applyTemplate(
    template: TemplateRow,
    mode: 'merge' | 'replace',
  ) {
    setApplyError(null)
    setApplying(true)
    try {
      const { data, error } = await supabase.rpc('apply_space_template', {
        p_template_id: template.template_id,
        p_mode: mode,
      })
      if (error) throw error
      const inserted = typeof data === 'number' ? data : 0
      await onApplied(inserted)
      close()
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Failed to apply.')
    } finally {
      setApplying(false)
    }
  }

  function handleApply(template: TemplateRow) {
    if (hasExistingSpaces) {
      setPendingTemplate(template)
      return
    }
    void applyTemplate(template, 'merge')
  }

  return (
    <>
      <SecondaryButton
        type="button"
        onClick={() => setOpen(true)}
        className="!w-auto px-4"
      >
        <Layers size={16} aria-hidden />
        <span>Use a template</span>
      </SecondaryButton>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Use a template"
          className="fixed inset-0 z-30 flex items-end justify-center bg-ink-900/30 backdrop-blur-sm md:items-center"
          onClick={close}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-2xl bg-paper-50 md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-paper-300 px-5 py-4">
              <h2 className="font-display text-lg font-bold text-ink-900">
                Use a template
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="flex size-8 items-center justify-center rounded-full text-ink-700 transition hover:bg-paper-200"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {loadError ? (
                <p className="font-body text-sm text-error">{loadError}</p>
              ) : templates === null ? (
                <p className="font-body text-sm text-ink-600">Loading…</p>
              ) : templates.length === 0 ? (
                <p className="font-body text-sm text-ink-600">
                  No templates available.
                </p>
              ) : (
                <ol
                  aria-label="Available templates"
                  className="flex flex-col gap-3"
                >
                  {templates.map((template) => (
                    <TemplateRow
                      key={template.template_id}
                      template={template}
                      expanded={expandedId === template.template_id}
                      onToggle={() =>
                        setExpandedId((cur) =>
                          cur === template.template_id
                            ? null
                            : template.template_id,
                        )
                      }
                      onApply={() => handleApply(template)}
                      busy={applying}
                    />
                  ))}
                </ol>
              )}
            </div>

            {pendingTemplate && (
              <ReplaceMergePrompt
                template={pendingTemplate}
                applying={applying}
                error={applyError}
                onMerge={() => applyTemplate(pendingTemplate, 'merge')}
                onReplace={() => applyTemplate(pendingTemplate, 'replace')}
                onCancel={() => setPendingTemplate(null)}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

interface TemplateRowProps {
  template: TemplateRow
  expanded: boolean
  onToggle: () => void
  onApply: () => void
  busy: boolean
}

function TemplateRow({
  template,
  expanded,
  onToggle,
  onApply,
  busy,
}: TemplateRowProps) {
  const previewNodes = useMemo(
    () => templateToNodes(template.template_data),
    [template.template_data],
  )

  return (
    <li className="flex flex-col gap-2 rounded-xl bg-paper-100 p-4">
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={expanded ? 'Hide preview' : 'Show preview'}
          onClick={onToggle}
          className="flex size-7 items-center justify-center rounded-md text-ink-600 transition hover:bg-paper-250"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h3 className="font-display text-base font-bold text-ink-900">
            {template.name}{' '}
            <span className="font-body text-xs text-ink-500">
              ·{' '}
              {template.crew_id === null
                ? 'System'
                : 'Custom'}
              {' · '}
              starts at {UNIT_TYPE_LABEL[template.template_data.unit_type]}
            </span>
          </h3>
          {template.description && (
            <p className="mt-1 font-body text-sm leading-5 text-ink-700">
              {template.description}
            </p>
          )}
        </div>
        <PrimaryButton
          type="button"
          height="sm"
          className="!w-auto px-4"
          onClick={onApply}
          disabled={busy}
        >
          Apply
        </PrimaryButton>
      </div>
      {expanded && (
        <div className="rounded-lg bg-paper-50 p-3">
          <Tree nodes={previewNodes} />
        </div>
      )}
    </li>
  )
}

interface ReplaceMergePromptProps {
  template: TemplateRow
  applying: boolean
  error: string | null
  onMerge: () => void
  onReplace: () => void
  onCancel: () => void
}

function ReplaceMergePrompt({
  template,
  applying,
  error,
  onMerge,
  onReplace,
  onCancel,
}: ReplaceMergePromptProps) {
  return (
    <div
      role="alertdialog"
      aria-label="Replace or merge"
      className="border-t border-paper-300 bg-paper-100 px-5 py-4"
    >
      <h3 className="font-display text-base font-bold text-ink-900">
        Replace your current setup or merge?
      </h3>
      <p className="mt-1 font-body text-sm leading-5 text-ink-700">
        Applying <strong>{template.name}</strong>. <strong>Replace</strong>{' '}
        soft-deletes everything except your Premises. <strong>Merge</strong>{' '}
        adds the new branches alongside what you have, renaming any name
        conflicts.
      </p>
      {error && (
        <p className="mt-2 font-body text-sm text-error">{error}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton
          type="button"
          height="sm"
          className="!w-auto px-4"
          onClick={onMerge}
          disabled={applying}
        >
          {applying ? 'Applying…' : 'Merge'}
        </PrimaryButton>
        <button
          type="button"
          onClick={onReplace}
          disabled={applying}
          className="inline-flex h-12 items-center justify-center rounded-xl bg-error px-4 font-display text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {applying ? 'Applying…' : 'Replace'}
        </button>
        <TextButton type="button" onClick={onCancel} className="!text-ink-700">
          Cancel
        </TextButton>
      </div>
    </div>
  )
}

/** Convert a nested TemplateNode tree into a flat SpaceNode[] for preview. */
function templateToNodes(root: TemplateNode): SpaceNode[] {
  const out: SpaceNode[] = []
  let counter = 0
  function walk(node: TemplateNode, parent_id: string | null) {
    const id = `t_${++counter}`
    out.push({
      space_id: id,
      parent_id,
      unit_type: node.unit_type,
      name: node.name,
    })
    for (const child of node.children ?? []) {
      walk(child, id)
    }
  }
  // Templates stamp under the user's existing premises, so the preview's root
  // is fictitious — render the template root as if its parent were null.
  walk(root, null)
  return out
}
