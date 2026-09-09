import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RenderContext } from "../types";
import { readFixture } from "./fixtureLoader";

vi.mock("../services/gitService", () => ({
  getRepoFileContent: vi.fn(async (_context: RenderContext, path: string) => readFixture(path))
}));

const { renderAsciidoc } = await import("../renderer/asciidocRenderer");

function contextFor(filePath: string): RenderContext {
  return { projectId: "proj", repositoryId: "repo", version: "main", filePath };
}

function mustReadFixture(path: string): string {
  const content = readFixture(path);
  if (content === null) {
    throw new Error(`Missing test fixture: ${path}`);
  }
  return content;
}

describe("renderAsciidoc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves nested local includes and keeps section structure", async () => {
    const source = mustReadFixture("/docs/main.adoc");
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain("Chapter 1");
    expect(html).toContain("nested include content");
    expect(html).toContain("Chapter 2 (offset)");
    expect(html).toContain("Some text.");
  });

  it("applies leveloffset attribute from the include directive", async () => {
    const source = mustReadFixture("/docs/main.adoc");
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    // ch2.adoc is a level-0 (`=`) document; leveloffset=+1 should demote it to <h2>.
    expect(html).toMatch(/<h2[^>]*>Chapter 2 \(offset\)<\/h2>/);
  });

  it("replaces circular includes with a warning instead of looping forever", async () => {
    const source = mustReadFixture("/docs/cyclic-a.adoc");
    const html = await renderAsciidoc(source, contextFor("/docs/cyclic-a.adoc"));

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
