// Single source of truth for the Lexical node registry.
// Import this wherever you need to configure the editor's node list.
// Keep this in sync with BLOCK_TYPES in src/types/screenplay.ts.

import { Klass, LexicalNode } from 'lexical'
import { SceneHeadingNode } from './nodes/SceneHeadingNode'
import { ActionNode } from './nodes/ActionNode'
import { CharacterNode } from './nodes/CharacterNode'
import { DialogueNode } from './nodes/DialogueNode'
import { ParentheticalNode } from './nodes/ParentheticalNode'
import { TransitionNode } from './nodes/TransitionNode'
import { ShotNode } from './nodes/ShotNode'
import { SectionNode } from './nodes/SectionNode'
import { SummaryNode } from './nodes/SummaryNode'
import { ColdOpenMarkerNode } from './nodes/ColdOpenMarkerNode'

export const SCREENPLAY_NODES: Array<Klass<LexicalNode>> = [
  SceneHeadingNode,
  ActionNode,
  CharacterNode,
  DialogueNode,
  ParentheticalNode,
  TransitionNode,
  ShotNode,
  SectionNode,
  SummaryNode,
  ColdOpenMarkerNode,
]

export {
  SceneHeadingNode,
  ActionNode,
  CharacterNode,
  DialogueNode,
  ParentheticalNode,
  TransitionNode,
  ShotNode,
  SectionNode,
  SummaryNode,
  ColdOpenMarkerNode,
}
