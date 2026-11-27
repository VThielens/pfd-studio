# PFD Studio ISO 10628

Logiciel de dessin de schémas de procédé (PFD) qui fonctionne entièrement en local, sans installation ni connexion Internet. Interface en **anglais** (par défaut), **français** et **néerlandais**.

## Lancer le logiciel

1. Double-cliquez sur **index.html**. Il s'ouvre dans votre navigateur.
2. Utilisez de préférence **Chrome** ou **Edge** : « Enregistrer » réécrit alors directement le même fichier sur votre disque. Avec Firefox, chaque enregistrement télécharge un nouveau fichier.
3. Choisissez la langue dans la liste en haut à droite (English, Français, Nederlands). Le choix est mémorisé.

Exemples : **Ouvrir** puis `exemple-distillation-iso.pfd.json` (symboles ISO) ou `exemple-distillation.pfd.json` (ancienne version).

## Nouveautés de la version 2

- **Bibliothèque ISO 10628-2 complète** : 295 symboles en 29 groupes numérotés comme les planches de la norme (1 Récipients et réservoirs … 29 Caractéristiques internes). Chaque symbole garde son numéro d'enregistrement ISO (affiché dans le panneau de droite) et ses points de raccordement préférentiels comme ports.
- **Noms en trois langues** pour les groupes et les symboles. La recherche fonctionne dans les trois langues et par numéro ISO (par exemple `2322` ou `X8101`).
- **Sélecteur de langue** : toute l'interface, les messages, l'aide, le cartouche et la nomenclature changent de langue.
- **Cadre de feuille et cartouche** (panneau Document, case « Cadre et cartouche ») : société, projet, titre, n° de plan, date, révision, dessinateur, vérificateur. Repris dans les exports SVG, PNG et PDF.
- **Nomenclature des équipements** : bouton « Nomenclature », fichier CSV (séparateur point-virgule) qui s'ouvre dans Excel, avec repère, description, n° ISO et symbole.
- Nouveau type de ligne **trait mixte** (tuyauterie secondaire).
- Les anciens symboles redessinés à la main restent lisibles dans les anciens fichiers, mais ne sont plus proposés dans la bibliothèque. L'instrumentation et les limites/renvois restent disponibles.

## Fonctions de base

- **Glisser-déposer** des symboles, zoom (molette), déplacement de la vue (bouton du milieu ou Espace + glisser), grille magnétique, rotation par 90°, miroir, mise à l'échelle.
- **Ports de connexion** : l'outil **Ports** (touche P) permet d'en ajouter (clic sur la figure), de les déplacer (glisser) et de les supprimer (clic droit ou Suppr). La direction de sortie se règle dans le panneau de droite.
- **Lignes et flèches attachées** : tirez d'un port à un autre. Quand vous déplacez, tournez ou retournez une figure, les lignes suivent.
- **Repères** automatiques (B-101, C-101, E-101, P-101…), étiquettes de ligne, textes libres.
- **Annuler / rétablir**, copier, coller, dupliquer, sélection multiple, alignement.
- **Fichiers** `.pfd.json`, sauvegarde automatique du brouillon dans le navigateur.
- **Export** SVG (s'ouvre dans Inkscape), PNG et PDF (fenêtre d'impression, « Enregistrer au format PDF »).

Appuyez sur **?** ou **F1** pour la liste des raccourcis.

## Origine des symboles et licence

Les symboles ISO 10628-2 sont extraits automatiquement des planches « ISO 10628-2:2012 Symbols » (feuilles 1 à 7) de **Steven Baltakatei Sandoval**, publiées sur Wikimedia Commons sous licence **CC BY-SA 4.0** (https://creativecommons.org/licenses/by-sa/4.0/). Le fichier `js/iso-symbols.js` est une œuvre dérivée distribuée sous la même licence. Si vous diffusez le logiciel, gardez cette mention.

## Hypothèses à vérifier

- Les traductions françaises et néerlandaises des noms de symboles sont les miennes, pas les libellés officiels des versions NBN/NEN de la norme.
- Quelques fautes de frappe des planches anglaises ont été corrigées (Jacked → Jacketed, electristatic → electrostatic…).
- Les ports viennent des points de raccordement préférentiels des planches. Certains éléments (internes, supports, agitateurs) n'en ont pas : ajoutez-les avec l'outil Ports si besoin.
- Les préfixes de repères par groupe (B, C, E, H, F, S, Z, D, M, R, X, P, K, G, T…) sont un choix par défaut, modifiables.
- Le cartouche suit une mise en page simple de 180 mm de large, inspirée de l'ISO 7200, sans prétendre la respecter exactement.

## Organisation des fichiers

- `index.html` : page principale
- `css/app.css` : apparence
- `js/i18n.js` : textes de l'interface en anglais, français et néerlandais
- `js/iso-symbols.js` : symboles ISO 10628-2 (généré, CC BY-SA 4.0)
- `js/symbols.js` : catégories, instrumentation, anciens symboles
- `js/app.js` : éditeur
- `tools/iso-symbols/` : régénération de `iso-symbols.js` à partir des planches
- `tests/` : tests automatiques (`npm test`)
- `paper/` : brouillon d'article pour le Journal of Open Source Software
