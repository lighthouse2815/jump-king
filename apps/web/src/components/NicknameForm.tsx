import { useState } from 'react';
import { Link } from 'react-router-dom';
import { NICKNAME_MAX_LENGTH } from '@jump-king/protocol';
import { readStoredValue, writeStoredValue } from '../game/utils/browserStorage';

export function NicknameForm({
  onConfirm,
}: {
  onConfirm: (nickname: string) => void;
}) {
  const [nickname, setNickname] = useState(
    () => readStoredValue('jumpking.nickname') || '',
  );
  const name = nickname.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white font-mono p-4">
      <form
        className="w-full max-w-sm flex flex-col gap-4 border border-gray-600 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name) return;
          const value = name.slice(0, NICKNAME_MAX_LENGTH);
          writeStoredValue('jumpking.nickname', value);
          onConfirm(value);
        }}
      >
        <h1 className="text-xl">Đặt biệt danh</h1>
        <p className="text-sm text-gray-400">
          Tên này sẽ hiển thị trong phòng và chat.
        </p>
        <label htmlFor="online-nickname">Biệt danh</label>
        <input
          id="online-nickname"
          className="bg-gray-900 border border-gray-600 px-3 py-2"
          value={nickname}
          maxLength={NICKNAME_MAX_LENGTH}
          onChange={(event) => setNickname(event.target.value)}
          autoComplete="nickname"
          autoFocus
          required
        />
        <button className="menu-button primary" type="submit" disabled={!name}>
          Vào phòng
        </button>
        <Link className="text-sm text-gray-400 underline text-center" to="/">
          Về menu
        </Link>
      </form>
    </main>
  );
}
