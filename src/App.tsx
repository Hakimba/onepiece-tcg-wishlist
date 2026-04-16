import { useEffect } from 'react';
import { useAppStore } from './hooks/useAppStore';
import { AppAction } from './state/AppAction';
import type { ViewMode, SortPrice } from './state/AppState';
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
  const {
    state,
    dispatch,
    cards,
    filteredCards,
    filtersActive,
    allSeries,
    allCharacters,
    ctx,
    ui,
    handleImport,
    handleExport,
    handleAdd,
    handleUpdate,
    handleDelete,
    handleToggleFavorite,
    handleClear,
    handleDisambiguationFinish,
    handleSwipe,
    handleSelectCharacter,
  } = useAppStore();

  const detailCard = state._tag === 'CardDetail' ? filteredCards[state.index] : undefined;
  const detailCardMissing = state._tag === 'CardDetail' && !detailCard;
  useEffect(() => {
    if (detailCardMissing) dispatch(AppAction.DeselectCard());
  }, [detailCardMissing, dispatch]);

  if (state._tag === 'Loading') {
    return <div className="loading">Chargement...</div>;
  }

  if (state._tag === 'Disambiguation') {
    return (
      <DisambiguationQueue
        ambiguous={state.ambiguous}
        resolved={state.resolved}
        mode={state.mode}
        onFinish={handleDisambiguationFinish}
        onCancel={() => dispatch(AppAction.CancelDisambiguation())}
      />
    );
  }

  if (!ctx || !ui) return null;

  const drawer = (
    <SideDrawer
      open={ui.drawerOpen}
      currentPage={state._tag === 'Characters' ? 'characters' : 'home'}
      onNavigate={(page) => dispatch(AppAction.Navigate({ page }))}
      onClose={() => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, drawerOpen: false }) }))}
    />
  );

  if (state._tag === 'CardDetail') {
    if (!detailCard) return null;
    return (
      <>
        {drawer}
        <CardDetail
          card={detailCard}
          onBack={() => dispatch(AppAction.DeselectCard())}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onToggleFavorite={handleToggleFavorite}
          onSwipe={handleSwipe}
          hasPrev={state.index > 0}
          hasNext={state.index < filteredCards.length - 1}
          spIndex={ctx.spIndex}
        />
      </>
    );
  }

  if (state._tag === 'AddCard') {
    return (
      <>
        {drawer}
        <AddCardForm
          onAdd={handleAdd}
          onCancel={() => dispatch(AppAction.HideAdd())}
          error={state.error}
        />
      </>
    );
  }

  if (state._tag === 'Characters') {
    return (
      <>
        {drawer}
        <CharactersPage
          cards={cards}
          onSelectCharacter={handleSelectCharacter}
          onBack={() => dispatch(AppAction.Navigate({ page: 'home' }))}
        />
      </>
    );
  }

  // Home
  return (
    <>
      {drawer}
      <div className="app">
        <Header
          view={ui.view}
          onViewChange={(v: ViewMode) => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, view: v }) }))}
          onAdd={() => dispatch(AppAction.ShowAdd())}
          onImport={handleImport}
          onExport={handleExport}
          onClear={handleClear}
          sortPrice={ui.sortPrice}
          onSortPrice={(s: SortPrice) => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, sortPrice: s }) }))}
          showFavoritesOnly={ui.showFavoritesOnly}
          onToggleFavorites={() => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, showFavoritesOnly: !u.showFavoritesOnly }) }))}
          count={cards.length}
          filteredCount={filteredCards.length}
          filtersActive={filtersActive}
          showFilters={ui.showFilters}
          onToggleFilters={() => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, showFilters: !u.showFilters }) }))}
          onMenuOpen={() => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, drawerOpen: true }) }))}
        />
        <SearchBar
          query={ui.searchQuery}
          onChange={(q) => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, searchQuery: q }) }))}
          allCharacters={allCharacters}
        />
        {ui.showFilters && (
          <FilterPanel
            filters={ui.filters}
            onChange={(f) => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, filters: f }) }))}
            allSeries={allSeries}
          />
        )}
        {ui.view === 'list' ? (
          <ListView
            cards={filteredCards}
            onSelect={(i) => dispatch(AppAction.SelectCard({ index: i }))}
            onToggleFavorite={handleToggleFavorite}
            spIndex={ctx.spIndex}
          />
        ) : (
          <MosaicView
            cards={filteredCards}
            onSelect={(i) => dispatch(AppAction.SelectCard({ index: i }))}
            onToggleFavorite={handleToggleFavorite}
            spIndex={ctx.spIndex}
          />
        )}
        <BackToTop />
      </div>
    </>
  );
}

export default App;
