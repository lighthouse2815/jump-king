import { useEffect, useRef, useState } from 'react';

export function OnlineCheat({
  enabled,
  connected,
  error,
  onSend,
  onFocus,
  onClose,
}: {
  enabled: boolean;
  connected: boolean;
  error: string;
  onSend: (code: string) => void;
  onFocus: (focused: boolean) => void;
  onClose: () => void;
}) {
  const [code, setCode] = useState('');
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    return () => onFocus(false);
  }, [onFocus]);

  return (
    <form
      ref={form}
      className="online-cheat"
      aria-label="Cheat trong phòng online"
      onFocus={() => onFocus(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onFocus(false);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (!connected || !code.trim()) return;
        onSend(code);
        setCode('');
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && form.current?.contains(focused))
          focused.blur();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <label htmlFor="online-cheat-code">Mã cheat online</label>
      <div className="online-cheat-entry">
        <input
          id="online-cheat-code"
          type="password"
          placeholder="Nhập mã"
          value={code}
          maxLength={32}
          autoComplete="off"
          spellCheck={false}
          disabled={!connected}
          onChange={(event) => setCode(event.target.value)}
        />
        <button type="submit" disabled={!connected || !code.trim()}>
          Áp dụng
        </button>
      </div>
      <p role="status">
        {enabled
          ? 'Đang bay · WASD / ↑↓←→ · Nhập lại mã để tắt'
          : 'Nhập mã để kích hoạt.'}
      </p>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
