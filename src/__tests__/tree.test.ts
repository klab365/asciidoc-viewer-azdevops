import { describe, expect, it } from "vitest";
import { buildTree, sortedTreeEntries, type TreeFolder } from "../hub/tree";

describe("buildTree", () => {
  it("builds a nested structure from flat paths", () => {
    const tree = buildTree(["/docs/main.adoc", "/docs/chapters/ch1.adoc", "/readme.adoc"]);

    expect(tree.children.has("docs")).toBe(true);
    expect(tree.children.has("readme.adoc")).toBe(true);

    const docs = tree.children.get("docs") as TreeFolder;
    expect(docs.type).toBe("folder");
    expect(docs.children.has("main.adoc")).toBe(true);
    expect(docs.children.has("chapters")).toBe(true);

    const chapters = docs.children.get("chapters") as TreeFolder;
    expect(chapters.type).toBe("folder");
    expect(chapters.children.has("ch1.adoc")).toBe(true);
  });

  it("handles an empty list", () => {
    const tree = buildTree([]);
    expect(tree.children.size).toBe(0);
  });

  it("merges files that share a common folder", () => {
    const tree = buildTree(["/docs/a.adoc", "/docs/b.adoc"]);
    const docs = tree.children.get("docs") as TreeFolder;
    expect(docs.children.size).toBe(2);
  });
});

describe("sortedTreeEntries", () => {
  it("sorts folders before files, then alphabetically", () => {
    const tree = buildTree(["/zeta.adoc", "/alpha/nested.adoc", "/beta.adoc"]);
    const entries = sortedTreeEntries(tree);

    expect(entries.map((e) => e.name)).toEqual(["alpha", "beta.adoc", "zeta.adoc"]);
    expect(entries[0].type).toBe("folder");
  });
});
