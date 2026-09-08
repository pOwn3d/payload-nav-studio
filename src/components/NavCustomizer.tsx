'use client'

import React, { useState, useCallback, useId, useEffect, useRef, useMemo, useReducer } from 'react'
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
import { useAuth } from '@payloadcms/ui'
import { cacheOwnerKey, useNavPreferences, DEFAULT_BASE_PATH } from '../hooks/useNavPreferences.js'
import { SortableGroup } from './SortableGroup.js'
import { SortableItem } from './SortableItem.js'
import { GroupEditor } from './GroupEditor.js'
import { NavItemEditor } from './NavItemEditor.js'
import { usePluginTranslation } from '../hooks/usePluginTranslation.js'
import type { NavGroupConfig, NavItemConfig } from '../types.js'
import { isSafeHref, resolveLabel } from '../utils.js'

// ── Constants ──

const MAX_UNDO_STACK = 20

// ── Helpers ──

/** Deep clone a NavGroupConfig array */
function cloneGroups(groups: NavGroupConfig[]): NavGroupConfig[] {
  return JSON.parse(JSON.stringify(groups))
}

/**
 * Validate that a JSON value looks like a valid NavGroupConfig[].
 *
 * Mirrors the server-side validator: an imported file that omits `icon` or
 * nests unchecked children crashes the sidebar (`item.icon.startsWith('#')`),
 * and an unsafe href would only be rejected later, on save.
 */
function isValidNavEntry(value: unknown, depth: number): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entry = value as Partial<NavItemConfig>
  if (typeof entry.id !== 'string' || entry.id.length === 0) return false
  if (typeof entry.href !== 'string' || !isSafeHref(entry.href)) return false
  if (typeof entry.icon !== 'string') return false
  if (entry.label === undefined || entry.label === null) return false
  if (entry.children !== undefined && entry.children !== null) {
    if (!Array.isArray(entry.children) || depth >= 2) return false
    if (entry.children.length > 50) return false
    if (!entry.children.every((child) => isValidNavEntry(child, depth + 1))) return false
  }
  return true
}

function isValidNavConfig(data: unknown): data is NavGroupConfig[] {
  if (!Array.isArray(data)) return false
  return data.every(
    (g) =>
      typeof g === 'object' &&
      g !== null &&
      typeof g.id === 'string' &&
      g.title !== undefined &&
      Array.isArray(g.items) &&
      g.items.every((i: unknown) => isValidNavEntry(i, 1)),
  )
}

// ── Undo/Redo Reducer ──

type NavState = {
  groups: NavGroupConfig[]
  undoStack: NavGroupConfig[][]
  redoStack: NavGroupConfig[][]
}

type NavAction =
  | { type: 'SET_GROUPS'; groups: NavGroupConfig[] }
  | { type: 'INIT'; groups: NavGroupConfig[] }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' }

const initialNavState: NavState = {
  groups: [],
  undoStack: [],
  redoStack: [],
}

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'SET_GROUPS': {
      const newUndoStack = [...state.undoStack, cloneGroups(state.groups)]
      if (newUndoStack.length > MAX_UNDO_STACK) newUndoStack.shift()
      return {
        groups: action.groups,
        undoStack: newUndoStack,
        redoStack: [],
      }
    }
    case 'INIT':
      // Initialize without pushing to undo stack
      return { ...state, groups: action.groups }
    case 'UNDO': {
      if (state.undoStack.length === 0) return state
      const newUndoStack = [...state.undoStack]
      const snapshot = newUndoStack.pop()!
      const newRedoStack = [...state.redoStack, cloneGroups(state.groups)]
      if (newRedoStack.length > MAX_UNDO_STACK) newRedoStack.shift()
      return {
        groups: snapshot,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      }
    }
    case 'REDO': {
      if (state.redoStack.length === 0) return state
      const newRedoStack = [...state.redoStack]
      const snapshot = newRedoStack.pop()!
      const newUndoStack = [...state.undoStack, cloneGroups(state.groups)]
      if (newUndoStack.length > MAX_UNDO_STACK) newUndoStack.shift()
      return {
        groups: snapshot,
        undoStack: newUndoStack,
        redoStack: newRedoStack,
      }
    }
    case 'RESET':
      return initialNavState
    default:
      return state
  }
}

/**
 * NavCustomizer — Full drag & drop navigation editor.
 * Allows reordering groups and items, toggling visibility,
 * editing labels/icons/URLs, creating new groups/items.
 * Features: undo/redo, search/filter, import/export, bulk show/hide.
 */
export const NavCustomizer: React.FC<{ basePath?: string }> = ({ basePath = DEFAULT_BASE_PATH }) => {
  const { t, i18n } = usePluginTranslation()
  // Same viewer-scoped cache as the sidebar — see AdminNav.
  const { user } = useAuth()
  const { layout, isLoaded, isSaving, isCustom, save, reset } = useNavPreferences(
    basePath,
    cacheOwnerKey(user),
  )
  const [navState, dispatch] = useReducer(navReducer, initialNavState)
  const { groups, undoStack, redoStack } = navState
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

  // ── Undo/Redo via reducer ──

  /** Wrapper that dispatches SET_GROUPS (with undo tracking) */
  const setGroupsWithUndo = useCallback(
    (updater: NavGroupConfig[] | ((prev: NavGroupConfig[]) => NavGroupConfig[])) => {
      // For functional updaters, we need current groups — read from ref
      if (typeof updater === 'function') {
        // Use a callback pattern: dispatch the result
        dispatch({ type: 'SET_GROUPS', groups: updater(navState.groups) })
      } else {
        dispatch({ type: 'SET_GROUPS', groups: updater })
      }
    },
    [navState.groups],
  )

  const handleUndo = useCallback(() => {
    dispatch({ type: 'UNDO' })
  }, [])

  const handleRedo = useCallback(() => {
    dispatch({ type: 'REDO' })
  }, [])

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
      dispatch({ type: 'INIT', groups: cloneGroups(layout) })
      setInitialized(true)
    }
  }, [isLoaded, layout, initialized])

  // ── beforeunload guard ──
  useEffect(() => {
    const hasChanges = JSON.stringify(groups) !== JSON.stringify(layout)
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    if (hasChanges) window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [groups, layout])

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
      const res = await fetch(`${basePath}/discover`)
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

      // Reject files larger than 1MB to prevent abuse
      if (file.size > 1024 * 1024) {
        showToast(t('plugin-admin-nav:importError'), true)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

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
      dispatch({ type: 'RESET' })
      showToast(t('plugin-admin-nav:resetSuccess'))
    } else {
      showToast(t('plugin-admin-nav:resetError'), true)
    }
  }, [reset, showToast, t])

  // ── Render ──

  if (!isLoaded) {
    return (
      <div className="admin-nav-customizer">
        <p className="admin-nav-customizer__no-results">{t('plugin-admin-nav:loading')}</p>
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
    <div className="admin-nav-customizer">
      {/* Header */}
      <div className="admin-nav-customizer__header">
        <h1 className="admin-nav-customizer__title">{t('plugin-admin-nav:customizeTitle')}</h1>
        <div className="admin-nav-customizer__actions">
          {isCustom && (
            <button onClick={handleReset} className="admin-nav-btn--secondary" disabled={isSaving}>
              {t('plugin-admin-nav:reset')}
            </button>
          )}
          <button onClick={handleSave} className="admin-nav-btn--primary" disabled={isSaving}>
            {isSaving ? t('plugin-admin-nav:saving') : t('plugin-admin-nav:save')}
          </button>
        </div>
      </div>

      {/* Hint */}
      <p className="admin-nav-customizer__hint">
        {t('plugin-admin-nav:dndHint')}
      </p>

      {/* Toolbar: Undo/Redo, Bulk actions, Import/Export */}
      <div className="admin-nav-customizer__toolbar">
        {/* Undo / Redo */}
        <button
          onClick={handleUndo}
          className="admin-nav-btn--small"
          disabled={undoStack.length === 0}
          title="Ctrl+Z"
        >
          {t('plugin-admin-nav:undo')} ({undoStack.length})
        </button>
        <button
          onClick={handleRedo}
          className="admin-nav-btn--small"
          disabled={redoStack.length === 0}
          title="Ctrl+Shift+Z"
        >
          {t('plugin-admin-nav:redo')} ({redoStack.length})
        </button>

        {/* Separator */}
        <span className="admin-nav-customizer__separator" />

        {/* Bulk show/hide */}
        <button onClick={showAll} className="admin-nav-btn--small">
          {t('plugin-admin-nav:showAll')}
        </button>
        <button onClick={hideAll} className="admin-nav-btn--small">
          {t('plugin-admin-nav:hideAll')}
        </button>

        {/* Separator */}
        <span className="admin-nav-customizer__separator" />

        {/* Discover */}
        <button
          onClick={handleDiscover}
          className={isDiscovering ? 'admin-nav-btn--small' : 'admin-nav-btn--small-discover'}
          disabled={isDiscovering}
          title={t('plugin-admin-nav:discoverTooltip')}
        >
          {isDiscovering ? '...' : t('plugin-admin-nav:discover')}
        </button>

        {/* Separator */}
        <span className="admin-nav-customizer__separator" />

        {/* Import / Export */}
        <button onClick={handleExport} className="admin-nav-btn--small">
          {t('plugin-admin-nav:exportConfig')}
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="admin-nav-btn--small">
          {t('plugin-admin-nav:importConfig')}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="admin-nav-file-input--hidden"
          // Visually hidden and driven by the button above, but still a real
          // focusable control: without a name it announces as "file upload".
          aria-label={t('plugin-admin-nav:importConfig')}
          onChange={handleImport}
        />
      </div>

      {/* Search/Filter */}
      <div className="admin-nav-customizer__search">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('plugin-admin-nav:searchItems')}
          // The placeholder is not a name — it vanishes the moment the field is
          // filled, which is exactly when the user needs it announced.
          aria-label={t('plugin-admin-nav:searchItems')}
          className="admin-nav-customizer__search-input"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="admin-nav-btn--small">
            {t('plugin-admin-nav:clearSearch')}
          </button>
        )}
      </div>

      {/* No results */}
      {isSearching && displayGroups.length === 0 && (
        <p className="admin-nav-customizer__no-results">
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
                  <div className="admin-nav-customizer__add-item-wrap">
                    <button
                      onClick={() => setIsCreatingItem(group.id)}
                      className="admin-nav-btn--outline-sm"
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
            <div className="admin-nav-customizer__drag-overlay">
              {getOverlayLabel()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Add group button */}
      {!isSearching && (
        <button onClick={() => setIsCreatingGroup(true)} className="admin-nav-btn--outline">
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
      <div className={[
        'admin-nav-toast',
        toast.visible && 'admin-nav-toast--visible',
        toast.isError ? 'admin-nav-toast--error' : 'admin-nav-toast--success',
      ].filter(Boolean).join(' ')}>
        {toast.message}
      </div>
    </div>
  )
}

export default NavCustomizer
