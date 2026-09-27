# Project Resources design previews

Architecture-only, synthetic and isolated from the application. Open [the gallery](index.html). No uploads, sends, saves, authentication or document retrieval are implemented. Disabled controls illustrate future placement; native disclosures and the fictional map's zoom/fit controls are the only local interactions beyond navigation.

Run from the repository root, if needed:

```powershell
python -m http.server 8767 --bind 127.0.0.1 --directory previews/project-resources
```

Then open `http://127.0.0.1:8767/index.html`. The server exposes this synthetic folder only, not the repository or private references. The gallery also opens directly as a local HTML file.

Eight concepts have desktop and mobile screenshots under `screenshots/`: home, arrival, documents, admin, preset, assignment, security and map. Extra images show open disclosure, secondary actions and map zoom. Desktop captures use 1440px width; mobile captures use 390px width with a taller capture canvas cropped to rendered content. Ordinary viewport reachability is checked separately at 390 × 844; full-content images do not claim everything fits in one phone viewport.

The previews follow the checked-in 12.48 blue/canvas/ink/border tokens and heading scale. System font approximates the application's Geist; inline illustrative icons approximate Lucide. Implementation must reuse actual shared components, rather than copy this standalone CSS/JavaScript into application components.

No Belgrade source map or private contact is present. Every map shape, instruction, name and example.invalid contact is fictional. These layouts do not establish access controls or approve an actual document for publication. Read the [architecture package](../../cvc-scheduler/docs/project-resources/README.md) and its source-review limitations before approval.
