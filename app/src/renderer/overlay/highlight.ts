// Minimal syntax highlighting for code in answers (no library: offline, small). Tokens always concatenate back to
// the exact source, so a half-streamed block (e.g. an unterminated string) still renders every character.

export type TokenKind = 'keyword' | 'builtin' | 'number' | 'string' | 'comment' | 'plain'

export interface Token {
  kind: TokenKind
  text: string
}

interface Grammar {
  keywords: Set<string>
  builtins: Set<string>
  lineComment: string[]
  blockComment: boolean
  quotes: string
  caseInsensitive?: boolean
}

const words = (list: string): Set<string> => new Set(list.split(' '))

const PYTHON: Grammar = {
  keywords: words(
    'def class return if elif else for while in not and or is import from as with try except finally raise pass break continue lambda yield global nonlocal assert del None True False async await'
  ),
  builtins: words(
    'len range print enumerate zip map filter sorted min max sum abs int str float list dict set tuple bool any all open isinstance reversed super'
  ),
  lineComment: ['#'],
  blockComment: false,
  quotes: `"'`
}

const JS: Grammar = {
  keywords: words(
    'const let var function return if else for while do switch case break continue new class extends import from export default try catch finally throw async await of in typeof instanceof this null undefined true false yield interface type implements'
  ),
  builtins: words('console Math JSON Array Object Map Set Promise String Number parseInt Date Error'),
  lineComment: ['//'],
  blockComment: true,
  quotes: '"\'`'
}

const JAVA: Grammar = {
  keywords: words(
    'public private protected static final class interface extends implements return if else for while do switch case break continue new try catch finally throw throws void int long double float boolean char byte short this null true false import package var'
  ),
  builtins: words('String System List ArrayList HashMap Map Set HashSet Math Integer Arrays Collections'),
  lineComment: ['//'],
  blockComment: true,
  quotes: `"'`
}

const C: Grammar = {
  keywords: words(
    'int long short char float double void bool auto const static struct class public private protected return if else for while do switch case break continue new delete namespace using template typename true false nullptr unsigned'
  ),
  builtins: words('std vector string map unordered_map set unordered_set pair printf cout cin endl size_t sort'),
  lineComment: ['//'],
  blockComment: true,
  quotes: `"'`
}

const GO: Grammar = {
  keywords: words(
    'func package import var const type struct interface map chan go defer return if else for range switch case break continue select nil true false'
  ),
  builtins: words('len cap make append new fmt panic copy delete string int bool error'),
  lineComment: ['//'],
  blockComment: true,
  quotes: '"\'`'
}

const SQL: Grammar = {
  keywords: words(
    'select from where join left right inner outer full on group by order having limit offset insert into values update set delete create table index as and or not null is in distinct union all case when then else end with exists between like primary key'
  ),
  builtins: words('count sum avg min max coalesce now'),
  lineComment: ['--'],
  blockComment: true,
  quotes: `'"`,
  caseInsensitive: true
}

// Unknown languages still get comments, strings and numbers.
const GENERIC: Grammar = { keywords: new Set(), builtins: new Set(), lineComment: ['//', '#'], blockComment: true, quotes: `"'` }

const BY_LANG: Record<string, Grammar> = {
  py: PYTHON, python: PYTHON,
  js: JS, javascript: JS, ts: JS, typescript: JS, jsx: JS, tsx: JS,
  java: JAVA, kotlin: JAVA,
  c: C, cpp: C, 'c++': C, h: C, hpp: C, cs: C, csharp: C,
  go: GO, golang: GO,
  sql: SQL, postgres: SQL, postgresql: SQL, mysql: SQL
}

const WORD = /[A-Za-z_][A-Za-z0-9_]*/y
const NUMBER = /0[xX][0-9a-fA-F]+|\d[\d_]*(\.\d+)?([eE][+-]?\d+)?/y

export function highlight(code: string, lang: string): Token[] {
  const g = BY_LANG[lang.toLowerCase()] ?? GENERIC
  const tokens: Token[] = []
  const push = (kind: TokenKind, text: string) => {
    const last = tokens[tokens.length - 1]
    if (kind === 'plain' && last?.kind === 'plain') last.text += text
    else tokens.push({ kind, text })
  }
  const restOfLine = (from: number) => {
    const end = code.indexOf('\n', from)
    return end === -1 ? code.length : end
  }

  let i = 0
  while (i < code.length) {
    const lineComment = g.lineComment.find((marker) => code.startsWith(marker, i))
    if (lineComment) {
      const end = restOfLine(i)
      push('comment', code.slice(i, end))
      i = end
      continue
    }
    if (g.blockComment && code.startsWith('/*', i)) {
      const close = code.indexOf('*/', i + 2)
      const end = close === -1 ? code.length : close + 2
      push('comment', code.slice(i, end))
      i = end
      continue
    }
    const ch = code[i]
    if (g.quotes.includes(ch)) {
      // Python triple quotes and JS template strings may span lines; other strings end at the line.
      const triple = g === PYTHON && code.startsWith(ch.repeat(3), i)
      const delimiter = triple ? ch.repeat(3) : ch
      let j = i + delimiter.length
      let end = -1
      while (j < code.length) {
        if (code[j] === '\\') {
          j += 2
          continue
        }
        if (code.startsWith(delimiter, j)) {
          end = j + delimiter.length
          break
        }
        if (code[j] === '\n' && !triple && ch !== '`') break
        j++
      }
      if (end === -1) end = Math.min(j, code.length)
      push('string', code.slice(i, end))
      i = end
      continue
    }
    WORD.lastIndex = i
    const word = WORD.exec(code)
    if (word) {
      const key = g.caseInsensitive ? word[0].toLowerCase() : word[0]
      push(g.keywords.has(key) ? 'keyword' : g.builtins.has(key) ? 'builtin' : 'plain', word[0])
      i += word[0].length
      continue
    }
    NUMBER.lastIndex = i
    const number = NUMBER.exec(code)
    if (number) {
      push('number', number[0])
      i += number[0].length
      continue
    }
    push('plain', ch)
    i++
  }
  return tokens
}
