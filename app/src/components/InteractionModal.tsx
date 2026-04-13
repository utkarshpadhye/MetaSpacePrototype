import type { WorldObject } from '../canvas/world'
import { LoungeWhiteboard } from './LoungeWhiteboard'
import { FileConverter } from './FileConverter'

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

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/60"
        aria-label="Close interaction"
        onClick={onClose}
      />
      <div
        className={`relative h-[85vh] w-[90vw] max-w-[900px] rounded-xl border border-white/10 bg-[rgba(15,15,25,0.98)] p-6 text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.7)] transition-all ${
          isClosing
            ? 'scale-95 opacity-0 duration-150 ease-in'
            : 'scale-100 opacity-100 duration-200 ease-out'
        }`}
      >
        <button
          type="button"
          className="modal-close absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg text-white transition-transform duration-200 hover:rotate-90"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>
        <div className="flex h-full flex-col gap-3">
          <p className="text-sm uppercase tracking-[0.25em] text-slate-400">
            Interaction
          </p>
          <h2 className="text-2xl font-semibold">{getInteractionTitle(interaction.type)}</h2>
          <div className="flex-1 rounded-lg border border-white/10 bg-black/30 p-4">
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
