// Page title (+ optional subtitle and actions). Every page starts with this (§2 Layout).
import { useEffect } from 'react';

export default function PageHeader({ title, subtitle, actions }) {
  useEffect(() => {
    document.title = `${title} · OEMS`;
  }, [title]);
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions no-print">{actions}</div>}
    </header>
  );
}
