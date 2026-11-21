"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "@/components/icon";
import { modules } from "@/lib/navigation";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Store Coach home">
          <span className="brand-mark"><span /></span>
          <span className="brand-copy"><strong>Store Coach</strong><small>RETAIL INTELLIGENCE</small></span>
        </Link>

        <div className="workspace-switcher">
          <span className="workspace-avatar">V</span>
          <span className="workspace-text"><strong>Vedant Fashions</strong><small>AI Hackathon 2026</small></span>
          <span className="chevron">⌄</span>
        </div>

        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="Main navigation" className="main-nav">
          <Link
            href="/"
            className={`nav-item${pathname === "/" ? " active" : ""}`}
            aria-current={pathname === "/" ? "page" : undefined}
            title="Executive Overview"
          >
            <Icon name="overview" size={17} />
            <span>Executive Overview</span>
            {pathname === "/" && <span className="active-dot" />}
          </Link>
          {modules.map((item) => {
            const href = `/${item.slug}`;
            const active = pathname === href;

            return (
              <Link
                key={item.slug}
                href={href}
                className={`nav-item${active ? " active" : " muted"}`}
                aria-current={active ? "page" : undefined}
                title={item.label}
              >
                <Icon name={item.icon} size={17} />
                <span>{item.label}</span>
                {active && <span className="active-dot" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="season-note"><span className="season-kicker">A BETTER EVERYDAY</span><p>Clear priorities for every store, every morning.</p><span className="season-flower">✳</span></div>
          <div className="profile-row"><span className="profile-avatar">AM</span><span className="profile-copy"><strong>Area Manager</strong><small>Workspace preview</small></span><span className="more">···</span></div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{pathname === "/" ? "Executive Overview" : modules.find((item) => `/${item.slug}` === pathname)?.label ?? "Workspace"}</strong></div>
          <div className="top-actions"><span className="date-label"><Icon name="calendar" size={15} /> Reporting period pending</span><span className="top-avatar">AM</span></div>
        </header>
        {children}
      </section>
    </main>
  );
}
