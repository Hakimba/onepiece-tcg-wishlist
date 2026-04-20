# OP Wishlist

PWA de gestion de wishlist de cartes One Piece TCG a l'unite.

## Features

- **Import/export CSV** — importer une wishlist, exporter pour backup ou partage
- **Deux vues** — liste (tableau) ou mosaique (grille d'images responsive)
- **Fiche carte** — detail avec image, rarete, prix, lien d'achat, navigation par swipe, zoom fullscreen
- **Import par serie** — parcourir les sets, filtrer par rarete, selectionner des variantes. Sur mobile : UX swipe type Tinder (droite = accepter, gauche = passer, undo, zoom). Les filtres rarete sont compatibles avec le swipe sans perte de progression
- **Ajout manuel** — formulaire avec selecteur de rarete visuel (pills C/UC/R/SR/SEC/Leader/SP + toggle Parallel), detection automatique des promos via prefixe ID, validation des prefixes contre l'index des variantes
- **Edition complete** — tous les champs editables depuis la fiche carte
- **Images automatiques** — images CDN depuis dotgg, resolution automatique du suffixe selon la rarete, verification de coherence rarete/serie
- **Cache images hors-ligne** — cache persistant IndexedDB, synchronisation en arriere-plan a la reconnexion, cache memoire LRU pour les re-rendus instantanes
- **Disambiguation des variantes** — quand plusieurs images possibles, choix interactif avec carousel fullscreen et swipe. Cartes groupees par categorie (rarete inexistante, variantes multiples, rarete non precisee). Multi-selection possible quand rarete "?". Support des series combinees (ex: OP15-EB04)
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
- [Effect-TS](https://effect.website) — tagged enums, branded types, Option/Either, services avec Layer DI
- IndexedDB (`idb-keyval`) — stockage cartes + cache images
- `vite-plugin-pwa` — service worker, manifest
- GitHub Actions + GitHub Pages

## Architecture

```
src/
├── domain/          — types metier (Card, Rarity, Price, SetCode, Filter, Disambiguation)
├── services/        — logique applicative (CardRepository, CsvCodec, ImageResolver, VariantResolver, IndexLoader)
├── state/           — state machine (AppPage TaggedEnum, AppReducer, AppEffects, AppAction)
├── hooks/           — React hooks (useAppStore, useImageCache, useOnlineSync, useIsMobile, useTheme)
├── components/      — composants UI React
├── runtime.ts       — Effect runtime + Layer composition
└── App.tsx          — point d'entree, routing entre vues
```

## Dev

```bash
npm install
npm run dev
```

## Deploiement

Push sur `master` → build + deploy auto sur GitHub Pages.

## Format CSV

```csv
serie,idcard,character,rarity,price,seller_url,favorite,edition,image_suffix
OP01,OP01-013,Sanji,R Parallel,29.99€,https://www.cardmarket.com/en/OnePiece/Users/...,1,,_p1
```
