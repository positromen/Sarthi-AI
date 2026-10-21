// Control Center frame: sidebar navigation + content pane (Sarthi UI design, B6–B16). The page lives in the URL
// hash so main can open a specific page (openSettings('setup')).
import { useEffect, useState, type ReactNode } from 'react'
import type { Settings } from '../../shared/types'
import { keysFor } from '../shortcuts'
import { Keys } from '../ui/components'
import { Icon, Logo, type IconName } from '../ui/icons'
import { pageFromHash, type Page } from './model'

const NAV: { group: string; items: { page: Page; label: string; icon: IconName }[] }[] = [
  {
    group: 'Prepare',
    items: [
      { page: 'setup', label: 'Setup', icon: 'key' },
      { page: 'profile', label: 'Profile', icon: 'profile' },
      { page: 'answers', label: 'Answers', icon: 'answers' },
      { page: 'language', label: 'Language', icon: 'language' }
    ]
  },
  {
    group: 'During a call',
    items: [
      { page: 'privacy', label: 'Privacy & overlay', icon: 'shield' },
      { page: 'hotkeys', label: 'Hotkeys', icon: 'hotkeys' }
    ]
  },
  {
    group: 'Review',
    items: [
      { page: 'history', label: 'History', icon: 'history' },
      { page: 'about', label: 'About', icon: 'about' }
    ]
  }
]

export function usePage(): [Page, (page: Page) => void] {
  const [page, setPage] = useState<Page>(() => pageFromHash(location.hash))
  useEffect(() => {
    const sync = () => setPage(pageFromHash(location.hash))
    window.addEventListener('hashchange', sync)
    const off = window.sarthi.onNavigate((next) => {
      location.hash = next
    })
    return () => {
      window.removeEventListener('hashchange', sync)
      off()
    }
  }, [])
  return [page, (next) => (location.hash = next)]
}

export function Shell({
  page,
  onNavigate,
  settings,
  historyCount,
  children
}: {
  page: Page
  onNavigate: (page: Page) => void
  settings: Settings
  historyCount: number
  children: ReactNode
}) {
  return (
    <div className="flex h-full">
      <nav className="flex w-[220px] shrink-0 flex-col border-r border-line bg-sidebar" aria-label="Control Center">
        <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
          <Logo size={22} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Sarthi AI</span>
            <span className="text-[11.5px] text-fg-3">Control Center</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          {NAV.map((group) => (
            <div key={group.group} className="mb-4">
              <div className="px-2.5 pb-1.5 text-[10.5px] font-semibold tracking-[.06em] text-fg-3 uppercase">{group.group}</div>
              {group.items.map((item) => {
                const active = item.page === page
                return (
                  <button
                    key={item.page}
                    type="button"
                    onClick={() => onNavigate(item.page)}
                    aria-current={active ? 'page' : undefined}
                    className={`flex h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] transition-colors duration-120 focus-ring [--ring-gap:var(--color-sidebar)] ${
                      active ? 'bg-[#172019] text-fg' : 'text-fg-2 hover:bg-hover hover:text-fg'
                    }`}
                  >
                    <Icon name={item.icon} size={16} className={active ? 'text-leaf' : 'text-fg-3'} />
                    <span className="flex-1">{item.label}</span>
                    {item.page === 'history' && historyCount > 0 && (
                      <span className="text-[11px] text-fg-3 tabular-nums">{historyCount}</span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2.5 border-t border-line px-4 py-3.5">
          <div className="flex items-center justify-between">
            {settings.privateMode ? (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-fg-3">
                <Icon name="private" size={13} className="text-leaf" />
                Private mode on
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-warn">
                <Icon name="visible" size={13} />
                Visible to screen share
              </span>
            )}
            <button
              type="button"
              onClick={() => window.sarthi.quitApp()}
              className="rounded-sm px-1.5 py-0.5 text-[11.5px] text-fg-3 transition-colors duration-120 hover:bg-hover hover:text-danger focus-ring [--ring-gap:var(--color-sidebar)]"
            >
              Quit
            </button>
          </div>
          <button
            type="button"
            onClick={() => window.sarthi.showOverlay()}
            className="flex h-8 items-center justify-between rounded-md border border-line-strong px-2.5 text-[12.5px] text-fg-soft transition-colors duration-120 hover:bg-hover hover:text-fg focus-ring [--ring-gap:var(--color-sidebar)]"
          >
            Show overlay
            <Keys keys={keysFor('toggle-overlay')} />
          </button>
        </div>
      </nav>
      <main className="min-w-0 flex-1 overflow-y-auto">
        {/* History is a two-pane view, so it gets the full width and tighter padding. */}
        <div className={page === 'history' ? 'px-6 pt-6 pb-6' : 'mx-auto max-w-[680px] px-9 pt-7 pb-12'}>{children}</div>
      </main>
    </div>
  )
}
