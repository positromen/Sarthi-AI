import { describe, expect, it } from 'vitest'
import { highlight } from './highlight'

const kinds = (code: string, lang: string) =>
  highlight(code, lang)
    .filter((t) => t.kind !== 'plain')
    .map((t) => [t.kind, t.text])

describe('highlight', () => {
  it('marks Python keywords, builtins, numbers, strings and comments', () => {
    expect(kinds('def f(s):\n    return len(s) + 1  # count\nx = "hi"', 'python')).toEqual([
      ['keyword', 'def'],
      ['keyword', 'return'],
      ['builtin', 'len'],
      ['number', '1'],
      ['comment', '# count'],
      ['string', '"hi"']
    ])
  })

  it('handles C-family line and block comments and template strings', () => {
    expect(kinds('const a = `x` // note\n/* block\ncomment */ return a', 'ts')).toEqual([
      ['keyword', 'const'],
      ['string', '`x`'],
      ['comment', '// note'],
      ['comment', '/* block\ncomment */'],
      ['keyword', 'return']
    ])
  })

  it('treats SQL keywords case-insensitively and -- as a comment', () => {
    expect(kinds('select id from t -- all', 'sql')).toEqual([
      ['keyword', 'select'],
      ['keyword', 'from'],
      ['comment', '-- all']
    ])
    expect(kinds('SELECT id FROM t', 'sql')).toEqual([
      ['keyword', 'SELECT'],
      ['keyword', 'FROM']
    ])
  })

  it('ends an unterminated string at the line, so the next line still highlights', () => {
    expect(kinds('x = "abc\ny = 1', 'python')).toEqual([
      ['string', '"abc'],
      ['number', '1']
    ])
  })

  it('reproduces the source exactly, even mid-stream with an unterminated string', () => {
    for (const [code, lang] of [
      ['print("unterminated', 'python'],
      ['int main() { return 0; }', 'cpp'],
      ['func main() {}', 'go'],
      ['anything at all ✓', 'unknown']
    ]) {
      expect(highlight(code, lang).map((t) => t.text).join('')).toBe(code)
    }
  })

  it('does not colour keywords inside identifiers', () => {
    expect(kinds('format_in = 1', 'python')).toEqual([['number', '1']])
  })
})
