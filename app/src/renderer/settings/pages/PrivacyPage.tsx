// Privacy & overlay (design B10): private mode, overlay opacity with a live preview, silence skipping, screenshots.
import type { Settings, VadSensitivity } from '../../../shared/types'
import { keysFor } from '../../shortcuts'
import { Keys, Segmented, Toggle } from '../../ui/components'
import { Icon } from '../../ui/icons'
import { Card, PageHeader, Row, SectionTitle } from '../layout'

function MiniCard({ opacity, light }: { opacity: number; light: boolean }) {
  return (
    <div className={`relative h-[92px] flex-1 overflow-hidden rounded-md border border-line ${light ? 'bg-[#e9eae6]' : 'bg-[#1e1f22]'}`}>
      {/* What sits behind the overlay: a document or an editor. */}
      <div className="absolute inset-3 flex flex-col gap-1.5">
        {[70, 92, 55, 80, 64].map((w, i) => (
          <span key={i} className={`h-1.5 rounded-xs ${light ? 'bg-[#c9cbc6]' : 'bg-[#3a3d42]'}`} style={{ width: `${w}%` }} />
        ))}
      </div>
      <div
        className="absolute top-3 right-3 left-10 rounded-md border border-line bg-panel px-2.5 py-2 shadow-card"
        style={{ opacity }}
      >
        <div className="mb-1 text-[9px] text-fg-muted">Q · Hardest scaling problem?</div>
        <div className="text-[10.5px] leading-snug text-fg-answer">
          <b className="font-semibold text-white">Result:</b> runtime dropped to 40 minutes.
        </div>
      </div>
    </div>
  )
}

export function PrivacyPage({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const opacity = Math.round(settings.overlayOpacity * 100)
  return (
    <>
      <PageHeader title="Privacy & overlay" subtitle="Control what others can see during a call." />

      <Card className={settings.privateMode ? '' : 'border-warn/30'}>
        <Row
          label="Private mode"
          hint="Hide the overlay and this window from screen share and recordings."
        >
          <div className="flex items-center gap-3">
            <Keys keys={keysFor('toggle-private')} />
            <Toggle label="Private mode" checked={settings.privateMode} onChange={(privateMode) => update({ privateMode })} />
          </div>
        </Row>
        <div
          className={`flex items-center gap-1.5 border-t border-line px-4 py-2.5 text-[12px] ${
            settings.privateMode ? 'text-leaf' : 'bg-warn/8 text-warn-soft'
          }`}
        >
          <Icon name={settings.privateMode ? 'private' : 'warning'} size={14} />
          {settings.privateMode
            ? 'On · both windows are hidden from capture'
            : 'Off · the overlay and this window are visible to screen share'}
        </div>
      </Card>
      <p className="mt-2 text-[12px] leading-normal text-fg-3">
        Private mode uses Windows' own capture exclusion, so screen shares and recordings leave these windows out entirely
        (Windows 10 version 2004 or later; older versions show a black box instead). Clicking the overlay never takes
        focus from your meeting; only the ask box does, while you type.
      </p>

      <SectionTitle>Overlay</SectionTitle>
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-[13.5px] font-medium">Overlay opacity</span>
          <span className="text-[13px] font-semibold tabular-nums">{opacity}%</span>
        </div>
        <input
          type="range"
          min={50}
          max={100}
          step={1}
          value={opacity}
          aria-label="Overlay opacity"
          onChange={(e) => update({ overlayOpacity: Number(e.target.value) / 100 })}
          className="w-full accent-[var(--color-leaf)] focus-ring"
        />
        <div className="flex justify-between text-[11.5px] text-fg-3">
          <span>50%</span>
          {opacity < 70 && <span className="text-warn">Below 70% the answer may be hard to read</span>}
          <span>100%</span>
        </div>
        <div className="flex gap-3">
          <MiniCard opacity={settings.overlayOpacity} light />
          <MiniCard opacity={settings.overlayOpacity} light={false} />
        </div>
      </Card>

      <SectionTitle>Audio & screenshots</SectionTitle>
      <Card>
        <Row
          label="Skip silence"
          hint="Send audio to Deepgram only around speech, which saves Deepgram minutes but can make answers feel a little later. Off by default. Applies the next time you press Listen."
          top
        >
          <Toggle label="Skip silence" checked={settings.vadEnabled} onChange={(vadEnabled) => update({ vadEnabled })} />
        </Row>
        {settings.vadEnabled && (
          <Row label="Voice detection sensitivity" hint="How loud speech must be before it's sent.">
            <Segmented<VadSensitivity>
              label="Voice detection sensitivity"
              value={settings.vadSensitivity}
              onChange={(vadSensitivity) => update({ vadSensitivity })}
              options={[
                { value: 'high', label: 'High' },
                { value: 'normal', label: 'Normal' },
                { value: 'low', label: 'Low' }
              ]}
            />
          </Row>
        )}
        <Row label="Screenshots" hint="Allow screenshots (button and hotkey) and send them with answers.">
          <Toggle
            label="Screenshots"
            checked={settings.screenshotsEnabled}
            onChange={(screenshotsEnabled) => update({ screenshotsEnabled })}
          />
        </Row>
      </Card>
    </>
  )
}
