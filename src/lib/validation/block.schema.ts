import { z } from 'zod'
import { BLOCK_TYPES } from '@/types/screenplay'

// ─── Metadata Schemas ────────────────────────────────────────────────────────

export const sectionMetadataSchema = z.object({
  section_type: z.enum([
    'act_start',
    'act_end',
    'sequence',
    'summary',
    'cold_open_start',
    'cold_open_end',
  ]),
  label: z.string().optional(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
})

export const sceneHeadingMetadataSchema = z.object({
  scene_number: z.string().optional(),
  time_of_day: z.string().optional(),
  location: z.string().optional(),
  int_ext: z
    .enum(['INT', 'EXT', 'INT/EXT', 'EXT/INT'])
    .optional(),
})

export const characterMetadataSchema = z.object({
  is_dual_dialogue: z.boolean().optional(),
  extension: z.string().optional(),
})

// ─── Block Schema ─────────────────────────────────────────────────────────────

export const blockTypeSchema = z.enum(BLOCK_TYPES)

export const blockSchema = z.object({
  // UUID v4 pattern
  id: z.string().uuid('Block id must be a valid UUID'),

  type: blockTypeSchema,

  // Text content. Empty string is valid (blank action line, etc.)
  text: z.string(),

  metadata: z
    .union([
      sectionMetadataSchema,
      sceneHeadingMetadataSchema,
      characterMetadataSchema,
      z.record(z.unknown()),
    ])
    .optional(),

  // Sparse integer position. Must be a non-negative integer.
  position: z
    .number()
    .int('Position must be an integer')
    .nonnegative('Position must be non-negative'),
})

export const blocksSchema = z.array(blockSchema)

// ─── Types inferred from schemas ─────────────────────────────────────────────

export type BlockSchema = z.infer<typeof blockSchema>
export type BlocksSchema = z.infer<typeof blocksSchema>

// ─── Validation helpers ──────────────────────────────────────────────────────

export function validateBlock(value: unknown): BlockSchema {
  return blockSchema.parse(value)
}

export function validateBlocks(value: unknown): BlocksSchema {
  return blocksSchema.parse(value)
}

export function safeValidateBlocks(
  value: unknown
): { success: true; data: BlocksSchema } | { success: false; error: z.ZodError } {
  const result = blocksSchema.safeParse(value)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: result.error }
}
