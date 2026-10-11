import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { networkManager } from '../game/networking/NetworkManager';

export const RaceLobbyPage = () => {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [error, setError] = useState('');
  const [connecting, setConnecting] = useState(false);

  const handleCreate = async () => {
    setConnecting(true);
    setError('');
    try {
      const id = await networkManager.createOriginalRaceRoom();
      navigate(`/race/${id}`);
    } catch {
      setError(
        'Không kết nối được server. Hãy kiểm tra server đang chạy rồi thử lại.'
      );
    } finally {
      setConnecting(false);
    }
  };

  const handleJoin = () => {
    if (/^[a-zA-Z0-9_-]+$/.test(roomCode.trim())) {
      navigate(`/race/${roomCode.trim()}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white font-mono">
      <h2 className="text-4xl font-bold mb-8 text-red-400">Race Arena</h2>
      <div className="bg-gray-800 p-8 rounded-xl shadow-lg flex flex-col gap-6 w-96">
        <button
          onClick={handleCreate}
          disabled={connecting}
          className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 rounded font-bold"
        >
          {connecting ? 'Connecting…' : 'Create New Race'}
        </button>
        <div className="text-center text-gray-400">OR</div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room Code"
            className="flex-1 px-3 py-2 bg-gray-700 rounded text-white"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />
          <button
            onClick={handleJoin}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold"
          >
            Join
          </button>
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-4 text-gray-400 hover:text-white underline"
        >
          Back to Menu
        </button>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
    </div>
  );
};
