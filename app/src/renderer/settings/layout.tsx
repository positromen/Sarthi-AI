// Page building blocks for the Control Center: header, cards and setting rows.
import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl leading-[1.3] font-semibold">{title}</h1>
        {subtitle && <p className="text-[13px] leading-normal text-pretty text-fg-2">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-panel border border-line bg-panel ${className}`}>{children}</div>
}

/** A labelled setting: name and hint on the left, the control on the right. Stack inside a Card with dividers. */
export function Row({ label, hint, children, top }: { label: ReactNode; hint?: ReactNode; children?: ReactNode; top?: boolean }) {
  return (
    <div className={`flex justify-between gap-6 border-t border-line px-4 py-[13px] first:border-t-0 ${top ? 'items-start' : 'items-center'}`}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13.5px] font-medium">{label}</span>
        {hint && <span className="text-[12.5px] leading-normal text-pretty text-fg-muted">{hint}</span>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </div>
  )
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-7 mb-2.5 text-[13px] font-semibold text-fg-2 first:mt-0">{children}</h2>
}

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-leaf hover:text-leaf-soft focus-ring rounded-key">
      {children} ↗
    </a>
  )
}
