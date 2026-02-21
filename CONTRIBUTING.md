# Contributing to @consilioweb/admin-nav

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/pOwn3d/payload-nav-studio.git
cd payload-nav-studio
pnpm install
pnpm build
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm build` | Build with tsup (ESM + CJS + types) |
| `pnpm typecheck` | TypeScript type checking |

## Project Structure

```
src/
├── index.ts              # Server entry (plugin, types, icons)
├── client.ts             # Client entry (React components)
├── views.ts              # Server views entry
├── plugin.ts             # Payload plugin registration
├── types.ts              # TypeScript type definitions
├── icons.ts              # 70+ inline SVG icon registry
├── collections/          # Payload collections
│   └── AdminNavPreferences.ts
├── endpoints/            # REST API handlers
│   └── preferences.ts
├── hooks/                # React hooks
│   └── useNavPreferences.ts
├── components/           # React components
│   ├── AdminNav.tsx
│   ├── NavCustomizer.tsx
│   ├── SortableGroup.tsx
│   ├── SortableItem.tsx
│   ├── GroupEditor.tsx
│   ├── NavItemEditor.tsx
│   └── IconPicker.tsx
└── views/                # Admin views
    ├── NavCustomizerView.tsx
    └── NavCustomizerViewClient.tsx
```

## Guidelines

- **TypeScript** — Strict mode, no `any` unless necessary
- **Zero runtime dependencies** — Only peer deps and bundled @dnd-kit
- **Backward compatibility** — Don't remove or rename existing exports
- **Payload theme** — Use CSS variables (`var(--theme-*)`) for all styling

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Run `pnpm build`
5. Commit using [conventional commits](https://www.conventionalcommits.org/)
6. Open a Pull Request

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
