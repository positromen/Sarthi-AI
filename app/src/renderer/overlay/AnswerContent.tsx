// Renders an answer (Markdown subset from markdown.ts) in the overlay's answer style: bullets, bold, inline and
// fenced code with highlighting, and KaTeX math. Re-parsed on every streamed delta; parsing is cheap and safe on
// half-finished text.
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { memo, useMemo, type ReactNode } from 'react'
import { highlight, type TokenKind } from './highlight'
import { parseMarkdown, type Block, type Inline } from './markdown'

const TOKEN_COLOR: Record<TokenKind, string> = {
  keyword: 'text-leaf-soft',
  builtin: 'text-you',
  number: 'text-[#e8d29a]',
  string: 'text-[#e2c08d]',
  comment: 'text-fg-3',
  plain: 'text-[#d7e2da]'
}

const DEVANAGARI = /[ऀ-ॿ]/

// KaTeX escapes its input; `trust: false` (the default) keeps \href, \url and raw HTML commands disabled, which
// matters because answers are model output.
const Math = memo(function Math({ tex, display }: { tex: string; display?: boolean }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore', trust: false }),
    [tex, display]
  )
  return (
    <span
      className={display ? 'my-2 block overflow-x-auto text-white' : 'text-white'}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

function renderInline(parts: Inline[], keyPrefix = ''): ReactNode[] {
  return parts.map((part, i) => {
    const key = `${keyPrefix}${i}`
    switch (part.kind) {
      case 'text':
        return <span key={key}>{part.text}</span>
      case 'bold':
        return (
          <strong key={key} className="font-semibold text-white">
            {renderInline(part.children, `${key}.`)}
          </strong>
        )
      case 'code':
        return (
          <code key={key} className="rounded-key bg-white/7 px-[5px] py-px font-mono text-[0.86em] text-fg">
            {part.text}
          </code>
        )
      case 'math':
        return <Math key={key} tex={part.tex} />
    }
  })
}

const Caret = () => (
  <span className="ml-0.5 inline-block h-[1.05em] w-0.5 animate-caret rounded-[1px] bg-leaf align-[-2px]" aria-hidden="true" />
)

function CodeBlock({ lang, code, caret }: { lang: string; code: string; caret: boolean }) {
  const tokens = useMemo(() => highlight(code, lang), [code, lang])
  return (
    <div className="relative mt-1 mb-2.5 rounded-md border border-line bg-ink px-3 py-2.5">
      {lang && <span className="absolute top-1.5 right-2 font-sans text-[10.5px] text-fg-3">{lang}</span>}
      <pre className="overflow-x-auto font-mono text-[12.5px] leading-[1.6]">
        <code>
          {tokens.map((token, i) => (
            <span key={i} className={TOKEN_COLOR[token.kind]}>
              {token.text}
            </span>
          ))}
          {caret && <Caret />}
        </code>
      </pre>
    </div>
  )
}

function BlockView({ block, deva, caret }: { block: Block; deva: boolean; caret: boolean }) {
  const text = deva ? 'text-[15.5px] leading-[1.7]' : 'text-[15px] leading-[1.55]'
  switch (block.type) {
    case 'code':
      return <CodeBlock lang={block.lang} code={block.code} caret={caret} />
    case 'math':
      return <Math tex={block.tex} display />
    case 'heading':
      return (
        <div className="mt-1 mb-1.5 text-[13px] font-semibold text-fg">
          {renderInline(block.inline)}
          {caret && <Caret />}
        </div>
      )
    case 'bullet':
    case 'numbered':
      return (
        <div className={`mb-[7px] flex gap-2.5 text-fg-answer ${text}`}>
          {block.type === 'bullet' ? (
            <span className={`size-[5px] shrink-0 rounded-full bg-[#6f8f78] ${deva ? 'mt-[11px]' : 'mt-[9px]'}`} />
          ) : (
            <span className="w-4 shrink-0 text-right text-[13px] text-fg-3 tabular-nums">{block.n}.</span>
          )}
          <div className="min-w-0 flex-1 text-pretty">
            {renderInline(block.inline)}
            {caret && <Caret />}
          </div>
        </div>
      )
    case 'paragraph':
      return (
        <p className={`mb-2 text-pretty text-fg-answer ${text}`}>
          {renderInline(block.inline)}
          {caret && <Caret />}
        </p>
      )
  }
}

/** `streaming` shows the green caret at the end of the text. */
export function AnswerContent({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  const deva = DEVANAGARI.test(text)
  return (
    <div>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} deva={deva} caret={streaming && i === blocks.length - 1} />
      ))}
    </div>
  )
}
