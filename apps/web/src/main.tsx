import React, { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import Phaser from 'phaser';
import { GameConfig } from './game/Game';
import './index.css';

const App = () => {
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = new Phaser.Game(GameConfig);
    }
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4 font-mono">JUMP KING ONLINE</h1>
      <div id="phaser-game" className="border-4 border-gray-700 rounded-lg overflow-hidden shadow-2xl"></div>
      <p className="mt-4 text-gray-400">Controls: A/D or Left/Right to move. Hold Space to jump.</p>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
