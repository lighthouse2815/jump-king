import { useEffect, useId, useRef, useState } from 'react';
import { ChatMessage, CHAT_MAX_LENGTH } from '@jump-king/protocol';

export function RoomChat({
  messages,
  error,
  hidden,
  connected,
  onSend,
  onFocus,
}: {
  messages: ChatMessage[];
  error: string;
  hidden: boolean;
  connected: boolean;
  onSend: (text: string) => void;
  onFocus: (focused: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const [recent, setRecent] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [unread, setUnread] = useState(0);
  const panelId = useId();
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;
  const lastReceivedId = useRef(lastId ?? 0);

  useEffect(() => {
    const id = lastId ?? 0;
    const received = id - lastReceivedId.current;
    if (collapsed && received > 0) setUnread((count) => count + received);
    lastReceivedId.current = id;
  }, [lastId, collapsed]);

  useEffect(() => {
    if (lastId === undefined && !error) return;
    setRecent(true);
    const timer = window.setTimeout(() => setRecent(false), 6000);
    return () => window.clearTimeout(timer);
  }, [lastId, error]);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (hidden || !connected) {
      input.current?.blur();
      return;
    }
    const open = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== 'Enter' ||
        target?.closest('input, textarea, button, a, [contenteditable="true"]')
      )
        return;
      event.preventDefault();
      trigger.current?.click();
    };
    document.addEventListener('keydown', open);
    return () => document.removeEventListener('keydown', open);
  }, [hidden, connected]);

  return (
    <section
      className={`room-chat${recent ? ' is-recent' : ''}${unread ? ' has-unread' : ''}`}
      hidden={hidden}
      aria-label="Chat trong phòng"
    >
      <button
        ref={trigger}
        className="room-chat-trigger"
        aria-expanded={!collapsed}
        aria-controls={panelId}
        onClick={(event) => {
          setCollapsed(false);
          setUnread(0);
          event.currentTarget.focus();
          window.requestAnimationFrame(() => input.current?.focus());
        }}
        disabled={!connected}
      >
        {collapsed ? 'Hiện chat · Enter' : 'Chat · Enter'}
        {!!unread && (
          <span
            className="room-chat-unread"
            role="status"
            aria-label={`${unread} tin nhắn mới`}
          />
        )}
      </button>
      <div id={panelId} className="room-chat-panel" hidden={collapsed}>
        <div className="room-chat-actions">
          <button
            type="button"
            onClick={(event) => {
              input.current?.blur();
              setCollapsed(true);
              setUnread(0);
              setRecent(false);
              event.currentTarget.blur();
            }}
          >
            Ẩn chat
          </button>
        </div>
        <div
          className="room-chat-log"
          ref={log}
          role="log"
          aria-label="Tin nhắn trong phòng"
          aria-live="polite"
          tabIndex={0}
        >
          {messages.length ? (
            messages.map((message) => (
              <p key={message.id} style={{ color: message.color }}>
                <strong title={message.sessionId}>{message.nickname}:</strong>{' '}
                {message.text}
              </p>
            ))
          ) : (
            <p className="room-chat-empty">
              Chưa có tin nhắn. Chào mọi người nhé!
            </p>
          )}
        </div>
        {error && (
          <p className="room-chat-error" role="alert">
            {error}
          </p>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const text = draft.trim();
            if (!text || !connected) return;
            onSend(text);
            setDraft('');
            input.current?.focus();
          }}
        >
          <input
            ref={input}
            aria-label="Nhập tin nhắn"
            placeholder="Nhập tin nhắn…"
            value={draft}
            maxLength={CHAT_MAX_LENGTH}
            disabled={!connected}
            autoComplete="off"
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => onFocus(true)}
            onBlur={() => onFocus(false)}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Escape') {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
          <button type="submit" disabled={!connected || !draft.trim()}>
            Gửi
          </button>
        </form>
      </div>
    </section>
  );
}
