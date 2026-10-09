import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CommunityPage } from './pages/CommunityPage';
import { RaceLobbyPage } from './pages/RaceLobbyPage';
import { RaceGamePage } from './pages/RaceGamePage';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/race" element={<RaceLobbyPage />} />
        <Route path="/race/:roomId" element={<RaceGamePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
