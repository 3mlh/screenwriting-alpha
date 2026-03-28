import { validateBlocks } from '@/lib/validation/block.schema'
import { parsePlainTextScript } from './plainTextToBlocks'
import {
  ScriptImportNotReadyError,
  type ScriptImporter,
  type ScriptImportResult,
  UnsupportedImportFormatError,
} from './types'

function deriveTitleFromFileName(fileName: string): string {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const cleaned = baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return cleaned || 'Imported Script'
}

const txtImporter: ScriptImporter = {
  format: 'txt',
  extensions: ['txt'],
  async parse(file: File): Promise<ScriptImportResult> {
    const blocks = validateBlocks(parsePlainTextScript(await file.text()))

    return {
      format: 'txt',
      title: deriveTitleFromFileName(file.name),
      blocks,
    }
  },
}

const pdfImporter: ScriptImporter = {
  format: 'pdf',
  extensions: ['pdf'],
  async parse(_file: File): Promise<ScriptImportResult> {
    throw new ScriptImportNotReadyError('PDF import is the next step. Please use a .txt export for now.')
  },
}

const fdxImporter: ScriptImporter = {
  format: 'fdx',
  extensions: ['fdx'],
  async parse(_file: File): Promise<ScriptImportResult> {
    throw new ScriptImportNotReadyError('FDX import is planned, but not wired up yet.')
  },
}

const importers: ScriptImporter[] = [txtImporter, pdfImporter, fdxImporter]

export function getScriptImporterForFileName(fileName: string): ScriptImporter {
  const extension = fileName.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1]

  if (!extension) {
    throw new UnsupportedImportFormatError('Import file must have an extension')
  }

  const importer = importers.find((candidate) => candidate.extensions.includes(extension))
  if (!importer) {
    throw new UnsupportedImportFormatError('Only .pdf, .txt, and .fdx imports are supported right now')
  }

  return importer
}
