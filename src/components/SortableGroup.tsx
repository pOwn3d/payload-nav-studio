'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import type { NavGroupConfig } from '../types.js'
import { resolveLabel } from '../utils.js'
import { EyeIcon, EyeOffIcon, PencilIcon, TrashIcon, GripVerticalIcon } from './Icons.js'

interface SortableGroupProps {
  group: NavGroupConfig
  children: React.ReactNode
  onToggleVisibility: (groupId: string) => void
  onEdit: (group: NavGroupConfig) => void
  onDelete: (groupId: string) => void
}

export const SortableGroup: React.FC<SortableGroupProps> = React.memo(({
  group,
  children,
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
    id: `group-${group.id}`,
  })

  const resolvedTitle = resolveLabel(group.title, i18n.language, i18n.fallbackLanguage as string)

  const isHidden = group.visible === false

  const containerClasses = [
    'admin-nav-sortable-group',
    isHidden && 'admin-nav-sortable-group--hidden',
    isDragging && 'admin-nav-sortable-group--dragging',
  ].filter(Boolean).join(' ')

  // DnD transform must remain inline (dynamic at runtime)
  const dndStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div ref={setNodeRef} className={containerClasses} style={dndStyle}>
      <div className="admin-nav-sortable-group__header" {...attributes} {...listeners}>
        {/* Drag handle */}
        <GripVerticalIcon />

        {/* Group title */}
        <span className={`admin-nav-sortable-group__title${isHidden ? ' admin-nav-sortable-group__title--hidden' : ''}`}>
          {resolvedTitle}
        </span>

        {/* Action buttons */}
        <button
          className="admin-nav-sortable-group__action-btn"
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(group.id) }}
          title={isHidden ? t('plugin-admin-nav:show') : t('plugin-admin-nav:hide')}
        >
          {isHidden ? <EyeOffIcon /> : <EyeIcon />}
        </button>
        <button className="admin-nav-sortable-group__action-btn" onClick={(e) => { e.stopPropagation(); onEdit(group) }} title={t('plugin-admin-nav:edit')}>
          <PencilIcon />
        </button>
        <button className="admin-nav-sortable-group__action-btn" onClick={(e) => { e.stopPropagation(); onDelete(group.id) }} title={t('plugin-admin-nav:delete')}>
          <TrashIcon />
        </button>
      </div>

      {/* Group items */}
      <div className={`admin-nav-sortable-group__items${isHidden ? ' admin-nav-sortable-group__items--hidden' : ''}`}>
        {children}
      </div>
    </div>
  )
})
