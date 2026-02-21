'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getIconPath } from '../icons.js'
import type { NavItemConfig } from '../types.js'

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

export const SortableItem: React.FC<SortableItemProps> = ({
  item,
  groupId,
  onToggleVisibility,
  onEdit,
  onDelete,
}) => {
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

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : item.visible === false ? 0.5 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    margin: '2px 8px',
    borderRadius: 6,
    backgroundColor: isDragging ? 'var(--theme-elevation-150)' : 'transparent',
    cursor: 'grab',
  }

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px',
    borderRadius: 4,
    color: 'var(--theme-elevation-400)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {/* Drag handle dots */}
      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0, color: 'var(--theme-elevation-400)' }}>
        <circle cx={9} cy={7} r={1} /><circle cx={9} cy={17} r={1} />
        <circle cx={15} cy={7} r={1} /><circle cx={15} cy={17} r={1} />
      </svg>

      {/* Item icon */}
      {item.icon.startsWith('#') ? (
        <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: '50%', backgroundColor: item.icon, flexShrink: 0 }} />
      ) : (
        <SmallIcon name={item.icon} />
      )}

      {/* Label */}
      <span style={{
        flex: 1,
        fontSize: 13,
        fontWeight: 500,
        color: item.visible === false ? 'var(--theme-elevation-400)' : 'var(--theme-text)',
        textDecoration: item.visible === false ? 'line-through' : 'none',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {item.label}
      </span>

      {/* Children count badge */}
      {item.children && item.children.length > 0 && (
        <span style={{
          fontSize: 10,
          padding: '1px 5px',
          borderRadius: 8,
          backgroundColor: 'var(--theme-elevation-200)',
          color: 'var(--theme-elevation-600)',
        }}>
          {item.children.length}
        </span>
      )}

      {/* Action buttons */}
      <button style={btnStyle} onClick={(e) => { e.stopPropagation(); onToggleVisibility(groupId, item.id) }} title={item.visible === false ? 'Afficher' : 'Masquer'}>
        {item.visible === false ? (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M1 1l22 22" />
          </svg>
        ) : (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx={12} cy={12} r={3} />
          </svg>
        )}
      </button>
      <button style={btnStyle} onClick={(e) => { e.stopPropagation(); onEdit(item, groupId) }} title="Modifier">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
      <button style={btnStyle} onClick={(e) => { e.stopPropagation(); onDelete(groupId, item.id) }} title="Supprimer">
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6L6 18" /><path d="M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
