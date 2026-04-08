'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getIconPath } from '../icons.js'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import type { NavItemConfig } from '../types.js'
import { resolveLabel } from '../utils.js'
import { EyeIcon, EyeOffIcon, PencilIcon, XIcon, GripDotsIcon } from './Icons.js'

interface SortableItemProps {
  item: NavItemConfig
  groupId: string
  onToggleVisibility: (groupId: string, itemId: string) => void
  onEdit: (item: NavItemConfig, groupId: string) => void
  onDelete: (groupId: string, itemId: string) => void
}

const SmallIcon: React.FC<{ name: string }> = ({ name }) => {
  const pathData = getIconPath(name)
  if (!pathData) return null
  const paths = pathData.split(/(?= M)/).map((p) => p.trim())
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {paths.map((d, i) => <path key={i} d={d} />)}
    </svg>
  )
}

export const SortableItem: React.FC<SortableItemProps> = React.memo(({
  item,
  groupId,
  onToggleVisibility,
  onEdit,
  onDelete,
}) => {
  const { t, i18n } = usePluginTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `item-${groupId}-${item.id}`,
    data: { groupId, item },
  })

  const resolvedLabel = resolveLabel(item.label, i18n.language, i18n.fallbackLanguage as string)

  const isHidden = item.visible === false

  const containerClasses = [
    'admin-nav-sortable-item',
    isDragging && 'admin-nav-sortable-item--dragging',
    isHidden && 'admin-nav-sortable-item--invisible',
  ].filter(Boolean).join(' ')

  // DnD transform must remain inline (dynamic at runtime)
  const dndStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} className={containerClasses} style={dndStyle} {...attributes} {...listeners}>
      {/* Drag handle dots */}
      <GripDotsIcon />

      {/* Item icon */}
      {item.icon.startsWith('#') ? (
        <span className="admin-nav-sortable-item__dot-icon" style={{ backgroundColor: item.icon }} />
      ) : (
        <SmallIcon name={item.icon} />
      )}

      {/* Label */}
      <span className={`admin-nav-sortable-item__label${isHidden ? ' admin-nav-sortable-item__label--hidden' : ''}`}>
        {resolvedLabel}
      </span>

      {/* Children count badge */}
      {item.children && item.children.length > 0 && (
        <span className="admin-nav-sortable-item__badge">
          {item.children.length}
        </span>
      )}

      {/* Action buttons */}
      <button className="admin-nav-sortable-item__action-btn" onClick={(e) => { e.stopPropagation(); onToggleVisibility(groupId, item.id) }} title={isHidden ? t('plugin-admin-nav:show') : t('plugin-admin-nav:hide')}>
        {isHidden ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
      </button>
      <button className="admin-nav-sortable-item__action-btn" onClick={(e) => { e.stopPropagation(); onEdit(item, groupId) }} title={t('plugin-admin-nav:edit')}>
        <PencilIcon size={12} />
      </button>
      <button className="admin-nav-sortable-item__action-btn" onClick={(e) => { e.stopPropagation(); onDelete(groupId, item.id) }} title={t('plugin-admin-nav:delete')}>
        <XIcon />
      </button>
    </div>
  )
})
