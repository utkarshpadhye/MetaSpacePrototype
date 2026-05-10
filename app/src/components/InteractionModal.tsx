import type { WorldObject } from '../canvas/world'
import { LoungeWhiteboard } from './LoungeWhiteboard'
import { FileConverter } from './FileConverter'
import { LibraryPortal } from './LibraryPortal'

type InteractionModalProps = {
  interaction: WorldObject | null
  isClosing: boolean
  onClose: () => void
}

type InteractionType = WorldObject['type']

export function InteractionModal({
  interaction,
  isClosing,
  onClose,
}: InteractionModalProps) {
  if (!interaction) {
    return null
  }

  const isLibrary = interaction.type === 'library'
  const isPixelThemed = isLibrary || interaction.type === 'reception'

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/60"
        aria-label="Close interaction"
        onClick={onClose}
      />
      <div
        className={`relative h-[85vh] w-[90vw] max-w-[900px] rounded-xl p-6 shadow-[0_25px_80px_rgba(0,0,0,0.35)] transition-all ${
          isPixelThemed
            ? 'pixel-panel pixel-ui border-[var(--pixel-border)] bg-[var(--pixel-panel)] text-[var(--pixel-ink)]'
            : 'border border-white/10 bg-[rgba(15,15,25,0.98)] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.7)]'
        } ${
          isClosing
            ? 'scale-95 opacity-0 duration-150 ease-in'
            : 'scale-100 opacity-100 duration-200 ease-out'
        }`}
      >
        <button
          type="button"
          className={`modal-close absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform duration-200 hover:rotate-90 ${
            isPixelThemed ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-white/10 text-white'
          }`}
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="flex h-full min-h-0 flex-col gap-3">
          <p className={`text-sm uppercase tracking-[0.25em] ${isPixelThemed ? 'text-slate-500' : 'text-slate-400'}`}>
            Interaction
          </p>
          <h2 className="text-2xl font-semibold">{getInteractionTitle(interaction.type)}</h2>
          <div
            className={`flex min-h-0 flex-1 rounded-lg p-4 ${
              isPixelThemed
                ? 'pixel-panel border-[var(--pixel-border)] bg-white/80'
                : 'border border-white/10 bg-black/30'
            } overflow-hidden`}
          >
            {renderInteractionBody(interaction.type)}
          </div>
        </div>
      </div>
    </div>
  )
}

function getInteractionTitle(type: InteractionType) {
  switch (type) {
    case 'whiteboard':
      return 'Whiteboard'
    case 'tv':
      return 'Presentation Screen'
    case 'door':
      return 'Door'
    case 'plant':
      return 'Plant'
    case 'desk':
      return 'Desk'
    case 'converter':
      return 'File Converter'
    case 'poster':
      return 'Poster'
    case 'note':
      return 'Note'
    case 'game':
      return 'Mini Game'
    case 'library':
      return 'Library'
    case 'reception':
      return 'Reception'
    case 'pm':
      return 'Projects'
    case 'crm':
      return 'CRM'
    default:
      return 'Interaction'
  }
}

function renderInteractionBody(type: InteractionType) {
  switch (type) {
    case 'whiteboard':
      return (
        <div className="h-full min-h-0">
          <LoungeWhiteboard />
        </div>
      )
    case 'tv':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
          <div className="h-40 w-64 rounded-lg border border-white/10 bg-slate-800" />
          <div className="text-sm">Embed or screen share content</div>
        </div>
      )
    case 'desk':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
          <div className="text-sm">Workspace notes and files</div>
          <div className="h-24 w-48 rounded-lg border border-white/10 bg-white/5" />
        </div>
      )
    case 'converter':
      return <FileConverter />
    case 'poster':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <div className="h-56 w-40 rounded-lg border border-white/10 bg-slate-800" />
          <div className="text-sm text-slate-300">Event poster details</div>
        </div>
      )
    case 'note':
      return (
        <div className="flex h-full flex-col gap-3 text-slate-300">
          <div className="text-sm">Sticky note</div>
          <div className="flex-1 rounded-lg border border-white/10 bg-yellow-200/10 p-4 text-sm text-slate-200">
            Remember to sync with the team at 3 PM.
          </div>
        </div>
      )
    case 'game':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
          <div className="h-40 w-64 rounded-lg border border-white/10 bg-slate-900" />
          <div className="text-sm">Mini-game coming soon</div>
        </div>
      )
    case 'library':
      return <LibraryPortal />
    case 'reception':
      return (
        <div className="grid h-full w-full grid-cols-1 gap-3 text-[10px] text-slate-700 md:grid-cols-3">
          <div className="pixel-panel flex flex-col justify-between p-4">
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Welcome</div>
              <div className="mt-2 text-sm text-slate-900">MetaSpace Front Desk</div>
              <p className="mt-3 leading-relaxed">Check visitors in, route teammates to rooms, and surface workspace notices from one place.</p>
            </div>
            <button type="button" className="pixel-button mt-4 px-3 py-2 text-[9px]">Guest Check-In</button>
          </div>
          <div className="pixel-panel p-4">
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Directory</div>
            <div className="mt-3 grid gap-2">
              <div className="flex justify-between border-b border-[var(--pixel-border)] pb-2"><span>Conference</span><span>North</span></div>
              <div className="flex justify-between border-b border-[var(--pixel-border)] pb-2"><span>Library</span><span>East</span></div>
              <div className="flex justify-between border-b border-[var(--pixel-border)] pb-2"><span>Cafeteria</span><span>North-East</span></div>
              <div className="flex justify-between"><span>Projects</span><span>Desk Area</span></div>
            </div>
          </div>
          <div className="pixel-panel p-4">
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Notices</div>
            <div className="mt-3 grid gap-2">
              <div className="bg-[#e9edf6] p-2">Daily standup at 10:00.</div>
              <div className="bg-[#e9edf6] p-2">Client demos use Conference Room.</div>
              <div className="bg-[#e9edf6] p-2">Docs and files live in Library.</div>
            </div>
          </div>
        </div>
      )
    case 'pm':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
          <div className="text-sm">Use the top bar Projects button for the full Projects Room.</div>
          <div className="h-32 w-64 rounded-lg border border-white/10 bg-violet-500/10" />
        </div>
      )
    case 'crm':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-300">
          <div className="text-sm">Use the top bar CRM button for the CRM Suite.</div>
          <div className="h-32 w-64 rounded-lg border border-white/10 bg-emerald-500/10" />
        </div>
      )
    case 'plant':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
          <div className="text-sm">A calming plant for ambiance.</div>
        </div>
      )
    case 'door':
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-300">
          <div className="text-sm">This door teleports you to another room.</div>
        </div>
      )
    default:
      return (
        <div className="flex h-full items-center justify-center text-sm text-slate-300">
          Interaction content coming soon.
        </div>
      )
  }
}
