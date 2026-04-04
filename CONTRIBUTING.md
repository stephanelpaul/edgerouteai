# Contributing to EdgeRouteAI

## Adding a New Provider

1. Create `packages/core/src/adapters/<provider>.ts` implementing `ProviderAdapter`
2. Add tests in `tests/core/adapters/<provider>.test.ts`
3. Register in `packages/core/src/adapters/registry.ts`
4. Add provider config to `packages/shared/src/providers.ts`
5. Add model configs to `packages/shared/src/models.ts`
6. Add pricing to `packages/shared/src/pricing.ts`

## Development

```bash
pnpm install      # Install dependencies
pnpm dev          # Start all dev servers
pnpm test         # Run tests
pnpm lint         # Check lint + format
pnpm lint:fix     # Auto-fix lint + format
pnpm typecheck    # Type check all packages
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation
- `ci:` CI/CD changes
- `refactor:` code refactoring
- `test:` adding or updating tests
- `chore:` maintenance

## Code Style

- Biome for linting and formatting (run `pnpm lint:fix`)
- Strict TypeScript
- Tab indentation, single quotes
