# Changelog

All notable changes are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-27

First public release.

### Added
- Complete ISO 10628-2:2012 symbol library: 295 symbols in 29 numbered groups, with ISO registration numbers and the preferred connection points as ports.
- User interface, symbol names and help in English (default), French and Dutch, with a language selector.
- Connection ports that can be added, moved and deleted on any symbol; lines and arrows stay attached when symbols move, rotate or flip.
- Orthogonal line routing, eight line types (process, secondary, dash-dot, utility, signal, electrical, pneumatic, data), arrowheads, line labels.
- Automatic equipment tags per ISO group (B-101, C-101, E-101, P-101…).
- Sheet frame and title block (A4 to A1).
- Export to SVG, PNG, PDF (print) and CSV equipment list.
- Uniform line weight for all symbols.
- Reproducible symbol pipeline (`tools/iso-symbols`) and automated smoke tests.
