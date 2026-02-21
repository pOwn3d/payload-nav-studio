'use client'

import React, { useState, useCallback, useId } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { useNavPreferences } from '../hooks/useNavPreferences.js'
import { SortableGroup } from './SortableGroup.js'
import { SortableItem } from './SortableItem.js'
import { GroupEditor } from './GroupEditor.js'
import { NavItemEditor } from './NavItemEditor.js'
import type { NavGroupConfig, NavItemConfig } from '../types.js'

// ── Styles ──

const containerStyle: React.CSSProperties = {
  maxWidth: 700,
  margin: '0 auto',
  padding: '20px',
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 24,
  gap: 12,
}

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--theme-text)',
  margin: 0,
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: 6,
  backgroundColor: 'var(--theme-success-500)',
  color: 'white',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 6,
  background: 'none',
  fontSize: 13,
  cursor: 'pointer',
  color: 'var(--theme-text)',
}

const btnOutline: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px dashed var(--theme-elevation-300)',
  borderRadius: 6,
  background: 'none',
  fontSize: 13,
  cursor: 'pointer',
  color: 'var(--theme-elevation-500)',
  width: '100%',
  textAlign: 'center' as const,
}

const toastStyle = (visible: boolean, isError: boolean): React.CSSProperties => ({
  position: 'fixed',
  bottom: 24,
  right: 24,
  padding: '10px 20px',
  borderRadius: 8,
  backgroundColor: isError ? 'var(--theme-error-500)' : 'var(--theme-success-500)',
  color: 'white',
  fontSize: 13,
  fontWeight: 600,
  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  transform: visible ? 'translateY(0)' : 'translateY(100px)',
  opacity: visible ? 1 : 0,
  transition: 'transform 0.3s, opacity 0.3s',
  zIndex: 2000,
  pointerEvents: 'none' as const,
})

/**
 * NavCustomizer — Full drag & drop navigation editor.
 * Allows reordering groups and items, toggling visibility,
 * editing labels/icons/URLs, creating new groups/items.
 */
export const NavCustomizer: React.FC = () => {
  const { layout, isLoaded, isSaving, isCustom, save, reset } = useNavPreferences()
  const [groups, setGroups] = useState<NavGroupConfig[]>([])
  const [initialized, setInitialized] = useState(false)

  // Editors
  const [editingGroup, setEditingGroup] = useState<NavGroupConfig | null>(null)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [editingItem, setEditingItem] = useState<{ item: NavItemConfig; groupId: string } | null>(null)
  const [isCreatingItem, setIsCreatingItem] = useState<string | null>(null) // groupId for new item

  // Toast
  const [toast, setToast] = useState<{ message: string; isError: boolean; visible: boolean }>({
    message: '',
    isError: false,
    visible: false,
  })

  // DnD
  const [activeId, setActiveId] = useState<string | null>(null)
  const dndId = useId()

  // Initialize groups from loaded layout
  React.useEffect(() => {
    if (isLoaded && layout.length > 0 && !initialized) {
      setGroups(JSON.parse(JSON.stringify(layout)))
      setInitialized(true)
    }
  }, [isLoaded, layout, initialized])

  const showToast = useCallback((message: string, isError: boolean = false) => {
    setToast({ message, isError, visible: true })
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2500)
  }, [])

  // ── DnD sensors & collision ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Custom collision detection: groups only collide with groups, items with items
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = args.active.id as string
    const prefix = activeId.startsWith('group-') ? 'group-' : activeId.startsWith('item-') ? 'item-' : ''
    if (!prefix) return closestCenter(args)
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => (container.id as string).startsWith(prefix),
      ),
    })
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || active.id === over.id) return

    const activeStr = active.id as string
    const overStr = over.id as string

    // Group reordering
    if (activeStr.startsWith('group-') && overStr.startsWith('group-')) {
      const activeGroupId = activeStr.replace('group-', '')
      const overGroupId = overStr.replace('group-', '')

      setGroups((prev) => {
        const oldIndex = prev.findIndex((g) => g.id === activeGroupId)
        const newIndex = prev.findIndex((g) => g.id === overGroupId)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex)
      })
      return
    }

    // Item reordering (within same group or cross-group)
    if (activeStr.startsWith('item-') && overStr.startsWith('item-')) {
      // Parse: "item-{groupId}-{itemId}"
      const activeParts = activeStr.split('-').slice(1) // remove 'item' prefix
      const overParts = overStr.split('-').slice(1)

      // Group IDs can contain dashes, item IDs are at the end
      // Format: item-{groupId}-{itemId}
      // We stored data in the sortable, use it
      const activeData = active.data?.current as { groupId?: string; item?: NavItemConfig } | undefined
      const overData = over.data?.current as { groupId?: string; item?: NavItemConfig } | undefined

      if (!activeData?.groupId || !overData?.groupId) return

      const fromGroupId = activeData.groupId
      const toGroupId = overData.groupId
      const activeItemId = activeData.item?.id
      const overItemId = overData.item?.id

      if (!activeItemId || !overItemId) return

      setGroups((prev) => {
        const newGroups = JSON.parse(JSON.stringify(prev)) as NavGroupConfig[]

        if (fromGroupId === toGroupId) {
          // Same group reorder
          const group = newGroups.find((g) => g.id === fromGroupId)
          if (!group) return prev
          const oldIndex = group.items.findIndex((i) => i.id === activeItemId)
          const newIndex = group.items.findIndex((i) => i.id === overItemId)
          if (oldIndex === -1 || newIndex === -1) return prev
          group.items = arrayMove(group.items, oldIndex, newIndex)
        } else {
          // Cross-group move
          const fromGroup = newGroups.find((g) => g.id === fromGroupId)
          const toGroup = newGroups.find((g) => g.id === toGroupId)
          if (!fromGroup || !toGroup) return prev

          const itemIndex = fromGroup.items.findIndex((i) => i.id === activeItemId)
          if (itemIndex === -1) return prev

          const [item] = fromGroup.items.splice(itemIndex, 1)
          const targetIndex = toGroup.items.findIndex((i) => i.id === overItemId)
          toGroup.items.splice(targetIndex >= 0 ? targetIndex : toGroup.items.length, 0, item)
        }

        return newGroups
      })
    }
  }, [])

  // ── Group actions ──

  const toggleGroupVisibility = useCallback((groupId: string) => {
    setGroups((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, visible: g.visible === false ? true : false } : g
    ))
  }, [])

  const deleteGroup = useCallback((groupId: string) => {
    if (!window.confirm('Supprimer ce groupe et tous ses items ?')) return
    setGroups((prev) => prev.filter((g) => g.id !== groupId))
  }, [])

  const saveEditedGroup = useCallback((group: NavGroupConfig) => {
    setGroups((prev) => {
      const exists = prev.find((g) => g.id === group.id)
      if (exists) {
        return prev.map((g) => g.id === group.id ? { ...g, title: group.title, defaultCollapsed: group.defaultCollapsed } : g)
      }
      // New group
      return [...prev, group]
    })
    setEditingGroup(null)
    setIsCreatingGroup(false)
  }, [])

  // ── Item actions ──

  const toggleItemVisibility = useCallback((groupId: string, itemId: string) => {
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g
      return {
        ...g,
        items: g.items.map((item) =>
          item.id === itemId ? { ...item, visible: item.visible === false ? true : false } : item
        ),
      }
    }))
  }, [])

  const deleteItem = useCallback((groupId: string, itemId: string) => {
    setGroups((prev) => prev.map((g) => {
      if (g.id !== groupId) return g
      return { ...g, items: g.items.filter((item) => item.id !== itemId) }
    }))
  }, [])

  const saveEditedItem = useCallback((item: NavItemConfig, groupId?: string) => {
    const targetGroupId = groupId || editingItem?.groupId
    if (!targetGroupId) return

    setGroups((prev) => prev.map((g) => {
      if (g.id !== targetGroupId) return g
      const exists = g.items.find((i) => i.id === item.id)
      if (exists) {
        return { ...g, items: g.items.map((i) => i.id === item.id ? item : i) }
      }
      return { ...g, items: [...g.items, item] }
    }))

    setEditingItem(null)
    setIsCreatingItem(null)
  }, [editingItem])

  // ── Save / Reset ──

  const handleSave = useCallback(async () => {
    const success = await save(groups)
    showToast(success ? 'Navigation sauvegardée !' : 'Erreur lors de la sauvegarde', !success)
  }, [groups, save, showToast])

  const handleReset = useCallback(async () => {
    if (!window.confirm('Réinitialiser la navigation par défaut ? Vos personnalisations seront perdues.')) return
    const success = await reset()
    if (success) {
      setInitialized(false) // Will reload from layout
      showToast('Navigation réinitialisée')
    } else {
      showToast('Erreur lors de la réinitialisation', true)
    }
  }, [reset, showToast])

  // ── Render ──

  if (!isLoaded) {
    return (
      <div style={containerStyle}>
        <p style={{ color: 'var(--theme-elevation-400)', fontSize: 14 }}>Chargement...</p>
      </div>
    )
  }

  const groupIds = groups.map((g) => `group-${g.id}`)

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>Personnaliser la navigation</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {isCustom && (
            <button onClick={handleReset} style={btnSecondary} disabled={isSaving}>
              Réinitialiser
            </button>
          )}
          <button onClick={handleSave} style={btnPrimary} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Hint */}
      <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 16 }}>
        Glissez-déposez les groupes et items pour réorganiser. Utilisez les icônes pour masquer, modifier ou supprimer.
      </p>

      {/* DnD area */}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          {groups.map((group) => {
            const itemIds = group.items.map((item) => `item-${group.id}-${item.id}`)

            return (
              <SortableGroup
                key={group.id}
                group={group}
                onToggleVisibility={toggleGroupVisibility}
                onEdit={(g) => setEditingGroup(g)}
                onDelete={deleteGroup}
              >
                <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                  {group.items.map((item) => (
                    <SortableItem
                      key={item.id}
                      item={item}
                      groupId={group.id}
                      onToggleVisibility={toggleItemVisibility}
                      onEdit={(i, gId) => setEditingItem({ item: i, groupId: gId })}
                      onDelete={deleteItem}
                    />
                  ))}
                </SortableContext>

                {/* Add item button */}
                <div style={{ padding: '4px 8px' }}>
                  <button
                    onClick={() => setIsCreatingItem(group.id)}
                    style={{ ...btnOutline, padding: '4px 8px', fontSize: 11, border: '1px dashed var(--theme-elevation-250)' }}
                  >
                    + Ajouter un item
                  </button>
                </div>
              </SortableGroup>
            )
          })}
        </SortableContext>

        {/* Drag overlay */}
        <DragOverlay>
          {activeId ? (
            <div style={{
              padding: '8px 16px',
              borderRadius: 6,
              backgroundColor: 'var(--theme-elevation-100)',
              border: '1px solid var(--theme-elevation-300)',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--theme-text)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              cursor: 'grabbing',
            }}>
              {activeId.startsWith('group-')
                ? groups.find((g) => g.id === activeId.replace('group-', ''))?.title
                : (() => {
                    for (const g of groups) {
                      for (const item of g.items) {
                        if (`item-${g.id}-${item.id}` === activeId) return item.label
                      }
                    }
                    return activeId
                  })()
              }
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add group button */}
      <button onClick={() => setIsCreatingGroup(true)} style={btnOutline}>
        + Ajouter un groupe
      </button>

      {/* Modals */}
      {(editingGroup || isCreatingGroup) && (
        <GroupEditor
          group={editingGroup || undefined}
          onSave={saveEditedGroup}
          onCancel={() => { setEditingGroup(null); setIsCreatingGroup(false) }}
        />
      )}

      {editingItem && (
        <NavItemEditor
          item={editingItem.item}
          onSave={(item) => saveEditedItem(item)}
          onCancel={() => setEditingItem(null)}
        />
      )}

      {isCreatingItem && (
        <NavItemEditor
          item={{
            id: `item-${Date.now()}`,
            href: '/admin/',
            label: 'Nouveau lien',
            icon: 'file-text',
            visible: true,
          }}
          onSave={(item) => saveEditedItem(item, isCreatingItem)}
          onCancel={() => setIsCreatingItem(null)}
        />
      )}

      {/* Toast */}
      <div style={toastStyle(toast.visible, toast.isError)}>
        {toast.message}
      </div>
    </div>
  )
}

export default NavCustomizer
