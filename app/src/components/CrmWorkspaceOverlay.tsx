import { useMemo, useState } from 'react'

type PipelineStage = {
  id: string
  name: string
  probability: number
  isClosed: boolean
}

type Company = {
  id: string
  name: string
  industry: string
  website: string
  owner: string
}

type Contact = {
  id: string
  name: string
  email: string
  title: string
  companyId: string
  lastInteractionAt: string | null
  stale: boolean
}

type Deal = {
  id: string
  title: string
  value: number
  companyId: string
  contactId: string
  stageId: string
  status: 'open' | 'closed_won' | 'closed_lost'
  linkedProject: string | null
}

type Interaction = {
  id: string
  type: string
  summary: string
  createdAt: string
}

type Props = {
  open: boolean
  onClose: () => void
  canAccessCrm: boolean
}

const INITIAL_STAGES: PipelineStage[] = [
  { id: 'stage-lead', name: 'Lead', probability: 10, isClosed: false },
  { id: 'stage-qualified', name: 'Qualified', probability: 30, isClosed: false },
  { id: 'stage-proposal', name: 'Proposal', probability: 60, isClosed: false },
  { id: 'stage-negotiation', name: 'Negotiation', probability: 80, isClosed: false },
  { id: 'stage-won', name: 'Closed Won', probability: 100, isClosed: true },
  { id: 'stage-lost', name: 'Closed Lost', probability: 0, isClosed: true },
]

const INITIAL_COMPANIES: Company[] = [
  { id: 'co-1', name: 'Apex Dynamics', industry: 'Fintech', website: 'apex.io', owner: 'Maya' },
  { id: 'co-2', name: 'Nimbus Health', industry: 'Health', website: 'nimbus.health', owner: 'Jordan' },
]

const INITIAL_CONTACTS: Contact[] = [
  {
    id: 'ct-1',
    name: 'Sierra Lane',
    email: 'sierra@nimbus.health',
    title: 'Head of Ops',
    companyId: 'co-2',
    lastInteractionAt: null,
    stale: false,
  },
  {
    id: 'ct-2',
    name: 'Leo Park',
    email: 'leo@apex.io',
    title: 'Product Lead',
    companyId: 'co-1',
    lastInteractionAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
    stale: true,
  },
]

const INITIAL_DEALS: Deal[] = [
  {
    id: 'dl-1',
    title: 'Apex Renewal',
    value: 120000,
    companyId: 'co-1',
    contactId: 'ct-2',
    stageId: 'stage-negotiation',
    status: 'open',
    linkedProject: null,
  },
  {
    id: 'dl-2',
    title: 'Nimbus Expansion',
    value: 80000,
    companyId: 'co-2',
    contactId: 'ct-1',
    stageId: 'stage-proposal',
    status: 'open',
    linkedProject: null,
  },
]

export function CrmWorkspaceOverlay({ open, onClose, canAccessCrm }: Props) {
  const [tab, setTab] = useState<'directory' | 'pipeline' | 'reports' | 'automation'>('directory')
  const [stages] = useState<PipelineStage[]>(INITIAL_STAGES)
  const [companies] = useState<Company[]>(INITIAL_COMPANIES)
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS)
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS)
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [companySearch, setCompanySearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [perfResult, setPerfResult] = useState<string | null>(null)

  const filteredCompanies = useMemo(() => {
    const query = companySearch.trim().toLowerCase()
    if (!query) {
      return companies
    }
    return companies.filter((company) => company.name.toLowerCase().includes(query))
  }, [companies, companySearch])

  const filteredContacts = useMemo(() => {
    const query = contactSearch.trim().toLowerCase()
    if (!query) {
      return contacts
    }
    return contacts.filter((contact) =>
      `${contact.name} ${contact.email} ${contact.title}`.toLowerCase().includes(query),
    )
  }, [contacts, contactSearch])

  const pipelineColumns = useMemo(() => {
    const grouped = new Map<string, Deal[]>()
    deals.forEach((deal) => {
      const list = grouped.get(deal.stageId) ?? []
      list.push(deal)
      grouped.set(deal.stageId, list)
    })
    return stages.map((stage) => ({
      stage,
      deals: grouped.get(stage.id) ?? [],
    }))
  }, [deals, stages])

  const reportMetrics = useMemo(() => {
    const totalOpen = deals.filter((deal) => deal.status === 'open')
    const closedWon = deals.filter((deal) => deal.status === 'closed_won')
    const closedLost = deals.filter((deal) => deal.status === 'closed_lost')
    const totalValue = totalOpen.reduce((sum, deal) => sum + deal.value, 0)
    const weighted = totalOpen.reduce((sum, deal) => {
      const stage = stages.find((item) => item.id === deal.stageId)
      return sum + deal.value * ((stage?.probability ?? 0) / 100)
    }, 0)

    const winRate = closedWon.length + closedLost.length === 0
      ? 0
      : (closedWon.length / (closedWon.length + closedLost.length)) * 100

    return {
      totalOpenValue: totalValue,
      weightedOpenValue: weighted,
      winRate: Math.round(winRate * 10) / 10,
      openDeals: totalOpen.length,
      wonDeals: closedWon.length,
      lostDeals: closedLost.length,
    }
  }, [deals, stages])

  if (!open) {
    return null
  }

  if (!canAccessCrm) {
    return (
      <ModalFrame title="CRM Room Locked" onClose={onClose}>
        <div className="text-sm text-slate-700">
          You do not have room.crm_access permission. Ask an Owner/Admin to grant access.
        </div>
      </ModalFrame>
    )
  }

  return (
    <ModalFrame title="CRM Suite" onClose={onClose} variant="crm">
      <div className="mb-4 flex flex-wrap gap-2 text-[10px]">
        {(['directory', 'pipeline', 'reports', 'automation'] as const).map((value) => (
          <button
            key={value}
            type="button"
            className={`crm-tab ${tab === value ? 'crm-tab--active' : ''}`}
            onClick={() => setTab(value)}
          >
            {value}
          </button>
        ))}
      </div>

      {tab === 'directory' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <section className="crm-panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Companies</h3>
              <input
                className="crm-input max-w-[220px]"
                placeholder="Search companies..."
                value={companySearch}
                onChange={(event) => setCompanySearch(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              {filteredCompanies.map((company) => (
                <div key={company.id} className="crm-card">
                  <div className="text-sm font-semibold text-slate-900">{company.name}</div>
                  <div className="text-[11px] text-slate-500">{company.industry}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                    <span>{company.website}</span>
                    <span>Owner: {company.owner}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="crm-panel">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Contacts</h3>
              <input
                className="crm-input max-w-[220px]"
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              {filteredContacts.map((contact) => (
                <div key={contact.id} className={`crm-card ${contact.stale ? 'crm-card--stale' : ''}`}>
                  <div className="text-sm font-semibold text-slate-900">{contact.name}</div>
                  <div className="text-[11px] text-slate-500">{contact.title}</div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                    <span>{contact.email}</span>
                    <span>{contact.stale ? 'Stale' : 'Active'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'pipeline' ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {pipelineColumns.map(({ stage, deals: stageDeals }) => (
            <div
              key={stage.id}
              className="crm-panel"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const dealId = event.dataTransfer.getData('text/plain')
                setDeals((prev) =>
                  prev.map((deal) =>
                    deal.id === dealId
                      ? {
                          ...deal,
                          stageId: stage.id,
                          status: stage.isClosed
                            ? stage.name.includes('Won')
                              ? 'closed_won'
                              : 'closed_lost'
                            : 'open',
                        }
                      : deal,
                  ),
                )
              }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{stage.name}</div>
                  <div className="text-[11px] text-slate-500">{stage.probability}%</div>
                </div>
                <span className="crm-chip">{stageDeals.length}</span>
              </div>
              <div className="space-y-2">
                {stageDeals.map((deal) => {
                  const company = companies.find((item) => item.id === deal.companyId)
                  return (
                    <div
                      key={deal.id}
                      className="crm-card cursor-move"
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/plain', deal.id)}
                    >
                      <div className="text-sm font-semibold text-slate-900">{deal.title}</div>
                      <div className="text-[11px] text-slate-500">{company?.name ?? 'Unknown'}</div>
                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-600">
                        <span>${deal.value.toLocaleString()}</span>
                        <button
                          type="button"
                          className="crm-button crm-button--ghost"
                          onClick={() =>
                            setDeals((prev) =>
                              prev.map((item) =>
                                item.id === deal.id
                                  ? { ...item, status: 'closed_won', linkedProject: 'Project auto-created' }
                                  : item,
                              ),
                            )
                          }
                        >
                          Convert
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {tab === 'reports' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <section className="crm-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Pipeline summary</div>
            <div className="space-y-2">
              {stages.map((stage) => {
                const stageDeals = deals.filter((deal) => deal.stageId === stage.id)
                const totalValue = stageDeals.reduce((sum, deal) => sum + deal.value, 0)
                return (
                  <div key={stage.id} className="crm-card">
                    <div className="flex items-center justify-between text-[11px] text-slate-600">
                      <span>{stage.name}</span>
                      <span>{stageDeals.length} deals</span>
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">${totalValue.toLocaleString()}</div>
                  </div>
                )
              })}
            </div>
          </section>
          <section className="crm-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Forecast</div>
            <div className="space-y-3">
              <div className="crm-card">
                <div className="text-[11px] text-slate-500">Weighted pipeline value</div>
                <div className="text-2xl font-semibold text-slate-900">
                  ${reportMetrics.weightedOpenValue.toLocaleString()}
                </div>
              </div>
              <div className="crm-card">
                <div className="text-[11px] text-slate-500">Win rate</div>
                <div className="text-2xl font-semibold text-slate-900">{reportMetrics.winRate}%</div>
              </div>
              <button
                type="button"
                className="crm-button"
                onClick={() => {
                  const start = performance.now()
                  const heavy = Array.from({ length: 2000 }).reduce<number>((sum, _, index) => sum + index, 0)
                  const elapsed = performance.now() - start
                  setPerfResult(`${elapsed.toFixed(1)}ms to compute report snapshot (${heavy})`)
                }}
              >
                Run report baseline
              </button>
              {perfResult ? <div className="text-[10px] text-slate-600">{perfResult}</div> : null}
            </div>
          </section>
        </div>
      ) : null}

      {tab === 'automation' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
          <section className="crm-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Stale contacts</div>
            <div className="space-y-2">
              {contacts.filter((contact) => contact.stale).map((contact) => (
                <div key={contact.id} className="crm-card crm-card--stale">
                  <div className="text-sm font-semibold text-slate-900">{contact.name}</div>
                  <div className="text-[11px] text-slate-500">Last interaction {contact.lastInteractionAt ? new Date(contact.lastInteractionAt).toLocaleDateString() : 'N/A'}</div>
                </div>
              ))}
              <button
                type="button"
                className="crm-button"
                onClick={() =>
                  setContacts((prev) =>
                    prev.map((contact) => ({
                      ...contact,
                      stale: contact.lastInteractionAt
                        ? Date.now() - new Date(contact.lastInteractionAt).getTime() > 30 * 24 * 60 * 60 * 1000
                        : false,
                    })),
                  )
                }
              >
                Run stale check
              </button>
            </div>
          </section>
          <section className="crm-panel">
            <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">Guest session prompt</div>
            <div className="space-y-2">
              <div className="crm-card">
                <div className="text-sm font-semibold text-slate-900">Guest session auto-log</div>
                <div className="text-[11px] text-slate-500">Prompts the team to capture CRM notes after guest sessions.</div>
              </div>
              <button
                type="button"
                className="crm-button"
                onClick={() =>
                  setInteractions((prev) => [
                    {
                      id: `int-${Date.now()}`,
                      type: 'guest_session_prompt',
                      summary: 'Guest session ended. Please capture notes.',
                      createdAt: new Date().toISOString(),
                    },
                    ...prev,
                  ])
                }
              >
                Log guest session prompt
              </button>
              {interactions.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {interactions.map((interaction) => (
                    <div key={interaction.id} className="crm-card">
                      <div className="text-[11px] text-slate-500">{interaction.type}</div>
                      <div className="text-sm font-semibold text-slate-900">{interaction.summary}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </ModalFrame>
  )
}

type ModalFrameProps = {
  title: string
  onClose: () => void
  children: React.ReactNode
  variant?: 'crm'
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
          variant === 'crm' ? 'crm-shell' : 'bg-white'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.4em] text-slate-500">Pipeline</div>
            <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
          </div>
          <button type="button" className="crm-button crm-button--ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto pr-2">{children}</div>
      </div>
    </div>
  )
}
