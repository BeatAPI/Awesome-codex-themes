import { useMemo, useState } from 'react';

import catalog from '../generated/themes.json';

type Theme = (typeof catalog)[number] & {
  nativeName?: string;
  nativeLocale?: string;
};

const themes = [...(catalog as Theme[])].sort((left, right) => {
  const featuredDifference = Number(right.tags.includes('featured')) - Number(left.tags.includes('featured'));
  return featuredDifference || left.name.localeCompare(right.name);
});
const categories = [...new Set(themes.flatMap((theme) => theme.categories))].sort();
const previewPaletteRoles = ['background', 'surface', 'text', 'accent', 'success'] as const;

function titleCase(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function previewUrl(theme: Theme) {
  return `${import.meta.env.BASE_URL}${theme.preview.replace(/^\//, '')}`;
}

function ThemeCard({ theme, onOpen }: { theme: Theme; onOpen: (theme: Theme) => void }) {
  const featured = theme.tags.includes('featured');
  return (
    <article className={`theme-card${featured ? ' theme-card--featured' : ''}`} style={{ '--theme-accent': theme.palette.accent } as React.CSSProperties}>
      <button className="theme-preview" type="button" onClick={() => onOpen(theme)} aria-label={`View ${theme.name}`}>
        <img src={previewUrl(theme)} alt={`${theme.name} Codex workspace preview`} />
        <span className="theme-preview__index" aria-hidden="true">{String(themes.indexOf(theme) + 1).padStart(2, '0')}</span>
        {featured ? <span className="theme-preview__flag" aria-hidden="true">Flagship / 01</span> : null}
        <span className="theme-preview__action" aria-hidden="true">Open specimen ↗</span>
      </button>
      <div className="theme-card__body">
        <div className="theme-card__meta">
          <span>{theme.mode}</span>
          <span>{theme.compatibility.status}</span>
        </div>
        <h2>{theme.name}</h2>
        {theme.nativeName ? <p className="theme-card__native" lang={theme.nativeLocale}>{theme.nativeName}</p> : null}
        <p>{theme.description}</p>
        <div className="theme-card__footer">
          <div className="palette" aria-label={`${theme.name} color palette`}>
            {previewPaletteRoles.map((name) => (
              <span key={name} title={`${name}: ${theme.palette[name]}`} style={{ background: theme.palette[name] }} />
            ))}
          </div>
          <button type="button" className="text-button" onClick={() => onOpen(theme)} aria-label={`Read ${theme.name} details`}>
            Details <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function ThemeDialog({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  async function copyCommand() {
    await navigator.clipboard.writeText(theme.command);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1_800);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="theme-dialog" role="dialog" aria-modal="true" aria-label={theme.name}>
        <button type="button" className="dialog-close" onClick={onClose} aria-label="Close theme details">×</button>
        <div className="dialog-preview">
          <img src={previewUrl(theme)} alt={`${theme.name} full workspace preview`} />
        </div>
        <div className="dialog-copy">
          <p className="eyebrow">Theme specimen / {theme.version}</p>
          <h2>{theme.name}</h2>
          {theme.nativeName ? <p className="theme-dialog__native" lang={theme.nativeLocale}>{theme.nativeName}</p> : null}
          <p className="dialog-description">{theme.description}</p>
          <dl className="detail-grid">
            <div><dt>Status</dt><dd>{theme.compatibility.status}</dd></div>
            <div><dt>Mode</dt><dd>{theme.mode}</dd></div>
            <div><dt>Compatibility</dt><dd>Best effort on every numeric Codex Desktop version</dd></div>
            <div><dt>Highly compatible</dt><dd>{theme.compatibility.verifiedAppVersions.join(', ')}</dd></div>
            <div><dt>Artwork</dt><dd>{theme.license.artwork}</dd></div>
            <div><dt>Coverage</dt><dd>{theme.tags.includes('full-workspace') ? 'Full workspace' : 'Legacy palette'}</dd></div>
          </dl>
          <div className="tag-list" aria-label="Theme tags">
            {theme.tags.map((tag) => <span key={tag}>#{tag}</span>)}
          </div>
          <div className="command-box">
            <code>{theme.command}</code>
            <button type="button" onClick={copyCommand} aria-label={copied ? 'Command copied' : 'Copy install command'}>
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="dialog-note">Experimental Mac-first runtime theme. Run <code>doctor</code> first. If the interface looks wrong, run <code>pause</code> or <code>restore</code> to return to the official UI, then file a GitHub Issue with the Codex version and a privacy-safe screenshot.</p>
        </div>
      </section>
    </div>
  );
}

export function App() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const flagship = themes.find((theme) => theme.tags.includes('featured')) ?? themes[0];

  const filteredThemes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return themes.filter((theme) => {
      const matchesCategory = category === 'all' || theme.categories.includes(category);
      const searchable = [theme.name, theme.nativeName, theme.description, ...theme.categories, ...theme.tags]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesCategory && (!normalized || searchable.includes(normalized));
    });
  }, [category, query]);

  function clearFilters() {
    setQuery('');
    setCategory('all');
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="Awesome Codex Themes home">
          <span className="wordmark__mark">A/</span>
          <span>Awesome Codex Themes</span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#collection">Collection</a>
          <a href="#principles">Principles</a>
          <a href="https://github.com/erickkkyt/Awesome-codex-themes">GitHub ↗</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero__copy">
            <p className="eyebrow">Open-source Codex skin system / macOS</p>
            <h1>Make Codex feel like yours.</h1>
            <p className="hero__lede">Twelve complete full-workspace themes, one persistent local agent, and an inspectable adapter with diagnostics, switching, and recovery built in.</p>
            <div className="hero__actions">
              <a className="button button--primary" href="#collection">Browse the collection</a>
              <a className="button button--secondary" href="https://github.com/erickkkyt/Awesome-codex-themes">Inspect the source ↗</a>
            </div>
          </div>
          <button
            className="hero__specimen"
            type="button"
            onClick={() => setSelectedTheme(flagship)}
            aria-label={`Open ${flagship.name} flagship`}
          >
            <img src={previewUrl(flagship)} alt={`${flagship.name} complete Codex theme mockup`} />
            <span className="hero__specimen-label" aria-hidden="true">
              <b>{flagship.name.toUpperCase()}</b>
              <span>Featured theme · open specimen ↗</span>
            </span>
          </button>
          <div className="hero__folio" aria-label="Collection summary">
            <span className="folio-number">12</span>
            <div>
              <strong>12 complete themes</strong>
              <strong>1 featured flagship</strong>
              <span>MIT engine · local packages</span>
            </div>
          </div>
          <div className="hero__orbit" aria-hidden="true"><span /><span /><span /></div>
        </section>

        <section className="collection" id="collection">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Volume 01 / launch collection</p>
              <h2>Choose a visual climate.</h2>
            </div>
            <p>{filteredThemes.length} {filteredThemes.length === 1 ? 'theme' : 'themes'} shown</p>
          </div>

          <div className="catalog-tools">
            <label className="search-field">
              <span>Search themes</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “night city” or “ukiyoe”"
                aria-label="Search themes"
              />
              <span aria-hidden="true">⌕</span>
            </label>
            <div className="filter-list" aria-label="Theme categories">
              <button type="button" className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>All</button>
              {categories.map((item) => (
                <button key={item} type="button" className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)}>
                  {titleCase(item)}
                </button>
              ))}
            </div>
          </div>

          {filteredThemes.length ? (
            <div className="theme-grid">
              {filteredThemes.map((theme) => <ThemeCard key={theme.slug} theme={theme} onOpen={setSelectedTheme} />)}
            </div>
          ) : (
            <div className="empty-state">
              <span aria-hidden="true">∅</span>
              <h2>No matching themes.</h2>
              <p>Try another word or return to the complete twelve-theme collection.</p>
              <button type="button" className="button button--primary" onClick={clearFilters}>Clear search and filters</button>
            </div>
          )}
        </section>

        <section className="principles" id="principles">
          <div className="principles__intro">
            <p className="eyebrow">Operating principles</p>
            <h2>Decoration should never outrank recovery.</h2>
          </div>
          <ol>
            <li><span>01</span><div><h3>Local by construction</h3><p>Theme packages use local CSS, metadata, and documented artwork. No remote JavaScript and no conversation access.</p></div></li>
            <li><span>02</span><div><h3>Verify the boundary</h3><p>The engine checks the signed app, loopback endpoint, and renderer target before attempting a verified or best-effort adapter.</p></div></li>
            <li><span>03</span><div><h3>One owner, clean exit</h3><p>Injection is namespaced and idempotent. Pause and uninstall remove only the state owned by Awesome Codex Themes.</p></div></li>
          </ol>
        </section>
      </main>

      <footer>
        <div className="footer-mark">A/</div>
        <div><strong>Awesome Codex Themes</strong><p>An independent open-source project.</p></div>
        <p>Unofficial and not affiliated with or endorsed by OpenAI. Codex is a trademark of its respective owner.</p>
      </footer>

      {selectedTheme ? <ThemeDialog theme={selectedTheme} onClose={() => setSelectedTheme(null)} /> : null}
    </div>
  );
}
