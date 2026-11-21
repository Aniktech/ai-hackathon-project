type IconName =
  | "overview"
  | "stores"
  | "people"
  | "spark"
  | "stock"
  | "repeat"
  | "calendar"
  | "shield"
  | "search"
  | "bell"
  | "arrow"
  | "trend";

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    stores: <><path d="M3 10h18l-1.5-6h-15L3 10Z" /><path d="M5 10v10h14V10M9 20v-6h6v6M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    spark: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z" /><path d="m19 14 1 2.5 2.5 1-2.5 1L19 21l-1-2.5-2.5-1 2.5-1 1-2.5Z" /></>,
    stock: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="M3 12l9 5 9-5M3 16l9 5 9-5M12 13v8" /></>,
    repeat: <><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    trend: <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const navigation: { label: string; icon: IconName; active?: boolean; soon?: boolean }[] = [
  { label: "Executive Overview", icon: "overview", active: true },
  { label: "Area Manager Dashboard", icon: "stores" },
  { label: "Store Performance", icon: "trend" },
  { label: "Salesperson Performance", icon: "people" },
  { label: "Action Recommendations", icon: "spark" },
  { label: "Stock Insights", icon: "stock" },
  { label: "Customer Retention", icon: "repeat" },
  { label: "Weekly Impact Review", icon: "calendar" },
  { label: "Data Quality & Monitoring", icon: "shield" },
];

const levers = [
  { title: "More bills", detail: "Turn more visits into purchases", icon: "stores" as const },
  { title: "Bigger baskets", detail: "Build relevant product pairings", icon: "stock" as const },
  { title: "More repeat", detail: "Bring customers back after 30+ days", icon: "repeat" as const },
];

export default function Home() {
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="Store Coach home">
          <span className="brand-mark"><span /></span>
          <span className="brand-copy"><strong>Store Coach</strong><small>RETAIL INTELLIGENCE</small></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-avatar">V</span>
          <span className="workspace-text"><strong>Vedant Fashions</strong><small>AI Hackathon 2026</small></span>
          <span className="chevron">⌄</span>
        </div>

        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation" className="main-nav">
          {navigation.map((item) => (
            <div key={item.label} className={`nav-item${item.active ? " active" : ""}${!item.active ? " muted" : ""}`} aria-current={item.active ? "page" : undefined} aria-disabled={!item.active}>
              <Icon name={item.icon} size={17} />
              <span>{item.label}</span>
              {item.active && <span className="active-dot" />}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="season-note"><span className="season-kicker">A BETTER EVERYDAY</span><p>Clear priorities for every store, every morning.</p><span className="season-flower">✳</span></div>
          <div className="profile-row"><span className="profile-avatar">AM</span><span className="profile-copy"><strong>Area Manager</strong><small>Workspace preview</small></span><span className="more">···</span></div>
        </div>
      </aside>

      <section className="main-area" id="top">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>Executive Overview</strong></div>
          <div className="top-actions"><span className="date-label"><Icon name="calendar" size={15} /> Reporting period pending</span><button className="icon-button" aria-label="Search"><Icon name="search" /></button><button className="icon-button notification" aria-label="Notifications"><Icon name="bell" /></button><span className="top-avatar">AM</span></div>
        </header>

        <div className="page-content">
          <div className="eyebrow"><span className="eyebrow-line" /> VEDANT FASHIONS LIMITED <span className="eyebrow-separator">·</span> AI HACKATHON 2026</div>
          <div className="page-heading">
            <div><p className="greeting">EXECUTIVE OVERVIEW <span className="eyebrow-separator">·</span> DATA PREVIEW</p><h1>Your stores, <em>in focus.</em></h1><p className="page-subtitle">A clearer view of what needs attention and what your teams can do today.</p></div>
            <div className="data-state"><span className="state-dot" /><span><strong>Awaiting source workbook</strong><small>Metrics stay blank until validated data is connected</small></span></div>
          </div>

          <section className="intro-card" aria-labelledby="intro-title">
            <div className="intro-copy"><span className="intro-label">THE DAILY BRIEF</span><h2 id="intro-title">More bills. Bigger baskets.<br /><em>More repeat.</em></h2><p>Store Coach helps area managers spot the reason behind performance shifts and gives every salesperson one practical action to take today.</p><a className="text-link" href="#data-readiness">How Store Coach works <Icon name="arrow" size={15} /></a></div>
            <div className="intro-art" aria-hidden="true"><div className="art-sun" /><div className="art-arch arch-one" /><div className="art-arch arch-two" /><div className="art-arch arch-three" /><div className="art-ground" /><span className="art-stitch stitch-one" /><span className="art-stitch stitch-two" /></div>
          </section>

          <div className="section-heading"><div><p className="section-kicker">THE THREE LEVERS</p><h2>Performance at a glance</h2></div><span className="source-note">Verified metrics will appear here after data validation</span></div>
          <section className="metric-grid" aria-label="Performance metrics">
            {levers.map((lever, i) => <article className="metric-card" key={lever.title}><div className={`metric-icon metric-icon-${i}`}><Icon name={lever.icon} size={18} /></div><span className="metric-label">{lever.title}</span><strong className="metric-value">—</strong><span className="metric-detail">{lever.detail}</span><span className="metric-footnote">No source data connected</span></article>)}
          </section>

          <div className="lower-grid">
            <section className="panel priority-panel">
              <div className="panel-heading"><div><p className="section-kicker">AREA MANAGER DASHBOARD</p><h2>Priority stores</h2></div><span className="limit-badge">UP TO 5 / WEEK</span></div>
              <div className="empty-state"><span className="empty-icon"><Icon name="stores" size={20} /></span><strong>Your weekly priorities will appear here</strong><p>Issues will be ranked by rupees at stake and compared with relevant store peers.</p><span className="empty-meta"><span className="tiny-dot" /> Waiting for validated store data</span></div>
            </section>
            <section className="panel action-panel">
              <div className="panel-heading"><div><p className="section-kicker">SALES FLOOR</p><h2>Today’s actions</h2></div><span className="today-mark">TODAY</span></div>
              <div className="action-empty"><div className="action-illustration"><span className="action-spark">✳</span><span className="action-line line-a" /><span className="action-line line-b" /><span className="action-line line-c" /></div><strong>Useful coaching starts with real context</strong><p>Recommendations will name the person, behaviour and next step, using verified store and peer performance.</p></div>
            </section>
          </div>

          <section className="data-readiness" id="data-readiness"><div className="readiness-icon"><Icon name="shield" size={19} /></div><div><p className="section-kicker">BUILT AROUND YOUR DATA</p><h2>Start with a trustworthy picture.</h2><p>The participant brief describes the workbook format and business rules. Connect the actual workbook or CSV dataset to calculate store and salesperson performance. Example values in the brief are synthetic and are not used as findings.</p></div><span className="readiness-tag">DATA REQUIRED</span></section>
          <footer className="page-footer"><span>STORE COACH <i>·</i> RETAIL PERFORMANCE INTELLIGENCE</span><span>Built for thoughtful growth <b>✳</b></span></footer>
        </div>
      </section>
    </main>
  );
}
