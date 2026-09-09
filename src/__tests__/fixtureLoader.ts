import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const FIXTURES_ROOT = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

/**
 * Reads a fixture `.adoc` file from `src/__tests__/fixtures`, addressed by its
 * repo-relative path (e.g. `/docs/main.adoc` -> `fixtures/docs/main.adoc`).
 * Returns `null` if the file doesn't exist, matching the real
 * `getRepoFileContent` contract for unresolved includes.
 */
export function readFixture(repoRelativePath: string): string | null {
  const relative = repoRelativePath.replace(/^\//, "");
  const fullPath = join(FIXTURES_ROOT, relative);
  if (!existsSync(fullPath)) {
    return null;
  }
  return readFileSync(fullPath, "utf-8");
}
