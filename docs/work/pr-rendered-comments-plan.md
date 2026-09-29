# Plan: Kommentare in der gerenderten PR-Ansicht

## Ziel

Reviewer können in der **AsciiDoc**-PR-Ansicht einen Kommentar an einem gerenderten Block erstellen; dieser wird als nativer Azure-DevOps-PR-Thread gespeichert und ist auch in der normalen PR-Diff-Ansicht sichtbar.

## Ansatz

Die Extension bleibt ein eigenständiger `ms.vss-web.tab`. Sie kann deshalb keine nativen Azure-DevOps-Kommentar-Controls in ihr gerendertes HTML einbetten. Stattdessen ergänzt sie die Vorschau um eigene, zugängliche Kommentar-Aktionen und verwendet `GitRestClient.createThread`, um normale PR-Threads mit Datei- und Quellzeilenposition anzulegen.

Die zuverlässige Zuordnung von Render-Blöcken zu AsciiDoc-Quellzeilen ist die zentrale Voraussetzung. Sie wird zunächst mit einem technischen Spike validiert. Der produktive Weg soll beim Rendern stabile Metadaten (Dateipfad sowie Start-/Endzeile) an kommentierbare Blockelemente ausgeben. Für Inhalte aus `include::` muss der Pfad der inkludierten Datei verwendet werden, nicht zwangsläufig der Pfad des geöffneten Hauptdokuments.

## Schritte

1. **Azure-DevOps-Thread-API und Positionsmodell validieren** — Einen kleinen, nicht auslieferbaren Spike erstellen oder lokal gegen ein Test-PR prüfen, welche `CommentThread`- und `CommentPosition`-Felder die verwendete API-Version erwartet.
   - Dateien: ggf. temporäres lokales Testskript (nicht committen); `package.json` nur falls ein Test-Hilfsmittel erforderlich ist.
   - Prüfen: `GitRestClient.createThread(repositoryId, pullRequestId, thread, projectId)`, erforderliche Schreibberechtigung, `threadContext.filePath`, rechte Diff-Seite (`rightFileStart`/`rightFileEnd`), Zeilenindexierung sowie Iterationskontext.
   - Erfolgskriterium: Ein erzeugter Thread erscheint im Azure-DevOps-PR-Diff an der erwarteten Quellzeile.

2. **Rendering-Provenienz entwerfen und implementieren** — Die Render-Pipeline so erweitern, dass kommentierbare AsciiDoc-Blöcke mit stabilen Quellmetadaten markiert werden.
   - Dateien: `src/renderer/asciidocRenderer.ts`, `src/renderer/includeResolver.ts`, neue Dateien unter `src/renderer/` (z. B. `commentAnchors.ts`), ggf. `src/types.ts`.
   - Die Markierungen sollen mindestens `data-comment-file-path`, `data-comment-start-line` und optional `data-comment-end-line` liefern; sie dürfen keinen nutzerkontrollierten HTML-Inhalt unsicher einfügen.
   - Include-Dateien, verschachtelte Includes, Dokumenttitel und Blöcke ohne zuverlässige Herkunft explizit behandeln. Nicht eindeutig zuordenbare Elemente erhalten keine Kommentar-Aktion.
   - Risiko: Asciidoctor.js liefert nicht für alle erzeugten HTML-Elemente eine dokumentierte Source-Location. Falls die Extension-API keine ausreichenden Metadaten bereitstellt, ist ein eigener, positionsbewahrender Vorverarbeitungsschritt für kommentierbare Blockgrenzen nötig.

3. **Kommentar-Domain und API-Adapter kapseln** — Einen testbaren Adapter zum Laden und Erstellen von PR-Threads ergänzen.
   - Dateien: neue Dateien unter `src/prTab/` (z. B. `commentThreads.ts`, `commentTypes.ts`), `src/prTab/index.ts`.
   - Den Adapter von DOM-Code trennen und Eingaben validieren: PR-, Repository- und Projekt-ID, Datei innerhalb des Repositories, positive Zeilennummern sowie nicht leerer, begrenzter Kommentartext.
   - Neue Threads mit einer initialen Text-Kommentarnachricht und dem im Spike bestätigten Positions-/Iterationskontext erstellen.

4. **Berechtigung und Manifest aktualisieren** — Die zum Erstellen von PR-Kommentaren erforderliche OAuth-Berechtigung deklarieren und die Änderung dokumentieren.
   - Dateien: `vss-extension.json`, `README.md`, ggf. `CHANGELOG.md`.
   - `vso.code_write` zusätzlich zu bzw. anstelle der bisherigen Leseberechtigung gemäß Azure-DevOps-Dokumentation anfordern.
   - Hinweis: Bestehende Installationen müssen nach einer Scope-Änderung die aktualisierten Berechtigungen akzeptieren.

5. **Kommentar-Interaktion in der gerenderten PR-Vorschau einbauen** — An gültigen, mit Metadaten versehenen Blöcken eine Hover-/Fokus-Aktion „Kommentar hinzufügen“ bereitstellen und einen Editor anzeigen.
   - Dateien: `src/prTab/index.ts`, neue Datei unter `src/prTab/` (z. B. `renderedComments.ts`), `src/pages/pr-tab.html`, neue oder bestehende Styles unter `src/prTab/` bzw. `src/renderer/styles/main.css`.
   - Der Editor enthält Absenden, Abbrechen, Lade- und Fehlermeldungen. Während des Speicherns darf kein doppelter Thread erzeugt werden.
   - Bedienung per Tastatur, sichtbarer Fokus, passende ARIA-Labels und Azure-DevOps-Light-/Dark-Theme berücksichtigen.
   - Bei Dateiwahl oder erneuter Vorschau alte Listener und Editorzustände sauber entfernen.

6. **Bestehende Threads in der Vorschau anzeigen** — Threads für die aktuelle PR laden, nach Datei und Quellzeilenbereich den Ankern zuordnen und sichtbar markieren.
   - Dateien: `src/prTab/commentThreads.ts`, `src/prTab/renderedComments.ts`, `src/prTab/index.ts`.
   - Mindestens Thread-Status, Autor, Zeit und Kommentare darstellen; nach erfolgreichem Erstellen lokal aktualisieren.
   - Threads ohne genaue Zuordnung (z. B. allgemeine PR-Kommentare, linke/alte Diff-Seite oder entfernte Zeilen) nicht falsch an einen Render-Block hängen; stattdessen ausblenden oder in einer klar getrennten Liste darstellen.

7. **Automatisierte Tests ergänzen** — Zuordnung, Thread-Payloads und UI-Zustände absichern.
   - Dateien: neue Tests unter `src/__tests__/`, insbesondere für Anchor-Erzeugung, Include-Herkunft und Thread-Payloads; bestehende Renderer-Tests bei Bedarf erweitern.
   - Testfälle: einfacher Absatz/Überschrift, mehrere Blöcke, verschachtelte Includes, nicht zuordenbarer Inhalt, API-Fehler, leerer Kommentar, Erfolg und Verhinderung von Doppelsendungen.
   - API-Aufrufe und Asciidoctor-Abhängigkeiten mocken; keine echten Azure-DevOps-Zugriffe in Unit-Tests.

8. **Qualität, Build und manuelle PR-Prüfung durchführen** — Die Erweiterung bauen und in einer Testorganisation gegen einen realen PR prüfen.
   - Dateien: keine vorgesehenen Produktionsänderungen; bei Befunden gezielte Nachbesserungen in den obigen Dateien.
   - Ausführen: `npm run lint`, `npm test`, `npm run build`.
   - Manuell prüfen: Thread-Erstellung und -Anzeige, Standard-Diff-Verknüpfung, Dateien mit Includes, Berechtigungszustimmung, Fehlerfall sowie Light/Dark Theme.

## Abhängigkeiten zwischen den Schritten

- Schritt 1 entscheidet die exakten Thread-Felder und muss vor Schritt 3 abgeschlossen sein.
- Schritt 2 muss vor der UI-Umsetzung in Schritt 5 abgeschlossen sein, weil die UI ausschließlich auf belastbaren Quellankern arbeiten darf.
- Schritt 4 muss vor der manuellen End-to-End-Prüfung abgeschlossen sein.
- Schritt 6 baut auf dem in Schritt 3 definierten Thread-Modell und den Ankern aus Schritt 2 auf.

## Nicht im Umfang

- Kommentare in der Repository-Hub-Vorschau außerhalb eines PR.
- Bearbeiten, Auflösen oder Löschen von Threads in der Render-Ansicht.
- Exakte Inline-Kommentierung einzelner Wörter oder Zeichenbereiche.
- Kommentarverankerung an Diagramm-SVG-Inhalte oder Bilder ohne Quellblock.
- Synchronisation von bereits erstellten Threads nach späteren, die Zeilen verschiebenden PR-Updates über die von Azure DevOps bereitgestellte Thread-Nachverfolgung hinaus.

## Offene Fragen

1. Sollen Kommentare nur für die rechte (aktuelle) PR-Seite erzeugt werden, oder soll eine Gegenüberstellung mit der Zielbranch-Version unterstützt werden?
2. Soll die erste Version nur neue Kommentare anlegen oder auch alle vorhandenen Threads im Renderer anzeigen? Der Plan enthält beides, aber die Anzeige kann bei Bedarf als zweiter Auslieferungsschritt erfolgen.
3. Welche Blockarten sollen kommentierbar sein: nur Absätze und Überschriften oder auch Tabellen, Listen, Admonitions und Quellcodeblöcke?
4. Liefert die eingesetzte Asciidoctor.js-Version ausreichend zuverlässige Source-Locations für Include-Dateien? Dies ist das entscheidende Ergebnis des Spikes.

## Geschätzte Komplexität

**Groß** — neben einer neuen Schreibberechtigung und Azure-DevOps-Thread-Integration erfordert die Funktion eine robuste, include-fähige Abbildung von gerendertem HTML auf AsciiDoc-Quellzeilen.
