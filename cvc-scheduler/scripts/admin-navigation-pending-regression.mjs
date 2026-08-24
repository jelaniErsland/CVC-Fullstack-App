import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");

const [indicatorSource, navSource, shellSource] = await Promise.all([
  read("components/AdminNavigationPendingIndicator.tsx"),
  read("components/AdminNav.tsx"),
  read("components/AdminShell.tsx"),
]);

assert.match(indicatorSource, /^"use client";/);
assert.match(indicatorSource, /useLinkStatus/);
assert.match(indicatorSource, /aria-hidden="true"/);
assert.match(indicatorSource, /data-navigation-pending/);
assert.match(indicatorSource, /motion-reduce:transition-none/);
assert.match(indicatorSource, /motion-safe:animate-pulse/);
assert.doesNotMatch(indicatorSource, /setTimeout|setInterval|fetch\(|supabase|auth\.|router\.(push|replace|refresh)/i);

for (const source of [navSource, shellSource]) {
  assert.match(source, /AdminNavigationPendingIndicator/);
  assert.doesNotMatch(source, /prefetch=\{false\}/);
  assert.doesNotMatch(source, /window\.location|location\.href|router\.(push|replace|refresh)/);
}

assert.match(navSource, /<AdminNavigationPendingIndicator disabled=\{active === item\.id\} \/>/);
assert.match(shellSource, /<AdminNavigationPendingIndicator compact disabled=\{active\} \/>/);
assert.match(shellSource, /<AdminNavigationPendingIndicator disabled=\{isActive\} \/>/);

for (const route of [
  "app/admin/dashboard/page.tsx",
  "app/admin/tasks/page.tsx",
  "app/admin/calendar/page.tsx",
  "app/admin/volunteers/page.tsx",
  "app/admin/needs-attention/page.tsx",
]) {
  const source = await read(route);
  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.match(source, /export const revalidate = 0/);
  assert.match(source, /export const fetchCache = "force-no-store"/);
}

await assert.rejects(access(path.join(root, "app", "admin", "layout.tsx")));
await assert.rejects(access(path.join(root, "app", "admin", "loading.tsx")));

console.log("Admin navigation pending feedback checks passed.");
