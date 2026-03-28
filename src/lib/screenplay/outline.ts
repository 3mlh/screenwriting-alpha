import type { Block, OutlineNode, SectionMetadata } from '@/types/screenplay'
import { deriveScenes } from './scenes'

/**
 * Derive a hierarchical OutlineNode[] from a Block[].
 *
 * Hierarchy rules:
 *  - cold_open_marker → top-level section; subsequent scenes nest under it
 *  - section:act_start → top-level section; subsequent scenes nest under it
 *  - scene_heading → leaf scene node under the current section (or root)
 *  - All other block types (act_end, cold_open_start/end, sequence, action…)
 *    are not represented in the outline
 *
 * Scene descriptions: prefer a summary block in the scene, fall back to the
 * first action block. Set as the optional OutlineNode.description field.
 */
export function deriveOutline(blocks: Block[]): OutlineNode[] {
  // Pre-compute scene numbers and descriptions from deriveScenes
  const scenes = deriveScenes(blocks)
  const sceneNumbers = new Map<string, string>()
  const sceneDescriptions = new Map<string, string>()

  for (const scene of scenes) {
    const importedSceneNumber =
      scene.heading.metadata &&
      typeof scene.heading.metadata === 'object' &&
      'scene_number' in scene.heading.metadata &&
      typeof scene.heading.metadata.scene_number === 'string'
        ? scene.heading.metadata.scene_number
        : null

    sceneNumbers.set(scene.id, importedSceneNumber ?? String(scene.sceneNumber))
    const descBlock =
      scene.blocks.find(b => b.type === 'summary') ??
      scene.blocks.find(b => b.type === 'action')
    if (descBlock?.text) {
      sceneDescriptions.set(scene.id, descBlock.text)
    }
  }

  const root: OutlineNode[] = []
  let currentSection: OutlineNode | null = null

  for (const block of blocks) {
    if (block.type === 'cold_open_marker') {
      const node: OutlineNode = {
        id: block.id,
        type: 'section',
        label: block.text || 'COLD OPEN',
        children: [],
      }
      root.push(node)
      currentSection = node
    } else if (block.type === 'section') {
      const meta = block.metadata as SectionMetadata | undefined
      if (meta?.section_type === 'act_start') {
        const node: OutlineNode = {
          id: block.id,
          type: 'section',
          label: block.text,
          level: meta.level ?? 1,
          children: [],
        }
        root.push(node)
        currentSection = node
      }
      // act_end, cold_open_start, cold_open_end, sequence → not outline nodes
    } else if (block.type === 'scene_heading') {
      const sceneNumber = sceneNumbers.get(block.id)
      const description = sceneDescriptions.get(block.id)
      const node: OutlineNode = {
        id: block.id,
        type: 'scene',
        label: block.text,
        sceneNumber,
        ...(description !== undefined && { description }),
      }
      if (currentSection) {
        currentSection.children = currentSection.children ?? []
        currentSection.children.push(node)
      } else {
        root.push(node)
      }
    }
  }

  return root
}
