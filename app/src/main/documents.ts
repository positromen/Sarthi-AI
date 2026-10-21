import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'

/** File types the profile importer accepts (shown in the open dialog). */
export const DOCUMENT_EXTENSIONS = ['txt', 'md', 'pdf', 'docx'] as const

/** Read a résumé / job-description / notes file and return its plain text. */
export async function extractDocumentText(filePath: string): Promise<string> {
  const text = (await extractByExtension(filePath)).trim()
  if (!text) throw new Error('No readable text found in that file (a scanned/image-only PDF has no text layer).')
  return text
}

async function extractByExtension(filePath: string): Promise<string> {
  switch (extname(filePath).toLowerCase()) {
    case '.txt':
    case '.md':
    case '.text':
      return readFile(filePath, 'utf8')
    case '.pdf':
      return pdfToText(await readFile(filePath))
    case '.docx':
      return docxToText(await readFile(filePath))
    case '.doc':
      throw new Error('Old .doc files are not supported — open it in Word, "Save As" .docx, then import.')
    default:
      throw new Error(`Unsupported file type "${extname(filePath) || 'unknown'}". Use .txt, .pdf, or .docx.`)
  }
}

// mammoth (.docx) and pdf-parse (.pdf) are loaded lazily so they don't slow app startup. They are third-party
// CJS/ESM modules and the project tsconfig has no esModuleInterop, so we cross the import boundary with `any`.
async function docxToText(buffer: Buffer): Promise<string> {
  const mod = (await import('mammoth')) as any
  const mammoth = mod.default ?? mod
  const result = await mammoth.extractRawText({ buffer })
  return String(result?.value ?? '')
}

async function pdfToText(buffer: Buffer): Promise<string> {
  const mod = (await import('pdf-parse')) as any
  const PDFParse = mod.PDFParse ?? mod.default?.PDFParse
  const parser = new PDFParse({ data: buffer })
  try {
    const result = await parser.getText()
    return String(result?.text ?? '')
  } finally {
    await parser.destroy?.()
  }
}
