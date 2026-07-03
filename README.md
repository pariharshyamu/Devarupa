# देवरूप · Devarūpa

A UI/UX component library — buttons, forms, charts, a sortable data table,
toasts, theming — written in
[**Devabhāṣā**](https://www.npmjs.com/package/devabhasha) (देवभाषा), the
Sanskrit-syntax language that transpiles to JavaScript.

Components across seven modules, a CSS-custom-property theme cascade with
four built-in themes (and instant switching with zero rebuild), and a working
demo page. It also pulls Devabhāṣā's own standard-library idioms into the UI
layer: **list/string helpers** (`क्रमय`, `खण्डशः`, `अद्वितीयम्`, `प्रथमाक्षरोच्च`, …
ported from `std/सूची` and `std/पाठ`) and **`परिणाम`-based form validation** —
so a sortable/paginated table sorts with `क्रमय`, and a validated field returns
the same `साधितम्`/`विफलम्` Result values the language uses everywhere else.
Every component is plain, inspectable JavaScript once compiled — no framework
runtime, no virtual DOM, no build step required to *use* it.

> **Status:** this is an independent, community-built library written *using*
> Devabhāṣā.

---

## Contents

- [Quick start](#quick-start)
- [Using it from plain JS/HTML](#using-it-from-plain-jshtml)
- [Using it from a Devabhāṣā project](#using-it-from-a-devabhāṣā-project)
- [Theming](#theming)
- [Component catalog](#component-catalog)
- [Architecture notes](#architecture-notes)
- [Building from source](#building-from-source)
- [Credits](#credits)

---

## Quick start

```bash
npm install devarupa
```

The package ships two things:

| Path | What it is | Who it's for |
|---|---|---|
| `dist/devarupa.browser.js` | A single pre-compiled, self-contained JS bundle | Anyone writing plain JS/HTML — **no Devabhāṣā toolchain needed** |
| `src/*.deva` | The original Devabhāṣā source | Devabhāṣā projects that want to `आयात` components directly, or anyone who wants to read/modify the actual implementation |

If you just want buttons, forms, and charts on a page, you want the first one.

---

## Using it from plain JS/HTML

Drop the bundle in a `<script>` tag. It exposes everything on `window.Devarupa`:

```html
<script src="node_modules/devarupa/dist/devarupa.browser.js"></script>
<script>
  // Apply a theme first (sets CSS custom properties on :root)
  Devarupa.विषयलागू(Devarupa.प्रकाशः);   // or .रात्रिः / .स्वर्णिमः / .हिमः

  const button = Devarupa.पीडकम्("Click me", () => alert("नमस्ते!"), { वर्गः: "प्राथमिक" });
  document.body.appendChild(button);
</script>
```

**Typing Devanagari is optional.** Every export is available under both its
original Sanskrit name *and* a plain-ASCII transliteration — pick whichever
your editor/keyboard handles better; they're the exact same function:

```js
Devarupa.पीडकम्(...)       // identical to:
Devarupa.piiddakam(...)
```

(The catalog below lists both spellings for every component.)

A complete, ready-to-open example with every component wired up live is in
[`examples/index.html`](./examples/index.html) — open it directly in a
browser, no server needed.

---

## Using it from a Devabhāṣā project

Import the `.deva` source files the normal way Devabhāṣā resolves modules —
**by relative path** (Devabhāṣā does not currently implement Node-style
`node_modules` package resolution, so reference the files directly):

```deva
आयात { पीडकम्, चिह्नम्, पत्रकम् } आ "../node_modules/devarupa/src/घटकाः"।
आयात { प्रकाशः, विषयलागू } आ "../node_modules/devarupa/src/अभिकल्पनम्"।

विषयलागू(प्रकाशः)।

चर बटनः = पीडकम्("नमस्ते", कार्य(){ दर्शय("स्पृष्टम्!"); }, कोष{ वर्गः: "प्राथमिक" })।
योजय(बटनः)।
```

Then compile/run it with the [`devabhasha`](https://www.npmjs.com/package/devabhasha)
CLI (`npm install -g devabhasha`, then `devabhasha run yourfile.deva` or
`devabhasha build yourfile.deva`).

If your project structure makes the relative path awkward, the simplest fix
is copying `src/*.deva` directly into your own source tree — they have no
external dependencies beyond each other.

---

## Theming

Theming is a **CSS custom-property cascade**, not a reactive rebuild: every
component reads a `var(--db-…)` reference once, at construction time, and
switching themes only ever changes the underlying variable values on
`:root`. Nothing gets reconstructed — existing buttons, cards, even SVG
charts all restyle on the next paint.

```js
Devarupa.विषयलागू(Devarupa.प्रकाशः);   // Light (default)
Devarupa.विषयलागू(Devarupa.रात्रिः);   // Night (dark mode)
Devarupa.विषयलागू(Devarupa.स्वर्णिमः); // Golden (warm amber/cream)
Devarupa.विषयलागू(Devarupa.हिमः);     // Frost (cool slate/ice blue)
```

### Defining your own theme

A theme is just a plain object of 14 hex values — copy one of the built-ins
and change the colors:

```js
Devarupa.विषयलागू({
  page: "#fdf6ec", surface: "#fffaf2", text: "#3d2c1e", textMuted: "#8a6d51",
  border: "#ecddc4", primary: "#c2792d", primaryDark: "#9c5e1f",
  secondary: "#8a6d51", secondaryDark: "#6b5440", success: "#7c9a3c",
  warning: "#d68a1f", danger: "#c0452c", info: "#4f86a8", onAccent: "#fffaf2"
});
```

---

## Component catalog

Every component is a plain function: call it, get a real DOM node back (or a
small object with `.अंशः`/`element` plus controls, noted below). Append it
yourself with `appendChild`/`Devarupa.योजय(node)` — nothing auto-mounts.

### अभिकल्पनम् (Design tokens)

| Devanagari | ASCII | Description |
|---|---|---|
| `वर्णपटः` | `varnnapattah` | Constant table of `var(--db-…)` color tokens |
| `प्रकाशः` / `रात्रिः` / `स्वर्णिमः` / `हिमः` | `prakaashah` / `raatrih` / `svarnnimah` / `himah` | The four built-in theme objects |
| `विषयलागू(वर्णाः)` | `vissayalaaguu` | Apply a theme |
| `अन्तरालः` / `कोणाः` / `छायाः` | `antaraalah` / `konnaah` / `chaayaah` | Spacing / border-radius / box-shadow scales |
| `अक्षरकुलम्` | `akssarakulam` | Default font stack |
| `वर्णप्राप्ति(वर्गः)` | `varnnapraapti` | Resolve a variant name ("प्राथमिक","सफलता",…) to `{मुख्यः, गहनः, पाठ्यः}` |

### घटकाः (Core components)

| Devanagari | ASCII | Signature | Description |
|---|---|---|---|
| `पीडकम्` | `piiddakam` | `(पाठः, हस्तकः, विकल्पाः)` | Button. `वर्गः`: प्राथमिक/द्वितीयक/सफलता/चेतावनी/संकट/बाह्यरेखा/भूत. `आकारः`: लघु/मध्यम/बृहत्. `निष्क्रियः`, `चौडम्` |
| `चिह्नम्` | `cihnam` | `(पाठः, वर्गः)` | Badge / pill label |
| `पत्रकम्` | `patrakam` | `({शीर्षकम्, सामग्री, पादः})` | Card container |
| `सूचनापट्टी` | `suucanaapattttii` | `(पाठः, वर्गः, बन्दनीयः)` | Alert banner, optionally dismissible |
| `आदानक्षेत्रम्` | `aadaanakssetram` | `({नामपत्रम्, स्थानधारी, प्रकारः, प्रारम्भः, अधिकतमः})` → `{अंशः, इनपुटः, मूल्यम्()}` | Text input with live char counter |
| `परिवर्तकम्` | `parivartakam` | `(प्रारम्भः, हस्तकः)` → `{अंशः, स्थितिः()}` | Animated toggle switch |
| `प्रगतिपट्टी` | `pragatipattttii` | `(प्रतिशतः)` → `{अंशः, मूल्यसेट(n)}` | Progress bar |
| `अवतारः` | `avataarah` | `(आद्याक्षरम्, वर्गः)` | Avatar circle (initials) |
| `विभाजकः` | `vibhaajakah` | `()` | Divider |
| `चक्रिका` | `cakrikaa` | `()` → `{अंशः, नष्ट()}` | Loading spinner (animated via a `कालचक्र` timer) |
| `टैबसमूहः` | `ttaibasamuuhah` | `([{शीर्षकम्, सामग्री}, …])` → `{अंशः}` | Tabs |
| `विधिवातायनम्` | `vidhivaataayanam` | `({शीर्षकम्, सामग्री})` → `{अंशः, विवृणु(), संवृणु()}` | Modal dialog |
| `उपकरणसूचना` | `upakarannasuucanaa` | `(मूलघटकः, पाठः)` | Tooltip wrapper (hover) |

### प्रपत्राणि (Forms)

| Devanagari | ASCII | Signature | Description |
|---|---|---|---|
| `बहुपाठक्षेत्रम्` | `bahupaatthakssetram` | `({नामपत्रम्, स्थानधारी, पङ्क्तयः, अधिकतमः})` → `{अंशः, इनपुटः, मूल्यम्()}` | Textarea with char counter |
| `चयनक्षेत्रम्` | `cayanakssetram` | `({नामपत्रम्, विकल्पसूची:[{मूल्यम्,पाठः}], प्रारम्भः})` → `{अंशः, मूल्यम्()}` | Select dropdown |
| `अङ्कितपेटिका` | `angkitapettikaa` | `(पाठः, प्रारम्भः, हस्तकः)` → `{अंशः, मूल्यम्()}` | Checkbox |
| `विकल्पचक्रम्` | `vikalpacakram` | `(नाम, विकल्पसूची, प्रारम्भः, हस्तकः)` → `{अंशः, मूल्यम्()}` | Radio button group |
| `सर्पिणी` | `sarpinnii` | `({नामपत्रम्, न्यूनतमः, अधिकतमः, प्रारम्भः})` → `{अंशः, मूल्यम्()}` | Range slider with live readout |
| `त्रुटिपाठः` | `truttipaatthah` | `(पाठः)` | Small red validation message |
| `प्रपत्रम्` | `prapatram` | `({क्षेत्राणि:[{नाम,अंशः,मूल्यम्,वैधः?}], समर्पणपाठः, समर्पणहस्तकः})` | Composes fields + a submit button; collects every field's value into one object on submit. Any field exposing `.वैधः()` (e.g. `प्रमाणितक्षेत्रम्`) is validated first — an invalid field blocks the submit |

### आरेखाः (Charts)

All charts are real SVG (built as markup strings, assigned via `innerHTML`
— not canvas), so `fill`/`stroke` resolve theme `var(--db-…)` colors too.

| Devanagari | ASCII | Signature | Description |
|---|---|---|---|
| `दण्डारेखाचित्रम्` | `dannddaarekhaacitram` | `({दत्तानि:[{नाम,मूल्यम्}], चौडाई, उच्चता, वर्णः})` | Bar chart |
| `रेखाचित्रम्` | `rekhaacitram` | `({दत्तानि, चौडाई, उच्चता, वर्णः})` | Line chart with soft area fill |
| `वृत्तचित्रम्` | `vrittacitram` | `({दत्तानि:[{नाम,मूल्यम्,वर्णः?}], व्यासः, वलयांशः})` | Pie chart (`वलयांशः: 0`) or donut (`> 0`), with legend |
| `सांख्यिकाकार्डम्` | `saamkhyikaakaarddam` | `({शीर्षकम्, मूल्यम्, परिवर्तनम्})` | KPI stat card with a trend arrow |

### सारणी (Data table & toasts)

| Devanagari | ASCII | Signature | Description |
|---|---|---|---|
| `सारणी` | `saarannii` | `({स्तम्भाः:[{कुञ्जी,शीर्षकम्,क्रमणीयः?}], दत्तानि:[…], पृष्ठमानम्?})` → `{अंशः}` | Data table. Click a `क्रमणीयः` header to sort (▲/▼, toggles) — sorting uses `उपयोगिता.क्रमय`; paging uses `उपयोगिता.खण्डशः`. Pagination controls appear when the data exceeds one page |
| `क्षणिकसूचना` | `kssannikasuucanaa` | `(पाठः, वर्गः, आयुः?)` → `{अंशः, बन्द()}` | Toast. Appears top-right, fades in, auto-dismisses after `आयुः` ms (default 3000), or on click. Fade + timeout driven by `कालचक्र` |

### प्रमाणनम् (Form validation)

Validators speak Devabhāṣā's native `परिणाम` (Result) protocol — each returns
`साधितम्(मूल्यम्)` or `विफलम्(संदेशः)`. A `प्रमाणितक्षेत्रम्` drops straight into
`प्रपत्रम्`: it exposes `.वैधः()`, which the form composer runs on submit.

| Devanagari | ASCII | Signature | Description |
|---|---|---|---|
| `आवश्यकः` | `aavashyakah` | `(मूल्यम्)` → `परिणाम` | Required (non-empty) |
| `न्यूनदैर्घ्यम्` | `nyuunadairghyam` | `(न)` → validator | At least `न` characters |
| `अधिकदैर्घ्यम्` | `adhikadairghyam` | `(न)` → validator | At most `न` characters |
| `संख्यामात्रम्` | `samkhyaamaatram` | `(मूल्यम्)` → `परिणाम` | Must parse as a number (via `अङ्कय`) |
| `विद्युत्पत्रम्` | `vidyutpatram` | `(मूल्यम्)` → `परिणाम` | Structural e-mail check |
| `प्रमाणय` | `pramaannaya` | `(मूल्यम्, नियमाः)` → `परिणाम` | Run validators in order; first failure wins |
| `प्रमाणितक्षेत्रम्` | `pramaannitakssetram` | `({नाम, नामपत्रम्, स्थानधारी, प्रकारः, प्रारम्भः, नियमाः:[validator]})` → `{अंशः, इनपुटः, नाम, मूल्यम्(), वैधः()}` | A labelled input that validates itself on blur and shows the failure via `त्रुटिपाठः` |

### उपयोगिता (Devabhāṣā stdlib helpers)

Browser-safe list/string helpers lifted from Devabhāṣā's own `std/सूची` and
`std/पाठ`, exposed for components and apps alike.

| Devanagari | ASCII | Signature | Description |
|---|---|---|---|
| `योगः` / `महत्तमम्` / `न्यूनतमम्` | `yogah` / `mahattamam` / `nyuunatamam` | `(सूची)` | Sum / max / min of a numeric list |
| `गणय` | `gannaya` | `(सूची, परीक्षा)` | Count elements matching a predicate |
| `अद्वितीयम्` | `advitiiyam` | `(सूची)` | Unique elements, order preserved |
| `परिसरः` | `parisarah` | `(आदिः, अन्तः)` | The list `[आदिः, अन्तः)` |
| `खण्डशः` | `khannddashah` | `(सूची, आकारः)` | Split into sub-lists of size `आकारः` (chunk) |
| `क्रमय` | `kramaya` | `(सूची, तुल)` | Stable, non-mutating merge sort by a comparator |
| `प्रथमाक्षरोच्च` | `prathamaakssarocca` | `(पाठः)` | Capitalize the first character |
| `आवर्तय` | `aavartaya` | `(पाठः, सङ्ख्या)` | Repeat a string |
| `रिक्तः` | `riktah` | `(पाठः)` | Is the string empty / whitespace-only? |
| `अन्तर्भवति` | `antarbhavati` | `(पाठः, खण्डः)` | Does it contain the substring? |
| `व्युत्क्रमः` | `vyutkramah` | `(पाठः)` | Reverse the characters |
| `वामपूरणम्` | `vaamapuurannam` | `(पाठः, लक्ष्यम्, पूरकः)` | Left-pad to a target length |

### Example: a bar chart, in plain JS

```js
Devarupa.विषयलागू(Devarupa.रात्रिः);

const chart = Devarupa.दण्डारेखाचित्रम्({
  दत्तानि: [
    { नाम: "जन", मूल्यम्: 42 }, { नाम: "फर", मूल्यम्: 55 },
    { नाम: "मार्च", मूल्यम्: 48 }, { नाम: "अप्रै", मूल्यम्: 67 }
  ]
});

document.body.appendChild(
  Devarupa.पत्रकम्({ शीर्षकम्: "Monthly Revenue", सामग्री: chart })
);
```

---

## Architecture notes

Worth knowing if you read or extend `src/*.deva`:

- **`दृश्य` (reactive view) is statement-only** — it self-mounts and cannot
  be nested or returned as a value. So every component here manages its own
  internal interactivity (hover, toggle, dismiss, tab-switch) **imperatively**
  — direct DOM/`.style` mutation in event handlers — rather than through a
  reactive re-render. `भाव`/`दृश्य` are left free for *your* app's
  page-level state, the way `flappy.deva` (Devabhāṣā's own example game)
  uses them.
- **Theming never touches `भाव`/`दृश्य` at all.** It's a plain CSS custom-
  property cascade (see [Theming](#theming)) — this is also why charts and
  every other component restyle instantly with no rebuild cost.
- **`रूप` (style block) vs. `अङ्गम्`'s `style` prop are not the same thing.**
  `रूप` gets compile-time Sanskrit→CSS key/value translation (`पृष्ठभूमिः` →
  `backgroundColor`). The lower-level `अङ्गम्(tag, props, …children)` builtin
  — needed for tags outside the core vocabulary, like `<select>`,
  `<textarea>`, `<option>`, `<label>` — does a plain runtime
  `Object.assign(node.style, …)`, so its style keys must be **literal
  camelCase DOM property names**, not Sanskrit words.
- **`रूप` must come after any `स्पर्शाय करणेन` clause** in a `रचय` chain;
  putting it first is a real parser ordering bug, not just a style choice.
- **No danda (`।`) immediately before a closing `)` or `}`** when a `रचय`
  expression is used as a bare function argument or object-literal value —
  the danda is a statement terminator, and that position is still inside an
  expression.
- Every export's compiled property name on `window.Devarupa` is its
  **transliterated ASCII form** (see the catalog above); the Devanagari
  alias is added afterward by this package's own build step, not by
  Devabhāṣā itself.

---

## Building from source

The `dist/` bundle is pre-built and checked in, so most users never need
this. To rebuild it yourself (e.g. after editing `src/*.deva`):

```bash
npm install devabhasha   # peerDependency — needed only for building
npm run build            # runs scripts/build-dist.mjs
```

`scripts/build-dist.mjs` bundles `src/अनुक्रमणिका.deva` (an entry file that
just imports every `src/*.deva` module so the bundler's dependency graph
includes everything) via `devabhasha`'s own `bundle()` function, then merges
the resulting module exports onto `window.Devarupa` and adds the Devanagari
name aliases. The alias map is derived automatically — it scans each module's
`निर्यात` declarations and transliterates them the same way the compiler does —
so adding a new module or export needs no edit to the build script; just make
sure `अनुक्रमणिका.deva` imports something from it. Read the script if you want
to change what gets bundled.

---

## Credits

- [**Devabhāṣā**](https://www.npmjs.com/package/devabhasha) — the Sanskrit-
  syntax language Devarūpa is written in — created by Shyamu Parihar.
  Devarūpa is an independent library that happens to be built with it; it
  has no other affiliation with that project.
- Theming approach (a CSS-variable cascade with named, swappable themes)
  was inspired by [Astryx](https://astryx.atmeta.com), Meta's open-source
  React design system.

## License

MIT
