import { convert } from "@asciidoctor/core";
import { buildConvertOptions } from "./includeResolver";
import type { RenderContext } from "../types";

/**
 * Converts AsciiDoc source to HTML, resolving local `include::` directives
 * against the same repository/branch described by `context`.
 */
export async function renderAsciidoc(source: string, context: RenderContext): Promise<string> {
  const result = await convert(source, buildConvertOptions(context));
  return typeof result === "string" ? result : String(result);
}
