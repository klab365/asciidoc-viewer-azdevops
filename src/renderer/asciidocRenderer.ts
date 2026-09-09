import { convert } from "@asciidoctor/core";
import { buildConvertOptions } from "./includeResolver";
import { resolvePendingImages, type PendingImage } from "./imageExtension";
import type { RenderContext } from "../types";

/**
 * Converts AsciiDoc source to HTML, resolving local `include::` directives,
 * block-level `image::` references, and PlantUML/Mermaid/... diagram blocks
 * against the same repository/branch described by `context`.
 */
export async function renderAsciidoc(source: string, context: RenderContext): Promise<string> {
  const pendingImages: PendingImage[] = [];
  const result = await convert(source, buildConvertOptions(context, pendingImages));
  const html = typeof result === "string" ? result : String(result);
  return pendingImages.length > 0 ? resolvePendingImages(html, pendingImages, context) : html;
}
