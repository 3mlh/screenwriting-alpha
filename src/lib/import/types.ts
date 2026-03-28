import type { Block } from '@/types/screenplay'

export type ScriptImportFormat = 'txt' | 'pdf' | 'fdx'

export interface ScriptImportResult {
  format: ScriptImportFormat
  title: string
  blocks: Block[]
  warnings?: string[]
}

export interface ScriptImporter {
  format: ScriptImportFormat
  extensions: string[]
  parse(file: File): Promise<ScriptImportResult>
}

export class UnsupportedImportFormatError extends Error {
  constructor(message = 'Unsupported script import format') {
    super(message)
    this.name = 'UnsupportedImportFormatError'
  }
}

export class ScriptImportParseError extends Error {
  constructor(message = 'Failed to parse imported script') {
    super(message)
    this.name = 'ScriptImportParseError'
  }
}

export class ScriptImportNotReadyError extends Error {
  constructor(message = 'This import format is not wired up yet') {
    super(message)
    this.name = 'ScriptImportNotReadyError'
  }
}
