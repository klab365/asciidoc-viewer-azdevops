import { describe, expect, it } from "vitest";
import { buildTree, sortedTreeEntries, type TreeFolder, type FileEntry } from "../hub/tree";

function adoc(path: string): FileEntry {
  return { path, kind: "adoc" };
}

function image(path: string): FileEntry {
  return { path, kind: "image" };
}

describe("buildTree", () => {
  it("builds a nested structure from flat paths", () => {
    const tree = buildTree([adoc("/docs/main.adoc"), adoc("/docs/chapters/ch1.adoc"), adoc("/readme.adoc")]);

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
    const tree = buildTree([adoc("/docs/a.adoc"), adoc("/docs/b.adoc")]);
    const docs = tree.children.get("docs") as TreeFolder;
    expect(docs.children.size).toBe(2);
  });

  it("preserves each file's kind", () => {
    const tree = buildTree([adoc("/docs/main.adoc"), image("/docs/diagram.svg")]);
    const docs = tree.children.get("docs") as TreeFolder;
    const mainFile = docs.children.get("main.adoc");
    const imageFile = docs.children.get("diagram.svg");

    expect(mainFile?.type).toBe("file");
    expect(imageFile?.type).toBe("file");
    if (mainFile?.type === "file") expect(mainFile.kind).toBe("adoc");
    if (imageFile?.type === "file") expect(imageFile.kind).toBe("image");
  });
});

describe("sortedTreeEntries", () => {
  it("sorts folders before files, then alphabetically", () => {
    const tree = buildTree([adoc("/zeta.adoc"), adoc("/alpha/nested.adoc"), adoc("/beta.adoc")]);
    const entries = sortedTreeEntries(tree);

    expect(entries.map((e) => e.name)).toEqual(["alpha", "beta.adoc", "zeta.adoc"]);
    expect(entries[0].type).toBe("folder");
  });
});
