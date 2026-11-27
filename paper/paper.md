---
title: 'PFD Studio: an offline editor for process flow diagrams with the ISO 10628-2 symbol library'
tags:
  - JavaScript
  - chemical engineering
  - process flow diagram
  - P&ID
  - ISO 10628
  - engineering education
authors:
  - name: Vincent Thielens
    orcid: 0000-0003-1404-8972
    affiliation: 1
affiliations:
  - name: Thermal Engineering and Combustion Unit, Engineering Faculty, University of Mons (UMONS), Mons, Belgium
    index: 1
date: TODO
bibliography: paper.bib
---

<!-- DRAFT. Everything marked TODO must be completed by the author.
     JOSS asks for 750-1750 words. Submit only after the repository has been public
     for more than six months with regular development (JOSS submission requirements). -->

# Summary

Process flow diagrams (PFDs) and piping and instrumentation diagrams (P&IDs) are the common
language of chemical and process engineering. They show how equipment such as vessels, columns,
heat exchangers and pumps is connected by process, utility and signal lines. The international
standard ISO 10628 defines how these diagrams are drawn [@iso10628-1] and which graphical symbols
represent each type of equipment [@iso10628-2].

PFD Studio is a free, open-source diagram editor that runs entirely in a web browser, online or
offline, without installation. It provides the complete set of 295 ISO 10628-2 symbols, organised
in the 29 groups of the standard and labelled with their ISO registration numbers, in English,
French and Dutch. Users drag equipment onto a sheet, connect it with lines that stay attached to
connection ports when the equipment is moved, rotated or mirrored, and export the result as SVG,
PNG or PDF together with an equipment list.

# Statement of need

Drawing PFDs is one of the first practical skills taught in chemical engineering courses, and
students are expected to use the standard symbols. In practice, students and teachers face three
obstacles. Professional plant-design packages such as AutoCAD Plant 3D [@autocadplant3d] are
expensive, platform-specific and far more complex than a teaching exercise requires.
General-purpose diagram tools such as Microsoft Visio [@visio], draw.io [@drawio] or Inkscape
[@inkscape] are accessible, but their process-engineering shape sets are not organised by the
groups and registration numbers of ISO 10628-2, so the link between a drawn symbol and the
standard is lost. Finally, many tools treat lines as free graphics: when a piece of equipment is
moved, its connections must be redrawn by hand, which discourages iterative design.

PFD Studio targets this gap. It is aimed at (i) students learning to read and draw process
diagrams, (ii) teachers preparing course material and exam questions, and (iii) researchers and
engineers who need clean, standard-conforming schematics for reports and publications. Because it
needs no licence, account or installation, it can be used on student laptops, in computer rooms
with restricted software policies, or from a university web server.

TODO (author): describe concretely the course(s) and research context in which the software is
used at UMONS, and why it was created.

# State of the field

TODO (author): verify and complete this comparison; JOSS asks for a justification of building a
new tool rather than contributing to an existing one.

Commercial P&ID packages such as AutoCAD Plant 3D [@autocadplant3d] provide intelligent
diagrams linked to plant databases, which is valuable in industry but out of reach for most
teaching settings. Open-source process simulators such as DWSIM [@dwsim] include a flowsheet
editor, but its icons represent simulation unit operations rather than the drawing symbols of
ISO 10628-2. Generic editors (draw.io, Inkscape, Visio) can produce good-looking diagrams but do
not carry the structure of the standard. The DEXPI initiative [@dexpi] defines a data-exchange
model for P&IDs between engineering tools; PFD Studio does not aim to implement it but stores
drawings in a simple, documented JSON format that could be mapped to it in the future.

PFD Studio builds on an existing open resource: the ISO 10628-2 symbol sheets drawn by
Sandoval [@sandoval2020] and published under CC BY-SA 4.0. Rather than redrawing symbols, the
project extracts them automatically from these sheets, so corrections can be traced back to the
source. Contributing these features to a generic editor was considered less suitable for teaching
because the result would depend on a large, general application whose interface is not organised
around the standard.

# Software design

PFD Studio is written in plain JavaScript, HTML and CSS without frameworks, build step or server.
This choice keeps the tool usable for many years with no dependency maintenance, lets it run from
a local folder (`file://`), a USB stick or any static web host, and keeps the code readable for
students and contributors. The trade-off is that features which would normally use a framework,
such as undo history and interface translation, are implemented directly in a few hundred lines.

The drawing is rendered as SVG. Each placed symbol stores its position, rotation, mirroring,
scale and its own list of connection ports, initialised from the standard's preferred connection
points and editable per instance. Lines store references to ports rather than coordinates, so
their end points are recomputed from the symbol geometry at every render; an orthogonal router
chooses among candidate paths using the port directions. Documents are saved as JSON.

The symbol library is generated by a reproducible pipeline (`tools/iso-symbols`). A headless
browser (Playwright) opens the seven source sheets, detects each group from its dashed frame,
cuts out every symbol with its registration number and description, and converts the marked
connection locations into ports. A second step adds French and Dutch names and default tag
prefixes, and a third step normalises all stroke widths so that every symbol shares the same
line weight regardless of the transforms inherited from the sheets. Running the pipeline
reproduces the shipped symbol file byte for byte.

The interface texts are stored in one dictionary per language, so a new language can be added
without changing the editor code. Automated tests drive the application in a headless browser
and check the symbol library, port attachment, language switching, line weights and SVG export
on every commit.

# Research impact statement

TODO (author): JOSS requires specific evidence, not intentions. Give for example:
the course name(s), year and number of students who used PFD Studio; teaching material or
exams produced with it; publications, theses or reports whose figures were drawn with it; other
institutions or users who adopted it (issues, forks, downloads); feedback received.

# AI usage disclosure

Generative AI was used to develop this software. TODO (author): complete and check this section.

- Tool: Claude (Anthropic), used through the Claude app and Claude Code. TODO: model name and version.
- Scope: generation of most of the application code, the symbol-extraction pipeline, the French
  and Dutch translations of symbol names, the automated tests, the documentation and a first draft
  of this paper.
- Human contribution and verification: TODO (author): describe what you specified and decided
  (requirements, choice of a local application, use of the ISO 10628 grouping, user-defined ports,
  attached lines, languages, licensing), how you reviewed and tested the code and the symbols
  against the standard, and which parts you modified. The author takes full responsibility for
  the content of the software and of this paper.

# Acknowledgements

The ISO 10628-2 symbols are derived from the sheets by Steven Baltakatei Sandoval, published on
Wikimedia Commons under CC BY-SA 4.0. TODO (author): acknowledge colleagues, students who tested
the software, and any funding (or state that there was no specific funding).

# References
