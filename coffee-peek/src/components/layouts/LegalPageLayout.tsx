import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { brand, getThemeColors } from '../../design-system';
import { LEGAL } from '../../constants/legal';
import { goBackOrHome } from '../../constants/legalRoutes';
import { usePageAnchor } from '../../hooks/usePageAnchor';
import Header from '../Header';
import Button from '../Button';
import { ArrowLeft, CaretDown } from '../Icon';
import './LegalPageLayout.css';

interface LegalPageLayoutProps {
  title: string;
  sections: readonly { id: string; title: string }[];
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, sections, children }: LegalPageLayoutProps) {
  usePageAnchor();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const colors = getThemeColors(theme);
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const mobileContents = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const updateSection = () => {
      let current = sections[0]?.id;
      const offset = (document.querySelector('.legal-page > header')?.getBoundingClientRect().bottom ?? 64) + 32;
      for (const section of sections) {
        if ((document.getElementById(section.id)?.getBoundingClientRect().top ?? Infinity) <= offset) current = section.id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = sections.at(-1)?.id ?? current;
      setActiveId(current);
    };
    updateSection();
    window.addEventListener('scroll', updateSection, { passive: true });
    window.addEventListener('resize', updateSection);
    return () => {
      window.removeEventListener('scroll', updateSection);
      window.removeEventListener('resize', updateSection);
    };
  }, [sections]);

  const contents = <ol className="legal-toc-list">
    {sections.map(section => <li key={section.id}>
      <a href={`#${section.id}`} aria-current={activeId === section.id ? 'location' : undefined}
        onClick={() => { if (mobileContents.current) mobileContents.current.open = false; }}>
        {section.title}
      </a>
    </li>)}
  </ol>;

  return <div className="legal-page min-h-screen" style={{
    background: colors.background, color: colors.textPrimary,
    '--legal-accent': brand.primary, '--legal-border': colors.border,
    '--legal-muted': colors.textSecondary,
  } as React.CSSProperties}>
    <Header />
    <div className="legal-layout">
      <aside className="legal-sidebar">
        <Button variant="ghost" onClick={() => goBackOrHome(navigate)} className="-ml-4 mb-4 min-h-11">
          <ArrowLeft size={18} />Назад
        </Button>
        <nav aria-label="Разделы документа" className="hidden lg:block">
          <p className="mb-4 text-sm font-semibold">Содержание</p>
          {contents}
        </nav>
        <details ref={mobileContents} className="legal-mobile-contents lg:hidden">
          <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-4 font-semibold">
            Содержание<CaretDown size={20} className="legal-contents-chevron" />
          </summary>
          <nav aria-label="Разделы документа">{contents}</nav>
        </details>
      </aside>
      <main id="main-content" className="legal-document">
        <h1 className="mb-4 break-words text-3xl font-bold leading-tight sm:text-4xl">{title}</h1>
        <p className="mb-8 text-sm" style={{ color: colors.textSecondary }}>
          <strong>Дата последнего обновления:</strong> {LEGAL.updatedAt}
        </p>
        {children}
        <Button variant="secondary" onClick={() => goBackOrHome(navigate)} className="mt-12 min-h-11">
          <ArrowLeft size={18} />Вернуться назад
        </Button>
      </main>
    </div>
  </div>;
}
