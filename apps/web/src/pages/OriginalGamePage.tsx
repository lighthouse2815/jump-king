import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Phaser from 'phaser';
import { CAMPAIGNS, CampaignId } from '@jump-king/maps';
import { OriginalScene, OriginalUi } from '../game/scenes/OriginalScene';

const initialUi: OriginalUi = {
  status: 'LOADING',
  location: '',
  screen: 1,
  best: 1,
  seconds: 0,
  jumps: 0,
  falls: 0,
  charge: 0,
  x: 231,
  y: 302,
  paused: false,
  progress: 0,
  players: 1,
};
const clock = (seconds: number) =>
  `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, '0')}:${Math.floor((seconds / 60) % 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;

export function OriginalGamePage({
  mode = 'solo',
  roomId,
}: {
  mode?: 'solo' | 'community' | 'race';
  roomId?: string;
}) {
  const [params] = useSearchParams();
  const id = params.get('campaign') || 'original';
  const campaign: CampaignId = Object.prototype.hasOwnProperty.call(
    CAMPAIGNS,
    id,
  )
    ? (id as CampaignId)
    : 'original';
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<OriginalScene | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [ui, setUi] = useState(initialUi);
  const [generation, setGeneration] = useState(0);
  const fresh = useRef(false);
  const [muted, setMuted] = useState(
    () => localStorage.getItem('jumpking.muted') === 'true',
  );
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!mount.current) return;
    let active = true;
    setUi(initialUi);
    const instance = new OriginalScene({
      campaign,
      fresh: fresh.current,
      muted,
      mode,
      roomId,
      intro: params.get('new') === '1',
      onUi: (state) => {
        if (active) setUi(state);
      },
    });
    scene.current = instance;
    const phaser = new Phaser.Game({
      type: Phaser.AUTO,
      parent: mount.current,
      width: 480,
      height: 360,
      pixelArt: true,
      roundPixels: true,
      backgroundColor: '#101511',
      scene: [instance],
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { activePointers: 4 },
      audio: { disableWebAudio: false },
    });
    game.current = phaser;
    return () => {
      active = false;
      instance.persist();
      phaser.destroy(true);
      game.current = null;
      scene.current = null;
    };
    // Sound preferences are applied independently without restarting a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign, generation, mode, roomId]);

  useEffect(() => {
    scene.current?.setMuted(muted);
    localStorage.setItem('jumpking.muted', String(muted));
  }, [muted]);
  const restart = () => {
    if (
      window.confirm(
        'Bắt đầu lại màn chơi này từ đầu? Tiến trình hiện tại sẽ được thay thế.',
      )
    ) {
      fresh.current = true;
      setGeneration((value) => value + 1);
    }
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await container.current?.requestFullscreen();
    } catch {
      setNotice('Trình duyệt này không hỗ trợ toàn màn hình.');
    }
  };
  const hold = (control: 'left' | 'right' | 'jump') => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      scene.current?.setControl(control, true);
    },
    onPointerUp: () => scene.current?.setControl(control, false),
    onPointerCancel: () => scene.current?.setControl(control, false),
    onLostPointerCapture: () => scene.current?.setControl(control, false),
  });

  return (
    <main className="game-page" ref={container}>
      <header className="game-header">
        <Link to="/" className="wordmark">
          JUMP KING<span>WEB EDITION</span>
        </Link>
        <span className="campaign-name">
          {mode === 'community'
            ? `Community Tower · ${ui.players} người chơi`
            : mode === 'race'
              ? `Race Arena · ${roomId}`
              : CAMPAIGNS[campaign].name}
        </span>
        <div className="game-actions">
          <button
            onClick={() => setMuted((value) => !value)}
            aria-label={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            title={muted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          >
            {muted ? 'Âm thanh: tắt' : 'Âm thanh: bật'}
          </button>
          <button onClick={fullscreen} aria-label="Toàn màn hình">
            ⛶
          </button>
          <button
            onClick={() => scene.current?.setPaused(!ui.paused)}
            disabled={ui.status !== 'PLAYING'}
            aria-label="Tạm dừng"
          >
            Ⅱ
          </button>
        </div>
      </header>
      <section className="play-layout">
        <div className="play-column">
          <div className="location-bar">
            <span>{ui.location || 'ĐANG TẢI'}</span>
            <span>MÀN {ui.screen.toString().padStart(2, '0')}</span>
          </div>
          <div
            className="game-frame"
            data-testid="game-state"
            data-status={ui.status}
            data-x={ui.x}
            data-y={ui.y}
            data-jumps={ui.jumps}
            data-charge={ui.charge}
          >
            <div ref={mount} className="phaser-mount" />
            {ui.status === 'CUTSCENE' && (
              <button
                className="menu-button cutscene-skip"
                disabled={!ui.cutsceneReady}
                onClick={() => scene.current?.skipCutscene()}
              >
                Bỏ qua {ui.cutscene === 'intro' ? 'mở đầu' : 'cắt cảnh'}
              </button>
            )}
            {ui.achievementNotice && (
              <div className="achievement-toast" role="status">
                🏆 {ui.achievementNotice}
              </div>
            )}
            {ui.status === 'LOADING' && (
              <div className="game-overlay">
                <p>Đang tải màn chơi…</p>
                <progress value={ui.progress} max="1" />
              </div>
            )}
            {ui.status === 'ERROR' && (
              <div className="game-overlay" role="alert">
                <h2>Không thể mở game</h2>
                <p>{ui.error}</p>
                <button
                  className="menu-button"
                  onClick={() => setGeneration((value) => value + 1)}
                >
                  Thử lại
                </button>
                <Link to="/">Về menu</Link>
              </div>
            )}
            {ui.paused && (
              <div className="game-overlay pause-overlay">
                <span className="eyebrow">
                  {mode === 'solo'
                    ? 'TIẾN TRÌNH ĐÃ LƯU'
                    : 'PHÒNG CHƠI VẪN TIẾP TỤC'}
                </span>
                <h2>Tạm dừng</h2>
                <button
                  className="menu-button primary"
                  onClick={() => scene.current?.setPaused(false)}
                >
                  Tiếp tục
                </button>
                {mode === 'solo' && (
                  <button className="menu-button" onClick={restart}>
                    Chơi lại từ đầu
                  </button>
                )}
                <Link to="/" className="menu-button">
                  Về menu
                </Link>
              </div>
            )}
            {ui.status === 'COMPLETE' && (
              <div className="game-overlay ending-overlay">
                <span className="eyebrow">YOU REACHED THE BABE!</span>
                <h2>Chinh phục đỉnh tháp</h2>
                <p>
                  {clock(ui.seconds)} · {ui.jumps} lần nhảy · {ui.falls} lần ngã
                </p>
                <Link className="menu-button primary" to="/">
                  Về menu
                </Link>
                <button className="menu-button" onClick={restart}>
                  Chơi lại
                </button>
              </div>
            )}
          </div>
          <div className="under-game">
            <span>Giữ để tích lực. Thả để nhảy.</span>
            <span>Tự nhảy khi đầy lực.</span>
          </div>
          <div className="touch-controls" aria-label="Điều khiển cảm ứng">
            <div>
              <button {...hold('left')} aria-label="Đi sang trái">
                ←
              </button>
              <button {...hold('right')} aria-label="Đi sang phải">
                →
              </button>
            </div>
            <button
              {...hold('jump')}
              className="jump-button"
              aria-label="Giữ để nhảy"
            >
              NHẢY
            </button>
          </div>
        </div>
        <aside className="run-panel">
          <span className="eyebrow">HÀNH TRÌNH CỦA BẠN</span>
          <p className="run-clock" data-testid="run-clock">
            {clock(ui.seconds)}
          </p>
          <dl className="run-stats">
            <div>
              <dt>Lần nhảy</dt>
              <dd>{ui.jumps}</dd>
            </div>
            <div>
              <dt>Lần ngã</dt>
              <dd>{ui.falls}</dd>
            </div>
            <div>
              <dt>Màn cao nhất</dt>
              <dd>{ui.best.toString().padStart(2, '0')}</dd>
            </div>
          </dl>
          <div className="charge-display">
            <span>LỰC NHẢY</span>
            <progress value={ui.charge} max="1" aria-label="Lực nhảy" />
          </div>
          <div className="keyboard-guide">
            <p>
              <kbd>←</kbd> <kbd>→</kbd>
              <span>Di chuyển</span>
            </p>
            <p>
              <kbd>A</kbd> <kbd>D</kbd>
              <span>Di chuyển</span>
            </p>
            <p>
              <kbd>SPACE</kbd>
              <span>Tích lực / nhảy</span>
            </p>
            <p>
              <kbd>ESC</kbd>
              <span>Tạm dừng</span>
            </p>
          </div>
          <p className="quiet-text">
            Không thể đổi hướng trên không. Một lần trượt chân có thể đưa bạn về
            nơi bắt đầu.
          </p>
          <p className="save-note" data-testid="player-count">
            {mode === 'solo'
              ? '● Tự động lưu trong trình duyệt'
              : `● ${ui.players} người trong phòng`}
          </p>
          <details className="inventory-panel" open>
            <summary>Vật phẩm · {ui.inventory?.length || 0}</summary>
            {!ui.inventory?.length && (
              <p className="quiet-text">
                Tìm vật phẩm và gặp thương nhân trong hành trình.
              </p>
            )}
            <ul>
              {ui.inventory?.map(
                ({ item, label, count, wearable, equipped }) => (
                  <li key={item}>
                    <span>
                      {label}
                      {count > 1 ? ` ×${count}` : ''}
                    </span>
                    {wearable && (
                      <button
                        aria-label={`${equipped ? 'Tháo' : 'Mặc'} ${label}`}
                        aria-pressed={equipped}
                        disabled={ui.status !== 'PLAYING'}
                        onClick={() =>
                          scene.current?.setEquipped(item, !equipped)
                        }
                      >
                        {equipped ? 'Tháo' : 'Mặc'}
                      </button>
                    )}
                  </li>
                ),
              )}
            </ul>
          </details>
          <details className="inventory-panel" open>
            <summary>Thành tích · {ui.achievements?.length || 0}/48</summary>
            <p className="quiet-text">Lưu trong trình duyệt.</p>
            <ul>
              {ui.achievements?.map((achievement) => (
                <li key={achievement.id} title={achievement.description}>
                  <span>{achievement.name}</span>
                </li>
              ))}
            </ul>
          </details>
          {mode === 'race' && (
            <div className="race-panel">
              <p data-testid="race-status">{ui.raceStatus || 'CONNECTING'}</p>
              {ui.raceStatus === 'WAITING' && (
                <button
                  className="menu-button primary"
                  onClick={() => scene.current?.toggleReady()}
                >
                  {ui.ready ? 'Unready' : 'Ready Up'}
                </button>
              )}
              {ui.raceStatus === 'COUNTDOWN' && (
                <p className="run-clock">{ui.countdown}</p>
              )}
              <ol>
                {ui.standings?.map((player, index) => (
                  <li key={`${player.nickname}-${index}`}>
                    {player.nickname}{' '}
                    {player.finished ? clock(player.seconds) : '↑'}
                  </li>
                ))}
              </ol>
            </div>
          )}
          {(ui.saveError || notice) && (
            <p role="alert" className="error-note">
              {ui.saveError || notice}
            </p>
          )}
        </aside>
      </section>
      <footer className="game-footer">
        <span>A TACTICAL LEAP OF FAITH</span>
        <Link to="/">Về menu</Link>
      </footer>
    </main>
  );
}
