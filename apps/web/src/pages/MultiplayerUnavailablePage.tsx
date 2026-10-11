import { Link } from 'react-router-dom';

export function MultiplayerUnavailablePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-900 p-6 text-center text-white">
      <h1 className="text-3xl font-bold">Multiplayer chưa mở</h1>
      <p>Bản web hiện hỗ trợ chơi đơn. Phòng cộng đồng và đua sẽ mở sau.</p>
      <Link className="menu-button primary" to="/play">
        Chơi đơn ngay
      </Link>
      <Link to="/">Về menu</Link>
    </main>
  );
}
