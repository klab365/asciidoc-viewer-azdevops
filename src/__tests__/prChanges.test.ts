import { describe, expect, it } from "vitest";
import {
  adocFileEntriesFromChanges,
  commitForPullRequest,
  latestIterationId,
  type PullRequestChangeLike
} from "../prTab/prChanges";

function change(path: string, changeType: number, isFolder = false): PullRequestChangeLike {
  return { changeType, item: { path, isFolder } };
}

describe("adocFileEntriesFromChanges", () => {
  it("keeps added/edited .adoc and .asciidoc files", () => {
    const entries = adocFileEntriesFromChanges([
      change("/docs/main.adoc", 1), // Add
      change("/docs/notes.asciidoc", 2) // Edit
    ]);

    expect(entries).toEqual([
      { path: "/docs/main.adoc", kind: "adoc" },
      { path: "/docs/notes.asciidoc", kind: "adoc" }
    ]);
  });

  it("ignores deleted files", () => {
    const entries = adocFileEntriesFromChanges([change("/docs/removed.adoc", 16)]);
    expect(entries).toEqual([]);
  });

  it("ignores non-AsciiDoc files and folders", () => {
    const entries = adocFileEntriesFromChanges([
      change("/docs/readme.md", 1),
      change("/docs", 1, true),
      change("/docs/image.png", 1)
    ]);
    expect(entries).toEqual([]);
  });

  it("ignores changes without an item", () => {
    const entries = adocFileEntriesFromChanges([{ changeType: 1 }]);
    expect(entries).toEqual([]);
  });

  it("de-duplicates by path and sorts alphabetically", () => {
    const entries = adocFileEntriesFromChanges([
      change("/docs/zeta.adoc", 2),
      change("/docs/alpha.adoc", 2),
      change("/docs/alpha.adoc", 4)
    ]);
    expect(entries.map((e) => e.path)).toEqual(["/docs/alpha.adoc", "/docs/zeta.adoc"]);
  });
});

describe("commitForPullRequest", () => {
  it("prefers the source commit", () => {
    const commit = commitForPullRequest({
      lastMergeSourceCommit: { commitId: "source-sha" },
      lastMergeTargetCommit: { commitId: "target-sha" }
    });
    expect(commit).toBe("source-sha");
  });

  it("falls back to the target commit when there is no source commit", () => {
    const commit = commitForPullRequest({ lastMergeTargetCommit: { commitId: "target-sha" } });
    expect(commit).toBe("target-sha");
  });

  it("returns null when neither commit is available", () => {
    expect(commitForPullRequest({})).toBeNull();
  });
});

describe("latestIterationId", () => {
  it("returns the highest iteration id", () => {
    expect(latestIterationId([{ id: 1 }, { id: 3 }, { id: 2 }])).toBe(3);
  });

  it("returns null for an empty list", () => {
    expect(latestIterationId([])).toBeNull();
  });

  it("ignores entries without an id", () => {
    expect(latestIterationId([{}, { id: 5 }])).toBe(5);
  });
});
