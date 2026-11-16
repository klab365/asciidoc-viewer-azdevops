import { convert } from "@asciidoctor/core";
import { buildConvertOptions } from "./includeResolver";
import { resolvePendingImages, type PendingImage } from "./imageExtension";
import { renderLatex } from "./latexRenderer";
import { getRepoFileContent } from "../services/gitService";
import { dirnameOf, type RenderContext } from "../types";

/**
 * Converts AsciiDoc source to HTML, resolving local `include::` directives,
 * block and inline image references, and PlantUML/Mermaid/... diagram blocks
 * against the same repository/branch described by `context`.
 */
export async function renderAsciidoc(source: string, context: RenderContext): Promise<string> {
  const folders = dirnameOf(context.filePath).split("/").filter(Boolean);
  const configPaths = ["/.asciidoctorconfig"];
  for (let depth = 1; depth <= folders.length; depth++) {
    configPaths.push(`/${folders.slice(0, depth).join("/")}/.asciidoctorconfig`);
  }
  const configs = new Map<string, string>();
  const contents = await Promise.all(configPaths.map((path) => getRepoFileContent(context, path)));
  for (const [index, path] of configPaths.entries()) {
    const content = contents[index];
    if (content !== null && content !== undefined) {
      configs.set(path, content);
    }
  }
  const configuredSource = [...configs.keys()].map((path) => `include::${path}[]\n`).join("") + source;
  const pendingImages: PendingImage[] = [];
  const result = await convert(configuredSource, buildConvertOptions(context, pendingImages, configs));
  const html = typeof result === "string" ? result : String(result);
  const htmlWithImages = pendingImages.length > 0 ? await resolvePendingImages(html, pendingImages, context) : html;
  return renderLatex(htmlWithImages);
}
