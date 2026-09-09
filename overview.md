# AsciiDoc Viewer for Azure Repos

Preview `.adoc` / `.asciidoc` files directly in Azure Repos — the same way
Markdown files get a **Preview** tab, this extension adds one for AsciiDoc.

## Features

- **Preview tab** for `.adoc` and `.asciidoc` files in the Azure Repos file
  view — no extra clicks, no separate hub to navigate to.
- **Local `include::` resolution** — `include::` directives that point to
  other files in the *same repository and branch* are resolved and rendered
  inline, including nested includes.
- Supports common include attributes (`tag`/`tags`, `lines`, `leveloffset`)
  since resolution is handled through Asciidoctor's own include mechanism.
- Circular includes are detected and replaced with a warning instead of
  breaking the preview.
- Rendering happens **entirely client-side** in your browser via
  [Asciidoctor.js](https://asciidoctor.org/docs/asciidoctor.js/) — no data is
  sent to any third-party service. The extension only talks to your own
  Azure DevOps organization (to resolve local includes via the Git REST API).

## What's not (yet) supported

- Includes from other repositories or external URLs (by design — only local,
  same-repo/branch includes are resolved).
- Images referenced via `image::` (planned, see the project's `plan.md`).
- Editing AsciiDoc files (preview only).

## Privacy & Security

This extension does not collect telemetry and does not send your document
content anywhere outside your own Azure DevOps organization. All processing
(Markdown/AsciiDoc-to-HTML conversion) happens in your browser.

## Feedback & Support

Found a bug or have a feature request? Please open an issue on
[GitHub](https://github.com/klab365/asciidoc-viewer-azdevops/issues).

## License

[MIT](https://github.com/klab365/asciidoc-viewer-azdevops/blob/main/LICENSE)
