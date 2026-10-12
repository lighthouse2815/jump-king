import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CAMPAIGNS, CampaignId } from '@jump-king/maps';
import { readSave, saveKey } from '../game/soloSave';
import { readProgress } from '../game/originalProgress';
import { originalUrl } from '../game/originalAssets';
import { OriginalMenu, MenuItem } from '../components/OriginalMenu';
import { multiplayerEnabled } from '../game/networking/NetworkManager';
import { readGamepads } from '../game/utils/gamepads';

type Panel =
  | 'main'
  | 'babes'
  | 'campaign'
  | 'options'
  | 'controls'
  | 'extras'
  | 'credits'
  | 'stats'
  | 'confirm'
  | 'online'
  | 'quit';
const panelLabels: Record<Panel, string> = {
  main: 'Main menu',
  babes: 'Other Babes',
  campaign: 'Campaign menu',
  options: 'Options',
  controls: 'Controls',
  extras: 'Extras',
  credits: 'Credits',
  stats: 'Total Stats',
  confirm: 'New game confirmation',
  online: 'Play Online',
  quit: 'Quit',
};
const soundFiles = {
  select: 'audio/gui_sfx/selectA.ogg',
  confirm: 'audio/gui_sfx/SelectC.ogg',
  open: 'audio/gui_sfx/menu_open.ogg',
  start: 'audio/press_start.ogg',
};
const campaignName = (id: CampaignId) =>
  id === 'nbp' ? 'New Babe+' : CAMPAIGNS[id].name;
const formatTime = (ticks: number) => {
  const seconds = Math.floor(ticks / 60);
  return `${Math.floor(seconds / 3600)}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export const LandingPage = () => {
  const navigate = useNavigate();
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const music = useRef<HTMLAudioElement | null>(null);
  const sounds = useRef<
    Partial<Record<keyof typeof soundFiles, HTMLAudioElement>>
  >({});
  const [started, setStarted] = useState(
    () => sessionStorage.getItem('jumpking.title.started') === 'true',
  );
  const [panels, setPanels] = useState<Panel[]>(['main']);
  const [campaign, setCampaign] = useState<CampaignId>(() => {
    const saved = localStorage.getItem('jumpking.campaign');
    return saved && Object.prototype.hasOwnProperty.call(CAMPAIGNS, saved)
      ? (saved as CampaignId)
      : 'original';
  });
  const [muted, setMuted] = useState(
    () => localStorage.getItem('jumpking.muted') === 'true',
  );
  const [notice, setNotice] = useState('');
  const save = readSave(campaign);
  const profile = readProgress();
  const activePanel = panels[panels.length - 1];

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (!stage.current) return;
      const { width, height } = entry.contentRect;
      const scale = Math.min(width / 480, height / 360);
      stage.current.style.transform = `scale(${scale})`;
      stage.current.style.left = `${(width - scale * 480) / 2}px`;
      stage.current.style.top = `${(height - scale * 360) / 2}px`;
    });
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  const playAudio = (audio: HTMLAudioElement) => {
    void audio.play().catch((error: Error) => {
      if (!['NotAllowedError', 'AbortError'].includes(error.name))
        setNotice('Menu audio could not be played.');
    });
  };
  useEffect(() => {
    const audio = new Audio(
      originalUrl('audio/music/menu loop/menu_intro.ogg'),
    );
    audio.volume = 0.5;
    audio.muted = localStorage.getItem('jumpking.muted') === 'true';
    audio.onended = () => {
      audio.src = originalUrl('audio/music/menu loop/menu_loop.ogg');
      audio.loop = true;
      playAudio(audio);
    };
    music.current = audio;
    const effects = Object.fromEntries(
      Object.entries(soundFiles).map(([key, file]) => {
        const effect = new Audio(originalUrl(file));
        effect.volume = 0.5;
        effect.muted = audio.muted;
        return [key, effect];
      }),
    );
    sounds.current = effects;
    return () => {
      audio.onended = null;
      audio.pause();
      Object.values(effects).forEach((effect) => effect.pause());
      music.current = null;
      sounds.current = {};
    };
  }, []);
  useEffect(() => {
    localStorage.setItem('jumpking.muted', String(muted));
    if (music.current) music.current.muted = muted;
    for (const audio of Object.values(sounds.current))
      if (audio) audio.muted = muted;
    if (!muted && music.current) playAudio(music.current);
  }, [muted]);

  const sound = (key: keyof typeof soundFiles) => {
    if (music.current?.paused) playAudio(music.current);
    const audio = sounds.current[key];
    if (audio) {
      audio.currentTime = 0;
      playAudio(audio);
    }
  };
  const enterMenu = () => {
    sound('start');
    sessionStorage.setItem('jumpking.title.started', 'true');
    setStarted(true);
  };
  useEffect(() => {
    if (started) return;
    const keydown = (event: KeyboardEvent) => {
      if (event.code === 'Space' || event.key === 'Enter') {
        event.preventDefault();
        if (!event.repeat) enterMenu();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [started]);

  // Standard gamepads use the same menu controls as the keyboard.
  useEffect(() => {
    let frame = 0;
    let previous = '';
    let repeatedAt = 0;
    const poll = (now: number) => {
      const pad = readGamepads().find(
        (value) => value?.mapping === 'standard',
      );
      const key =
        pad?.buttons[0]?.pressed || pad?.buttons[9]?.pressed
          ? 'Enter'
          : pad?.buttons[1]?.pressed
            ? 'Escape'
            : pad?.buttons[12]?.pressed || (pad?.axes[1] || 0) < -0.5
              ? 'ArrowUp'
              : pad?.buttons[13]?.pressed || (pad?.axes[1] || 0) > 0.5
                ? 'ArrowDown'
                : '';
      if (
        key &&
        (key !== previous ||
          (key.startsWith('Arrow') && now - repeatedAt > 250))
      ) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key }));
        repeatedAt = now;
      }
      previous = key;
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, []);

  const open = (panel: Panel) => {
    sound('open');
    setNotice('');
    setPanels((previous) => [...previous, panel]);
  };
  const back = () => {
    if (panels.length > 1) {
      sound('confirm');
      setNotice('');
      setPanels((previous) => previous.slice(0, -1));
    }
  };
  const play = (id: CampaignId, fresh: boolean) => {
    sound('confirm');
    localStorage.setItem('jumpking.campaign', id);
    if (fresh) localStorage.removeItem(saveKey(id));
    navigate(`/play?campaign=${id}${fresh ? '&new=1' : ''}`);
  };
  const newGame = (id: CampaignId) => {
    setCampaign(id);
    if (readSave(id)) open('confirm');
    else play(id, true);
  };
  const chooseCampaign = (id: CampaignId) => {
    setCampaign(id);
    open('campaign');
  };
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await viewport.current?.requestFullscreen();
    } catch {
      setNotice('Fullscreen is unavailable in this browser.');
    }
  };
  const menuItems: Partial<Record<Panel, MenuItem[]>> = {
    main: [
      ...(save
        ? [{ label: 'Continue', action: () => play(campaign, false) }]
        : []),
      { label: 'New Game', action: () => newGame('original') },
      { label: 'Other Babes', action: () => open('babes'), green: true },
      { label: 'Options', action: () => open('options') },
      { label: 'Extras', action: () => open('extras') },
      ...(multiplayerEnabled
        ? [{ label: 'Play Online', action: () => open('online') }]
        : []),
      { label: 'Quit', action: () => open('quit') },
    ],
    babes: [
      { label: 'New Babe+', action: () => chooseCampaign('nbp') },
      { label: 'Ghost of the Babe', action: () => chooseCampaign('ghost') },
    ],
    campaign: [
      ...(save
        ? [{ label: 'Continue', action: () => play(campaign, false) }]
        : []),
      { label: 'New Game', action: () => newGame(campaign) },
    ],
    confirm: [
      { label: 'Yes', action: () => play(campaign, true) },
      { label: 'No', action: back },
    ],
    options: [
      {
        label: 'Fullscreen',
        action: () => {
          sound('confirm');
          void fullscreen();
        },
      },
      { label: 'Controls', action: () => open('controls') },
      {
        label: `Sound: ${muted ? 'OFF' : 'ON'}`,
        action: () => {
          sound('confirm');
          setMuted((value) => !value);
        },
      },
    ],
    extras: [
      { label: 'Credits', action: () => open('credits') },
      { label: 'Total Stats', action: () => open('stats') },
    ],
    online: [
      { label: 'Community Tower', action: () => navigate('/community') },
      { label: 'Race Arena', action: () => navigate('/race') },
    ],
    quit: [
      {
        label: 'Return to title',
        action: () => {
          sound('confirm');
          sessionStorage.removeItem('jumpking.title.started');
          setStarted(false);
          setPanels(['main']);
        },
      },
    ],
  };
  const totals = profile.achievements.totals;
  const details: Partial<Record<Panel, React.ReactNode>> = {
    controls: (
      <>
        <p>Move: ← → / A D</p>
        <p>Jump: hold / release SPACE</p>
        <p>Pause: ESC</p>
        <p>Gamepad: D-pad / A / Start</p>
        <p>Touch: buttons below game</p>
      </>
    ),
    credits: (
      <>
        <p>Nexile · Jump King (2019)</p>
        <p>Erik Säll · Programming</p>
        <p>Felix Wahlström · Art</p>
        <p>Eric Osana · Level Design</p>
        <p>Theo Unland Karlsson · QA</p>
        <p>Nils Eklöf · Elias Thörnlund</p>
        <p>Music &amp; Sound</p>
        <p>Fonts: jeti (fontenddev.com)</p>
      </>
    ),
    stats: (
      <>
        <p>Time: {formatTime(totals.ticks)}</p>
        <p>Jumps: {totals.jumps}</p>
        <p>Falls: {totals.falls}</p>
        <p>Achievements: {profile.achievements.unlocked.length} / 48</p>
      </>
    ),
  };

  return (
    <main className="title-page">
      <div className="title-viewport" ref={viewport}>
        <div
          className={`title-stage ${started ? 'menu-open' : 'press-start'}`}
          ref={stage}
          data-testid="title-stage"
        >
          <img
            className="title-logo"
            src={originalUrl('title_logo.png')}
            alt="Jump King"
            width="392"
            height="111"
          />
          {!started ? (
            <>
              <button className="press-start-button" onClick={enterMenu}>
                Press SPACE to start
              </button>
              <div className="title-king" aria-hidden="true" />
            </>
          ) : (
            <>
              <span className="title-copyright">© Nexile 2019</span>
              {save && panels.length === 1 && (
                <aside
                  className="title-save original-frame"
                  aria-label="Saved session"
                >
                  <p>{campaignName(campaign)}</p>
                  <p>Time: {formatTime(save.state.ticks)}</p>
                  <p>Jumps: {save.state.jumps}</p>
                  <p>Falls: {save.state.falls}</p>
                </aside>
              )}
              {panels.map((panel, depth) => {
                const items = [
                  ...(menuItems[panel] || []),
                  ...(depth
                    ? [{ label: 'Back', action: back, back: true }]
                    : []),
                ];
                return (
                  <OriginalMenu
                    key={`${panel}-${depth}`}
                    label={panelLabels[panel]}
                    items={items}
                    content={details[panel]}
                    depth={depth}
                    active={panel === activePanel}
                    onBack={back}
                    onSelect={() => sound('select')}
                  />
                );
              })}
              {activePanel === 'campaign' && (
                <p className="title-menu-note">{campaignName(campaign)}</p>
              )}
              {activePanel === 'confirm' && (
                <p className="title-menu-note">
                  Replace the saved {campaignName(campaign)} game?
                </p>
              )}
              {activePanel === 'quit' && (
                <p className="title-menu-note">
                  Return to title. Close the tab to exit.
                </p>
              )}
              <p className="title-save-note">
                All progress is saved automatically.
              </p>
            </>
          )}
          {notice && (
            <p className="title-notice" role="status">
              {notice}
            </p>
          )}
        </div>
      </div>
    </main>
  );
};
