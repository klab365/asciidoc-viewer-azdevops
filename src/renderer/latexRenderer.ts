import katex from "katex";
import "katex/dist/katex.min.css";

/** Decodes the HTML escaping applied by Asciidoctor before passing LaTeX to KaTeX. */
function decodeHtmlEntities(value: string): string {
  return value.replace(/&(?:#x[\da-f]+|#\d+|amp|apos|quot|lt|gt|nbsp);/gi, (entity) => {
    const name = entity.slice(1, -1).toLowerCase();
    if (name.startsWith("#x")) return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    if (name.startsWith("#")) return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    return { amp: "&", apos: "'", quot: '"', lt: "<", gt: ">", nbsp: "\u00a0" }[name] ?? entity;
  });
}

function renderFormula(source: string, displayMode: boolean): string {
  return katex.renderToString(decodeHtmlEntities(source), {
    displayMode,
    throwOnError: false,
    trust: false
  });
}

/**
 * Replaces the LaTeX delimiters emitted by Asciidoctor's `latexmath` and
 * `stem: latexmath` support with KaTeX markup. This runs after conversion so
 * Asciidoctor still handles substitutions and escaping in the usual way.
 */
export function renderLatex(html: string): string {
  return html
    .replace(/\\\[([\s\S]*?)\\\]/g, (_match, source: string) => renderFormula(source, true))
    .replace(/\\\(([\s\S]*?)\\\)/g, (_match, source: string) => renderFormula(source, false));
}
