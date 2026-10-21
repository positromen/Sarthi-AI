// A small Markdown subset for answers: bullets, numbered items, headings, paragraphs, **bold**, `code`, fenced code
// blocks, and LaTeX math ($…$ inline, $$…$$ display). It is safe to call on every streamed delta: an unclosed
// marker renders as plain text (or an open code block) until its closing half arrives, never as broken markup.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'math'; tex: string }

export type Block =
  | { type: 'paragraph'; inline: Inline[] }
  | { type: 'heading'; inline: Inline[] }
  | { type: 'bullet'; inline: Inline[] }
  | { type: 'numbered'; n: number; inline: Inline[] }
  | { type: 'code'; lang: string; code: string; open: boolean }
  | { type: 'math'; tex: string }

/**
 * Index of the `$` closing inline math opened at `start`, or -1. Pandoc's rules, so prices stay text: no space just
 * inside either delimiter, and no digit right after the closing one ("$5 and $10" is not math).
 */
function closingDollar(src: string, start: number): number {
  const first = src[start + 1]
  if (first === undefined || first === ' ' || first === '$') return -1
  for (let j = src.indexOf('$', start + 1); j !== -1; j = src.indexOf('$', j + 1)) {
    const before = src[j - 1]
    if (before !== ' ' && before !== '\\' && !/\d/.test(src[j + 1] ?? '')) return j
  }
  return -1
}

export function parseInline(src: string): Inline[] {
  const out: Inline[] = []
  let text = ''
  const flush = () => {
    if (text) out.push({ kind: 'text', text })
    text = ''
  }
  let i = 0
  while (i < src.length) {
    if (src[i] === '\\' && src[i + 1] === '$') {
      text += '$'
      i += 2
      continue
    }
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ kind: 'code', text: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2)
      if (end > i + 2) {
        flush()
        out.push({ kind: 'bold', children: parseInline(src.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }
    if (src[i] === '$') {
      const end = closingDollar(src, i)
      if (end > 0) {
        flush()
        out.push({ kind: 'math', tex: src.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }
    text += src[i]
    i++
  }
  flush()
  return out
}

const FENCE = /^```\s*([\w+#.-]*)\s*$/
const BULLET = /^[-*•]\s+(.*)$/
const NUMBERED = /^(\d+)[.)]\s+(.*)$/
const HEADING = /^#{1,6}\s+(.*)$/

export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'paragraph', inline: parseInline(paragraph.join(' ')) })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    const fence = FENCE.exec(line)
    if (fence) {
      flushParagraph()
      const body: string[] = []
      let j = i + 1
      while (j < lines.length && !lines[j].trim().startsWith('```')) body.push(lines[j++])
      blocks.push({ type: 'code', lang: fence[1].toLowerCase(), code: body.join('\n'), open: j >= lines.length })
      i = j
      continue
    }

    if (line.startsWith('$$')) {
      flushParagraph()
      const single = /^\$\$(.+)\$\$$/.exec(line)
      if (single) {
        blocks.push({ type: 'math', tex: single[1].trim() })
        continue
      }
      const body = [line.slice(2)]
      let j = i + 1
      for (; j < lines.length; j++) {
        const next = lines[j].trim()
        if (next.endsWith('$$')) break
        body.push(lines[j])
      }
      if (j < lines.length) {
        body.push(lines[j].trim().slice(0, -2))
        blocks.push({ type: 'math', tex: body.join('\n').trim() })
        i = j
        continue
      }
      // Still streaming: show the raw TeX rather than handing KaTeX half an expression.
      const raw = lines.slice(i).map((l) => l.trim()).filter(Boolean).join(' ')
      blocks.push({ type: 'paragraph', inline: [{ kind: 'text', text: raw }] })
      break
    }

    let match: RegExpExecArray | null
    if (!line) flushParagraph()
    else if ((match = HEADING.exec(line))) {
      flushParagraph()
      blocks.push({ type: 'heading', inline: parseInline(match[1]) })
    } else if ((match = BULLET.exec(line))) {
      flushParagraph()
      blocks.push({ type: 'bullet', inline: parseInline(match[1]) })
    } else if ((match = NUMBERED.exec(line))) {
      flushParagraph()
      blocks.push({ type: 'numbered', n: Number(match[1]), inline: parseInline(match[2]) })
    } else paragraph.push(line)
  }
  flushParagraph()
  return blocks
}
