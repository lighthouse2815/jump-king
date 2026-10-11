import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CAMPAIGNS, CampaignId } from '@jump-king/maps';
import { readSave, saveKey } from '../game/soloSave';
import { originalUrl } from '../game/originalAssets';
import { multiplayerEnabled } from '../game/networking/NetworkManager';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<CampaignId>('original');
  const save = readSave(campaign);
  const start = () => {
    if (
      save &&
      !window.confirm(
        'Bắt đầu game mới? Tiến trình đã lưu của hành trình này sẽ được thay thế.'
      )
    )
      return;
    localStorage.removeItem(saveKey(campaign));
    navigate(`/play?campaign=${campaign}&new=1`);
  };
  return (
    <main className="title-page">
      <div className="title-scene" aria-hidden="true" />
      <div className="title-content">
        <span className="eyebrow">A TACTICAL LEAP OF FAITH</span>
        <img
          className="title-logo"
          src={originalUrl('title_logo.png')}
          alt="Jump King"
          width="392"
          height="111"
        />
        <p className="title-subtitle">
          There is a smoking hot babe at the top!
        </p>
        <div className="campaign-selector" aria-label="Chọn hành trình">
          {(Object.keys(CAMPAIGNS) as CampaignId[]).map((id) => (
            <button
              key={id}
              className={id === campaign ? 'selected' : ''}
              onClick={() => setCampaign(id)}
              aria-pressed={id === campaign}
            >
              {CAMPAIGNS[id].name}
            </button>
          ))}
        </div>
        <nav className="title-menu" aria-label="Menu chính">
          {save && (
            <button
              className="menu-button primary"
              onClick={() => navigate(`/play?campaign=${campaign}`)}
            >
              Tiếp tục
              <span>
                Màn {save.state.screen + 1} · {save.state.jumps} lần nhảy
              </span>
            </button>
          )}
          <button
            className={`menu-button ${save ? '' : 'primary'}`}
            onClick={start}
          >
            Game mới<span>Chơi ngay trong trình duyệt</span>
          </button>
          {multiplayerEnabled ? (
            <div className="online-options">
              <Link to="/community">Community Tower ↗</Link>
              <Link to="/race">Race Arena ↗</Link>
            </div>
          ) : (
            <p className="quiet-text">Bản chơi đơn · Multiplayer sẽ mở sau</p>
          )}
        </nav>
        <p className="title-controls">
          <kbd>←</kbd> <kbd>→</kbd> di chuyển <span>·</span> <kbd>SPACE</kbd>{' '}
          giữ và thả để nhảy
        </p>
        <p className="title-footnote">
          Bản web từ dữ liệu Jump King 1.04 · Hỗ trợ bàn phím, tay cầm và cảm
          ứng
        </p>
      </div>
    </main>
  );
};
