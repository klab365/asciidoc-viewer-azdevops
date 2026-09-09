import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RenderContext } from "../types";

vi.mock("../services/gitService", () => ({
  getRepoFileContent: vi.fn(async () => null),
  getRepoBinaryContent: vi.fn(async (_context: RenderContext, path: string) => {
    if (path === "/docs/diagram.svg") {
      return new TextEncoder().encode("<svg>fake</svg>").buffer;
    }
    return null;
  })
}));

const { renderAsciidoc } = await import("../renderer/asciidocRenderer");

function contextFor(filePath: string): RenderContext {
  return { projectId: "proj", repositoryId: "repo", version: "main", filePath };
}

describe("block image resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces a block image's src with a data URI fetched from the repo", async () => {
    const source = "= Doc\n\nimage::diagram.svg[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;base64,');
    expect(html).not.toContain('src="diagram.svg"');
  });

  it("shows a broken-image placeholder when the image can't be fetched", async () => {
    const source = "= Doc\n\nimage::missing.png[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain("Could%20not%20load%20image");
  });

  it("leaves absolute image URLs untouched", async () => {
    const source = "= Doc\n\nimage::https://example.com/pic.png[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="https://example.com/pic.png"');
  });
});
