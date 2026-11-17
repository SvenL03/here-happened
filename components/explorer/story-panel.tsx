"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Share2, RotateCw, ZoomOut } from "lucide-react";
import { ERAS, type EraId, type Scope, type TimelineEntry } from "@/lib/contract";
import type { StoryState } from "./use-place-story";
import { SCOPE_NAME, SCOPE_ORDER, fmtCoords, fmtKm, langName, scopeLabel, yearSpan } from "./format";

export const SUGGESTIONS = [
  { label: "Colosseum, Rome", lat: 41.89, lng: 12.492 },
  { label: "Cedarville, Ohio", lat: 39.744, lng: -83.808 },
  { label: "Nan Madol, Pohnpei", lat: 6.844, lng: 158.335 },
  { label: "Timbuktu, Mali", lat: 16.773, lng: -3.008 },
  { label: "Hagia Sophia, Istanbul", lat: 41.008, lng: 28.98 },
];

/* ------------------------------------------------------------------ */

function ScopeGauge({ level }: { level: Scope }) {
  // Concentric rings, spot at the centre and country at the edge; the ring we found history at is marked.
  const idx = level === "sea" ? SCOPE_ORDER.length - 1 : SCOPE_ORDER.indexOf(level);
  return (
    <svg className="hh-gauge" viewBox="0 0 64 64" width="56" height="56" aria-hidden>
      {SCOPE_ORDER.map((s, i) => {
        const r = 4 + i * 5.2;
        return (
          <circle
            key={s}
            cx="32"
            cy="32"
            r={r}
            className={i === idx ? "hh-gauge-hit" : i < idx ? "hh-gauge-miss" : "hh-gauge-ring"}
          />
        );
      })}
      <circle cx="32" cy="32" r="2" className="hh-gauge-dot" />
    </svg>
  );
}

/** Overpass sets its middle dot tight to the next word; a separate, evenly spaced dot reads right. */
function Sep() {
  return (
    <span className="hh-sep" aria-hidden>
      ·
    </span>
  );
}

function Dotted({ text }: { text: string }) {
  const parts = text.split(" · ");
  return (
    <>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <Sep />}
          {p}
        </span>
      ))}
    </>
  );
}

function Skel({ w = "100%", h = 14 }: { w?: string; h?: number }) {
  return <span className="hh-skel" style={{ width: w, height: h }} aria-hidden />;
}

function Entry({ e }: { e: TimelineEntry }) {
  const foreign = e.lang && e.lang !== "en";
  return (
    <li className="hh-entry">
      <p className="hh-entry-date">{e.dateLabel}</p>
      <blockquote className="hh-entry-quote" lang={e.lang || undefined} cite={e.source.url}>
        <p>{e.text}</p>
      </blockquote>
      <p className="hh-entry-meta">
        <span className={`hh-chip hh-chip-${e.scope}`}>
          <Dotted text={scopeLabel(e)} />
        </span>
        <a className="hh-src" href={e.source.url} target="_blank" rel="noopener noreferrer">
          <span className="hh-src-title">{e.source.title}</span>
          <span className="hh-src-pub">
            <Sep />
            {e.source.publisher}
          </span>
          <ArrowUpRight size={14} aria-hidden className="hh-src-arrow" />
        </a>
        {foreign && (
          <span className="hh-lang" title={`Quoted in ${langName(e.lang)}`}>
            {langName(e.lang)}
          </span>
        )}
      </p>
    </li>
  );
}

function EraRail({
  groups,
  active,
  onJump,
}: {
  groups: Map<EraId, TimelineEntry[]>;
  active: EraId | null;
  onJump: (id: EraId) => void;
}) {
  return (
    <nav className="hh-rail" aria-label="Jump to an era">
      <ol className="hh-rail-list">
        {ERAS.map((era) => {
          const n = groups.get(era.id)?.length ?? 0;
          return (
            <li key={era.id} className="hh-rail-item">
              <button
                type="button"
                className="hh-rail-btn"
                disabled={n === 0}
                aria-current={active === era.id ? "true" : undefined}
                aria-label={`${era.label}: ${n} ${n === 1 ? "record" : "records"}`}
                onClick={() => onJump(era.id)}
              >
                <span className="hh-rail-ticks" aria-hidden>
                  {Array.from({ length: Math.min(n, 6) }).map((_, i) => (
                    <i key={i} />
                  ))}
                </span>
                <span className="hh-rail-label">{era.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ */

export function StoryPanel({
  state,
  scrollRoot,
  onPick,
  onRetry,
  onWiden,
  onShare,
}: {
  state: StoryState;
  scrollRoot: React.RefObject<HTMLDivElement | null>;
  onPick: (lat: number, lng: number, label?: string) => void;
  onRetry: () => void;
  onWiden: () => void;
  onShare: () => void;
}) {
  const { status, place, point, timeline, nearby, coverage, sources, notices, error } = state;

  const groups = useMemo(() => {
    const m = new Map<EraId, TimelineEntry[]>();
    if (!timeline) return m;
    for (const e of [...timeline].sort((a, b) => a.year - b.year)) {
      const g = m.get(e.era) ?? [];
      g.push(e);
      m.set(e.era, g);
    }
    return m;
  }, [timeline]);

  const [activeEra, setActiveEra] = useState<EraId | null>(null);

  useEffect(() => {
    const root = scrollRoot.current;
    if (!root || !timeline?.length) return;
    const heads = Array.from(root.querySelectorAll<HTMLElement>("[data-era]"));
    const onScroll = () => {
      const rail = root.querySelector<HTMLElement>(".hh-rail");
      const top = (rail ? rail.getBoundingClientRect().bottom : root.getBoundingClientRect().top) + 56;
      let cur: EraId | null = (heads[0]?.dataset.era as EraId) ?? null;
      for (const h of heads) if (h.getBoundingClientRect().top <= top) cur = h.dataset.era as EraId;
      setActiveEra(cur);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [scrollRoot, timeline]);

  const jump = (id: EraId) => {
    const root = scrollRoot.current;
    const el = root?.querySelector<HTMLElement>(`[data-era="${id}"]`);
    if (!root || !el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const rail = root.querySelector<HTMLElement>(".hh-rail");
    const y = el.offsetTop - (rail?.offsetHeight ?? 0) - 8;
    root.scrollTo({ top: y, behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  };

  /* ---------- Idle: invitation ---------- */
  if (status === "idle" && !place) {
    return (
      <div className="hh-story hh-intro">
        <h1 className="hh-intro-title">Tap anywhere on Earth to read what happened there.</h1>
        <p className="hh-intro-lede">
          Every line is quoted from a real source you can open. Where little is recorded, we say so.
        </p>
        <div className="hh-try">
          <p className="hh-try-label">Try</p>
          <ul className="hh-try-list">
            {SUGGESTIONS.map((s) => (
              <li key={s.label}>
                <button type="button" className="hh-try-btn" onClick={() => onPick(s.lat, s.lng, s.label)}>
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const loadingTimeline = timeline === null && status === "loading";
  const empty = status === "done" && timeline !== null && timeline.length === 0;
  const lat = place?.lat ?? point?.lat ?? 0;
  const lng = place?.lng ?? point?.lng ?? 0;

  return (
    <article className="hh-story" aria-busy={status === "loading"}>
      {/* ---------- Place header ---------- */}
      <header className="hh-place">
        <p className="hh-coords" translate="no">
          {fmtCoords(lat, lng)}
        </p>
        {place ? (
          <h1 className="hh-place-name">{place.name}</h1>
        ) : (
          <h1 className="hh-place-name hh-place-name-pending">
            <span className="sr-only">Finding this place</span>
            <Skel w="62%" h={40} />
          </h1>
        )}
        {place ? (
          place.context ? <p className="hh-place-ctx">{place.context}</p> : null
        ) : (
          <p className="hh-place-ctx">
            <Skel w="48%" />
          </p>
        )}
        {place && (
          <div className="hh-place-actions">
            <button type="button" className="hh-btn hh-btn-quiet" onClick={onShare}>
              <Share2 size={16} aria-hidden />
              Share this place
            </button>
            {timeline && timeline.length > 0 && (
              <p className="hh-peek-summary">
                {`${timeline.length} ${timeline.length === 1 ? "record" : "records"}`}
                <Sep />
                {yearSpan(timeline)}
              </p>
            )}
          </div>
        )}
      </header>

      {/* ---------- Notices ---------- */}
      {notices.map((n, i) => (
        <p key={i} className={`hh-notice hh-notice-${n.kind}`} role="status">
          {n.message}
        </p>
      ))}
      {status === "error" && error && (
        <div className="hh-notice hh-notice-error" role="alert">
          <p>Couldn&rsquo;t reach the record for this spot. {error}</p>
          <button type="button" className="hh-btn hh-btn-quiet" onClick={onRetry}>
            <RotateCw size={16} aria-hidden />
            Try again
          </button>
        </div>
      )}

      {/* ---------- Coverage ---------- */}
      {coverage ? (
        <section className="hh-coverage" aria-label="How close this history is">
          <ScopeGauge level={coverage.level} />
          <div>
            <p className="hh-coverage-level">
              Closest record: <strong>{SCOPE_NAME[coverage.level].toLowerCase()}</strong>
            </p>
            <p className="hh-coverage-note">{coverage.note}</p>
          </div>
        </section>
      ) : loadingTimeline ? (
        <section className="hh-coverage hh-coverage-pending" aria-hidden>
          <span className="hh-skel hh-skel-round" style={{ width: 56, height: 56 }} />
          <div style={{ flex: 1 }}>
            <Skel w="40%" />
            <Skel w="92%" />
            <Skel w="70%" />
          </div>
        </section>
      ) : null}

      {/* ---------- Timeline ---------- */}
      {loadingTimeline && (
        <section className="hh-timeline" aria-label="Timeline, loading">
          {/* Announced by the explorer's live region; a status role here would repeat it. */}
          <p className="hh-loading-line">Reading the record…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="hh-entry hh-entry-skel" aria-hidden>
              <Skel w="22%" h={12} />
              <Skel w="96%" h={18} />
              <Skel w="84%" h={18} />
              <Skel w="40%" h={12} />
            </div>
          ))}
        </section>
      )}

      {empty && (
        <section className="hh-empty">
          <h2 className="hh-h2">Nothing on record here yet</h2>
          <p>
            No source we can quote mentions this spot or the places around it. Zoom out and try the nearest town, or pick one of the
            places nearby.
          </p>
          <button type="button" className="hh-btn hh-btn-solid" onClick={onWiden}>
            <ZoomOut size={16} aria-hidden />
            Widen the view
          </button>
        </section>
      )}

      {timeline && timeline.length > 0 && (
        <section className="hh-timeline" aria-labelledby="hh-tl-h">
          <h2 id="hh-tl-h" className="sr-only">
            Timeline
          </h2>
          <EraRail groups={groups} active={activeEra} onJump={jump} />
          {ERAS.filter((e) => groups.has(e.id)).map((era) => (
            <div key={era.id} className="hh-era">
              <h3 className="hh-era-title" data-era={era.id} tabIndex={-1}>
                {era.label}
                <span className="hh-era-count">{groups.get(era.id)!.length}</span>
              </h3>
              <ol className="hh-entries">
                {groups.get(era.id)!.map((e) => (
                  <Entry key={e.id} e={e} />
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}

      {/* ---------- Nearby ---------- */}
      {nearby === null && status === "loading" ? (
        <section className="hh-nearby" aria-hidden>
          <h2 className="hh-h2">Nearby</h2>
          {[0, 1, 2].map((i) => (
            <div key={i} className="hh-near-skel">
              <Skel w="55%" />
              <Skel w="14%" />
            </div>
          ))}
        </section>
      ) : nearby && nearby.length > 0 ? (
        <section className="hh-nearby" aria-labelledby="hh-near-h">
          <h2 id="hh-near-h" className="hh-h2">
            Nearby
          </h2>
          <ul className="hh-near-list">
            {nearby.map((n) => (
              <li key={n.id}>
                <button type="button" className="hh-near" onClick={() => onPick(n.lat, n.lng, n.title)}>
                  <span className="hh-near-title">
                    {n.title}
                    {n.dateLabel && (
                      <span className="hh-near-year">
                        <Sep />
                        {n.dateLabel}
                      </span>
                    )}
                  </span>
                  <span className="hh-near-dist">{fmtKm(n.distanceKm)}</span>
                  {n.summary && <span className="hh-near-sum">{n.summary}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------- Sources ---------- */}
      {sources && sources.length > 0 && (
        <section className="hh-sources" aria-labelledby="hh-src-h">
          <h2 id="hh-src-h" className="hh-h2">
            Sources
          </h2>
          <ul className="hh-src-list">
            {sources.map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="hh-src-row">
                  <span>{s.title}</span>
                  <span className="hh-src-pub">
                    {s.publisher}
                    {s.lang !== "en" ? (
                      <>
                        <Sep />
                        {langName(s.lang)}
                      </>
                    ) : null}
                  </span>
                </a>
              </li>
            ))}
          </ul>
          <p className="hh-fineprint">
            Quotes are reproduced as written in each source. Wikipedia text is available under CC BY-SA 4.0.
          </p>
        </section>
      )}
    </article>
  );
}
