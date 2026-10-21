// Hotkeys (design B11). Read-only for now; rebinding arrives with configurable hotkeys.
import { SHORTCUTS } from '../../shortcuts'
import { Keys } from '../../ui/components'
import { Card, PageHeader } from '../layout'

const HINT: Partial<Record<string, string>> = { answer: 'or “what’s on screen”' }

export function HotkeysPage() {
  return (
    <>
      <PageHeader title="Hotkeys" subtitle="Global shortcuts work from any app, even while the meeting window has focus." />
      <Card>
        <div className="flex h-9 items-center justify-between border-b border-line px-4 text-[11px] font-semibold tracking-[.05em] text-fg-3 uppercase">
          <span>Action</span>
          <span>Shortcut</span>
        </div>
        {SHORTCUTS.map((shortcut) => (
          <div key={shortcut.action} className="flex h-11 items-center justify-between border-t border-line px-4 first:border-t-0">
            <span className="flex items-baseline gap-2 text-[13px]">
              {shortcut.label}
              {HINT[shortcut.action] && <span className="text-xs text-fg-3">{HINT[shortcut.action]}</span>}
            </span>
            <Keys keys={shortcut.keys} />
          </div>
        ))}
      </Card>
      <p className="mt-3 text-[12px] text-fg-3">Changing these shortcuts is coming in a later update.</p>
    </>
  )
}
