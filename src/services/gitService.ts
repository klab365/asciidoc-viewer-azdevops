import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git";
import type { RenderContext } from "../types";

/**
 * Fetches the raw text content of a file from the same repo/branch described
 * by `context`, at the given repo-relative `path` (leading slash).
 *
 * Returns `null` if the file cannot be found or read (caller decides how to
 * surface that, e.g. as an unresolved-include placeholder).
 */
export async function getRepoFileContent(context: RenderContext, path: string): Promise<string | null> {
  await SDK.ready();
  const client = getClient(GitRestClient);

  try {
    const stream = await client.getItemContent(
      context.repositoryId,
      path,
      context.projectId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { versionType: 0, versionOptions: 0, version: versionNameFrom(context.version) }
    );
    return await streamToString(stream);
  } catch (error) {
    console.warn(`[asciidoc-viewer] Could not load include "${path}"`, error);
    return null;
  }
}

/**
 * Fetches the raw binary content of a file from the same repo/branch
 * described by `context`, at the given repo-relative `path` (leading
 * slash), as an `ArrayBuffer`.
 *
 * Returns `null` if the file cannot be found or read.
 */
export async function getRepoBinaryContent(context: RenderContext, path: string): Promise<ArrayBuffer | null> {
  await SDK.ready();
  const client = getClient(GitRestClient);

  try {
    const stream = await client.getItemContent(
      context.repositoryId,
      path,
      context.projectId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { versionType: 0, versionOptions: 0, version: versionNameFrom(context.version) }
    );
    return stream instanceof Blob ? await stream.arrayBuffer() : stream;
  } catch (error) {
    console.warn(`[asciidoc-viewer] Could not load binary file "${path}"`, error);
    return null;
  }
}

/** Strips the "GB"/"GT"/"GC" prefix Azure DevOps uses internally for branch/tag/commit versions. */
function versionNameFrom(version: string): string {
  return version.replace(/^G[BTC]/, "");
}

async function streamToString(stream: ArrayBuffer | Blob): Promise<string> {
  if (stream instanceof Blob) {
    return stream.text();
  }
  return new TextDecoder("utf-8").decode(stream);
}
