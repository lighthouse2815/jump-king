import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { GameConfig } from '../game/Game';
import { NetworkManager } from '../game/networking/NetworkManager';
import { MainScene } from '../game/scenes/MainScene';

export const CommunityPage = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!gameRef.current) {
      // Re-create the game config to ensure we get a fresh instance
      const config = { ...GameConfig, scene: [MainScene] };
      gameRef.current = new Phaser.Game(config);
    }
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white font-mono">
      <div className="w-full max-w-4xl flex justify-between items-center mb-2 px-4">
        <h2 className="text-2xl font-bold">Community Tower</h2>
        <button onClick={() => navigate('/')} className="bg-gray-700 px-4 py-2 rounded">Back</button>
      </div>
      <div id="phaser-game" className="border-4 border-gray-700 rounded-lg shadow-2xl"></div>
    </div>
  );
};
