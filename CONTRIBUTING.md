# Contributing to PFD Studio

Thank you for your interest! PFD Studio is developed in the open and all contributions are welcome:
bug reports, symbol corrections, translations, documentation and code.

## Reporting a problem or asking for a feature

Open an [issue](../../issues). Please include:
- what you did, what you expected and what happened;
- your browser and operating system;
- if possible, the `.pfd.json` file or a screenshot.

Symbol errors (wrong shape, missing connection point, wrong name or translation) are very useful reports:
please give the ISO registration number shown in the properties panel.

## Getting help

Ask your question in an issue with the label `question`. There is no paid support;
the maintainer answers on a best-effort basis.

## Contributing code or translations

1. Fork the repository and create a branch.
2. The app has no build step: open `index.html` in a browser and edit the files in `js/` and `css/`.
   - Interface texts: `js/i18n.js` (one dictionary per language; add a language by adding a dictionary).
   - Symbol names and translations: `tools/iso-symbols/tr.py`, then rebuild the symbols (below).
3. Run the tests: `npm install`, `npx playwright install chromium`, `npm test`.
4. Open a pull request describing the change. Keep pull requests focused on one topic.

### Rebuilding the ISO symbol file

`js/iso-symbols.js` is generated from the source sheets in `tools/iso-symbols/sheets/`:

```
npm run build:symbols
```

This needs Node.js, Python 3 and Playwright. The output must stay under CC BY-SA 4.0 (see `LICENSES/`).

## Licensing of contributions

By contributing you agree that your code is released under GPL-3.0-or-later and that changes to the
symbol data are released under CC BY-SA 4.0.

## Code of conduct

Be respectful and constructive. Harassment or discriminatory language is not tolerated in issues,
pull requests or discussions.
