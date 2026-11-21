import { Icon } from "@/components/icon";

const levers = [
  { title: "More bills", detail: "Turn more visits into purchases", icon: "stores" as const },
  { title: "Bigger baskets", detail: "Build relevant product pairings", icon: "stock" as const },
  { title: "More repeat", detail: "Bring customers back after 30+ days", icon: "repeat" as const },
];

export default function Home() {
  return (
    <div className="page-content" id="top">
      <div className="eyebrow"><span className="eyebrow-line" /> VEDANT FASHIONS LIMITED <span className="eyebrow-separator">·</span> AI HACKATHON 2026</div>
      <div className="page-heading">
        <div>
          <p className="greeting">EXECUTIVE OVERVIEW <span className="eyebrow-separator">·</span> DATA PREVIEW</p>
          <h1>Your stores, <em>in focus.</em></h1>
          <p className="page-subtitle">A clearer view of what needs attention and what your teams can do today.</p>
        </div>
        <div className="data-state"><span className="state-dot" /><span><strong>Awaiting source workbook</strong><small>Metrics stay blank until validated data is connected</small></span></div>
      </div>

      <section className="intro-card" aria-labelledby="intro-title">
        <div className="intro-copy">
          <span className="intro-label">THE DAILY BRIEF</span>
          <h2 id="intro-title">More bills. Bigger baskets.<br /><em>More repeat.</em></h2>
          <p>Store Coach helps area managers spot the reason behind performance shifts and gives every salesperson one practical action to take today.</p>
          <a className="text-link" href="#data-readiness">How Store Coach works <Icon name="arrow" size={15} /></a>
        </div>
        <div className="intro-art" aria-hidden="true">
          <div className="art-sun" /><div className="art-arch arch-one" /><div className="art-arch arch-two" /><div className="art-arch arch-three" /><div className="art-ground" /><span className="art-stitch stitch-one" /><span className="art-stitch stitch-two" />
        </div>
      </section>

      <div className="section-heading">
        <div><p className="section-kicker">THE THREE LEVERS</p><h2>Performance at a glance</h2></div>
        <span className="source-note">Verified metrics will appear here after data validation</span>
      </div>
      <section className="metric-grid" aria-label="Performance metrics">
        {levers.map((lever, i) => (
          <article className="metric-card" key={lever.title}>
            <div className={`metric-icon metric-icon-${i}`}><Icon name={lever.icon} size={18} /></div>
            <span className="metric-label">{lever.title}</span>
            <strong className="metric-value">—</strong>
            <span className="metric-detail">{lever.detail}</span>
            <span className="metric-footnote">No source data connected</span>
          </article>
        ))}
      </section>

      <div className="lower-grid">
        <section className="panel priority-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">AREA MANAGER DASHBOARD</p><h2>Priority stores</h2></div>
            <span className="limit-badge">UP TO 5 / WEEK</span>
          </div>
          <div className="empty-state">
            <span className="empty-icon"><Icon name="stores" size={20} /></span>
            <strong>Your weekly priorities will appear here</strong>
            <p>Issues will be ranked by rupees at stake and compared with relevant store peers.</p>
            <span className="empty-meta"><span className="tiny-dot" /> Waiting for validated store data</span>
          </div>
        </section>
        <section className="panel action-panel">
          <div className="panel-heading">
            <div><p className="section-kicker">SALES FLOOR</p><h2>Today’s actions</h2></div>
            <span className="today-mark">TODAY</span>
          </div>
          <div className="action-empty">
            <div className="action-illustration"><span className="action-spark">✳</span><span className="action-line line-a" /><span className="action-line line-b" /><span className="action-line line-c" /></div>
            <strong>Useful coaching starts with real context</strong>
            <p>Recommendations will name the person, behaviour and next step, using verified store and peer performance.</p>
          </div>
        </section>
      </div>

      <section className="data-readiness" id="data-readiness">
        <div className="readiness-icon"><Icon name="shield" size={19} /></div>
        <div>
          <p className="section-kicker">BUILT AROUND YOUR DATA</p>
          <h2>Start with a trustworthy picture.</h2>
          <p>The participant brief describes the workbook format and business rules. Connect the actual workbook or CSV dataset to calculate store and salesperson performance. Example values in the brief are synthetic and are not used as findings.</p>
        </div>
        <span className="readiness-tag">DATA REQUIRED</span>
      </section>
      <footer className="page-footer"><span>STORE COACH <i>·</i> RETAIL PERFORMANCE INTELLIGENCE</span><span>Built for thoughtful growth <b>✳</b></span></footer>
    </div>
  );
}
