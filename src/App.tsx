import { useState, useEffect, useCallback } from 'react';
import type { Card, ViewMode } from './types';
import { loadCards, saveCards, addCard, updateCard, deleteCard, makeCardId } from './store';
import { parseCSV, downloadCSV } from './csv';
import Header from './components/Header';
import ListView from './components/ListView';
import MosaicView from './components/MosaicView';
import CardDetail from './components/CardDetail';
import AddCardForm from './components/AddCardForm';
import './styles/app.css';

function App() {
  const [cards, setCards] = useState<Card[]>([]);
  const [view, setView] = useState<ViewMode>('list');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (selectedIndex === null) return;
      const next =
        direction === 'right'
          ? Math.min(selectedIndex + 1, cards.length - 1)
          : Math.max(selectedIndex - 1, 0);
      setSelectedIndex(next);
    },
    [selectedIndex, cards.length]
  );

  if (loading) {
    return <div className="loading">Chargement...</div>;
  }

  if (selectedIndex !== null && cards[selectedIndex]) {
    return (
      <CardDetail
        card={cards[selectedIndex]}
        onBack={() => setSelectedIndex(null)}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onSwipe={handleSwipe}
        hasPrev={selectedIndex > 0}
        hasNext={selectedIndex < cards.length - 1}
      />
    );
  }

  if (showAdd) {
    return <AddCardForm onAdd={handleAdd} onCancel={() => setShowAdd(false)} />;
  }

  return (
    <div className="app">
      <Header
        view={view}
        onViewChange={setView}
        onAdd={() => setShowAdd(true)}
        onImport={handleImport}
        onExport={handleExport}
        count={cards.length}
      />
      {view === 'list' ? (
        <ListView cards={cards} onSelect={handleSelect} />
      ) : (
        <MosaicView cards={cards} onSelect={handleSelect} />
      )}
    </div>
  );
}

export default App;
