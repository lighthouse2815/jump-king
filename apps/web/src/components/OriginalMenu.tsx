import { useEffect, useRef } from 'react';
import { originalUrl } from '../game/originalAssets';

export interface MenuItem {
  label: string;
  action: () => void;
  green?: boolean;
  back?: boolean;
}

export function OriginalMenu({
  label,
  items,
  content,
  depth,
  active,
  onBack,
  onSelect,
}: {
  label: string;
  items: MenuItem[];
  content?: React.ReactNode;
  depth: number;
  active: boolean;
  onBack: () => void;
  onSelect: () => void;
}) {
  const menu = useRef<HTMLElement>(null);
  const selected = useRef('');
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    if (!active) return;
    const buttons = () =>
      Array.from(
        menu.current?.querySelectorAll<HTMLButtonElement>('button') || [],
      );
    const previous = buttons().find(
      (button) => button.textContent?.trim() === selected.current,
    );
    (previous || buttons()[0])?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      const choices = buttons();
      const index = choices.indexOf(
        document.activeElement as HTMLButtonElement,
      );
      if (
        ['ArrowDown', 'ArrowUp', 'w', 's', 'Home', 'End'].includes(
          event.key,
        )
      ) {
        event.preventDefault();
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? choices.length - 1
              : (Math.max(index, 0) +
                  (['ArrowUp', 'w'].includes(event.key) ? -1 : 1) +
                  choices.length) %
                choices.length;
        choices[next]?.focus({ preventScroll: true });
      } else if (event.key === 'Escape' || event.key === 'ArrowLeft') {
        event.preventDefault();
        back.current();
      } else if (event.key === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) choices[Math.max(index, 0)]?.click();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [active, label]);
  return (
    <nav
      ref={menu}
      className={`original-menu original-frame ${active ? 'active' : 'inactive'}`}
      style={{ left: 16 + depth * 60 }}
      aria-label={label}
    >
      {content && <div className="title-details">{content}</div>}
      {items.map((item, index) => (
        <button
          key={index}
          disabled={!active}
          className={item.green ? 'babe-option' : ''}
          onFocus={() => {
            selected.current = item.label;
            onSelect();
          }}
          onPointerEnter={(event) =>
            active && event.currentTarget.focus({ preventScroll: true })
          }
          onClick={item.action}
        >
          {item.back && <img src={originalUrl('gui/back.png')} alt="" />}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

