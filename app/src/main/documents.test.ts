import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { extractDocumentText } from './documents'

const dir = mkdtempSync(join(tmpdir(), 'sarthi-doc-'))
const write = (name: string, content: string): string => {
  const path = join(dir, name)
  writeFileSync(path, content, 'utf8')
  return path
}

describe('extractDocumentText', () => {
  it('reads and trims plain-text files', async () => {
    expect(await extractDocumentText(write('notes.txt', '  Hello résumé  '))).toBe('Hello résumé')
  })

  it('rejects empty / whitespace-only files', async () => {
    await expect(extractDocumentText(write('empty.txt', '   '))).rejects.toThrow(/No readable text/)
  })

  it('rejects legacy .doc with a .docx hint', async () => {
    await expect(extractDocumentText(write('old.doc', 'x'))).rejects.toThrow(/\.docx/)
  })

  it('rejects unsupported extensions', async () => {
    await expect(extractDocumentText(write('file.rtf', 'x'))).rejects.toThrow(/Unsupported/)
  })
})
