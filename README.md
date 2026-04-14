# OP Wishlist

PWA de gestion de wishlist de cartes One Piece TCG a l'unite.

## Features

- **Import/export CSV** — importer une wishlist, exporter pour backup ou partage
- **Deux vues** — liste (tableau) ou mosaique (grille d'images 2 colonnes)
- **Fiche carte** — detail avec image, rarete, prix, lien d'achat, navigation par swipe
- **Ajout manuel** — formulaire avec selecteur de rarete visuel (base + modificateurs Parallel/SP)
- **Marqueurs visuels** — icones indiquant si une carte a une image et/ou un lien d'achat
- **Lien vendeur** — integration Cardmarket via la colonne `seller_url` du CSV
- **Upload d'image** — photo par carte, stockee localement en IndexedDB
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
serie,idcard,character,rarity,price,seller_url
OP01,OP01-013,Sanji,R Parallel,29.99€,https://www.cardmarket.com/en/OnePiece/Users/...
```
