/*
 * Bibliothèque de symboles inspirée de l'ISO 10628-2 (schémas de procédé).
 *
 * HYPOTHÈSE : les dessins sont des reproductions simplifiées faites à la main
 * d'après la forme générale des symboles de la norme. Ils ne sont pas copiés
 * de la norme officielle et doivent être vérifiés par rapport à votre édition
 * de l'ISO 10628-2 avant usage contractuel.
 *
 * Format d'un symbole :
 *   id, nom, catégorie, largeur, hauteur (unités locales), markup SVG,
 *   ports par défaut [x, y, direction], options.
 * Classes CSS dans le markup : o = sans remplissage, f = rempli (noir),
 *   d = pointillé, t = texte.
 */
(function () {
  'use strict';

  const CATEGORIES = [];
  const SYMBOLS = {};
  let currentCat = null;

  function cat(id, name, prefix, opts) {
    opts = opts || {};
    currentCat = { id, name, prefix, symbols: [], hidden: !!opts.hidden, names: opts.names, section: opts.section || 'legacy' };
    CATEGORIES.push(currentCat);
  }

  function S(id, name, w, h, svg, ports, opts) {
    const o = Object.assign({ showTag: true }, opts || {});
    const sym = {
      id, name, w, h, svg,
      cat: currentCat.id,
      catName: currentCat.name,
      prefix: o.prefix !== undefined ? o.prefix : currentCat.prefix,
      showTag: o.showTag,
      tagInside: !!o.tagInside,
      keywords: o.keywords || '',
      names: o.names,
      ports: (ports || []).map(function (p) {
        return { x: p[0], y: p[1], dir: p[2] || autoDir(p[0], p[1], w, h) };
      })
    };
    SYMBOLS[id] = sym;
    currentCat.symbols.push(sym);
  }

  // Direction d'un port selon le bord le plus proche
  function autoDir(x, y, w, h) {
    const d = [
      ['l', x], ['r', w - x], ['u', y], ['d', h - y]
    ];
    d.sort(function (a, b) { return a[1] - b[1]; });
    return d[0][0];
  }

  // Petits utilitaires de dessin
  function wave(x0, x1, y, amp, n) {
    const step = (x1 - x0) / n;
    let d = 'M' + x0 + ',' + y;
    for (let i = 0; i < n; i++) {
      const xa = x0 + step * i + step / 2;
      const xb = x0 + step * (i + 1);
      d += ' Q' + xa + ',' + (y + (i % 2 ? amp : -amp)) + ' ' + xb + ',' + y;
    }
    return d;
  }
  function zigzag(x0, x1, y, amp, n) {
    const step = (x1 - x0) / n;
    let d = 'M' + x0 + ',' + y;
    for (let i = 1; i < n; i++) d += ' L' + (x0 + step * i) + ',' + (y + (i % 2 ? -amp : amp));
    d += ' L' + x1 + ',' + y;
    return d;
  }

  const VV = 'M0,14 A20,14 0 0 1 40,14 V66 A20,14 0 0 1 0,66 Z';          // récipient vertical 40x80
  const VH = 'M14,0 H76 A14,20 0 0 1 76,40 H14 A14,20 0 0 1 14,0 Z';      // récipient horizontal 90x40
  const COL = 'M0,14 A20,14 0 0 1 40,14 V146 A20,14 0 0 1 0,146 Z';        // colonne 40x160
  const BOW = 'M0,0 L40,20 V0 L0,20 Z';                                     // vanne 40x20
  const PUMPC = '<circle cx="20" cy="20" r="20"/>';

  // ------------------------------------------------------------------
  cat('vessels', 'Récipients et réservoirs', 'B', { hidden: true });
  S('vessel_general', 'Récipient (général)', 50, 70,
    '<rect x="0" y="0" width="50" height="70" rx="3"/>',
    [[25, 0], [25, 70], [0, 35], [50, 35]], { keywords: 'cuve ballon vessel' });
  S('vessel_vertical', 'Récipient vertical à fonds bombés', 40, 80,
    '<path d="' + VV + '"/>',
    [[20, 0], [20, 80], [0, 40], [40, 40], [0, 60], [40, 20]], { keywords: 'ballon pression vessel drum' });
  S('vessel_horizontal', 'Récipient horizontal à fonds bombés', 90, 40,
    '<path d="' + VH + '"/>',
    [[0, 20], [90, 20], [45, 0], [45, 40], [25, 0], [65, 40]], { keywords: 'ballon pression drum' });
  S('tank_fixed_roof', 'Réservoir à toit fixe', 70, 60,
    '<path d="M0,12 Q35,-2 70,12 V60 H0 Z"/>',
    [[35, 5, 'u'], [0, 45], [70, 45], [35, 60]], { keywords: 'bac stockage tank' });
  S('tank_floating_roof', 'Réservoir à toit flottant', 70, 60,
    '<path d="M0,0 V60 H70 V0"/><path class="o" d="M2,16 H68 M2,16 L8,10 M68,16 L62,10"/>',
    [[0, 45], [70, 45], [35, 60]], { keywords: 'bac stockage tank' });
  S('basin_open', 'Bassin / cuve ouverte', 80, 50,
    '<path d="M0,0 V50 H80 V0"/><path class="o" d="' + wave(6, 74, 12, 2, 8) + '"/>',
    [[40, 0, 'u'], [0, 35], [80, 35], [40, 50]], { keywords: 'fosse open tank' });
  S('sphere', 'Réservoir sphérique', 60, 70,
    '<path class="o" d="M10,52 L4,70 M50,52 L56,70"/><circle cx="30" cy="30" r="30"/>',
    [[30, 0], [30, 60, 'd'], [0, 30], [60, 30]], { keywords: 'sphere gpl' });
  S('gas_holder', 'Gazomètre', 70, 70,
    '<rect x="0" y="22" width="70" height="48"/><path d="M8,40 V10 Q35,-4 62,10 V40 Z"/>',
    [[35, 3, 'u'], [0, 55], [70, 55], [35, 70]], { keywords: 'gas holder' });
  S('gas_cylinder', 'Bouteille de gaz', 24, 66,
    '<rect x="9" y="0" width="6" height="6"/><path d="M0,18 A12,12 0 0 1 24,18 V66 H0 Z"/>',
    [[12, 0]], { keywords: 'cylindre gaz' });
  S('silo', 'Silo / trémie', 60, 80,
    '<path d="M0,0 H60 V45 L36,80 H24 L0,45 Z"/>',
    [[30, 0], [30, 80], [0, 20], [60, 20]], { keywords: 'hopper trémie' });
  S('drum', 'Fût / conteneur', 40, 50,
    '<rect x="0" y="0" width="40" height="50" rx="3"/><path class="o" d="M0,12 H40 M0,38 H40"/>',
    [[20, 0], [20, 50]], { keywords: 'baril container' });

  // ------------------------------------------------------------------
  cat('columns', 'Colonnes', 'C', { hidden: true });
  S('column', 'Colonne (général)', 40, 160,
    '<path d="' + COL + '"/>',
    [[20, 0], [20, 160], [0, 40], [0, 80], [0, 120], [40, 40], [40, 80], [40, 120]], { keywords: 'tour distillation' });
  S('column_trays', 'Colonne à plateaux', 40, 160,
    '<path d="' + COL + '"/><path class="o" d="M0,40 H28 M12,56 H40 M0,72 H28 M12,88 H40 M0,104 H28 M12,120 H40"/>',
    [[20, 0], [20, 160], [0, 30], [0, 80], [0, 130], [40, 30], [40, 80], [40, 130]], { keywords: 'distillation tray' });
  S('column_packed', 'Colonne à garnissage', 40, 160,
    '<path d="' + COL + '"/><path class="o" d="M0,45 H40 M0,115 H40 M0,45 L40,115 M40,45 L0,115"/>',
    [[20, 0], [20, 160], [0, 30], [0, 130], [40, 30], [40, 130], [0, 80], [40, 80]], { keywords: 'absorption packing' });
  S('column_packed_2', 'Colonne à garnissage (2 lits)', 40, 160,
    '<path d="' + COL + '"/><path class="o" d="M0,30 H40 M0,70 H40 M0,30 L40,70 M40,30 L0,70 M0,90 H40 M0,130 H40 M0,90 L40,130 M40,90 L0,130"/>',
    [[20, 0], [20, 160], [0, 20], [0, 80], [0, 140], [40, 20], [40, 80], [40, 140]], { keywords: 'absorption packing' });

  // ------------------------------------------------------------------
  cat('hx', 'Échangeurs de chaleur', 'E', { hidden: true });
  S('hx_general', 'Échangeur de chaleur (général)', 50, 50,
    '<circle cx="25" cy="25" r="25"/><path class="o" d="M0,25 H10 L17,12 L33,38 L40,25 H50"/>',
    [[0, 25], [50, 25], [25, 0], [25, 50]], { keywords: 'heat exchanger' });
  S('hx_shell_tube', 'Échangeur à tubes et calandre', 110, 44,
    '<rect x="0" y="0" width="110" height="44" rx="4"/><path class="o" d="M0,14 H90 A8,8 0 0 1 90,30 H0"/><path class="o" d="M14,0 V44"/>',
    [[0, 14, 'l'], [0, 30, 'l'], [30, 0], [95, 44], [95, 0], [30, 44]], { keywords: 'faisceau tubulaire shell tube' });
  S('hx_double_pipe', 'Échangeur double tube', 100, 30,
    '<rect x="0" y="5" width="100" height="20"/><path class="o" d="M0,15 H100"/>',
    [[0, 15], [100, 15], [12, 5, 'u'], [88, 25, 'd']], { keywords: 'double pipe' });
  S('hx_plate', 'Échangeur à plaques', 40, 60,
    '<rect x="0" y="0" width="40" height="60"/><path class="o" d="M0,12 L40,22 M0,22 L40,32 M0,32 L40,42 M0,42 L40,52"/>',
    [[0, 6], [40, 6], [0, 54], [40, 54]], { keywords: 'plate' });
  S('hx_coil', 'Serpentin', 60, 40,
    '<path class="o" d="' + zigzag(0, 60, 20, 14, 8) + '"/>',
    [[0, 20], [60, 20]], { keywords: 'coil chauffage' });
  S('hx_air_cooler', 'Aéroréfrigérant', 80, 50,
    '<rect x="0" y="0" width="80" height="20"/><path class="o" d="' + zigzag(6, 74, 10, 6, 10) + '"/>' +
    '<circle cx="40" cy="38" r="12"/><path class="o" d="M28,38 Q34,32 40,38 Q46,44 52,38 M40,26 Q34,32 40,38 Q46,44 40,50"/>',
    [[0, 10], [80, 10]], { keywords: 'air cooler aerorefrigerant' });
  S('cooling_tower', 'Tour de refroidissement', 60, 80,
    '<path d="M4,0 Q20,45 0,80 H60 Q40,45 56,0 Z"/>',
    [[30, 0], [4, 62, 'l'], [56, 62, 'r'], [30, 80]], { keywords: 'cooling tower aéro' });
  S('reboiler_kettle', 'Rebouilleur type kettle', 110, 50,
    '<path d="M0,18 H25 L40,0 H95 A15,25 0 0 1 95,50 H0 Z"/><path class="o" d="M0,28 H85 A7,7 0 0 1 85,42 H0"/>',
    [[0, 28, 'l'], [0, 42, 'l'], [70, 0], [60, 50]], { keywords: 'kettle rebouilleur' });
  S('heater_electric', 'Réchauffeur électrique', 60, 40,
    '<rect x="0" y="0" width="60" height="40"/><path class="o" d="' + zigzag(10, 50, 20, 9, 6) + '"/>',
    [[0, 20], [60, 20]], { keywords: 'résistance electric heater' });
  S('furnace', 'Four / chaudière', 80, 100,
    '<path d="M0,100 V40 L20,0 H60 L80,40 V100 Z"/><path class="o" d="M0,40 H80"/>' +
    '<path class="o" d="M32,92 Q26,80 35,68 Q37,78 41,72 Q48,84 44,92 Z"/>',
    [[40, 0], [0, 60], [80, 60], [0, 85], [80, 85]], { keywords: 'fired heater four chaudière boiler' });

  // ------------------------------------------------------------------
  cat('pumps', 'Pompes', 'P', { hidden: true });
  S('pump_general', 'Pompe (général) / centrifuge', 40, 40,
    PUMPC + '<path class="o" d="M5.86,5.86 L40,20 L5.86,34.14"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'centrifugal pump' });
  S('pump_piston', 'Pompe à piston', 40, 40,
    PUMPC + '<path class="o" d="M9,12 H23 V28 H9 M23,20 H33"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'reciprocating volumétrique' });
  S('pump_gear', 'Pompe à engrenages', 40, 40,
    PUMPC + '<circle class="o" cx="20" cy="13" r="6"/><circle class="o" cx="20" cy="27" r="6"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'gear volumétrique' });
  S('pump_screw', 'Pompe à vis', 40, 40,
    PUMPC + '<path class="o" d="M4,20 C10,6 14,6 20,20 S30,34 36,20"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'screw volumétrique' });
  S('pump_diaphragm', 'Pompe à membrane', 40, 40,
    PUMPC + '<path class="o" d="M12,6 Q24,20 12,34 M18,20 H34"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'diaphragm doseuse' });
  S('pump_rotary', 'Pompe rotative à palettes', 40, 40,
    PUMPC + '<circle class="o" cx="20" cy="20" r="9"/><path class="o" d="M20,11 V5 M20,29 V35 M11,20 H5 M29,20 H35"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'vane rotative' });
  S('pump_vertical', 'Pompe verticale immergée', 40, 70,
    '<rect x="14" y="38" width="12" height="32"/>' + PUMPC + '<path class="o" d="M5.86,5.86 L40,20 L5.86,34.14"/>',
    [[20, 70], [40, 20], [20, 0]], { keywords: 'submersible puisard' });
  S('ejector', 'Éjecteur / pompe à jet', 70, 30,
    '<path d="M0,5 H20 L45,12 L70,4 V26 L45,18 L20,25 H0 Z"/><path class="o" d="M32,21 V30"/>',
    [[0, 15], [70, 15], [32, 30, 'd']], { keywords: 'jet pump venturi ejector' });

  // ------------------------------------------------------------------
  cat('compressors', 'Compresseurs et ventilateurs', 'K', { hidden: true });
  S('compressor_general', 'Compresseur (général) / centrifuge', 40, 40,
    PUMPC + '<path class="o" d="M5.86,5.86 L38.7,13 M5.86,34.14 L38.7,27"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'compressor' });
  S('compressor_piston', 'Compresseur à piston', 40, 40,
    PUMPC + '<path class="o" d="M5.86,5.86 L38.7,13 M5.86,34.14 L38.7,27 M12,16 H22 V24 H12"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'reciprocating' });
  S('compressor_screw', 'Compresseur à vis', 40, 40,
    PUMPC + '<path class="o" d="M5.86,5.86 L38.7,13 M5.86,34.14 L38.7,27 M8,20 C12,12 16,12 20,20 S28,28 32,20"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'screw' });
  S('compressor_turbo', 'Turbocompresseur / axial', 60, 50,
    '<path d="M0,0 L60,15 V35 L0,50 Z"/>',
    [[0, 25], [60, 25]], { keywords: 'axial turbo' });
  S('fan', 'Ventilateur', 40, 40,
    PUMPC + '<path class="o" d="M20,20 Q12,10 20,4 Q26,12 20,20 Q30,12 36,20 Q28,26 20,20 Q28,30 20,36 Q14,28 20,20 Q10,28 4,20 Q12,14 20,20"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'fan blower' });
  S('blower_roots', 'Soufflante à lobes (Roots)', 40, 40,
    PUMPC + '<circle class="o" cx="13" cy="20" r="7"/><circle class="o" cx="27" cy="20" r="7"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'roots blower surpresseur' });
  S('vacuum_pump', 'Pompe à vide', 40, 40,
    PUMPC + '<path class="o" d="M1.3,13 L34.14,5.86 M1.3,27 L34.14,34.14"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'vacuum' });

  // ------------------------------------------------------------------
  cat('valves', 'Vannes et robinetterie', 'V', { hidden: true });
  const vOpt = { showTag: false };
  S('valve_general', 'Vanne (général) / robinet-vanne', 40, 20,
    '<path d="' + BOW + '"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'gate valve robinet' }, vOpt));
  S('valve_globe', 'Vanne à soupape', 40, 20,
    '<path d="' + BOW + '"/><circle class="f" cx="20" cy="10" r="3.5"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'globe' }, vOpt));
  S('valve_ball', 'Robinet à tournant sphérique', 40, 20,
    '<path d="' + BOW + '"/><circle cx="20" cy="10" r="6"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'ball valve' }, vOpt));
  S('valve_plug', 'Robinet à boisseau', 40, 20,
    '<path d="' + BOW + '"/><rect x="16" y="3" width="8" height="14"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'plug cock' }, vOpt));
  S('valve_butterfly', 'Vanne papillon', 40, 20,
    '<path class="o" d="M0,0 V20 M40,0 V20 M0,10 H8 M32,10 H40 M6,18 L34,2"/><circle class="f" cx="20" cy="10" r="3"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'butterfly' }, vOpt));
  S('valve_check', 'Clapet anti-retour', 40, 20,
    '<path d="' + BOW + '"/><path class="f" d="M20,10 L40,0 V20 Z"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'check non-return clapet' }, vOpt));
  S('valve_needle', 'Vanne à pointeau', 40, 20,
    '<path d="' + BOW + '"/><path class="f" d="M20,10 L15,0 H25 Z"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'needle' }, vOpt));
  S('valve_diaphragm', 'Vanne à membrane', 40, 30,
    '<path d="M0,10 L40,30 V10 L0,30 Z"/><path class="o" d="M8,10 Q20,-2 32,10"/>', [[0, 20], [40, 20]], Object.assign({ keywords: 'diaphragm' }, vOpt));
  S('valve_angle', "Vanne d'équerre", 30, 30,
    '<path d="M0,5 L15,15 L0,25 Z"/><path d="M5,30 L15,15 L25,30 Z"/>', [[0, 15], [15, 30]], Object.assign({ keywords: 'angle' }, vOpt));
  S('valve_3way', 'Vanne 3 voies', 40, 30,
    '<path d="' + BOW + '"/><path d="M10,30 L20,10 L30,30 Z"/>', [[0, 10], [40, 10], [20, 30]], Object.assign({ keywords: 'three way 3 voies' }, vOpt));
  S('valve_control', 'Vanne de régulation (servomoteur)', 40, 40,
    '<path d="M8,12 A12,12 0 0 1 32,12 Z"/><path class="o" d="M20,12 V30"/><path d="M0,20 L40,40 V20 L0,40 Z"/>',
    [[0, 30], [40, 30]], { keywords: 'control valve régulation', prefix: 'V', showTag: true });
  S('valve_solenoid', 'Électrovanne', 40, 40,
    '<rect x="12" y="0" width="16" height="12"/><text class="t" x="20" y="10">S</text><path class="o" d="M20,12 V30"/><path d="M0,20 L40,40 V20 L0,40 Z"/>',
    [[0, 30], [40, 30]], Object.assign({ keywords: 'solenoid électrovanne' }, vOpt));
  S('valve_manual', 'Vanne manuelle (volant)', 40, 34,
    '<path class="o" d="M10,2 H30 M20,2 V24"/><path d="M0,14 L40,34 V14 L0,34 Z"/>',
    [[0, 24], [40, 24]], Object.assign({ keywords: 'hand wheel manuelle' }, vOpt));
  S('valve_safety', 'Soupape de sûreté', 30, 42,
    '<path d="M5,42 L15,27 L25,42 Z"/><path d="M30,17 L15,27 L30,37 Z"/><path class="o" d="M15,27 V22 L9,19 L21,15 L9,11 L21,7 L15,4 V0"/>',
    [[15, 42], [30, 27]], { keywords: 'safety relief psv soupape', prefix: 'PSV', showTag: true });
  S('pressure_reducer', 'Détendeur / réducteur de pression', 40, 36,
    '<path d="M0,16 L40,36 V16 L0,36 Z"/><path class="o" d="M20,26 V14 L14,11 L26,7 L14,3 L20,0"/><path class="o" d="M20,14 H34 V20"/>',
    [[0, 26], [40, 26]], Object.assign({ keywords: 'pressure reducing détendeur' }, vOpt));
  S('rupture_disc', 'Disque de rupture', 30, 30,
    '<path class="o" d="M0,15 H11 M19,15 H30 M11,3 V27 M19,3 V27"/><path class="o" d="M11,5 Q22,15 11,25"/>',
    [[0, 15], [30, 15]], { keywords: 'bursting disc rupture', prefix: 'PSE', showTag: true });

  // ------------------------------------------------------------------
  cat('separators', 'Filtres et séparateurs', 'F', { hidden: true });
  S('filter_liquid', 'Filtre à liquide (général)', 40, 40,
    '<path d="M20,0 L40,20 L20,40 L0,20 Z"/><path class="o d" d="M0,20 H40"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'filter' });
  S('filter_gas', 'Filtre à gaz', 40, 40,
    '<path d="M20,0 L40,20 L20,40 L0,20 Z"/><path class="o d" d="M20,0 V40"/>',
    [[0, 20], [40, 20], [20, 0], [20, 40]], { keywords: 'gas filter' });
  S('filter_press', 'Filtre-presse', 80, 40,
    '<rect x="0" y="0" width="80" height="40"/><path class="o" d="M10,0 V40 M20,0 V40 M30,0 V40 M40,0 V40 M50,0 V40 M60,0 V40 M70,0 V40"/>',
    [[0, 20], [80, 20], [40, 40]], { keywords: 'press filter' });
  S('filter_bag', 'Filtre à manches', 50, 80,
    '<path d="M0,0 H50 V55 L30,80 H20 L0,55 Z"/><path class="o d" d="M10,8 V45 M20,8 V45 M30,8 V45 M40,8 V45"/>',
    [[0, 35], [50, 12], [25, 80]], { keywords: 'bag filter dépoussiéreur' });
  S('filter_rotary', 'Filtre rotatif sous vide', 60, 50,
    '<path d="M0,22 V50 H60 V22"/><circle cx="30" cy="22" r="20"/><circle class="o d" cx="30" cy="22" r="14"/>',
    [[0, 40], [60, 40], [30, 2, 'u'], [30, 50]], { keywords: 'rotary drum vacuum' });
  S('cyclone', 'Cyclone', 40, 80,
    '<path d="M0,0 H40 V30 L25,80 H15 L0,30 Z"/><path class="o" d="M14,0 V16 H26 V0"/>',
    [[20, 0], [0, 10], [20, 80]], { keywords: 'cyclone hydrocyclone' });
  S('separator_gravity', 'Séparateur / décanteur', 100, 40,
    '<path d="M14,0 H86 A14,20 0 0 1 86,40 H14 A14,20 0 0 1 14,0 Z"/><path class="o" d="M66,40 V16"/>',
    [[0, 20], [50, 0], [40, 40], [82, 40], [100, 20]], { keywords: 'separator settler decanter' });
  S('separator_droplet', 'Séparateur de gouttes / dévésiculeur', 40, 80,
    '<path d="' + VV + '"/><path class="o" d="' + zigzag(0, 40, 20, 4, 8) + '"/>',
    [[20, 0], [20, 80], [0, 45], [40, 45]], { keywords: 'demister knock-out' });
  S('screen', 'Tamis / crible', 60, 40,
    '<rect x="0" y="0" width="60" height="40"/><path class="o d" d="M0,40 L60,0"/>',
    [[30, 0], [0, 30], [60, 30], [30, 40]], { keywords: 'screen sieve' });
  S('esp', 'Électrofiltre', 70, 60,
    '<path d="M0,0 H70 V45 L45,60 H25 L0,45 Z"/><path class="o" d="M40,6 L28,24 H42 L30,42"/>',
    [[0, 22], [70, 22], [35, 60]], { keywords: 'electrostatic precipitator' });

  // ------------------------------------------------------------------
  cat('centrifuges', 'Centrifugeuses', 'Z', { hidden: true });
  S('centrifuge', 'Centrifugeuse (général)', 60, 50,
    '<rect x="0" y="0" width="60" height="50" rx="6"/><path class="o" d="M10,8 V38 Q10,44 16,44 H44 Q50,44 50,38 V8 M30,0 V44"/>',
    [[0, 15], [60, 15], [30, 50]], { keywords: 'centrifuge essoreuse' });
  S('centrifuge_decanter', 'Décanteuse centrifuge', 100, 40,
    '<path d="M0,10 L20,0 H80 L100,15 V25 L80,40 H20 L0,30 Z"/><path class="o" d="' + zigzag(10, 90, 20, 6, 10) + '"/>',
    [[0, 20], [100, 20], [50, 40], [50, 0]], { keywords: 'decanter' });

  // ------------------------------------------------------------------
  cat('mixers', 'Mélangeurs et agitateurs', 'R', { hidden: true });
  S('agitator', 'Agitateur (général)', 30, 50,
    '<path class="o" d="M15,0 V44 M3,44 H27"/>', [[15, 0]], { keywords: 'stirrer agitateur', showTag: false });
  S('agitator_propeller', 'Agitateur à hélice', 30, 50,
    '<path class="o" d="M15,0 V42"/><path class="f" d="M15,42 L3,36 V48 Z M15,42 L27,36 V48 Z"/>', [[15, 0]], { keywords: 'propeller', showTag: false });
  S('agitator_anchor', 'Agitateur à ancre', 30, 50,
    '<path class="o" d="M15,0 V48 M3,22 V38 Q3,48 15,48 Q27,48 27,38 V22"/>', [[15, 0]], { keywords: 'anchor', showTag: false });
  S('agitator_turbine', 'Agitateur à turbine', 30, 50,
    '<path class="o" d="M15,0 V38"/><rect x="3" y="38" width="24" height="8"/>', [[15, 0]], { keywords: 'turbine rushton', showTag: false });
  S('reactor_agitated', 'Réacteur agité (avec moteur)', 60, 104,
    '<path d="M0,40 A30,14 0 0 1 60,40 V90 A30,14 0 0 1 0,90 Z"/><path class="o" d="M30,20 V86"/><path class="f" d="M30,86 L18,80 V92 Z M30,86 L42,80 V92 Z"/>' +
    '<circle cx="30" cy="10" r="10"/><text class="t" x="30" y="14">M</text>',
    [[12, 29, 'u'], [48, 29, 'u'], [0, 55], [60, 55], [0, 80], [60, 80], [30, 104]], { keywords: 'reactor cuve agitée', prefix: 'R' });
  S('mixer_general', 'Mélangeur (général)', 60, 40,
    '<path d="M0,0 H60 V20 A30,20 0 0 1 0,20 Z"/><path class="o" d="M14,12 Q30,30 46,12"/>',
    [[15, 0], [45, 0], [30, 40]], { keywords: 'mixer' });
  S('mixer_static', 'Mélangeur statique', 80, 24,
    '<rect x="0" y="0" width="80" height="24"/><path class="o" d="M8,0 L20,24 L32,0 L44,24 L56,0 L68,24 L74,12"/>',
    [[0, 12], [80, 12]], { keywords: 'static inline' });
  S('kneader', 'Malaxeur / pétrin', 70, 40,
    '<rect x="0" y="0" width="70" height="40" rx="4"/><circle class="o" cx="22" cy="20" r="12"/><circle class="o" cx="48" cy="20" r="12"/><path class="o" d="M14,12 L30,28 M30,12 L14,28 M40,12 L56,28 M56,12 L40,28"/>',
    [[10, 0], [60, 40], [0, 20], [70, 20]], { keywords: 'kneader malaxeur' });

  // ------------------------------------------------------------------
  cat('dryers', 'Séchoirs', 'D', { hidden: true });
  S('dryer', 'Séchoir (général)', 60, 50,
    '<rect x="0" y="0" width="60" height="50"/><path class="o" d="' + wave(8, 52, 17, 4, 6) + ' ' + wave(8, 52, 33, 4, 6) + '"/>',
    [[0, 25], [60, 25], [30, 0], [30, 50]], { keywords: 'dryer sécheur' });
  S('dryer_rotary', 'Séchoir rotatif (tambour)', 100, 40,
    '<path d="M0,8 L100,0 V30 L0,38 Z"/><path class="o" d="M25,6 V36 M75,2 V32"/>',
    [[0, 23], [100, 15]], { keywords: 'rotary drum' });
  S('dryer_spray', 'Tour de séchage par atomisation', 60, 90,
    '<path d="M0,0 H60 V55 L35,90 H25 L0,55 Z"/><path class="o" d="M30,0 V12 M30,12 L20,26 M30,12 V28 M30,12 L40,26"/>',
    [[30, 0], [0, 40], [60, 15], [30, 90]], { keywords: 'spray dryer atomiseur' });
  S('dryer_fluid_bed', 'Séchoir à lit fluidisé', 60, 70,
    '<rect x="0" y="0" width="60" height="70"/><path class="o d" d="M0,50 H60"/><path class="o" d="M10,44 h.1 M22,40 h.1 M34,44 h.1 M46,40 h.1 M16,32 h.1 M28,28 h.1 M40,32 h.1" style="stroke-width:3;stroke-linecap:round"/>',
    [[30, 0], [0, 30], [60, 40], [30, 70]], { keywords: 'fluid bed' });

  // ------------------------------------------------------------------
  cat('size', 'Broyage et concassage', 'M', { hidden: true });
  S('crusher', 'Concasseur (général)', 60, 50,
    '<path d="M0,0 H60 L40,50 H20 Z"/><path class="o" d="M12,8 L26,44 M48,8 L34,44"/>',
    [[30, 0], [30, 50]], { keywords: 'crusher concasseur' });
  S('crusher_roll', 'Concasseur à cylindres', 60, 40,
    '<circle cx="16" cy="20" r="14"/><circle cx="44" cy="20" r="14"/><circle class="f" cx="16" cy="20" r="2"/><circle class="f" cx="44" cy="20" r="2"/>',
    [[30, 0, 'u'], [30, 40, 'd']], { keywords: 'roll crusher' });
  S('mill_ball', 'Broyeur à boulets', 100, 44,
    '<rect x="0" y="0" width="100" height="44" rx="8"/><circle class="o" cx="30" cy="32" r="5"/><circle class="o" cx="44" cy="34" r="5"/><circle class="o" cx="58" cy="32" r="5"/><circle class="o" cx="72" cy="34" r="5"/><circle class="o" cx="51" cy="24" r="5"/>',
    [[0, 22], [100, 22]], { keywords: 'ball mill broyeur' });
  S('mill_hammer', 'Broyeur à marteaux', 50, 50,
    '<circle cx="25" cy="25" r="25"/><circle class="f" cx="25" cy="25" r="3"/><path class="o" d="M25,25 L25,8 M25,25 L40,33 M25,25 L10,33"/><path class="f" d="M21,6 H29 V12 H21 Z"/>',
    [[25, 0], [25, 50]], { keywords: 'hammer mill' });

  // ------------------------------------------------------------------
  cat('conveyors', 'Convoyeurs et manutention', 'T', { hidden: true });
  S('conveyor_belt', 'Convoyeur à bande', 120, 24,
    '<path class="o" d="M12,0 H108 A12,12 0 0 1 108,24 H12 A12,12 0 0 1 12,0 Z"/><circle cx="12" cy="12" r="8"/><circle cx="108" cy="12" r="8"/>',
    [[20, 0, 'u'], [120, 12]], { keywords: 'belt conveyor tapis' });
  S('conveyor_screw', 'Convoyeur à vis', 120, 24,
    '<rect x="0" y="0" width="120" height="24"/><path class="o" d="' + wave(4, 116, 12, 9, 14) + '"/>',
    [[10, 0, 'u'], [110, 24, 'd']], { keywords: 'screw conveyor vis' });
  S('conveyor_chain', 'Convoyeur à chaîne / raclettes', 120, 24,
    '<rect x="0" y="0" width="120" height="24"/><path class="o d" d="M6,8 H114 M6,16 H114"/>',
    [[10, 0, 'u'], [110, 24, 'd']], { keywords: 'chain scraper' });
  S('bucket_elevator', 'Élévateur à godets', 40, 140,
    '<rect x="0" y="0" width="40" height="140" rx="20"/><path class="o" d="M12,20 V120 M28,20 V120 M28,40 h6 M28,70 h6 M28,100 h6 M12,55 h-6 M12,85 h-6"/>',
    [[40, 22, 'r'], [0, 125, 'l']], { keywords: 'bucket elevator' });
  S('rotary_feeder', 'Écluse rotative / doseur', 40, 40,
    '<rect x="0" y="0" width="40" height="40"/><circle cx="20" cy="20" r="14"/><path class="o" d="M20,6 V34 M6,20 H34 M10,10 L30,30 M30,10 L10,30"/>',
    [[20, 0], [20, 40]], { keywords: 'rotary valve feeder doseur' });
  S('weigher', 'Bascule / pesage', 60, 40,
    '<path d="M0,30 H60 V40 H0 Z"/><path class="o" d="M10,30 L18,8 H42 L50,30 M30,8 V0"/>',
    [[30, 0, 'u']], { keywords: 'weighing balance pesage' });

  // ------------------------------------------------------------------
  cat('drives', 'Moteurs et entraînements', 'M', { hidden: true });
  S('motor', 'Moteur électrique', 40, 40,
    '<circle cx="20" cy="20" r="20"/><text class="t" x="20" y="25" style="font-size:14px">M</text>',
    [[20, 40], [0, 20], [40, 20], [20, 0]], { keywords: 'motor moteur' });
  S('motor_variable', 'Moteur à vitesse variable', 40, 40,
    '<circle cx="20" cy="20" r="20"/><text class="t" x="20" y="25" style="font-size:14px">M</text><path class="o" d="M6,34 L34,6 M34,6 L27,8 M34,6 L32,13"/>',
    [[20, 40], [0, 20], [40, 20], [20, 0]], { keywords: 'variable speed vfd' });
  S('turbine', 'Turbine', 60, 50,
    '<path d="M0,15 L60,0 V50 L0,35 Z"/>',
    [[0, 25], [60, 25]], { keywords: 'turbine vapeur gaz steam' });
  S('engine', 'Moteur thermique', 50, 40,
    '<rect x="0" y="0" width="50" height="40"/><text class="t" x="25" y="25" style="font-size:14px">E</text>',
    [[50, 20], [25, 40]], { keywords: 'engine diesel moteur' });

  // ------------------------------------------------------------------
  cat('fittings', 'Raccords et accessoires', '', { hidden: true });
  const fOpt = { showTag: false };
  S('junction', 'Point de jonction', 8, 8,
    '<circle class="f" cx="4" cy="4" r="4"/>', [[0, 4, 'l'], [8, 4, 'r'], [4, 0, 'u'], [4, 8, 'd']], Object.assign({ keywords: 'tee té piquage jonction' }, fOpt));
  S('reducer', 'Réduction', 30, 20,
    '<path d="M0,0 L30,5 V15 L0,20 Z"/>', [[0, 10], [30, 10]], Object.assign({ keywords: 'reducer réducteur' }, fOpt));
  S('blind_flange', 'Bride pleine / obturateur', 12, 24,
    '<path class="o" d="M0,12 H7 M7,0 V24" style="stroke-width:3"/>', [[0, 12]], Object.assign({ keywords: 'blind cap' }, fOpt));
  S('spectacle_blind', 'Joint à lunette', 30, 30,
    '<path class="o" d="M0,7 H9 M21,7 H30 M15,13 V17"/><circle class="o" cx="15" cy="7" r="6"/><circle class="f" cx="15" cy="23" r="6"/>', [[0, 7], [30, 7]], Object.assign({ keywords: 'spectacle blind' }, fOpt));
  S('strainer', 'Crépine / filtre en ligne', 40, 20,
    '<path class="o" d="M0,10 H8 M32,10 H40"/><rect x="8" y="0" width="24" height="20"/><path class="o d" d="M8,20 L32,0"/>', [[0, 10], [40, 10]], Object.assign({ keywords: 'strainer y' }, fOpt));
  S('steam_trap', 'Purgeur de vapeur', 30, 30,
    '<path class="o" d="M0,15 H3 M27,15 H30"/><circle cx="15" cy="15" r="12"/><path class="f" d="M15,3 A12,12 0 0 1 15,27 Z"/>', [[0, 15], [30, 15]], Object.assign({ keywords: 'steam trap purgeur' }, fOpt));
  S('flame_arrestor', 'Arrête-flammes', 30, 24,
    '<path class="o" d="M0,12 H4 M26,12 H30"/><rect x="4" y="0" width="22" height="24"/><path class="o" d="M4,0 L26,24 M26,0 L4,24"/>', [[0, 12], [30, 12]], Object.assign({ keywords: 'flame arrester' }, fOpt));
  S('silencer', 'Silencieux', 50, 24,
    '<path class="o" d="M0,12 H8 M42,12 H50"/><rect x="8" y="0" width="34" height="24" rx="4"/><path class="o" d="M16,0 V24 M25,0 V24 M34,0 V24"/>', [[0, 12], [50, 12]], Object.assign({ keywords: 'silencer muffler' }, fOpt));
  S('sight_glass', 'Voyant', 30, 24,
    '<path class="o" d="M0,12 H5 M25,12 H30"/><rect x="5" y="2" width="20" height="20"/><circle class="o" cx="15" cy="12" r="6"/>', [[0, 12], [30, 12]], Object.assign({ keywords: 'sight glass' }, fOpt));
  S('expansion_joint', 'Compensateur de dilatation', 30, 20,
    '<path class="o" d="M0,10 H5 M25,10 H30 M5,0 V20 M25,0 V20 M5,0 L10,5 L15,0 L20,5 L25,0 M5,20 L10,15 L15,20 L20,15 L25,20"/>', [[0, 10], [30, 10]], Object.assign({ keywords: 'expansion bellows soufflet' }, fOpt));
  S('hose', 'Flexible', 50, 20,
    '<path class="o" d="' + wave(0, 50, 10, 8, 2) + '"/>', [[0, 10], [50, 10]], Object.assign({ keywords: 'hose flexible' }, fOpt));
  S('funnel', 'Entonnoir / vidange', 30, 30,
    '<path class="o" d="M0,0 H30 L18,18 V30 M12,30 V18 L0,0"/>', [[15, 30], [15, 0, 'u']], Object.assign({ keywords: 'drain funnel' }, fOpt));
  S('vent', 'Évent (col de cygne)', 24, 30,
    '<path class="o" d="M8,30 V8 A8,8 0 0 1 24,8 V14"/>', [[8, 30, 'd']], Object.assign({ keywords: 'vent évent' }, fOpt));
  S('stack', 'Cheminée', 30, 80,
    '<path d="M8,0 H22 L28,80 H2 Z"/>', [[15, 80], [2, 70, 'l'], [28, 70, 'r']], { keywords: 'stack cheminée torche', prefix: 'X' });

  // ------------------------------------------------------------------
  cat('instruments', 'Instrumentation et régulation', '', { section: 'extra', names: { en: 'Instrumentation and control', fr: 'Instrumentation et régulation', nl: 'Instrumentatie en regeling' } });
  const iOpt = { tagInside: true, prefix: '' };
  S('inst_local', 'Instrument local', 40, 40,
    '<circle cx="20" cy="20" r="20"/>', [[0, 20], [40, 20], [20, 0], [20, 40]], Object.assign({ names: { en: 'Local instrument', fr: 'Instrument local', nl: 'Lokaal instrument' }, keywords: 'instrument indicator capteur' }, iOpt));
  S('inst_panel', 'Instrument en salle de commande', 40, 40,
    '<circle cx="20" cy="20" r="20"/><path class="o" d="M0,20 H40"/>', [[0, 20], [40, 20], [20, 0], [20, 40]], Object.assign({ names: { en: 'Control room instrument', fr: 'Instrument en salle de commande', nl: 'Instrument in controlekamer' }, keywords: 'panel control room' }, iOpt));
  S('inst_local_panel', 'Instrument sur tableau local', 40, 40,
    '<circle cx="20" cy="20" r="20"/><path class="o" d="M0,18 H40 M0,22 H40"/>', [[0, 20], [40, 20], [20, 0], [20, 40]], Object.assign({ names: { en: 'Local panel instrument', fr: 'Instrument sur tableau local', nl: 'Instrument op lokaal paneel' }, keywords: 'local panel' }, iOpt));
  S('inst_dcs', 'Fonction système numérique (SNCC)', 40, 40,
    '<rect x="0" y="0" width="40" height="40"/><circle cx="20" cy="20" r="20"/><path class="o" d="M0,20 H40"/>', [[0, 20], [40, 20], [20, 0], [20, 40]], Object.assign({ names: { en: 'DCS function', fr: 'Fonction système numérique (SNCC)', nl: 'DCS-functie' }, keywords: 'dcs sncc' }, iOpt));
  S('inst_plc', 'Fonction automate (API)', 40, 40,
    '<rect x="0" y="0" width="40" height="40"/><path class="o" d="M20,0 L40,20 L20,40 L0,20 Z M0,20 H40"/>', [[0, 20], [40, 20], [20, 0], [20, 40]], Object.assign({ names: { en: 'PLC function', fr: 'Fonction automate (API)', nl: 'PLC-functie' }, keywords: 'plc automate' }, iOpt));
  S('pce_request', 'Demande PCE (IEC 62424)', 60, 36,
    '<ellipse cx="30" cy="18" rx="30" ry="18"/>', [[0, 18], [60, 18], [30, 0], [30, 36]], Object.assign({ names: { en: 'PCE request (IEC 62424)', fr: 'Demande PCE (IEC 62424)', nl: 'PCE-aanvraag (IEC 62424)' }, keywords: 'pce iec 62424' }, iOpt));
  S('orifice', 'Diaphragme de mesure', 30, 24,
    '<path class="o" d="M0,12 H30 M13,0 V24 M17,0 V24"/>', [[0, 12], [30, 12]], { names: { en: 'Orifice plate (measurement)', fr: 'Diaphragme de mesure', nl: 'Meetflens' }, keywords: 'orifice plate débit', prefix: 'FE', showTag: false });

  // ------------------------------------------------------------------
  cat('boundaries', 'Limites et renvois', '', { section: 'extra', names: { en: 'Boundaries, references, junctions', fr: 'Limites, renvois et jonctions', nl: 'Grenzen, verwijzingen en knooppunten' } });
  S('flow_in', 'Entrée de produit / renvoi', 70, 24,
    '<path d="M0,0 H54 L70,12 L54,24 H0 Z"/>', [[70, 12], [0, 12]], { names: { en: 'Product inlet / off-page reference', fr: 'Entrée de produit / renvoi', nl: 'Productinlaat / verwijzing' }, keywords: 'arrivée entrée limite batterie off-page', tagInside: true, prefix: '' });
  S('flow_out', 'Sortie de produit / renvoi', 70, 24,
    '<path d="M0,0 H54 L70,12 L54,24 H0 Z"/>', [[0, 12], [70, 12]], { names: { en: 'Product outlet / off-page reference', fr: 'Sortie de produit / renvoi', nl: 'Productuitlaat / verwijzing' }, keywords: 'départ sortie limite batterie off-page', tagInside: true, prefix: '' });
  S('utility_source', 'Utilité (source)', 50, 24,
    '<rect x="0" y="0" width="50" height="24" rx="12"/>', [[50, 12], [0, 12], [25, 0], [25, 24]], { names: { en: 'Utility (source)', fr: 'Utilité (source)', nl: 'Utiliteit (bron)' }, keywords: 'utilité vapeur eau air azote', tagInside: true, prefix: '' });

  S('junction2', 'Point de jonction', 8, 8,
    '<circle class="f" cx="4" cy="4" r="4"/>', [[0, 4, 'l'], [8, 4, 'r'], [4, 0, 'u'], [4, 8, 'd']],
    { names: { en: 'Junction point (tee)', fr: 'Point de jonction (piquage)', nl: 'Knooppunt (T-stuk)' }, keywords: 'tee té piquage jonction junction', showTag: false, prefix: '' });

  // ------------------------------------------------------------------
  // Symboles ISO 10628-2 importés des planches (js/iso-symbols.js)
  const ISO = window.PFD_ISO;
  const isoCats = [];
  if (ISO) {
    const byGroup = {};
    for (const g of ISO.groups) {
      const c = { id: 'iso' + g.num, num: g.num, name: g.names.en, names: g.names, prefix: g.prefix, symbols: [], section: 'iso' };
      byGroup[g.num] = c;
      isoCats.push(c);
    }
    for (const s of ISO.symbols) {
      const c = byGroup[s.group];
      if (!c) continue;
      const sym = {
        id: s.id, name: s.names.en, names: s.names, reg: s.reg, w: s.w, h: s.h, svg: s.svg, iso: true,
        cat: c.id, catName: c.name, prefix: s.prefix, showTag: s.showTag, tagInside: false,
        keywords: s.reg + ' ' + s.names.en + ' ' + s.names.fr + ' ' + s.names.nl,
        ports: s.ports.map((p) => ({ x: p[0], y: p[1], dir: p[2] || autoDir(p[0], p[1], s.w, s.h) }))
      };
      SYMBOLS[s.id] = sym;
      c.symbols.push(sym);
    }
    CATEGORIES.unshift(...isoCats.filter((c) => c.symbols.length));
  }

  window.PFD_SYMBOLS = { CATEGORIES, SYMBOLS, autoDir, ISO_DEFS: ISO ? ISO.defs : '' };
})();
