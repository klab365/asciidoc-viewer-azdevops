# Plan: AsciiDoc-Preview als Repo-Datei-Renderer Extension (Azure DevOps)

## Goal
Klickt man in Azure DevOps Repos auf eine `.adoc`-Datei, erscheint (wie bei `.md`)
automatisch ein zusätzlicher **"Preview"-Tab**, der den AsciiDoc-Inhalt als
gerendertes HTML anzeigt. Lokale `include::`-Direktiven (Dateien im selben
Repo) werden dabei aufgelöst und eingebettet.

## Approach
> **Update nach weiterer Recherche:** Der Contribution-Point
> `ms.vss-code-web.content-renderer-collection` (Ziel: die "Preview"-Tab-
> Sammlung in der Azure-Repos-Datei-Ansicht) **existiert wirklich** und ist
> genau das, was wir brauchen — verifiziert anhand des offiziellen
> Microsoft-Samples [`custom-content-renderer`](https://github.com/microsoft/vsts-extension-samples/tree/master/custom-content-renderer).
> (Der zuvor angenommene Name `ms.vss-code-web.file-content-renderer` war
> falsch/erfunden — der echte Contribution-**Typ** ist `ms.vss-web.action`,
> nur das **Ziel** (`targets`) ist `ms.vss-code-web.content-renderer-collection`.)
>
> Damit ist der ursprüngliche Wunsch — Datei anklicken, auf **"Preview"-Tab**
> klicken, gerendertes Dokument sehen, genau wie bei Markdown — direkt
> umsetzbar. Der eingebaute Markdown-Renderer registriert sich vermutlich am
> selben Contribution-Point; unsere Extension registriert sich zusätzlich für
> `.adoc`/`.asciidoc`.
>
> Bekannter Vertrag (aus dem Sample verifiziert):
> ```json
> {
>   "id": "showRenderer",
>   "type": "ms.vss-web.action",
>   "targets": ["ms.vss-code-web.content-renderer-collection"],
>   "properties": {
>     "uri": "render.html",
>     "text": "AsciiDoc Preview",
>     "fileExtensions": ["adoc", "asciidoc"],
>     "title": "ms.vss-code-web.content-renderer-collection"
>   }
> }
> ```
> ```js
> SDK.register(SDK.getContributionId(), () => ({
>   renderContent: (rawContent, options) => { /* ... */ }
> }));
> ```
> Der Host übergibt den Dateiinhalt (`rawContent`) direkt als String — für
> die Hauptdatei brauchen wir also **keinen** eigenen Git-REST-Call. Nur für
> lokale `include::`-Ziele muss weiterhin per Git-API nachgeladen werden.
>
> **Restrisiko:** Das Sample stammt aus 2018 (altes `vss-web-extension-sdk`).
> Die genaue Struktur von `options` (z. B. ob `project`/`repository`/`path`/
> `version` enthalten sind, die wir für die Include-Auflösung brauchen) ist
> nicht weiter dokumentiert und muss zur Laufzeit verifiziert werden
> (`console.log(options)` in einer frühen Testinstallation, siehe Schritt 3
> und 10). Ebenso muss verifiziert werden, dass der Contribution-Point in
> aktuellen Azure DevOps Services noch genauso funktioniert.

Azure DevOps Extensions basieren auf dem **Azure DevOps Extension SDK**
(`azure-devops-extension-sdk` / `azure-devops-extension-api`) + einer
statischen Web-App. AsciiDoc-Rendering erfolgt clientseitig mit
**Asciidoctor.js** (kein Server nötig). Gebaut wird mit **vite**, verpackt als
`.vsix` mit **tfx-cli** — beide als mise-Tools verwaltet.

## Steps

1. **Projekt aufsetzen**
   - Files: `package.json`, `tsconfig.json`, `mise.toml`
   - Node/TypeScript-Projekt.
   - Bibliotheks-Dependencies (via npm, `package.json`):
     `azure-devops-extension-sdk`, `azure-devops-extension-api`,
     `@asciidoctor/core`.
   - Tool- und Task-Management über **mise** (`mise.toml`):
     - `[tools]`: Node-Version fest gepinnt (z. B. `node = "24.20.0"`, nicht
       `"lts"`, damit sich die Version nicht bei einem späteren `mise
       install` stilländ ändert). CLI-Tools wie `tfx-cli` und `vite` werden
       ebenfalls **als mise-Tools** (`"npm:tfx-cli"`, `"npm:vite"`) statt als
       npm-Devdependencies verwaltet — damit sind sie direkt im PATH
       verfügbar, ohne `npx`, und versioniert wie alle anderen Tools.
     - `[tasks]`: `install`, `build` (ruft `vite build` direkt auf),
       `watch`, `package` (ruft `tfx extension create` direkt auf), `lint`,
       `test`, `clean` — einheitlicher Einstiegspunkt über `mise run <task>`.

2. **Extension-Manifest mit Content-Renderer-Contribution**
   - Files: `vss-extension.json`
   - Contribution-Typ `ms.vss-web.action`, Ziel (`targets`):
     `ms.vss-code-web.content-renderer-collection`.
   - Properties: `uri` (Pfad zur Renderer-HTML-Seite), `text` (Label des
     Preview-Eintrags, z. B. "AsciiDoc Preview"), `fileExtensions:
     ["adoc", "asciidoc"]` (ohne Punkt!), `title`.

3. **Renderer-Seite implementieren**
   - Files: `src/renderer/index.html`, `src/renderer/index.ts`
   - `SDK.init()`, dann `SDK.ready()` abwarten, dann
     `SDK.register(SDK.getContributionId(), () => ({ renderContent }))`
     registrieren.
   - `renderContent(rawContent: string, options: unknown)`: Hauptinhalt
     kommt direkt als `rawContent` — kein Git-REST-Call nötig für die
     Hauptdatei.
   - **Wichtig, zuerst verifizieren:** `console.log(options)` in einer
     frühen Testinstallation (Schritt 10 vorziehen für diesen Teil), um zu
     sehen, welche Kontextinfos (`project`, `repository`, `path`, `version`)
     tatsächlich enthalten sind — diese werden für die Include-Auflösung in
     Schritt 4/5 gebraucht. Falls `options` nicht ausreicht, alternativ
     `SDK.getWebContext()` / `SDK.getConfiguration()` prüfen oder Datei-Pfad
     aus der Browser-URL der Host-Seite ableiten (`options` sollte das aber
     nicht nötig machen).

4. **AsciiDoc-Inhalt + Kontext holen**
   - Files: `src/services/contentService.ts`
   - Dateiinhalt sichern, außerdem Kontextinfos für Include-Auflösung:
     `projectId`, `repositoryId`, `version` (Branch/Commit), `filePath`
     (Verzeichnis der aktuellen Datei) — gebündelt in einem
     `RenderContext`-Objekt.
   - Falls Content nicht direkt im `context` enthalten ist: nachladen via
     `GitRestClient.getItemContent()` (`azure-devops-extension-api`).

5. **Lokale Includes auflösen**
   - Files: `src/renderer/includeResolver.ts`, `src/renderer/asciidocRenderer.ts`
   - Ziel: `include::pfad/zu/datei.adoc[]` relativ zum Verzeichnis der
     aktuellen Datei auflösen, Inhalt aus **demselben Repo/Branch** laden.
   - Pfad-Normalisierung (`.`, `..`, führendes `/` = Repo-Root).
   - Nicht-lokale Targets (URLs, andere Repos, absolute externe Pfade) ⇒
     **nicht unterstützt**, stattdessen Platzhalter/Warnung statt Fehler.
   - **Verifizierter Ansatz (durch lokale Tests mit `@asciidoctor/core@4.0.11`
     bestätigt, siehe Risiko-Abschnitt): direkter async `IncludeProcessor`,
     ohne Pre-Resolve-Pass/Cache.** `@asciidoctor/core` v4 ist async-first;
     `IncludeProcessor.process()` darf eine `async`-Funktion sein und wird
     vom Parser korrekt awaitet. Damit kann pro Include direkt per
     Git-REST nachgeladen werden:
     1. `registry.includeProcessor(function () { this.process(async (doc,
        reader, target, attributes) => { ... }) })` registrieren.
     2. Aktuelles Verzeichnis: `const baseDir = reader._dir || mainFileDir;`
        (Achtung: die tatsächliche, zur Laufzeit gesetzte Property heißt
        `_dir`, nicht `dir` — durch Test verifiziert. `mainFileDir` ist der
        Verzeichnisanteil des `RenderContext.filePath` der Hauptdatei, als
        Fallback für den allerersten Aufruf.)
     3. Ziel-Pfad mit `resolveRepoRelativePath(baseDir, target)` normalisieren
        (siehe `src/types.ts`).
     4. **Zyklus-Erkennung:** `const ancestors = [...reader.includeStack.map(e
        => e[1]), reader.file].filter(Boolean); if
        (ancestors.includes(resolved)) { /* Platzhalter statt erneutem Laden */ }`
     5. Inhalt per `getRepoFileContent(context, resolved)` (Git-REST) laden,
        dann `reader.pushInclude(content, resolved, resolved, 1, attributes)`
        aufrufen. Bei `null` (nicht gefunden) bzw. nicht-lokalem Target
        stattdessen einen Platzhaltertext pushen.
   - **Voraussetzung für korrekte Pfadauflösung:** Beim `convert()`-Aufruf
     müssen `base_dir` (= Verzeichnis der Hauptdatei) **und**
     `attributes: { docfile: <voller Pfad der Hauptdatei> }` gesetzt werden,
     sonst bleibt `reader._dir` beim allerersten Include-Aufruf leer/falsch
     (durch Test verifiziert).
   - Asciidoctor wertet dabei `tag=`, `tags=`, `lines=` und `leveloffset=`
     automatisch korrekt aus, da der volle Dateiinhalt unverändert an
     `pushInclude` übergeben wird — keine eigene Attribut-Behandlung nötig.
   - Getestete Randfälle (lokal reproduziert): 2-Ebenen verschachtelte
     Includes mit Section-Überschriften funktionieren korrekt; zirkuläre
     Includes werden erkannt und durch Platzhalter ersetzt statt in eine
     Endlosschleife zu laufen.

6. **Rendering mit Asciidoctor.js**
   - Files: `src/renderer/asciidocRenderer.ts`
   - Aufgelösten Gesamttext (nach Include-Resolution) konvertieren, HTML ins
     DOM einfügen.
   - Basis-CSS (Asciidoctor-Default-Stylesheet) einbinden.

7. **Fehler-/Ladezustände**
   - Files: `src/renderer/index.ts`
   - Spinner während Laden, Fehlermeldungen bei Parse-Fehlern oder nicht
     auflösbaren Includes.

8. **Build & Bundle**
   - Files: `vite.config.ts` (oder `webpack.config.js`)
   - Output-Pfad muss mit `uri` im Manifest übereinstimmen.

9. **Packaging**
   - Files: `mise.toml` (Task `package`)
   - `mise run package` → führt `tfx extension create --manifest-globs
     vss-extension.json` aus (tfx-cli als mise-Tool, direkt im PATH, kein
     `npx` nötig).

10. **Test in Sandbox-Organisation (vor öffentlichem Release)**
    - Extension zunächst privat/nicht gelistet in einer Test-Organisation
      hochladen und installieren (unabhängig vom späteren öffentlichen
      Release — dient nur der Vorab-Validierung).
    - `.adoc`-Datei mit lokalen Includes in einem Test-Repo anklicken, prüfen
      ob **"Preview"-Tab** (analog zu Markdown) erscheint und Includes
      korrekt aufgelöst werden.
    - Iterativ anpassen, da genaues `options`-Datenformat (siehe Schritt 3)
      erst zur Laufzeit sichtbar wird.
    - Erst nach erfolgreichem Test in Schritt 11 öffentlich veröffentlichen.

11. **Polishing & Marketplace-Veröffentlichung (public)**
    - Files: `README.md`, `overview.md` (Marketplace-Beschreibungstext),
      `vss-extension.json` (Metadaten), Icon-Datei (z. B. `images/icon.png`)
    - Da die Extension **öffentlich** veröffentlicht wird (jeder kann sie
      installieren, kein "Share to Organization"), zusätzlich nötig:
      - Publisher-Account im Visual Studio Marketplace Publishing Portal
        anlegen/verifizieren (`publisher`-Feld in `vss-extension.json` muss
        dazu passen).
      - `vss-extension.json`: aussagekräftige `description`, `categories`,
        `tags`, `icons.default`, `content.details` (Markdown-Datei mit
        Feature-Beschreibung, Screenshots) für die Marketplace-Seite.
        (`"public": true` genügt für die öffentliche Sichtbarkeit — tfx
        übersetzt das intern zu `GalleryFlags: ["Public"]`, ein separates
        `galleryFlags`-Feld im Manifest ist nicht nötig; verifiziert anhand
        des `tfs-cli`-Quellcodes.)
      - Lizenz: **MIT** — `LICENSE`-Datei im Repo-Root anlegen (Copyright-
        Zeile mit Name/Jahr), in `vss-extension.json` optional per
        `license`/Content-Verweis ergänzen.
      - `support`/Kontakt-Link und Link zu einem Issue-Tracker (z. B. GitHub)
        angeben — wird von Nutzern erwartet, teils vom Review verlangt.
      - Datenschutz-Hinweis: Extension arbeitet nur lokal im Repo-Kontext,
        sendet keine Daten an Drittsysteme — kurz in Beschreibung erwähnen
        (schafft Vertrauen, ggf. vom Review gefordert).
      - Da öffentlich gelistet: höhere Sorgfalt bei Sicherheitsreview
        (keine Secrets im Bundle, Content-Security-Policy im iframe
        beachten, nur minimal nötige OAuth-Scopes anfragen).
      - Versionierung: `version` in `vss-extension.json` konsequent bei
        jedem Release erhöhen (Marketplace erlaubt kein Re-Upload gleicher
        Version).
      - Erstveröffentlichung durchläuft Marketplace-Review-Prozess (kann
        einige Tage dauern) — zeitlich einplanen.
      - Veröffentlichung selbst: `tfx extension publish` (statt nur
        `create`) oder manueller Upload im Publishing-Portal.
      - Vor dem allerersten echten Release: `"public": false` in
        `vss-extension.json` auf `true` setzen (aktuell bewusst `false`,
        solange nur intern/Sandbox getestet wird).

12. **CI/CD via GitHub Actions**
    - Files: `.github/workflows/ci.yml`, `.github/workflows/cd.yml`
    - **CI (`ci.yml`)**, läuft bei jedem Push/PR auf `main`: Install → Lint
      → Test → Build → `mise run package` als **Dry-Run** (paketiert das
      `.vsix`, um Manifest/Build-Fehler früh zu erkennen, **ohne** zu
      publizieren) → `.vsix` als Artefakt hochladen.
    - **CD (`cd.yml`)**, läuft nur bei einem Git-Tag `vX.Y.Z`: verifiziert,
      dass die Tag-Version exakt mit `package.json`'s `version`-Feld
      übereinstimmt (bricht sonst mit Fehler ab) → Test → Build →
      `tfx extension publish` mit `--override "{\"version\":\"X.Y.Z\"}"`
      (Version aus dem Tag wird ins Manifest übernommen, kein manuelles
      Pflegen der Version in `vss-extension.json` nötig) → veröffentlichtes
      `.vsix` als Artefakt.
    - Benötigt Repo-Secret `MARKETPLACE_PAT` (Personal Access Token mit
      "Marketplace (Publish)"-Scope für den Publisher-Account).
    - **Bewusst kein Auto-Publish bei jedem `main`-Push:** vermeidet
      unkontrollierte Versionsflut und stellt sicher, dass jedes Release
      eine explizite, bewusste Aktion ist (Tag setzen). Release-Workflow:
      `package.json`-Version bumpen → committen → `git tag vX.Y.Z` →
      `git push --tags` → CD-Workflow veröffentlicht automatisch.

## Dependencies between steps
- Schritt 2 (Contribution-Typ) bestimmt, welche Daten in Schritt 3–4
  verfügbar sind — ggf. Anpassung nach ersten Tests in Schritt 10 (iterativ).
- Schritt 4 (Kontext/Pfad) muss vor Schritt 5 (Include-Resolution) stehen.
- Schritt 5 muss vor Schritt 6 (Rendering) abgeschlossen sein.
- Schritt 8 vor Schritt 9.

## Out of scope
- Bearbeiten von AsciiDoc-Dateien
- Includes aus anderen Repos oder externen URLs
- Server-seitiges Rendering
- PDF-Export, Volltextsuche

## Decisions (bereits geklärt)
- **Include-Auflösung:** immer aus demselben Branch/Commit wie die aktuell
  angezeigte Datei (analog zum Verhalten der Markdown-Preview).
- **Veröffentlichung:** **öffentlich im Visual Studio Marketplace** — jeder
  kann die Extension in seiner eigenen Organisation installieren (kein
  "Share to" einzelner Organisationen, sondern öffentliches Listing).
- **Unterstützte Datei-Endungen:** `.adoc` und `.asciidoc`.
- **Lizenz:** MIT — `LICENSE`-Datei im Repo, in `vss-extension.json`
  referenziert.
- **Publisher:** Einzelperson (du selbst) als Marketplace-Publisher —
  registrierte Publisher-ID: **`burak-kizilkaya`** (Name im Portal:
  "burak.kizilkaya"). Das ist die tatsächliche ID im [Marketplace Publishing
  Portal](https://marketplace.visualstudio.com/manage) und **nicht** identisch
  mit dem GitHub-Org-Namen (`klab365`) — beide sind unabhängige Konten.
  `"publisher"` in `vss-extension.json` muss exakt `burak-kizilkaya` sein.
- **Extension-`id` (technisch, in `vss-extension.json`):**
  `asciidoc-viewer-azdevops` — identisch zum GitHub-Repo-Namen, für
  Konsistenz und Wiederauffindbarkeit.
- **Marketplace-`name` (menschenlesbar, im UI angezeigt):** kann kürzer/
  freundlicher sein als die ID, z. B. "AsciiDoc Viewer" — final in Schritt 11
  festlegen.

## Open questions
- Konkrete Publisher-ID (Kurzname) im Marketplace Publishing Portal
  registrieren — welcher Name soll verwendet werden?
- Finaler Marketplace-Anzeigename (`name`-Feld) und Icon — vor Schritt 11
  festlegen.

## Risks
- `options`-Parameter von `renderContent(rawContent, options)` ist nicht
  öffentlich dokumentiert — Struktur muss zur Laufzeit verifiziert werden
  (siehe Schritt 3), bevor Schritt 4/5 (Kontext für Include-Auflösung)
  final umgesetzt werden.
- Referenz-Sample für `content-renderer-collection` stammt aus 2018 (altes
  SDK) — Funktionalität in aktuellen Azure DevOps Services früh (Schritt 10
  vorgezogen) verifizieren, bevor viel Implementierungsaufwand in
  Include-Resolution etc. investiert wird.
- Rekursive Includes bedeuten mehrere sequentielle/parallele REST-Calls beim
  Öffnen der Preview → Performance bei tief verschachtelten Dokumenten im
  Blick behalten.
- Bilder (`image::`) werden aktuell nicht behandelt — relative Bildpfade im
  gerenderten HTML funktionieren im Preview-Kontext vermutlich nicht ohne
  eigene Auflösung (analog zu Includes, als Data-/Blob-URL einbetten).
  Noch nicht eingeplant, ggf. als Folge-Schritt ergänzen.
- **Asciidoctor.js-Versionshinweis:** `@asciidoctor/core` v4 hat eine
  komplett async-first API (`convert()` gibt ein `Promise` zurück, kein
  Opal/Ruby-Transpile mehr). Lokal verifiziert: async `IncludeProcessor` +
  `reader._dir` + `base_dir`/`docfile`-Attribute funktionieren zuverlässig,
  auch bei verschachtelten Includes mit Section-Überschriften. **Wichtig:**
  die ältere v3.x-API (Opal-basiert, synchron) ist mit aktuellem Node
  inkompatibel (`Cannot add property ..., object is not extensible`) —
  nicht auf v3.x zurückwechseln.

## Estimated complexity
Small–Medium — Kern (Contribution registrieren + Asciidoctor.js rendern) ist
überschaubar, jetzt mit verifiziertem Contribution-Point deutlich sicherer;
Hauptunsicherheit liegt in der genauen `options`-Struktur und im Umfang der
Include-Attribut-Unterstützung.

## Status / Progress Log
- [x] Schritt 1: Projekt aufsetzen (`package.json`, `tsconfig.json`, `mise.toml`,
      `vite.config.ts`, `vitest.config.ts`)
- [x] Schritt 2: Manifest mit Contribution (`vss-extension.json`,
      `ms.vss-web.action` → `content-renderer-collection`)
- [x] Schritt 3: Renderer-Seite (`src/renderer/index.ts`,
      `src/renderer/optionsContext.ts`) — `options`-Struktur noch nicht
      gegen echtes Azure DevOps verifiziert (siehe Risks)
- [x] Schritt 4: Inhalt + Kontext holen (`src/services/gitService.ts`,
      `src/types.ts`)
- [x] Schritt 5: Lokale Includes auflösen (`src/renderer/includeResolver.ts`)
      — durch automatisierte Tests abgedeckt (verschachtelt, `leveloffset`,
      Zyklus-Erkennung, nicht auflösbare/externe Includes)
- [x] Schritt 6: Rendering (`src/renderer/asciidocRenderer.ts`)
- [x] Schritt 7: Fehler-/Ladezustände (Basis in `src/renderer/index.ts`:
      Status-Anzeige, Fehlermeldung; Feinschliff optional)
- [x] Schritt 8: Build & Bundle (`vite.config.ts`, `mise run build`
      erfolgreich getestet)
- [x] Schritt 9: Packaging (`mise run package` erfolgreich getestet,
      gültige `.vsix` erzeugt und Inhalt verifiziert)
- [ ] Schritt 10: Test in Sandbox-Org (benötigt echte Azure DevOps
      Organisation — insbesondere `options`-Struktur in Schritt 3
      verifizieren)
- [ ] Schritt 11: Polishing & Marketplace-Veröffentlichung
      — **teilweise erledigt:** `overview.md` (Marketplace-Beschreibung),
      `vss-extension.json` verweist darauf, Icon vorhanden, Packaging mit
      neuen Inhalten getestet. **Noch offen (benötigt manuelle Aktion /
      echte Azure DevOps Org):** Publisher-Account im Marketplace Portal
      anlegen, echte Screenshots (nach Schritt 10), finale
      Marketplace-Review-Einreichung, `"public": true` setzen (bewusst
      noch `false`, bis Sandbox-Test in Schritt 10 erfolgt ist).
- [x] Schritt 12: CI/CD via GitHub Actions (`.github/workflows/ci.yml`,
      `.github/workflows/cd.yml`) — `MARKETPLACE_PAT`-Secret muss vor dem
      ersten Tag-Release noch im GitHub-Repo hinterlegt werden

**Automatisierte Tests:** `src/__tests__/types.test.ts` (9 Tests, Pfad-
Normalisierung) und `src/__tests__/asciidocRenderer.test.ts` (5 Tests,
Include-Resolution End-to-End mit gemocktem `gitService`) — alle 14 grün
(`mise run test`).
