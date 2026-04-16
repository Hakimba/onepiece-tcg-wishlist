import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Card, ViewMode, FilterState, PageId, SortPrice } from './types';
import { loadCards, saveCards, addCard, updateCard, deleteCard, makeCardId } from './store';
import { parseCSV, downloadCSV } from './csv';
import { applyFilters, defaultFilters, hasActiveFilters } from './filters';
import { loadSpIndex } from './imageResolver';
import { loadVariantsIndex, resolveVariants } from './variantResolver';
import type { VariantsIndex, AmbiguousCard } from './variantResolver';
import Header from './components/Header';
import FilterPanel from './components/FilterPanel';
import ListView from './components/ListView';
import MosaicView from './components/MosaicView';
import CardDetail from './components/CardDetail';
import AddCardForm from './components/AddCardForm';
import DisambiguationQueue from './components/DisambiguationQueue';
import SideDrawer from './components/SideDrawer';
import SearchBar from './components/SearchBar';
import CharactersPage from './components/CharactersPage';
import BackToTop from './components/BackToTop';
import './styles/app.css';

function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [view, setView] = useState<ViewMode>('mosaic');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [spIndex, setSpIndex] = useState<Map<string, string>>();
  const [variantsIndex, setVariantsIndex] = useState<VariantsIndex>({});
  const [sortPrice, setSortPrice] = useState<SortPrice>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [disambiguationState, setDisambiguationState] = useState<{
    ambiguous: AmbiguousCard[];
    resolved: Card[];
    mode: 'import' | 'add';
  } | null>(null);
  const [addError, setAddError] = useState('');

  const filtersActive = hasActiveFilters(filters) || searchQuery.trim() !== '' || showFavoritesOnly;
  const filteredCards = useMemo(() => {
    const byFilters = applyFilters(cards, filters);
    let result = byFilters;
    if (showFavoritesOnly) {
      result = result.filter((c) => c.favorite);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) =>
        c.character.toLowerCase().includes(q) || c.idcard.toLowerCase().includes(q)
      );
    }
    if (sortPrice) {
      const parsePrice = (p: string): number => {
        const cleaned = p.replace(/[€\s]/g, '').replace(',', '.');
        const match = cleaned.match(/[\d.]+/);
        return match ? parseFloat(match[0]) : Infinity;
      };
      result = [...result].sort((a, b) => {
        const pa = parsePrice(a.price);
        const pb = parsePrice(b.price);
        return sortPrice === 'asc' ? pa - pb : pb - pa;
      });
    }
    return result;
  }, [cards, filters, showFavoritesOnly, searchQuery, sortPrice]);
  const allSeries = useMemo(() => [...new Set(cards.map((c) => c.serie))].sort(), [cards]);
  const allCharacters = useMemo(
    () => [...new Set(cards.map((c) => c.character).filter(Boolean))].sort(),
    [cards]
  );

  useEffect(() => {
    Promise.all([loadCards(), loadSpIndex(), loadVariantsIndex()]).then(([c, sp, vi]) => {
      setCards(c);
      setSpIndex(sp);
      setVariantsIndex(vi);
      setLoading(false);
    });
  }, []);

  const handleImport = useCallback(async (file: File) => {
    const text = await file.text();
    const imported = parseCSV(text);
    const { resolved, ambiguous } = resolveVariants(imported, variantsIndex);
    if (ambiguous.length > 0) {
      setDisambiguationState({ ambiguous, resolved, mode: 'import' });
    } else {
      // Deduplicate resolved cards
      const deduped = resolved.filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
      await saveCards(deduped);
      setCards(deduped);
    }
  }, [variantsIndex]);

  const handleExport = useCallback(() => {
    downloadCSV(cards);
  }, [cards]);

  const handleAdd = useCallback(async (card: Omit<Card, 'id'>) => {
    const newCard: Card = { ...card, id: makeCardId(card.idcard, card.rarity) };
    const { resolved, ambiguous } = resolveVariants([newCard], variantsIndex, cards);
    if (ambiguous.length > 0) {
      setDisambiguationState({ ambiguous, resolved: [], mode: 'add' });
      setShowAdd(false);
      setAddError('');
    } else if (resolved.length === 0) {
      setAddError('Cette carte existe déjà dans la wishlist');
    } else {
      const { cards: updated, duplicate } = await addCard(resolved[0]);
      if (duplicate) {
        setAddError('Cette carte existe déjà dans la wishlist');
      } else {
        setCards(updated);
        setShowAdd(false);
        setAddError('');
      }
    }
  }, [variantsIndex, cards]);

  const handleUpdate = useCallback(async (card: Card, oldId?: string) => {
    const updated = await updateCard(card, oldId);
    setCards(updated);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const updated = await deleteCard(id);
    setCards(updated);
    setSelectedIndex(null);
  }, []);

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleClear = useCallback(async () => {
    await saveCards([]);
    setCards([]);
  }, []);

  const handleToggleFavorite = useCallback(async (id: string) => {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const updated = await updateCard({ ...card, favorite: !card.favorite });
    setCards(updated);
  }, [cards]);

  const handleDisambiguationFinish = useCallback(async (resultCards: Card[]) => {
    if (disambiguationState?.mode === 'add') {
      // resultCards = only new disambiguated cards, append to existing
      const current = await loadCards();
      for (const c of resultCards) {
        if (!current.some((x) => x.id === c.id)) current.push(c);
      }
      await saveCards(current);
      setCards(current);
    } else {
      // import mode: resultCards = resolved + disambiguated (full replacement)
      await saveCards(resultCards);
      setCards(resultCards);
    }
    setDisambiguationState(null);
  }, [disambiguationState?.mode]);

  const handleNavigate = useCallback((page: PageId) => {
    setCurrentPage(page);
    setDrawerOpen(false);
    setSelectedIndex(null);
    setShowAdd(false);
  }, []);

  const handleSelectCharacter = useCallback((name: string) => {
    setSearchQuery(name);
    setCurrentPage('home');
  }, []);

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (selectedIndex === null) return;
      const next =
        direction === 'right'
          ? Math.min(selectedIndex + 1, filteredCards.length - 1)
          : Math.max(selectedIndex - 1, 0);
      setSelectedIndex(next);
    },
    [selectedIndex, filteredCards.length]
  );

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (disambiguationState) {
    return (
      <DisambiguationQueue
        ambiguous={disambiguationState.ambiguous}
        resolved={disambiguationState.resolved}
        mode={disambiguationState.mode}
        onFinish={handleDisambiguationFinish}
        onCancel={() => setDisambiguationState(null)}
      />
    );
  }

  const drawer = (
    <SideDrawer
      open={drawerOpen}
      currentPage={currentPage}
      onNavigate={handleNavigate}
      onClose={() => setDrawerOpen(false)}
    />
  );

  if (selectedIndex !== null && filteredCards[selectedIndex]) {
    return (
      <>
        {drawer}
        <CardDetail
          card={filteredCards[selectedIndex]}
          onBack={() => setSelectedIndex(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
          onSwipe={handleSwipe}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < filteredCards.length - 1}
          spIndex={spIndex}
        />
      </>
    );
  }

  if (showAdd) {
    return (
      <>
        {drawer}
        <AddCardForm onAdd={handleAdd} onCancel={() => { setShowAdd(false); setAddError(''); }} error={addError} />
      </>
    );
  }

  if (currentPage === 'characters') {
    return (
      <>
        {drawer}
        <CharactersPage
          cards={cards}
          onSelectCharacter={handleSelectCharacter}
          onBack={() => setCurrentPage('home')}
        />
      </>
    );
  }

  return (
    <>
      {drawer}
      <div className="app">
        <Header
          view={view}
          onViewChange={setView}
          onAdd={() => setShowAdd(true)}
          onImport={handleImport}
          onExport={handleExport}
          onClear={handleClear}
          sortPrice={sortPrice}
          onSortPrice={setSortPrice}
          showFavoritesOnly={showFavoritesOnly}
          onToggleFavorites={() => setShowFavoritesOnly((s) => !s)}
          count={cards.length}
          filteredCount={filteredCards.length}
          filtersActive={filtersActive}
          showFilters={showFilters}
          onToggleFilters={() => setShowFilters((s) => !s)}
          onMenuOpen={() => setDrawerOpen(true)}
        />
        <SearchBar
          query={searchQuery}
          onChange={setSearchQuery}
          allCharacters={allCharacters}
        />
        {showFilters && (
          <FilterPanel filters={filters} onChange={setFilters} allSeries={allSeries} />
        )}
        {view === 'list' ? (
          <ListView cards={filteredCards} onSelect={handleSelect} onToggleFavorite={handleToggleFavorite} spIndex={spIndex} />
        ) : (
          <MosaicView cards={filteredCards} onSelect={handleSelect} onToggleFavorite={handleToggleFavorite} spIndex={spIndex} />
        )}
        <BackToTop />
      </div>
    </>
  );
}

export default App;
