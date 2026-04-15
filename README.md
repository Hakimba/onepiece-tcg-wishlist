# OP Wishlist

PWA de gestion de wishlist de cartes One Piece TCG a l'unite.

## Features

- **Import/export CSV** — importer une wishlist, exporter pour backup ou partage
- **Deux vues** — liste (tableau) ou mosaique (grille d'images responsive)
- **Fiche carte** — detail avec image, rarete, prix, lien d'achat, navigation par swipe, zoom fullscreen
- **Ajout manuel** — formulaire avec selecteur de rarete visuel (base + modificateurs Parallel/SP)
- **Edition complete** — tous les champs editables depuis la fiche carte
- **Images automatiques** — images CDN depuis dotgg, resolution automatique du suffixe selon la rarete
- **Disambiguation des variantes** — quand plusieurs images possibles (ex: parallels de sets differents), choix interactif avec carousel fullscreen et swipe
- **Filtres composables** — serie, rarete (base + modificateurs), prix min/max, combinables
- **Recherche** — barre de recherche avec autocompletion sur les noms de personnages
- **Repertoire personnages** — liste auto-generee, clic = filtre sur la wishlist
- **Tri par prix** — croissant ou decroissant
- **Favoris** — etoile par carte, filtre dedie
- **Marqueurs visuels** — icones indiquant si une carte a une image et/ou un lien d'achat
- **Lien vendeur** — integration Cardmarket via la colonne `seller_url` du CSV
- **PWA** — installable sur mobile, fonctionne hors-ligne

## Stack

- Vite + React + TypeScript
- IndexedDB (`idb-keyval`)
- `vite-plugin-pwa`
- GitHub Actions + GitHub Pages

## Dev

```bash
npm install
npm run dev
```

## Deploiement

Push sur `master` → build + deploy auto sur GitHub Pages.

## Format CSV

```csv
serie,idcard,character,rarity,price,seller_url,favorite
OP01,OP01-013,Sanji,R Parallel,29.99€,https://www.cardmarket.com/en/OnePiece/Users/...,1
```
