import type { MonthlyMetric } from "@/lib/analytics";

export function MonthlyTrend({ data }: { data: MonthlyMetric[] }) {
  if (!data.length) return null;
  const chart = { left: 34, right: 690, top: 15, bottom: 145 };
  const maxRevenue = Math.max(1, ...data.map((item) => item.revenue));
  const maxConversion = Math.max(0.01, ...data.map((item) => item.conversion ?? 0));
  const slot = (chart.right - chart.left) / data.length;
  const points = data.map((item, index) => `${chart.left + slot * (index + 0.5)},${chart.bottom - ((item.conversion ?? 0) / maxConversion) * 100}`).join(" ");
  return <section className="trend-panel" aria-labelledby="trend-title">
    <div className="panel-heading"><div><p className="section-kicker">MONTHLY PERFORMANCE</p><h2 id="trend-title">Revenue and conversion</h2></div><span className="source-note">Latest 12 available months</span></div>
    <div className="trend-legend"><span><i className="legend-revenue" /> Revenue</span><span><i className="legend-conversion" /> Conversion</span></div>
    <div className="trend-scroll"><svg viewBox="0 0 710 190" role="img" aria-label="Monthly revenue bars with conversion trend line">
      {[0, 1, 2, 3].map((line) => <g key={line}><line x1={chart.left} x2={chart.right} y1={chart.top + line * 40} y2={chart.top + line * 40} stroke="#eee8df" strokeDasharray="3 4" /><text x="0" y={chart.top + line * 40 + 3} fill="#a39b91" fontSize="8">{new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 0 }).format(maxRevenue * (3 - line) / 3)}</text></g>)}
      {data.map((item, index) => { const height = item.revenue / maxRevenue * 112; const x = chart.left + index * slot + slot * 0.2; return <g key={item.month}><rect x={x} y={chart.bottom - height} width={slot * 0.58} height={height} rx="3" fill="#ecd4bf"><title>{item.month}: {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(item.revenue)}</title></rect><text x={x + slot * 0.29} y="165" textAnchor="middle" fill="#8a8379" fontSize="8">{item.month.split(" ")[0]}</text></g>; })}
      <polyline points={points} fill="none" stroke="#668a77" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((item, index) => <circle key={`${item.month}-point`} cx={chart.left + slot * (index + 0.5)} cy={chart.bottom - ((item.conversion ?? 0) / maxConversion) * 100} r="3" fill="#668a77"><title>{item.month}: {item.conversion === null ? "No conversion data" : `${(item.conversion * 100).toFixed(1)}% conversion`}</title></circle>)}
    </svg></div>
  </section>;
}
