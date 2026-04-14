# OP Wishlist — One Piece TCG Wishlist PWA

## Contexte
App de gestion de wishlist de cartes One Piece TCG à l'unité. L'utilisateur cherche les prix et vendeurs sur Cardmarket. Déployée en PWA sur GitHub Pages, utilisée principalement sur iPhone (iOS 26).

## Stack
- Vite + React + TypeScript
- IndexedDB via `idb-keyval` pour le stockage local
- `vite-plugin-pwa` pour la PWA (service worker, manifest)
- Déploiement auto via GitHub Actions sur push master → GitHub Pages

## URL de prod
https://hakimba.github.io/onepiece-wishlist/

## Structure
```
src/
├── App.tsx              — routing entre vues, state global
├── types.ts             — Card, ViewMode
├── store.ts             — CRUD IndexedDB
├── csv.ts               — import/export CSV
├── rarity.ts            — parseRarity(), buildRarityString(), couleurs
├── components/
│   ├── Header.tsx       — toggle liste/mosaïque, +, import, export
│   ├── ListView.tsx     — vue tableau
│   ├── MosaicView.tsx   — grille 2 colonnes images
│   ├── CardDetail.tsx   — détail carte, swipe, upload image, lien achat
│   ├── AddCardForm.tsx  — formulaire ajout avec sélecteur rareté visuel
│   └── RarityBadge.tsx  — badges colorés par rareté
└── styles/app.css       — design flat sombre, optimisé iPhone
```

## Système de raretés
La rareté d'une carte = **rareté de base** + **modificateurs optionnels** :
- Bases : C, UC, R, SR, SEC, L (Leader)
- Modificateurs : Parallel/Alt (art alternatif), SP (Special/promo)
- Stocké en string dans le CSV/IndexedDB : ex "SR Parallel", "SP R", "SEC"
- Parsé à l'affichage par `parseRarity()` dans `rarity.ts`

## CSV source
Le fichier `~/onepiece-tcg-wishlist.csv` (hors repo) contient la wishlist maintenue manuellement. L'app peut l'importer via le bouton Import.
Champs : `serie,idcard,character,rarity,price,seller_url`

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

```bash
agent-browser --session cm eval '(() => {
  const rows = document.querySelectorAll(".table-body .row");
  const seen = new Set();
  const sellers = [];
  rows.forEach(row => {
    const nameEl = row.querySelector("a[href*=\"/Users/\"]");
    const priceEl = row.querySelector(".price-container .fw-bold");
    const sellCountEl = row.querySelector(".sell-count");
    const evalEl = row.querySelector(".seller-rating-percentage, [class*=\"rating\"]");
    if (nameEl && priceEl && !seen.has(nameEl.textContent.trim())) {
      seen.add(nameEl.textContent.trim());
      sellers.push({
        name: nameEl.textContent.trim(),
        href: nameEl.href,
        price: priceEl.textContent.trim(),
        sales: sellCountEl ? parseInt(sellCountEl.textContent.trim()) : 0,
        eval: evalEl ? parseFloat(evalEl.textContent) : null
      });
    }
  });
  sellers.sort((a, b) => b.sales - a.sales);
  return JSON.stringify(sellers.slice(0, 10));
})()'
```

Résultat : top 10 vendeurs triés par nombre de ventes, avec `eval` (%) si disponible.
Si `eval` est `null`, vérifier manuellement sur la page (badge/pourcentage à côté du nom).

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
1. **Calculer le Wilson score** pour chaque vendeur avec eval > 90%
2. **Éliminer** les vendeurs avec Wilson score < 0.90 (pas assez fiables)
3. **Parmi les restants** : choisir le **prix le plus bas**
4. **En cas de prix proches** (écart < ~3€) : préférer celui avec le meilleur Wilson score

La fiabilité prime sur le prix — on accepte de payer quelques euros de plus pour un vendeur de confiance.

### Étape 5 — Mettre à jour le CSV

Pour chaque carte traitée, mettre à jour la ligne dans `~/onepiece-tcg-wishlist.csv` :
- Colonne `price` = prix du vendeur choisi
- Colonne `seller_url` = lien profil du vendeur (ex: `https://www.cardmarket.com/en/OnePiece/Users/NomVendeur`)

### Étape 6 — Passer à la carte suivante

Revenir à l'étape 1 avec la carte suivante. Respecter le rythme (5-8s entre les `open`).

### Versions de cartes — mapping rareté → URL

| Rareté CSV | Version URL |
|---|---|
| SR, SEC, R, UC, C, L (Leader) | V1 ou sans suffixe |
| SR Parallel, SEC Parallel, R Parallel, Leader Parallel | V2 |
| SP R, SP UC, SP SR | Chercher dans les résultats (souvent set différent) |

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
| OP13 | ? (à découvrir) |
| OP14 | ? (à découvrir) |
| OP15 | ? (à découvrir) |
| EB04 | ? (Extra Booster, à découvrir) |

Pour les sets JP, ajouter `-Japanese` au nom du set dans l'URL.

### Si Cloudflare bloque

- Titre "Access denied" ou "Just a moment..." qui ne passe pas
- **Fermer le browser** (`agent-browser --session cm close`)
- **Attendre plusieurs minutes** (voire heures si IP blacklistée)
- Relancer avec `--profile ~/.cardmarket-profile` (les cookies persistent)
- Si ça persiste : arrêter et reprendre le lendemain
