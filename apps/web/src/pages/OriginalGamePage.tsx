import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Phaser from 'phaser';
import { OriginalMenu, MenuItem } from '../components/OriginalMenu';
import { CAMPAIGNS, CampaignId } from '@jump-king/maps';
import {
  OriginalScene,
  OriginalUi,
  AutoplayResult,
} from '../game/scenes/OriginalScene';

type PausePanel =
  | 'pause'
  | 'inventory'
  | 'item'
  | 'options'
  | 'graphics'
  | 'audio'
  | 'controls'
  | 'achievements'
  | 'exit'
  | 'restart';
const panelLabels: Record<PausePanel, string> = {
  pause: 'Pause menu',
  inventory: 'Inventory',
  item: 'Item',
  options: 'Options',
  graphics: 'Graphics',
  audio: 'Audio',
  controls: 'Controls',
  achievements: 'Achievements',
  exit: 'Save and exit',
  restart: 'Give Up',
};

const autoplayCampaigns: CampaignId[] = ['original', 'nbp', 'ghost'];

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
  const navigate = useNavigate();
  const id = params.get('campaign') || 'original';
  const campaign: CampaignId = Object.prototype.hasOwnProperty.call(
    CAMPAIGNS,
    id,
  )
    ? (id as CampaignId)
    : 'original';
  const game = useRef<Phaser.Game | null>(null);
  const scene = useRef<OriginalScene | null>(null);
  const retryRoom = useRef<{
    id: string;
    campaign: CampaignId;
  } | null>(null);
  const mount = useRef<HTMLDivElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [ui, setUi] = useState(initialUi);
  const [generation, setGeneration] = useState(0);
  const fresh = useRef(false);
  const [muted, setMuted] = useState(
    () => localStorage.getItem('jumpking.muted') === 'true',
  );
  const [notice, setNotice] = useState('');
  const [menus, setMenus] = useState<PausePanel[]>(['pause']);
  const [selectedItem, setSelectedItem] = useState('');
  const [developerOpen, setDeveloperOpen] = useState(false);
  const [showTimer, setShowTimer] = useState(
    () => localStorage.getItem('jumpking.timer') === 'true',
  );
  const [cheat, setCheat] = useState('');
  const [cheatError, setCheatError] = useState('');
  const [autoplayIndex, setAutoplayIndex] = useState<number | null>(
    null,
  );
  const [autoplaySpeed, setAutoplaySpeed] = useState(8);
  const speed = useRef(autoplaySpeed);
  const [results, setResults] = useState<AutoplayResult[]>([]);
  const autoplay = mode === 'solo' && autoplayIndex !== null;
  const activeCampaign = autoplay
    ? autoplayCampaigns[autoplayIndex ?? 0]
    : campaign;

  useEffect(() => {
    if (!mount.current) return;
    let active = true;
    setUi(initialUi);
    const instance = new OriginalScene({
      campaign: activeCampaign,
      fresh: autoplay || fresh.current,
      muted,
      mode,
      roomId:
        roomId ||
        (mode === 'community' &&
        retryRoom.current?.campaign === activeCampaign
          ? retryRoom.current.id
          : undefined),
      intro: params.get('new') === '1',
      autoplay,
      autoplaySpeed: speed.current,
      onAutoplayComplete: (result) => {
        if (active)
          setResults((previous) => [
            ...previous.filter(
              (entry) => entry.campaign !== result.campaign,
            ),
            result,
          ]);
      },
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
      backgroundColor: '#000000',
      scene: [instance],
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      input: { activePointers: 4 },
      audio: { disableWebAudio: false },
    });
    game.current = phaser;
    return () => {
      active = false;
      instance.disposeScene();
      phaser.destroy(true);
      game.current = null;
      scene.current = null;
    };
    // Sound preferences are applied independently without restarting a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCampaign, autoplay, generation, mode, roomId]);

  useEffect(() => {
    speed.current = autoplaySpeed;
    scene.current?.setAutoplaySpeed(autoplaySpeed);
  }, [autoplaySpeed]);

  useEffect(() => {
    if (
      !autoplay ||
      ui.status !== 'COMPLETE' ||
      autoplayIndex === autoplayCampaigns.length - 1
    )
      return;
    const timer = window.setTimeout(
      () =>
        setAutoplayIndex((index) =>
          index === null ? null : index + 1,
        ),
      2500,
    );
    return () => window.clearTimeout(timer);
  }, [autoplay, autoplayIndex, ui.status]);

  const activateCheat = (event: React.FormEvent) => {
    event.preventDefault();
    if (cheat.trim().toUpperCase() !== 'AUTOKING') {
      setCheatError('Mã cheat không đúng.');
      return;
    }
    scene.current?.persist();
    fresh.current = false;
    setCheatError('');
    setResults([]);
    setAutoplayIndex(0);
    setMenus(['pause']);
    setDeveloperOpen(false);
  };
  const stopAutoplay = () => {
    fresh.current = false;
    setAutoplayIndex(null);
    setMenus(['pause']);
    setDeveloperOpen(false);
  };

  useEffect(() => {
    scene.current?.setMuted(muted);
    localStorage.setItem('jumpking.muted', String(muted));
  }, [muted]);
  const resume = () => {
    setMenus(['pause']);
    setDeveloperOpen(false);
    scene.current?.setPaused(false);
  };
  const restart = () => {
    fresh.current = true;
    setMenus(['pause']);
    setDeveloperOpen(false);
    setGeneration((value) => value + 1);
  };
  const exit = () => {
    scene.current?.persist();
    if (!autoplay)
      localStorage.setItem('jumpking.campaign', campaign);
    navigate('/');
  };
  const open = (panel: PausePanel) => {
    scene.current?.playSound('audio/gui_sfx/SelectC');
    setMenus((previous) => [...previous, panel]);
  };
  const back = () =>
    menus.length > 1
      ? setMenus((previous) => previous.slice(0, -1))
      : resume();
  useEffect(() => {
    if (!ui.paused) {
      setMenus(['pause']);
      setDeveloperOpen(false);
    }
  }, [ui.paused]);
  useEffect(() => {
    localStorage.setItem('jumpking.timer', String(showTimer));
  }, [showTimer]);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (overlay.current)
        overlay.current.style.transform = `scale(${entry.contentRect.width / 480})`;
    });
    if (frame.current) observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
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
    onLostPointerCapture: () =>
      scene.current?.setControl(control, false),
  });

  const item = ui.inventory?.find(
    (entry) => entry.item === selectedItem,
  );
  const activeMenu = menus[menus.length - 1];
  const menuVisible =
    ui.paused ||
    (ui.status === 'COMPLETE' && activeMenu === 'restart');
  const menuItems: Partial<Record<PausePanel, MenuItem[]>> = {
    pause: [
      { label: 'Resume', action: resume },
      {
        label: 'Inventory',
        action: () => open('inventory'),
        disabled: !ui.inventory?.length,
      },
      { label: 'Options', action: () => open('options') },
      {
        label: mode === 'solo' ? 'Save & Exit' : 'Leave Room',
        action: () => open('exit'),
      },
      ...(mode === 'solo' && !autoplay
        ? [{ label: 'Give Up', action: () => open('restart') }]
        : []),
    ],
    inventory: (ui.inventory || []).map((entry) => ({
      label: `${entry.label}${entry.count > 1 ? ` ×${entry.count}` : ''}`,
      checked: entry.wearable ? entry.equipped : undefined,
      action: () => {
        setSelectedItem(entry.item);
        open('item');
      },
    })),
    item: item?.wearable
      ? [
          {
            label: 'Equip',
            checked: item.equipped,
            disabled: autoplay || ui.status !== 'PLAYING',
            action: () =>
              scene.current?.setEquipped(item.item, !item.equipped),
          },
        ]
      : [],
    options: [
      { label: 'Graphics', action: () => open('graphics') },
      { label: 'Controls', action: () => open('controls') },
      { label: 'Audio', action: () => open('audio') },
      { label: 'Achievements', action: () => open('achievements') },
      ...(mode === 'solo'
        ? [
            {
              label: 'Developer',
              action: () => {
                setDeveloperOpen(true);
                setMenus(['pause']);
              },
            },
          ]
        : []),
    ],
    graphics: [
      {
        label: 'Fullscreen',
        action: () => {
          void fullscreen();
        },
      },
      {
        label: 'Display Timer',
        checked: showTimer,
        action: () => setShowTimer((value) => !value),
      },
    ],
    audio: [
      {
        label: 'Sound',
        checked: !muted,
        action: () => setMuted((value) => !value),
      },
    ],
    exit: [
      { label: 'No', action: back },
      { label: 'Yes', action: exit },
    ],
    restart: [
      { label: 'No', action: back },
      { label: 'Delete Save', action: restart },
    ],
  };
  const details: Partial<Record<PausePanel, React.ReactNode>> = {
    item: (
      <p>
        {item?.label} · {item?.count}
      </p>
    ),
    controls: (
      <>
        <p>Move: ← → / A D</p>
        <p>Jump: hold / release SPACE</p>
        <p>Pause: ESC / Start</p>
        <p>Gamepad: D-pad / A</p>
        <p>Touch: buttons below game</p>
      </>
    ),
    achievements: (
      <div className="pause-achievements">
        <p>Achievements: {ui.achievements?.length || 0} / 48</p>
        {!ui.achievements?.length && <p>No achievements yet.</p>}
        {ui.achievements?.map((achievement) => (
          <p key={achievement.id} title={achievement.description}>
            {achievement.name}
          </p>
        ))}
      </div>
    ),
    exit: (
      <p>{mode === 'solo' ? 'Save and exit?' : 'Leave this room?'}</p>
    ),
    restart: <p>Delete this run and start again?</p>,
  };

  return (
    <main className="original-play-page" ref={container}>
      <div className="original-play-layout">
        <div
          className="game-frame"
          ref={frame}
          data-testid="game-state"
          data-status={ui.status}
          data-room-id={ui.roomId}
          data-x={ui.x}
          data-y={ui.y}
          data-jumps={ui.jumps}
          data-charge={ui.charge}
          data-screen={ui.screen}
          data-location={ui.location}
          data-paused={ui.paused}
          data-autoplay={autoplay}
          data-replay-progress={ui.autoplay?.progress}
        >
          <div ref={mount} className="phaser-mount" />
          <div ref={overlay} className="game-ui">
            {ui.status === 'CUTSCENE' && (
              <button
                className="original-ui-button cutscene-skip"
                disabled={!ui.cutsceneReady}
                onClick={() => scene.current?.skipCutscene()}
              >
                Bỏ qua{' '}
                {ui.cutscene === 'intro' ? 'mở đầu' : 'cắt cảnh'}
              </button>
            )}
            <p
              key={ui.location}
              className="location-caption"
              hidden={ui.paused || ui.status !== 'PLAYING'}
              style={{
                animationPlayState: ui.paused ? 'paused' : 'running',
              }}
            >
              {ui.location}
            </p>
            {showTimer && !ui.paused && (
              <p className="original-timer" data-testid="run-clock">
                {clock(ui.seconds)}
              </p>
            )}
            {ui.achievementNotice && (
              <div
                className="achievement-toast original-frame"
                role="status"
              >
                {ui.achievementNotice}
              </div>
            )}
            {ui.status === 'LOADING' && (
              <div className="game-status original-frame">
                <p>Loading…</p>
                <progress value={ui.progress} max="1" />
              </div>
            )}
            {ui.status === 'ERROR' && (
              <div
                className="game-status original-frame"
                role="alert"
              >
                <h2>Không thể mở game</h2>
                <p>{ui.error}</p>
                <button
                  className="original-ui-button"
                  onClick={() => {
                    retryRoom.current =
                      ui.roomId && ui.players > 1
                        ? { id: ui.roomId, campaign: activeCampaign }
                        : null;
                    setGeneration((value) => value + 1);
                  }}
                >
                  Thử lại
                </button>
                <Link to="/">Về menu</Link>
              </div>
            )}
            {menuVisible && (
              <div
                className="pause-screen"
                data-testid="pause-screen"
              >
                <h2 className="sr-only">Tạm dừng</h2>
                <aside
                  className="pause-stats original-frame"
                  aria-label="Session statistics"
                >
                  <p>{CAMPAIGNS[activeCampaign].name}</p>
                  <p>
                    Time: {Math.floor(ui.seconds / 3600)}h{' '}
                    {Math.floor(ui.seconds / 60) % 60}m{' '}
                    {Math.floor(ui.seconds) % 60}s
                  </p>
                  <p>Jumps: {ui.jumps}</p>
                  <p>Falls: {ui.falls}</p>
                </aside>
                {menus.map((panel, depth) => (
                  <OriginalMenu
                    key={`${panel}-${depth}`}
                    label={panelLabels[panel]}
                    items={[
                      ...(menuItems[panel] || []),
                      ...(depth &&
                      !['exit', 'restart'].includes(panel)
                        ? [
                            {
                              label: 'Back',
                              action: back,
                              back: true,
                            },
                          ]
                        : []),
                    ]}
                    content={details[panel]}
                    depth={depth}
                    side="right"
                    top={16}
                    active={panel === activeMenu}
                    onBack={back}
                    onSelect={() =>
                      scene.current?.playSound(
                        'audio/gui_sfx/selectA',
                      )
                    }
                    gamepad
                  />
                ))}
                <p className="pause-objective original-frame">
                  Objective: Get to the babe at the top!
                </p>
              </div>
            )}
            {ui.status === 'COMPLETE' && !menuVisible && (
              <div className="ending-actions original-frame">
                <h2 className="sr-only">Chinh phục đỉnh tháp</h2>
                <p>YOU REACHED THE BABE!</p>
                <p>
                  {clock(ui.seconds)} · {ui.jumps} jumps · {ui.falls}{' '}
                  falls
                </p>
                <button className="original-ui-button" onClick={exit}>
                  Main Menu
                </button>
                {!autoplay && (
                  <button
                    className="original-ui-button"
                    onClick={() => open('restart')}
                  >
                    New Game
                  </button>
                )}
                {autoplay && (
                  <p>
                    {autoplayIndex === 2
                      ? 'Đã chạy xong cả 3 chiến dịch.'
                      : 'Đang chuyển sang chiến dịch tiếp theo…'}
                  </p>
                )}
              </div>
            )}
            {mode !== 'solo' && (
              <div className="online-hud" hidden={menuVisible}>
                <p data-testid="player-count">
                  ● {ui.players} người trong phòng
                </p>
                {mode === 'race' && (
                  <div className="race-hud">
                    <p data-testid="race-status">
                      {ui.raceStatus || 'CONNECTING'}
                    </p>
                    {ui.raceStatus === 'WAITING' && (
                      <button
                        className="original-ui-button"
                        onClick={() => scene.current?.toggleReady()}
                      >
                        {ui.ready ? 'Unready' : 'Ready Up'}
                      </button>
                    )}
                    {ui.raceStatus === 'COUNTDOWN' && (
                      <p className="race-countdown">{ui.countdown}</p>
                    )}
                    {ui.raceStatus === 'FINISHED' && (
                      <ol>
                        {ui.standings?.map((player, index) => (
                          <li key={`${player.nickname}-${index}`}>
                            {player.nickname}{' '}
                            {player.finished
                              ? clock(player.seconds)
                              : '↑'}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </div>
            )}
            {(ui.saveError || notice) && (
              <p role="alert" className="game-notice original-frame">
                {ui.saveError || notice}
              </p>
            )}
          </div>
        </div>
        <div
          className="touch-controls"
          role="group"
          aria-label="Điều khiển cảm ứng"
        >
          <div className="touch-action-row">
            <button {...hold('left')} aria-label="Đi sang trái">
              ←
            </button>
            <button {...hold('right')} aria-label="Đi sang phải">
              →
            </button>
            <button
              {...hold('jump')}
              className="jump-button"
              aria-label="Giữ để nhảy"
            >
              NHẢY
            </button>
          </div>
          <div className="touch-menu-row">
            <button
              onClick={() => scene.current?.setPaused(!ui.paused)}
              disabled={ui.status !== 'PLAYING'}
              aria-label="Tạm dừng"
            >
              Menu
            </button>
            <button onClick={fullscreen} aria-label="Toàn màn hình">
              Fullscreen
            </button>
          </div>
        </div>
      </div>

      {mode === 'solo' && (developerOpen || autoplay) && (
        <section
          className="inventory-panel autoplay-panel"
          aria-label="Chạy thử tự động"
        >
          <h2>Chạy thử tự động</h2>
          {!autoplay ? (
            <form onSubmit={activateCheat}>
              <p className="quiet-text">
                Nhập mã để tự tham quan mọi màn, thử vật phẩm/NPC và
                cắt cảnh của cả 3 chiến dịch.
              </p>
              <label htmlFor="cheat-code">Mã cheat</label>
              <input
                id="cheat-code"
                value={cheat}
                onChange={(event) => setCheat(event.target.value)}
                onFocus={() => scene.current?.setPaused(true)}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                className="menu-button"
                type="submit"
                disabled={ui.status === 'LOADING'}
              >
                Kích hoạt tự chơi
              </button>
              {cheatError && (
                <p role="alert" className="error-note">
                  {cheatError}
                </p>
              )}
            </form>
          ) : (
            <div data-testid="autoplay-panel">
              <p>
                Chiến dịch {(autoplayIndex ?? 0) + 1}/3 ·{' '}
                {CAMPAIGNS[activeCampaign].name}
              </p>
              <p className="quiet-text">{ui.autoplay?.label}</p>
              <progress
                value={ui.autoplay?.progress || 0}
                max="1"
                aria-label="Tiến độ tự chơi"
              />
              <p className="quiet-text">
                {Math.floor((ui.autoplay?.progress || 0) * 100)}% · Đã
                qua {ui.autoplay?.visited || 0}/
                {ui.autoplay?.totalScreens || 0} màn
              </p>
              <button className="menu-button" onClick={stopAutoplay}>
                Dừng tự chơi, trở lại save
              </button>
            </div>
          )}
          <label htmlFor="autoplay-speed">Tốc độ chạy thử</label>
          <select
            id="autoplay-speed"
            value={autoplaySpeed}
            onChange={(event) =>
              setAutoplaySpeed(Number(event.target.value))
            }
          >
            {[1, 4, 8, 16, 32, 64].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
          {!!results.length && (
            <ul data-testid="autoplay-results">
              {results.map((result) => (
                <li
                  key={result.campaign}
                  data-campaign={result.campaign}
                >
                  {CAMPAIGNS[result.campaign].name}: hoàn tất ·{' '}
                  {result.screens.length} màn · {result.pickups} lần
                  nhặt · {result.npcs} NPC · {result.sales} giao dịch
                  · {result.birds} nhiệm vụ chim · {result.endings}{' '}
                  cắt cảnh
                </li>
              ))}
            </ul>
          )}
          <p className="quiet-text">
            Phiên cheat riêng: tự chuyển màn và tới vùng kích hoạt;
            cấp tiền thử mua đồ. Báo cáo ghi tương tác đã chạy. Các
            nhánh hội thoại và thử thách thành tích cần kiểm tra
            riêng.
          </p>
          {!autoplay && (
            <button onClick={resume}>Đóng công cụ</button>
          )}
        </section>
      )}
    </main>
  );
}
