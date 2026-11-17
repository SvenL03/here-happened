"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";

export interface SearchHit {
  id: string;
  name: string;
  context: string;
  lat: number;
  lng: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_id?: number;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
  };
}

function toHit(f: PhotonFeature, i: number): SearchHit {
  const p = f.properties;
  const name = p.name || [p.street, p.housenumber].filter(Boolean).join(" ") || p.city || "Unnamed place";
  const context = [p.city !== name ? p.city : undefined, p.county, p.state, p.country]
    .filter((x, j, a) => x && a.indexOf(x) === j)
    .join(", ");
  return { id: `${p.osm_id ?? i}-${i}`, name, context, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
}

export function SearchBox({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ac = new AbortController();
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const r = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=5&lang=en`, { signal: ac.signal });
        const j = (await r.json()) as { features: PhotonFeature[] };
        setHits(j.features.map(toHit));
        setFailed(false);
        setActive(-1);
        setOpen(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!ac.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

  const short = q.trim().length < 2;
  const shown = short ? [] : hits;

  const choose = (h: SearchHit) => {
    setOpen(false);
    setQ(h.name);
    inputRef.current?.blur();
    onPick(h);
  };

  return (
    <div className="hh-search" role="search">
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Search for a place
      </label>
      <Search className="hh-search-icon" size={18} aria-hidden />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        className="hh-search-input"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search any place or landmark"
        value={q}
        role="combobox"
        aria-expanded={open && shown.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => shown.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            const h = shown[active >= 0 ? active : 0];
            if (h) {
              e.preventDefault();
              choose(h);
            }
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {q && (
        <button type="button" className="hh-search-clear" aria-label="Clear search" onClick={() => (setQ(""), inputRef.current?.focus())}>
          <X size={16} aria-hidden />
        </button>
      )}
      {open && (shown.length > 0 || failed || (!busy && !short)) && (
        <ul id={listId} role="listbox" className="hh-search-list">
          {failed && <li className="hh-search-empty">Search is unreachable right now. You can still tap the map.</li>}
          {!failed && shown.length === 0 && <li className="hh-search-empty">No place by that name. Try a town or a landmark.</li>}
          {shown.map((h, i) => (
            <li
              key={h.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className="hh-search-hit"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(h)}
            >
              <span className="hh-search-hit-name">{h.name}</span>
              {h.context && <span className="hh-search-hit-ctx">{h.context}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
