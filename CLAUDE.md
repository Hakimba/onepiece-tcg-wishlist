# OP Wishlist — One Piece TCG Wishlist PWA

## Contexte
App de gestion de wishlist de cartes One Piece TCG à l'unité. L'utilisateur cherche les prix et vendeurs sur Cardmarket. Déployée en PWA sur GitHub Pages, utilisée principalement sur iPhone (iOS 26).

## Stack
- Vite + React + TypeScript
- Effect-TS — tagged enums (Data.TaggedEnum), branded types (Brand.nominal), Option/Either, services avec Context/Layer DI
- IndexedDB via `idb-keyval` pour le stockage local (cartes + cache images)
- `vite-plugin-pwa` pour la PWA (service worker, manifest)
- Déploiement auto via GitHub Actions sur push master → GitHub Pages

## URL de prod
https://hakimba.github.io/onepiece-tcg-wishlist/

## Structure
```
src/
├── App.tsx              — point d'entrée, routing entre vues via state machine
├── runtime.ts           — Effect runtime + Layer composition (CardRepository, IndexLoaders)
├── domain/
│   ├── Card.ts          — Card entity, branded types (CardId, IdCard), smart constructors
│   ├── Rarity.ts        — Rarity TaggedEnum (Standard|Parallel|SP|Promo|Unknown), parse/display
│   ├── Price.ts         — Price TaggedEnum (Single|Range|Empty), parse/display/compare
│   ├── SetCode.ts       — SetCode branded type, extraction depuis idcard/cs, combined sets
│   ├── Filter.ts        — FilterState, prédicats composables (série, rareté, prix, recherche)
│   ├── Disambiguation.ts — AmbiguityReason TaggedEnum, AmbiguousCard, toggleChoice
│   └── index.ts         — re-exports
├── services/
│   ├── CardRepository.ts — Effect service CRUD IndexedDB avec Layer, migration legacy
│   ├── CsvCodec.ts      — parseCsv/exportCsv (Either<CsvError, Card[]>), downloadCsv
│   ├── ImageResolver.ts — resolveImageUrl (Card → Option<string>), variantImageUrl
│   ├── ImageCacheRepository.ts — IndexedDB blob cache, canvasToBlob utility
│   ├── IndexLoader.ts   — SpIndexService + VariantsIndexService (Effect + Layer)
│   ├── VariantResolver.ts — pipeline résolution (rarity → serie → set → dedup)
│   └── index.ts         — re-exports
├── state/
│   ├── AppState.ts      — AppPage TaggedEnum (state machine), AppContext, UIState
│   ├── AppAction.ts     — AppAction TaggedEnum (toutes les actions)
│   ├── AppReducer.ts    — appReducer pur (AppPage × AppAction → AppPage)
│   ├── AppEffects.ts    — Effect generators (loadApp, importCsv, addCard, etc.)
│   └── index.ts         — re-exports
├── hooks/
│   ├── useAppStore.ts   — hook principal (state + dispatch + derived + handlers)
│   ├── useImageCache.ts — cache blob mémoire + IndexedDB, canvasToBlob
│   ├── useOnlineSync.ts — sync images en arrière-plan à la reconnexion
│   ├── useBodyScrollLock.ts — lock scroll body (zoom, modales)
│   └── useTheme.ts      — toggle light/dark mode
├── components/
│   ├── Header.tsx       — toggle liste/mosaïque, tri prix, favoris, filtres, import/export
│   ├── DisambiguationQueue.tsx — queue + picker de disambiguation des variantes
│   ├── ListView.tsx     — vue tableau avec marqueurs image/achat
│   ├── MosaicView.tsx   — grille responsive (auto-fill) avec images CDN
│   ├── CardDetail.tsx   — détail carte, swipe, édition, zoom image, upload, lien achat
│   ├── CardImage.tsx    — composant image : CDN auto, override manuel, fallback
│   ├── AddCardForm.tsx  — formulaire ajout avec validation préfixes + sélecteur rareté
│   ├── RarityPicker.tsx — sélecteur rareté partagé (pills + toggle Parallel)
│   ├── RarityBadge.tsx  — badges colorés par rareté (exhaustive $match)
│   ├── FilterPanel.tsx  — panneau filtres composables
│   ├── SearchBar.tsx    — barre de recherche avec autocomplétion
│   ├── CharactersPage.tsx — répertoire personnages
│   ├── SideDrawer.tsx   — navigation latérale (Accueil, Personnages)
│   └── BackToTop.tsx    — bouton retour en haut
├── styles/app.css       — design flat sombre + light mode, optimisé iPhone
public/
├── sp-index.json        — index SP pré-généré (idcard → suffixe _pN)
└── variants-index.json  — index variantes pré-généré (2747 cartes avec variantes)
scripts/
└── gen-variants-index.sh — génère variants-index.json depuis l'API dotgg
```

## Système d'images
Les images sont servies automatiquement depuis le CDN `static.dotgg.gg` :
- URL pattern : `https://static.dotgg.gg/onepiece/card/{idcard}{suffix}.webp`
- Standard → pas de suffixe, Parallel → `_p1`, SP → lookup dans `public/sp-index.json`
- Le fichier `sp-index.json` est généré à partir de l'API `api.dotgg.gg` (fetch cross-origin bloqué par CORS, donc pré-généré côté serveur)
- Le service worker cache les images en CacheFirst (30 jours)
- Override manuel possible via "Remplacer l'image" dans CardDetail (stocké en base64 dans IndexedDB)
- Pour régénérer l'index SP : `curl -s "https://api.dotgg.gg/cgfw/getcards?game=onepiece" | python3 -c "import json,sys; d=json.load(sys.stdin); idx={c['id_normal']:c['id'][len(c['id_normal']):] for c in d if c.get('rarity')=='SP CARD' and c['id']!=c['id_normal']}; json.dump(idx,open('public/sp-index.json','w'),indent=2)"`

## Désambiguïsation des variantes
À l'import CSV ou ajout manuel, si une carte a plusieurs variantes possibles, l'app affiche un écran de désambiguïsation. Deux modes : `import` (remplacement wishlist) et `add` (append).

### Résolution
- `services/VariantResolver.ts` filtre les variantes en cascade : rareté d'abord → série si explicite → filtre set pour standard
- **Validation rareté** : vérifie la cohérence rareté app ↔ rareté dotgg (ex: "C" pour une carte SR → mismatch)
- **Validation série** : série fournie mais invalide → `serieMismatch` → disambiguation avec warning
- **Rareté "?"** : rareté vide = toutes les variantes proposées, avec multi-select (crée N entrées)
- Si 1 seul candidat et pas de mismatch → auto-resolve silencieux
- Si 0 candidats (rareté mismatch) → fallback sans filtre rareté → disambiguation avec `rarityMismatch: true`
- **Filtre set intelligent** : exclut reprints d'autres extensions (OP, EB, ST, PRB) mais garde promos (pas de code set dans `cs`) et sets collectors. Gère les codes set entre crochets `[OP-09]` et les codes nus `OP-05`. Supporte les séries combinées `[OP15-EB04]` via `extractAllFromCs`.
- Pour SP : pas de filtre serie (serieMismatch ignoré — variantes SP vivent souvent dans d'autres sets)
- Pour SP/Parallel : pas de filtre set (chaque suffixe = artwork unique, même cross-set)

### UI (`DisambiguationQueue.tsx`)
- **Queue** : cartes groupées en 3 catégories (rareté/série inexistante, variantes multiples, rareté non précisée)
- **Picker** : grille d'images, tap = zoom carousel, bouton "Choisir" séparé
- **Carousel** : overlay fullscreen avec swipe tactile, flèches PC, dots
- **Multi-select** : quand rareté "?", sélection multiple → crée N entrées avec les bonnes raretés
- En mode import, le bouton "Importer" est actif dès qu'il y a des cartes non-ambiguës (pas besoin de tout désambiguïser)
- Les cartes non résolues sont ignorées

### Index
- `public/variants-index.json` pré-généré via `scripts/gen-variants-index.sh`
- Structure : `{ "OP09-004": { "name": "Shanks", "variants": [{ "s": "_p3", "r": "SP CARD", "cs": "[OP-09]" }, ...] } }`
- Pour régénérer : `./scripts/gen-variants-index.sh > public/variants-index.json`

## Système de raretés
Modélisé par `Rarity` TaggedEnum dans `domain/Rarity.ts` :
- **Standard** : `{ base: C | UC | R | SR | SEC | L }` — rareté de base
- **Parallel** : `{ base: C | UC | R | SR | SEC | L }` — art alternatif (composable avec Standard bases uniquement)
- **SP** : `{}` — SP CARD standalone (correspond à "SP CARD" dans dotgg)
- **Promo** : `{}` — carte promo (préfixe "P-"), auto-détecté via `SetCode.isPromoId`
- **Unknown** : `{}` — rareté non précisée ("?") — toutes les variantes proposées en disambiguation
- Parsé par `parseRarity()` (→ `Either<Rarity, RarityParseError>`), affiché par `displayRarity()`
- ID carte (branded `CardId`) : `{idcard}__{rarity}` (ex: `OP01-013__R Parallel`)

## CSV source
Le fichier `~/onepiece-tcg-wishlist-v3.csv` (hors repo) contient la wishlist maintenue manuellement. L'app peut l'importer via le bouton Import (remplace toutes les entrées).
Champs : `serie,idcard,character,rarity,price,seller_url,favorite,edition,image_suffix`

## Conventions
- **Toujours utiliser les skills agent-browser** pour chercher des infos de cartes, prix, vendeurs sur Cardmarket ou tout autre site TCG. Ne pas utiliser WebFetch pour ces recherches.
- Langue des cartes : quasi toujours japonais (moins cher)
- Le champ `seller_url` du CSV correspond au champ `buyLink` du type `Card` dans l'app.

## Déploiement
Push sur master → GitHub Actions build + deploy automatique sur GitHub Pages.
Le `base` dans vite.config.ts est `/onepiece-wishlist/`.

---

## Procédure Cardmarket — enrichissement CSV

Méthode éprouvée pour enrichir le CSV avec prix + vendeur + lien depuis Cardmarket.
**Objectif** : pour chaque carte, trouver le prix JP le plus bas du vendeur le plus fiable (plus de ventes).

### Règles absolues

1. **JAMAIS de script/boucle** — Cloudflare détecte et blacklist immédiatement. Chaque commande agent-browser est un tool call individuel.
2. **Toujours `--headed --session cm`** — le headless est bloqué 100% du temps par Cloudflare.
3. **Une commande à la fois** par session — pas de `&&`, pas de `run_in_background`.
4. **~5-8s entre chaque `open`** — rythme humain.
5. **Max 15-20 pages par session** — au-delà, faire une pause de quelques minutes.
6. **Utiliser `--profile ~/.cardmarket-profile`** pour persister les cookies entre sessions.

### Étape 0 — Ouvrir le browser

```bash
agent-browser --headed --session cm --profile ~/.cardmarket-profile open "https://www.cardmarket.com/en/OnePiece"
```
Si c'est la première visite, accepter les cookies ("Accept All Cookies").

### Étape 1 — Rechercher la carte

```bash
agent-browser --session cm open "https://www.cardmarket.com/en/OnePiece/Products/Search?searchString=<ID_CARTE>"
```
Exemple : `?searchString=OP06-118`

### Étape 2 — Extraire les liens produits (JS)

```bash
agent-browser --session cm eval '(() => {
  const links = document.querySelectorAll("a[href*=\"/Singles/\"]");
  const seen = new Set();
  const all = [];
  links.forEach(a => {
    const href = a.getAttribute("href");
    if (!seen.has(href)) { seen.add(href); all.push({ href, text: a.textContent.trim() }); }
  });
  return JSON.stringify(all);
})()'
```

Lecture du résultat :
- Texte commence par `OP0x ` = EN, `OP0x-JP ` = JP
- URL contient `-V2` = Parallel, `-V1` = standard
- URL contient `-Japanese` ou `-Non-English` = version JP

**Choisir le lien JP** qui correspond à la rareté de la carte :
- Rareté standard (SR, SEC, R...) → V1 ou sans suffixe
- Rareté Parallel → V2
- SP (Special/promo) → chercher dans les résultats, parfois c'est un set différent

### Étape 3 — Ouvrir la page produit JP

```bash
agent-browser --session cm open "https://www.cardmarket.com<href_du_lien_JP>"
```

**NE PAS cliquer sur les liens** — ça ne navigue pas. Toujours extraire le href puis `open`.

### Étape 4 — Extraire le meilleur vendeur (JS)

Utiliser `--stdin` avec heredoc pour le script (évite les problèmes d'échappement) :

```bash
cat <<'JSEOF' | agent-browser --session cm eval --stdin
(() => {
  const rows = document.querySelectorAll(".table-body .row");
  const sellers = [];
  const seen = new Set();
  rows.forEach(row => {
    const nameEl = row.querySelector("a[href*='/Users/']");
    if (!nameEl) return;
    const name = nameEl.textContent.trim();
    if (seen.has(name)) return;
    seen.add(name);

    // Prix : mobile-offer-container contient le prix réel (pas price-container)
    let price = null;
    const priceEl = row.querySelector(".mobile-offer-container .fw-bold")
      || row.querySelector(".price-container .fw-bold")
      || row.querySelector(".fw-bold");
    if (priceEl) price = priceEl.textContent.trim();

    // Ventes depuis le tooltip (non tronqué, ex: "134284 Sales | 1836 Available items")
    const sellCountEl = row.querySelector(".sell-count");
    let sales = 0;
    if (sellCountEl) {
      const tip = sellCountEl.getAttribute("data-bs-original-title") || "";
      const m = tip.match(/([\d.,]+)\s*Sales/i);
      if (m) sales = parseInt(m[1].replace(/[.,]/g, ""));
      else sales = parseInt(sellCountEl.textContent.trim().replace(/[.,K]/gi, "")) || 0;
    }

    // Langue depuis .product-attributes (icône à côté du badge NM/LP)
    let lang = null;
    const prodAttrs = row.querySelector(".product-attributes");
    if (prodAttrs) {
      const icons = prodAttrs.querySelectorAll("span[aria-label], span[data-bs-original-title]");
      icons.forEach(el => {
        const label = el.getAttribute("aria-label") || el.getAttribute("data-bs-original-title") || "";
        if (label && !label.match(/Near Mint|Light|Played|Excellent|Good|Poor|Mint/i)) {
          lang = label;
        }
      });
    }

    // Condition (MT, NM, EX, GD, LP, PL, PO)
    let condition = null;
    const condEl = row.querySelector(".article-condition .badge, .article-condition");
    if (condEl) condition = condEl.textContent.trim();

    sellers.push({ name, href: nameEl.getAttribute("href"), price, sales, lang, condition });
  });

  // Filtrer : JP uniquement + condition NM ou MT uniquement, trier par ventes desc
  const jp = sellers.filter(s =>
    (s.lang === "Japanese" || s.lang === null) &&
    (s.condition === "NM" || s.condition === "MT")
  );
  jp.sort((a, b) => b.sales - a.sales);
  return JSON.stringify({ total: sellers.length, jpNmCount: jp.length, top20: jp.slice(0, 20) });
})()
JSEOF
```

**IMPORTANT — Filtrage langue** :
- Ne garder que les vendeurs dont `lang` est `"Japanese"` (ou `null` si pas d'icône = souvent JP sur page JP)
- **Exclure** : `S-Chinese`, `T-Chinese`, `Korean`, `Thai`, `English`, etc.

**IMPORTANT — Filtrage condition** :
- Ne garder que les cartes en **Near Mint (NM)** ou **Mint (MT)**
- **Exclure** : `EX` (Excellent), `GD` (Good), `LP` (Light Played), `PL` (Played), `PO` (Poor)
- La condition est dans `.article-condition .badge` (texte: NM, MT, EX, GD, LP, PL, PO)

**IMPORTANT — Sélecteur prix** :
- Le prix est dans `.mobile-offer-container .fw-bold` (pas `.price-container .fw-bold`)
- L'ancien sélecteur `.price-container` retournait `null` pour la plupart des vendeurs, filtrant les gros vendeurs

Résultat : top 20 vendeurs JP en NM/MT triés par nombre de ventes.
L'eval% n'est pas visible sur la page produit — seulement sur le profil vendeur. Pour les vendeurs avec >1000 ventes, on peut supposer eval ~98%+. Pour les cartes chères (>10€), vérifier le profil.

### Critères de sélection du vendeur — Wilson score

On utilise le **Wilson score lower bound** pour évaluer la fiabilité d'un vendeur.
C'est un concept de stats qui résout ce problème : 97% sur 10 000 ventes est PLUS fiable que 99% sur 10 ventes.

**Formule** (intervalle de confiance 95%, z = 1.96) :

```
wilson(p, n) = (p + z²/2n - z * sqrt(p(1-p)/n + z²/4n²)) / (1 + z²/n)
```
- `p` = eval / 100 (ex: 0.97 pour 97%)
- `n` = nombre de ventes (sales)
- `z` = 1.96

**Exemples concrets** :

| Eval | Sales | Wilson score |
|------|-------|-------------|
| 99%  | 10    | ~0.83       |
| 97%  | 10k   | ~0.966      |
| 99%  | 1000  | ~0.983      |
| 95%  | 5000  | ~0.943      |
| 100% | 50    | ~0.944      |
| 98%  | 500   | ~0.967      |

**Règle de décision** :
1. **Filtrer par condition** : ne garder que **Near Mint (NM)** ou **Mint (MT)** — exclure EX, GD, LP, PL, PO
2. **Filtrer par langue** : ne garder que les listings en **japonais** (exclure S-Chinese, Korean, Thai, etc.)
3. **Calculer le Wilson score** pour chaque vendeur avec eval > 90%
4. **Éliminer** les vendeurs avec Wilson score < 0.90 (pas assez fiables)
5. **Toujours prendre le meilleur Wilson score**, sauf si son prix dépasse de plus de 5€ le prix du vendeur fiable le moins cher
6. En pratique : trier par Wilson score desc, prendre le premier dont le prix est à max 5€ du moins cher parmi les fiables

La fiabilité prime sur le prix — on accepte de payer jusqu'à 5€ de plus pour un vendeur de confiance.

### Étape 5 — Mettre à jour le CSV

Pour chaque carte traitée, mettre à jour la ligne dans `~/onepiece-tcg-wishlist-v3.csv` :
- Colonne `price` = prix du vendeur choisi
- Colonne `seller_url` = lien profil du vendeur (ex: `https://www.cardmarket.com/en/OnePiece/Users/NomVendeur`)

### Étape 6 — Passer à la carte suivante

Revenir à l'étape 1 avec la carte suivante. Respecter le rythme (5-8s entre les `open`).

### Versions de cartes — mapping rareté → URL

| Rareté CSV | Version URL |
|---|---|
| SR, SEC, R, UC, C, L (Leader) | V1 ou sans suffixe |
| SR Parallel, SEC Parallel, R Parallel, Leader Parallel | V2 |
| SP | Chercher dans les résultats (souvent set différent) |

**IMPORTANT — Vérifier la rareté** :
- Sur la page produit Cardmarket, le champ "Rarity" indique la vraie rareté
- **AA** = Alternative Art = Parallel = **V2**
- Ne pas se fier uniquement au CSV — croiser avec la page produit
- En cas de doute, le prix est un bon indicateur : une AA est bien plus chère que la version standard

### Noms des sets (pour les URL)

| Code | Nom URL |
|---|---|
| OP01 | Romance-Dawn |
| OP02 | Paramount-War |
| OP03 | Pillars-of-Strength |
| OP04 | Kingdoms-of-Intrigue |
| OP05 | Awakening-of-the-New-Era |
| OP06 | Wings-of-the-Captain |
| OP07 | 500-Years-in-the-Future |
| OP08 | Two-Legends |
| OP09 | The-Four-Emperors |
| OP10 | Royal-Blood |
| OP11 | Emperors-in-the-New-World |
| OP13 | Carrying-on-his-Will |
| OP14 | The-Azure-Seas-Seven |
| OP15 | Adventure-on-Kamis-Island |
| EB04 | Egghead-Crisis |

Pour les sets JP, ajouter `-Japanese` au nom du set dans l'URL.

### Si Cloudflare bloque

- Titre "Access denied" ou "Just a moment..." qui ne passe pas
- **Fermer le browser** (`agent-browser --session cm close`)
- **Attendre plusieurs minutes** (voire heures si IP blacklistée)
- Relancer avec `--profile ~/.cardmarket-profile` (les cookies persistent)
- Si ça persiste : arrêter et reprendre le lendemain
