# ADR 001: Do not add an in-place Azure Repos file preview

## Status

Accepted

## Context

The extension provides an AsciiDoc repository hub and a pull-request tab. We
investigated whether it can instead add an **AsciiDoc Preview** button or tab
beside Azure DevOps' built-in Markdown preview in **Repos > Files**.

Azure DevOps extensions can contribute only to registered contribution points.
The official [Azure DevOps contribution target catalog](https://learn.microsoft.com/azure/devops/extend/reference/targets/overview?view=azure-devops)
lists these Azure Repos integration points:

- `ms.vss-code-web.code-hub-group` for a repository hub;
- `ms.vss-code-web.pr-tabs` for pull-request tabs;
- `ms.vss-code-web.source-grid-item-menu`,
  `ms.vss-code-web.source-tree-item-menu`, and
  `ms.vss-code-web.source-item-menu` for source-file context-menu actions.

It does not provide a target for a file viewer, file preview, editor tab, or
an extension of the native Markdown preview.

The Microsoft extension sample repository contains a
`ms.vss-code-web.code-editor-contribution` example. Its public
`ICodeEditorContributionEndpoints` API only supports registering Monaco
languages and JSON schemas; it provides no API to replace the editor or add a
rendered preview pane.

## Decision

Do not attempt to inject an AsciiDoc preview into the native Azure Repos file
viewer or Markdown preview UI.

Keep the existing repository hub as the viewer for arbitrary repository files
and the existing pull-request tab for changed AsciiDoc files in a PR.

If faster navigation from **Repos > Files** is needed, add a supported source
item context-menu action, such as **Open in AsciiDoc Viewer**, which opens the
existing hub with repository, version, and path preselected.

## Consequences

### Positive

- Uses documented, supported Azure DevOps extension APIs.
- Avoids relying on private DOM structures or unsupported contribution IDs.
- Avoids breakage when Azure DevOps changes its built-in file viewer.
- Retains branch selection, repository browsing, includes, images, and diagram
  rendering in the existing viewer.

### Negative

- The experience is not an inline replacement for Azure DevOps' Markdown
  preview.
- Opening an AsciiDoc file requires navigating to the hub (or a future
  context-menu action) rather than switching a native preview tab.

## Revisit

Reconsider this decision if Microsoft publishes a supported Azure Repos
contribution point for custom file viewers or preview tabs.
