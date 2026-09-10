# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Added

- Branch picker in the hub toolbar, so a file can be previewed from any
  branch of the selected repository, not just its default branch.

### Fixed

- Scale down oversized images so they never render wider than the page.

## [1.0.1] - 2026-09-09

### Fixed

- Include Marketplace screenshots as addressable VSIX assets so they render in
  the extension overview.
- Simplify the Marketplace description.

## [1.0.0] - 2026-09-09

### Added

- Dedicated Azure Repos hub for browsing and rendering AsciiDoc files.
- Recursive local `include::` resolution with cycle detection.
- Repository-backed block-image rendering, including support for `:imagesdir:`.
- Image-file previews and direct PlantUML (`.puml` / `.plantuml`) previews.
- Diagram rendering for PlantUML, Mermaid, GraphViz, and other Kroki-supported
  diagram blocks.
- Syntax highlighting for common source languages.
- Light- and dark-theme admonition styling.
- Collapsible repository file tree and automatic repository detection from the
  Azure DevOps breadcrumb.
- Updated hub and Marketplace icons.
- Published the extension publicly on the Visual Studio Marketplace.
- Updated documentation to reflect the current hub-based experience,
  capabilities, and diagram-rendering privacy considerations.
