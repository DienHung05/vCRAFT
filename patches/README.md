# Dependency patches

## MikroORM SQL 7.2.5

MySQL 8.4 returns escaped quotes and charset introducers in `information_schema.check_constraints`.
The schema comparator also removes literal quotes before protecting dots from alias normalization.
Together these make the username regex CHECK appear different from the entity after every migration.

The patch unescapes introspected MySQL CHECK quotes and preserves quoted charset literals during
comparison. It does not change the CHECK expression or weaken database validation.

Keep the existing schema round-trip and username constraint tests green on both database drivers
when updating MikroORM. Remove this patch once the upstream version handles these expressions:

```sh
DB_DRIVER=mysql pnpm --filter @vcraft/api test:integration test/integration/outbox-event.integration.test.ts test/integration/username-db.integration.test.ts
DB_DRIVER=postgresql pnpm --filter @vcraft/api test:integration test/integration/outbox-event.integration.test.ts test/integration/username-db.integration.test.ts
```
