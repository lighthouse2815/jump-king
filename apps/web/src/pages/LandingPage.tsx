import React from 'react';
import { useNavigate } from 'react-router-dom';

export const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white font-mono">
      <h1 className="text-5xl font-bold mb-8 text-yellow-400">JUMP KING ONLINE</h1>
      <div className="flex gap-4">
        <button 
          onClick={() => navigate('/community')}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-xl font-bold"
        >
          Community Tower
        </button>
        <button 
          onClick={() => navigate('/race')}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-bold"
        >
          Race Arena
        </button>
      </div>
    </div>
  );
};
