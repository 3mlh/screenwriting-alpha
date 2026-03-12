import type { PermissionLevel } from '@/types/screenplay'

const styles: Record<PermissionLevel, string> = {
  owner:  'bg-amber-100 text-amber-800',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-stone-100 text-stone-600',
}

export function PermissionBadge({ role }: { role: PermissionLevel }) {
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${styles[role]}`}>
      {role}
    </span>
  )
}
