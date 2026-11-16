import { AbstractBlock, Html5Converter, type AbstractNode, type Inline } from "@asciidoctor/core";
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

/** Queues repository images during conversion, including inline images and table cells. */
export function createImageConverter(mainFileDir: string, pendingImages: PendingImage[]): Html5Converter {
  const imageTarget = (node: AbstractNode, target: string): string => {
    const imagesDir = node.getDocument().getAttribute("imagesdir") as string | undefined;
    if (isAbsoluteUrl(target) || isAbsoluteUrl(imagesDir ?? "")) {
      return target;
    }

    const parent = node.getParent();
    const source = node instanceof AbstractBlock ? node : parent instanceof AbstractBlock ? parent : undefined;
    const targetWithImagesDir = target.startsWith("/") || !imagesDir ? target : `${imagesDir}/${target}`;
    const resolvedPath = resolveRepoRelativePath(source?.getSourceLocation()?.dir || mainFileDir, targetWithImagesDir);
    if (resolvedPath === null) {
      console.error("[asciidoc-viewer] Could not resolve repository image path", targetWithImagesDir);
      return target;
    }

    const placeholder = `asciidoc-viewer-image-placeholder-${pendingImages.length}`;
    pendingImages.push({ placeholder, resolvedPath });
    return placeholder;
  };

  return new (class extends Html5Converter {
    override async convert_image(node: AbstractBlock): Promise<string> {
      const target = node.getAttribute("target") as string;
      node.setAttribute("target", imageTarget(node, target), true);
      try {
        return await super.convert_image(node);
      } finally {
        node.setAttribute("target", target, true);
      }
    }

    override async convert_inline_image(node: Inline): Promise<string> {
      const target = node.target;
      if (!target || node.type === "icon") {
        return super.convert_inline_image(node);
      }
      node.target = imageTarget(node, target);
      try {
        return await super.convert_inline_image(node);
      } finally {
        node.target = target;
      }
    }
  })("html5");
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
      result = result.replace(new RegExp(`(src=")[^"]*${placeholder}(")`, "g"), `$1${replacement}$2`);
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
