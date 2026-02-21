'use client'

import React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { NavGroupConfig } from '../types.js'

interface SortableGroupProps {
  group: NavGroupConfig
  children: React.ReactNode
  onToggleVisibility: (groupId: string) => void
  onEdit: (group: NavGroupConfig) => void
  onDelete: (groupId: string) => void
}

export const SortableGroup: React.FC<SortableGroupProps> = ({
  group,
  children,
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
    id: `group-${group.id}`,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    marginBottom: 12,
    border: '1px solid var(--theme-elevation-200)',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: group.visible === false ? 'var(--theme-elevation-50)' : 'var(--theme-elevation-0)',
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    backgroundColor: 'var(--theme-elevation-100)',
    borderBottom: '1px solid var(--theme-elevation-200)',
    cursor: 'grab',
  }

  const btnStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 4,
    color: 'var(--theme-elevation-500)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  return (
    <div ref={setNodeRef} style={style}>
      <div style={headerStyle} {...attributes} {...listeners}>
        {/* Drag handle */}
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx={9} cy={5} r={1} /><circle cx={9} cy={12} r={1} /><circle cx={9} cy={19} r={1} />
          <circle cx={15} cy={5} r={1} /><circle cx={15} cy={12} r={1} /><circle cx={15} cy={19} r={1} />
        </svg>

        {/* Group title */}
        <span style={{
          flex: 1,
          fontWeight: 600,
          fontSize: 13,
          color: group.visible === false ? 'var(--theme-elevation-400)' : 'var(--theme-text)',
          textDecoration: group.visible === false ? 'line-through' : 'none',
        }}>
          {group.title}
        </span>

        {/* Action buttons */}
        <button
          style={btnStyle}
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(group.id) }}
          title={group.visible === false ? 'Afficher' : 'Masquer'}
        >
          {group.visible === false ? (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><path d="M1 1l22 22" />
            </svg>
          ) : (
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8z" /><circle cx={12} cy={12} r={3} />
            </svg>
          )}
        </button>
        <button style={btnStyle} onClick={(e) => { e.stopPropagation(); onEdit(group) }} title="Modifier">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="M15 5l4 4" />
          </svg>
        </button>
        <button style={btnStyle} onClick={(e) => { e.stopPropagation(); onDelete(group.id) }} title="Supprimer">
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>

      {/* Group items */}
      <div style={{ padding: group.visible === false ? '4px 0' : '8px 0', opacity: group.visible === false ? 0.5 : 1 }}>
        {children}
      </div>
    </div>
  )
}
