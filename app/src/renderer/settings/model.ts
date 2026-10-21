// Pure logic behind the Control Center pages, kept out of the components so it can be unit-tested.
import type { Settings } from '../../shared/types'

export const PAGES = ['setup', 'profile', 'answers', 'language', 'privacy', 'hotkeys', 'history', 'about'] as const
export type Page = (typeof PAGES)[number]

export function pageFromHash(hash: string): Page {
  const name = hash.replace(/^#/, '')
  return (PAGES as readonly string[]).includes(name) ? (name as Page) : 'setup'
}

// ── Profile strength ────────────────────────────────────────────────────────────────────────────────────────────────

export type StrengthLevel = 'Empty' | 'Weak' | 'Fair' | 'Good' | 'Strong'

// Rough thresholds: a usable résumé is a page or more; a JD and notes add the role and talking points.
const RESUME_SOLID = 800
const JD_SOLID = 200
const NOTES_SOLID = 100

export function profileStrength(profile: { resume: string; jobDescription: string; notes: string }): {
  level: StrengthLevel
  score: number
  hint: string
} {
  const resume = profile.resume.trim().length
  const jd = profile.jobDescription.trim().length
  const notes = profile.notes.trim().length
  if (resume === 0) return { level: 'Empty', score: 0, hint: 'Add your résumé so answers use your real experience' }
  if (resume < RESUME_SOLID) return { level: 'Weak', score: 1, hint: 'Add more detail to your résumé: roles, projects, results' }
  if (jd < JD_SOLID) return { level: 'Fair', score: 2, hint: 'Add the job description to reach Good' }
  if (notes < NOTES_SOLID) return { level: 'Good', score: 3, hint: 'Add talking points in Notes to reach Strong' }
  return { level: 'Strong', score: 4, hint: 'Answers have everything they need' }
}

// ── Answer preview ──────────────────────────────────────────────────────────────────────────────────────────────────

// One sample story, restyled by the answer settings. No API call: it only shows what the options change.
const STORY = {
  star: [
    '**Situation:** my lead wanted to ship a cache change before a sale; I thought it risked stale balances.',
    '**Action:** I wrote a one-page comparison and proposed a feature flag.',
    '**Result:** we shipped behind the flag with no customer impact.',
    'Since then, risky releases on the team go out behind a flag by default.',
    'It taught me to disagree with data, not opinions.'
  ],
  plain: [
    'My lead wanted to ship a cache change before a sale, and I thought it risked stale balances.',
    'I wrote a one-page comparison and proposed shipping it behind a feature flag.',
    'We shipped behind the flag with no customer impact.',
    'Since then, risky releases on the team go out behind a flag by default.',
    'It taught me to disagree with data, not opinions.'
  ]
}
const LENGTH_LINES: Record<Settings['responseLength'], number> = { short: 2, medium: 3, long: 5 }
const TONE_OPENER: Record<Settings['responseTone'], string> = {
  professional: '',
  conversational: 'So, ',
  confident: 'Clearly, '
}

export function answerPreview(settings: Settings): string {
  const lines = (settings.useStarMethod ? STORY.star : STORY.plain).slice(0, LENGTH_LINES[settings.responseLength])
  const styled = lines.map((line, i) => {
    let text = line
    if (i === 0 && TONE_OPENER[settings.responseTone] && !text.startsWith('**')) {
      text = TONE_OPENER[settings.responseTone] + text.charAt(0).toLowerCase() + text.slice(1)
    }
    if (i === 0 && settings.useFillerWords) text = text.startsWith('**') ? text.replace(':** ', ':** Honestly, ') : `Honestly, ${text}`
    if (i === 1 && settings.useFillerWords) text = `${text.replace(/\.$/, '')}, you know.`
    return text
  })
  return settings.responseFormat === 'bullets' ? styled.map((line) => `- ${line}`).join('\n') : styled.join(' ')
}

// ── Language samples ───────────────────────────────────────────────────────────────────────────────────────────────

const SAMPLES: Record<string, string> = {
  en: 'Your company handles payments at a scale that matches what I have been building for the last two years.',
  hinglish: 'Honestly, aapki company jis scale pe payments handle karti hai, woh mere experience se directly match karta hai.',
  hi: 'आपकी कंपनी जिस पैमाने पर पेमेंट्स संभालती है, वह मेरे पिछले दो साल के अनुभव से सीधे जुड़ता है।',
  mr: 'तुमची कंपनी ज्या प्रमाणात पेमेंट्स हाताळते, ते माझ्या गेल्या दोन वर्षांच्या अनुभवाशी थेट जुळते.',
  es: 'Su empresa gestiona pagos a una escala que encaja con lo que he construido en los últimos dos años.',
  fr: 'Votre entreprise traite des paiements à une échelle qui correspond à ce que je construis depuis deux ans.',
  de: 'Ihr Unternehmen verarbeitet Zahlungen in einer Größenordnung, die genau zu meinen letzten zwei Jahren passt.',
  pt: 'A sua empresa processa pagamentos numa escala que combina com o que construí nos últimos dois anos.',
  it: 'La vostra azienda gestisce pagamenti su una scala che corrisponde a ciò che ho costruito negli ultimi due anni.',
  ja: '御社の決済規模は、私がこの2年間取り組んできた仕事と直接つながっています。'
}

export const languageSample = (code: string): string => SAMPLES[code] ?? SAMPLES.en
