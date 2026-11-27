# ISO 10628-2 symbol pipeline

`js/iso-symbols.js` is generated from the seven "ISO 10628-2:2012 Symbols" sheets in `sheets/`
(Steven Baltakatei Sandoval, 2020, Wikimedia Commons https://w.wiki/dg9, CC BY-SA 4.0,
project https://gitlab.com/baltakatei/BK-2020-04/). The sheets are included unmodified.

| Step | Script | What it does |
|------|--------|--------------|
| 1 | `extract.js` | Opens each sheet in headless Chromium (Playwright), finds the dashed group frames by flood fill, cuts out every symbol with its registration number and description, and turns the marked "preferred connection locations" into ports. Writes `iso.json`. |
| 2 | `build.py` | Removes duplicates and the legend sample, fixes a few typos in the English names, adds French and Dutch names (`tr.py`), default tag prefixes per group, and writes `iso-symbols.js`. |
| 3 | `normsw.js` | Gives every stroked element the same line weight in drawing units, whatever its nested transforms, and writes the final file. |

Run everything from the repository root:

```
npm install
npx playwright install chromium
npm run build:symbols
```

The result is byte-for-byte identical to the committed `js/iso-symbols.js`.

Scale: 1 mm on the sheets = 2.5 drawing units in the app.

Licence: the scripts are GPL-3.0-or-later like the rest of the code; `tr.py` (names and translations),
the sheets and the generated `iso-symbols.js` are CC BY-SA 4.0.
