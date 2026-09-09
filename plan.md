# Plan: AsciiDoc-Preview für Azure DevOps (Menü-Aktion + Dialog)

## Goal
Eine `.adoc`-Datei in Azure Repos lässt sich mit **einem Klick im
Kontextmenü ("AsciiDoc Preview")** als gerendertes HTML in einem Dialog
anzeigen — so nah wie mit öffentlichen, verifiziert funktionierenden
Azure-DevOps-Extensibility-Punkten möglich am ursprünglich gewünschten
"Preview-Tab wie bei Markdown"-Erlebnis (das echte Markdown-Preview-Tab ist
fest in Azure DevOps eingebaut und nicht für Drittanbieter-Dateitypen
nutzbar, siehe `## Approach`). Lokale `include::`-Direktiven (Dateien im
selben Repo) werden dabei aufgelöst und eingebettet.

## Approach
> **Update nach Live-Test (empirisch bestätigt):** Der Contribution-Point
> `ms.vss-code-web.content-renderer-collection` wurde installiert und in
> einer echten Azure DevOps Organisation getestet — **er zeigt keinen
> "Preview"-Tab für `.adoc`-Dateien an** (kein einziger Netzwerk-Request zu
> `dist/index.html` im Browser-Network-Tab, während der eingebaute
> Markdown-Preview-Tab normal funktioniert). Dieser Contribution-Point stammt
> aus einem einzigen, seit 2018 nie aktualisierten Microsoft-Sample und taucht
> in der aktuellen offiziellen Doku nirgends auf — er ist in heutigem Azure
> DevOps (2026) offenbar nicht (mehr) wirksam für Drittanbieter-Extensions.
>
> **Neuer, verifiziert existierender Ansatz: Kontextmenü-Aktion + Dialog.**
> Diese Bausteine sind (im Gegensatz zum vorigen Versuch) sowohl in der
> aktuellen offiziellen Doku (`docs/extend/reference/targets/overview.md`,
> `docs/extend/develop/add-action.md`) als auch **typisiert im aktuell
> installierten `azure-devops-extension-api`-Paket** vorhanden
> (`azure-devops-extension-api/Common/CommonServices.d.ts` —
> `IHostPageLayoutService.openCustomDialog()`), also deutlich solider
> abgesichert:
>
> 1. **Menü-Aktion** (`ms.vss-web.action`, Ziel
>    `ms.vss-code-web.source-item-menu`) erscheint im Kontextmenü einer Datei
>    in Azure Repos ("AsciiDoc Preview"). Ihr `execute(actionContext)`-Handler
>    öffnet einen Dialog über
>    `SDK.getService("ms.vss-features.host-page-layout-service")` →
>    `dialogService.openCustomDialog(dialogContributionId, { configuration })`.
> 2. **Dialog-Content-Contribution** (`ms.vss-web.control`, `targets: []`,
>    wird nur dynamisch per ID aufgerufen, nicht an einen festen Ort
>    gebunden) lädt unsere Renderer-Seite, die den Dateiinhalt selbst per
>    Git-REST lädt (Pfad/Repo/Projekt kommen über `SDK.getConfiguration()`
>    aus der `configuration`, die die Menü-Aktion beim Öffnen mitgegeben hat).
>
> **Restrisiko:** Die genaue Struktur von `actionContext` (welche Felder
> Projekt/Repo/Pfad/Version enthalten) ist — wie zuvor bei `options` — nicht
> öffentlich dokumentiert. Daher: `console.debug(actionContext)` beim
> Auslösen der Aktion, **plus** ein eingebauter Debug-Fallback: kann der
> Kontext nicht extrahiert werden, zeigt der Dialog den rohen
> `actionContext` als JSON an (analog zum offiziellen "showProperties"-Sample
> aus `vsts-extension-samples/contributions-guide`, das genau dafür gedacht
> ist, Contribution-Kontexte zur Laufzeit zu inspizieren).

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

2. **Extension-Manifest mit Menü-Aktion + Dialog-Contribution**
   - Files: `vss-extension.json`
   - Contribution 1 (`asciidoc-preview-action`): Typ `ms.vss-web.action`,
     Ziel `ms.vss-code-web.source-item-menu` (Kontextmenü auf Dateien in
     Azure Repos, Grid- und Tree-Ansicht kombiniert). Properties: `text`
     ("AsciiDoc Preview"), `title`, `icon`, `group: "actions"`, `uri:
     "dist/action.html"`.
   - Contribution 2 (`asciidoc-preview-dialog`): Typ `ms.vss-web.control`,
     `targets: []` (wird nicht an einen festen Ort gebunden, sondern nur
     dynamisch per voller Contribution-ID von der Menü-Aktion aus geöffnet).
     Properties: `uri: "dist/renderer.html"`.

3. **Menü-Aktion + Dialog implementieren**
   - Files: `src/pages/action.html`, `src/action/index.ts`,
     `src/pages/renderer.html`, `src/renderer/index.ts`
   - **Aktion** (`src/action/index.ts`): `SDK.init()`, `SDK.ready()`, dann
     `SDK.register(SDK.getContributionId(), () => ({ execute }))`.
     `execute(actionContext)` extrahiert Projekt/Repo/Pfad/Version (siehe
     `extractRenderContext`, wiederverwendet aus
     `src/renderer/optionsContext.ts`) und öffnet den Dialog via
     `SDK.getService("ms.vss-features.host-page-layout-service")` →
     `dialogService.openCustomDialog("<publisher>.<extensionId>.
     asciidoc-preview-dialog", { title, configuration: { renderContext } })`.
   - **Dialog** (`src/renderer/index.ts`): `SDK.init()`, `SDK.ready()`, liest
     `SDK.getConfiguration()` für den `renderContext`, lädt den
     Hauptdatei-Inhalt selbst per `getRepoFileContent()` (Git-REST, da der
     Dialog — anders als der verworfene Content-Renderer-Ansatz — den
     Inhalt nicht automatisch mitbekommt), rendert und zeigt ihn an.
   - **Wichtig, zuerst verifizieren:** `console.debug(actionContext)` in
     `execute()` sowie ein eingebauter Debug-Fallback im Dialog: kann
     `extractRenderContext` keinen vollständigen Kontext aus `actionContext`
     extrahieren, zeigt der Dialog den rohen `actionContext` als JSON an
     (siehe Schritt 10 für den Live-Test in einer echten Organisation).

4. **AsciiDoc-Inhalt + Kontext holen**
   - Files: `src/services/gitService.ts`, `src/types.ts`,
     `src/renderer/optionsContext.ts`
   - `RenderContext` (`projectId`, `repositoryId`, `version`, `filePath`)
     wird aus dem `actionContext` der Menü-Aktion extrahiert (siehe Schritt
     3) und als `configuration.renderContext` an den Dialog übergeben.
   - Der Dialog lädt den Hauptdatei-Inhalt **immer** selbst per
     `getRepoFileContent()` (`GitRestClient.getItemContent()` aus
     `azure-devops-extension-api`) — anders als beim ursprünglich
     angenommenen (und verworfenen) Content-Renderer-Ansatz gibt es hier
     keinen direkt mitgelieferten `rawContent`.

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
   - Files: `vite.config.ts`
   - Zwei HTML-Entry-Points (`src/pages/action.html`,
     `src/pages/renderer.html`) → Output `dist/action.html` und
     `dist/renderer.html`, müssen mit den `uri`-Properties im Manifest
     übereinstimmen.

9. **Packaging**
   - Files: `mise.toml` (Task `package`)
   - `mise run package` → führt `tfx extension create --manifest-globs
     vss-extension.json` aus (tfx-cli als mise-Tool, direkt im PATH, kein
     `npx` nötig).

10. **Test in Sandbox-Organisation (vor öffentlichem Release)**
    - Extension zunächst privat/nicht gelistet in einer Test-Organisation
      hochladen und installieren (unabhängig vom späteren öffentlichen
      Release — dient nur der Vorab-Validierung).
    - `.adoc`-Datei mit lokalen Includes in einem Test-Repo öffnen, im
      **Kontextmenü "AsciiDoc Preview"** auswählen, prüfen ob der Dialog
      öffnet und Includes korrekt aufgelöst werden.
    - Iterativ anpassen, da die genaue Struktur von `actionContext` (siehe
      Schritt 3) erst zur Laufzeit sichtbar wird — der eingebaute
      Debug-Fallback (roher `actionContext` als JSON im Dialog) hilft dabei.
    - Erst nach erfolgreichem Test in Schritt 11 öffentlich veröffentlichen.
    - **Status:** Erster Live-Test durchgeführt — der ursprüngliche
      Content-Renderer-Ansatz zeigte sich als nicht funktionsfähig (kein
      Tab, kein Netzwerk-Request), daher Umstieg auf Menü-Aktion + Dialog
      (siehe `## Approach`). Dieser neue Ansatz muss noch live getestet
      werden.

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
  registrierte Publisher-ID: **`klab365`** (identisch zum GitHub-Org-Namen,
  bewusst so gewählt für Konsistenz). Ein früherer Testversuch lief unter der
  Publisher-ID `burak-kizilkaya` — diese Extension wurde zwischenzeitlich
  wieder entfernt, `klab365` ist ab Version 0.2.0 der einzige/aktuelle
  Publisher. `"publisher"` in `vss-extension.json` muss exakt `klab365`
  sein.
- **Extension-`id` (technisch, in `vss-extension.json`):**
  `asciidoc-viewer-azdevops` — identisch zum GitHub-Repo-Namen, für
  Konsistenz und Wiederauffindbarkeit.
- **Marketplace-`name` (menschenlesbar, im UI angezeigt):** kann kürzer/
  freundlicher sein als die ID, z. B. "AsciiDoc Viewer" — final in Schritt 11
  festlegen.

## Open questions
- Finaler Marketplace-Anzeigename (`name`-Feld, aktuell "AsciiDoc Viewer")
  und Icon (aktuell Platzhalter) — vor endgültiger öffentlicher
  Veröffentlichung (Schritt 11) final festlegen.

## Risks
- `actionContext`-Parameter von `execute(actionContext)` (Menü-Aktion) ist
  nicht öffentlich dokumentiert — Struktur muss zur Laufzeit verifiziert
  werden (siehe Schritt 3/10). Eingebauter Debug-Fallback zeigt den rohen
  Kontext im Dialog an, falls die Extraktion fehlschlägt.
- Referenz-Sample für `content-renderer-collection` (verworfener Ansatz)
  stammt aus 2018 (altes SDK) und wurde live als nicht funktionsfähig
  bestätigt (siehe `## Approach`) — nicht erneut versuchen.
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
Small–Medium — Kern (Menü-Aktion + Dialog registrieren, Asciidoctor.js
rendern) ist überschaubar und jetzt auf verifizierten APIs aufgebaut;
Hauptunsicherheit liegt in der genauen `actionContext`-Struktur (nur per
Live-Test in einer echten Organisation zu klären) und im Umfang der
Include-Attribut-Unterstützung.

## Status / Progress Log
- [x] Schritt 1: Projekt aufsetzen (`package.json`, `tsconfig.json`, `mise.toml`,
      `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`)
- [x] Schritt 2: Manifest mit Menü-Aktion + Dialog-Contribution
      (`vss-extension.json`: `ms.vss-web.action` → `source-item-menu`,
      `ms.vss-web.control` → Dialog)
- [x] Schritt 3: Menü-Aktion + Dialog (`src/action/index.ts`,
      `src/renderer/index.ts`, `src/renderer/optionsContext.ts`) —
      `actionContext`-Struktur noch nicht gegen echtes Azure DevOps
      verifiziert (siehe Risks); Debug-Fallback eingebaut
- [x] Schritt 4: Inhalt + Kontext holen (`src/services/gitService.ts`,
      `src/types.ts`)
- [x] Schritt 5: Lokale Includes auflösen (`src/renderer/includeResolver.ts`)
      — durch automatisierte Tests abgedeckt (verschachtelt, `leveloffset`,
      Zyklus-Erkennung, nicht auflösbare/externe Includes), Fixtures unter
      `src/__tests__/fixtures/`
- [x] Schritt 6: Rendering (`src/renderer/asciidocRenderer.ts`)
- [x] Schritt 7: Fehler-/Ladezustände (Basis in `src/renderer/index.ts`:
      Status-Anzeige, Fehlermeldung, Debug-JSON-Dump; Feinschliff optional)
- [x] Schritt 8: Build & Bundle (`vite.config.ts`, Multi-Page-Build
      `action.html`/`renderer.html`, `mise run build` erfolgreich getestet)
- [x] Schritt 9: Packaging (`mise run package` erfolgreich getestet,
      gültige `.vsix` erzeugt und Inhalt verifiziert)
- [ ] Schritt 10: Test in Sandbox-Org — **erster Live-Test durchgeführt**:
      Content-Renderer-Ansatz erwies sich als nicht funktionsfähig (kein
      Tab, kein Netzwerk-Request), daher Umstieg auf Menü-Aktion + Dialog.
      Dieser neue Ansatz muss noch live getestet werden (insbesondere
      `actionContext`-Struktur verifizieren).
- [ ] Schritt 11: Polishing & Marketplace-Veröffentlichung
      — **teilweise erledigt:** `overview.md` (Marketplace-Beschreibung),
      `vss-extension.json` verweist darauf, Icon vorhanden, Packaging mit
      neuen Inhalten getestet, Publisher final auf `klab365` gesetzt,
      Version auf `0.2.0` erhöht. **Noch offen:** echte Screenshots (nach
      Schritt 10), finale Marketplace-Review-Einreichung, `"public": true`
      setzen (bewusst noch `false`, bis Sandbox-Test in Schritt 10 erfolgt
      ist).
- [x] Schritt 12: CI/CD via GitHub Actions (`.github/workflows/ci.yml`,
      `.github/workflows/cd.yml`) — `.vsix`-Artefakt (`asciidoc-viewer-
      azdevops-X.Y.Z.vsix`) wird in `cd.yml` immer hochgeladen, auch wenn
      der automatische Marketplace-Publish fehlschlägt (siehe bekanntes
      tfx/Marketplace-Problem unten); zusätzlicher `mise run publish`-Task
      für manuelles/lokales Publizieren mit `$MARKETPLACE_PAT` aus `.env`.

**Automatisierte Tests:** `src/__tests__/types.test.ts` (9 Tests, Pfad-
Normalisierung) und `src/__tests__/asciidocRenderer.test.ts` (5 Tests,
Include-Resolution End-to-End mit gemocktem `gitService`, liest echte
`.adoc`-Fixture-Dateien aus `src/__tests__/fixtures/`) — alle 14 grün
(`mise run test`).

**Bekanntes tfx/Marketplace-Problem (Live-Erfahrung):** Der allererste
`tfx extension publish`-Aufruf für eine neue Extension schlägt häufig mit
`error: Request timeout: /_apis/gallery` fehl (bekannter, seit Jahren
gemeldeter Bug im "Create new extension"-Codepfad der Marketplace-API,
siehe `microsoft/tfs-cli`-Issues #319/#408 — tritt sowohl lokal als auch in
GitHub Actions auf, unabhängig vom Netzwerk). Ebenfalls aufgetreten: `403
Forbidden` bei fehlendem PAT-Scope ("Publish new extensions to an existing
publisher" — PAT benötigt Scope "Marketplace → Manage") und ein 404 beim
Install-Link, solange die Extension noch im Status "Verifying" ist (nach
manuellem Upload normal, dauert einige Minuten). **Workaround:** die
allererste Version einer neuen Extension manuell über die Marketplace-Web-UI
hochladen (Update-Codepfad ist zuverlässiger als Create); `cd.yml` lädt
deshalb das `.vsix` immer als Artefakt hoch (`continue-on-error` beim
Publish-Schritt), damit manuelles Nachholen jederzeit möglich ist.
