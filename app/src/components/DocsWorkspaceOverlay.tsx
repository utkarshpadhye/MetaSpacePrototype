import { useEffect, useMemo, useRef, useState } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { IndexeddbPersistence } from 'y-indexeddb'

type DocStatus = 'draft' | 'approved'

type DocItem = {
  id: string
  title: string
  parentId: string | null
  templateId: string | null
  isPrivate: boolean
  isRequirements: boolean
  status: DocStatus
  content: string
  contentText: string
  approvedBy: string | null
  approvedAt: string | null
  updatedAt: string
}

type TemplateItem = {
  id: string
  name: string
  description: string
  category: string
  isSystem: boolean
  defaultContent: string
}

type DocUser = { name: string; color: string }

type Props = {
  open: boolean
  onClose: () => void
  canAccessDocs: boolean
  currentUser: DocUser
  wsUrl?: string
}

const SYSTEM_TEMPLATES: TemplateItem[] = [
  {
    id: 'tpl-prd',
    name: 'PRD Template',
    description: 'Product requirements, goals, and scope.',
    category: 'requirements',
    isSystem: true,
    defaultContent: '<h2>Context</h2><p>...</p><h2>Goals</h2><p>...</p><h2>User Stories</h2><p>As a user...</p>',
  },
  {
    id: 'tpl-meeting',
    name: 'Meeting Notes',
    description: 'Agenda, notes, and action items.',
    category: 'knowledge',
    isSystem: true,
    defaultContent: '<h2>Agenda</h2><ul><li>Topic</li></ul><h2>Decisions</h2><p>...</p><h2>Action Items</h2><ul><li>Owner - Task</li></ul>',
  },
]

const INITIAL_DOCS: DocItem[] = [
  {
    id: 'doc-1',
    title: 'Launch Requirements',
    parentId: null,
    templateId: 'tpl-prd',
    isPrivate: false,
    isRequirements: true,
    status: 'approved',
    content: '<h2>Context</h2><p>We need to align on launch readiness.</p><h2>User Stories</h2><p>As a PM, I need clear scope.</p>',
    contentText: 'Context We need to align on launch readiness. User Stories As a PM, I need clear scope.',
    approvedBy: 'Ava Chan',
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'doc-2',
    title: 'Design Research Notes',
    parentId: null,
    templateId: 'tpl-meeting',
    isPrivate: false,
    isRequirements: false,
    status: 'draft',
    content: '<h2>Agenda</h2><ul><li>User interviews</li></ul><h2>Notes</h2><p>Key themes and insights.</p>',
    contentText: 'Agenda User interviews Notes Key themes and insights.',
    approvedBy: null,
    approvedAt: null,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'doc-3',
    title: 'Sprint 14 Retrospective',
    parentId: 'doc-2',
    templateId: null,
    isPrivate: true,
    isRequirements: false,
    status: 'draft',
    content: '<h2>What went well</h2><ul><li>Faster QA cycle</li></ul><h2>Risks</h2><p>Timeline risk in analytics.</p>',
    contentText: 'What went well Faster QA cycle Risks Timeline risk in analytics.',
    approvedBy: null,
    approvedAt: null,
    updatedAt: new Date().toISOString(),
  },
]

export function DocsWorkspaceOverlay({ open, onClose, canAccessDocs, currentUser, wsUrl }: Props) {
  const [tab, setTab] = useState<'docs' | 'templates' | 'approvals'>('docs')
  const [docs, setDocs] = useState<DocItem[]>(INITIAL_DOCS)
  const [templates, setTemplates] = useState<TemplateItem[]>(SYSTEM_TEMPLATES)
  const [activeDocId, setActiveDocId] = useState(INITIAL_DOCS[0]?.id ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [templateSearch, setTemplateSearch] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateCategory, setNewTemplateCategory] = useState('knowledge')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [newTemplateContent, setNewTemplateContent] = useState('')
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)
  const [perfResult, setPerfResult] = useState<string | null>(null)

  const ydocRef = useRef<Y.Doc | null>(null)
  const providerRef = useRef<WebsocketProvider | null>(null)
  const persistenceRef = useRef<IndexeddbPersistence | null>(null)

  const activeDoc = docs.find((doc) => doc.id === activeDocId) ?? null
  const effectiveWsUrl = wsUrl ?? 'wss://demos.yjs.dev'

  const filteredDocs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return docs
    }
    return docs.filter((doc) =>
      doc.title.toLowerCase().includes(query) || doc.contentText.toLowerCase().includes(query),
    )
  }, [docs, searchQuery])

  const templatesFiltered = useMemo(() => {
    const query = templateSearch.trim().toLowerCase()
    if (!query) {
      return templates
    }
    return templates.filter((template) =>
      `${template.name} ${template.category} ${template.description}`
        .toLowerCase()
        .includes(query),
    )
  }, [templateSearch, templates])

  const parentOptions = useMemo(() => {
    return docs.filter((doc) => doc.id !== activeDocId)
  }, [docs, activeDocId])

  useEffect(() => {
    if (!activeDoc) {
      return
    }

    if (providerRef.current) {
      providerRef.current.destroy()
      providerRef.current = null
    }
    if (persistenceRef.current) {
      persistenceRef.current.destroy()
      persistenceRef.current = null
    }
    if (ydocRef.current) {
      ydocRef.current.destroy()
      ydocRef.current = null
    }

    const ydoc = new Y.Doc()
    const room = `metaspace-doc-${activeDoc.id}`
    const provider = new WebsocketProvider(effectiveWsUrl, room, ydoc)
    provider.awareness.setLocalStateField('user', currentUser)
    const persistence = new IndexeddbPersistence(room, ydoc)

    ydocRef.current = ydoc
    providerRef.current = provider
    persistenceRef.current = persistence

    return () => {
      provider.destroy()
      persistence.destroy()
      ydoc.destroy()
    }
  }, [activeDoc?.id, currentUser, effectiveWsUrl])

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        ...(ydocRef.current ? [Collaboration.configure({ document: ydocRef.current })] : []),
        ...(providerRef.current
          ? [
              CollaborationCursor.configure({
                provider: providerRef.current,
                user: currentUser,
              }),
            ]
          : []),
      ],
      content: activeDoc?.content ?? '<p>Start typing...</p>',
      editorProps: {
        attributes: {
          class:
            'docs-editor prose prose-sm max-w-none focus:outline-none min-h-[280px]',
        },
      },
      onUpdate: ({ editor }) => {
        if (!activeDoc) {
          return
        }
        const nextHtml = editor.getHTML()
        const nextText = editor.getText()
        setDocs((prev) =>
          prev.map((doc) => {
            if (doc.id !== activeDoc.id) {
              return doc
            }
            const shouldReset = doc.status === 'approved' && nextText !== doc.contentText
            return {
              ...doc,
              content: nextHtml,
              contentText: nextText,
              status: shouldReset ? 'draft' : doc.status,
              approvedBy: shouldReset ? null : doc.approvedBy,
              approvedAt: shouldReset ? null : doc.approvedAt,
              updatedAt: new Date().toISOString(),
            }
          }),
        )
      },
    },
    [activeDoc?.id, currentUser, effectiveWsUrl],
  )

  useEffect(() => {
    if (!editor || !activeDoc) {
      return
    }
    if (editor.isEmpty) {
      editor.commands.setContent(activeDoc.content || '<p>Start typing...</p>')
    }
  }, [activeDoc?.id, editor])

  if (!open) {
    return null
  }

  if (!canAccessDocs) {
    return (
      <ModalFrame title="Docs Studio Locked" onClose={onClose}>
        <div className="text-sm text-slate-700">
          You do not have doc.view permission. Ask an Owner/Admin to grant access.
        </div>
      </ModalFrame>
    )
  }

  return (
    <ModalFrame title="Docs Studio" onClose={onClose} variant="docs">
      <div className="mb-4 flex flex-wrap gap-2 text-[10px]">
        {(['docs', 'templates', 'approvals'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`docs-tab px-3 py-1 ${tab === value ? 'docs-tab--active' : ''}`}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === 'docs' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)_240px]">
          <section className="docs-panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Docs</h3>
              <button type="button" className="docs-button" onClick={() => setShowTemplatePicker(true)}>
                New
              </button>
            </div>
            <input
              className="docs-input mb-3 w-full"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '55vh' }}>
              {renderDocTree(filteredDocs, {
                activeDocId,
                renamingId,
                onSelect: setActiveDocId,
                onRenameStart: setRenamingId,
                onRenameComplete: (id, nextTitle) => {
                  setDocs((prev) =>
                    prev.map((doc) => (doc.id === id ? { ...doc, title: nextTitle } : doc)),
                  )
                  setRenamingId(null)
                },
                onDuplicate: (id) => {
                  const source = docs.find((doc) => doc.id === id)
                  if (!source) return
                  const copy: DocItem = {
                    ...source,
                    id: `doc-${Date.now()}`,
                    title: `${source.title} Copy`,
                    status: 'draft',
                    approvedAt: null,
                    approvedBy: null,
                    updatedAt: new Date().toISOString(),
                  }
                  setDocs((prev) => [...prev, copy])
                  setActiveDocId(copy.id)
                },
                onDelete: (id) => {
                  const toRemove = new Set<string>()
                  collectDescendants(docs, id, toRemove)
                  toRemove.add(id)
                  setDocs((prev) => prev.filter((doc) => !toRemove.has(doc.id)))
                  if (activeDocId === id) {
                    const next = docs.find((doc) => doc.id !== id)
                    setActiveDocId(next?.id ?? '')
                  }
                },
              })}
            </div>
          </section>

          <section className="docs-panel">
            {activeDoc ? (
              <div className="flex h-full flex-col gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`docs-status ${activeDoc.status === 'approved' ? 'docs-status--approved' : ''}`}>
                      {activeDoc.status}
                    </span>
                    {activeDoc.isRequirements ? (
                      <span className="docs-chip">Requirements</span>
                    ) : null}
                    {activeDoc.isPrivate ? <span className="docs-chip">Private</span> : null}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">{activeDoc.title}</h2>
                    <button
                      type="button"
                      className="docs-button docs-button--ghost"
                      onClick={() =>
                        setDocs((prev) =>
                          prev.map((doc) =>
                            doc.id === activeDoc.id
                              ? {
                                  ...doc,
                                  status: doc.status === 'approved' ? 'draft' : 'approved',
                                  approvedBy:
                                    doc.status === 'approved' ? null : currentUser.name,
                                  approvedAt:
                                    doc.status === 'approved' ? null : new Date().toISOString(),
                                }
                              : doc,
                          ),
                        )
                      }
                    >
                      {activeDoc.status === 'approved' ? 'Reopen Draft' : 'Approve'}
                    </button>
                  </div>
                </div>

                {activeDoc.status === 'approved' ? (
                  <div className="docs-banner">
                    <div>
                      Approved by {activeDoc.approvedBy ?? 'Unknown'} on{' '}
                      {activeDoc.approvedAt ? new Date(activeDoc.approvedAt).toLocaleString() : 'N/A'}
                    </div>
                    <div className="text-[10px] text-slate-600">
                      Editing will reset approval status.
                    </div>
                  </div>
                ) : null}

                <div className="docs-editor-shell">
                  {editor ? <EditorContent editor={editor} /> : null}
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-600">Select a doc to begin.</div>
            )}
          </section>

          <aside className="docs-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Doc settings
            </div>
            {activeDoc ? (
              <div className="space-y-3 text-[11px] text-slate-700">
                <label className="flex items-center justify-between">
                  Private
                  <input
                    type="checkbox"
                    checked={activeDoc.isPrivate}
                    onChange={(event) =>
                      setDocs((prev) =>
                        prev.map((doc) =>
                          doc.id === activeDoc.id ? { ...doc, isPrivate: event.target.checked } : doc,
                        ),
                      )
                    }
                  />
                </label>
                <label className="flex items-center justify-between">
                  Requirements doc
                  <input
                    type="checkbox"
                    checked={activeDoc.isRequirements}
                    onChange={(event) =>
                      setDocs((prev) =>
                        prev.map((doc) =>
                          doc.id === activeDoc.id
                            ? { ...doc, isRequirements: event.target.checked }
                            : doc,
                        ),
                      )
                    }
                  />
                </label>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-slate-500">Move to</div>
                  <select
                    className="docs-input w-full"
                    value={activeDoc.parentId ?? ''}
                    onChange={(event) => {
                      const nextParent = event.target.value || null
                      setDocs((prev) =>
                        prev.map((doc) =>
                          doc.id === activeDoc.id ? { ...doc, parentId: nextParent } : doc,
                        ),
                      )
                      setSelectedParentId(nextParent)
                    }}
                  >
                    <option value="">(Root)</option>
                    {parentOptions.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="text-[10px] text-slate-500">
                  Last updated {new Date(activeDoc.updatedAt).toLocaleString()}
                </div>
                <button
                  type="button"
                  className="docs-button"
                  onClick={() => {
                    const start = performance.now()
                    const baseline = 5
                    for (let i = 0; i < baseline; i += 1) {
                      editor?.commands.insertContent(' Performance sync ') 
                    }
                    const elapsed = performance.now() - start
                    setPerfResult(`${elapsed.toFixed(1)}ms for ${baseline} collab inserts`)
                  }}
                >
                  Run collab baseline
                </button>
                {perfResult ? <div className="text-[10px] text-slate-600">{perfResult}</div> : null}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {tab === 'templates' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="docs-panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Templates</h3>
              <input
                className="docs-input max-w-[220px]"
                placeholder="Search templates..."
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              {templatesFiltered.map((template) => (
                <div key={template.id} className="rounded-lg border border-slate-200 bg-white/90 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">{template.name}</div>
                      <div className="text-[11px] text-slate-500">{template.category}</div>
                    </div>
                    {template.isSystem ? (
                      <span className="docs-chip">System</span>
                    ) : (
                      <button
                        type="button"
                        className="docs-button docs-button--ghost"
                        onClick={() =>
                          setTemplates((prev) => prev.filter((item) => item.id !== template.id))
                        }
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-slate-600">{template.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="docs-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Create template
            </div>
            <div className="space-y-3">
              <input
                className="docs-input w-full"
                placeholder="Template name"
                value={newTemplateName}
                onChange={(event) => setNewTemplateName(event.target.value)}
              />
              <input
                className="docs-input w-full"
                placeholder="Category"
                value={newTemplateCategory}
                onChange={(event) => setNewTemplateCategory(event.target.value)}
              />
              <input
                className="docs-input w-full"
                placeholder="Description"
                value={newTemplateDescription}
                onChange={(event) => setNewTemplateDescription(event.target.value)}
              />
              <textarea
                className="docs-input h-32 w-full"
                placeholder="Default HTML content"
                value={newTemplateContent}
                onChange={(event) => setNewTemplateContent(event.target.value)}
              />
              <button
                type="button"
                className="docs-button"
                onClick={() => {
                  if (!newTemplateName.trim()) {
                    return
                  }
                  const next: TemplateItem = {
                    id: `tpl-${Date.now()}`,
                    name: newTemplateName.trim(),
                    description: newTemplateDescription.trim() || 'Custom template',
                    category: newTemplateCategory.trim() || 'general',
                    isSystem: false,
                    defaultContent: newTemplateContent || '<p>Template content...</p>',
                  }
                  setTemplates((prev) => [...prev, next])
                  setNewTemplateName('')
                  setNewTemplateDescription('')
                  setNewTemplateCategory('knowledge')
                  setNewTemplateContent('')
                }}
              >
                Save template
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'approvals' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr]">
          <section className="docs-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Awaiting approvals
            </div>
            <div className="space-y-2">
              {docs.filter((doc) => doc.status === 'draft' && doc.isRequirements).length === 0 ? (
                <div className="text-[11px] text-slate-500">No draft requirements pending approval.</div>
              ) : (
                docs
                  .filter((doc) => doc.status === 'draft' && doc.isRequirements)
                  .map((doc) => (
                    <div key={doc.id} className="rounded-lg border border-slate-200 bg-white/90 p-3">
                      <div className="text-sm font-semibold text-slate-800">{doc.title}</div>
                      <div className="text-[11px] text-slate-500">Updated {new Date(doc.updatedAt).toLocaleString()}</div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className="docs-button docs-button--ghost"
                          onClick={() => setActiveDocId(doc.id)}
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          className="docs-button"
                          onClick={() =>
                            setDocs((prev) =>
                              prev.map((item) =>
                                item.id === doc.id
                                  ? { ...item, status: 'approved', approvedBy: currentUser.name, approvedAt: new Date().toISOString() }
                                  : item,
                              ),
                            )
                          }
                        >
                          Approve
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </section>
          <section className="docs-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Approved archive
            </div>
            <div className="space-y-2">
              {docs.filter((doc) => doc.status === 'approved').map((doc) => (
                <div key={doc.id} className="rounded-lg border border-slate-200 bg-white/90 p-3">
                  <div className="text-sm font-semibold text-slate-800">{doc.title}</div>
                  <div className="text-[11px] text-slate-500">
                    Approved by {doc.approvedBy ?? 'Unknown'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {showTemplatePicker ? (
        <div className="docs-modal">
          <div className="docs-panel max-w-[600px]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Create new doc</h3>
              <button type="button" className="docs-button docs-button--ghost" onClick={() => setShowTemplatePicker(false)}>
                Close
              </button>
            </div>
            <input
              className="docs-input mb-3 w-full"
              placeholder="Search templates..."
              value={templateSearch}
              onChange={(event) => setTemplateSearch(event.target.value)}
            />
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {templatesFiltered.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="docs-card text-left"
                  onClick={() => {
                    const newDoc: DocItem = {
                      id: `doc-${Date.now()}`,
                      title: `${template.name} Draft`,
                      parentId: selectedParentId,
                      templateId: template.id,
                      isPrivate: false,
                      isRequirements: template.category === 'requirements',
                      status: 'draft',
                      content: template.defaultContent,
                      contentText: template.defaultContent.replace(/<[^>]+>/g, ' '),
                      approvedBy: null,
                      approvedAt: null,
                      updatedAt: new Date().toISOString(),
                    }
                    setDocs((prev) => [...prev, newDoc])
                    setActiveDocId(newDoc.id)
                    setShowTemplatePicker(false)
                  }}
                >
                  <div className="text-sm font-semibold text-slate-800">{template.name}</div>
                  <div className="text-[11px] text-slate-500">{template.category}</div>
                  <p className="mt-1 text-[11px] text-slate-600">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </ModalFrame>
  )
}

type TreeHandlers = {
  activeDocId: string
  renamingId: string | null
  onSelect: (id: string) => void
  onRenameStart: (id: string) => void
  onRenameComplete: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  onDelete: (id: string) => void
}

function renderDocTree(docs: DocItem[], handlers: TreeHandlers) {
  const map = new Map<string | null, DocItem[]>()
  docs.forEach((doc) => {
    const list = map.get(doc.parentId) ?? []
    list.push(doc)
    map.set(doc.parentId, list)
  })

  const renderNode = (doc: DocItem, depth: number) => {
    const isActive = handlers.activeDocId === doc.id
    const isRenaming = handlers.renamingId === doc.id
    return (
      <div key={doc.id} className="space-y-1">
        <div
          className={`docs-row ${isActive ? 'docs-row--active' : ''}`}
          style={{ paddingLeft: `${depth * 12}px` }}
        >
          {isRenaming ? (
            <input
              className="docs-input w-full"
              defaultValue={doc.title}
              onBlur={(event) => handlers.onRenameComplete(doc.id, event.target.value.trim() || doc.title)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  handlers.onRenameComplete(doc.id, (event.currentTarget.value || doc.title).trim())
                }
              }}
              autoFocus
            />
          ) : (
            <button type="button" className="flex-1 text-left" onClick={() => handlers.onSelect(doc.id)}>
              <div className="text-[11px] font-semibold text-slate-800">{doc.title}</div>
              <div className="text-[10px] text-slate-500">{doc.status}</div>
            </button>
          )}
          <div className="flex gap-1">
            <button type="button" className="docs-icon" onClick={() => handlers.onRenameStart(doc.id)}>
              ✎
            </button>
            <button type="button" className="docs-icon" onClick={() => handlers.onDuplicate(doc.id)}>
              ⧉
            </button>
            <button type="button" className="docs-icon" onClick={() => handlers.onDelete(doc.id)}>
              ✕
            </button>
          </div>
        </div>
        {(map.get(doc.id) ?? []).map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  return (map.get(null) ?? []).map((doc) => renderNode(doc, 0))
}

function collectDescendants(docs: DocItem[], rootId: string, accumulator: Set<string>) {
  docs.forEach((doc) => {
    if (doc.parentId === rootId) {
      accumulator.add(doc.id)
      collectDescendants(docs, doc.id, accumulator)
    }
  })
}

type ModalFrameProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
  variant?: 'docs'
}

function ModalFrame({ title, onClose, children, variant }: ModalFrameProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-6">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close overlay"
        onClick={onClose}
      />
      <div
        className={`relative w-[min(1200px,94vw)] max-h-[90vh] overflow-hidden rounded-2xl p-6 shadow-[0_30px_120px_rgba(0,0,0,0.35)] ${
          variant === 'docs' ? 'docs-shell' : 'bg-white'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Workspace</div>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          </div>
          <button type="button" className="docs-button docs-button--ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto pr-2">{children}</div>
      </div>
    </div>
  )
}
