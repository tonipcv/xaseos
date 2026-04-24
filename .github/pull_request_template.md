## Summary

<!-- Briefly describe what this PR changes and why. -->

Closes # (issue)

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change (existing behaviour changes)
- [ ] Refactor / chore
- [ ] Documentation update

## How has this been tested?

- [ ] Unit tests added / updated (`npm run test`)
- [ ] Manually tested locally (`npm run dev`)
- [ ] E2E tests pass (`npm run test:e2e`)

## Checklist

- [ ] CI passes (lint + typecheck + tests + build)
- [ ] No `.env` or secrets committed
- [ ] If DB schema changed: SQL added to `scripts/migrate.sql` (idempotent, no `prisma migrate`)
- [ ] If a new API route: added to the OpenAPI spec / README API table
- [ ] No new `console.log` statements (use `logger` from `@/lib/logger`)

## Screenshots (if UI change)

<!-- Add before/after screenshots or a short Loom video -->
