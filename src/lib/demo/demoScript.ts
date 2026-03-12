import type { Block } from '@/types/screenplay'

// ─── Demo script ──────────────────────────────────────────────────────────────
//
// A short excerpt that demonstrates every block type.
// Used by the editor page demo mode and by the round-trip test.
//
// Based loosely on the UI mockup: "The Lighthouse — S01E07 — Signal Lost"

export const DEMO_BLOCKS: Block[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    type: 'cold_open_marker',
    text: 'COLD OPEN',
    position: 1000,
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    type: 'scene_heading',
    text: 'EXT. LIGHTHOUSE GALLERY — NIGHT',
    position: 2000,
    metadata: {
      int_ext: 'EXT',
      location: 'LIGHTHOUSE GALLERY',
      time_of_day: 'NIGHT',
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    type: 'action',
    text: 'Wind screams across the gallery. Aldric grips the railing and looks out. Where the island should be — nothing. Just black water and fog.',
    position: 3000,
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    type: 'character',
    text: 'ALDRIC',
    position: 4000,
    metadata: {
      extension: undefined,
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    type: 'parenthetical',
    text: '(to himself)',
    position: 5000,
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    type: 'dialogue',
    text: "That's not possible.",
    position: 6000,
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    type: 'action',
    text: 'He pulls out binoculars. Scans the horizon. Empty.',
    position: 7000,
  },
  {
    id: '00000000-0000-0000-0000-000000000008',
    type: 'character',
    text: 'KAEL',
    position: 8000,
  },
  {
    id: '00000000-0000-0000-0000-000000000009',
    type: 'parenthetical',
    text: '(from doorway)',
    position: 9000,
  },
  {
    id: '00000000-0000-0000-0000-000000000010',
    type: 'dialogue',
    text: "We've been watching it disappear for the last six hours. Started with the radio tower. Then the treeline.",
    position: 10000,
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    type: 'character',
    text: 'ALDRIC',
    position: 11000,
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    type: 'dialogue',
    text: "Islands don't disappear.",
    position: 12000,
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    type: 'character',
    text: 'KAEL',
    position: 13000,
  },
  {
    id: '00000000-0000-0000-0000-000000000014',
    type: 'dialogue',
    text: "No. They don't.",
    position: 14000,
  },
  {
    id: '00000000-0000-0000-0000-000000000015',
    type: 'shot',
    text: 'CLOSE ON: the binoculars — trembling in Aldric\'s grip.',
    position: 15000,
  },
  {
    id: '00000000-0000-0000-0000-000000000016',
    type: 'transition',
    text: 'CUT TO:',
    position: 16000,
  },
  {
    id: '00000000-0000-0000-0000-000000000017',
    type: 'section',
    text: 'ACT ONE',
    position: 17000,
    metadata: {
      section_type: 'act_start',
      level: 1,
      label: 'Act One',
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000018',
    type: 'scene_heading',
    text: 'INT. LIGHTHOUSE — LOWER LEVEL — LATER',
    position: 18000,
    metadata: {
      int_ext: 'INT',
      location: 'LIGHTHOUSE — LOWER LEVEL',
      time_of_day: 'LATER',
    },
  },
  {
    id: '00000000-0000-0000-0000-000000000019',
    type: 'action',
    text: 'Mara sits cross-legged on the floor, surrounded by leather-bound logbooks. She\'s working through them one by one. Dust motes drift in the lamplight.',
    position: 19000,
  },
  {
    id: '00000000-0000-0000-0000-000000000020',
    type: 'summary',
    text: 'Mara discovers the old logbook entry that connects the signal anomaly to an event from 1943.',
    position: 20000,
  },
]
