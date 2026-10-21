// About (design B12): version, the local-first promise, and links to the key consoles.
import { useEffect, useState } from 'react'
import { Logo } from '../../ui/icons'
import { Card, ExternalLink } from '../layout'

const CONSOLES = [
  ['Deepgram', 'console.deepgram.com'],
  ['Gemini', 'aistudio.google.com'],
  ['Groq', 'console.groq.com'],
  ['Anthropic', 'console.anthropic.com']
] as const

export function AboutPage() {
  const [info, setInfo] = useState<{ version: string; platform: string } | null>(null)
  useEffect(() => {
    window.sarthi.getAppInfo().then(setInfo)
  }, [])
  return (
    <>
      <div className="mb-6 flex items-center gap-4">
        <Logo size={48} />
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-semibold">Sarthi AI</span>
          <span className="text-[13px] text-fg-3">
            {info ? `Version ${info.version} · ${info.platform === 'win32' ? 'Windows' : info.platform}` : ' '}
          </span>
        </div>
      </div>
      <p className="mb-6 text-[13.5px] leading-relaxed text-pretty text-fg-2">
        Sarthi means charioteer: the one who guides quietly from beside you. It is local-first: no account, no telemetry.
        Your keys, profile and history stay on this PC; only the audio and your questions go to the providers you chose.
      </p>
      <Card>
        <div className="border-b border-line px-4 py-2.5 text-[12px] font-semibold text-fg-2">Key consoles</div>
        {CONSOLES.map(([name, host]) => (
          <div key={name} className="flex h-11 items-center justify-between border-t border-line px-4 text-[13px] first:border-t-0">
            <span>{name}</span>
            <ExternalLink href={`https://${host}`}>{host}</ExternalLink>
          </div>
        ))}
      </Card>
    </>
  )
}
