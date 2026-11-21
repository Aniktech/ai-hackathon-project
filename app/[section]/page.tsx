import Link from "next/link";
import { notFound } from "next/navigation";
import { moduleBySlug, modules } from "@/lib/navigation";
import { Icon } from "@/components/icon";

export function generateStaticParams() {
  return modules.map(({ slug }) => ({ section: slug }));
}

export default async function ModulePage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const pageModule = moduleBySlug.get(section);

  if (!pageModule) notFound();

  return (
    <div className="page-content module-page">
      <div className="eyebrow"><span className="eyebrow-line" /> VEDANT FASHIONS LIMITED <span className="eyebrow-separator">·</span> STORE COACH</div>
      <div className="page-heading">
        <div>
          <p className="greeting">WORKSPACE MODULE</p>
          <h1>{pageModule.label}</h1>
          <p className="page-subtitle">{pageModule.description}</p>
        </div>
        <div className="data-state"><span className="state-dot" /><span><strong>Awaiting source workbook</strong><small>No metrics are shown until source data is validated</small></span></div>
      </div>

      <section className="module-empty panel">
        <span className="empty-icon"><Icon name={pageModule.icon} size={21} /></span>
        <p className="section-kicker">DATA REQUIRED</p>
        <h2>This view is ready for validated data.</h2>
        <p>{pageModule.detail}</p>
        <Link className="text-link" href="/data-quality">Review data quality requirements <Icon name="arrow" size={15} /></Link>
      </section>

      <section className="data-readiness module-readiness">
        <div className="readiness-icon"><Icon name="shield" size={19} /></div>
        <div>
          <p className="section-kicker">SOURCE WORKBOOK NOT CONNECTED</p>
          <h2>Keep decisions tied to the real source data.</h2>
          <p>The participant brief explains the workbook structure, but it is not the workbook itself. This page will populate after the source file is available and its columns are validated.</p>
        </div>
        <span className="readiness-tag">NO FINDINGS YET</span>
      </section>
    </div>
  );
}
