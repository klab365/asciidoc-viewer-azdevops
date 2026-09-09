import type { Extensions, AbstractBlock, Document } from "@asciidoctor/core";
import { getRepoBinaryContent } from "../services/gitService";
import { resolveRepoRelativePath, type RenderContext } from "../types";

export interface PendingImage {
  placeholder: string;
  resolvedPath: string;
}

const MIME_TYPES: Record<string, string> = {
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon"
};

export function mimeTypeFor(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME_TYPES[extension] ?? "application/octet-stream";
}

function isAbsoluteUrl(target: string): boolean {
  return /^([a-z][a-z0-9+.-]*:)?\/\//i.test(target) || target.startsWith("data:");
}

/**
 * Registers a TreeProcessor that finds all block-level `image::target[]`
 * macros in the parsed document (including ones from included files — each
 * node's `sourceLocation.dir` correctly reflects the directory of whichever
 * file it actually came from, verified experimentally) and rewrites their
 * `target` attribute to a unique placeholder string.
 *
 * The placeholders are collected into `pendingImages` so the caller (see
 * `asciidocRenderer.ts`) can resolve them to data URIs *after* conversion —
 * fetching images requires async Git REST calls, which don't fit well inside
 * a synchronous tree walk, and doing the fetches after conversion also
 * naturally de-duplicates repeated images.
 *
 * Only block images (`image::foo.png[]` on its own line) are supported —
 * inline images (`image:foo.png[]` within a paragraph) are resolved lazily
 * during HTML conversion and aren't visible to a TreeProcessor, so they
 * still show as broken links. See plan.md for this known limitation.
 */
export function registerImageExtension(
  registry: ReturnType<typeof Extensions.create>,
  mainFileDir: string,
  pendingImages: PendingImage[]
): void {
  registry.treeProcessor(function (this: { process: (fn: (doc: Document) => Document) => void }) {
    this.process((doc) => {
      let counter = 0;

      // `:imagesdir:` is applied by Asciidoctor while producing the HTML,
      // so it must also be applied before looking up repository files.
      const imagesDir = doc.getAttribute("imagesdir") as string | undefined;

      const visit = (block: AbstractBlock): void => {
        if (block.getContext?.() === "image") {
          const target = block.getAttribute("target") as string | undefined;
          if (target && !isAbsoluteUrl(target) && !isAbsoluteUrl(imagesDir ?? "")) {
            const location = block.getSourceLocation?.();
            const baseDir = location?.dir || mainFileDir;
            const targetWithImagesDir = target.startsWith("/") || !imagesDir ? target : `${imagesDir}/${target}`;
            const resolved = resolveRepoRelativePath(baseDir, targetWithImagesDir);
            if (resolved) {
              const placeholder = `asciidoc-viewer-image-placeholder-${counter++}`;
              block.setAttribute("target", placeholder, true);
              pendingImages.push({ placeholder, resolvedPath: resolved });
            }
          }
        }
        for (const child of block.getBlocks?.() ?? []) {
          visit(child);
        }
      };

      visit(doc);
      return doc;
    });
  });
}

/** Fetches each pending image and replaces its placeholder in `html` with a `data:` URI. */
export async function resolvePendingImages(
  html: string,
  pendingImages: PendingImage[],
  context: RenderContext
): Promise<string> {
  let result = html;
  const contentByPath = new Map<string, Promise<ArrayBuffer | null>>();

  await Promise.all(
    pendingImages.map(async ({ placeholder, resolvedPath }) => {
      let content = contentByPath.get(resolvedPath);
      if (!content) {
        content = getRepoBinaryContent(context, resolvedPath);
        contentByPath.set(resolvedPath, content);
      }

      const bytes = await content;
      const replacement =
        bytes === null
          ? `data:image/svg+xml;utf8,${encodeURIComponent(brokenImagePlaceholderSvg(resolvedPath))}`
          : `data:${mimeTypeFor(resolvedPath)};base64,${arrayBufferToBase64(bytes)}`;

      // Asciidoctor prepends its default `images/` directory to a local
      // target. Replacing only the placeholder would leave `images/data:…`,
      // which the browser treats as a relative URL. Replace the whole src
      // value so both successful images and fallback SVGs are valid data URIs.
      result = result.replace(new RegExp(`(src=")[^"]*${placeholder}[^"]*(")`, "g"), `$1${replacement}$2`);
    })
  );

  return result;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function brokenImagePlaceholderSvg(path: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60"><rect width="100%" height="100%" fill="#fdecea"/><text x="8" y="35" font-family="sans-serif" font-size="12" fill="#b30000">Could not load image: ${path}</text></svg>`;
}
