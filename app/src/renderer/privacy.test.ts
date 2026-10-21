// Privacy guard: a native `title` tooltip is drawn by Windows in its own small window, which content protection
// (private mode) does not cover, so it would show up in a screen share. No DOM element may set one; component props
// that happen to be called `title` (PageHeader, EmptyState…) are fine.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDERER = join(__dirname)

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return name.endsWith('.tsx') ? [path] : []
  })
}

// Components that pass extra props straight through to a DOM <button>, so `title` on them is a native tooltip too.
const FORWARDS_TO_DOM = new Set(['Button', 'IconButton'])

/** Lines where a DOM element (or a component that forwards to one) gets a `title=` attribute. */
function nativeTooltips(source: string): number[] {
  const hits: number[] = []
  for (const match of source.matchAll(/\btitle=/g)) {
    const tagStart = source.lastIndexOf('<', match.index)
    const tag = /^<([A-Za-z][\w.]*)/.exec(source.slice(tagStart))?.[1]
    if (tag && (tag[0] === tag[0].toLowerCase() || FORWARDS_TO_DOM.has(tag))) {
      hits.push(source.slice(0, match.index).split('\n').length)
    }
  }
  return hits
}

describe('privacy in screen share', () => {
  it('detects a native tooltip on a DOM element or a forwarding button, and ignores component props', () => {
    expect(nativeTooltips('<button onClick={go} title="Stop">x</button>')).toEqual([1])
    expect(nativeTooltips('<Button\n  size={26}\n  title="Again">x</Button>')).toEqual([3])
    expect(nativeTooltips('<PageHeader title="Setup" />')).toEqual([])
  })

  it('no renderer element shows a native tooltip, since tooltips escape content protection', () => {
    const offenders = tsxFiles(RENDERER).flatMap((file) =>
      nativeTooltips(readFileSync(file, 'utf8')).map((line) => `${file.slice(RENDERER.length + 1)}:${line}`)
    )
    expect(offenders).toEqual([])
  })
})
