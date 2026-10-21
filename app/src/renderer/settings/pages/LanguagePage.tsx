// Language (design B9): what the call is in and what the answers are written in, independently.
import { LISTENING_LANGUAGES, OUTPUT_LANGUAGES } from '../../../shared/languages'
import type { Settings } from '../../../shared/types'
import { Select } from '../../ui/components'
import { Card, PageHeader, Row } from '../layout'
import { languageSample } from '../model'

export function LanguagePage({ settings, update }: { settings: Settings; update: (patch: Partial<Settings>) => void }) {
  const deva = /[ऀ-ॿ]/.test(languageSample(settings.outputLanguage))
  return (
    <>
      <PageHeader title="Language" subtitle="The call and the answers can be in different languages." />
      <Card>
        <Row label="Listening language" hint="What the call is in. Applies the next time you press Listen.">
          <Select
            label="Listening language"
            className="w-64"
            value={settings.listeningLanguage}
            onChange={(listeningLanguage) => update({ listeningLanguage })}
            options={[...LISTENING_LANGUAGES]}
          />
        </Row>
        <Row label="Answer language" hint="Independent of the call.">
          <Select
            label="Answer language"
            className="w-64"
            value={settings.outputLanguage}
            onChange={(outputLanguage) => update({ outputLanguage })}
            options={[...OUTPUT_LANGUAGES]}
          />
        </Row>
      </Card>
      <Card className="mt-4 flex flex-col gap-2 p-4">
        <span className="text-xs text-fg-3">Answers will read like this</span>
        <p className={`text-fg-answer ${deva ? 'text-[15.5px] leading-[1.7]' : 'text-[15px] leading-[1.55]'}`}>
          {languageSample(settings.outputLanguage)}
        </p>
      </Card>
      <p className="mt-3 text-[12px] text-fg-3">Multilingual handles calls that switch between English and Hindi mid-sentence.</p>
    </>
  )
}
