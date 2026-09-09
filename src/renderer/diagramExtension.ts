import type { Extensions, BlockProcessorDslInterface, AbstractBlock, Reader } from "@asciidoctor/core";

/**
 * AsciiDoc block names (as used in `[name]` before a delimited block) mapped
 * to their diagram-rendering strategy. Most are rendered via Kroki
 * (https://kroki.io) with the block name used as-is for the Kroki diagram
 * type path segment. `mermaid` is special-cased to use mermaid.ink instead —
 * Kroki's public instance proxies Mermaid through a headless-browser
 * companion service that reliably times out (verified: PlantUML/GraphViz
 * respond in ~1s via Kroki, Mermaid via Kroki never responds within 40s in
 * testing); mermaid.ink is a dedicated, reliable public service for exactly
 * this diagram type.
 */
const KROKI_DIAGRAM_TYPES: Record<string, string> = {
  plantuml: "plantuml",
  c4plantuml: "c4plantuml",
  graphviz: "graphviz",
  dot: "graphviz",
  ditaa: "ditaa",
  blockdiag: "blockdiag",
  seqdiag: "seqdiag",
  actdiag: "actdiag",
  nwdiag: "nwdiag",
  packetdiag: "packetdiag",
  rackdiag: "rackdiag",
  d2: "d2",
  structurizr: "structurizr",
  svgbob: "svgbob",
  nomnoml: "nomnoml",
  wavedrom: "wavedrom",
  vega: "vega",
  vegalite: "vegalite",
  bytefield: "bytefield",
  excalidraw: "excalidraw",
  pikchr: "pikchr"
};

const DIAGRAM_BLOCK_NAMES = [...Object.keys(KROKI_DIAGRAM_TYPES), "mermaid"];

async function renderViaKroki(krokiType: string, source: string): Promise<string> {
  const response = await fetch(`https://kroki.io/${krokiType}/svg`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: source
  });
  if (!response.ok) {
    throw new Error(`Kroki returned HTTP ${response.status}`);
  }
  return response.text();
}

async function renderMermaidViaMermaidInk(source: string): Promise<string> {
  const encoded = base64UrlEncode(source);
  const response = await fetch(`https://mermaid.ink/svg/${encoded}`);
  if (!response.ok) {
    throw new Error(`mermaid.ink returned HTTP ${response.status}`);
  }
  return response.text();
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function warningBlockHtml(diagramName: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `[WARNING]\n====\nCould not render \`${diagramName}\` diagram: ${message}\n====\n`;
}

/** Registers PlantUML/Mermaid/GraphViz/... diagram block processors (via Kroki / mermaid.ink) on the given registry. */
export function registerDiagramExtensions(registry: ReturnType<typeof Extensions.create>): void {
  for (const blockName of DIAGRAM_BLOCK_NAMES) {
    registry.block(blockName, function (this: BlockProcessorDslInterface) {
      this.onContext("listing", "literal");
      const asyncProcess = async (parent: AbstractBlock, reader: Reader, attrs: Record<string, unknown>) => {
        const source = reader.getLines().join("\n");
        try {
          const svg =
            blockName === "mermaid"
              ? await renderMermaidViaMermaidInk(source)
              : await renderViaKroki(KROKI_DIAGRAM_TYPES[blockName], source);
          return this.createPassBlock(parent, svg, attrs);
        } catch (error) {
          console.error(`[asciidoc-viewer] Failed to render ${blockName} diagram`, error);
          return this.createBlock(parent, "pass", warningBlockHtml(blockName, error), attrs);
        }
      };
      // @asciidoctor/core's BlockProcessorDslInterface.process() types the
      // callback as synchronous, but the engine (verified experimentally,
      // same as IncludeProcessor — see includeResolver.ts) correctly awaits
      // an async callback's returned Promise. Cast to satisfy the stricter
      // published type.
      this.process(asyncProcess as unknown as Parameters<BlockProcessorDslInterface["process"]>[0]);
    });
  }
}
