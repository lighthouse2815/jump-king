import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Phaser from 'phaser';
import { GameConfig } from '../game/Game';
import { RaceScene } from '../game/scenes/RaceScene';

export const RaceGamePage = () => {
  const { roomId } = useParams<{roomId: string}>();
  const navigate = useNavigate();
  const gameRef = useRef<Phaser.Game | null>(null);
  
  // Expose a way for the Phaser scene to update React UI
  const [uiState, setUiState] = useState<any>({ status: 'CONNECTING' });

  useEffect(() => {
    if (!gameRef.current && roomId) {
      const config = { ...GameConfig, scene: [RaceScene] };
      gameRef.current = new Phaser.Game(config);
      
      // Pass the roomId to the scene
      gameRef.current.events.once('ready', () => {
        const scene = gameRef.current?.scene.getScene('RaceScene') as RaceScene;
        if (scene) {
          scene.setRoomId(roomId, setUiState);
        }
      });
    }
    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [roomId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white font-mono">
      <div className="w-full max-w-4xl flex justify-between items-center mb-2 px-4">
        <div>
          <h2 className="text-xl font-bold text-red-400">Race Arena</h2>
          <p className="text-sm text-gray-400">Room: {roomId}</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-yellow-400">{uiState.status}</p>
          {uiState.status === 'WAITING' && (
             <button 
                onClick={() => {
                   const scene = gameRef.current?.scene.getScene('RaceScene') as RaceScene;
                   scene?.toggleReady();
                }}
                className="mt-2 px-4 py-1 bg-green-600 rounded"
             >
                {uiState.isReady ? 'Unready' : 'Ready Up'}
             </button>
          )}
          {uiState.status === 'COUNTDOWN' && (
             <p className="text-3xl text-red-500">{uiState.countdown}</p>
          )}
        </div>
        <button onClick={() => navigate('/race')} className="bg-gray-700 px-4 py-2 rounded">Leave</button>
      </div>
      <div id="phaser-game" className="border-4 border-red-900 rounded-lg shadow-2xl"></div>
    </div>
  );
};
