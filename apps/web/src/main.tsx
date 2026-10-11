import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LandingPage } from './pages/LandingPage';
import { CommunityPage } from './pages/CommunityPage';
import { RaceLobbyPage } from './pages/RaceLobbyPage';
import { RaceGamePage } from './pages/RaceGamePage';
import { OriginalGamePage } from './pages/OriginalGamePage';
import { MultiplayerUnavailablePage } from './pages/MultiplayerUnavailablePage';
import { multiplayerEnabled } from './game/networking/NetworkManager';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/play" element={<OriginalGamePage />} />
        <Route
          path="/community"
          element={
            multiplayerEnabled ? (
              <CommunityPage />
            ) : (
              <MultiplayerUnavailablePage />
            )
          }
        />
        <Route
          path="/race"
          element={
            multiplayerEnabled ? (
              <RaceLobbyPage />
            ) : (
              <MultiplayerUnavailablePage />
            )
          }
        />
        <Route
          path="/race/:roomId"
          element={
            multiplayerEnabled ? (
              <RaceGamePage />
            ) : (
              <MultiplayerUnavailablePage />
            )
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
