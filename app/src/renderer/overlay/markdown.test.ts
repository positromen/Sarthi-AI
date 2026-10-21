import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './markdown'

describe('parseInline', () => {
  it('reads bold, inline code and inline math', () => {
    expect(parseInline('Use a **sliding window** over `s` in $O(n)$ time')).toEqual([
      { kind: 'text', text: 'Use a ' },
      { kind: 'bold', children: [{ kind: 'text', text: 'sliding window' }] },
      { kind: 'text', text: ' over ' },
      { kind: 'code', text: 's' },
      { kind: 'text', text: ' in ' },
      { kind: 'math', tex: 'O(n)' },
      { kind: 'text', text: ' time' }
    ])
  })

  it('parses code and math inside bold', () => {
    expect(parseInline('**keyed by `merchant_id`**')).toEqual([
      { kind: 'bold', children: [{ kind: 'text', text: 'keyed by ' }, { kind: 'code', text: 'merchant_id' }] }
    ])
  })

  it('leaves unclosed markers as plain text while the answer is still streaming', () => {
    expect(parseInline('**Situation:** the batch **was')).toEqual([
      { kind: 'bold', children: [{ kind: 'text', text: 'Situation:' }] },
      { kind: 'text', text: ' the batch **was' }
    ])
    expect(parseInline('call `foo')).toEqual([{ kind: 'text', text: 'call `foo' }])
    expect(parseInline('runs in $O(n')).toEqual([{ kind: 'text', text: 'runs in $O(n' }])
  })

  it('does not mistake prices for math', () => {
    expect(parseInline('cost $5 and $10 a month')).toEqual([{ kind: 'text', text: 'cost $5 and $10 a month' }])
    expect(parseInline('saved \\$200')).toEqual([{ kind: 'text', text: 'saved $200' }])
    expect(parseInline('pay $ 5 or 6$ later')).toEqual([{ kind: 'text', text: 'pay $ 5 or 6$ later' }])
  })
})

describe('parseMarkdown', () => {
  it('splits bullets, numbered items, headings and paragraphs', () => {
    const blocks = parseMarkdown('### Approach\n- first\n* second\n1. one\n2) two\n\nA closing line\ncontinues here.')
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'bullet', 'bullet', 'numbered', 'numbered', 'paragraph'])
    expect(blocks[3]).toMatchObject({ type: 'numbered', n: 1 })
    expect(blocks[5]).toMatchObject({ type: 'paragraph', inline: [{ kind: 'text', text: 'A closing line continues here.' }] })
  })

  it('keeps fenced code verbatim, with its language, and does not parse markdown inside it', () => {
    const blocks = parseMarkdown('Approach:\n```python\n- not a bullet\nx = **y**\n```\nDone.')
    expect(blocks).toEqual([
      { type: 'paragraph', inline: [{ kind: 'text', text: 'Approach:' }] },
      { type: 'code', lang: 'python', code: '- not a bullet\nx = **y**', open: false },
      { type: 'paragraph', inline: [{ kind: 'text', text: 'Done.' }] }
    ])
  })

  it('shows an unclosed fence as an open code block while streaming', () => {
    expect(parseMarkdown('```js\nconst a = 1\nfor (')).toEqual([{ type: 'code', lang: 'js', code: 'const a = 1\nfor (', open: true }])
  })

  it('reads display math on one line or across lines', () => {
    expect(parseMarkdown('$$\\sum_{i=1}^n i$$')).toEqual([{ type: 'math', tex: '\\sum_{i=1}^n i' }])
    expect(parseMarkdown('$$\n\\frac{a}{b}\n$$')).toEqual([{ type: 'math', tex: '\\frac{a}{b}' }])
  })

  it('shows unclosed display math as plain text until it closes', () => {
    expect(parseMarkdown('$$\n\\frac{a}{')).toEqual([{ type: 'paragraph', inline: [{ kind: 'text', text: '$$ \\frac{a}{' }] }])
  })

  it('returns nothing for empty text', () => {
    expect(parseMarkdown('  \n\n')).toEqual([])
  })
})
