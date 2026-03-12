'use client'

import React, { useState, useCallback, useId, useEffect, useRef, useMemo } from 'react'
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
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import type { NavGroupConfig, NavItemConfig } from '../types.js'
import { resolveLabel } from '../utils.js'

// ── Constants ──

const MAX_UNDO_STACK = 20

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

const btnSmall: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 5,
  background: 'none',
  fontSize: 11,
  cursor: 'pointer',
  color: 'var(--theme-elevation-600)',
  whiteSpace: 'nowrap' as const,
}

const btnSmallDisabled: React.CSSProperties = {
  ...btnSmall,
  opacity: 0.4,
  cursor: 'default',
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: 6,
  marginBottom: 16,
  alignItems: 'center',
}

const searchContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginBottom: 16,
}

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '7px 12px',
  border: '1px solid var(--theme-elevation-200)',
  borderRadius: 6,
  fontSize: 13,
  color: 'var(--theme-text)',
  backgroundColor: 'var(--theme-input-bg, transparent)',
  outline: 'none',
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

// ── Helpers ──

/** Deep clone a NavGroupConfig array */
function cloneGroups(groups: NavGroupConfig[]): NavGroupConfig[] {
  return JSON.parse(JSON.stringify(groups))
}

/** Validate that a JSON value looks like a valid NavGroupConfig[] */
function isValidNavConfig(data: unknown): data is NavGroupConfig[] {
  if (!Array.isArray(data)) return false
  return data.every(
    (g) =>
      typeof g === 'object' &&
      g !== null &&
      typeof g.id === 'string' &&
      g.title !== undefined &&
      Array.isArray(g.items) &&
      g.items.every(
        (i: unknown) =>
          typeof i === 'object' &&
          i !== null &&
          typeof (i as NavItemConfig).id === 'string' &&
          typeof (i as NavItemConfig).href === 'string' &&
          (i as NavItemConfig).label !== undefined,
      ),
  )
}

/**
 * NavCustomizer — Full drag & drop navigation editor.
 * Allows reordering groups and items, toggling visibility,
 * editing labels/icons/URLs, creating new groups/items.
 * Features: undo/redo, search/filter, import/export, bulk show/hide.
 */
export const NavCustomizer: React.FC = () => {
  const { t, i18n } = usePluginTranslation()
  const { layout, isLoaded, isSaving, isCustom, save, reset } = useNavPreferences()
  const [groups, setGroups] = useState<NavGroupConfig[]>([])
  const [initialized, setInitialized] = useState(false)

  const lang = i18n.language
  const fallbackLang = i18n.fallbackLanguage as string

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

  // ── Feature 1: Undo/Redo Stack ──
  const [undoStack, setUndoStack] = useState<NavGroupConfig[][]>([])
  const [redoStack, setRedoStack] = useState<NavGroupConfig[][]>([])

  /** Push current state onto the undo stack before a change */
  const pushUndo = useCallback((currentGroups: NavGroupConfig[]) => {
    setUndoStack((prev) => {
      const next = [...prev, cloneGroups(currentGroups)]
      if (next.length > MAX_UNDO_STACK) next.shift()
      return next
    })
    // Any new action clears the redo stack
    setRedoStack([])
  }, [])

  /** Wrapper around setGroups that also pushes to undo */
  const setGroupsWithUndo = useCallback(
    (updater: NavGroupConfig[] | ((prev: NavGroupConfig[]) => NavGroupConfig[])) => {
      setGroups((prev) => {
        pushUndo(prev)
        return typeof updater === 'function' ? updater(prev) : updater
      })
    },
    [pushUndo],
  )

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return
    setUndoStack((prev) => {
      const newStack = [...prev]
      const snapshot = newStack.pop()!
      setRedoStack((r) => {
        const newRedo = [...r]
        // Push current groups to redo before restoring
        setGroups((currentGroups) => {
          newRedo.push(cloneGroups(currentGroups))
          return snapshot
        })
        if (newRedo.length > MAX_UNDO_STACK) newRedo.shift()
        return newRedo
      })
      return newStack
    })
  }, [undoStack.length])

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return
    setRedoStack((prev) => {
      const newStack = [...prev]
      const snapshot = newStack.pop()!
      setUndoStack((u) => {
        const newUndo = [...u]
        // Push current groups to undo before restoring
        setGroups((currentGroups) => {
          newUndo.push(cloneGroups(currentGroups))
          return snapshot
        })
        if (newUndo.length > MAX_UNDO_STACK) newUndo.shift()
        return newUndo
      })
      return newStack
    })
  }, [redoStack.length])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key.toLowerCase() !== 'z') return

      e.preventDefault()
      if (e.shiftKey) {
        handleRedo()
      } else {
        handleUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleUndo, handleRedo])

  // ── Feature 3: Search/Filter ──
  const [searchQuery, setSearchQuery] = useState('')

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups
    const q = searchQuery.trim().toLowerCase()
    return groups.reduce<NavGroupConfig[]>((acc, group) => {
      const groupTitleMatch = resolveLabel(group.title, lang, fallbackLang).toLowerCase().includes(q)
      const matchingItems = group.items.filter((item) =>
        resolveLabel(item.label, lang, fallbackLang).toLowerCase().includes(q),
      )
      // Show group if its title matches or any items match
      if (groupTitleMatch || matchingItems.length > 0) {
        acc.push({
          ...group,
          items: groupTitleMatch ? group.items : matchingItems,
        })
      }
      return acc
    }, [])
  }, [groups, searchQuery, lang, fallbackLang])

  // Initialize groups from loaded layout
  React.useEffect(() => {
    if (isLoaded && layout.length > 0 && !initialized) {
      setGroups(cloneGroups(layout))
      setInitialized(true)
    }
  }, [isLoaded, layout, initialized])

  const showToast = useCallback((message: string, isError: boolean = false) => {
    setToast({ message, isError, visible: true })
    setTimeout(() => setToast((prev) => ({ ...prev, visible: false })), 2500)
  }, [])

  // ── Feature 4: Import/Export ──
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Feature 6: Discover all available routes ──
  const [isDiscovering, setIsDiscovering] = useState(false)

  const handleDiscover = useCallback(async () => {
    setIsDiscovering(true)
    try {
      const res = await fetch('/api/admin-nav/discover')
      if (!res.ok) {
        showToast(t('plugin-admin-nav:discoverError'), true)
        return
      }
      const data = await res.json()
      const discoveredGroups: NavGroupConfig[] = data.groups || []

      // Collect all existing item hrefs for dedup
      const existingHrefs = new Set<string>()
      for (const g of groups) {
        for (const item of g.items) {
          existingHrefs.add(item.href)
        }
      }

      // Find new items and merge them into existing or new groups
      let addedCount = 0
      const newGroups = cloneGroups(groups)

      for (const dGroup of discoveredGroups) {
        const newItems = dGroup.items.filter((item) => !existingHrefs.has(item.href))
        if (newItems.length === 0) continue

        // Try to find an existing group with same id
        const existingGroup = newGroups.find((g) => g.id === dGroup.id)
        if (existingGroup) {
          existingGroup.items.push(...newItems)
        } else {
          // Create new group with discovered items
          newGroups.push({ ...dGroup, items: newItems })
        }
        addedCount += newItems.length
      }

      if (addedCount > 0) {
        setGroupsWithUndo(newGroups)
        showToast(t('plugin-admin-nav:discoverSuccess').replace('{{count}}', String(addedCount)))
      } else {
        showToast(t('plugin-admin-nav:discoverNone'))
      }
    } catch {
      showToast(t('plugin-admin-nav:discoverError'), true)
    } finally {
      setIsDiscovering(false)
    }
  }, [groups, setGroupsWithUndo, showToast, t])

  const handleExport = useCallback(() => {
    const data = JSON.stringify(groups, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'nav-config.json'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [groups])

  const handleImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string)
          if (!isValidNavConfig(parsed)) {
            showToast(t('plugin-admin-nav:importError'), true)
            return
          }
          setGroupsWithUndo(parsed)
          showToast(t('plugin-admin-nav:importSuccess'))
        } catch {
          showToast(t('plugin-admin-nav:importError'), true)
        }
        // Reset file input so same file can be re-imported
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
      reader.readAsText(file)
    },
    [showToast, t, setGroupsWithUndo],
  )

  // ── DnD sensors & collision ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Custom collision detection: groups only collide with groups, items with items
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const activeId = args.active.id as string

    // Only filter when dragging groups — items use default closestCenter
    if (activeId.startsWith('group-')) {
      const groupContainers = args.droppableContainers.filter(
        (container) => (container.id as string).startsWith('group-'),
      )
      if (groupContainers.length > 0) {
        return closestCenter({ ...args, droppableContainers: groupContainers })
      }
    }

    return closestCenter(args)
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

      setGroupsWithUndo((prev) => {
        const oldIndex = prev.findIndex((g) => g.id === activeGroupId)
        const newIndex = prev.findIndex((g) => g.id === overGroupId)
        if (oldIndex === -1 || newIndex === -1) return prev
        return arrayMove(prev, oldIndex, newIndex)
      })
      return
    }

    // Item reordering (within same group or cross-group)
    if (activeStr.startsWith('item-') && overStr.startsWith('item-')) {
      const activeData = active.data?.current as { groupId?: string; item?: NavItemConfig } | undefined
      const overData = over.data?.current as { groupId?: string; item?: NavItemConfig } | undefined

      if (!activeData?.groupId || !overData?.groupId) return

      const fromGroupId = activeData.groupId
      const toGroupId = overData.groupId
      const activeItemId = activeData.item?.id
      const overItemId = overData.item?.id

      if (!activeItemId || !overItemId) return

      setGroupsWithUndo((prev) => {
        const newGroups = cloneGroups(prev)

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
  }, [setGroupsWithUndo])

  // ── Group actions ──

  const toggleGroupVisibility = useCallback((groupId: string) => {
    setGroupsWithUndo((prev) => prev.map((g) =>
      g.id === groupId ? { ...g, visible: g.visible === false ? true : false } : g
    ))
  }, [setGroupsWithUndo])

  const deleteGroup = useCallback((groupId: string) => {
    if (!window.confirm(t('plugin-admin-nav:deleteGroupConfirm'))) return
    setGroupsWithUndo((prev) => prev.filter((g) => g.id !== groupId))
  }, [t, setGroupsWithUndo])

  const saveEditedGroup = useCallback((group: NavGroupConfig) => {
    setGroupsWithUndo((prev) => {
      const exists = prev.find((g) => g.id === group.id)
      if (exists) {
        return prev.map((g) => g.id === group.id ? { ...g, title: group.title, defaultCollapsed: group.defaultCollapsed } : g)
      }
      // New group
      return [...prev, group]
    })
    setEditingGroup(null)
    setIsCreatingGroup(false)
  }, [setGroupsWithUndo])

  // ── Item actions ──

  const toggleItemVisibility = useCallback((groupId: string, itemId: string) => {
    setGroupsWithUndo((prev) => prev.map((g) => {
      if (g.id !== groupId) return g
      return {
        ...g,
        items: g.items.map((item) =>
          item.id === itemId ? { ...item, visible: item.visible === false ? true : false } : item
        ),
      }
    }))
  }, [setGroupsWithUndo])

  const deleteItem = useCallback((groupId: string, itemId: string) => {
    setGroupsWithUndo((prev) => prev.map((g) => {
      if (g.id !== groupId) return g
      return { ...g, items: g.items.filter((item) => item.id !== itemId) }
    }))
  }, [setGroupsWithUndo])

  const saveEditedItem = useCallback((item: NavItemConfig, groupId?: string) => {
    const targetGroupId = groupId || editingItem?.groupId
    if (!targetGroupId) return

    setGroupsWithUndo((prev) => prev.map((g) => {
      if (g.id !== targetGroupId) return g
      const exists = g.items.find((i) => i.id === item.id)
      if (exists) {
        return { ...g, items: g.items.map((i) => i.id === item.id ? item : i) }
      }
      return { ...g, items: [...g.items, item] }
    }))

    setEditingItem(null)
    setIsCreatingItem(null)
  }, [editingItem, setGroupsWithUndo])

  // ── Feature 5: Bulk Show/Hide ──

  const showAll = useCallback(() => {
    setGroupsWithUndo((prev) =>
      prev.map((g) => ({
        ...g,
        visible: true,
        items: g.items.map((item) => ({ ...item, visible: true })),
      })),
    )
  }, [setGroupsWithUndo])

  const hideAll = useCallback(() => {
    setGroupsWithUndo((prev) =>
      prev.map((g) => ({
        ...g,
        visible: false,
        items: g.items.map((item) => ({ ...item, visible: false })),
      })),
    )
  }, [setGroupsWithUndo])

  // ── Save / Reset ──

  const handleSave = useCallback(async () => {
    const success = await save(groups)
    showToast(success ? t('plugin-admin-nav:savedSuccess') : t('plugin-admin-nav:saveError'), !success)
  }, [groups, save, showToast, t])

  const handleReset = useCallback(async () => {
    if (!window.confirm(t('plugin-admin-nav:resetConfirm'))) return
    const success = await reset()
    if (success) {
      setInitialized(false) // Will reload from layout
      setUndoStack([])
      setRedoStack([])
      showToast(t('plugin-admin-nav:resetSuccess'))
    } else {
      showToast(t('plugin-admin-nav:resetError'), true)
    }
  }, [reset, showToast, t])

  // ── Render ──

  if (!isLoaded) {
    return (
      <div style={containerStyle}>
        <p style={{ color: 'var(--theme-elevation-400)', fontSize: 14 }}>{t('plugin-admin-nav:loading')}</p>
      </div>
    )
  }

  // Use filtered groups for display, but full groups for DnD IDs and saving
  const displayGroups = searchQuery.trim() ? filteredGroups : groups
  const groupIds = displayGroups.map((g) => `group-${g.id}`)

  // Resolve the label for the drag overlay
  const getOverlayLabel = (): string => {
    if (!activeId) return ''
    if (activeId.startsWith('group-')) {
      const group = groups.find((g) => g.id === activeId.replace('group-', ''))
      return group ? resolveLabel(group.title, lang, fallbackLang) : activeId
    }
    for (const g of groups) {
      for (const item of g.items) {
        if (`item-${g.id}-${item.id}` === activeId) {
          return resolveLabel(item.label, lang, fallbackLang)
        }
      }
    }
    return activeId
  }

  const isSearching = searchQuery.trim().length > 0

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>{t('plugin-admin-nav:customizeTitle')}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {isCustom && (
            <button onClick={handleReset} style={btnSecondary} disabled={isSaving}>
              {t('plugin-admin-nav:reset')}
            </button>
          )}
          <button onClick={handleSave} style={btnPrimary} disabled={isSaving}>
            {isSaving ? t('plugin-admin-nav:saving') : t('plugin-admin-nav:save')}
          </button>
        </div>
      </div>

      {/* Hint */}
      <p style={{ fontSize: 12, color: 'var(--theme-elevation-500)', marginBottom: 16 }}>
        {t('plugin-admin-nav:dndHint')}
      </p>

      {/* Toolbar: Undo/Redo, Bulk actions, Import/Export */}
      <div style={toolbarStyle}>
        {/* Undo / Redo */}
        <button
          onClick={handleUndo}
          style={undoStack.length > 0 ? btnSmall : btnSmallDisabled}
          disabled={undoStack.length === 0}
          title="Ctrl+Z"
        >
          {t('plugin-admin-nav:undo')} ({undoStack.length})
        </button>
        <button
          onClick={handleRedo}
          style={redoStack.length > 0 ? btnSmall : btnSmallDisabled}
          disabled={redoStack.length === 0}
          title="Ctrl+Shift+Z"
        >
          {t('plugin-admin-nav:redo')} ({redoStack.length})
        </button>

        {/* Separator */}
        <span style={{ width: 1, height: 20, backgroundColor: 'var(--theme-elevation-200)', margin: '0 4px' }} />

        {/* Bulk show/hide */}
        <button onClick={showAll} style={btnSmall}>
          {t('plugin-admin-nav:showAll')}
        </button>
        <button onClick={hideAll} style={btnSmall}>
          {t('plugin-admin-nav:hideAll')}
        </button>

        {/* Separator */}
        <span style={{ width: 1, height: 20, backgroundColor: 'var(--theme-elevation-200)', margin: '0 4px' }} />

        {/* Discover */}
        <button
          onClick={handleDiscover}
          style={isDiscovering ? btnSmallDisabled : { ...btnSmall, backgroundColor: 'var(--theme-elevation-100)' }}
          disabled={isDiscovering}
          title={t('plugin-admin-nav:discoverTooltip')}
        >
          {isDiscovering ? '…' : t('plugin-admin-nav:discover')}
        </button>

        {/* Separator */}
        <span style={{ width: 1, height: 20, backgroundColor: 'var(--theme-elevation-200)', margin: '0 4px' }} />

        {/* Import / Export */}
        <button onClick={handleExport} style={btnSmall}>
          {t('plugin-admin-nav:exportConfig')}
        </button>
        <button onClick={() => fileInputRef.current?.click()} style={btnSmall}>
          {t('plugin-admin-nav:importConfig')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
      </div>

      {/* Search/Filter */}
      <div style={searchContainerStyle}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('plugin-admin-nav:searchItems')}
          style={searchInputStyle}
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} style={btnSmall}>
            {t('plugin-admin-nav:clearSearch')}
          </button>
        )}
      </div>

      {/* No results */}
      {isSearching && displayGroups.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--theme-elevation-400)', textAlign: 'center', padding: '20px 0' }}>
          {t('plugin-admin-nav:noResults')}
        </p>
      )}

      {/* DnD area */}
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          {displayGroups.map((group) => {
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
                {!isSearching && (
                  <div style={{ padding: '4px 8px' }}>
                    <button
                      onClick={() => setIsCreatingItem(group.id)}
                      style={{ ...btnOutline, padding: '4px 8px', fontSize: 11, border: '1px dashed var(--theme-elevation-250)' }}
                    >
                      {t('plugin-admin-nav:addItem')}
                    </button>
                  </div>
                )}
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
              {getOverlayLabel()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add group button */}
      {!isSearching && (
        <button onClick={() => setIsCreatingGroup(true)} style={btnOutline}>
          {t('plugin-admin-nav:addGroup')}
        </button>
      )}

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
            id: crypto.randomUUID(),
            href: '/admin/',
            label: t('plugin-admin-nav:newLink'),
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
