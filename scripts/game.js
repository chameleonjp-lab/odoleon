import { analyzeAudioAndBuildChart, SONGS } from "./songs.js";

(() => {
  // =========================================================
  // 1. GAME CONSTANTS & ACTIVE CHART
  // =========================================================
  let SONG_DURATION = 145.92;
  let BPM = 164.38;
  let BEAT_SEC = 60 / BPM;
  let BEAT_PHASE = 0.1643;
  const LEAD_TIME = 1.18;

  const MOVES = {
    1: { name: '1:ポーズ', short: 'ポーズ', color: '#22c55e', hex: 0x22c55e },
    2: { name: '2:スピン', short: 'スピン', color: '#0ea5e9', hex: 0x0ea5e9 },
    3: { name: '3:ステップ', short: 'ステップ', color: '#f97316', hex: 0xf97316 },
    4: { name: '4:ウェーブ', short: 'ウェーブ', color: '#a855f7', hex: 0xa855f7 },
    5: { name: '5:ジャンプ', short: 'ジャンプ', color: '#eab308', hex: 0xeab308 },
    6: { name: '6:フィニッシュ', short: 'フィニッシュ', color: '#ef4444', hex: 0xef4444 }
  };

  let activeSongId = 'orekameleon';
  function getActiveSong() {
    return SONGS.find((s) => s.id === activeSongId) || SONGS[0];
  }

  let ACTIVE_CHART = getActiveSong().chart;
  const CHART_STEP_MAP = new Map();
  function rebuildStepMap() {
    CHART_STEP_MAP.clear();
    const stepDur = BEAT_SEC / 2;
    ACTIVE_CHART.forEach((n) => {
      CHART_STEP_MAP.set(Math.round(n.time / stepDur), n);
    });
  }
  rebuildStepMap();

  const WIN_PERFECT = 0.09;
  const WIN_GREAT = 0.165;
  const WIN_OK = 0.255;
  const WIN_WRONG_LOCK = 0.28;

  // =========================================================
  // 2. DOM REFERENCES & STORAGE
  // =========================================================
  const shellEl = document.getElementById('stage-shell');
  const threeCanvas = document.getElementById('three-canvas');
  const fxCanvas = document.getElementById('fx-canvas');
  const fxCtx = fxCanvas.getContext('2d');

  const timeValEl = document.getElementById('time-value');
  const notesValEl = document.getElementById('notes-value');
  const scoreValEl = document.getElementById('score-value');
  const comboBadgeEl = document.getElementById('combo-badge');
  const progressFillEl = document.getElementById('progress-fill');
  const calloutBannerEl = document.getElementById('callout-banner');
  const scoreBoxEl = document.getElementById('score-box');
  const controlsBarEl = document.getElementById('controls-bar');
  const homeSongTitleEl = document.getElementById('home-song-title');
  const homeSongSubEl = document.getElementById('home-song-sub');
  const openSongSelectBtn = document.getElementById('open-song-select-btn');
  const songModalEl = document.getElementById('song-modal');
  const closeSongBtn = document.getElementById('close-song-btn');
  const songListEl = document.getElementById('song-list');
  const songFileInput = document.getElementById('song-file-input');
  const addCustomSongBtn = document.getElementById('add-custom-song-btn');

  let pendingUploadTargetSongId = null;

  function fmtTime(sec) {
    const s = Math.max(0, Math.floor(sec));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function applySelectedSong(songId) {
    activeSongId = songId;
    const song = getActiveSong();
    SONG_DURATION = song.duration;
    BPM = song.bpm;
    BEAT_SEC = 60 / BPM;
    BEAT_PHASE = song.beatPhase || 0;
    ACTIVE_CHART = song.chart;
    rebuildStepMap();

    homeSongTitleEl.textContent = song.title;
    homeSongSubEl.textContent = `全${song.chart.length}ノーツ ・ ${fmtTime(song.duration)}`;
    updateHUD();
  }

  function renderSongModal() {
    songListEl.innerHTML = '';
    SONGS.forEach((song) => {
      const card = document.createElement('div');
      card.className = 'song-card' + (song.id === activeSongId ? ' selected' : '');

      const top = document.createElement('div');
      top.className = 'song-card-top';
      const title = document.createElement('div');
      title.className = 'song-card-title';
      title.textContent = (song.id === activeSongId ? '▶ ' : '') + song.title;
      const badge = document.createElement('span');
      badge.className = 'song-badge';
      badge.textContent = `${song.chart.length}ノーツ / ${fmtTime(song.duration)}`;
      top.append(title, badge);

      card.appendChild(top);

      card.addEventListener('click', () => {
        applySelectedSong(song.id);
        renderSongModal();
      });
      songListEl.appendChild(card);
    });
  }

  const titleOverlayEl = document.getElementById('title-overlay');
  const resultOverlayEl = document.getElementById('result-overlay');
  const startBtn = document.getElementById('start-btn');
  const playAgainBtn = document.getElementById('play-again-btn');
  const restartBtn = document.getElementById('restart-btn');
  const muteBtn = document.getElementById('mute-btn');
  const muteIcon = document.getElementById('mute-icon');
  const muteText = document.getElementById('mute-text');

  const titleHiScoreEl = document.getElementById('title-hiscore');
  const resHiScoreEl = document.getElementById('res-hiscore');
  const resRankEl = document.getElementById('result-rank');
  const resCommentEl = document.getElementById('result-comment');
  const resScoreEl = document.getElementById('res-score');
  const resComboEl = document.getElementById('res-combo');
  const resPerfEl = document.getElementById('res-perf');
  const resGreatEl = document.getElementById('res-great');
  const resOkEl = document.getElementById('res-ok');
  const resMissEl = document.getElementById('res-miss');

  const danceButtons = Array.from(document.querySelectorAll('.dance-btn'));
  let buttonTargets = [];
  function updateButtonTargets() {
    const shellRect = shellEl.getBoundingClientRect();
    buttonTargets = danceButtons.map((btn) => {
      const orb = btn.querySelector('.dance-btn-orb');
      const r = orb.getBoundingClientRect();
      return {
        x: r.left - shellRect.left + r.width * 0.5,
        y: r.top - shellRect.top + r.height * 0.5,
        r: r.width * 0.5
      };
    });
  }

  function loadHiScore() {
    try {
      return parseInt(localStorage.getItem('chameleon_dance_hiscore') || '0', 10) || 0;
    } catch (e) {
      return 0;
    }
  }

  function saveHiScore(val) {
    try {
      localStorage.setItem('chameleon_dance_hiscore', String(val));
    } catch (e) {
      // ignore
    }
  }

  // =========================================================
  // 3. WEB AUDIO API SYNTHESIZER (60s FUNKY ARCADE POP)
  // =========================================================
  const audio = {
    ctx: null,
    master: null,
    muted: false,
    schedulerId: null,
    nextStepTime: 0,
    stepIndex: 0,
    songStartTime: 0,
    isPlaying: false,
    bufferSource: null
  };

  function ensureAudio() {
    if (!audio.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audio.ctx = new AudioCtx();
      audio.master = audio.ctx.createGain();
      audio.master.gain.value = audio.muted ? 0 : 0.72;
      audio.master.connect(audio.ctx.destination);
    }
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
  }

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  function playKick(t, accent = 1) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    gain.gain.setValueAtTime(0.55 * accent, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  function playSnare(t, accent = 1) {
    const ctx = audio.ctx;
    const len = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.35));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1100;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28 * accent, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    src.start(t);

    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, t);
    osc.frequency.exponentialRampToValueAtTime(110, t + 0.06);
    og.gain.setValueAtTime(0.18 * accent, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    osc.connect(og);
    og.connect(audio.master);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  function playHat(t, open = false) {
    const ctx = audio.ctx;
    const dur = open ? 0.14 : 0.04;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.4));
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(open ? 0.14 : 0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp);
    hp.connect(gain);
    gain.connect(audio.master);
    src.start(t);
  }

  function playBass(t, midi, dur = 0.22) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(midiToFreq(midi), t);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, t);
    filter.frequency.exponentialRampToValueAtTime(280, t + dur);
    gain.gain.setValueAtTime(0.24, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playChord(t, midis, dur = 0.35, vol = 0.09) {
    const ctx = audio.ctx;
    midis.forEach((m) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(midiToFreq(m), t);
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(vol, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(audio.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    });
  }

  function playLead(t, midi, dur = 0.2, vol = 0.14) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(2600, t);
    osc.frequency.setValueAtTime(midiToFreq(midi), t);
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(lp);
    lp.connect(gain);
    gain.connect(audio.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function playHitSFX(grade, isFinale = false) {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    if (grade === 'PERFECT') {
      const baseNotes = isFinale
        ? [72, 76, 79, 84, 88, 96]
        : (state.combo >= 73 ? [72, 76, 79, 84] : [76, 81, 88]);
      baseNotes.forEach((m, idx) => playLead(t + idx * 0.025, m, isFinale ? 0.5 : 0.18, isFinale ? 0.18 : 0.14));
      if (state.combo >= 71) {
        // #71: High-octave shimmering synth sparkle!
        playLead(t + 0.04, 96, 0.24, 0.11);
      }
    } else if (grade === 'GREAT') {
      playLead(t, 74, 0.14, 0.13);
      playLead(t + 0.03, 79, 0.14, 0.11);
    } else if (grade === 'OK') {
      playLead(t, 69, 0.11, 0.1);
    } else {
      const osc = audio.ctx.createOscillator();
      const g = audio.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.linearRampToValueAtTime(95, t + 0.14);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(g);
      g.connect(audio.master);
      osc.start(t);
      osc.stop(t + 0.16);
    }
  }

  function playStageUpSFX() {
    if (!audio.ctx || audio.muted) return;
    const t = audio.ctx.currentTime;
    [72, 76, 79, 84].forEach((m, i) => playLead(t + i * 0.05, m, 0.24, 0.12));
  }

  const CHORD_PROG = [
    { bass: 41, chord: [65, 69, 72, 76] },
    { bass: 43, chord: [67, 71, 74, 77] },
    { bass: 40, chord: [64, 67, 71, 74] },
    { bass: 45, chord: [69, 72, 76, 79] }
  ];

  const VERSE_MELODY = [76, 0, 79, 81, 0, 79, 76, 72, 74, 0, 76, 79, 0, 76, 74, 72];
  const CHORUS_MELODY = [84, 0, 81, 84, 88, 0, 86, 84, 81, 0, 79, 81, 84, 0, 79, 76];

  function scheduleStep(step, t) {
    const totalBars = Math.max(30, Math.ceil(SONG_DURATION / (BEAT_SEC * 4)));
    const bar = Math.floor(step / 8);
    const sub = step % 8;
    if (bar >= totalBars) return;
    const prog = CHORD_PROG[bar % 4];

    if (bar < 2) {
      if (sub % 2 === 0) {
        playKick(t, 0.7);
        playHat(t, false);
      }
      const arp = [60, 64, 67, 72, 76, 72, 67, 64];
      playLead(t, arp[sub], 0.16, 0.1);
      if (bar === 1 && sub % 2 === 0) playLead(t, 84, 0.08, 0.12);
      return;
    }

    if (bar >= totalBars - 2) {
      if (bar === totalBars - 2 && sub === 0) {
        playKick(t, 1.2);
        playChord(t, [60, 64, 67, 72, 76], 1.8, 0.14);
      }
      if (bar === totalBars - 2 && (sub === 2 || sub === 4 || sub === 6)) {
        playLead(t, [79, 84, 88][(sub - 2) / 2], 0.3, 0.13);
      }
      if (bar === totalBars - 1 && sub === 0) {
        playChord(t, [60, 67, 72, 76, 84], 1.9, 0.15);
      }
      return;
    }

    const sectionBar = bar % 28;
    const isBuild = sectionBar >= 15 && sectionBar < 20;
    const isChorus = sectionBar >= 20;
    const isVerse = sectionBar >= 8 && sectionBar < 15;

    if (sub === 0 || sub === 4 || (isChorus && sub === 6)) playKick(t, isChorus ? 1.1 : 0.95);
    if (sub === 2 || sub === 6) {
      playSnare(t, isChorus ? 1.1 : 0.9);
      if (state.combo >= 72) {
        // #72: Stereo crowd hand-clap layer!
        playHat(t + 0.012, true);
        playSnare(t + 0.018, 0.45);
      }
    }
    if (isBuild && bar === 19) playSnare(t, 0.6 + sub * 0.08);
    playHat(t, sub === 3 || sub === 7);

    if (sub === 0 || sub === 3 || sub === 4 || sub === 7) {
      const octave = (sub === 3 || sub === 7) ? 12 : 0;
      playBass(t, prog.bass + octave, 0.21);
    }

    if (sub === 0 || sub === 5) {
      playChord(t, prog.chord, 0.26, isChorus ? 0.1 : 0.075);
    }

    // Musical phrase melody + direct chart beat/off-beat accent sync!
    const chartNote = CHART_STEP_MAP.get(step);
    if (chartNote) {
      // Crisp melodic synth stab right on the exact beat/off-beat the player taps!
      const moveScale = [72, 74, 76, 79, 81, 84];
      const pitch = moveScale[(chartNote.move - 1) % 6] + (isChorus ? 0 : 0);
      playLead(t, pitch, chartNote.isOffbeat ? 0.14 : 0.22, isChorus ? 0.16 : 0.13);
      if (chartNote.isOffbeat) {
        // Punchy off-beat clap/hat accent so 裏拍 feels unmistakable & groovy!
        playSnare(t, 0.72);
      }
    } else if (isVerse || isBuild) {
      const note = VERSE_MELODY[(bar % 2) * 8 + sub];
      if (note) playLead(t, note, 0.16, 0.075);
    } else if (isChorus) {
      const note = CHORUS_MELODY[(bar % 2) * 8 + sub];
      if (note) playLead(t, note, 0.18, 0.095);
    }
  }

  function decodeDataUriToBuffer(dataUri) {
    ensureAudio();
    const commaIdx = dataUri.indexOf(',');
    const b64 = commaIdx >= 0 ? dataUri.slice(commaIdx + 1) : dataUri;
    const binStr = atob(b64);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);
    return audio.ctx.decodeAudioData(bytes.buffer.slice(0));
  }

  async function ensureSongAudioReady(song) {
    if ((song.mode === 'embedded_audio' || song.mode === 'audio') && !song.audioBuffer && song.audioSrc) {
      ensureAudio();
      if (song.audioSrc.startsWith('data:')) {
        song.audioBuffer = await decodeDataUriToBuffer(song.audioSrc);
      } else {
        const resp = await fetch(song.audioSrc);
        if (!resp.ok) throw new Error('Audio fetch failed: ' + resp.status);
        const ab = await resp.arrayBuffer();
        song.audioBuffer = await new Promise((res, rej) => { const p = audio.ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
      }
    }
  }

  function startMusic() {
    ensureAudio();
    stopMusic();
    const song = getActiveSong();
    audio.songStartTime = audio.ctx.currentTime + 0.10;
    audio.isPlaying = true;

    if ((song.mode === 'audio' || song.mode === 'embedded_audio') && song.audioBuffer) {
      // Hardware-locked real audio playback (オレカメレオン embedded MP3 / custom tracks!)
      const src = audio.ctx.createBufferSource();
      src.buffer = song.audioBuffer;
      src.connect(audio.master);
      src.start(audio.songStartTime);
      audio.bufferSource = src;
      return;
    }

    // Dynamic synth track synced to active song's BPM & duration
    const stepDur = BEAT_SEC / 2;
    const maxSteps = Math.ceil(SONG_DURATION / stepDur);
    audio.nextStepTime = audio.songStartTime;
    audio.stepIndex = 0;

    audio.schedulerId = setInterval(() => {
      if (!audio.isPlaying || !audio.ctx) return;
      while (audio.nextStepTime < audio.ctx.currentTime + 0.14) {
        scheduleStep(audio.stepIndex, audio.nextStepTime);
        audio.nextStepTime += stepDur;
        audio.stepIndex++;
        if (audio.stepIndex >= maxSteps) break;
      }
    }, 25);
  }

  function stopMusic() {
    audio.isPlaying = false;
    if (audio.schedulerId) {
      clearInterval(audio.schedulerId);
      audio.schedulerId = null;
    }
    if (audio.bufferSource) {
      try { audio.bufferSource.stop(); } catch (e) {}
      audio.bufferSource.disconnect();
      audio.bufferSource = null;
    }
  }

  // =========================================================
  // 4. FINE ORGANIC PBR TEXTURES FOR TRUE 3D CHAMELEON
  // =========================================================
  function createSmoothReptileTextures(baseHex, stripeHex, bellyHex) {
    const size = 256;
    const cCol = document.createElement('canvas');
    const cBump = document.createElement('canvas');
    cCol.width = cBump.width = size;
    cCol.height = cBump.height = size;
    const ctx = cCol.getContext('2d');
    const bctx = cBump.getContext('2d');

    const baseColor = new THREE.Color(baseHex);
    const stripeColor = new THREE.Color(stripeHex);
    const lightColor = baseColor.clone().offsetHSL(0.03, 0.08, 0.12);

    // Smooth natural reptile base gradient
    ctx.fillStyle = `#${baseColor.getHexString()}`;
    ctx.fillRect(0, 0, size, size);

    // Soft organic camouflage tiger bands
    for (let i = 0; i < 5; i++) {
      const gx = (i / 5) * size;
      const grad = ctx.createLinearGradient(gx, 0, gx + 32, size * 0.35);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, `rgba(${Math.round(stripeColor.r * 255)},${Math.round(stripeColor.g * 255)},${Math.round(stripeColor.b * 255)},0.30)`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(gx - 8, 0, 38, size);
    }

    // Soft dappled sunlight spots
    for (let i = 0; i < 45; i++) {
      const rx = (Math.sin(i * 41.3) * 0.5 + 0.5) * size;
      const ry = (Math.cos(i * 23.7) * 0.5 + 0.5) * size;
      const rr = 8 + (i % 7) * 2.2;
      const g = ctx.createRadialGradient(rx, ry, 1, rx, ry, rr);
      g.addColorStop(0, `rgba(${Math.round(lightColor.r * 255)},${Math.round(lightColor.g * 255)},${Math.round(lightColor.b * 255)},0.22)`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(rx, ry, rr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Subtle fine micro-pebble scales (NO coarse dark grid!)
    bctx.fillStyle = '#707070';
    bctx.fillRect(0, 0, size, size);
    const step = 6.4;
    for (let row = 0; row < size / step + 1; row++) {
      for (let col = 0; col < size / step + 1; col++) {
        const x = col * step + (row % 2 === 0 ? 0 : step * 0.5);
        const y = row * step;
        const r = 2.4;
        const bg = bctx.createRadialGradient(x - 0.5, y - 0.5, 0.2, x, y, r);
        bg.addColorStop(0, '#c8c8c8');
        bg.addColorStop(0.8, '#888888');
        bg.addColorStop(1, '#585858');
        bctx.fillStyle = bg;
        bctx.beginPath();
        bctx.arc(x, y, r, 0, Math.PI * 2);
        bctx.fill();

        ctx.fillStyle = 'rgba(245, 255, 200, 0.05)';
        ctx.beginPath();
        ctx.arc(x - 0.5, y - 0.5, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const map = new THREE.CanvasTexture(cCol);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2.5, 2.5);
    map.encoding = THREE.sRGBEncoding;

    const bumpMap = new THREE.CanvasTexture(cBump);
    bumpMap.wrapS = bumpMap.wrapT = THREE.RepeatWrapping;
    bumpMap.repeat.set(2.5, 2.5);

    // Smooth Ribbed Belly Texture
    const cBelly = document.createElement('canvas');
    cBelly.width = 128;
    cBelly.height = 256;
    const bCtx2 = cBelly.getContext('2d');
    const bCol = new THREE.Color(bellyHex);
    bCtx2.fillStyle = `#${bCol.getHexString()}`;
    bCtx2.fillRect(0, 0, 128, 256);
    for (let y = 0; y < 256; y += 14) {
      const g = bCtx2.createLinearGradient(0, y, 0, y + 14);
      g.addColorStop(0, 'rgba(30, 52, 16, 0.22)');
      g.addColorStop(0.35, 'rgba(255, 255, 220, 0.16)');
      g.addColorStop(1, 'rgba(24, 42, 14, 0.24)');
      bCtx2.fillStyle = g;
      bCtx2.fillRect(0, y, 128, 14);
    }
    const bellyMap = new THREE.CanvasTexture(cBelly);
    bellyMap.wrapS = bellyMap.wrapT = THREE.RepeatWrapping;
    bellyMap.encoding = THREE.sRGBEncoding;

    return { map, bumpMap, bellyMap };
  }

  function createEyeIrisTexture() {
    const size = 256;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const cx = size / 2;
    const cy = size / 2;

    // Bright warm golden-cream eyeball base for maximum spiral contrast
    const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, 126);
    g.addColorStop(0, '#fffbeb');
    g.addColorStop(0.55, '#fde047');
    g.addColorStop(0.88, '#f59e0b');
    g.addColorStop(1, '#92400e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Bold "ぐるぐる" Archimedean Spiral!
    ctx.strokeStyle = '#090d1a';
    ctx.lineWidth = 11.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const turns = 3.6;
    const maxR = 104;
    const steps = 220;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const angle = t * turns * Math.PI * 2;
      const r = t * maxR;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Crisp center dot & glossy studio highlight
    ctx.fillStyle = '#090d1a';
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.arc(cx - 26, cy - 28, 14, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  }

  // =========================================================
  // 5. FULL 3D VOLUMETRIC CHAMELEON MODEL (ZERO CLIPPING!)
  // =========================================================
  let renderer, scene, camera;
  let sharedIrisTex = null;
  let mainChameleon = null;
  let backDancers = [];
  let breakDancers = [];
  let babyChameleons = [];
  let timingOffsetSec = 0;
  let spotCones = [];
  let eqBars = [];
  let floorRings = [];
  let arcadeScreens = [];
  let arcadeCabinets = [];
  let discoBallGroup = null;
  let laserBeams = [];
  let searchlights = [];
  let floatingHoops = [];
  let starField = null;
  let crystalPillars = [];
  let orbitStarsGroup = null;
  let floorGridGroup = null;
  let megaCrown = null;
  let heroFootRing = null;
  let heroSpotLight = null;
  let heroWingsGroup = null;
  let arenaShockRing = null;
  let arenaShockLife = 1;
  let plasmaHaloRing = null;
  let heroBowMat = null;
  let rimLightLeft, rimLightRight;

  function createSleekHeadGeometry() {
    const geo = new THREE.SphereGeometry(0.36, 36, 28);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      let x = v.x;
      let y = v.y;
      let z = v.z;

      // Sleek laterally-compressed chameleon skull (NOT a wide frog head!)
      x *= 0.86;

      if (z > 0) {
        // Tapered triangular chameleon snout projecting forward
        const f = z / 0.36;
        z *= 1.42;
        x *= 1.0 - f * 0.36;
        if (y > 0) y *= 1.0 - f * 0.28;
        if (y < 0) y *= 0.84;
      } else {
        // Graceful tall veiled-chameleon casque helmet rising up & back
        const b = -z / 0.36;
        if (y > -0.02) {
          const cf = Math.max(0, (y + 0.02) / 0.38);
          y += Math.pow(cf, 1.15) * b * 0.44;
          z -= cf * b * 0.12;
          x *= 1.0 - cf * b * 0.62;
        }
      }

      // Subtle brow crest above eye sockets
      const browDist = Math.hypot(Math.abs(x) - 0.22, y - 0.14, z - 0.10);
      if (browDist < 0.16) {
        const lift = Math.cos((browDist / 0.16) * Math.PI * 0.5);
        y += lift * 0.04;
        x += Math.sign(x) * lift * 0.025;
      }

      pos.setXYZ(i, x, y, z);
    }
    geo.computeVertexNormals();
    return geo;
  }

  function createLimbGeo(rTop, rMid, rBot, len) {
    const pts = [
      new THREE.Vector2(rBot * 0.72, 0),
      new THREE.Vector2(rBot, len * 0.08),
      new THREE.Vector2(rMid * 0.94, len * 0.46),
      new THREE.Vector2(rMid, len * 0.72),
      new THREE.Vector2(rTop, len * 0.94),
      new THREE.Vector2(rTop * 0.75, len)
    ];
    const geo = new THREE.LatheGeometry(pts, 18);
    geo.translate(0, -len, 0);
    return geo;
  }

  let sharedNPCAssets = null;
  function getSharedNPCAssets() {
    if (sharedNPCAssets) return sharedNPCAssets;
    const headGeo = createSleekHeadGeometry();
    const vestPts = [
      new THREE.Vector2(0.29, 0.0),
      new THREE.Vector2(0.33, 0.14),
      new THREE.Vector2(0.37, 0.44),
      new THREE.Vector2(0.38, 0.68),
      new THREE.Vector2(0.26, 0.78)
    ];
    const vestGeo = new THREE.LatheGeometry(vestPts, 14);
    const lowerGeo = new THREE.SphereGeometry(0.29, 12, 10);
    const upperArmGeo = createLimbGeo(0.08, 0.07, 0.058, 0.40);
    const foreArmGeo = createLimbGeo(0.065, 0.056, 0.048, 0.38);
    const thighGeo = createLimbGeo(0.11, 0.092, 0.07, 0.44);
    const shinGeo = createLimbGeo(0.072, 0.06, 0.05, 0.42);
    const turretGeo = new THREE.CylinderGeometry(0.095, 0.155, 0.14, 12);
    const spiralGeo = new THREE.CircleGeometry(0.088, 16);
    const bowGeo = new THREE.BoxGeometry(0.20, 0.085, 0.055);
    const collarGeo = new THREE.CylinderGeometry(0.20, 0.24, 0.14, 12);
    const hemGeo = new THREE.TorusGeometry(0.305, 0.015, 6, 18);
    const tailCurlGeo = new THREE.TorusGeometry(0.24, 0.068, 8, 18, Math.PI * 1.65);
    const shadowGeo = new THREE.CircleGeometry(0.58, 14);

    const palettes = [
      { skin: 0x1d9a8f, stripe: 0x0f4c4c, belly: 0x6dd6c8, vest: 0x18153b, trim: 0x38bdf8, bow: 0xfacc15 },
      { skin: 0xc9427c, stripe: 0x6b153c, belly: 0xf29bc1, vest: 0x2a0c42, trim: 0xfacc15, bow: 0x22d3ee },
      { skin: 0xd48b22, stripe: 0x6e4109, belly: 0xf2d07e, vest: 0x241030, trim: 0x4ade80, bow: 0xf43f8e },
      { skin: 0x7352c9, stripe: 0x381f73, belly: 0xbba8f2, vest: 0x10172b, trim: 0xf43f8e, bow: 0xfacc15 },
      { skin: 0x38a169, stripe: 0x1c4532, belly: 0x9ae6b4, vest: 0x1b132b, trim: 0x22d3ee, bow: 0xf97316 },
      { skin: 0xe05252, stripe: 0x742a2a, belly: 0xfeb2b2, vest: 0x161229, trim: 0xa855f7, bow: 0x38bdf8 }
    ];

    const mats = palettes.map((p) => {
      const tex = createSmoothReptileTextures(p.skin, p.stripe, p.belly);
      return {
        skinMat: new THREE.MeshStandardMaterial({ map: tex.map, roughness: 0.52, metalness: 0.06 }),
        bellyMat: new THREE.MeshStandardMaterial({ color: p.belly, roughness: 0.58 }),
        vestMat: new THREE.MeshStandardMaterial({ color: p.vest, roughness: 0.72, metalness: 0.12 }),
        trimMat: new THREE.MeshStandardMaterial({ color: p.trim, emissive: new THREE.Color(p.trim), emissiveIntensity: 0.85 }),
        bowMat: new THREE.MeshStandardMaterial({ color: p.bow, roughness: 0.3 })
      };
    });

    sharedNPCAssets = {
      headGeo, vestGeo, lowerGeo, upperArmGeo, foreArmGeo, thighGeo, shinGeo,
      turretGeo, spiralGeo, bowGeo, collarGeo, hemGeo, tailCurlGeo, shadowGeo,
      shirtMat: new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 }),
      eyeIrisMat: new THREE.MeshStandardMaterial({ map: sharedIrisTex, roughness: 0.08 }),
      shadowMat: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false }),
      mats
    };
    return sharedNPCAssets;
  }

  function createLightNPC3D(opts = {}) {
    const A = getSharedNPCAssets();
    const M = A.mats[(opts.paletteIdx || 0) % A.mats.length];
    const root = new THREE.Group();

    const shadowDisc = new THREE.Mesh(A.shadowGeo, A.shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    root.add(shadowDisc);

    const hips = new THREE.Group();
    hips.position.y = 0.88;
    root.add(hips);

    const lowerBody = new THREE.Mesh(A.lowerGeo, M.bellyMat);
    lowerBody.scale.set(0.95, 0.85, 0.82);
    lowerBody.position.y = 0.06;
    hips.add(lowerBody);

    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.20;
    hips.add(torsoGroup);

    const vest = new THREE.Mesh(A.vestGeo, M.vestMat);
    vest.scale.set(1.02, 1.0, 0.82);
    torsoGroup.add(vest);

    const collar = new THREE.Mesh(A.collarGeo, A.shirtMat);
    collar.position.set(0, 0.78, 0.02);
    torsoGroup.add(collar);

    const hem = new THREE.Mesh(A.hemGeo, M.trimMat);
    hem.rotation.x = Math.PI / 2;
    hem.scale.set(1.03, 0.84, 1);
    hem.position.y = 0.02;
    torsoGroup.add(hem);

    const bow = new THREE.Mesh(A.bowGeo, M.bowMat);
    bow.position.set(0, 0.72, 0.31);
    torsoGroup.add(bow);

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.94, 0.03);
    torsoGroup.add(headGroup);

    const headMesh = new THREE.Mesh(A.headGeo, M.skinMat);
    headMesh.position.set(0, 0.20, 0.05);
    headGroup.add(headMesh);

    function makeNPCEye(side) {
      const eg = new THREE.Group();
      eg.position.set(side * 0.25, 0.26, 0.20);
      eg.rotation.y = side * 0.44;
      const turret = new THREE.Mesh(A.turretGeo, M.skinMat);
      turret.rotation.x = Math.PI / 2;
      eg.add(turret);
      const disc = new THREE.Mesh(A.spiralGeo, A.eyeIrisMat);
      disc.position.z = 0.085;
      eg.add(disc);
      eg.userData.spiralDisc = disc;
      return eg;
    }
    const eyeL = makeNPCEye(-1);
    const eyeR = makeNPCEye(1);
    headGroup.add(eyeL, eyeR);

    function makeNPCArm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.38, 0.64, 0);
      torsoGroup.add(shoulder);
      shoulder.add(new THREE.Mesh(A.upperArmGeo, M.skinMat));
      const elbow = new THREE.Group();
      elbow.position.y = -0.40;
      shoulder.add(elbow);
      elbow.add(new THREE.Mesh(A.foreArmGeo, M.skinMat));
      return { shoulder, elbow };
    }
    const armL = makeNPCArm(-1);
    const armR = makeNPCArm(1);

    function makeNPCLeg(side) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.22, 0.02, 0);
      hips.add(hip);
      hip.add(new THREE.Mesh(A.thighGeo, M.skinMat));
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      knee.add(new THREE.Mesh(A.shinGeo, M.skinMat));
      return { hip, knee };
    }
    const legL = makeNPCLeg(-1);
    const legR = makeNPCLeg(1);

    const tailGroup = new THREE.Group();
    tailGroup.position.set(-0.22, 0.04, -0.32);
    tailGroup.rotation.y = 0.65;
    const tailMesh = new THREE.Mesh(A.tailCurlGeo, M.skinMat);
    tailGroup.add(tailMesh);
    hips.add(tailGroup);

    const pose = {
      posX: opts.x || 0, posY: 0, posZ: opts.z || 0,
      rotX: 0, rotY: 0, rotZ: 0,
      torsoX: 0, torsoY: 0, torsoZ: 0,
      headX: 0, headY: 0, headZ: 0,
      armL_x: -0.15, armL_z: -0.48, elbowL_x: -0.65,
      armR_x: -0.15, armR_z: 0.48, elbowR_x: -0.65,
      legL_x: -0.08, legL_z: -0.16, kneeL_x: 0.18,
      legR_x: -0.08, legR_z: 0.16, kneeR_x: 0.18,
      tailCurl: 0.46, tailWag: 0,
      scaleY: 1.0, scaleXZ: 1.0
    };

    return {
      root, shadowDisc, hips, torsoGroup, headGroup, eyeL, eyeR,
      armL, armR, legL, legR, tailSegments: [tailGroup],
      skinMat: M.skinMat, trimMat: M.trimMat,
      pose,
      basePos: new THREE.Vector3(opts.x || 0, 0, opts.z || 0),
      activeMove: 0,
      moveTime: 0,
      moveDuration: 0.9,
      spinAccum: 0,
      spinTarget: 0,
      stumbleTime: 0,
      visibleTarget: 0,
      visibleCurrent: 0,
      isNPC: true,
      phaseOffset: opts.phaseOffset || 0
    };
  }

  function createChameleon3D(opts = {}) {
    const skinHex = opts.skin || 0x5d9d38;
    const stripeHex = opts.stripe || 0x264c16;
    const bellyHex = opts.belly || 0xb7cc74;
    const vestHex = opts.vest || 0x120d1f;
    const trimHex = opts.trim || 0xff2e97;
    const bowHex = opts.bow || 0xdc1e3c;
    const scale = opts.scale || 1.0;

    const tex = createSmoothReptileTextures(skinHex, stripeHex, bellyHex);

    const root = new THREE.Group();
    root.scale.setScalar(scale);

    const skinMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 0.012,
      roughness: 0.50,
      metalness: 0.06,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0
    });

    const eyelidMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 0.016,
      color: new THREE.Color(skinHex).offsetHSL(0.02, -0.04, 0.06),
      roughness: 0.48,
      metalness: 0.05
    });

    const bellyMat = new THREE.MeshStandardMaterial({
      map: tex.bellyMap,
      bumpMap: tex.bumpMap,
      bumpScale: 0.008,
      roughness: 0.58,
      metalness: 0.04
    });

    const vestMat = new THREE.MeshStandardMaterial({
      color: vestHex,
      roughness: 0.74,
      metalness: 0.10
    });

    const shirtMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.48,
      metalness: 0.05
    });

    const trimMat = new THREE.MeshStandardMaterial({
      color: trimHex,
      emissive: new THREE.Color(trimHex),
      emissiveIntensity: 0.9,
      roughness: 0.25
    });

    const bowMat = new THREE.MeshStandardMaterial({
      color: bowHex,
      roughness: 0.28,
      metalness: 0.16,
      emissive: new THREE.Color(bowHex),
      emissiveIntensity: 0
    });
    if (!opts.isNPC) heroBowMat = bowMat;

    const buttonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.18,
      metalness: 0.8
    });

    const clawMat = new THREE.MeshStandardMaterial({
      color: 0xd9ccb2,
      roughness: 0.35
    });

    const eyeIrisMat = new THREE.MeshStandardMaterial({
      map: sharedIrisTex,
      roughness: 0.06,
      metalness: 0.1
    });

    // Soft 3D Ground Contact Shadow Disc
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.48,
      depthWrite: false
    });
    const shadowDisc = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), shadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    root.add(shadowDisc);

    // Pelvis / Hips Pivot (clean tapered lower reptile body!)
    const hips = new THREE.Group();
    hips.position.y = 0.88;
    root.add(hips);

    const lowerBodyPts = [
      new THREE.Vector2(0.08, -0.14),
      new THREE.Vector2(0.24, -0.04),
      new THREE.Vector2(0.29, 0.10),
      new THREE.Vector2(0.30, 0.24)
    ];
    const lowerBody = new THREE.Mesh(new THREE.LatheGeometry(lowerBodyPts, 24), bellyMat);
    lowerBody.scale.set(0.96, 1.0, 0.86);
    hips.add(lowerBody);

    // Torso Group (BUILT CLEANLY AS THE TAILORED VEST — ZERO CLIPPING!)
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = 0.20;
    hips.add(torsoGroup);

    // Sculpted Tailored Suit Vest (tapered waist -> athletic chest -> clean shoulders)
    const vestPts = [
      new THREE.Vector2(0.29, 0.0),
      new THREE.Vector2(0.33, 0.14),
      new THREE.Vector2(0.37, 0.44),
      new THREE.Vector2(0.38, 0.68),
      new THREE.Vector2(0.26, 0.78)
    ];
    const vestMesh = new THREE.Mesh(new THREE.LatheGeometry(vestPts, 28), vestMat);
    vestMesh.scale.set(1.02, 1.0, 0.82);
    torsoGroup.add(vestMesh);

    // Crisp White Dress Shirt V-Front Inset (sits cleanly proud on upper chest!)
    const shirtShape = new THREE.Shape();
    shirtShape.moveTo(0, 0);
    shirtShape.lineTo(-0.19, 0.36);
    shirtShape.lineTo(0.19, 0.36);
    shirtShape.closePath();
    const shirtGeo = new THREE.ExtrudeGeometry(shirtShape, { depth: 0.04, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008 });
    const shirtPanel = new THREE.Mesh(shirtGeo, shirtMat);
    shirtPanel.position.set(0, 0.40, 0.295);
    shirtPanel.rotation.x = -0.10;
    torsoGroup.add(shirtPanel);

    // White Shirt Collar Neckband
    const neckCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.24, 0.11, 20), shirtMat);
    neckCollar.position.set(0, 0.78, 0.02);
    torsoGroup.add(neckCollar);

    // Glowing Neon Magenta V-Lapel Piping & Bottom Hem
    const lapelCurveL = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.20, 0.75, 0.22),
      new THREE.Vector3(-0.15, 0.56, 0.31),
      new THREE.Vector3(0.0, 0.38, 0.325)
    ]);
    const lapelCurveR = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.20, 0.75, 0.22),
      new THREE.Vector3(0.15, 0.56, 0.31),
      new THREE.Vector3(0.0, 0.38, 0.325)
    ]);
    torsoGroup.add(
      new THREE.Mesh(new THREE.TubeGeometry(lapelCurveL, 14, 0.015, 8, false), trimMat),
      new THREE.Mesh(new THREE.TubeGeometry(lapelCurveR, 14, 0.015, 8, false), trimMat)
    );

    // Center Vest Button Line & Hem Neon Piping
    const hemRing = new THREE.Mesh(new THREE.TorusGeometry(0.305, 0.014, 8, 32), trimMat);
    hemRing.rotation.x = Math.PI / 2;
    hemRing.scale.set(1.03, 0.84, 1);
    hemRing.position.set(0, 0.02, 0);
    torsoGroup.add(hemRing);

    // 3 Polished Vest Buttons
    for (let i = 0; i < 3; i++) {
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12), buttonMat);
      btn.rotation.x = Math.PI / 2;
      btn.position.set(0, 0.31 - i * 0.10, 0.308 - i * 0.01);
      torsoGroup.add(btn);
    }

    // Sculpted Satin Red Bow Tie
    const bowGroup = new THREE.Group();
    bowGroup.position.set(0, 0.72, 0.34);
    const bowKnot = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.068, 0.05), bowMat);
    const bowWingGeo = new THREE.ConeGeometry(0.088, 0.18, 10);
    bowWingGeo.scale(1, 1, 0.45);
    const bowWingL = new THREE.Mesh(bowWingGeo, bowMat);
    bowWingL.rotation.z = -Math.PI / 2;
    bowWingL.position.x = -0.09;
    const bowWingR = new THREE.Mesh(bowWingGeo, bowMat);
    bowWingR.rotation.z = Math.PI / 2;
    bowWingR.position.x = 0.09;
    bowGroup.add(bowKnot, bowWingL, bowWingR);
    torsoGroup.add(bowGroup);

    // Scaly Neck connecting Torso to Head
    const neckMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.20, 18), skinMat);
    neckMesh.position.set(0, 0.85, 0.02);
    torsoGroup.add(neckMesh);

    // Sleek Sculpted 3D Chameleon Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.94, 0.03);
    torsoGroup.add(headGroup);

    const headMesh = new THREE.Mesh(createSleekHeadGeometry(), skinMat);
    headMesh.position.set(0, 0.20, 0.05);
    headGroup.add(headMesh);

    // Casque Dorsal Ridge Spines
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.024 * (1 - t * 0.3), 0.065, 6), skinMat);
      sp.position.set(0, 0.56 - t * 0.16 + Math.sin(t * Math.PI) * 0.06, -0.01 - t * 0.34);
      sp.rotation.x = -0.35 - t * 0.45;
      headGroup.add(sp);
    }

    // Nostrils
    const nostrilMat = new THREE.MeshStandardMaterial({ color: 0x16290c, roughness: 0.9 });
    for (let side of [-1, 1]) {
      const nos = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), nostrilMat);
      nos.position.set(side * 0.095, 0.21, 0.47);
      headGroup.add(nos);
    }

    // Subtle Confident Smile Line (clean, slim, expressive)
    const mouthCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.20, 0.11, 0.30),
      new THREE.Vector3(-0.10, 0.075, 0.45),
      new THREE.Vector3(0, 0.088, 0.51),
      new THREE.Vector3(0.10, 0.075, 0.45),
      new THREE.Vector3(0.20, 0.11, 0.30)
    ]);
    headGroup.add(new THREE.Mesh(
      new THREE.TubeGeometry(mouthCurve, 20, 0.009, 8, false),
      new THREE.MeshStandardMaterial({ color: 0x1c3111, roughness: 0.85 })
    ));

    // Integrated Forward-Angled 3D Conical Chameleon Turret Eyes
    function make3DEye(side) {
      const eg = new THREE.Group();
      eg.position.set(side * 0.25, 0.26, 0.20);
      eg.rotation.y = side * 0.48; // angled forward so eyes look charismatic, NOT like sideways earmuffs!

      const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.16, 0.15, 22), eyelidMat);
      turret.rotation.x = Math.PI / 2;
      eg.add(turret);

      const lidRim = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.022, 10, 24), eyelidMat);
      lidRim.position.z = 0.072;
      eg.add(lidRim);

      const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(0.088, 20, 18), new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.12 }));
      eyeBall.position.z = 0.045;
      eg.add(eyeBall);

      // Front-facing curved swirl iris disc so the spiral is 100% sharp & spins continuously!
      const spiralDisc = new THREE.Mesh(new THREE.CircleGeometry(0.089, 28), eyeIrisMat);
      spiralDisc.position.z = 0.135;
      eg.add(spiralDisc);
      eg.userData.spiralDisc = spiralDisc;

      return eg;
    }
    const eyeL = make3DEye(-1);
    const eyeR = make3DEye(1);
    headGroup.add(eyeL, eyeR);

    // Well-Proportioned Articulated 3D Arms + Opposable Chameleon Hands
    function makeArm(side) {
      const shoulder = new THREE.Group();
      shoulder.position.set(side * 0.38, 0.64, 0.0);
      torsoGroup.add(shoulder);

      const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.088, 14, 12), skinMat);
      shoulder.add(deltoid);

      const upper = new THREE.Mesh(createLimbGeo(0.082, 0.072, 0.062, 0.40), skinMat);
      shoulder.add(upper);

      const elbow = new THREE.Group();
      elbow.position.y = -0.40;
      shoulder.add(elbow);

      elbow.add(new THREE.Mesh(new THREE.SphereGeometry(0.064, 12, 10), skinMat));
      elbow.add(new THREE.Mesh(createLimbGeo(0.068, 0.060, 0.048, 0.38), skinMat));

      const hand = new THREE.Group();
      hand.position.y = -0.39;
      elbow.add(hand);

      const palm = new THREE.Mesh(new THREE.SphereGeometry(0.064, 12, 10), skinMat);
      palm.scale.set(1.0, 0.78, 1.15);
      hand.add(palm);

      [
        { x: -0.045 * side, z: 0.045, rz: 0.32 * side },
        { x: 0.01 * side, z: 0.068, rz: -0.04 * side },
        { x: 0.052 * side, z: 0.032, rz: -0.38 * side }
      ].forEach((f) => {
        const dig = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.024, 0.11, 8), skinMat);
        dig.position.set(f.x, -0.055, f.z);
        dig.rotation.x = 0.5;
        dig.rotation.z = f.rz;
        hand.add(dig);

        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.036, 6), clawMat);
        claw.position.set(f.x, -0.105, f.z + 0.032);
        claw.rotation.x = 0.8;
        hand.add(claw);
      });

      return { shoulder, elbow };
    }
    const armL = makeArm(-1);
    const armR = makeArm(1);

    // Articulated 3D Legs + 3-Toed Reptilian Feet
    function makeLeg(side) {
      const hip = new THREE.Group();
      hip.position.set(side * 0.22, 0.02, 0);
      hips.add(hip);

      hip.add(new THREE.Mesh(createLimbGeo(0.115, 0.098, 0.074, 0.44), skinMat));

      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);

      knee.add(new THREE.Mesh(new THREE.SphereGeometry(0.074, 12, 10), skinMat));
      knee.add(new THREE.Mesh(createLimbGeo(0.076, 0.064, 0.052, 0.42), skinMat));

      const foot = new THREE.Group();
      foot.position.set(0, -0.42, 0.02);
      knee.add(foot);

      const ankle = new THREE.Mesh(new THREE.SphereGeometry(0.066, 12, 10), skinMat);
      ankle.scale.set(1.0, 0.65, 1.3);
      foot.add(ankle);

      [-0.065, 0, 0.065].forEach((tx, idx) => {
        const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.026, 0.16, 8), skinMat);
        toe.rotation.x = Math.PI / 2;
        toe.rotation.z = -tx * 3.4;
        toe.position.set(tx, -0.022, 0.10 + (idx === 1 ? 0.025 : 0));
        foot.add(toe);

        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.013, 0.04, 6), clawMat);
        claw.rotation.x = Math.PI / 2 + 0.18;
        claw.position.set(tx * 1.35, -0.026, 0.185 + (idx === 1 ? 0.025 : 0));
        foot.add(claw);
      });

      return { hip, knee };
    }
    const legL = makeLeg(-1);
    const legR = makeLeg(1);

    // Iconic 3D Curled Chameleon Tail curving visibly to the left-back side!
    const tailRoot = new THREE.Group();
    tailRoot.position.set(-0.08, -0.02, -0.22);
    tailRoot.rotation.y = 0.72; // angled visibly off to the side so you see the spiral from front AND during spins!
    hips.add(tailRoot);

    const tailSegments = [];
    let tailParent = tailRoot;
    const segCount = 16;
    for (let i = 0; i < segCount; i++) {
      const seg = new THREE.Group();
      const segLen = 0.145 - i * 0.0038;
      if (i > 0) seg.position.set(0, 0, -segLen);

      const r1 = Math.max(0.016, 0.115 * Math.pow(1 - i / (segCount + 1), 0.85));
      const r2 = Math.max(0.013, 0.115 * Math.pow(1 - (i + 1) / (segCount + 1), 0.85));
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, segLen * 1.22, 14), skinMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.z = -segLen * 0.5;
      seg.add(mesh);

      tailParent.add(seg);
      tailSegments.push(seg);
      tailParent = seg;
    }

    const pose = {
      posX: 0, posY: 0, posZ: 0,
      rotX: 0, rotY: 0, rotZ: 0,
      torsoX: 0, torsoY: 0, torsoZ: 0,
      headX: 0, headY: 0, headZ: 0,
      armL_x: -0.15, armL_z: -0.48, elbowL_x: -0.65,
      armR_x: -0.15, armR_z: 0.48, elbowR_x: -0.65,
      legL_x: -0.08, legL_z: -0.16, kneeL_x: 0.18,
      legR_x: -0.08, legR_z: 0.16, kneeR_x: 0.18,
      tailCurl: 0.46, tailWag: 0,
      scaleY: 1.0, scaleXZ: 1.0
    };

    return {
      root, shadowDisc, hips, torsoGroup, headGroup, eyeL, eyeR,
      armL, armR, legL, legR, tailSegments,
      skinMat, trimMat,
      pose,
      basePos: new THREE.Vector3(opts.x || 0, 0, opts.z || 0),
      activeMove: 0,
      moveTime: 0,
      moveDuration: 0.9,
      spinAccum: 0,
      spinTarget: 0,
      stumbleTime: 0,
      visibleTarget: opts.isNPC ? 0 : 1,
      visibleCurrent: opts.isNPC ? 0 : 1,
      isNPC: !!opts.isNPC,
      phaseOffset: opts.phaseOffset || 0
    };
  }

  function getTargetPose(cham, timeSec, beatPhase) {
    const bSin = Math.sin(beatPhase * Math.PI * 2 + cham.phaseOffset);
    const bBounce = Math.abs(Math.sin(beatPhase * Math.PI + cham.phaseOffset));

    // Expressive, wide, dance-ready idle groove
    const t = {
      posX: cham.basePos.x,
      posY: bBounce * 0.08,
      posZ: cham.basePos.z,
      rotX: 0,
      rotY: Math.sin(beatPhase * Math.PI) * 0.1,
      rotZ: bSin * 0.035,
      torsoX: 0.03 + bBounce * 0.04,
      torsoY: bSin * 0.12,
      torsoZ: -bSin * 0.055,
      headX: -0.04 + bBounce * 0.05,
      headY: -bSin * 0.12,
      headZ: bSin * 0.07,
      armL_x: -0.18 + bSin * 0.22,
      armL_z: -0.46 - bBounce * 0.14,
      elbowL_x: -0.62 - bBounce * 0.22,
      armR_x: -0.18 - bSin * 0.22,
      armR_z: 0.46 + bBounce * 0.14,
      elbowR_x: -0.62 - bBounce * 0.22,
      legL_x: -0.08 - bBounce * 0.12,
      legL_z: -0.15,
      kneeL_x: 0.18 + bBounce * 0.22,
      legR_x: -0.08 - bBounce * 0.12,
      legR_z: 0.15,
      kneeR_x: 0.18 + bBounce * 0.22,
      tailCurl: 0.48 + bBounce * 0.05,
      tailWag: bSin * 0.22,
      scaleY: 1.0 + bBounce * 0.025,
      scaleXZ: 1.0 - bBounce * 0.012
    };

    if (cham.stumbleTime > 0) {
      const s = cham.stumbleTime / 0.45;
      t.rotZ += Math.sin(s * Math.PI * 3) * 0.24;
      t.torsoX += 0.24 * s;
      t.headX += 0.2 * s;
      t.armL_z -= 0.6 * s;
      t.armR_z += 0.6 * s;
      return t;
    }

    if (cham.activeMove > 0 && cham.moveTime < cham.moveDuration) {
      const p = cham.moveTime / cham.moveDuration;
      const env = Math.sin(Math.min(1, p) * Math.PI);
      const holdEnv = p < 0.2 ? p / 0.2 : (p > 0.78 ? (1 - p) / 0.22 : 1.0);

      switch (cham.activeMove) {
        case 1: // 1: ポーズ (Sky-pointing disco pose!)
          t.posX += 0.14 * holdEnv;
          t.posY += 0.06 * holdEnv;
          t.rotY = -0.26 * holdEnv;
          t.torsoZ = -0.18 * holdEnv;
          t.headZ = 0.2 * holdEnv;
          t.headY = 0.24 * holdEnv;
          t.armR_x = -2.35 * holdEnv;
          t.armR_z = 0.45 * holdEnv;
          t.elbowR_x = -0.12 * holdEnv;
          t.armL_x = -0.25 * holdEnv;
          t.armL_z = -0.72 * holdEnv;
          t.elbowL_x = -1.15 * holdEnv;
          t.legL_z = -0.24 * holdEnv;
          t.legR_x = -0.18 * holdEnv;
          t.kneeR_x = 0.34 * holdEnv;
          t.tailCurl = 0.62;
          break;

        case 2: // 2: スピン (True 3D 360° pirouette spin!)
          t.posY += Math.sin(p * Math.PI) * 0.3;
          t.armL_z = -1.35 * env;
          t.armR_z = 1.35 * env;
          t.elbowL_x = -0.35;
          t.elbowR_x = -0.35;
          t.legL_x = -0.25 * env;
          t.kneeL_x = 0.55 * env;
          t.tailCurl = 0.32;
          t.tailWag = Math.sin(p * Math.PI * 4) * 0.45;
          break;

        case 3: { // 3: ステップ (Funky 3D footwork shuffle)
          const stepWave = Math.sin(p * Math.PI * 3);
          t.posX += stepWave * 0.55;
          t.posY += Math.abs(Math.sin(p * Math.PI * 3)) * 0.18;
          t.torsoZ = -stepWave * 0.22;
          t.torsoY = stepWave * 0.38;
          t.armL_x = -0.95 * stepWave;
          t.armR_x = 0.95 * stepWave;
          t.armL_z = -0.68;
          t.armR_z = 0.68;
          t.elbowL_x = -1.15;
          t.elbowR_x = -1.15;
          t.legL_x = stepWave * 0.58;
          t.legR_x = -stepWave * 0.58;
          t.kneeL_x = Math.max(0.12, -stepWave * 0.72);
          t.kneeR_x = Math.max(0.12, stepWave * 0.72);
          break;
        }

        case 4: { // 4: ウェーブ (Fluid 3D body wave)
          const w1 = Math.sin(p * Math.PI * 2.5);
          const w2 = Math.sin(p * Math.PI * 2.5 - 0.8);
          const w3 = Math.sin(p * Math.PI * 2.5 - 1.6);
          t.posX += w1 * 0.24;
          t.torsoZ = w2 * 0.28;
          t.torsoX = Math.cos(p * Math.PI * 2.5) * 0.22;
          t.headZ = w3 * 0.26;
          t.armL_z = -1.15 + w1 * 0.45;
          t.armR_z = 1.15 + w2 * 0.45;
          t.armL_x = -0.5 + w2 * 0.45;
          t.armR_x = -0.5 + w3 * 0.45;
          t.elbowL_x = -0.6 + w2 * 0.5;
          t.elbowR_x = -0.6 + w3 * 0.5;
          t.tailCurl = 0.36 + w3 * 0.2;
          t.tailWag = w2 * 0.55;
          break;
        }

        case 5: { // 5: ジャンプ (High 3D star jump!)
          let jumpY = 0;
          if (p < 0.18) {
            const c = p / 0.18;
            t.scaleY = 1 - 0.14 * c;
            t.scaleXZ = 1 + 0.12 * c;
            t.kneeL_x = 0.7 * c;
            t.kneeR_x = 0.7 * c;
            t.legL_x = -0.35 * c;
            t.legR_x = -0.35 * c;
          } else if (p < 0.82) {
            const air = (p - 0.18) / 0.64;
            jumpY = Math.sin(air * Math.PI) * 1.15;
            t.scaleY = 1 + Math.sin(air * Math.PI) * 0.1;
            t.scaleXZ = 1 - Math.sin(air * Math.PI) * 0.05;
            t.armL_z = -2.05 * Math.sin(air * Math.PI);
            t.armR_z = 2.05 * Math.sin(air * Math.PI);
            t.armL_x = -0.35;
            t.armR_x = -0.35;
            t.elbowL_x = -0.15;
            t.elbowR_x = -0.15;
            t.legL_z = -0.45 * Math.sin(air * Math.PI);
            t.legR_z = 0.45 * Math.sin(air * Math.PI);
            t.kneeL_x = 0.52 * Math.sin(air * Math.PI);
            t.kneeR_x = 0.52 * Math.sin(air * Math.PI);
          } else {
            const land = (p - 0.82) / 0.18;
            const sq = Math.sin(land * Math.PI);
            t.scaleY = 1 - 0.12 * sq;
            t.scaleXZ = 1 + 0.1 * sq;
            t.kneeL_x = 0.55 * sq;
            t.kneeR_x = 0.55 * sq;
          }
          t.posY += jumpY;
          t.tailCurl = 0.38;
          break;
        }

        case 6: // 6: フィニッシュ (Heroic 3D crouch point toward camera!)
          t.posY = -0.16 * holdEnv;
          t.posZ += 0.34 * holdEnv;
          t.rotY = -0.22 * holdEnv;
          t.torsoX = 0.18 * holdEnv;
          t.headX = -0.15 * holdEnv;
          t.headY = 0.22 * holdEnv;
          t.armR_x = -1.48 * holdEnv;
          t.armR_z = 0.22 * holdEnv;
          t.elbowR_x = -0.12 * holdEnv;
          t.armL_x = -0.35 * holdEnv;
          t.armL_z = -0.82 * holdEnv;
          t.elbowL_x = -0.85 * holdEnv;
          t.legL_x = -0.62 * holdEnv;
          t.kneeL_x = 1.05 * holdEnv;
          t.legR_x = 0.32 * holdEnv;
          t.kneeR_x = 0.65 * holdEnv;
          t.tailCurl = 0.66;
          break;
      }
    }
    return t;
  }

  function updateChameleon(cham, dt, timeSec, beatPhase, feverGlow) {
    const visAlpha = 1 - Math.exp(-8 * dt);
    cham.visibleCurrent += (cham.visibleTarget - cham.visibleCurrent) * visAlpha;
    cham.root.visible = cham.visibleCurrent > 0.02;
    if (!cham.root.visible && cham.isNPC) return;

    if (cham.stumbleTime > 0) cham.stumbleTime = Math.max(0, cham.stumbleTime - dt);
    if (cham.activeMove > 0) {
      cham.moveTime += dt;
      if (cham.moveTime >= cham.moveDuration) cham.activeMove = 0;
    }

    const spinAlpha = 1 - Math.exp(-9 * dt);
    cham.spinAccum += (cham.spinTarget - cham.spinAccum) * spinAlpha;

    const target = getTargetPose(cham, timeSec, beatPhase);
    // #38: Hero Dynamic Bounce (+20%) & #47: Back Dancer High Jump (+25%)
    if (!cham.isNPC && state.combo >= 38) {
      target.posY *= 1.22;
      target.torsoZ *= 1.25;
    }
    if (cham.isNPC && state.combo >= 47 && cham.activeMove === 5) {
      target.posY *= 1.25;
    }
    const blend = 1 - Math.exp(-13 * dt);
    const p = cham.pose;
    for (const k in target) {
      p[k] += (target[k] - p[k]) * blend;
    }

    const popY = cham.isNPC ? (1 - cham.visibleCurrent) * -1.4 : 0;
    cham.root.position.set(p.posX, p.posY + popY, p.posZ);
    cham.root.rotation.set(p.rotX, p.rotY + cham.spinAccum, p.rotZ);

    const baseScale = cham.isBaby ? 0.62 * cham.visibleCurrent : (cham.isNPC ? 0.72 * cham.visibleCurrent : 1.04);
    cham.root.scale.set(
      Math.max(0.001, baseScale * p.scaleXZ),
      Math.max(0.001, baseScale * p.scaleY),
      Math.max(0.001, baseScale * p.scaleXZ)
    );

    // Keep ground contact shadow locked on stage floor
    const lift = Math.max(0, p.posY);
    cham.shadowDisc.position.y = Math.max(0.015, 0.02 - p.posY);
    const shScale = Math.max(0.35, 1 - lift * 0.45);
    cham.shadowDisc.scale.set(shScale, shScale, 1);

    cham.torsoGroup.rotation.set(p.torsoX, p.torsoY, p.torsoZ);
    cham.headGroup.rotation.set(p.headX, p.headY, p.headZ);

    cham.armL.shoulder.rotation.set(p.armL_x, 0, p.armL_z);
    cham.armL.elbow.rotation.x = p.elbowL_x;
    cham.armR.shoulder.rotation.set(p.armR_x, 0, p.armR_z);
    cham.armR.elbow.rotation.x = p.elbowR_x;

    cham.legL.hip.rotation.set(p.legL_x, 0, p.legL_z);
    cham.legL.knee.rotation.x = p.kneeL_x;
    cham.legR.hip.rotation.set(p.legR_x, 0, p.legR_z);
    cham.legR.knee.rotation.x = p.kneeR_x;

    // Smooth 3D coiled spiral tail
    for (let i = 0; i < cham.tailSegments.length; i++) {
      const seg = cham.tailSegments[i];
      seg.rotation.x = p.tailCurl * (0.22 + i * 0.072);
      seg.rotation.y = p.tailWag * (0.14 + i * 0.035);
    }

    // #35 & #48: Expressive "ぐるぐる" swirling eyes + Turbo Spin at Combo 35 / 48!
    const turboBoost = (!cham.isNPC && state.combo >= 35) || (cham.isNPC && state.combo >= 48) ? 6.5 : 0;
    const spinSpeed = 4.2 + (cham.activeMove > 0 ? 5.0 : 0) + feverGlow * 4.5 + turboBoost;
    if (cham.eyeL.userData.spiralDisc) cham.eyeL.userData.spiralDisc.rotation.z -= dt * spinSpeed;
    if (cham.eyeR.userData.spiralDisc) cham.eyeR.userData.spiralDisc.rotation.z += dt * spinSpeed;
    cham.eyeL.rotation.y = -0.42 + Math.sin(timeSec * 1.9 + cham.phaseOffset) * 0.1;
    cham.eyeR.rotation.y = 0.42 + Math.sin(timeSec * 2.3 + cham.phaseOffset + 1.1) * 0.1;

    // #31 Hero Color Shift, #36 Rainbow Vest Piping, #39 Golden Sheen, #45 Back Dancer Color Change, #77 All-61 Rainbow Wave!
    if (!cham.isNPC) {
      if (state.combo >= 36 && cham.trimMat) {
        cham.trimMat.emissive.setHSL((timeSec * 0.65) % 1, 1.0, 0.55);
      }
      if (state.combo >= 39) {
        cham.skinMat.metalness = 0.42;
      } else {
        cham.skinMat.metalness = 0.06;
      }
      if (heroBowMat) {
        heroBowMat.emissiveIntensity = state.combo >= 34 ? (0.8 + Math.sin(timeSec * 10) * 0.35) : 0;
      }
    }
    const wantColorShift = (!cham.isNPC && state.combo >= 31) || (cham.isNPC && state.combo >= 45) || state.combo >= 77;
    if (wantColorShift || feverGlow > 0.05) {
      const hue = (timeSec * (state.combo >= 77 ? 0.65 : 0.35) + cham.phaseOffset) % 1;
      cham.skinMat.emissive.setHSL(hue, 0.95, 0.45);
      cham.skinMat.emissiveIntensity = state.combo >= 77 ? 0.55 : Math.max(0.26, feverGlow * 0.38);
    } else {
      cham.skinMat.emissiveIntensity *= Math.exp(-6 * dt);
    }
  }

  function triggerBreakTrick(bd, moveId, isFinale = false) {
    bd.activeTrick = moveId;
    bd.trickTime = 0;
    bd.trickDuration = isFinale ? 2.4 : (moveId === 5 ? 0.95 : 0.85);
  }

  function updateBreakdancer(bd, dt, timeSec, beatPhase) {
    const visAlpha = 1 - Math.exp(-8 * dt);
    bd.visibleCurrent += (bd.visibleTarget - bd.visibleCurrent) * visAlpha;
    const isVis = bd.visibleCurrent > 0.02;
    bd.root.visible = isVis;
    if (bd.spinRing) {
      bd.spinRing.visible = isVis;
      const trickPulse = bd.activeTrick > 0 ? 0.22 : 0.12;
      const rScale = bd.visibleCurrent * (1 + Math.abs(Math.sin(beatPhase * Math.PI)) * trickPulse);
      bd.spinRing.scale.set(rScale, rScale, 1);
    }
    if (!isVis) return;

    if (bd.activeTrick > 0) {
      bd.trickTime += dt;
      if (bd.trickTime >= bd.trickDuration) bd.activeTrick = 0;
    }

    const beatBounce = Math.abs(Math.sin(beatPhase * Math.PI * 2 + bd.phaseOffset));
    const bWave = Math.sin(timeSec * 8.5 + bd.phaseOffset * Math.PI * 2);
    const popY = (1 - bd.visibleCurrent) * -1.6;
    const sc = 0.88 * bd.visibleCurrent;
    bd.root.scale.set(sc, sc, sc);

    // Swirling eyes spin at hype speed!
    const eyeSpd = bd.activeTrick > 0 ? 15 : 9;
    if (bd.eyeL.userData.spiralDisc) bd.eyeL.userData.spiralDisc.rotation.z -= dt * eyeSpd;
    if (bd.eyeR.userData.spiralDisc) bd.eyeR.userData.spiralDisc.rotation.z += dt * eyeSpd;

    // Target Breakdance Transform (smoothly blended between idle b-boy groove & 6 button tricks!)
    let px = bd.basePos.x, py = 0.0, pz = bd.basePos.z;
    let rx = 0, ry = 0, rz = 0;
    let tx = 0, ty = 0, tz = 0;
    let aLx = -0.3, aLz = -0.65, eLx = -0.9;
    let aRx = -0.3, aRz = 0.65, eRx = -0.9;
    let lLx = -0.2, lLz = -0.25, kLx = 0.45;
    let lRx = -0.2, lRz = 0.25, kRx = 0.45;

    if (bd.activeTrick > 0) {
      const p = Math.min(1, bd.trickTime / bd.trickDuration);
      const env = Math.sin(p * Math.PI);
      const hold = p < 0.18 ? p / 0.18 : (p > 0.8 ? (1 - p) / 0.2 : 1.0);

      switch (bd.activeTrick) {
        case 1: // 1: ポーズ -> Baby Freeze (iconic angled b-boy floor freeze!)
          py = 0.92 * hold;
          rx = 0.65 * hold;
          ry = -0.45 * hold;
          rz = 1.92 * hold;
          aRx = -1.6 * hold; aRz = 0.9 * hold; eRx = -1.2 * hold;
          aLx = -2.2 * hold; aLz = -0.4 * hold; eLx = -0.25 * hold;
          lLx = -0.85 * hold; lLz = -0.55 * hold; kLx = 1.45 * hold;
          lRx = 0.35 * hold; lRz = 0.85 * hold; kRx = 0.25 * hold;
          break;

        case 2: // 2: スピン -> Turbo 720° Inverted Headspin!
          bd.breakSpin += dt * 15.5;
          py = 1.95 * hold + beatBounce * 0.12;
          rx = 0.08 * bWave;
          ry = bd.breakSpin;
          rz = Math.PI * hold;
          aLx = -0.2; aLz = -1.4; eLx = -0.35;
          aRx = -0.2; aRz = 1.4; eRx = -0.35;
          lLx = Math.sin(p * Math.PI * 4) * 0.45; lLz = -0.95; kLx = 0.25;
          lRx = -Math.sin(p * Math.PI * 4) * 0.45; lRz = 0.95; kRx = 0.25;
          break;

        case 3: { // 3: ステップ -> Fast 6-Step Circular Floorwork!
          const ang = p * Math.PI * 2;
          px = bd.basePos.x + Math.cos(ang) * 0.48;
          pz = bd.basePos.z + Math.sin(ang) * 0.48;
          py = 0.28 + Math.abs(Math.sin(p * Math.PI * 6)) * 0.18;
          rx = 0.55;
          ry = -ang + Math.PI * 0.5;
          aLx = -1.25; aLz = -0.45; eLx = -0.25;
          aRx = -0.85; aRz = 0.75; eRx = -0.65;
          lLx = Math.sin(p * Math.PI * 6) * 0.85; lLz = -0.42; kLx = 0.95;
          lRx = -Math.sin(p * Math.PI * 6) * 0.85; lRz = 0.42; kRx = 0.95;
          break;
        }

        case 4: { // 4: ウェーブ -> B-Boy Windmill Wave Roll!
          bd.breakSpin += dt * 9.5;
          px = bd.basePos.x + Math.cos(bd.breakSpin) * 0.28;
          pz = bd.basePos.z + Math.sin(bd.breakSpin) * 0.28;
          py = 1.12 + Math.sin(p * Math.PI * 3) * 0.22;
          rx = 1.92;
          ry = bd.breakSpin;
          rz = 0.45 + Math.sin(p * Math.PI * 3) * 0.35;
          aLx = -0.9; aLz = -1.55; eLx = -0.45;
          aRx = -0.9; aRz = 1.55; eRx = -0.45;
          lLx = Math.sin(bd.breakSpin * 2) * 0.75; lLz = -1.05; kLx = 0.2;
          lRx = -Math.sin(bd.breakSpin * 2) * 0.75; lRz = 1.05; kRx = 0.2;
          break;
        }

        case 5: { // 5: ジャンプ -> High-Flying 360° Airflare Flip!
          const arc = Math.sin(p * Math.PI);
          py = 0.35 + arc * 2.15;
          rx = p * Math.PI * 2;
          ry = p * Math.PI * 2;
          rz = Math.sin(p * Math.PI) * 0.65;
          aLx = -0.5; aLz = -2.1 * arc; eLx = -0.15;
          aRx = -0.5; aRz = 2.1 * arc; eRx = -0.15;
          lLx = -0.3; lLz = -0.95 * arc; kLx = 0.35;
          lRx = 0.3; lRz = 0.95 * arc; kRx = 0.35;
          break;
        }

        case 6: // 6: フィニッシュ -> Heroic One-Hand Vertical Air-Freeze!
          py = 2.08 * hold + beatBounce * 0.14;
          rx = 0.12 * hold;
          ry = Math.sin(timeSec * 3.0) * 0.55;
          rz = (Math.PI - 0.18) * hold;
          aRx = -2.95 * hold; aRz = 0.12; eRx = -0.08;
          aLx = -0.35; aLz = -1.75 * hold; eLx = -0.85;
          lLx = -0.45 * hold; lLz = -1.05 * hold; kLx = 0.85 * hold;
          lRx = 0.45 * hold; lRz = 0.95 * hold; kRx = 0.2;
          break;
      }
    } else {
      // Cool rhythmic B-Boy Top-Rock / Groove stance between tricks!
      const sw = Math.sin(beatPhase * Math.PI * 2 + bd.phaseOffset);
      px = bd.basePos.x + sw * 0.22;
      py = beatBounce * 0.16;
      rx = 0.16;
      ry = sw * 0.32;
      rz = -sw * 0.08;
      tz = sw * 0.16;
      aLx = -0.5 + sw * 0.55; aLz = -0.75; eLx = -1.05;
      aRx = -0.5 - sw * 0.55; aRz = 0.75; eRx = -1.05;
      lLx = -0.35 + sw * 0.35; lLz = -0.25; kLx = 0.65;
      lRx = -0.35 - sw * 0.35; lRz = 0.25; kRx = 0.65;
    }

    const ease = 1 - Math.exp(-15 * dt);
    bd.root.position.x += (px - bd.root.position.x) * ease;
    bd.root.position.y += ((py + popY) - bd.root.position.y) * ease;
    bd.root.position.z += (pz - bd.root.position.z) * ease;
    bd.root.rotation.x += (rx - bd.root.rotation.x) * ease;
    bd.root.rotation.y = (bd.activeTrick === 2 || bd.activeTrick === 4) ? ry : (bd.root.rotation.y + (ry - bd.root.rotation.y) * ease);
    bd.root.rotation.z += (rz - bd.root.rotation.z) * ease;

    bd.torsoGroup.rotation.set(tx, ty, tz);
    bd.armL.shoulder.rotation.set(aLx, 0, aLz);
    bd.armL.elbow.rotation.x = eLx;
    bd.armR.shoulder.rotation.set(aRx, 0, aRz);
    bd.armR.elbow.rotation.x = eRx;
    bd.legL.hip.rotation.set(lLx, 0, lLz);
    bd.legL.knee.rotation.x = kLx;
    bd.legR.hip.rotation.set(lRx, 0, lRz);
    bd.legR.knee.rotation.x = kRx;
    bd.shadowDisc.visible = false;
  }

  function triggerChameleonMove(cham, moveId, isFinale = false) {
    cham.activeMove = moveId;
    cham.moveTime = 0;
    cham.moveDuration = isFinale ? 2.6 : (moveId === 5 ? 0.95 : 0.85);
    if (moveId === 2) cham.spinTarget += Math.PI * 2;
  }

  function initThree() {
    renderer = new THREE.WebGLRenderer({ canvas: threeCanvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;

    sharedIrisTex = createEyeIrisTexture();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b061d);
    scene.fog = new THREE.FogExp2(0x0b061d, 0.017);

    camera = new THREE.PerspectiveCamera(44, 9 / 16, 0.1, 140);
    camera.position.set(0, 2.35, 7.6);
    camera.lookAt(0, 1.05, 0);

    // Cinematic 3-Point + Hemisphere Stage Lighting
    const hemiLight = new THREE.HemisphereLight(0xd8e8ff, 0x261144, 0.82);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff6e5, 1.35);
    keyLight.position.set(2.2, 6.5, 5.8);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.55);
    fillLight.position.set(-3.2, 3.2, 4.2);
    scene.add(fillLight);

    rimLightLeft = new THREE.PointLight(0x22d3ee, 2.2, 16);
    rimLightLeft.position.set(-3.8, 3.6, 1.2);
    scene.add(rimLightLeft);

    rimLightRight = new THREE.PointLight(0xf43f8e, 2.2, 16);
    rimLightRight.position.set(3.8, 3.6, 1.2);
    scene.add(rimLightRight);

    // Grand Mega-Arena Circular Dance Stage Floor (fits Hero + 55 Back Dancers!)
    const stageGeo = new THREE.CylinderGeometry(15.2, 16.4, 0.5, 64);
    const stageMat = new THREE.MeshStandardMaterial({ color: 0x171036, roughness: 0.24, metalness: 0.66 });
    const stageMesh = new THREE.Mesh(stageGeo, stageMat);
    stageMesh.position.set(0, -0.25, -0.8);
    scene.add(stageMesh);

    // Concentric Neon Stage Rings expanding across the entire arena
    const ringColors = [0x22d3ee, 0xf43f8e, 0xa855f7, 0xfacc15, 0x38bdf8, 0xf43f8e];
    [1.35, 2.6, 4.4, 6.8, 10.0, 14.2].forEach((r, idx) => {
      const rm = new THREE.MeshBasicMaterial({ color: ringColors[idx % ringColors.length], transparent: true, opacity: 0.72 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.06, 8, 72), rm);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.018, idx < 2 ? 0 : -2.8);
      scene.add(ring);
      floorRings.push(ring);
    });

    // Radial Equalizer Bars behind the stage
    const eqCount = 16;
    for (let i = 0; i < eqCount; i++) {
      const angle = Math.PI * 0.15 + (i / (eqCount - 1)) * Math.PI * 0.7;
      const barMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(i / eqCount, 0.9, 0.6),
        transparent: true,
        opacity: 0.78
      });
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1, 0.12), barMat);
      bar.position.set(Math.cos(angle) * 3.85, 0.5, -Math.sin(angle) * 3.1 - 0.4);
      bar.lookAt(0, 0.5, 0);
      scene.add(bar);
      eqBars.push(bar);
    }

    // Retro Arcade Cabinets
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x161130, roughness: 0.48, metalness: 0.42 });
    const screenColors = [0x22d3ee, 0xf43f8e, 0xfacc15, 0xa855f7];
    for (let side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        const cab = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.3, 0.85), cabMat);
        body.position.y = 1.15;
        cab.add(body);

        const scrMat = new THREE.MeshBasicMaterial({ color: screenColors[(i + (side > 0 ? 1 : 0)) % 4] });
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.62), scrMat);
        scr.position.set(0, 1.48, 0.435);
        cab.add(scr);
        arcadeScreens.push(scrMat);

        const marquee = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.22), scrMat);
        marquee.position.set(0, 2.08, 0.435);
        cab.add(marquee);

        cab.position.set(side * (3.15 + i * 0.35), 0, -1.6 + i * 1.45);
        cab.rotation.y = -side * (Math.PI * 0.38);
        scene.add(cab);
        arcadeCabinets.push(cab);
      }
    }

    // Overhead Volumetric Spotlights
    const spotColors = [0x22d3ee, 0xf43f8e, 0xa855f7, 0x38bdf8, 0xfacc15, 0xf43f8e];
    for (let i = 0; i < 6; i++) {
      const coneGeo = new THREE.ConeGeometry(1.45, 7.2, 20, 1, true);
      coneGeo.translate(0, -3.6, 0);
      const coneMat = new THREE.MeshBasicMaterial({
        color: spotColors[i],
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(-2.5 + i * 1.0, 5.8, -1.4);
      scene.add(cone);
      spotCones.push({ mesh: cone, baseRotZ: (i - 2.5) * 0.14, speed: 0.8 + i * 0.15 });
    }

    // Laser beams (Combo >= 5)
    for (let i = 0; i < 4; i++) {
      const lGeo = new THREE.CylinderGeometry(0.025, 0.025, 9, 8);
      const lMat = new THREE.MeshBasicMaterial({
        color: i % 2 === 0 ? 0x22d3ee : 0xf43f8e,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending
      });
      const beam = new THREE.Mesh(lGeo, lMat);
      beam.position.set((i < 2 ? -4.5 : 4.5), 5.8, -10.5);
      scene.add(beam);
      laserBeams.push(beam);
    }

    // Disco Ball (Combo >= 10)
    discoBallGroup = new THREE.Group();
    discoBallGroup.position.set(0, 6.6, -0.3);
    const rod = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 2.2, 8),
      new THREE.MeshBasicMaterial({ color: 0xe2e8f0 })
    );
    rod.position.y = 1.1;
    discoBallGroup.add(rod);
    const ball = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.56, 2),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        metalness: 0.92,
        roughness: 0.1,
        flatShading: true,
        emissive: 0x38bdf8,
        emissiveIntensity: 0.25
      })
    );
    discoBallGroup.add(ball);
    scene.add(discoBallGroup);

    // #7: 2 Dramatic Diagonal Stadium Searchlights
    for (let i = 0; i < 2; i++) {
      const sGeo = new THREE.ConeGeometry(2.2, 16, 16, 1, true);
      sGeo.translate(0, -8, 0);
      const sMat = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x38bdf8 : 0xfacc15,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const sl = new THREE.Mesh(sGeo, sMat);
      sl.position.set(i === 0 ? -7.5 : 7.5, 10.5, -7.5);
      scene.add(sl);
      searchlights.push(sl);
    }

    // #12: 2 Floating Neon 3D Torus Hoops positioned high above the arena (never blocking view!)
    [0x22d3ee, 0xf43f8e].forEach((col, i) => {
      const hMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.32 });
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(4.8 + i * 1.6, 0.055, 10, 56), hMat);
      hoop.rotation.x = Math.PI / 2;
      hoop.position.set(0, 6.2 + i * 1.2, -4.5);
      hoop.visible = false;
      scene.add(hoop);
      floatingHoops.push(hoop);
    });

    // #13: 3D Hologram Starfield (220 rising sparkling points)
    const sfCount = 220;
    const sfPos = new Float32Array(sfCount * 3);
    for (let i = 0; i < sfCount; i++) {
      sfPos[i * 3] = (Math.random() - 0.5) * 26;
      sfPos[i * 3 + 1] = Math.random() * 14;
      sfPos[i * 3 + 2] = (Math.random() - 0.5) * 22 - 3;
    }
    const sfGeo = new THREE.BufferGeometry();
    sfGeo.setAttribute('position', new THREE.BufferAttribute(sfPos, 3));
    starField = new THREE.Points(sfGeo, new THREE.PointsMaterial({
      color: 0xfef08a,
      size: 0.18,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    starField.visible = false;
    scene.add(starField);

    // #16: 6 Glowing Neon Crystal Pillars around the outer arena perimeter
    const pilGeo = new THREE.OctahedronGeometry(0.65, 0);
    pilGeo.scale(0.8, 3.2, 0.8);
    for (let i = 0; i < 6; i++) {
      const ang = -Math.PI * 0.82 + (i / 5) * Math.PI * 0.64;
      const pMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(i / 6, 0.9, 0.55),
        emissive: new THREE.Color().setHSL(i / 6, 0.9, 0.4),
        emissiveIntensity: 0.7,
        transparent: true,
        opacity: 0.78,
        roughness: 0.15
      });
      const pil = new THREE.Mesh(pilGeo, pMat);
      pil.position.set(Math.sin(ang) * 11.2, 1.8, -Math.cos(ang) * 11.2 - 1.5);
      pil.visible = false;
      scene.add(pil);
      crystalPillars.push(pil);
    }

    // #17: Orbiting Golden 3D Star Ring above the dancers
    orbitStarsGroup = new THREE.Group();
    orbitStarsGroup.position.set(0, 5.4, -2.2);
    const stGeo = new THREE.OctahedronGeometry(0.28, 0);
    const stMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const st = new THREE.Mesh(stGeo, stMat);
      st.position.set(Math.cos(a) * 5.2, Math.sin(i * 1.3) * 0.4, Math.sin(a) * 5.2);
      orbitStarsGroup.add(st);
    }
    orbitStarsGroup.visible = false;
    scene.add(orbitStarsGroup);

    // #18: Cyber-Disco Radial Neon Floor Grid Lines
    floorGridGroup = new THREE.Group();
    const gridMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.38 });
    for (let i = 0; i < 12; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 28), gridMat);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = (i / 12) * Math.PI;
      line.position.set(0, 0.012, -2.6);
      floorGridGroup.add(line);
    }
    floorGridGroup.visible = false;
    scene.add(floorGridGroup);

    // #20: Giant Rotating 3D Golden Neon Crown above the arena!
    megaCrown = new THREE.Group();
    megaCrown.position.set(0, 6.2, -2.4);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.65,
      metalness: 0.85,
      roughness: 0.2
    });
    const crownBand = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.14, 10, 28), crownMat);
    crownBand.rotation.x = Math.PI / 2;
    megaCrown.add(crownBand);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.85, 6), crownMat);
      spike.position.set(Math.cos(a) * 1.12, 0.45, Math.sin(a) * 1.12);
      megaCrown.add(spike);
    }
    megaCrown.visible = false;
    scene.add(megaCrown);

    // #32 & #33: Hero Neon Foot Aura & Golden Hero Spotlight
    heroFootRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.055, 8, 36),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.9 })
    );
    heroFootRing.rotation.x = Math.PI / 2;
    heroFootRing.position.set(0, 0.03, 0.18);
    heroFootRing.visible = false;
    scene.add(heroFootRing);

    heroSpotLight = new THREE.PointLight(0xfde047, 0, 12);
    heroSpotLight.position.set(0, 4.2, 1.8);
    scene.add(heroSpotLight);

    // #67: 3D Expanding Arena Floor Shockwave Ring (triggers on PERFECT!)
    arenaShockRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.0, 0.09, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0, blending: THREE.AdditiveBlending })
    );
    arenaShockRing.rotation.x = Math.PI / 2;
    arenaShockRing.position.set(0, 0.05, 0);
    scene.add(arenaShockRing);

    // #76: Giant Golden Plasma Floor Rim Ring encircling the entire arena flat on the stage edge (never crosses camera!)
    plasmaHaloRing = new THREE.Mesh(
      new THREE.TorusGeometry(13.8, 0.12, 10, 72),
      new THREE.MeshBasicMaterial({ color: 0xfde047, transparent: true, opacity: 0.55 })
    );
    plasmaHaloRing.rotation.x = Math.PI / 2;
    plasmaHaloRing.position.set(0, 0.08, -1.0);
    plasmaHaloRing.visible = false;
    scene.add(plasmaHaloRing);

    // Main Full 3D Volumetric Hero Chameleon
    mainChameleon = createChameleon3D({
      skin: 0x5d9d38,
      stripe: 0x264c16,
      belly: 0x7ea844,
      vest: 0x120d1f,
      trim: 0xff2e97,
      bow: 0xdc1e3c,
      scale: 1.04,
      x: 0,
      z: 0.18
    });
    // #40: Hero Superstar Radiant Neon Wings behind the Hero's vest!
    heroWingsGroup = new THREE.Group();
    heroWingsGroup.position.set(0, 0.56, -0.34);
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    for (let side of [-1, 1]) {
      for (let f = 0; f < 3; f++) {
        const feather = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.15 - f * 0.2, 4), wingMat);
        feather.position.set(side * (0.45 + f * 0.16), 0.18 - f * 0.22, -0.05);
        feather.rotation.z = -side * (1.1 + f * 0.28);
        heroWingsGroup.add(feather);
      }
    }
    heroWingsGroup.visible = false;
    mainChameleon.torsoGroup.add(heroWingsGroup);

    scene.add(mainChameleon.root);

    // 55 Full 3D NPC Back Dancers in a tight, high-impact concert formation (2nd & 3rd right beside the Hero!)
    // 4 + 8 + 11 + 14 + 18 = 55 dancers
    const rowSpecs = [
      { count: 4, radius: 1.55, arc: 2.15, zOff: -0.10 },
      { count: 8, radius: 2.95, arc: 2.25, zOff: -0.35 },
      { count: 11, radius: 4.45, arc: 2.30, zOff: -0.55 },
      { count: 14, radius: 6.05, arc: 2.35, zOff: -0.75 },
      { count: 18, radius: 7.75, arc: 2.40, zOff: -0.95 }
    ];
    const slots = [];
    rowSpecs.forEach((row, rIdx) => {
      for (let i = 0; i < row.count; i++) {
        const frac = row.count === 1 ? 0.5 : i / (row.count - 1);
        const ang = (frac - 0.5) * row.arc;
        const x = Math.sin(ang) * row.radius;
        const z = -Math.cos(ang) * row.radius + row.zOff;
        // Prioritize inner front pair right next to hero first!
        const orderScore = rIdx * 10 + Math.abs(frac - 0.5) * 4;
        slots.push({ x, z, orderScore });
      }
    });
    slots.sort((a, b) => a.orderScore - b.orderScore);
    slots.forEach((slot, idx) => {
      const npc = createLightNPC3D({
        x: slot.x,
        z: slot.z,
        paletteIdx: idx,
        phaseOffset: (idx % 8) * 0.125
      });
      npc.root.visible = false;
      scene.add(npc.root);
      backDancers.push(npc);
    });

    // 5 Adorable Foreground 3D Baby Chameleons filling the lower foreground right above the buttons!
    const babySpecs = [
      { x: -1.35, z: 2.05, wideX: -2.3, wideZ: 6.4, paletteIdx: 4 },
      { x:  1.35, z: 2.05, wideX:  2.3, wideZ: 6.4, paletteIdx: 1 },
      { x:  0.00, z: 2.35, wideX:  0.0, wideZ: 7.0, paletteIdx: 2 },
      { x: -2.35, z: 1.80, wideX: -4.4, wideZ: 5.8, paletteIdx: 0 },
      { x:  2.35, z: 1.80, wideX:  4.4, wideZ: 5.8, paletteIdx: 3 }
    ];
    babySpecs.forEach((cfg, idx) => {
      const baby = createLightNPC3D({
        x: cfg.x,
        z: cfg.z,
        paletteIdx: cfg.paletteIdx,
        phaseOffset: idx * 0.18
      });
      baby.isBaby = true;
      baby.nearPos = new THREE.Vector3(cfg.x, 0, cfg.z);
      baby.widePos = new THREE.Vector3(cfg.wideX, 0, cfg.wideZ);
      // Cute chibi baby proportions: bigger expressive head!
      baby.headGroup.scale.setScalar(1.34);
      baby.root.visible = false;
      scene.add(baby.root);
      babyChameleons.push(baby);
    });

    // 5 Foreground 3D Breakdancing Chameleons (unlock 1-by-1 at Combo 56..60 in front of the baby chameleons!)
    const breakSpecs = [
      { x: 0.0,  z: 4.45, style: 'headspin', paletteIdx: 2, ringColor: 0xfacc15 },
      { x: -2.6, z: 4.05, style: 'windmill', paletteIdx: 0, ringColor: 0x22d3ee },
      { x: 2.6,  z: 4.05, style: 'handhop',  paletteIdx: 1, ringColor: 0xf43f8e },
      { x: -5.0, z: 3.35, style: 'windmill', paletteIdx: 3, ringColor: 0xa855f7 },
      { x: 5.0,  z: 3.35, style: 'headspin', paletteIdx: 5, ringColor: 0xf97316 }
    ];
    breakSpecs.forEach((cfg, idx) => {
      const bd = createLightNPC3D({
        x: cfg.x,
        z: cfg.z,
        paletteIdx: cfg.paletteIdx,
        phaseOffset: idx * 0.2
      });
      bd.breakStyle = cfg.style;
      bd.breakSpin = 0;
      bd.activeTrick = 0;
      bd.trickTime = 0;
      bd.trickDuration = 0.85;

      // Glowing b-boy floor spin ring right under each breakdancer!
      const ringMat = new THREE.MeshBasicMaterial({
        color: cfg.ringColor,
        transparent: true,
        opacity: 0.85
      });
      const spinRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.045, 8, 32), ringMat);
      spinRing.rotation.x = Math.PI / 2;
      spinRing.position.set(cfg.x, 0.03, cfg.z);
      spinRing.visible = false;
      scene.add(spinRing);
      bd.spinRing = spinRing;

      bd.root.visible = false;
      scene.add(bd.root);
      breakDancers.push(bd);
    });
  }

  // =========================================================
  // 6. 2D OVERLAY VFX (RHYTHM HIGHWAY, PARTICLES, POPUPS)
  // =========================================================
  const particles = [];
  const shockwaves = [];
  const popups = [];
  let screenFlash = { alpha: 0, color: '#ffffff' };

  function pushParticle(pt) {
    if (particles.length >= 260) particles.shift();
    particles.push(pt);
  }

  function spawnBurst(x, y, color, intensity = 1, style = 'stars') {
    const count = Math.floor(18 * intensity);
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = (110 + Math.random() * 240) * (0.75 + intensity * 0.35);
      const rainbow = intensity >= 1.45;
      const pColor = rainbow ? `hsl(${Math.floor(Math.random() * 360)}, 95%, 64%)` : color;
      pushParticle({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (style === 'firework' ? 120 : 60),
        size: (style === 'confetti' ? 7 : 5) + Math.random() * 6 * intensity,
        color: pColor,
        life: 0,
        maxLife: 0.55 + Math.random() * 0.45,
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 10,
        shape: style === 'confetti' ? 'rect' : (style === 'wave' ? 'ring' : (style === 'heart' ? 'heart' : (style === 'coin' ? 'coin' : 'star')))
      });
    }
    shockwaves.push({
      x, y,
      radius: 16,
      maxRadius: 95 + intensity * 75,
      color,
      life: 0,
      maxLife: 0.42
    });
  }

  function spawnFireworks(count = 3) {
    const w = fxCanvas.width / (window.devicePixelRatio || 1);
    const h = fxCanvas.height / (window.devicePixelRatio || 1);
    for (let i = 0; i < count; i++) {
      const fx = w * (0.2 + Math.random() * 0.6);
      const fy = h * (0.18 + Math.random() * 0.28);
      const col = `hsl(${Math.floor(Math.random() * 360)}, 95%, 62%)`;
      spawnBurst(fx, fy, col, 1.6, 'firework');
      spawnBurst(fx, fy, '#facc15', 1.2, 'confetti');
    }
  }

  function spawnPopup(text, subText, color, scale = 1.0) {
    const w = fxCanvas.width / (window.devicePixelRatio || 1);
    const h = fxCanvas.height / (window.devicePixelRatio || 1);
    popups.push({
      x: w * 0.5,
      y: h * 0.30,
      text,
      subText,
      color,
      scale,
      life: 0,
      maxLife: 0.95
    });
  }

  let calloutTimer = null;
  function showCallout(text) {
    if (!text) return;
    calloutBannerEl.textContent = text;
    calloutBannerEl.classList.add('show');
    if (calloutTimer) clearTimeout(calloutTimer);
    calloutTimer = setTimeout(() => {
      calloutBannerEl.classList.remove('show');
    }, 1200);
  }

  function drawStar(ctx, x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const a2 = a1 + Math.PI / 5;
      if (i === 0) ctx.moveTo(Math.cos(a1) * r, Math.sin(a1) * r);
      else ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      ctx.lineTo(Math.cos(a2) * r * 0.46, Math.sin(a2) * r * 0.46);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // =========================================================
  // 7. GAME STATE & JUDGMENTS
  // =========================================================
  const state = {
    mode: 'title',
    songTime: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    stageTier: 0,
    counts: { PERFECT: 0, GREAT: 0, OK: 0, MISS: 0 },
    notes: [],
    judgedCount: 0,
    hiScore: loadHiScore(),
    lastFrameTime: 0,
    rafId: null,
    cameraShake: 0,
    feverConfettiTimer: 0,
    ambientFxTimer: 0,
    fireworkTimer: 0,
    speedLineAlpha: 0
  };

  titleHiScoreEl.textContent = `ハイスコア: ${state.hiScore.toLocaleString()}`;

  function updateStageTier() {
    const activeNPCs = Math.min(backDancers.length, state.combo);
    const activeBreakers = Math.min(breakDancers.length, Math.max(0, state.combo - 55));
    let newTier = 0;
    if (state.combo >= 25) newTier = 3;
    else if (state.combo >= 10) newTier = 2;
    else if (state.combo >= 3) newTier = 1;

    if (newTier > state.stageTier) {
      playStageUpSFX();
      if (newTier === 1) {
        showCallout('仲間がダンスに加わった！');
        spawnFireworks(2);
      } else if (newTier === 2) {
        showCallout('ミラーボール降臨！大編成ライブ！');
        spawnFireworks(3);
      } else if (newTier === 3) {
        showCallout('🌈 FEVER MAX!! 超巨大カメレオン軍団！');
        spawnFireworks(5);
      }
    } else if (state.combo === 55) {
      playStageUpSFX();
      showCallout('👑 バックダンサー勢ぞろい！');
      spawnFireworks(6);
    } else if (state.combo === 56) {
      playStageUpSFX();
      showCallout('🔥 ブレイクダンス隊 乱入！！');
      spawnFireworks(4);
    } else if (state.combo === 50) {
      playStageUpSFX();
      showCallout('🎆 50コンボ達成！黄金ファンファーレ！');
      spawnFireworks(7);
    } else if (state.combo === 60) {
      playStageUpSFX();
      showCallout('🏆 ブレイクダンス隊が勢ぞろい！');
      spawnFireworks(7);
    } else if (state.combo === 70) {
      playStageUpSFX();
      showCallout('🌟 70コンボ！ウルトラ・スーパーノヴァ！');
      screenFlash = { alpha: 0.5, color: '#ffffff' };
      spawnFireworks(8);
    } else if (state.combo === 80) {
      playStageUpSFX();
      showCallout('👑 80コンボ！伝説のステージへ！');
      screenFlash = { alpha: 0.65, color: '#fde047' };
      spawnFireworks(12);
    } else if (state.combo > 80 && state.combo % 20 === 0) {
      playStageUpSFX();
      showCallout(`🌟 ${state.combo} COMBO!! SUPER LEGEND!!`);
      screenFlash = { alpha: 0.45, color: '#fde047' };
      spawnFireworks(10);
    }
    state.stageTier = newTier;

    // #8 Edge Glow, #53 Golden Crown Scoreboard, #54 Flame Combo, #78 Final Countdown Aura
    shellEl.classList.toggle('edge-glow', state.combo >= 8 && state.combo < 78);
    shellEl.classList.toggle('final-aura', state.combo >= 78);
    scoreBoxEl.classList.toggle('gold-crown', state.combo >= 53);
    comboBadgeEl.classList.toggle('flame', state.combo >= 54);

    for (let i = 0; i < backDancers.length; i++) {
      backDancers[i].visibleTarget = i < activeNPCs ? 1 : 0;
    }
    for (let i = 0; i < breakDancers.length; i++) {
      breakDancers[i].visibleTarget = i < activeBreakers ? 1 : 0;
    }
    // Unlock 5 adorable Baby Chameleons early in the foreground (1st at Combo 1, all 5 by Combo 9!)
    const activeBabies = state.mode === 'playing' ? Math.min(babyChameleons.length, state.combo >= 1 ? Math.floor((state.combo + 1) / 2) : 0) : 2;
    for (let i = 0; i < babyChameleons.length; i++) {
      babyChameleons[i].visibleTarget = i < activeBabies ? 1 : 0;
    }
  }

  function updateHUD() {
    const clamped = Math.min(SONG_DURATION, Math.max(0, state.songTime));
    timeValEl.textContent = `${fmtTime(clamped)} / ${fmtTime(SONG_DURATION)}`;
    notesValEl.textContent = `${state.judgedCount} / ${ACTIVE_CHART.length}`;
    scoreValEl.textContent = state.score.toLocaleString();
    progressFillEl.style.width = `${(clamped / SONG_DURATION) * 100}%`;

    if (state.combo >= 2) {
      comboBadgeEl.textContent = `${state.combo} COMBO!`;
      comboBadgeEl.classList.toggle('fever', state.combo >= 10);
    } else if (state.mode === 'playing') {
      comboBadgeEl.textContent = 'KEEP GROOVING';
      comboBadgeEl.classList.remove('fever');
    } else {
      comboBadgeEl.textContent = 'READY';
      comboBadgeEl.classList.remove('fever');
    }
  }

  let isStartingGame = false;
  async function startGame() {
    if (isStartingGame) return;
    const song = getActiveSong();
    if (song.mode === 'embedded_audio' && !song.audioBuffer) {
      isStartingGame = true;
      const prevLabel = startBtn.textContent;
      startBtn.textContent = '曲を準備中…';
      try {
        await ensureSongAudioReady(song);
      } catch (e) {
        showCallout('曲を読み込めませんでした');
      }
      startBtn.textContent = prevLabel;
      isStartingGame = false;
    }
    state.mode = 'playing';
    state.songTime = 0;
    state.score = 0;
    state.combo = 0;
    state.maxCombo = 0;
    state.stageTier = 0;
    state.counts = { PERFECT: 0, GREAT: 0, OK: 0, MISS: 0 };
    state.judgedCount = 0;
    SONG_DURATION = song.duration;
    BPM = song.bpm;
    BEAT_SEC = 60 / BPM;
    ACTIVE_CHART = song.chart;
    rebuildStepMap();
    state.notes = ACTIVE_CHART.map((n, idx) => ({
      id: idx,
      time: n.time,
      move: n.move,
      cue: n.cue || '',
      isFinale: !!n.isFinale,
      judged: false,
      cueShown: false
    }));
    particles.length = 0;
    shockwaves.length = 0;
    popups.length = 0;

    titleOverlayEl.classList.add('hidden');
    resultOverlayEl.classList.add('hidden');

    updateStageTier();
    updateHUD();
    startMusic();
    showCallout('はい！はい！いくよ！');
  }

  function finishGame() {
    state.mode = 'result';
    stopMusic();
    if (state.score > state.hiScore) {
      state.hiScore = state.score;
      saveHiScore(state.hiScore);
    }

    const acc = (state.counts.PERFECT * 1.0 + state.counts.GREAT * 0.7 + state.counts.OK * 0.4) / Math.max(1, ACTIVE_CHART.length);
    let rank = 'C';
    let comment = 'ナイスチャレンジ！リズムをつかんで再挑戦しよう！';
    if (acc >= 0.92 && state.counts.MISS === 0) {
      rank = 'S+';
      comment = '完全成功！伝説のレインボー・カメレオンダンサー！';
    } else if (acc >= 0.84) {
      rank = 'S';
      comment = 'キレッキレの完璧なステージ！会場が熱狂してるよ！';
    } else if (acc >= 0.68) {
      rank = 'A';
      comment = 'ノリノリの好演！フルコンボまであと少し！';
    } else if (acc >= 0.5) {
      rank = 'B';
      comment = 'いいグルーヴ！タイミングを合わせるともっと派手になるよ！';
    }

    resRankEl.textContent = rank;
    resCommentEl.textContent = comment;
    resScoreEl.textContent = state.score.toLocaleString();
    resComboEl.textContent = String(state.maxCombo);
    resPerfEl.textContent = String(state.counts.PERFECT);
    resGreatEl.textContent = String(state.counts.GREAT);
    resOkEl.textContent = String(state.counts.OK);
    resMissEl.textContent = String(state.counts.MISS);
    resHiScoreEl.textContent = `ハイスコア: ${state.hiScore.toLocaleString()}`;
    titleHiScoreEl.textContent = `ハイスコア: ${state.hiScore.toLocaleString()}`;

    resultOverlayEl.classList.remove('hidden');
    spawnFireworks(4);
  }

  function applyJudgment(note, grade, wrongBtn = false) {
    note.judged = true;
    state.judgedCount++;
    state.counts[grade]++;

    const w = fxCanvas.width / (window.devicePixelRatio || 1);
    const h = fxCanvas.height / (window.devicePixelRatio || 1);
    const targetBtn = buttonTargets[note.move - 1] || { x: w * 0.5, y: h * 0.88 };
    const judgeX = targetBtn.x;
    const judgeY = targetBtn.y;
    const moveInfo = MOVES[note.move];

    if (grade === 'MISS') {
      state.combo = 0;
      mainChameleon.stumbleTime = 0.45;
      playHitSFX('MISS');
      spawnPopup(wrongBtn ? 'WRONG!' : 'MISS', wrongBtn ? 'ちがうボタン！' : 'タイミングずれ', '#fb7185', 0.9);
    } else {
      state.combo++;
      if (state.combo > state.maxCombo) state.maxCombo = state.combo;

      const basePts = grade === 'PERFECT' ? 100 : (grade === 'GREAT' ? 70 : 40);
      const comboBonus = Math.min(100, state.combo * 8);
      const finaleBonus = note.isFinale && grade === 'PERFECT' ? 250 : 0;
      state.score += basePts + comboBonus + finaleBonus;

      triggerChameleonMove(mainChameleon, note.move, note.isFinale);
      backDancers.forEach((npc, idx) => {
        if (npc.visibleTarget > 0) {
          if (state.combo >= 42) {
            // #42: Stadium wave delayed synchronization from center outward!
            setTimeout(() => triggerChameleonMove(npc, note.move, note.isFinale), Math.min(180, (idx % 12) * 14));
          } else {
            triggerChameleonMove(npc, note.move, note.isFinale);
          }
        }
      });
      // Sync all active foreground Baby Chameleons & Breakdancers to the exact button move!
      babyChameleons.forEach((baby) => {
        if (baby.visibleTarget > 0) triggerChameleonMove(baby, note.move, note.isFinale);
      });
      breakDancers.forEach((bd) => {
        if (bd.visibleTarget > 0) triggerBreakTrick(bd, note.move, note.isFinale);
      });
      // #52: Button deck neon ripple
      if (state.combo >= 52) {
        controlsBarEl.classList.add('deck-ripple');
        setTimeout(() => controlsBarEl.classList.remove('deck-ripple'), 160);
      }

      playHitSFX(grade, note.isFinale);

      const style = note.move === 4 ? 'wave' : (note.move === 6 ? 'firework' : 'stars');
      if (grade === 'PERFECT') {
        const intense = note.isFinale ? 2.2 : (1.5 + state.stageTier * 0.18);
        spawnBurst(judgeX, judgeY, moveInfo.color, intense, style);
        spawnBurst(w * 0.5, h * 0.45, moveInfo.color, intense * 0.9, 'confetti');
        if (state.combo >= 26) spawnBurst(judgeX, judgeY - 30, '#f43f8e', 0.85, 'heart');
        if (state.combo >= 28) spawnBurst(w * 0.5, h * 0.28, '#facc15', 0.9, 'coin');
        if (state.combo >= 29) {
          shockwaves.push({ x: judgeX, y: judgeY, radius: 10, maxRadius: 210, color: '#22d3ee', life: 0, maxLife: 0.5 });
          shockwaves.push({ x: judgeX, y: judgeY, radius: 24, maxRadius: 260, color: '#f43f8e', life: 0, maxLife: 0.62 });
        }
        if (state.combo >= 64) state.speedLineAlpha = 0.85;
        if (state.combo >= 67) arenaShockLife = 0;
        screenFlash = { alpha: note.isFinale ? 0.45 : (state.combo >= 49 ? 0.26 : 0.18), color: moveInfo.color };
        if (state.combo >= 63) {
          // #63: Perfect Prism Flash (zero-motion-sickness radial prism glint!)
          spawnBurst(judgeX, judgeY, '#ffffff', 1.25, 'stars');
        }
        const perfCol = state.combo >= 59 ? 'RAINBOW' : '#fde047';
        if (note.isFinale) {
          spawnFireworks(8);
          spawnPopup('MARVELOUS PERFECT!', '完全成功！', perfCol, 1.25);
        } else {
          spawnPopup('PERFECT!', moveInfo.short + ' キマった！', perfCol, 1.12);
        }
      } else if (grade === 'GREAT') {
        spawnBurst(judgeX, judgeY, moveInfo.color, 1.05, style);
        screenFlash = { alpha: 0.11, color: moveInfo.color };
        spawnPopup('GREAT!', moveInfo.short, '#38bdf8', 1.0);
      } else {
        spawnBurst(judgeX, judgeY, moveInfo.color, 0.6, 'stars');
        spawnPopup('OK', moveInfo.short, '#4ade80', 0.9);
      }
    }

    updateStageTier();
    updateHUD();
  }

  function handleButtonPress(moveId) {
    const btn = danceButtons[moveId - 1];
    if (btn) {
      btn.classList.add('active');
      setTimeout(() => btn.classList.remove('active'), 130);
    }

    if (state.mode !== 'playing') {
      ensureAudio();
      triggerChameleonMove(mainChameleon, moveId, false);
      return;
    }

    let targetNote = null;
    let bestDiff = Infinity;
    for (const n of state.notes) {
      if (n.judged) continue;
      const diff = Math.abs(state.songTime - n.time);
      if (diff <= WIN_WRONG_LOCK && diff < bestDiff) {
        bestDiff = diff;
        targetNote = n;
      }
    }

    if (!targetNote) {
      triggerChameleonMove(mainChameleon, moveId, false);
      return;
    }

    if (targetNote.move !== moveId) {
      applyJudgment(targetNote, 'MISS', true);
      return;
    }

    if (bestDiff <= WIN_PERFECT) applyJudgment(targetNote, 'PERFECT');
    else if (bestDiff <= WIN_GREAT) applyJudgment(targetNote, 'GREAT');
    else if (bestDiff <= WIN_OK) applyJudgment(targetNote, 'OK');
    else applyJudgment(targetNote, 'MISS');
  }

  // =========================================================
  // 8. RENDERING 2D RHYTHM HIGHWAY & VFX
  // =========================================================
  function draw2DOverlay(dt, beatPhase) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = fxCanvas.width / dpr;
    const h = fxCanvas.height / dpr;

    fxCtx.save();
    fxCtx.scale(dpr, dpr);
    fxCtx.clearRect(0, 0, w, h);

    const combo = state.mode === 'playing' ? state.combo : 0;
    const tNow = state.mode === 'playing' ? state.songTime : performance.now() * 0.001;
    const beatKick = Math.pow(1 - beatPhase, 2.5);

    // #74: Galaxy Nebula Cosmic Backdrop Bloom
    if (combo >= 74) {
      const neb = fxCtx.createRadialGradient(w * 0.5, h * 0.25, 10, w * 0.5, h * 0.3, w * 0.72);
      neb.addColorStop(0, `hsla(${(tNow * 35) % 360}, 90%, 60%, 0.22)`);
      neb.addColorStop(0.5, 'rgba(139, 92, 246, 0.14)');
      neb.addColorStop(1, 'rgba(0,0,0,0)');
      fxCtx.fillStyle = neb;
      fxCtx.fillRect(0, 0, w, h * 0.65);
    }

    // #19: Shimmering Aurora Sky Curtain
    if (combo >= 19) {
      fxCtx.save();
      for (let band = 0; band < 2; band++) {
        const grad = fxCtx.createLinearGradient(0, h * 0.06, w, h * 0.26);
        grad.addColorStop(0, `hsla(${(tNow * 45 + band * 120) % 360}, 95%, 62%, 0.18)`);
        grad.addColorStop(0.5, `hsla(${(tNow * 45 + 90 + band * 120) % 360}, 95%, 62%, 0.24)`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        fxCtx.fillStyle = grad;
        fxCtx.beginPath();
        fxCtx.moveTo(0, h * 0.08);
        for (let x = 0; x <= w; x += 24) {
          const y = h * (0.14 + band * 0.05) + Math.sin(x * 0.015 + tNow * 2.2 + band) * 18;
          fxCtx.lineTo(x, y);
        }
        fxCtx.lineTo(w, h * 0.30);
        fxCtx.lineTo(0, h * 0.30);
        fxCtx.closePath();
        fxCtx.fill();
      }
      fxCtx.restore();
    }

    // #9: Subtle non-obstructive neon halo behind upper horizon (no blinding white rays!)

    // #10 & #66: Disco Ball Sparkling Dots & Cross Lens Flare
    if (combo >= 10) {
      fxCtx.save();
      for (let i = 0; i < 16; i++) {
        const sx = ((Math.sin(tNow * 0.9 + i * 2.1) * 0.45 + 0.5) * w);
        const sy = ((Math.cos(tNow * 0.7 + i * 1.7) * 0.24 + 0.30) * h);
        fxCtx.fillStyle = `hsla(${(i * 40 + tNow * 80) % 360}, 100%, 80%, ${0.35 + beatKick * 0.45})`;
        fxCtx.beginPath();
        fxCtx.arc(sx, sy, 2.5 + (i % 3), 0, Math.PI * 2);
        fxCtx.fill();
      }
      if (combo >= 66) {
        const lx = w * 0.5;
        const ly = h * 0.17;
        fxCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        fxCtx.lineWidth = 2.5;
        const fl = 26 + beatKick * 28;
        fxCtx.beginPath();
        fxCtx.moveTo(lx - fl, ly); fxCtx.lineTo(lx + fl, ly);
        fxCtx.moveTo(lx, ly - fl); fxCtx.lineTo(lx, ly + fl);
        fxCtx.stroke();
      }
      fxCtx.restore();
    }

    // #69: Dual Flowing Rainbow Sky Ribbons
    if (combo >= 69) {
      fxCtx.save();
      for (let r = 0; r < 2; r++) {
        fxCtx.strokeStyle = `hsla(${(tNow * 110 + r * 180) % 360}, 95%, 65%, 0.55)`;
        fxCtx.lineWidth = 5;
        fxCtx.beginPath();
        for (let x = 0; x <= w; x += 18) {
          const y = h * (0.20 + r * 0.06) + Math.sin(x * 0.02 + tNow * 4 + r * 2) * 20;
          if (x === 0) fxCtx.moveTo(x, y); else fxCtx.lineTo(x, y);
        }
        fxCtx.stroke();
      }
      fxCtx.restore();
    }

    // #41: Audience Glowstick Wave along Left & Right Lower Edges
    if (combo >= 41) {
      fxCtx.save();
      for (let side of [-1, 1]) {
        for (let i = 0; i < 6; i++) {
          const gx = side < 0 ? (10 + i * 11) : (w - 10 - i * 11);
          const gy = h * 0.72 + (i % 2) * 10;
          const sway = Math.sin(tNow * 6.5 + i * 0.7 + side) * 0.45;
          fxCtx.save();
          fxCtx.translate(gx, gy);
          fxCtx.rotate(sway);
          fxCtx.strokeStyle = `hsl(${(i * 55 + tNow * 80) % 360}, 95%, 62%)`;
          fxCtx.lineWidth = 4;
          fxCtx.lineCap = 'round';
          fxCtx.beginPath();
          fxCtx.moveTo(0, 0);
          fxCtx.lineTo(0, -24);
          fxCtx.stroke();
          fxCtx.restore();
        }
      }
      fxCtx.restore();
    }

    // #58: Rhythmic Beat Vignette Pulse & #61: Beat Neon Edge Ripple (zero motion sickness!)
    if (combo >= 58 && beatKick > 0.15) {
      const vig = fxCtx.createRadialGradient(w * 0.5, h * 0.5, w * 0.3, w * 0.5, h * 0.5, w * 0.78);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `hsla(${(tNow * 90) % 360}, 95%, 55%, ${beatKick * 0.28})`);
      fxCtx.fillStyle = vig;
      fxCtx.fillRect(0, 0, w, h);
    }
    if (combo >= 61 && beatKick > 0.2) {
      fxCtx.save();
      fxCtx.strokeStyle = `hsla(${(tNow * 140) % 360}, 100%, 68%, ${beatKick * 0.75})`;
      fxCtx.lineWidth = 4 + beatKick * 6;
      fxCtx.strokeRect(4, 4, w - 8, h - 8);
      fxCtx.restore();
    }
    // #62: Clean neon horizon shimmer along very top edge (never covers characters!)
    if (combo >= 62) {
      fxCtx.save();
      const topG = fxCtx.createLinearGradient(0, 0, w, 0);
      topG.addColorStop(0, `hsla(${(tNow * 90) % 360}, 95%, 55%, 0.22)`);
      topG.addColorStop(0.5, `hsla(${(tNow * 90 + 120) % 360}, 95%, 55%, 0.22)`);
      topG.addColorStop(1, `hsla(${(tNow * 90 + 240) % 360}, 95%, 55%, 0.22)`);
      fxCtx.fillStyle = topG;
      fxCtx.fillRect(0, 0, w, 6);
      fxCtx.restore();
    }

    // #64: Anime-Style Neon Radial Speed Lines on PERFECT hits!
    if (state.speedLineAlpha > 0.02) {
      fxCtx.save();
      fxCtx.translate(w * 0.5, h * 0.5);
      fxCtx.strokeStyle = `rgba(254, 240, 138, ${state.speedLineAlpha * 0.65})`;
      fxCtx.lineWidth = 2.5;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2 + tNow;
        fxCtx.beginPath();
        fxCtx.moveTo(Math.cos(a) * w * 0.32, Math.sin(a) * h * 0.32);
        fxCtx.lineTo(Math.cos(a) * w * 0.75, Math.sin(a) * h * 0.75);
        fxCtx.stroke();
      }
      fxCtx.restore();
      state.speedLineAlpha *= Math.exp(-7 * dt);
    }

    if (state.mode === 'playing' && buttonTargets.length === 6) {
      const cx = w * 0.5;
      const laneTopY = h * 0.56;
      const topSpanW = w * 0.34; // perspective vanishing width at the back of the stage

      // Draw 6 perspective lanes leading from depth directly to each of the 6 button orbs!
      for (let i = 0; i < 6; i++) {
        const bt = buttonTargets[i];
        const topX = cx + ((i - 2.5) / 5) * topSpanW;
        const moveInfo = MOVES[i + 1];

        const lGrad = fxCtx.createLinearGradient(topX, laneTopY, bt.x, bt.y);
        if (combo >= 51) {
          const hShift = (tNow * 120 + i * 55) % 360;
          lGrad.addColorStop(0, `hsla(${hShift}, 95%, 65%, 0.08)`);
          lGrad.addColorStop(0.55, `hsla(${(hShift + 60) % 360}, 95%, 62%, 0.36)`);
          lGrad.addColorStop(1, `hsla(${(hShift + 120) % 360}, 95%, 65%, 0.72)`);
        } else {
          lGrad.addColorStop(0, 'rgba(255, 255, 255, 0.02)');
          lGrad.addColorStop(0.55, moveInfo.color + '26');
          lGrad.addColorStop(1, moveInfo.color + '66');
        }

        fxCtx.strokeStyle = lGrad;
        fxCtx.lineWidth = 3;
        fxCtx.beginPath();
        fxCtx.moveTo(topX, laneTopY);
        fxCtx.lineTo(bt.x, bt.y);
        fxCtx.stroke();

        // Subtle target guide halo around each button orb
        fxCtx.save();
        fxCtx.strokeStyle = moveInfo.color;
        fxCtx.globalAlpha = 0.32 + Math.sin(beatPhase * Math.PI * 2) * 0.1;
        fxCtx.lineWidth = 2;
        fxCtx.beginPath();
        fxCtx.arc(bt.x, bt.y, bt.r + 3, 0, Math.PI * 2);
        fxCtx.stroke();
        fxCtx.restore();
      }

      // Scrolling beat-grid lines locked directly to BEAT_PHASE & exact song BPM!
      const firstBeat = Math.ceil((state.songTime - BEAT_PHASE) / BEAT_SEC);
      const lastBeat = Math.floor((state.songTime + LEAD_TIME - BEAT_PHASE) / BEAT_SEC);
      const leftBotX = buttonTargets[0].x - buttonTargets[0].r;
      const rightBotX = buttonTargets[5].x + buttonTargets[5].r;
      const botY = buttonTargets[0].y;
      for (let b = firstBeat; b <= lastBeat; b++) {
        const bTime = BEAT_PHASE + b * BEAT_SEC;
        const dtB = bTime - state.songTime;
        const rawP = 1 - dtB / LEAD_TIME;
        if (rawP < 0 || rawP > 1) continue;
        const prog = rawP;
        const by = laneTopY + (botY - laneTopY) * prog;
        const halfW = (topSpanW * 0.55) + ((rightBotX - leftBotX) * 0.5 - topSpanW * 0.55) * prog;
        const isBarLine = b % 4 === 0;
        fxCtx.strokeStyle = isBarLine ? 'rgba(250, 204, 21, 0.35)' : 'rgba(255, 255, 255, 0.14)';
        fxCtx.lineWidth = isBarLine ? 2.2 : 1.2;
        fxCtx.beginPath();
        fxCtx.moveTo(cx - halfW, by);
        fxCtx.lineTo(cx + halfW, by);
        fxCtx.stroke();
      }

      let nextPromptMove = 0;
      for (const n of state.notes) {
        if (n.judged) continue;
        const dtNote = n.time - state.songTime;
        if (dtNote > LEAD_TIME || dtNote < -WIN_OK) continue;

        if (dtNote < 0.7 && nextPromptMove === 0) nextPromptMove = n.move;

        const laneIdx = n.move - 1;
        const bt = buttonTargets[laneIdx];
        const topX = cx + ((laneIdx - 2.5) / 5) * topSpanW;

        // Crisp linear approach (0 = spawn in back -> 1 = exact overlap on button orb!)
        const rawProg = 1 - dtNote / LEAD_TIME;
        const prog = Math.max(0, rawProg);
        const nx = topX + (bt.x - topX) * prog;
        const ny = laneTopY + (bt.y - laneTopY) * prog;
        const radius = Math.max(10, bt.r * (0.34 + 0.68 * Math.min(1.06, prog)));
        const moveInfo = MOVES[n.move];

        fxCtx.save();

        // Converging timing ring right around the destination button as note approaches!
        if (rawProg > 0.55) {
          const shrink = Math.max(0.95, 1 + (1 - rawProg) * 2.1);
          fxCtx.beginPath();
          fxCtx.arc(bt.x, bt.y, bt.r * shrink, 0, Math.PI * 2);
          fxCtx.strokeStyle = rawProg > 0.92 ? '#fde047' : moveInfo.color;
          fxCtx.globalAlpha = Math.min(0.95, (rawProg - 0.55) * 2.4);
          fxCtx.lineWidth = rawProg > 0.92 ? 4.5 : 3;
          fxCtx.stroke();
        }

        // #57: Note Star Comet Trail behind approaching notes
        if (combo >= 57 && rawProg > 0.15) {
          const tailX = topX + (bt.x - topX) * Math.max(0, prog - 0.14);
          const tailY = laneTopY + (bt.y - laneTopY) * Math.max(0, prog - 0.14);
          const tg = fxCtx.createLinearGradient(tailX, tailY, nx, ny);
          tg.addColorStop(0, 'rgba(255,255,255,0)');
          tg.addColorStop(1, moveInfo.color);
          fxCtx.strokeStyle = tg;
          fxCtx.lineWidth = radius * 0.85;
          fxCtx.lineCap = 'round';
          fxCtx.beginPath();
          fxCtx.moveTo(tailX, tailY);
          fxCtx.lineTo(nx, ny);
          fxCtx.stroke();
        }

        // Approaching Glowing Button Note Orb
        fxCtx.shadowColor = moveInfo.color;
        fxCtx.shadowBlur = 16;
        const orbGrad = fxCtx.createRadialGradient(nx - radius * 0.3, ny - radius * 0.3, 2, nx, ny, radius);
        orbGrad.addColorStop(0, '#ffffff');
        orbGrad.addColorStop(0.38, moveInfo.color);
        orbGrad.addColorStop(1, '#0b071c');
        fxCtx.fillStyle = orbGrad;
        fxCtx.beginPath();
        fxCtx.arc(nx, ny, radius, 0, Math.PI * 2);
        fxCtx.fill();

        fxCtx.lineWidth = 2.6;
        fxCtx.strokeStyle = rawProg > 0.92 ? '#fde047' : '#ffffff';
        fxCtx.stroke();

        // Crisp button number inside note
        fxCtx.shadowBlur = 0;
        fxCtx.fillStyle = '#ffffff';
        fxCtx.font = `900 ${Math.round(radius * 0.95)}px Inter, sans-serif`;
        fxCtx.textAlign = 'center';
        fxCtx.textBaseline = 'middle';
        fxCtx.fillText(String(n.move), nx, ny + 1);
        fxCtx.restore();
      }

      danceButtons.forEach((btn, idx) => {
        btn.classList.toggle('prompt', idx + 1 === nextPromptMove);
      });
    } else {
      danceButtons.forEach((btn) => btn.classList.remove('prompt'));
    }

    if (screenFlash.alpha > 0.005) {
      fxCtx.fillStyle = screenFlash.color;
      fxCtx.globalAlpha = screenFlash.alpha;
      fxCtx.fillRect(0, 0, w, h);
      fxCtx.globalAlpha = 1;
      screenFlash.alpha *= Math.exp(-9 * dt);
    }

    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i];
      sw.life += dt;
      if (sw.life >= sw.maxLife) {
        shockwaves.splice(i, 1);
        continue;
      }
      const t = sw.life / sw.maxLife;
      const r = sw.radius + (sw.maxRadius - sw.radius) * (1 - Math.pow(1 - t, 3));
      fxCtx.save();
      fxCtx.strokeStyle = sw.color;
      fxCtx.globalAlpha = 1 - t;
      fxCtx.lineWidth = 4 * (1 - t) + 1;
      fxCtx.beginPath();
      fxCtx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      fxCtx.stroke();
      fxCtx.restore();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      pt.life += dt;
      if (pt.life >= pt.maxLife) {
        particles.splice(i, 1);
        continue;
      }
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 320 * dt;
      pt.rot += pt.vrot * dt;
      const alpha = 1 - pt.life / pt.maxLife;

      fxCtx.save();
      fxCtx.globalAlpha = alpha;
      if (pt.shape === 'star') {
        drawStar(fxCtx, pt.x, pt.y, pt.size, pt.color, pt.rot);
      } else if (pt.shape === 'ring' || pt.shape === 'bubble') {
        fxCtx.strokeStyle = pt.color;
        fxCtx.lineWidth = pt.shape === 'bubble' ? 1.8 : 2.5;
        fxCtx.beginPath();
        fxCtx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        fxCtx.stroke();
        if (pt.shape === 'bubble') {
          fxCtx.fillStyle = 'rgba(255,255,255,0.22)';
          fxCtx.fill();
        }
      } else if (pt.shape === 'heart') {
        fxCtx.fillStyle = pt.color;
        fxCtx.font = `900 ${Math.round(pt.size * 2.1)}px sans-serif`;
        fxCtx.textAlign = 'center';
        fxCtx.fillText('♥', pt.x, pt.y);
      } else if (pt.shape === 'note') {
        fxCtx.fillStyle = pt.color;
        fxCtx.font = `900 ${Math.round(pt.size * 2.4)}px sans-serif`;
        fxCtx.textAlign = 'center';
        fxCtx.fillText(pt.rot > 0 ? '♪' : '♫', pt.x, pt.y);
      } else if (pt.shape === 'coin') {
        fxCtx.save();
        fxCtx.translate(pt.x, pt.y);
        fxCtx.scale(Math.cos(pt.rot), 1);
        fxCtx.fillStyle = '#facc15';
        fxCtx.beginPath();
        fxCtx.arc(0, 0, pt.size, 0, Math.PI * 2);
        fxCtx.fill();
        fxCtx.strokeStyle = '#fffbeb';
        fxCtx.lineWidth = 2;
        fxCtx.stroke();
        fxCtx.restore();
      } else if (pt.shape === 'meteor') {
        fxCtx.strokeStyle = pt.color;
        fxCtx.lineWidth = 3;
        fxCtx.beginPath();
        fxCtx.moveTo(pt.x, pt.y);
        fxCtx.lineTo(pt.x - pt.vx * 0.12, pt.y - pt.vy * 0.12);
        fxCtx.stroke();
      } else {
        fxCtx.translate(pt.x, pt.y);
        fxCtx.rotate(pt.rot);
        fxCtx.fillStyle = pt.color;
        fxCtx.fillRect(-pt.size * 0.6, -pt.size * 0.35, pt.size * 1.2, pt.size * 0.7);
      }
      fxCtx.restore();
    }

    for (let i = popups.length - 1; i >= 0; i--) {
      const pop = popups[i];
      pop.life += dt;
      if (pop.life >= pop.maxLife) {
        popups.splice(i, 1);
        continue;
      }
      const t = pop.life / pop.maxLife;
      const bounce = t < 0.18 ? (0.6 + (t / 0.18) * 0.55) : (1.15 - Math.min(0.15, (t - 0.18) * 0.6));
      const alpha = t > 0.7 ? (1 - (t - 0.7) / 0.3) : 1;

      fxCtx.save();
      fxCtx.translate(pop.x, pop.y - t * 36);
      fxCtx.scale(pop.scale * bounce, pop.scale * bounce);
      fxCtx.globalAlpha = Math.max(0, alpha);
      fxCtx.textAlign = 'center';
      fxCtx.textBaseline = 'middle';

      fxCtx.font = '900 32px Inter, sans-serif';
      fxCtx.lineWidth = 6;
      fxCtx.strokeStyle = '#0b071c';
      fxCtx.strokeText(pop.text, 0, 0);
      if (pop.color === 'RAINBOW') {
        const rg = fxCtx.createLinearGradient(-110, 0, 110, 0);
        rg.addColorStop(0, '#67e8f9');
        rg.addColorStop(0.33, '#fde047');
        rg.addColorStop(0.66, '#f472b6');
        rg.addColorStop(1, '#a855f7');
        fxCtx.fillStyle = rg;
      } else {
        fxCtx.fillStyle = pop.color;
      }
      fxCtx.fillText(pop.text, 0, 0);

      if (pop.subText) {
        fxCtx.font = '800 14px "Hiragino Kaku Gothic ProN", sans-serif';
        fxCtx.lineWidth = 4;
        fxCtx.strokeText(pop.subText, 0, 26);
        fxCtx.fillStyle = '#ffffff';
        fxCtx.fillText(pop.subText, 0, 26);
      }
      fxCtx.restore();
    }

    fxCtx.restore();
  }

  // =========================================================
  // 9. MAIN ANIMATION LOOP & RESIZE
  // =========================================================
  function resize() {
    const rect = shellEl.getBoundingClientRect();
    const w = Math.max(240, Math.floor(rect.width));
    const h = Math.max(360, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (renderer && camera) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    fxCanvas.width = Math.floor(w * dpr);
    fxCanvas.height = Math.floor(h * dpr);
    updateButtonTargets();
  }

  function animate(nowMs) {
    state.rafId = requestAnimationFrame(animate);
    const now = nowMs * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, now - (state.lastFrameTime || now)));
    state.lastFrameTime = now;

    if (state.mode === 'playing') {
      if (audio.ctx && audio.isPlaying) {
        state.songTime = Math.max(0, audio.ctx.currentTime - audio.songStartTime + timingOffsetSec);
      } else {
        state.songTime += dt;
      }

      for (const n of state.notes) {
        if (!n.cueShown && n.cue && state.songTime >= n.time - 1.35) {
          n.cueShown = true;
          showCallout(n.cue);
        }
        if (!n.judged && state.songTime - n.time > WIN_OK) {
          applyJudgment(n, 'MISS', false);
        }
      }

      // Continuous Ambient Spectacles across Combo 15..80!
      const dprA = Math.min(window.devicePixelRatio || 1, 2);
      const wA = fxCanvas.width / dprA;
      const hA = fxCanvas.height / dprA;
      state.ambientFxTimer += dt;
      if (state.ambientFxTimer > 0.22) {
        state.ambientFxTimer = 0;
        // #15 Floating Musical Notes
        if (state.combo >= 15) {
          pushParticle({ x: wA * (0.15 + Math.random() * 0.7), y: hA * 0.62, vx: (Math.random() - 0.5) * 40, vy: -95 - Math.random() * 55, size: 9, color: `hsl(${Math.random() * 360}, 95%, 68%)`, life: 0, maxLife: 1.5, rot: Math.random() - 0.5, vrot: 0, shape: 'note' });
        }
        // #21 Sparkle Trail
        if (state.combo >= 21) {
          pushParticle({ x: wA * Math.random(), y: hA * 0.72, vx: (Math.random() - 0.5) * 25, vy: -120, size: 4.5, color: '#fde047', life: 0, maxLife: 1.1, rot: 0, vrot: 4, shape: 'star' });
        }
        // #22 Twin Stage-Edge Sparkler Fountains
        if (state.combo >= 22) {
          for (const sx of [wA * 0.08, wA * 0.92]) {
            pushParticle({ x: sx, y: hA * 0.68, vx: (sx < wA * 0.5 ? 1 : -1) * (30 + Math.random() * 60), vy: -220 - Math.random() * 90, size: 4.5, color: '#fde047', life: 0, maxLife: 0.75, rot: 0, vrot: 8, shape: 'star' });
          }
        }
        // #23 Confetti Shower
        if (state.combo >= 23) {
          pushParticle({ x: wA * Math.random(), y: hA * 0.04, vx: (Math.random() - 0.5) * 50, vy: 50 + Math.random() * 50, size: 7, color: `hsl(${Math.random() * 360}, 95%, 62%)`, life: 0, maxLife: 2.2, rot: Math.random() * 6, vrot: 6, shape: 'rect' });
        }
        // #24 Iridescent Neon Bubbles
        if (state.combo >= 24 && Math.random() < 0.55) {
          pushParticle({ x: wA * (0.1 + Math.random() * 0.8), y: hA * 0.74, vx: (Math.random() - 0.5) * 30, vy: -75 - Math.random() * 40, size: 8 + Math.random() * 7, color: `hsla(${Math.random() * 360}, 90%, 75%, 0.8)`, life: 0, maxLife: 2.1, rot: 0, vrot: 0, shape: 'bubble' });
        }
        // #25 Twin Flame Pillars on stage corners
        if (state.combo >= 25 && Math.random() < 0.6) {
          for (const fx of [wA * 0.14, wA * 0.86]) {
            pushParticle({ x: fx + (Math.random() - 0.5) * 16, y: hA * 0.64, vx: (Math.random() - 0.5) * 20, vy: -240 - Math.random() * 80, size: 8, color: Math.random() < 0.5 ? '#f97316' : '#facc15', life: 0, maxLife: 0.55, rot: 0, vrot: 6, shape: 'star' });
          }
        }
        // #37 Hero Rising Energy Aura
        if (state.combo >= 37) {
          pushParticle({ x: wA * 0.5 + (Math.random() - 0.5) * 90, y: hA * 0.56, vx: (Math.random() - 0.5) * 20, vy: -140, size: 5, color: `hsl(${(state.songTime * 120) % 360}, 95%, 68%)`, life: 0, maxLife: 0.9, rot: 0, vrot: 5, shape: 'star' });
        }
        // #46 Audience Floating Hearts
        if (state.combo >= 46 && Math.random() < 0.5) {
          const hx = Math.random() < 0.5 ? wA * (0.06 + Math.random() * 0.14) : wA * (0.80 + Math.random() * 0.14);
          pushParticle({ x: hx, y: hA * 0.72, vx: (Math.random() - 0.5) * 25, vy: -105, size: 8, color: Math.random() < 0.5 ? '#f43f8e' : '#facc15', life: 0, maxLife: 1.4, rot: 0, vrot: 0, shape: 'heart' });
        }
        // #68 Breakdancer Floor Sparks
        if (state.combo >= 56 && state.combo >= 68) {
          pushParticle({ x: wA * (0.25 + Math.random() * 0.5), y: hA * 0.64, vx: (Math.random() - 0.5) * 180, vy: -110 - Math.random() * 80, size: 4.5, color: '#facc15', life: 0, maxLife: 0.55, rot: 0, vrot: 9, shape: 'star' });
        }
        // #75 Shooting Stars Meteor Shower!
        if (state.combo >= 75 && Math.random() < 0.55) {
          pushParticle({ x: wA * (0.3 + Math.random() * 0.7), y: hA * (0.05 + Math.random() * 0.16), vx: -360, vy: 150, size: 5, color: '#fef08a', life: 0, maxLife: 0.65, rot: 0, vrot: 0, shape: 'meteor' });
        }
      }

      // #27 Mini Fireworks, #30 Starmine, #44 Crowd Cheers, #79 Continuous Celebration Fireworks!
      state.fireworkTimer += dt;
      const fwInterval = state.combo >= 79 ? 0.55 : (state.combo >= 30 ? 1.35 : 2.1);
      if (state.combo >= 27 && state.fireworkTimer >= fwInterval) {
        state.fireworkTimer = 0;
        spawnFireworks(state.combo >= 79 ? 3 : (state.combo >= 30 ? 2 : 1));
        if (state.combo >= 44 && Math.random() < 0.55) {
          const cheers = ['WOO!!', 'YEAH!!', 'サイコー!!', 'FEVER!!', 'もっと!!'];
          popups.push({
            x: Math.random() < 0.5 ? wA * 0.16 : wA * 0.84,
            y: hA * (0.42 + Math.random() * 0.14),
            text: cheers[Math.floor(Math.random() * cheers.length)],
            subText: '',
            color: '#67e8f9',
            scale: 0.62,
            life: 0,
            maxLife: 0.85
          });
        }
      }

      updateHUD();
      if (state.songTime >= SONG_DURATION) finishGame();
    }

    const timeRef = state.mode === 'playing' ? state.songTime : now;
    const beatPhase = (((timeRef - BEAT_PHASE) / BEAT_SEC) % 1 + 1) % 1;
    const beatPulse = Math.pow(1 - beatPhase, 2);

    const feverGlow = state.stageTier >= 3 ? 1.0 : (state.stageTier === 2 ? 0.35 : 0);
    updateChameleon(mainChameleon, dt, timeRef, beatPhase, feverGlow);
    for (const npc of backDancers) {
      updateChameleon(npc, dt, timeRef, beatPhase, feverGlow * 0.8);
    }
    const crowdSpread = state.mode === 'playing' ? Math.pow(Math.min(55, state.combo) / 55, 0.7) : 0;
    for (const baby of babyChameleons) {
      if (state.mode === 'title') baby.visibleTarget = (baby === babyChameleons[0] || baby === babyChameleons[1]) ? 1 : 0;
      // Smoothly glide baby chameleons forward into the lower foreground as camera pulls back!
      baby.basePos.lerpVectors(baby.nearPos, baby.widePos, crowdSpread);
      updateChameleon(baby, dt, timeRef, beatPhase, feverGlow * 0.9);
    }
    for (const bd of breakDancers) {
      updateBreakdancer(bd, dt, timeRef, beatPhase);
    }

    const tierBoost = 1 + state.stageTier * 0.38;

    const cNow = state.mode === 'playing' ? state.combo : 0;

    // Subtle deep-neon overhead spotlights (low opacity so characters stay 100% crisp & vivid!)
    spotCones.forEach((sc, idx) => {
      sc.mesh.rotation.z = sc.baseRotZ + Math.sin(timeRef * sc.speed + idx) * 0.16;
      sc.mesh.material.opacity = 0.025 + beatPulse * 0.015;
      if (cNow >= 5) {
        sc.mesh.material.color.setHSL((timeRef * 0.25 + idx * 0.16) % 1, 0.95, 0.48);
      }
    });

    // #1 Beat Pulse, #11 Floor Wave Rings, #14 Rainbow Floor Rings
    floorRings.forEach((ring, idx) => {
      const waveRipple = cNow >= 11 ? Math.sin(timeRef * 5 - idx * 0.9) * 0.045 : 0;
      const s = 1 + beatPulse * (cNow >= 1 ? 0.045 : 0.02) + waveRipple;
      ring.scale.set(s, s, 1);
      if (cNow >= 14) {
        ring.material.color.setHSL((timeRef * 0.32 + idx * 0.18) % 1, 0.95, 0.6);
      }
    });

    // #7: Keep searchlights hidden (non-obstructive dark-stage visibility!)
    searchlights.forEach((sl) => { sl.visible = false; });

    // #12 Floating Neon Hoops (gentle horizontal rotation high above, zero visual obstruction!)
    floatingHoops.forEach((hoop, i) => {
      hoop.visible = cNow >= 12;
      if (!hoop.visible) return;
      hoop.rotation.x = Math.PI * 0.5;
      hoop.rotation.z += dt * (0.5 + i * 0.25);
      hoop.material.color.setHSL((timeRef * 0.28 + i * 0.5) % 1, 0.95, 0.58);
    });

    // #13 3D Starfield
    if (starField) {
      starField.visible = cNow >= 13;
      if (starField.visible) starField.rotation.y += dt * 0.18;
    }

    // #16 Crystal Pillars
    crystalPillars.forEach((pil, i) => {
      pil.visible = cNow >= 16;
      if (!pil.visible) return;
      pil.rotation.y += dt * 0.9;
      pil.position.y = 1.9 + Math.sin(timeRef * 2.5 + i) * 0.35;
    });

    // #17 Orbiting Star Ring
    if (orbitStarsGroup) {
      orbitStarsGroup.visible = cNow >= 17;
      if (orbitStarsGroup.visible) orbitStarsGroup.rotation.y -= dt * 1.1;
    }

    // #18 Floor Grid Lines
    if (floorGridGroup) {
      floorGridGroup.visible = cNow >= 18;
      if (floorGridGroup.visible) floorGridGroup.rotation.y += dt * 0.25;
    }

    // #20 Giant 3D Golden Crown
    if (megaCrown) {
      megaCrown.visible = cNow >= 20;
      if (megaCrown.visible) {
        megaCrown.rotation.y += dt * 1.3;
        megaCrown.position.y = 6.2 + Math.sin(timeRef * 3) * 0.28;
        const cs = cNow >= 80 ? 1.45 : 1.0 + beatPulse * 0.1;
        megaCrown.scale.setScalar(cs);
      }
    }

    // #32 Hero Neon Foot Aura, #33 Hero Golden Spotlight, #40 Hero Superstar Wings
    if (heroFootRing) {
      heroFootRing.visible = cNow >= 32;
      if (heroFootRing.visible) {
        heroFootRing.rotation.z += dt * 2.5;
        heroFootRing.material.color.setHSL((timeRef * 0.5) % 1, 0.95, 0.62);
      }
    }
    if (heroSpotLight) {
      heroSpotLight.intensity = cNow >= 33 ? (2.2 + beatPulse * 1.2) : 0;
    }
    if (heroWingsGroup) {
      heroWingsGroup.visible = cNow >= 40;
      if (heroWingsGroup.visible) {
        const flap = 1 + Math.sin(timeRef * 8) * 0.12;
        heroWingsGroup.scale.set(flap, 1, 1);
      }
    }

    // #60 Breakdancer Rainbow-Gold Rings
    if (cNow >= 60) {
      breakDancers.forEach((bd, i) => {
        if (bd.spinRing) bd.spinRing.material.color.setHSL((timeRef * 0.6 + i * 0.2) % 1, 0.95, 0.62);
      });
    }

    // #67 3D Expanding Arena Floor Shockwave Ring
    if (arenaShockRing && arenaShockLife < 1) {
      arenaShockLife = Math.min(1, arenaShockLife + dt * 2.1);
      const sr = 1.0 + arenaShockLife * 14.5;
      arenaShockRing.scale.set(sr, sr, 1);
      arenaShockRing.material.opacity = (1 - arenaShockLife) * 0.8;
    }

    // #76 Giant Golden Plasma Floor Rim Ring (flat around arena perimeter, never crosses camera!)
    if (plasmaHaloRing) {
      plasmaHaloRing.visible = cNow >= 76;
      if (plasmaHaloRing.visible) {
        plasmaHaloRing.rotation.z += dt * 0.6;
        plasmaHaloRing.material.color.setHSL((timeRef * 0.25) % 1, 0.95, 0.6);
      }
    }

    // Hide stage speakers/cabinets & equalizer bars once chameleons multiply so the dance troupe has a clean stage!
    const activeNPCsNow = state.mode === 'playing' ? Math.min(backDancers.length, state.combo) : 0;
    const showStageProps = activeNPCsNow < 4;

    eqBars.forEach((bar, idx) => {
      bar.visible = showStageProps;
      if (!showStageProps) return;
      const wave = Math.sin(timeRef * 6 + idx * 0.65) * 0.5 + 0.5;
      const hVal = (0.35 + (wave * 0.9 + beatPulse * 1.1) * tierBoost * 0.55);
      bar.scale.y = hVal;
      bar.position.y = hVal * 0.5;
    });

    arcadeCabinets.forEach((cab) => {
      cab.visible = showStageProps;
    });

    if (showStageProps) {
      arcadeScreens.forEach((mat, idx) => {
        const hue = state.stageTier >= 2
          ? (timeRef * 0.4 + idx * 0.2) % 1
          : ((idx * 0.25 + 0.52) % 1);
        mat.color.setHSL(hue, 0.85, 0.45 + beatPulse * 0.2);
      });
    }

    // Delicate background concert lasers (low opacity & thin so they NEVER block the chameleons!)
    laserBeams.forEach((beam, idx) => {
      const targetOp = cNow >= 3 ? (cNow >= 6 ? 0.22 : 0.14) : 0;
      beam.material.opacity += (targetOp - beam.material.opacity) * (1 - Math.exp(-6 * dt));
      const spd = cNow >= 6 ? 3.2 : 2.0;
      beam.scale.x = beam.scale.z = 0.65;
      beam.rotation.z = (idx < 2 ? -0.55 : 0.55) + Math.sin(timeRef * spd + idx * 1.4) * 0.42;
      beam.rotation.x = 0.15;
    });

    const targetBallY = state.stageTier >= 2 ? 3.95 : 6.8;
    discoBallGroup.position.y += (targetBallY - discoBallGroup.position.y) * (1 - Math.exp(-5 * dt));
    discoBallGroup.rotation.y += dt * (1.2 + state.stageTier * 0.6);

    const rimBoost = cNow >= 2 ? 1.35 : 1.0;
    rimLightLeft.intensity = (2.0 + beatPulse * 0.9 * tierBoost) * rimBoost;
    rimLightRight.intensity = (2.0 + beatPulse * 0.9 * tierBoost) * rimBoost;

    // #65: Arena Panorama Floodlight boost (lights up all 61 chameleons with zero camera motion!)
    if (cNow >= 65) {
      rimLightLeft.intensity *= 1.25;
      rimLightRight.intensity *= 1.25;
    }

    // Rock-steady, motion-sickness-free camera! Only pulls smoothly back as chameleons grow up to 55, then locks still!
    const activeNPCs = activeNPCsNow;
    const crowdFrac = Math.pow(activeNPCs / 55, 0.68);
    const targetZ = state.mode === 'title' ? 7.85 : (7.05 + crowdFrac * 13.2);
    const targetCamY = state.mode === 'title' ? 2.25 : (2.30 + crowdFrac * 5.2);
    const targetLookY = state.mode === 'title' ? 0.84 : (1.05 - crowdFrac * 0.35);
    const targetLookZ = state.mode === 'title' ? 0 : (-crowdFrac * 0.85);

    const camEase = 1 - Math.exp(-3.2 * dt);
    camera.position.x += (0 - camera.position.x) * camEase;
    camera.position.z += (targetZ - camera.position.z) * camEase;
    camera.position.y += (targetCamY - camera.position.y) * camEase;
    if (camera.userData.lookZ === undefined) camera.userData.lookZ = 0;
    camera.userData.lookZ += (targetLookZ - camera.userData.lookZ) * camEase;
    camera.lookAt(0, targetLookY, camera.userData.lookZ);

    renderer.render(scene, camera);
    draw2DOverlay(dt, beatPhase);
  }

  // =========================================================
  // 10. EVENT LISTENERS & INIT
  // =========================================================
  danceButtons.forEach((btn) => {
    const moveId = parseInt(btn.dataset.move, 10);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleButtonPress(moveId);
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const keyMap = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, 'a': 1, 's': 2, 'd': 3, 'j': 4, 'k': 5, 'l': 6 };
    const m = keyMap[e.key.toLowerCase()];
    if (m) handleButtonPress(m);
  });

  startBtn.addEventListener('click', () => startGame());
  playAgainBtn.addEventListener('click', () => startGame());
  restartBtn.addEventListener('click', () => startGame());

  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.72;
    muteIcon.textContent = audio.muted ? '🔇' : '🔊';
    muteText.textContent = audio.muted ? '音OFF' : '音ON';
  });

  openSongSelectBtn.addEventListener('click', () => {
    renderSongModal();
    songModalEl.classList.remove('hidden');
  });
  closeSongBtn.addEventListener('click', () => {
    songModalEl.classList.add('hidden');
  });
  addCustomSongBtn.addEventListener('click', () => {
    pendingUploadTargetSongId = '__new__';
    songFileInput.value = '';
    songFileInput.click();
  });

  songFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      ensureAudio();
      const buf = await file.arrayBuffer();
      const decoded = await audio.ctx.decodeAudioData(buf);
      const analyzed = analyzeAudioAndBuildChart(decoded, 240);
      if (pendingUploadTargetSongId && pendingUploadTargetSongId !== '__new__') {
        const target = SONGS.find((s) => s.id === pendingUploadTargetSongId);
        if (target) {
          target.mode = 'audio';
          target.audioBuffer = decoded;
          target.bpm = analyzed.bpm;
          target.duration = analyzed.duration;
          target.chart = analyzed.chart;
          applySelectedSong(target.id);
        }
      } else {
        const newId = 'custom_' + Date.now();
        const cleanTitle = file.name.replace(/\.[^.]+$/, '');
        SONGS.push({
          id: newId,
          title: cleanTitle,
          bpm: analyzed.bpm,
          duration: analyzed.duration,
          noteCount: 240,
          mode: 'audio',
          audioBuffer: decoded,
          chart: analyzed.chart
        });
        applySelectedSong(newId);
      }
      renderSongModal();
    } catch (err) {
      showCallout('音声ファイルの読込に失敗しました');
    }
  });

  const offsetSlider = document.getElementById('offset-slider');
  const offsetValEl = document.getElementById('offset-val');
  if (offsetSlider && offsetValEl) {
    offsetSlider.addEventListener('input', () => {
      const ms = parseInt(offsetSlider.value, 10) || 0;
      timingOffsetSec = ms / 1000;
      offsetValEl.textContent = (ms > 0 ? '+' : '') + ms + 'ms';
    });
  }

  applySelectedSong('orekameleon');

  window.addEventListener('resize', resize);

  window.onload = () => {
    initThree();
    resize();
    if (state.rafId) cancelAnimationFrame(state.rafId);
    state.lastFrameTime = performance.now() * 0.001;
    state.rafId = requestAnimationFrame(animate);
  };
})();
