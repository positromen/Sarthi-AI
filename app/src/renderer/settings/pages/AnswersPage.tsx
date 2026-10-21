// Answers (design B8): when and how Sarthi writes suggestions, with a live preview that restyles as options change.
import type { LlmProvider, Settings } from '../../../shared/types'
import { AnswerContent } from '../../overlay/AnswerContent'
import { keysFor } from '../../shortcuts'
import { Keys, Segmented, Select, Toggle } from '../../ui/components'
import { Card, PageHeader, Row, SectionTitle } from '../layout'
import { answerPreview } from '../model'

const LABEL = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
  bullets: 'Bullets',
  paragraph: 'Paragraphs',
  professional: 'Professional',
  conversational: 'Conversational',
  confident: 'Confident'
} as const

export function AnswersPage({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const caption = [
    LABEL[settings.responseLength],
    LABEL[settings.responseFormat],
    LABEL[settings.responseTone],
    settings.useStarMethod && 'STAR',
    settings.useFillerWords && 'Fillers'
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <PageHeader title="Answers" subtitle="How and when Sarthi writes suggestions." />
      <Card>
        <Row
          label="Auto-answer"
          hint={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              Answer when a question is detected. Off: press <Keys keys={keysFor('answer')} />
            </span>
          }
        >
          <Toggle label="Auto-answer" checked={settings.autoAnswer} onChange={(autoAnswer) => update({ autoAnswer })} />
        </Row>
        <Row label="AI provider" hint="Gemini is the default. Groq starts answering in about a second. Claude needs a paid Anthropic key. If one fails, the next takes over.">
          <Select<LlmProvider>
            label="AI provider"
            className="w-52"
            value={settings.llmProvider}
            onChange={(llmProvider) => update({ llmProvider })}
            options={[
              { value: 'gemini', label: 'Gemini (default)' },
              { value: 'groq', label: 'Groq (fastest)' },
              { value: 'anthropic', label: 'Claude (paid key)' }
            ]}
          />
        </Row>
      </Card>

      <SectionTitle>Style</SectionTitle>
      <Card>
        <Row label="Length">
          <Segmented
            label="Length"
            value={settings.responseLength}
            onChange={(responseLength) => update({ responseLength })}
            options={(['short', 'medium', 'long'] as const).map((value) => ({ value, label: LABEL[value] }))}
          />
        </Row>
        <Row label="Format">
          <Segmented
            label="Format"
            value={settings.responseFormat}
            onChange={(responseFormat) => update({ responseFormat })}
            options={[
              { value: 'bullets', label: 'Bullet points' },
              { value: 'paragraph', label: 'Paragraphs' }
            ]}
          />
        </Row>
        <Row label="Tone">
          <Segmented
            label="Tone"
            value={settings.responseTone}
            onChange={(responseTone) => update({ responseTone })}
            options={(['professional', 'conversational', 'confident'] as const).map((value) => ({ value, label: LABEL[value] }))}
          />
        </Row>
        <Row label="STAR method" hint="Structure behavioural answers as Situation, Task, Action, Result.">
          <Toggle label="STAR method" checked={settings.useStarMethod} onChange={(useStarMethod) => update({ useStarMethod })} />
        </Row>
        <Row label="Natural fillers" hint="Light spoken fillers so answers sound human.">
          <Toggle label="Natural fillers" checked={settings.useFillerWords} onChange={(useFillerWords) => update({ useFillerWords })} />
        </Row>
      </Card>

      <SectionTitle>Live preview</SectionTitle>
      <Card className="p-4">
        <div className="mb-2.5 flex gap-[7px] text-xs leading-[1.45] text-fg-muted">
          <span className="shrink-0 font-bold text-leaf">Q</span>
          <span>Tell me about a time you disagreed with a teammate.</span>
        </div>
        <AnswerContent text={answerPreview(settings)} />
        <div className="mt-1 text-[11.5px] text-fg-3">{caption}</div>
      </Card>
    </>
  )
}
