// Shared UI primitives from the Sarthi design system. Styling uses the @theme tokens in styles.css.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes
} from 'react'
import { Icon, type IconName } from './icons'
import { stepIndex } from './keyNav'

const cx = (...classes: (string | false | null | undefined)[]): string => classes.filter(Boolean).join(' ')

// ── Buttons ─────────────────────────────────────────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'confirm'
/** 26 overlay inline · 28 overlay header · 32 default · 34 form rows. */
type ButtonSize = 26 | 28 | 32 | 34

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-leaf text-ink font-semibold hover:bg-leaf-hover focus-ring disabled:bg-raised disabled:text-fg-disabled',
  secondary:
    'bg-leaf/12 text-leaf font-semibold hover:bg-leaf/20 hover:text-leaf-soft focus-ring disabled:bg-raised disabled:text-fg-disabled',
  ghost:
    'border border-line-strong text-fg-soft font-medium hover:border-[#3d4d42] hover:bg-hover hover:text-fg focus-ring disabled:border-hover disabled:text-fg-disabled',
  danger: 'text-danger font-medium hover:bg-danger-solid/12 hover:text-danger-soft focus-ring-danger disabled:text-fg-disabled',
  confirm: 'bg-danger-solid text-ink font-semibold focus-ring-danger'
}
const BUSY: Partial<Record<ButtonVariant, string>> = {
  primary: 'bg-leaf-busy! text-ink!',
  secondary: 'bg-raised! text-fg-muted!'
}
const SIZE: Record<ButtonSize, string> = {
  26: 'h-[26px] px-2.5 text-xs rounded-sm gap-1.5',
  28: 'h-7 px-3 text-xs rounded-[7px] gap-1.5',
  32: 'h-8 px-3.5 text-[13px] rounded-md gap-1.5',
  34: 'h-[34px] px-3.5 text-[13px] rounded-md gap-1.5'
}

export function Button({
  variant = 'ghost',
  size = 32,
  icon,
  iconRight,
  busy,
  children,
  className,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
  /** Shows a spinner and blocks clicks (e.g. "Saving", "Reading…"). */
  busy?: boolean
}) {
  const iconSize = size <= 28 ? 12 : 14
  return (
    <button
      type="button"
      disabled={disabled || busy}
      className={cx(
        'inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors duration-120 ease-out disabled:cursor-default',
        SIZE[size],
        VARIANT[variant],
        busy && BUSY[variant],
        className
      )}
      {...rest}
    >
      {busy ? (
        <Icon name="spinner" size={iconSize} strokeWidth={2.25} className={cx('animate-spin', variant === 'secondary' && 'text-leaf')} />
      ) : (
        icon && <Icon name={icon} size={iconSize} strokeWidth={2} />
      )}
      {children}
      {iconRight && !busy && <Icon name={iconRight} size={iconSize} strokeWidth={2} />}
    </button>
  )
}

/** 28 px icon-only button; the tooltip is the native title, including the shortcut. */
export function IconButton({
  icon,
  label,
  active,
  size = 28,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean; size?: 26 | 28 }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx(
        'flex shrink-0 items-center justify-center rounded-[7px] transition-colors duration-120 focus-ring disabled:text-[#4a5a4f]',
        size === 28 ? 'size-7' : 'size-[26px]',
        active ? 'bg-hover text-fg' : 'text-fg-muted hover:bg-hover hover:text-fg',
        className
      )}
      {...rest}
    >
      <Icon name={icon} size={size === 28 ? 16 : 14} />
    </button>
  )
}

// ── Toggle, segmented, select ───────────────────────────────────────────────────────────────────────────────────────

export function Toggle({
  checked,
  onChange,
  disabled,
  label
}: {
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  /** Accessible name when the visible label lives elsewhere. */
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        'relative h-5 w-9 shrink-0 rounded-[10px] transition-colors duration-120 focus-ring',
        disabled ? 'bg-hover' : checked ? 'bg-leaf' : 'bg-line-strong'
      )}
    >
      <span
        className={cx(
          'absolute top-0.5 size-4 rounded-full transition-[left] duration-120',
          checked ? 'left-[18px] bg-ink' : 'left-0.5',
          disabled ? 'bg-[#4a5a4f]' : !checked && 'bg-fg-2'
        )}
      />
    </button>
  )
}

export interface Option<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

/** One tab stop for the whole control; arrow keys move the selection. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label
}: {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  label: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const current = options.findIndex((option) => option.value === value)
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border border-line bg-ink p-0.5">
      {options.map((option, i) => {
        const selected = i === current
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (current < 0 && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              const next = stepIndex(i, e.key, options.length)
              if (next === null) return
              e.preventDefault()
              onChange(options[next].value)
              refs.current[next]?.focus()
            }}
            className={cx(
              'flex h-7 items-center rounded-sm px-3 text-[12.5px] transition-colors duration-120 focus-ring [--ring-gap:var(--color-ink)]',
              selected ? 'bg-selected font-semibold text-fg shadow-[inset_0_0_0_1px_var(--color-line-strong)]' : 'text-fg-muted hover:bg-[#141b16] hover:text-fg-soft'
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Custom listbox (the native one can't be themed on Windows). Opens below its trigger. */
export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
  className
}: {
  value: T
  options: Option<T>[]
  onChange: (value: T) => void
  label: string
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const choose = (index: number) => {
    const option = options[index]
    if (!option || option.disabled) return
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div ref={root} className={cx('relative', className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          setOpen(!open)
          setActive(selectedIndex)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') return setOpen(false)
          if (open && e.key === 'Enter') {
            e.preventDefault()
            return choose(active)
          }
          const next = stepIndex(open ? active : selectedIndex, e.key, options.length)
          if (next === null) return
          e.preventDefault()
          if (!open) setOpen(true)
          setActive(next)
        }}
        className={cx(
          'flex h-[34px] w-full items-center gap-2 rounded-md border bg-ink pr-2.5 pl-3 text-left text-[13px] transition-colors duration-120',
          'outline-none focus-visible:border-leaf focus-visible:shadow-[0_0_0_3px_rgba(74,222,128,0.18)]',
          open ? 'border-leaf shadow-[0_0_0_3px_rgba(74,222,128,0.18)]' : 'border-line',
          disabled && 'border-hover bg-sidebar text-[#4a5a4f]'
        )}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ''}</span>
        <Icon name="chevronDown" size={14} strokeWidth={2} className="text-fg-2" />
      </button>
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[9px] border border-line-strong bg-raised p-1 shadow-menu"
        >
          {options.map((option, i) => (
            <li
              key={option.value}
              role="option"
              aria-selected={i === selectedIndex}
              aria-disabled={option.disabled}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                choose(i)
              }}
              className={cx(
                'flex h-8 cursor-default items-center gap-2 rounded-sm px-2.5 text-[13px]',
                option.disabled ? 'text-fg-disabled' : i === selectedIndex ? 'bg-selected text-fg' : 'text-fg-soft',
                i === active && !option.disabled && i !== selectedIndex && 'bg-hover'
              )}
            >
              <span className="flex-1 truncate">{option.label}</span>
              {i === selectedIndex && <Icon name="check" size={14} strokeWidth={2} className="text-leaf" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Text inputs ─────────────────────────────────────────────────────────────────────────────────────────────────────

const FIELD =
  'w-full rounded-md border bg-ink text-fg outline-none transition-[border-color,box-shadow] duration-120 placeholder:text-[#6b7a70] ' +
  'focus:border-leaf focus:shadow-[0_0_0_3px_rgba(74,222,128,0.18)] disabled:border-hover disabled:bg-sidebar disabled:text-[#4a5a4f]'

export function Input({ error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { error?: string | null }) {
  return (
    <div className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <input
        className={cx(FIELD, 'h-[34px] px-3 text-[13px]', error ? 'border-danger-solid/60' : 'border-line')}
        aria-invalid={Boolean(error)}
        {...rest}
      />
      {error && <span className="text-[11.5px] text-danger">{error}</span>}
    </div>
  )
}

export function Textarea({
  count,
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { /** Shows "n characters" under the field. */ count?: boolean }) {
  const length = typeof rest.value === 'string' ? rest.value.length : 0
  return (
    <div className="flex flex-col gap-1.5">
      <textarea className={cx(FIELD, 'resize-y border-line px-3 py-2 text-[12.5px] leading-relaxed', className)} {...rest} />
      {count && (
        <span className="text-right text-[11px] text-fg-3">
          {length.toLocaleString()} {length === 1 ? 'character' : 'characters'}
        </span>
      )}
    </div>
  )
}

// ── Status, badges, keycaps, meters ─────────────────────────────────────────────────────────────────────────────────

export type PillTone = 'idle' | 'connecting' | 'listening' | 'error'

const PILL: Record<PillTone, string> = {
  idle: 'bg-white/6 text-fg-2',
  connecting: 'bg-warn/12 text-warn',
  listening: 'bg-leaf/12 text-leaf',
  error: 'bg-danger-solid/14 text-danger'
}

export function Pill({ tone, children }: { tone: PillTone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex h-5 items-center gap-1.5 rounded-[10px] px-2 text-[11px] font-medium whitespace-nowrap', PILL[tone])}>
      <span className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  )
}

type BadgeTone = 'notes' | 'required' | 'optional' | 'soon' | 'warn'

const BADGE: Record<BadgeTone, string> = {
  notes: 'rounded-lg bg-leaf/12 px-1.5 py-px text-[10.5px] text-leaf',
  required: 'rounded-key border border-line-strong px-1.5 py-px text-[10.5px] text-fg-2',
  optional: 'rounded-key border border-line px-1.5 py-px text-[10.5px] text-fg-3',
  soon: 'rounded-[10px] bg-raised px-2 py-0.5 text-[11px] text-fg-2',
  warn: 'rounded-[10px] bg-warn/12 px-[7px] py-0.5 text-[11px] text-warn'
}

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 font-semibold whitespace-nowrap', BADGE[tone])}>{children}</span>
}

export function Keycap({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'warn' | 'danger' }) {
  return (
    <kbd
      className={cx(
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-key border border-b-2 px-[5px] font-sans text-[10.5px] font-semibold whitespace-nowrap',
        tone === 'warn' && 'border-warn/30 text-warn-soft',
        tone === 'danger' && 'border-danger-solid/55 bg-raised text-danger',
        tone === 'default' && 'border-line-strong bg-raised text-fg-2'
      )}
    >
      {children}
    </kbd>
  )
}

/** A shortcut as keycaps, e.g. ["Ctrl", "Shift", "L"]. */
export function Keys({ keys, tone }: { keys: readonly string[]; tone?: 'default' | 'warn' | 'danger' }) {
  return (
    <span className="inline-flex gap-[3px]">
      {keys.map((key, i) => (
        <Keycap key={`${key}-${i}`} tone={tone}>
          {key}
        </Keycap>
      ))}
    </span>
  )
}

// Speech RMS is small; ×4 makes normal talking fill most of the bar.
const meterPercent = (level: number): number => Math.min(100, Math.round(level * 400))

/** Thin live bar (overlay). */
export function LevelMeter({ level, tone }: { level: number; tone: 'you' | 'interviewer' }) {
  return (
    <div className="h-1 w-[72px] overflow-hidden rounded-xs bg-white/8">
      <div
        className={cx('h-full rounded-xs transition-[width] duration-75 ease-linear', tone === 'you' ? 'bg-you' : 'bg-leaf')}
        style={{ width: `${meterPercent(level)}%` }}
      />
    </div>
  )
}

/** 32-segment meter (onboarding audio check). */
export function SegmentMeter({ level, tone }: { level: number; tone: 'you' | 'interviewer' }) {
  const lit = Math.round((meterPercent(level) / 100) * 32)
  return (
    <div className="flex h-5 gap-[3px]" aria-hidden="true">
      {Array.from({ length: 32 }, (_, i) => (
        <span key={i} className={cx('w-1.5 rounded-xs', i < lit ? (tone === 'you' ? 'bg-you' : 'bg-leaf') : 'bg-selected')} />
      ))}
    </div>
  )
}

// ── Banners, toasts, empty state ────────────────────────────────────────────────────────────────────────────────────

/** Sits inside its container (never floats outside the overlay card). */
export function Banner({
  tone,
  icon,
  children,
  action,
  className
}: {
  tone: 'error' | 'warn'
  icon?: IconName
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex items-center gap-2 px-3 py-2 text-xs animate-fade-in',
        tone === 'error' ? 'border-danger-solid/24 bg-danger-solid/9 text-danger-soft' : 'border-warn/22 bg-warn/8 text-warn-soft',
        className
      )}
    >
      {icon && <Icon name={icon} size={14} className={tone === 'error' ? 'text-danger' : undefined} />}
      <span className="min-w-0 flex-1">{children}</span>
      {action}
    </div>
  )
}

interface ToastItem {
  id: number
  text: string
}
const ToastContext = createContext<(text: string) => void>(() => {})

/** Control Center only: bottom-right, 4 s. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)
  const show = useCallback((text: string) => {
    const id = nextId.current++
    setToasts((list) => [...list, { id, text }])
    setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), 4000)
  }, [])
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed right-5 bottom-5 z-50 flex flex-col items-end gap-2" aria-live="polite">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="flex animate-fade-in items-center gap-2 rounded-md border border-line-strong bg-raised px-3 py-2 text-xs text-fg shadow-toast"
          >
            <Icon name="check" size={14} strokeWidth={2.25} className="text-leaf" />
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = (): ((text: string) => void) => useContext(ToastContext)

export function EmptyState({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 px-5 py-7 text-center">
      <span className="flex size-11 items-center justify-center rounded-[11px] border border-line bg-sidebar">
        <Icon name={icon} size={20} className="text-fg-muted" />
      </span>
      <span className="text-sm font-semibold text-fg">{title}</span>
      {children && <span className="max-w-xs text-[12.5px] leading-normal text-fg-muted">{children}</span>}
      {action}
    </div>
  )
}
