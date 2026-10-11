import { useEffect, useRef } from 'react';
import { originalUrl } from '../game/originalAssets';

export interface MenuItem {
  label: string;
  action: () => void;
  green?: boolean;
  back?: boolean;
  disabled?: boolean;
  checked?: boolean;
}

export function OriginalMenu({
  label,
  items,
  content,
  depth,
  active,
  onBack,
  onSelect,
  side = 'left',
  top = 176,
  gamepad = false,
}: {
  label: string;
  items: MenuItem[];
  content?: React.ReactNode;
  depth: number;
  active: boolean;
  onBack: () => void;
  onSelect: () => void;
  side?: 'left' | 'right';
  top?: number;
  gamepad?: boolean;
}) {
  const menu = useRef<HTMLElement>(null);
  const selected = useRef('');
  const back = useRef(onBack);
  back.current = onBack;
  useEffect(() => {
    if (!active) return;
    const buttons = () =>
      Array.from(
        menu.current?.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled)',
        ) || [],
      );
    const previous = buttons().find(
      (button) => button.textContent?.trim() === selected.current,
    );
    (previous || buttons()[0])?.focus({ preventScroll: true });
    const keydown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' &&
        (event.target as HTMLElement)?.closest?.(
          'input, textarea, select, form, [contenteditable="true"]',
        )
      )
        return;
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
        choices[next]?.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
        });
      } else if (
        event.key === 'Escape' ||
        event.key === 'ArrowLeft'
      ) {
        event.preventDefault();
        if (!event.repeat) back.current();
      } else if (event.key === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        if (!event.repeat) choices[Math.max(index, 0)]?.click();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [active, label]);
  useEffect(() => {
    if (!active || !gamepad) return;
    let frame = 0;
    let previous = '';
    let primed = false;
    let repeatedAt = 0;
    const poll = (now: number) => {
      const pad = Array.from(navigator.getGamepads?.() || []).find(
        (value) => value?.mapping === 'standard',
      );
      const key = pad?.buttons[0]?.pressed
        ? 'Enter'
        : pad?.buttons[1]?.pressed
          ? 'Escape'
          : pad?.buttons[12]?.pressed || (pad?.axes[1] || 0) < -0.5
            ? 'ArrowUp'
            : pad?.buttons[13]?.pressed || (pad?.axes[1] || 0) > 0.5
              ? 'ArrowDown'
              : '';
      if (!primed) {
        previous = key;
        primed = true;
      } else if (
        key &&
        (key !== previous ||
          (key.startsWith('Arrow') && now - repeatedAt > 250))
      ) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
        repeatedAt = now;
      }
      previous = key;
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [active, gamepad]);
  return (
    <nav
      ref={menu}
      className={`original-menu original-frame ${active ? 'active' : 'inactive'}`}
      style={{ [side]: 16 + depth * 60, top }}
      aria-label={label}
    >
      {content && <div className="title-details">{content}</div>}
      <div className="original-menu-items">
        {items.map((item, index) => (
          <button
            key={index}
            disabled={!active || item.disabled}
            aria-pressed={item.checked}
            className={item.green ? 'babe-option' : ''}
            onFocus={() => {
              selected.current = item.label;
              onSelect();
            }}
            onPointerEnter={(event) =>
              active &&
              event.currentTarget.focus({ preventScroll: true })
            }
            onClick={item.action}
          >
            {item.back && (
              <img src={originalUrl('gui/back.png')} alt="" />
            )}
            {item.checked !== undefined && (
              <span
                className={`original-checkbox ${item.checked ? 'checked' : ''}`}
                aria-hidden="true"
              />
            )}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
