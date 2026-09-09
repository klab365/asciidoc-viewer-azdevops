import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { RenderContext } from "../types";

vi.mock("../services/gitService", () => ({
  getRepoFileContent: vi.fn(async () => null)
}));

const { renderAsciidoc } = await import("../renderer/asciidocRenderer");

function contextFor(filePath: string): RenderContext {
  return { projectId: "proj", repositoryId: "repo", version: "main", filePath };
}

describe("diagram rendering", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renders a plantuml block via Kroki", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("https://kroki.io/plantuml/svg");
      return new Response("<svg>plantuml-diagram</svg>", { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const source = "= Doc\n\n[plantuml]\n----\n@startuml\nAlice -> Bob\n@enduml\n----\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain("<svg>plantuml-diagram</svg>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders a mermaid block via mermaid.ink", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toMatch(/^https:\/\/mermaid\.ink\/svg\//);
      return new Response("<svg>mermaid-diagram</svg>", { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const source = "= Doc\n\n[mermaid]\n----\ngraph TD; A-->B;\n----\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain("<svg>mermaid-diagram</svg>");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("renders a graphviz/dot block via Kroki", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe("https://kroki.io/graphviz/svg");
      return new Response("<svg>graphviz-diagram</svg>", { status: 200 });
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const source = "= Doc\n\n[dot]\n----\ndigraph { A -> B }\n----\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain("<svg>graphviz-diagram</svg>");
  });

  it("shows a warning block instead of crashing when the diagram service fails", async () => {
    global.fetch = vi.fn(async () => new Response("boom", { status: 500 })) as unknown as typeof fetch;

    const source = "= Doc\n\n[plantuml]\n----\n@startuml\nAlice -> Bob\n@enduml\n----\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html.toLowerCase()).toContain("could not render");
    expect(html.toLowerCase()).toContain("plantuml");
  });
});
