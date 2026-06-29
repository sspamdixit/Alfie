---
name: Storage class extension
description: How to safely add methods to DrizzleStorage without breaking TypeScript's implements check.
---

## Rule
Always add new `IStorage` methods **directly inside the `DrizzleStorage` class body**. Never use `Object.assign(DrizzleStorage.prototype, { ... })`.

**Why:** TypeScript's `implements IStorage` check is a compile-time structural check on the class declaration. Methods added via `Object.assign` at runtime are invisible to the type-checker — the class still appears to be missing those methods and TS2420 is emitted even when the methods work fine at runtime.

**How to apply:** When the IStorage interface grows (new tables, new queries), open `server/storage.ts`, add the method signature to the interface, then add the implementation as a regular `async methodName(...) { }` inside the `DrizzleStorage` class. Keep `ensureXxxOnce()` guard functions outside the class as module-level helpers.

## Also: avoid `db.execute()` destructuring
`db.execute(sql\`...\`)` returns `QueryResult<Record<string, unknown>>` which is **not** iterable. Destructuring `const [row] = await db.execute(...)` causes TS2548. Instead use Drizzle's typed `.select({ col: sql<number>\`COUNT(...)\` }).from(table)` which returns a typed array you can safely destructure.
