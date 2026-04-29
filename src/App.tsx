import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Option, pipe } from 'effect';
import { useAppStore } from './hooks/useAppStore';
import { useTheme } from './hooks/useTheme';
import { AppAction } from './state/AppAction';
import type { Card, CardId } from './domain/Card';
import { IdCard } from './domain/Card';
import type { SetCode } from './domain/SetCode';
import * as SC from './domain/SetCode';
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
import ImportModal from './components/ImportModal';
import SharedView from './components/SharedView';
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
    handleSelectCardIndex,
    handleClear,
    handleDisambiguationFinish,
    handleSwipe,
    handleSelectCharacter,
    handleOpenImportModal,
    handleCloseImportModal,
    handleImportBySerie,
    handleShare,
  } = useAppStore();

  const { theme, toggleTheme } = useTheme();
  const scrollYRef = useRef(0);
  const prevTagRef = useRef(state._tag);
  const pendingScrollIdRef = useRef<CardId | null>(null);

  // Track scrollY in real time while on Home — capturing it from a useEffect
  // *after* the transition is too late: CardDetail is shorter, browser clamps
  // scrollY to 0 before the effect runs.
  useEffect(() => {
    if (state._tag !== 'Home') return;
    scrollYRef.current = window.scrollY;
    const onScroll = () => { scrollYRef.current = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [state._tag]);

  // On return to Home, either scroll to a freshly added card or restore the
  // saved scroll position. Retry across frames because the mosaic/list layout
  // height isn't always settled on the first frame.
  useLayoutEffect(() => {
    const prev = prevTagRef.current;
    prevTagRef.current = state._tag;
    if (state._tag !== 'Home') return;

    const pendingId = pendingScrollIdRef.current;
    if (pendingId) {
      pendingScrollIdRef.current = null;
      let frames = 0;
      const tryScroll = () => {
        const el = document.querySelector(
          `[data-card-id="${CSS.escape(pendingId)}"]`,
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
        if (frames < 10) { frames++; requestAnimationFrame(tryScroll); }
      };
      tryScroll();
      return;
    }

    if (prev !== 'Home' && scrollYRef.current > 0) {
      const target = scrollYRef.current;
      let frames = 0;
      const apply = () => {
        window.scrollTo(0, target);
        if (Math.abs(window.scrollY - target) > 2 && frames < 10) {
          frames++;
          requestAnimationFrame(apply);
        }
      };
      apply();
    }
  }, [state._tag]);

  const handleAddWithScroll = useCallback((card: Card) => {
    pendingScrollIdRef.current = card.id;
    handleAdd(card);
  }, [handleAdd]);

  const validPrefixes = useMemo((): ReadonlySet<SetCode> => {
    const s = new Set<SetCode>();
    if (!ctx) return s;
    for (const id of Object.keys(ctx.variantsIndex)) {
      pipe(
        SC.extractFromIdCard(IdCard(id)),
        Option.map((code) => s.add(code)),
      );
    }
    return s;
  }, [ctx]);

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

  if (state._tag === 'SharedView') {
    if (!ctx || !ui) return null;
    return (
      <SharedView
        ctx={ctx}
        ui={ui}
        dispatch={dispatch}
        theme={theme}
        toggleTheme={toggleTheme}
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

  if (state._tag === 'CardDetail' && detailCard) {
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
          onAdd={handleAddWithScroll}
          onCancel={() => {
            pendingScrollIdRef.current = null;
            dispatch(AppAction.HideAdd());
          }}
          error={state.error}
          validPrefixes={validPrefixes}
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
      {ui.importModalOpen && (
        <ImportModal
          onClose={handleCloseImportModal}
          onImportCsv={handleImport}
          onImportBySerie={handleImportBySerie}
          variantsIndex={ctx.variantsIndex}
          setLists={ctx.setLists}
          existingCards={ctx.cards}
        />
      )}
      <div className="app">
        <Header
          view={ui.view}
          onViewChange={(v: ViewMode) => dispatch(AppAction.UpdateUI({ fn: (u) => ({ ...u, view: v }) }))}
          onAdd={() => dispatch(AppAction.ShowAdd())}
          onOpenImportModal={handleOpenImportModal}
          onExport={handleExport}
          onShare={handleShare}
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
          theme={theme}
          onToggleTheme={toggleTheme}
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
            onSelect={handleSelectCardIndex}
            onToggleFavorite={handleToggleFavorite}
            spIndex={ctx.spIndex}
          />
        ) : (
          <MosaicView
            cards={filteredCards}
            onSelect={handleSelectCardIndex}
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
