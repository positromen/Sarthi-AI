// Local retrieval over the candidate profile. A large profile is cut into chunks and only those relevant to the
// question are put in the prompt, so the model focuses on the right facts. Pure keyword ranking (BM25): no API
// call, no model download, microseconds per question.

export type ProfileSource = 'resume' | 'jd' | 'notes'

export interface Chunk {
  source: ProfileSource
  /** Position within its source, used to restore document order. */
  index: number
  text: string
}

export interface ProfileText {
  resume: string
  jobDescription: string
  notes: string
}

// Below this (~2k tokens) the whole profile goes in as-is; retrieval only pays off for big profiles.
const FULL_PROFILE_CHARS = 8000
// How much profile text a large profile is cut down to.
const PROFILE_BUDGET_CHARS = 6000
const CHUNK_CHARS = 700
const GAP = '\n…\n'

// Standard BM25 parameters.
const K1 = 1.2
const B = 0.75

// Question words carry no signal about which part of a résumé is relevant.
const STOPWORDS = new Set(
  (
    'a an the and or but of to in on at by for from with about as into over is are was were be been being am ' +
    'it its this that these those there here i me my mine we us our you your yours yourself he she they them their ' +
    'do does did done have has had can could would should will shall may might must not no so if then than ' +
    'what which who whom whose when where why how any some all each give tell describe explain walk through talk ' +
    'please share example time ' +
    'है हैं था थे के का की को में से और या पर भी तो आप हम मैं क्या कैसे क्यों कौन यह वह'
  ).split(' ')
)

// Letters, combining marks (Devanagari vowel signs) and digits make up a word.
const WORD = /[\p{L}\p{M}\p{N}]+/gu

/** Light suffix folding so "securing", "secured" and "secures" match. Applied identically to profile and question. */
function stem(word: string): string {
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3)
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2)
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1)
  return word
}

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(WORD) ?? []).filter((word) => !STOPWORDS.has(word)).map(stem)
}

/** Breaks text that is too long into pieces of at most `max`: by line, then sentence, then hard cut. */
function pieces(text: string, max: number): string[] {
  if (text.length <= max) return [text]
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length > 1) return lines.flatMap((line) => pieces(line, max))
  const sentences = text.split(/(?<=[.!?।])\s+/).filter(Boolean)
  if (sentences.length > 1) return sentences.flatMap((sentence) => pieces(sentence, max))
  const cuts: string[] = []
  for (let i = 0; i < text.length; i += max) cuts.push(text.slice(i, i + max))
  return cuts
}

/** Splits a profile field into chunks of at most `max` characters, packing short paragraphs together. */
export function chunkText(source: ProfileSource, text: string, max = CHUNK_CHARS): Chunk[] {
  const parts = text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .flatMap((paragraph) => pieces(paragraph, max))
  const chunks: Chunk[] = []
  let current = ''
  for (const part of parts) {
    if (current && current.length + 1 + part.length > max) {
      chunks.push({ source, index: chunks.length, text: current })
      current = ''
    }
    current = current ? `${current}\n${part}` : part
  }
  if (current) chunks.push({ source, index: chunks.length, text: current })
  return chunks
}

export class Bm25Index {
  private readonly termFrequencies: Map<string, number>[]
  private readonly lengths: number[]
  private readonly averageLength: number
  private readonly documentFrequency = new Map<string, number>()

  constructor(chunks: readonly Chunk[]) {
    this.termFrequencies = chunks.map((chunk) => {
      const frequencies = new Map<string, number>()
      for (const term of tokenize(chunk.text)) frequencies.set(term, (frequencies.get(term) ?? 0) + 1)
      for (const term of frequencies.keys()) this.documentFrequency.set(term, (this.documentFrequency.get(term) ?? 0) + 1)
      return frequencies
    })
    this.lengths = this.termFrequencies.map((frequencies) => [...frequencies.values()].reduce((a, b) => a + b, 0))
    this.averageLength = this.lengths.reduce((a, b) => a + b, 0) / Math.max(1, this.lengths.length) || 1
  }

  /** BM25 score of every chunk for the query, in chunk order; 0 means no shared terms. */
  score(query: string): number[] {
    const terms = [...new Set(tokenize(query))]
    const total = this.termFrequencies.length
    return this.termFrequencies.map((frequencies, i) =>
      terms.reduce((sum, term) => {
        const frequency = frequencies.get(term) ?? 0
        if (!frequency) return sum
        const containing = this.documentFrequency.get(term) ?? 0
        const idf = Math.log(1 + (total - containing + 0.5) / (containing + 0.5))
        const norm = K1 * (1 - B + (B * this.lengths[i]) / this.averageLength)
        return sum + (idf * frequency * (K1 + 1)) / (frequency + norm)
      }, 0)
    )
  }
}

/** Joins a source's chosen chunks in document order, marking skipped stretches with "…". */
function join(chunks: Chunk[]): string {
  const sorted = [...chunks].sort((a, b) => a.index - b.index)
  return sorted.map((chunk, i) => (i > 0 && chunk.index !== sorted[i - 1].index + 1 ? GAP : i > 0 ? '\n' : '') + chunk.text).join('')
}

/**
 * Returns the profile to put in the prompt: unchanged when small, otherwise the chunks most relevant to `query`
 * within `budget` characters. The résumé's and job description's openings (name, summary, role) are always kept;
 * when the question has no useful keywords ("Tell me about yourself") the opening sections fill the budget instead.
 */
export function selectProfile(profile: ProfileText, query: string, budget = PROFILE_BUDGET_CHARS): ProfileText {
  const size = profile.resume.length + profile.jobDescription.length + profile.notes.length
  if (size <= FULL_PROFILE_CHARS) return profile

  const bySource: Record<ProfileSource, Chunk[]> = {
    resume: chunkText('resume', profile.resume),
    jd: chunkText('jd', profile.jobDescription),
    notes: chunkText('notes', profile.notes)
  }
  const all = [...bySource.resume, ...bySource.jd, ...bySource.notes]
  const chosen = new Set<Chunk>()
  let used = 0
  const take = (chunk: Chunk | undefined, force = false): void => {
    if (!chunk || chosen.has(chunk)) return
    if (!force && used + chunk.text.length > budget) return
    chosen.add(chunk)
    used += chunk.text.length
  }

  take(bySource.resume[0], true)
  take(bySource.jd[0], true)

  const scores = new Bm25Index(all).score(query)
  const relevant = all.map((chunk, i) => ({ chunk, score: scores[i] })).filter(({ score }) => score > 0)
  if (relevant.length > 0) {
    relevant.sort((a, b) => b.score - a.score).forEach(({ chunk }) => take(chunk))
  } else {
    // No keywords to go on: take each source's opening chunks in turn, so notes aren't crowded out by the résumé.
    const longest = Math.max(bySource.resume.length, bySource.jd.length, bySource.notes.length)
    for (let i = 0; i < longest; i++) for (const source of ['resume', 'jd', 'notes'] as const) take(bySource[source][i])
  }

  const pick = (source: ProfileSource) => join(bySource[source].filter((chunk) => chosen.has(chunk)))
  return { resume: pick('resume'), jobDescription: pick('jd'), notes: pick('notes') }
}
