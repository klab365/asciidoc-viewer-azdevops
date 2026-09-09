import { Extensions } from "@asciidoctor/core";
import type { PreprocessorReader } from "@asciidoctor/core";
import { getRepoFileContent } from "../services/gitService";
import { dirnameOf, resolveRepoRelativePath, type RenderContext } from "../types";
import { registerDiagramExtensions } from "./diagramExtension";

/**
 * `PreprocessorReader` tracks the directory of the file currently being read
 * in a property named `_dir` at runtime (verified experimentally against
 * `@asciidoctor/core@4.0.11`). It is not part of the public `.d.ts` typings,
 * so we access it through this narrow helper instead of sprinkling `as any`
 * across the file.
 */
function currentIncludeDir(reader: PreprocessorReader): string | undefined {
  return (reader as unknown as { _dir?: string })._dir;
}

const UNRESOLVED_PLACEHOLDER = (target: string): string =>
  `[WARNING]\n====\nCould not resolve local include: \`${target}\`. Only includes that point to files in the same repository/branch are supported.\n====\n`;

const CIRCULAR_PLACEHOLDER = (path: string): string =>
  `[WARNING]\n====\nCircular include detected for \`${path}\` — stopped to avoid an infinite loop.\n====\n`;

/**
 * Registers a custom Asciidoctor IncludeProcessor that resolves
 * `include::target[]` directives against files in the same Azure Repos
 * repository/branch as the file currently being previewed, plus block
 * processors that render PlantUML/Mermaid/GraphViz/... diagram blocks via
 * Kroki / mermaid.ink (see {@link registerDiagramExtensions}).
 *
 * Must be used together with the `base_dir` and `attributes.docfile` convert
 * options (see {@link buildConvertOptions}) — without them, the directory of
 * the very first level of includes cannot be determined correctly.
 */
export function createIncludeExtensionRegistry(context: RenderContext) {
  const mainFileDir = dirnameOf(context.filePath);
  const registry = Extensions.create();

  registerDiagramExtensions(registry);

  registry.includeProcessor(function (this: { process: (fn: IncludeProcessFn) => void }) {
    this.process(async (_doc, reader, target, attributes) => {
      const baseDir = currentIncludeDir(reader) || mainFileDir;
      const resolved = resolveRepoRelativePath(baseDir, target);

      if (resolved === null) {
        reader.pushInclude(UNRESOLVED_PLACEHOLDER(target), `${baseDir}/${target}`, target, 1, attributes);
        return;
      }

      const ancestors = [...reader.includeStack.map((entry) => entry[1]), reader.file].filter(
        (value): value is string => typeof value === "string"
      );
      if (ancestors.includes(resolved)) {
        reader.pushInclude(CIRCULAR_PLACEHOLDER(resolved), resolved, resolved, 1, attributes);
        return;
      }

      const content = await getRepoFileContent(context, resolved);
      if (content === null) {
        reader.pushInclude(UNRESOLVED_PLACEHOLDER(target), resolved, resolved, 1, attributes);
        return;
      }

      reader.pushInclude(content, resolved, resolved, 1, attributes);
    });
  });

  return registry;
}

/** Convert options required for the include processor to resolve paths correctly. */
export function buildConvertOptions(context: RenderContext) {
  return {
    safe: "safe" as const,
    base_dir: dirnameOf(context.filePath),
    attributes: { docfile: context.filePath },
    extension_registry: createIncludeExtensionRegistry(context)
  };
}

type IncludeProcessFn = (
  doc: unknown,
  reader: PreprocessorReader,
  target: string,
  attributes: Record<string, string>
) => void | Promise<void>;
