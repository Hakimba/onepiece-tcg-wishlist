import { useState, useMemo } from 'react';

interface Props {
  query: string;
  onChange: (query: string) => void;
  allCharacters: string[];
}

export default function SearchBar({ query, onChange, allCharacters }: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return allCharacters.filter((name) => name.toLowerCase().includes(q));
  }, [query, allCharacters]);

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Rechercher..."
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
        />
        {query && (
          <button className="search-clear" onClick={() => onChange('')}>
            ×
          </button>
        )}
      </div>
      {showSuggestions && suggestions.length > 0 && (
        <ul className="search-suggestions">
          {suggestions.slice(0, 6).map((name) => (
            <li
              key={name}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(name);
                setShowSuggestions(false);
              }}
            >
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
