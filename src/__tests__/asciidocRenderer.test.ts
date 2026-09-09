import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RenderContext } from "../types";

const files = new Map<string, string>([
  ["/docs/main.adoc", "= Main\n\ninclude::chapters/ch1.adoc[]\n\ninclude::chapters/ch2.adoc[leveloffset=+1]\n"],
  ["/docs/chapters/ch1.adoc", "== Chapter 1\n\ninclude::snippets/note.adoc[]\n"],
  ["/docs/chapters/ch2.adoc", "= Chapter 2 (offset)\n\nSome text.\n"],
  ["/docs/chapters/snippets/note.adoc", "NOTE: nested include content\n"],
  ["/docs/cyclic-a.adoc", "= A\n\ninclude::cyclic-b.adoc[]\n"],
  ["/docs/cyclic-b.adoc", "== B\n\ninclude::cyclic-a.adoc[]\n"]
]);

vi.mock("../services/gitService", () => ({
  getRepoFileContent: vi.fn(async (_context: RenderContext, path: string) => files.get(path) ?? null)
}));

const { renderAsciidoc } = await import("../renderer/asciidocRenderer");

function contextFor(filePath: string): RenderContext {
  return { projectId: "proj", repositoryId: "repo", version: "main", filePath };
}

describe("renderAsciidoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves nested local includes and keeps section structure", async () => {
    const html = await renderAsciidoc(files.get("/docs/main.adoc")!, contextFor("/docs/main.adoc"));

    expect(html).toContain("Chapter 1");
    expect(html).toContain("nested include content");
    expect(html).toContain("Chapter 2 (offset)");
    expect(html).toContain("Some text.");
  });

  it("applies leveloffset attribute from the include directive", async () => {
    const html = await renderAsciidoc(files.get("/docs/main.adoc")!, contextFor("/docs/main.adoc"));

    // ch2.adoc is a level-0 (`=`) document; leveloffset=+1 should demote it to <h2>.
    expect(html).toMatch(/<h2[^>]*>Chapter 2 \(offset\)<\/h2>/);
  });

  it("replaces circular includes with a warning instead of looping forever", async () => {
    const html = await renderAsciidoc(files.get("/docs/cyclic-a.adoc")!, contextFor("/docs/cyclic-a.adoc"));

    expect(html.toLowerCase()).toContain("circular include detected");
  });

  it("replaces unresolvable includes with a warning placeholder", async () => {
    const source = "= Main\n\ninclude::does-not-exist.adoc[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html.toLowerCase()).toContain("could not resolve local include");
  });

  it("does not attempt to resolve absolute-URL includes locally", async () => {
    const source = "= Main\n\ninclude::https://example.com/remote.adoc[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html.toLowerCase()).toContain("could not resolve local include");
  });
});
