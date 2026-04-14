import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Card, ViewMode, FilterState, PageId } from './types';
import { loadCards, saveCards, addCard, updateCard, deleteCard, makeCardId } from './store';
import { parseCSV, downloadCSV } from './csv';
import { applyFilters, defaultFilters, hasActiveFilters } from './filters';
import Header from './components/Header';
import FilterPanel from './components/FilterPanel';
import ListView from './components/ListView';
import MosaicView from './components/MosaicView';
import CardDetail from './components/CardDetail';
import AddCardForm from './components/AddCardForm';
import SideDrawer from './components/SideDrawer';
import SearchBar from './components/SearchBar';
import CharactersPage from './components/CharactersPage';
import BackToTop from './components/BackToTop';
import './styles/app.css';

function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filtersActive = hasActiveFilters(filters) || searchQuery.trim() !== '';
  const filteredCards = useMemo(() => {
    const byFilters = applyFilters(cards, filters);
    if (!searchQuery.trim()) return byFilters;
    const q = searchQuery.trim().toLowerCase();
    return byFilters.filter((c) =>
      c.character.toLowerCase().includes(q) || c.idcard.toLowerCase().includes(q)
    );
  }, [cards, filters, searchQuery]);
  const allSeries = useMemo(() => [...new Set(cards.map((c) => c.serie))].sort(), [cards]);
  const allCharacters = useMemo(
    () => [...new Set(cards.map((c) => c.character).filter(Boolean))].sort(),
    [cards]
  );

  useEffect(() => {
    loadCards().then((c) => {
      setCards(c);
      setLoading(false);
    });
  }, []);

  const handleImport = useCallback(async (file: File) => {
    const text = await file.text();
    const imported = parseCSV(text);
    const existing = await loadCards();
    const existingMap = new Map(existing.map((c) => [c.id, c]));
    const merged = [...existing];
    for (const card of imported) {
      const ex = existingMap.get(card.id);
      if (ex) {
        if (card.buyLink) ex.buyLink = card.buyLink;
        if (card.price) ex.price = card.price;
      } else {
        merged.push(card);
        existingMap.set(card.id, card);
      }
    }
    await saveCards(merged);
    setCards(merged);
  }, []);

  const handleExport = useCallback(() => {
    downloadCSV(cards);
  }, [cards]);

  const handleAdd = useCallback(async (card: Omit<Card, 'id'>) => {
    const newCard: Card = { ...card, id: makeCardId(card.idcard, card.rarity) };
    const updated = await addCard(newCard);
    setCards(updated);
    setShowAdd(false);
  }, []);

  const handleUpdate = useCallback(async (card: Card) => {
    const updated = await updateCard(card);
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
          onSwipe={handleSwipe}
          hasPrev={selectedIndex > 0}
          hasNext={selectedIndex < filteredCards.length - 1}
        />
      </>
    );
  }

  if (showAdd) {
    return (
      <>
        {drawer}
        <AddCardForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />
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
          <ListView cards={filteredCards} onSelect={handleSelect} />
        ) : (
          <MosaicView cards={filteredCards} onSelect={handleSelect} />
        )}
        <BackToTop />
      </div>
    </>
  );
}

export default App;
