const { useState, useEffect, useRef } = React;

// --- Web Audio Synthesizer ---
let audioCtx = null;

const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
};

const playSFX = (type, volPercent) => {
    if (!audioCtx || volPercent <= 0) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    const t = audioCtx.currentTime;
    const vol = (volPercent / 100) * 0.3; 
    
    // Helper function to synthesize physical "smack" noise impacts
    const createNoise = (duration, filterFreq, gainVol) => {
        const noise = audioCtx.createBufferSource();
        const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * duration, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for(let i=0; i<buffer.length; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(filterFreq, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + duration);
        
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(gainVol, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + duration);
        
        noise.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
        noise.start(t); noise.stop(t + duration);
    };

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (['LP', 'LK'].includes(type)) {
        // Fast, high snappy thud + crisp noise
        osc.type = 'sine'; 
        osc.frequency.setValueAtTime(800, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + 0.08);
        gain.gain.setValueAtTime(vol * 1.5, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
        osc.start(t); osc.stop(t + 0.08);
        createNoise(0.06, 4000, vol * 1.2);
    } else if (['MP', 'MK'].includes(type)) {
        // Thicker, mid-range punch body + heavier smack
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
        gain.gain.setValueAtTime(vol * 1.8, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        osc.start(t); osc.stop(t + 0.15);
        createNoise(0.12, 2500, vol * 1.8);
    } else if (['HP', 'HK'].includes(type)) {
        // Deep bass boom + distorted crunch noise
        osc.type = 'square';
        osc.frequency.setValueAtTime(250, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
        gain.gain.setValueAtTime(vol * 2.2, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        osc.start(t); osc.stop(t + 0.25);
        createNoise(0.22, 1200, vol * 3.5);
    } else if (type === 'error') {
        // Harsh dissonant buzzer
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.3);
        gain.gain.setValueAtTime(vol * 0.8, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.3);
        
        const osc2 = audioCtx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(120, t);
        osc2.connect(gain);
        osc2.start(t); osc2.stop(t + 0.3);
        
        osc.start(t); osc.stop(t + 0.3);
    }
};

// --- Input Mapping & Rules ---
const ERROR_MAP = {
  1: 'Down-Back (1)', 2: 'Down (2)', 3: 'Down-Forward (3)',
  4: 'Back (4)', 6: 'Forward (6)', 7: 'Up-Back (7)',
  8: 'Up (8)', 9: 'Up-Forward (9)',
  'P': 'Any Punch', 'K': 'Any Kick',
  'LP': 'Light Punch', 'MP': 'Medium Punch', 'HP': 'Heavy Punch',
  'LK': 'Light Kick', 'MK': 'Medium Kick', 'HK': 'Heavy Kick',
  '6+HP': 'Forward + Heavy Punch',
  '360': '360 Motion', '720': '720 Motion'
};

const INPUT_GLOW_FRAMES = 45;

const BUTTON_COLORS = {
  LP: { text: '#f9a8d4', bg: 'bg-pink-300', border: 'border-pink-200', shadow: 'shadow-[0_0_15px_#f9a8d4]' },
  MP: { text: '#ec4899', bg: 'bg-pink-500', border: 'border-pink-400', shadow: 'shadow-[0_0_15px_#ec4899]' },
  HP: { text: '#be185d', bg: 'bg-pink-700', border: 'border-pink-600', shadow: 'shadow-[0_0_15px_#be185d]' },
  LK: { text: '#67e8f9', bg: 'bg-cyan-300', border: 'border-cyan-200', shadow: 'shadow-[0_0_15px_#67e8f9]' },
  MK: { text: '#22d3ee', bg: 'bg-cyan-400', border: 'border-cyan-300', shadow: 'shadow-[0_0_15px_#22d3ee]' },
  HK: { text: '#0891b2', bg: 'bg-cyan-600', border: 'border-cyan-500', shadow: 'shadow-[0_0_15px_#0891b2]' },
};

const getButtonColor = (button) => BUTTON_COLORS[button] || null;

const REACTION_SCENARIOS = {
  dash: {
    id: 'dash',
    label: 'Dash In',
    validStart: 0,
    validEnd: 24,
    tellFrames: 28,
    endFrame: 24,
    startX: 80,
    endX: 60,
    startY: 0,
    endY: 0
  },
  jump: {
    id: 'jump',
    label: 'Jump In',
    validStart: 6,
    validEnd: 36,
    tellFrames: 12,
    tellCountsAsValid: false,
    endFrame: 49,
    startX: 80,
    endX: 58,
    startY: 0,
    endY: 0,
    apex: -155
  }
};

const REACTION_PLAYER_SPRITES = {
  idle: './public/assets/sprites/reaction/player_idle.png',
  hadoken: './public/assets/sprites/reaction/player_hadoken_pose.png',
  antiAir: './public/assets/sprites/reaction/player_anti_air_pose.png',
  onHit: './public/assets/sprites/reaction/player_onhit.png'
};

const REACTION_OPPONENT_SPRITES = {
  idle: './public/assets/sprites/reaction/opponent_idle.png',
  dashTell: './public/assets/sprites/reaction/opponent_dash_tell.png',
  dashActive: './public/assets/sprites/reaction/opponent_dash_active.png',
  jumpTell: './public/assets/sprites/reaction/opponent_jump_tell.png',
  jumpActive: './public/assets/sprites/reaction/opponent_jump_active.png',
  onHit: './public/assets/sprites/reaction/opponent_onhit.png'
};

const SPRITE_METADATA_STORAGE_KEY = 'ftg_reaction_sprite_meta';
const SPRITE_METADATA_FILE = './public/assets/sprites/reaction/metadata.json';

const REACTION_SPRITE_DEFS = [
  { id: 'player_idle', label: 'Player Idle', src: REACTION_PLAYER_SPRITES.idle },
  { id: 'player_hadoken', label: 'Player Hadoken', src: REACTION_PLAYER_SPRITES.hadoken },
  { id: 'player_anti_air', label: 'Player Anti-Air', src: REACTION_PLAYER_SPRITES.antiAir },
  { id: 'player_onhit', label: 'Player On-Hit', src: REACTION_PLAYER_SPRITES.onHit },
  { id: 'opponent_idle', label: 'Opponent Idle', src: REACTION_OPPONENT_SPRITES.idle },
  { id: 'opponent_dash_tell', label: 'Opponent Dash Tell', src: REACTION_OPPONENT_SPRITES.dashTell },
  { id: 'opponent_dash_active', label: 'Opponent Dash Active', src: REACTION_OPPONENT_SPRITES.dashActive },
  { id: 'opponent_jump_tell', label: 'Opponent Jump Tell', src: REACTION_OPPONENT_SPRITES.jumpTell },
  { id: 'opponent_jump_active', label: 'Opponent Jump Active', src: REACTION_OPPONENT_SPRITES.jumpActive },
  { id: 'opponent_onhit', label: 'Opponent On-Hit', src: REACTION_OPPONENT_SPRITES.onHit }
];

const REACTION_SPRITE_BY_ID = Object.fromEntries(REACTION_SPRITE_DEFS.map(sprite => [sprite.id, sprite]));

const DEFAULT_REACTION_SPRITE_META = {
  player_idle: { height: 320, x: 0, y: 0 },
  player_hadoken: { height: 320, x: 6, y: 0 },
  player_anti_air: { height: 330, x: 0, y: -2 },
  player_onhit: { height: 326, x: -4, y: 0 },
  opponent_idle: { height: 320, x: 0, y: 0 },
  opponent_dash_tell: { height: 330, x: -8, y: 2 },
  opponent_dash_active: { height: 350, x: -22, y: 6 },
  opponent_jump_tell: { height: 325, x: 6, y: 0 },
  opponent_jump_active: { height: 335, x: -8, y: -18 },
  opponent_onhit: { height: 326, x: 4, y: 0 }
};

const SPRITE_DEBUG_SEQUENCES = [
  { id: 'player_idle', label: 'Player Idle', frames: ['player_idle'] },
  { id: 'player_hadoken_anim', label: 'Player Hadoken', frames: ['player_idle', 'player_hadoken'] },
  { id: 'player_anti_air_anim', label: 'Player Anti-Air', frames: ['player_idle', 'player_anti_air'] },
  { id: 'player_hadoken', label: 'Hadoken Only', frames: ['player_hadoken'] },
  { id: 'player_anti_air', label: 'Anti-Air Only', frames: ['player_anti_air'] },
  { id: 'player_onhit', label: 'Player On-Hit', frames: ['player_onhit'] },
  { id: 'opponent_idle', label: 'Opponent Idle', frames: ['opponent_idle'] },
  { id: 'opponent_dash', label: 'Opponent Dash', frames: ['opponent_idle', 'opponent_dash_tell', 'opponent_dash_active'] },
  { id: 'opponent_jump', label: 'Opponent Jump', frames: ['opponent_idle', 'opponent_jump_tell', 'opponent_jump_active'] },
  { id: 'opponent_dash_tell', label: 'Dash Tell Only', frames: ['opponent_dash_tell'] },
  { id: 'opponent_dash_active', label: 'Dash Active Only', frames: ['opponent_dash_active'] },
  { id: 'opponent_jump_tell', label: 'Jump Tell Only', frames: ['opponent_jump_tell'] },
  { id: 'opponent_jump_active', label: 'Jump Active Only', frames: ['opponent_jump_active'] },
  { id: 'opponent_onhit', label: 'Opponent On-Hit', frames: ['opponent_onhit'] }
];

const TRAINING_BACKGROUND_THEMES = {
  grid: {
    label: 'Grid Room',
    swatch: 'from-stone-100 to-stone-500',
    accentRgb: '8,145,178',
    input: {
      label: '#1f2937',
      idleText: '#111827',
      idleBorder: 'rgba(17,24,39,0.54)',
      idleBg: 'rgba(255,255,255,0.58)',
      currentText: '#020617',
      currentBorder: 'rgba(8,145,178,0.9)',
      currentBg: 'rgba(236,254,255,0.78)'
    },
    style: {
      backgroundColor: '#d8d5c7',
      backgroundImage: `
        linear-gradient(to bottom, rgba(255,255,255,0.86), rgba(210,207,195,0.92) 54%, rgba(160,157,146,0.96) 55%, rgba(197,193,178,0.98)),
        radial-gradient(circle at 50% 12%, rgba(255,255,255,0.82), transparent 42%)
      `,
      backgroundSize: '100% 100%, 100% 100%',
      backgroundPosition: '0 0, 0 0'
    },
    floorStyle: {
      backgroundImage: `
        radial-gradient(ellipse at center bottom, rgba(35,35,31,0.18), transparent 62%)
      `
    }
  },
  night: {
    label: 'Night Room',
    swatch: 'from-slate-900 to-cyan-700',
    accentRgb: '34,211,238',
    input: {
      label: '#cffafe',
      idleText: '#e0f2fe',
      idleBorder: 'rgba(103,232,249,0.52)',
      idleBg: 'rgba(2,6,23,0.64)',
      currentText: '#ffffff',
      currentBorder: 'rgba(103,232,249,0.92)',
      currentBg: 'rgba(8,47,73,0.72)'
    },
    style: {
      backgroundColor: '#111827',
      backgroundImage: `
        linear-gradient(to bottom, rgba(15,23,42,0.96), rgba(30,41,59,0.94) 54%, rgba(6,78,59,0.36) 55%, rgba(3,7,18,0.98)),
        radial-gradient(circle at 50% 12%, rgba(34,211,238,0.28), transparent 42%)
      `,
      backgroundSize: '100% 100%, 100% 100%',
      backgroundPosition: '0 0, 0 0'
    },
    floorStyle: {
      backgroundImage: `
        radial-gradient(ellipse at center bottom, rgba(103,232,249,0.13), transparent 62%)
      `
    }
  },
  warm: {
    label: 'Warm Dojo',
    swatch: 'from-amber-100 to-rose-500',
    accentRgb: '225,29,72',
    input: {
      label: '#3f1f12',
      idleText: '#1c1917',
      idleBorder: 'rgba(68,46,33,0.56)',
      idleBg: 'rgba(255,247,237,0.56)',
      currentText: '#ffffff',
      currentBorder: 'rgba(225,29,72,0.92)',
      currentBg: 'rgba(159,18,57,0.74)'
    },
    style: {
      backgroundColor: '#d7c0a2',
      backgroundImage: `
        linear-gradient(to bottom, rgba(255,247,237,0.86), rgba(214,174,125,0.76) 54%, rgba(113,63,18,0.44) 55%, rgba(132,94,68,0.96)),
        radial-gradient(circle at 50% 10%, rgba(255,255,255,0.72), transparent 42%)
      `,
      backgroundSize: '100% 100%, 100% 100%',
      backgroundPosition: '0 0, 0 0'
    },
    floorStyle: {
      backgroundImage: `
        radial-gradient(ellipse at center bottom, rgba(68,46,33,0.16), transparent 62%)
      `
    }
  }
};

const PLAYER_ATTACK_POSE_FRAMES = 36;
const ON_HIT_POSE_FRAMES = 45;

const mergeSpriteMeta = (saved = {}) => Object.fromEntries(
  Object.entries(DEFAULT_REACTION_SPRITE_META).map(([id, meta]) => [id, { ...meta, ...(saved[id] || {}) }])
);

const loadSpriteMetaFile = async () => {
  const response = await fetch(SPRITE_METADATA_FILE, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Metadata file returned ${response.status}`);
  return response.json();
};

const saveSpriteMetaFile = async (metadata) => {
  const response = await fetch('./api/sprite-metadata', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || 'Metadata save endpoint is unavailable. Restart the dev server.');
  }
};

const getReactionPlayerAttackSpriteId = (moveId) => {
  if (['236P', '236236P'].includes(moveId)) return 'player_hadoken';
  if (['623P', 'charge28K'].includes(moveId)) return 'player_anti_air';
  return 'player_idle';
};

const getReactionOpponentSpriteId = (reaction) => {
  if (!reaction || reaction.phase === 'delay') return 'opponent_idle';
  if (reaction.scenario === 'jump') {
    return reaction.phase === 'tell' ? 'opponent_jump_tell' : 'opponent_jump_active';
  }
  return reaction.phase === 'tell' ? 'opponent_dash_tell' : 'opponent_dash_active';
};

const makeReactionRound = (scenarioId) => {
  const scenario = REACTION_SCENARIOS[scenarioId] || REACTION_SCENARIOS.dash;
  return {
    scenario: scenario.id,
    phase: 'delay',
    delayFrame: 0,
    delayFrames: 45 + Math.floor(Math.random() * 76),
    actionFrame: 0,
    x: scenario.startX,
    y: scenario.startY,
    valid: false,
    lastResult: null,
    reactionFrames: null
  };
};

const MOVE_LIST = {
  // MOTION
  '236P': { tab: 'MOTION', name: 'Hadouken', desc: 'Quarter Circle Forward + Any Punch', sequence: [2, 3, 6, 'P'] },
  '623P': { tab: 'MOTION', name: 'Shoryuken', desc: 'Forward, Down, Down-Forward + Any Punch', sequence: [6, 2, 3, 'P'] },
  '41236P': { tab: 'MOTION', name: 'Yoga Flame', desc: 'Half Circle Forward + Any Punch', sequence: [4, 1, 2, 3, 6, 'P'] },
  '236236P': { tab: 'MOTION', name: 'Shinku Hadouken', desc: 'Double Quarter Circle Forward + Any Punch', sequence: [2, 3, 6, 2, 3, 6, 'P'] },
  '214214P': { tab: 'MOTION', name: 'Solid Puncher', desc: 'Double Quarter Circle Back + Any Punch', sequence: [2, 1, 4, 2, 1, 4, 'P'] },
  '4123641236P': { tab: 'MOTION', name: 'Double Half Circle', desc: 'Double Half Circle Forward + Any Punch', sequence: [4, 1, 2, 3, 6, 4, 1, 2, 3, 6, 'P'] },

  // CHARGE
  'charge46P': { tab: 'CHARGE', name: 'Sonic Boom', desc: 'Charge Back, Forward + Any Punch', sequence: [6, 'P'], charge: { dirs: [1, 4, 7], frames: 45, icon: 4, label: 'Back' } },
  'charge28K': { tab: 'CHARGE', name: 'Flash Kick', desc: 'Charge Down, Up + Any Kick', sequence: [8, 'K'], charge: { dirs: [1, 2, 3], frames: 45, icon: 2, label: 'Down' } },
  'charge4646P': { tab: 'CHARGE', name: 'Sonic Hurricane', desc: 'Charge Back, Forward, Back, Forward + Any Punch', sequence: [6, 4, 6, 'P'], charge: { dirs: [1, 4, 7], frames: 45, icon: 4, label: 'Back' } },
  'charge4646K': { tab: 'CHARGE', name: 'Crossfire Somersault', desc: 'Charge Back, Forward, Back, Forward + Any Kick', sequence: [6, 4, 6, 'K'], charge: { dirs: [1, 4, 7], frames: 45, icon: 4, label: 'Back' } },

  // GRAPPLER
  '360P': { tab: 'GRAPPLER', name: 'Spinning Piledriver', desc: '360 Motion + Any Punch', sequence: ['P'], require360: { frames: 35, count: 1, label: '360' } },
  '720P': { tab: 'GRAPPLER', name: 'Borscht Dynamite', desc: '720 Motion + Any Punch', sequence: ['P'], require360: { frames: 55, count: 2, label: '720' } },

  // COMBOS
  'combo1': { tab: 'COMBOS', name: 'Target Combo', desc: 'Light Punch > Medium Kick > Heavy Punch', sequence: ['LP', 'MK', 'HP'] },
  'combo2': { tab: 'COMBOS', name: 'Advanced Cancel', desc: 'Forward+HP > Forward+HP > Hadouken', sequence: ['6+HP', '6+HP', 2, 3, 6, 'P'] }
};

const TABS = ['MOTION', 'CHARGE', 'GRAPPLER', 'COMBOS', 'CUSTOM'];

const CUSTOM_STORAGE_KEY = 'ftg_custom_moves';

const cloneEditorSteps = (steps) => steps.map(step => ({ ...step, id: `step_${Date.now()}_${Math.random().toString(36).slice(2)}` }));

const COMMAND_PRESETS = [
  { id: 'dir', group: 'DIRECTION', label: 'Direction', steps: [{ type: 'direction', dir: 6 }] },
  { id: 'lp', group: 'BUTTON', label: 'LP', steps: [{ type: 'button', button: 'LP' }] },
  { id: 'lk', group: 'BUTTON', label: 'LK', steps: [{ type: 'button', button: 'LK' }] },
  { id: 'mp', group: 'BUTTON', label: 'MP', steps: [{ type: 'button', button: 'MP' }] },
  { id: 'mk', group: 'BUTTON', label: 'MK', steps: [{ type: 'button', button: 'MK' }] },
  { id: 'hp', group: 'BUTTON', label: 'HP', steps: [{ type: 'button', button: 'HP' }] },
  { id: 'hk', group: 'BUTTON', label: 'HK', steps: [{ type: 'button', button: 'HK' }] },
  { id: 'p', group: 'BUTTON', label: 'Any Punch', steps: [{ type: 'anyButton', value: 'P' }] },
  { id: 'k', group: 'BUTTON', label: 'Any Kick', steps: [{ type: 'anyButton', value: 'K' }] },
  { id: '6hp', group: 'SIMUL', label: 'Forward + HP', steps: [{ type: 'simul', dir: 6, button: 'HP' }] },
  { id: '2mk', group: 'SIMUL', label: 'Down + MK', steps: [{ type: 'simul', dir: 2, button: 'MK' }] },
  { id: '236p', group: 'MOTION', label: '236P', steps: [{ type: 'direction', dir: 2 }, { type: 'direction', dir: 3 }, { type: 'direction', dir: 6 }, { type: 'anyButton', value: 'P' }] },
  { id: '214k', group: 'MOTION', label: '214K', steps: [{ type: 'direction', dir: 2 }, { type: 'direction', dir: 1 }, { type: 'direction', dir: 4 }, { type: 'anyButton', value: 'K' }] },
  { id: '623p', group: 'MOTION', label: '623P', steps: [{ type: 'direction', dir: 6 }, { type: 'direction', dir: 2 }, { type: 'direction', dir: 3 }, { type: 'anyButton', value: 'P' }] },
  { id: '41236p', group: 'MOTION', label: '41236P', steps: [{ type: 'direction', dir: 4 }, { type: 'direction', dir: 1 }, { type: 'direction', dir: 2 }, { type: 'direction', dir: 3 }, { type: 'direction', dir: 6 }, { type: 'anyButton', value: 'P' }] },
  { id: 'charge', group: 'BUTTON', label: 'Charge', steps: [{ type: 'charge', chargeDir: 'back', chargeFrames: 45 }] },
  { id: 'spin360', group: 'BUTTON', label: '360', steps: [{ type: 'spin', spin: '360', spinFrames: 35 }] },
  { id: 'spin720', group: 'BUTTON', label: '720', steps: [{ type: 'spin', spin: '720', spinFrames: 55 }] },
  { id: 'wait', group: 'UTILITY', label: 'Wait', steps: [{ type: 'wait', waitFrames: 30 }] }
];

const createBlankEditor = () => ({
  name: 'New Custom Combo',
  steps: []
});

const stepToCommand = (step) => {
  if (step.type === 'direction') return parseInt(step.dir) || 6;
  if (step.type === 'button') return step.button || 'HP';
  if (step.type === 'anyButton') return step.value || 'P';
  if (step.type === 'simul') return `${parseInt(step.dir) || 6}+${step.button || 'HP'}`;
  if (step.type === 'charge') {
    const isDown = step.chargeDir === 'down';
    return { type: 'charge', dirs: isDown ? [1, 2, 3] : [1, 4, 7], frames: Math.max(1, parseInt(step.chargeFrames) || 45), icon: isDown ? 2 : 4, label: isDown ? 'Down' : 'Back' };
  }
  if (step.type === 'spin') {
    const count = step.spin === '720' ? 2 : 1;
    return { type: 'spin', frames: Math.max(1, parseInt(step.spinFrames) || (count === 2 ? 55 : 35)), count, label: step.spin || '360' };
  }
  if (step.type === 'wait') return { type: 'wait', frames: Math.max(1, parseInt(step.waitFrames) || 30) };
  return null;
};

const isCommandObject = (step, type = null) => typeof step === 'object' && step !== null && (!type || step.type === type);

const commandLabel = (step) => {
  if (isCommandObject(step, 'charge')) return `Charge ${step.label} ${step.frames}f`;
  if (isCommandObject(step, 'spin')) return `${step.label} Motion ${step.frames}f`;
  if (isCommandObject(step, 'wait')) return `Wait ${step.frames}f`;
  return ERROR_MAP[step] || step;
};

const compileCustomMove = (editor, id) => {
  const sequence = editor.steps.map(stepToCommand).filter(step => step !== null && step !== undefined && step !== '');
  const move = {
    tab: 'CUSTOM',
    custom: true,
    name: editor.name.trim() || 'Custom Combo',
    desc: sequence.map(commandLabel).join(' > '),
    sequence,
    editor: {
      name: editor.name.trim() || 'Custom Combo',
      steps: editor.steps.map(step => ({ ...step }))
    }
  };

  if (id) move.id = id;
  return move;
};

const hydrateEditor = (move) => {
  if (move?.editor) {
    return {
      name: move.editor.name || move.name || 'Custom Combo',
      steps: cloneEditorSteps(move.editor.steps || [])
    };
  }
  return createBlankEditor();
};

const DEFAULT_KEYMAP = {
   up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
   lp: 'KeyU', mp: 'KeyI', hp: 'KeyO',
   lk: 'KeyJ', mk: 'KeyK', hk: 'KeyL'
};

const DEFAULT_PADMAP = {
   up: 12, down: 13, left: 14, right: 15,
   lp: 2, mp: 3, hp: 5,
   lk: 0, mk: 1, hk: 7
};

const formatKey = (code) => {
   if (!code) return '';
   return code.replace('Key', '').replace('Arrow', '').replace('Digit', '');
};

const XboxIcon = ({ buttonId }) => {
  switch (buttonId) {
    case 0: return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-black font-black text-[9px] shadow-sm">A</span>;
    case 1: return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white font-black text-[9px] shadow-sm">B</span>;
    case 2: return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-white font-black text-[9px] shadow-sm">X</span>;
    case 3: return <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-yellow-400 text-black font-black text-[9px] shadow-sm">Y</span>;
    case 4: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-300 text-black font-black text-[9px] shadow-sm border border-zinc-400">LB</span>;
    case 5: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-300 text-black font-black text-[9px] shadow-sm border border-zinc-400">RB</span>;
    case 6: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-700 text-white font-black text-[9px] shadow-sm border border-zinc-900">LT</span>;
    case 7: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-700 text-white font-black text-[9px] shadow-sm border border-zinc-900">RT</span>;
    case 12: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-800 text-white font-black text-[9px] shadow-sm border border-zinc-900">D-UP</span>;
    case 13: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-800 text-white font-black text-[9px] shadow-sm border border-zinc-900">D-DN</span>;
    case 14: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-800 text-white font-black text-[9px] shadow-sm border border-zinc-900">D-L</span>;
    case 15: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-800 text-white font-black text-[9px] shadow-sm border border-zinc-900">D-R</span>;
    default: return <span className="inline-flex items-center justify-center px-1.5 h-4 rounded bg-zinc-600 text-white font-black text-[9px] shadow-sm">B{buttonId}</span>;
  }
};

const getGamepadState = (padMap) => {
   const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
   let gpState = { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false };
   
   for (let i = 0; i < gamepads.length; i++) {
       const gp = gamepads[i];
       if (gp) {
           if (gp.buttons[padMap.up]?.pressed) gpState.up = true;
           if (gp.buttons[padMap.down]?.pressed) gpState.down = true;
           if (gp.buttons[padMap.left]?.pressed) gpState.left = true;
           if (gp.buttons[padMap.right]?.pressed) gpState.right = true;
           
           if (gp.axes[1] < -0.4) gpState.up = true;
           if (gp.axes[1] > 0.4) gpState.down = true;
           if (gp.axes[0] < -0.4) gpState.left = true;
           if (gp.axes[0] > 0.4) gpState.right = true;

           if (gp.buttons[padMap.lp]?.pressed) gpState.lp = true;
           if (gp.buttons[padMap.mp]?.pressed) gpState.mp = true;
           if (gp.buttons[padMap.hp]?.pressed) gpState.hp = true;
           if (gp.buttons[padMap.lk]?.pressed) gpState.lk = true;
           if (gp.buttons[padMap.mk]?.pressed) gpState.mk = true;
           if (gp.buttons[padMap.hk]?.pressed) gpState.hk = true;
       }
   }
   return gpState;
};

// SOCD Cleaning & P1/P2 Mirroring
function getDirection(keys, playerSide) {
  let u = keys.up && !keys.down;
  let d = keys.down && !keys.up;
  let effLeft = playerSide === 'P1' ? keys.left : keys.right;
  let effRight = playerSide === 'P1' ? keys.right : keys.left;
  let l = effLeft && !effRight;
  let r = effRight && !effLeft;

  if (u && l) return 7;
  if (u && r) return 9;
  if (d && l) return 1;
  if (d && r) return 3;
  if (u) return 8;
  if (d) return 2;
  if (l) return 4;
  if (r) return 6;
  return 5;
}

const getChargeFrames = (hArray, dirs) => {
    let chargeFrames = 0;
    let gapFrames = 0;
    let foundCharge = false;
    for (let i = hArray.length - 1; i >= 0; i--) {
        let h = hArray[i];
        if (h.marker) continue;
        if (dirs.includes(h.dir)) {
            chargeFrames += h.frames;
            foundCharge = true;
        } else {
            if (foundCharge) break; 
            gapFrames += h.frames;
            if (gapFrames > 12) return 0; 
        }
    }
    return chargeFrames;
};

const get360Status = (hArray, framesLimit, loopsRequired) => {
    let recentDirs = [];
    let frameCount = 0;
    for (let i = hArray.length - 1; i >= 0; i--) {
        if (hArray[i].marker) continue;
        frameCount += hArray[i].frames;
        if (frameCount > framesLimit) break;
        if (hArray[i].dir !== 5) recentDirs.unshift(hArray[i].dir);
    }
    
    const zones = { 'R': [6, 3, 9], 'D': [2, 1, 3], 'L': [4, 1, 7], 'U': [8, 7, 9] };
    const patterns = [
        ['U', 'R', 'D', 'L'], ['R', 'D', 'L', 'U'], 
        ['D', 'L', 'U', 'R'], ['L', 'U', 'R', 'D']
    ];
    
    let maxProgress = 0;
    let targetLength = loopsRequired * 4;
    
    for (let p of patterns) {
        let fullPattern = [];
        for (let i = 0; i < loopsRequired; i++) fullPattern.push(...p);
        
        let pIndex = 0;
        for (let dir of recentDirs) {
            if (pIndex < fullPattern.length && zones[fullPattern[pIndex]].includes(dir)) { pIndex++; } 
            else if (pIndex > 0 && zones[fullPattern[pIndex - 1]].includes(dir)) { continue; } 
            else if (pIndex > 1 && zones[fullPattern[pIndex - 2]].includes(dir)) { pIndex--; } 
            else {
                pIndex = 0;
                if (zones[fullPattern[0]].includes(dir)) pIndex = 1;
            }
        }
        if (pIndex > maxProgress) maxProgress = pIndex;
        if (maxProgress >= targetLength) break;
    }
    return { isReady: maxProgress >= targetLength, percent: Math.min(100, (maxProgress / targetLength) * 100) };
};

const getLastInputEntry = (history) => {
  for (let i = history.length - 1; i >= 0; i--) {
    if (!history[i].marker) return history[i];
  }
  return history[0];
};

const DirIcon = ({ dir, className, flip = false }) => {
  if (isCommandObject(dir, 'charge')) {
      return (
        <div className={`relative flex items-center justify-center ${className}`}>
          <DirIcon dir={dir.icon} flip={flip} className="w-full h-full text-yellow-500" />
          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 text-[0.35em] font-black text-yellow-500">CHG</span>
        </div>
      );
  }
  if (isCommandObject(dir, 'spin')) return <DirIcon dir={dir.label} className={className} flip={flip} />;
  if (isCommandObject(dir, 'wait')) return <span className={`font-black ${className} text-zinc-400`}>{dir.frames}f</span>;

  if (typeof dir === 'string') {
      if (dir.includes('+')) {
         const [d, a] = dir.split('+');
         return (
           <div className="flex items-center gap-1">
             <DirIcon dir={parseInt(d)} className={className} flip={flip} />
             <span className="text-[10px] font-black text-zinc-400">+</span>
             <DirIcon dir={a} className={className} />
           </div>
         );
      }
      if (dir === '360' || dir === '720') {
         return (
           <div className={`relative flex items-center justify-center ${className} ${flip ? '-scale-x-100' : ''}`}>
               <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"></path>
                  <path d="M21 3v5h-5"></path>
               </svg>
               {dir === '720' && <span className={`absolute text-[0.4em] font-black font-sans text-current ${flip ? '-scale-x-100' : ''}`}>2</span>}
           </div>
         );
      }
      const buttonColor = getButtonColor(dir);
      if (buttonColor) return <span className={`font-black ${className} drop-shadow-md`} style={{ color: buttonColor.text }}>{dir}</span>;
      if (dir === 'P') return <span className={`font-black ${className} text-pink-400 drop-shadow-md`}>{dir}</span>;
      if (dir === 'K') return <span className={`font-black ${className} text-cyan-400 drop-shadow-md`}>{dir}</span>;
  }

  if (dir === 5) return <span className={`font-black ${className}`}>N</span>;

  const angles = { 8: 0, 9: 45, 6: 90, 3: 135, 2: 180, 1: 225, 4: 270, 7: 315 };
  let rot = angles[dir];
  if (flip && dir !== 5 && dir !== 8 && dir !== 2) {
      rot = (360 - rot) % 360;
  }

  return (
    <svg viewBox="0 0 24 24" className={`fill-current ${className}`} style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M 12 2 L 20 12 L 15 12 L 15 22 L 9 22 L 9 12 L 4 12 Z" />
    </svg>
  );
};

function App() {
  const [screen, setScreen] = useState('menu'); 
  const [trainingMode, setTrainingMode] = useState('streak');
  const [playerSide, setPlayerSide] = useState('P1');
  const [activeTab, setActiveTab] = useState('MOTION');
  const [targetMove, setTargetMove] = useState('236P');
  const [successTarget, setSuccessTarget] = useState(10);
  const [reactionScenario, setReactionScenario] = useState('auto');
  const [customMoves, setCustomMoves] = useState({});
  const [editingCustomId, setEditingCustomId] = useState(null);
  const [customDraft, setCustomDraft] = useState(createBlankEditor());
  const [selectedStepId, setSelectedStepId] = useState(null);
  const [draggingStepId, setDraggingStepId] = useState(null);
  const [editorError, setEditorError] = useState('');
  
  const [progressCount, setProgressCount] = useState(0);
  const [stats, setStats] = useState({ successes: 0, failures: 0 });
  const [sessionData, setSessionData] = useState([]); 
  const [successBanner, setSuccessBanner] = useState(null);
  const [hitCounter, setHitCounter] = useState(0);
  const [diagnostics, setDiagnostics] = useState([]); 
  const [records, setRecords] = useState({});
  const [showOptions, setShowOptions] = useState(false);
  const [optionsTab, setOptionsTab] = useState('keyboard');
  const [remappingKey, setRemappingKey] = useState(null);
  const [remappingPadKey, setRemappingPadKey] = useState(null);
  const [keyMap, setKeyMap] = useState(DEFAULT_KEYMAP);
  const [padMap, setPadMap] = useState(DEFAULT_PADMAP);
  
  // Settings
  const [volume, setVolume] = useState(50);
  const [bgmVolume, setBgmVolume] = useState(40);
  const [enableShake, setEnableShake] = useState(true);
  const [shakeStrengthX, setShakeStrengthX] = useState(15);
  const [shakeStrengthY, setShakeStrengthY] = useState(15);
  const [backgroundTheme, setBackgroundTheme] = useState('grid');
  const [spriteMeta, setSpriteMeta] = useState(() => mergeSpriteMeta());
  const [spriteMetaStatus, setSpriteMetaStatus] = useState('Loaded built-in sprite metadata.');
  const [spriteDebugSelected, setSpriteDebugSelected] = useState('opponent_idle');
  const [spriteDebugFrame, setSpriteDebugFrame] = useState('opponent_idle');
  const [spriteDebugSequence, setSpriteDebugSequence] = useState('opponent_idle');
  
  const [, setRenderTick] = useState(0);

  const loopRef = useRef();
  const bgmAudioRef = useRef(null);
  const bgmUnlockedRef = useRef(false);
  const diagnosticRef = useRef([]); 
  const bannerTimeoutRef = useRef(null);
  const resetTriggerRef = useRef(false);
  const allMoves = { ...MOVE_LIST, ...customMoves };
  const curTargetMove = allMoves[targetMove] || MOVE_LIST['236P'];
  
  const stateRef = useRef({
    totalFrames: 0,
    stepGlows: {},
    chargeGlowFrame: -999,
    spinGlowFrame: -999,
    wasChargeReady: false,
    was360Ready: false,
    reaction: null,
    lastReactionFrames: null,
    playerAttackSpriteId: null,
    playerAttackSpriteUntilFrame: -1,
    playerOnHitUntilFrame: -1,
    opponentOnHitUntilFrame: -1,
    inputLockUntilNeutral: false,
    lastFailureFrame: -1,
    shakeFrames: 0,
    shakeType: null, // 'light' | 'heavy' | 'error'
    
    // Engine State
    keys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
    effectiveKeys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
    history: [{ id: 0, dir: 5, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false, frames: 0, matchType: null }],
    nextId: 1,
    progress: 0,
    framesSinceLastProgress: 0,
    waitStepFrames: 0,
    sloppyInputs: 0,
    sequenceFrames: 0,
    sequenceSloppy: 0,
    successesThisSession: 0,
    failuresThisSession: 0,
    attemptsThisSession: 0,
    currentStreak: 0,
    
    // Live Options
    volume: 50,
    enableShake: true
  });

  // Sync Live Options
  useEffect(() => {
     stateRef.current.volume = volume;
     stateRef.current.enableShake = enableShake;
  }, [volume, enableShake]);

  // Load Preferences
  useEffect(() => {
     const savedStats = localStorage.getItem('ftg_trainer_stats');
     if (savedStats) setRecords(JSON.parse(savedStats));
     const savedCustom = localStorage.getItem(CUSTOM_STORAGE_KEY);
     if (savedCustom) setCustomMoves(JSON.parse(savedCustom));
     const savedMap = localStorage.getItem('ftg_keymap');
     if (savedMap) setKeyMap(JSON.parse(savedMap));
     const savedPadMap = localStorage.getItem('ftg_padmap');
     if (savedPadMap) setPadMap(JSON.parse(savedPadMap));
     
     const savedVol = localStorage.getItem('ftg_vol');
     if (savedVol) setVolume(parseInt(savedVol));
     const savedBgmVol = localStorage.getItem('ftg_bgm_vol');
     if (savedBgmVol) setBgmVolume(parseInt(savedBgmVol));
     const savedShake = localStorage.getItem('ftg_shake');
     if (savedShake) setEnableShake(savedShake !== 'false');
     const savedShakeX = localStorage.getItem('ftg_shake_x');
     if (savedShakeX) setShakeStrengthX(parseInt(savedShakeX));
     const savedShakeY = localStorage.getItem('ftg_shake_y');
     if (savedShakeY) setShakeStrengthY(parseInt(savedShakeY));
     const savedBackgroundTheme = localStorage.getItem('ftg_background_theme');
     if (savedBackgroundTheme && TRAINING_BACKGROUND_THEMES[savedBackgroundTheme]) setBackgroundTheme(savedBackgroundTheme);
      loadSpriteMetaFile()
        .then(metadata => {
          setSpriteMeta(mergeSpriteMeta(metadata));
          setSpriteMetaStatus('Loaded project metadata file.');
        })
        .catch(() => {
          const savedSpriteMeta = localStorage.getItem(SPRITE_METADATA_STORAGE_KEY);
          if (!savedSpriteMeta) return;

          try {
            setSpriteMeta(mergeSpriteMeta(JSON.parse(savedSpriteMeta)));
            setSpriteMetaStatus('Loaded browser-only metadata cache.');
          } catch (error) {
            setSpriteMeta(mergeSpriteMeta());
            setSpriteMetaStatus('Loaded built-in sprite metadata.');
          }
        });
  }, []);

  // Save Settings
  useEffect(() => { localStorage.setItem('ftg_keymap', JSON.stringify(keyMap)); }, [keyMap]);
  useEffect(() => { localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(customMoves)); }, [customMoves]);
  useEffect(() => { localStorage.setItem('ftg_padmap', JSON.stringify(padMap)); }, [padMap]);
  useEffect(() => { localStorage.setItem('ftg_vol', volume.toString()); }, [volume]);
  useEffect(() => { localStorage.setItem('ftg_bgm_vol', bgmVolume.toString()); }, [bgmVolume]);
  useEffect(() => { localStorage.setItem('ftg_shake', enableShake.toString()); }, [enableShake]);
  useEffect(() => { localStorage.setItem('ftg_shake_x', shakeStrengthX.toString()); }, [shakeStrengthX]);
  useEffect(() => { localStorage.setItem('ftg_shake_y', shakeStrengthY.toString()); }, [shakeStrengthY]);
  useEffect(() => { localStorage.setItem('ftg_background_theme', backgroundTheme); }, [backgroundTheme]);

  useEffect(() => {
    const bgm = new Audio('./public/assets/BGM/TrainningRoom.mp3');
    bgm.loop = true;
    bgm.preload = 'auto';
    bgm.volume = bgmVolume / 100;
    bgmAudioRef.current = bgm;

    return () => {
      bgm.pause();
      bgmAudioRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bgm = bgmAudioRef.current;
    if (!bgm) return;
    bgm.volume = bgmVolume / 100;
    if (bgmVolume <= 0) {
      bgm.pause();
    } else if (bgmUnlockedRef.current) {
      bgm.play().catch(() => {});
    }
  }, [bgmVolume]);

  useEffect(() => {
    const unlockBgm = () => {
      bgmUnlockedRef.current = true;
      const bgm = bgmAudioRef.current;
      if (!bgm || bgmVolume <= 0) return;
      bgm.play().catch(() => {});
    };

    window.addEventListener('pointerdown', unlockBgm);
    window.addEventListener('keydown', unlockBgm);
    return () => {
      window.removeEventListener('pointerdown', unlockBgm);
      window.removeEventListener('keydown', unlockBgm);
    };
  }, [bgmVolume]);

  useEffect(() => {
    if (screen !== 'spriteDebug') return;
    const sequence = SPRITE_DEBUG_SEQUENCES.find(item => item.id === spriteDebugSequence) || SPRITE_DEBUG_SEQUENCES[0];
    let index = 0;
    setSpriteDebugFrame(sequence.frames[0]);
    setSpriteDebugSelected(sequence.frames[0]);
    if (sequence.frames.length <= 1) return;
    const interval = setInterval(() => {
      index = (index + 1) % sequence.frames.length;
      setSpriteDebugFrame(sequence.frames[index]);
      setSpriteDebugSelected(sequence.frames[index]);
    }, 420);
    return () => clearInterval(interval);
  }, [screen, spriteDebugSequence]);

  // Remapping Listeners
  useEffect(() => {
      if (!remappingKey) return;
      const handleRemap = (e) => {
          e.preventDefault();
          setKeyMap(prev => ({...prev, [remappingKey]: e.code}));
          setRemappingKey(null);
      };
      window.addEventListener('keydown', handleRemap);
      return () => window.removeEventListener('keydown', handleRemap);
  }, [remappingKey]);

  useEffect(() => {
      if (!remappingPadKey) return;
      let rafId;
      const poll = () => {
          const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
          for (let i = 0; i < gamepads.length; i++) {
              const gp = gamepads[i];
              if (!gp) continue;
              for (let b = 0; b < gp.buttons.length; b++) {
                  if (gp.buttons[b].pressed) {
                      setPadMap(prev => ({...prev, [remappingPadKey]: b}));
                      setRemappingPadKey(null);
                      return;
                  }
              }
          }
          rafId = requestAnimationFrame(poll);
      };
      rafId = requestAnimationFrame(poll);
      return () => cancelAnimationFrame(rafId);
  }, [remappingPadKey]);

  // Update Records
  useEffect(() => {
    if (screen === 'results') {
        const successData = sessionData.filter(d => d.type === 'success');
        if (sessionData.length === 0) return;
        
        const avgFrames = successData.length ? Math.round(successData.reduce((a, b) => a + b.frames, 0) / successData.length) : 0;
        const avgPrec = successData.length ? Math.round(successData.reduce((a, b) => a + b.precision, 0) / successData.length) : 0;
        const successRate = sessionData.length ? Math.round((successData.length / sessionData.length) * 100) : 0;

        setRecords(prev => {
            const current = prev[targetMove] || { bestSuccessRate: 0, bestFrames: 9999, bestPrecision: 0 };
            const newRecords = { ...prev };
            newRecords[targetMove] = {
                bestSuccessRate: Math.max(current.bestSuccessRate, successRate),
                bestFrames: (avgFrames > 0 && avgFrames < current.bestFrames) ? avgFrames : current.bestFrames,
                bestPrecision: Math.max(current.bestPrecision, avgPrec)
            };
            localStorage.setItem('ftg_trainer_stats', JSON.stringify(newRecords));
            return newRecords;
        });
    }
  }, [screen]);

  // --- Input Evaluation Engine ---
  const isAntiAirMove = (moveDef, moveId = targetMove) => {
    const seq = moveDef?.sequence || [];
    for (let i = 0; i <= seq.length - 3; i++) {
      if (seq[i] === 6 && seq[i + 1] === 2 && seq[i + 2] === 3) return true;
    }
    return /623|shoryu|anti/i.test(`${moveId} ${moveDef?.name || ''} ${moveDef?.desc || ''}`);
  };

  const resolveReactionScenario = (moveDef, moveId = targetMove) => {
    if (reactionScenario !== 'auto') return reactionScenario;
    return isAntiAirMove(moveDef, moveId) ? 'jump' : 'dash';
  };

  const beginReactionRound = (s, moveDef = curTargetMove, moveId = targetMove) => {
    if (trainingMode !== 'reaction') return;
    s.reaction = makeReactionRound(resolveReactionScenario(moveDef, moveId));
    s.lastReactionFrames = null;
  };

  const addReactionMarker = (s, label, matchType = 'strict') => {
    const last = s.history[s.history.length - 1];
    if (last?.marker && last.label === label) return;
    s.history.push({
      id: `marker_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      marker: true,
      label,
      frames: 0,
      matchType
    });
    if (s.history.length > 40) s.history.shift();
  };

  const getProgressValue = (s) => trainingMode === 'precision' ? s.attemptsThisSession : s.successesThisSession;

  const completeSequence = (s, seq, moveDef) => {
    if (diagnosticRef.current.length > 0) { setDiagnostics([]); diagnosticRef.current = []; }

    if (trainingMode === 'reaction') {
      const scenario = REACTION_SCENARIOS[s.reaction?.scenario] || REACTION_SCENARIOS.dash;
      const actionFrame = s.reaction?.actionFrame ?? -1;
      const tellIsValid = s.reaction?.phase === 'tell' && scenario.tellCountsAsValid !== false;
      const failEntry = getLastInputEntry(s.history);
      if (!s.reaction || (s.reaction.phase !== 'active' && !tellIsValid)) {
        const tooEarlyBy = s.reaction?.phase === 'tell'
          ? Math.max(1, (scenario.tellFrames || 0) - (s.reaction.tellFrame || 0) + scenario.validStart)
          : Math.max(1, (s.reaction?.delayFrames || 0) - (s.reaction?.delayFrame || 0) + (scenario.tellFrames || 0) + scenario.validStart);
        registerFailure(s, failEntry, `Too early by ${tooEarlyBy}f. Wait for ${scenario.label} cue.`, 'TOO EARLY');
        return;
      }
      if (!tellIsValid && actionFrame < scenario.validStart) {
        registerFailure(s, failEntry, `Too early by ${scenario.validStart - actionFrame}f. Correct window starts at ${scenario.validStart}f.`, 'TOO EARLY');
        return;
      }
      if (!tellIsValid && actionFrame > scenario.validEnd) {
        registerFailure(s, failEntry, `Too late by ${actionFrame - scenario.validEnd}f. Correct window ended at ${scenario.validEnd}f.`, 'TOO LATE');
        return;
      }
      s.lastReactionFrames = tellIsValid ? 0 : actionFrame - scenario.validStart;
    }

    s.successesThisSession++;
    s.attemptsThisSession++;
    s.currentStreak++;
    s.playerAttackSpriteId = getReactionPlayerAttackSpriteId(targetMove);
    s.playerAttackSpriteUntilFrame = s.totalFrames + PLAYER_ATTACK_POSE_FRAMES;
    if (trainingMode === 'reaction') s.opponentOnHitUntilFrame = s.totalFrames + ON_HIT_POSE_FRAMES;
    setHitCounter(s.currentStreak);

    const lenFrames = s.sequenceFrames;
    const lenSecs = (lenFrames / 60).toFixed(2);
    let baseSeqLength = seq.length + (moveDef.charge ? 1 : 0) + (moveDef.require360 ? moveDef.require360.count * 4 : 0);
    const prec = Math.round((baseSeqLength / (baseSeqLength + s.sequenceSloppy)) * 100);

    const dataPoint = {
      id: Date.now(),
      type: 'success',
      frames: lenFrames,
      seconds: lenSecs,
      precision: prec,
      reactionFrames: trainingMode === 'reaction' ? s.lastReactionFrames : null,
      scenario: trainingMode === 'reaction' ? s.reaction?.scenario : null
    };
    setSessionData(prev => [...prev, dataPoint]);

    setSuccessBanner(dataPoint);
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    bannerTimeoutRef.current = setTimeout(() => setSuccessBanner(null), 2500);

    s.progress = 0; s.framesSinceLastProgress = 0; s.waitStepFrames = 0; s.sequenceFrames = 0; s.sequenceSloppy = 0;
    if (trainingMode === 'reaction') beginReactionRound(s, moveDef);

    setStats({ successes: s.successesThisSession, failures: s.failuresThisSession });
    setProgressCount(getProgressValue(s));

    if (trainingMode === 'streak' && s.successesThisSession >= successTarget) setScreen('results');
    else if (trainingMode === 'reaction' && s.successesThisSession >= successTarget) setScreen('results');
    else if (trainingMode === 'precision' && s.attemptsThisSession >= successTarget) setScreen('results');
  };

  const registerFailure = (s, pEntry, failDetail, failTitle = "DROPPED COMBO") => {
    if (s.lastFailureFrame === s.totalFrames) return;
    s.lastFailureFrame = s.totalFrames;
    playSFX('error', s.volume);
    if (s.enableShake) { s.shakeFrames = 15; s.shakeType = 'error'; }

    const diagObj = { id: Date.now(), title: failTitle, detail: failDetail, step: s.progress };
    setDiagnostics(prev => [...prev.slice(-1), diagObj]);
    diagnosticRef.current = [...diagnosticRef.current.slice(-1), diagObj];

    s.failuresThisSession++;
    s.attemptsThisSession++;
    s.currentStreak = 0;
    setHitCounter(0);
    if (trainingMode === 'reaction' && failTitle === 'TOO LATE') s.playerOnHitUntilFrame = s.totalFrames + ON_HIT_POSE_FRAMES;

    if (trainingMode === 'streak') {
       s.successesThisSession = 0; s.attemptsThisSession = 0; setSessionData([]);
    } else {
       setSessionData(prev => [...prev, { id: Date.now(), type: 'error', reason: failDetail }]);
    }

    if (pEntry) { pEntry.matchType = 'error'; pEntry.errorReason = failDetail; }
    s.progress = 0; s.framesSinceLastProgress = 0; s.waitStepFrames = 0; s.sloppyInputs = 0; s.sequenceFrames = 0; s.sequenceSloppy = 0;
    if (trainingMode === 'reaction') {
      s.inputLockUntilNeutral = true;
      beginReactionRound(s, allMoves[targetMove] || MOVE_LIST['236P']);
    }

    setStats({ successes: s.successesThisSession, failures: s.failuresThisSession });
    setProgressCount(getProgressValue(s));

    if (trainingMode === 'precision' && s.attemptsThisSession >= successTarget) setScreen('results');
  };

  const evaluateInput = (pEntry) => {
    let s = stateRef.current;
    let moveDef = allMoves[targetMove] || MOVE_LIST['236P'];
    let seq = moveDef.sequence;
    let expected = seq[s.progress];
    let lastEntry = getLastInputEntry(s.history.slice(0, -1)) || s.history[0];

    // Priority extraction for simultaneous inputs
    let actionPressed = null;
    if (pEntry.hp && !lastEntry.hp) actionPressed = 'HP';
    else if (pEntry.mp && !lastEntry.mp) actionPressed = 'MP';
    else if (pEntry.lp && !lastEntry.lp) actionPressed = 'LP';
    else if (pEntry.hk && !lastEntry.hk) actionPressed = 'HK';
    else if (pEntry.mk && !lastEntry.mk) actionPressed = 'MK';
    else if (pEntry.lk && !lastEntry.lk) actionPressed = 'LK';

    const isPunch = (act) => ['LP', 'MP', 'HP'].includes(act);
    const isKick = (act) => ['LK', 'MK', 'HK'].includes(act);

    let matched = false;
    let consumedAction = null;

    if (typeof expected === 'string' && expected.includes('+')) {
      const [reqDirStr, reqAction] = expected.split('+');
      if (pEntry.dir === parseInt(reqDirStr)) {
          if (reqAction === 'P' && isPunch(actionPressed)) { matched = true; consumedAction = actionPressed; }
          else if (reqAction === 'K' && isKick(actionPressed)) { matched = true; consumedAction = actionPressed; }
          else if (reqAction === actionPressed) { matched = true; consumedAction = actionPressed; }
      }
    } 
    else if (expected === 'P' && isPunch(actionPressed)) { matched = true; consumedAction = actionPressed; }
    else if (expected === 'K' && isKick(actionPressed)) { matched = true; consumedAction = actionPressed; }
    else if (expected === actionPressed) { matched = true; consumedAction = actionPressed; }
    else if (typeof expected === 'number' && pEntry.dir === expected && pEntry.dir !== lastEntry.dir) {
       matched = true;
    }

    if (matched && s.progress === 0) {
        if (moveDef.charge && getChargeFrames(s.history, moveDef.charge.dirs) < moveDef.charge.frames) matched = false;
        if (moveDef.require360 && !get360Status(s.history, moveDef.require360.frames, moveDef.require360.count).isReady) matched = false;
    }

    let failed = false;
    let failDetail = "";
    let failTitle = s.progress === 0 ? "NO BUFFER" : "DROPPED COMBO";
    let oldProgress = s.progress;

    if (matched) {
      pEntry.matchType = s.sloppyInputs > 0 ? 'fuzzy' : 'strict';
      s.progress++;
      s.framesSinceLastProgress = 0;
      s.stepGlows[s.progress - 1] = s.totalFrames;

      if (actionPressed && consumedAction !== actionPressed) {
          let nextExp = seq[s.progress];
          let nextPlusMatch = false;
          if (typeof nextExp === 'string' && nextExp.includes('+')) {
              const [nextDirStr, nextAction] = nextExp.split('+');
              nextPlusMatch = pEntry.dir === parseInt(nextDirStr) && (
                  (nextAction === 'P' && isPunch(actionPressed)) ||
                  (nextAction === 'K' && isKick(actionPressed)) ||
                  nextAction === actionPressed
              );
          }
          if (s.progress < seq.length && (
              (nextExp === 'P' && isPunch(actionPressed)) || 
              (nextExp === 'K' && isKick(actionPressed)) || 
              (nextExp === actionPressed) ||
              nextPlusMatch
          )) {
              s.progress++;
              consumedAction = actionPressed;
              s.stepGlows[s.progress - 1] = s.totalFrames;
          } else {
              failed = true;
              failDetail = `Pressed ${ERROR_MAP[actionPressed] || actionPressed} too early. Expected ${commandLabel(nextExp)}.`;
          }
      }

      if (!failed) {
          // Play Audio / Visuals for Successful Hit
          if (actionPressed) {
              playSFX(actionPressed, s.volume);
              if (s.enableShake) {
                 if (s.progress === seq.length) { s.shakeFrames = 15; s.shakeType = 'heavy'; }
                 else { s.shakeFrames = 8; s.shakeType = 'light'; }
              }
          }

          if (s.sloppyInputs > 0) s.sequenceSloppy += s.sloppyInputs;
          s.sloppyInputs = 0; 

          if (oldProgress === 0 && s.progress > 0) {
              s.sequenceFrames = 1; 
              if (moveDef.charge) {
                  let gapFrames = 0; let foundCharge = false;
                  for (let i = s.history.length - 2; i >= 0; i--) {
                      let h = s.history[i];
                      if (moveDef.charge.dirs.includes(h.dir)) {
                          h.matchType = (h.dir === moveDef.charge.icon) ? 'strict' : 'fuzzy';
                          if (h.matchType === 'fuzzy') s.sequenceSloppy += 1;
                          s.sequenceFrames += h.frames; foundCharge = true;
                      } else {
                          if (foundCharge) break;
                          gapFrames += h.frames; if (gapFrames > 12) break;
                          h.matchType = 'fuzzy'; s.sequenceSloppy += 1; s.sequenceFrames += h.frames;
                      }
                  }
              }
              if (moveDef.require360) {
                  let framesAdded = 0;
                  for (let i = s.history.length - 2; i >= 0; i--) {
                      let h = s.history[i];
                      if (framesAdded + h.frames > moveDef.require360.frames) {
                          h.matchType = (h.dir === 5) ? 'fuzzy' : 'strict';
                          if (h.matchType === 'fuzzy') s.sequenceSloppy += 1;
                          s.sequenceFrames += (moveDef.require360.frames - framesAdded); break;
                      }
                      h.matchType = (h.dir === 5) ? 'fuzzy' : 'strict';
                      if (h.matchType === 'fuzzy') s.sequenceSloppy += 1;
                      s.sequenceFrames += h.frames; framesAdded += h.frames;
                  }
              }
          }
          
          if (s.progress === seq.length) {
            completeSequence(s, seq, moveDef);
          }
      }
    } 
    
    if (!matched || failed) {
      if (!failed && actionPressed) {
        failed = true;
        let expectedStr = commandLabel(expected);
        if (expectedStr === undefined && typeof expected === 'number') expectedStr = `Direction (${expected})`;
        failDetail = `Expected ${expectedStr}, got ${ERROR_MAP[actionPressed] || actionPressed}.`;

        if (s.progress === 0) {
            if (moveDef.charge) failDetail = `Charge not ready! Needed ${moveDef.charge.frames}f of ${moveDef.charge.label}.`;
            if (moveDef.require360) failDetail = `Motion incomplete! Needed ${moveDef.require360.label} before pressing ${actionPressed}.`;
        }
        if (isCommandObject(expected, 'charge')) failDetail = `Charge not ready! Needed ${expected.frames}f of ${expected.label}.`;
        if (isCommandObject(expected, 'spin')) failDetail = `Motion incomplete! Needed ${expected.label} before pressing ${actionPressed}.`;
        if (isCommandObject(expected, 'wait')) failDetail = `Wait failed! No inputs for ${expected.frames}f.`;
      }

      if (failed) {
        registerFailure(s, pEntry, failDetail, failTitle);
      } else if (pEntry.dir !== 5) {
        let isHoldingPrev = false;
        if (s.progress > 0) {
           let prevMatched = seq[s.progress - 1];
           if (typeof prevMatched === 'number' && pEntry.dir === prevMatched) isHoldingPrev = true;
           else if (typeof prevMatched === 'string' && prevMatched.includes('+')) {
               if (pEntry.dir === parseInt(prevMatched.split('+')[0])) isHoldingPrev = true;
           }
        }
        if (!isHoldingPrev && s.progress > 0) s.sloppyInputs++;
      }
    }
  };

  const updateReactionRound = (s) => {
    if (trainingMode !== 'reaction') return false;
    const moveDef = allMoves[targetMove] || MOVE_LIST['236P'];
    if (!s.reaction) beginReactionRound(s, moveDef);
    const r = s.reaction;
    const scenario = REACTION_SCENARIOS[r.scenario] || REACTION_SCENARIOS.dash;

    if (r.phase === 'delay') {
      r.delayFrame++;
      r.x = scenario.startX;
      r.y = scenario.startY;
      r.valid = false;
      if (r.delayFrame >= r.delayFrames) {
        r.phase = scenario.tellFrames ? 'tell' : 'active';
        r.actionFrame = 0;
        r.tellFrame = 0;
      }
      return false;
    }

    if (r.phase === 'tell') {
      r.tellFrame++;
      r.x = scenario.startX;
      r.y = 0;
      r.valid = scenario.tellCountsAsValid !== false;
      if (r.valid && r.tellFrame === 1) addReactionMarker(s, 'TIMING START', 'strict');
      if (r.tellFrame >= scenario.tellFrames) {
        r.phase = 'active';
        r.actionFrame = 0;
      }
      return false;
    }

    if (r.phase !== 'active') return false;

    r.actionFrame++;
    if (r.actionFrame === scenario.validStart) addReactionMarker(s, 'TIMING START', 'strict');
    if (r.actionFrame === scenario.validEnd + 1) addReactionMarker(s, 'TIMING END', 'fuzzy');
    const t = Math.min(1, r.actionFrame / scenario.endFrame);

    if (scenario.id === 'dash') {
      const eased = 1 - Math.pow(1 - t, 3);
      r.x = scenario.startX + (scenario.endX - scenario.startX) * eased;
      r.y = 0;
    } else {
      r.x = scenario.startX + (scenario.endX - scenario.startX) * t;
      r.y = Math.sin(Math.PI * t) * scenario.apex;
    }

    r.valid = r.actionFrame >= scenario.validStart && r.actionFrame <= scenario.validEnd;

    if (r.actionFrame > scenario.endFrame) {
      registerFailure(s, getLastInputEntry(s.history), `Too late. ${scenario.label} reached you.`, 'TOO LATE');
      return true;
    }

    return false;
  };

  // --- Game Loop ---
  useEffect(() => {
    if (screen !== 'training') return;

    const handleKeyDown = (e) => {
      initAudio(); // Required by browser policy
      if (e.repeat) return;
      if (e.code === 'KeyR') { resetTriggerRef.current = true; return; }
      let k = stateRef.current.keys;
      
      if (e.code === keyMap.up || e.code === 'ArrowUp') k.up = true;
      if (e.code === keyMap.down || e.code === 'ArrowDown') k.down = true;
      if (e.code === keyMap.left || e.code === 'ArrowLeft') k.left = true;
      if (e.code === keyMap.right || e.code === 'ArrowRight') k.right = true;
      
      if (e.code === keyMap.lp) k.lp = true;
      if (e.code === keyMap.mp) k.mp = true;
      if (e.code === keyMap.hp) k.hp = true;
      if (e.code === keyMap.lk) k.lk = true;
      if (e.code === keyMap.mk) k.mk = true;
      if (e.code === keyMap.hk) k.hk = true;
    };

    const handleKeyUp = (e) => {
      let k = stateRef.current.keys;
      
      if (e.code === keyMap.up || e.code === 'ArrowUp') k.up = false;
      if (e.code === keyMap.down || e.code === 'ArrowDown') k.down = false;
      if (e.code === keyMap.left || e.code === 'ArrowLeft') k.left = false;
      if (e.code === keyMap.right || e.code === 'ArrowRight') k.right = false;
      
      if (e.code === keyMap.lp) k.lp = false;
      if (e.code === keyMap.mp) k.mp = false;
      if (e.code === keyMap.hp) k.hp = false;
      if (e.code === keyMap.lk) k.lk = false;
      if (e.code === keyMap.mk) k.mk = false;
      if (e.code === keyMap.hk) k.hk = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const loop = () => {
      if (resetTriggerRef.current) {
          resetTriggerRef.current = false;
          stateRef.current.totalFrames = 0; stateRef.current.stepGlows = {};
          stateRef.current.chargeGlowFrame = -999; stateRef.current.spinGlowFrame = -999;
          stateRef.current.wasChargeReady = false; stateRef.current.was360Ready = false;
          stateRef.current.reaction = null; stateRef.current.lastReactionFrames = null; stateRef.current.playerAttackSpriteId = null; stateRef.current.playerAttackSpriteUntilFrame = -1; stateRef.current.playerOnHitUntilFrame = -1; stateRef.current.opponentOnHitUntilFrame = -1; stateRef.current.inputLockUntilNeutral = false; stateRef.current.lastFailureFrame = -1;
          stateRef.current.keys = { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false };
          stateRef.current.effectiveKeys = { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false };
          stateRef.current.successesThisSession = 0; stateRef.current.failuresThisSession = 0; stateRef.current.attemptsThisSession = 0;
          stateRef.current.progress = 0; stateRef.current.framesSinceLastProgress = 0; stateRef.current.waitStepFrames = 0; stateRef.current.sloppyInputs = 0;
          stateRef.current.sequenceFrames = 0; stateRef.current.sequenceSloppy = 0; stateRef.current.currentStreak = 0;
          stateRef.current.history = [{ id: Date.now(), dir: 5, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false, frames: 0, matchType: null }];
          beginReactionRound(stateRef.current, allMoves[targetMove] || MOVE_LIST['236P']);
          setProgressCount(0); setHitCounter(0); setStats({ successes: 0, failures: 0 }); setSessionData([]); setDiagnostics([]);
          diagnosticRef.current = []; setSuccessBanner(null);
      }

      let s = stateRef.current;
      s.totalFrames++;
      if (s.progress > 0) s.sequenceFrames++;
      if (s.shakeFrames > 0) s.shakeFrames--;
      const reactionStoppedFrame = updateReactionRound(s);

      let gp = getGamepadState(padMap);
      let k = s.keys;
      
      let eff = {
         up: k.up || gp.up, down: k.down || gp.down, left: k.left || gp.left, right: k.right || gp.right,
         lp: k.lp || gp.lp, mp: k.mp || gp.mp, hp: k.hp || gp.hp,
         lk: k.lk || gp.lk, mk: k.mk || gp.mk, hk: k.hk || gp.hk
      };
      s.effectiveKeys = eff;

      let currentDir = getDirection(eff, playerSide);
      let cLp = eff.lp; let cMp = eff.mp; let cHp = eff.hp;
      let cLk = eff.lk; let cMk = eff.mk; let cHk = eff.hk;
      let lastEntry = getLastInputEntry(s.history);

      let dirChanged = currentDir !== lastEntry.dir;
      let actionChanged = (cLp !== lastEntry.lp || cMp !== lastEntry.mp || cHp !== lastEntry.hp || cLk !== lastEntry.lk || cMk !== lastEntry.mk || cHk !== lastEntry.hk);
      let anyActionPressed = (cLp || cMp || cHp || cLk || cMk || cHk);
      if (trainingMode === 'reaction' && s.inputLockUntilNeutral) {
        if (currentDir === 5 && !anyActionPressed) s.inputLockUntilNeutral = false;
        setRenderTick(t => t + 1);
        loopRef.current = requestAnimationFrame(loop);
        return;
      }
      if (reactionStoppedFrame) {
        setRenderTick(t => t + 1);
        loopRef.current = requestAnimationFrame(loop);
        return;
      }
      if (trainingMode === 'reaction') {
        const r = s.reaction;
        const actionStarted = actionChanged && anyActionPressed;
        const scenario = REACTION_SCENARIOS[r?.scenario] || REACTION_SCENARIOS.dash;
        const tellIsValid = r?.phase === 'tell' && scenario.tellCountsAsValid !== false;
        const tooEarly = r && (r.phase === 'delay' || (r.phase === 'tell' && !tellIsValid) || (r.phase === 'active' && r.actionFrame < scenario.validStart));
        if (actionStarted && tooEarly) {
          const tooEarlyBy = r.phase === 'active'
            ? scenario.validStart - r.actionFrame
            : r.phase === 'tell'
              ? Math.max(1, (scenario.tellFrames || 0) - (r.tellFrame || 0) + scenario.validStart)
              : Math.max(1, (r.delayFrames || 0) - (r.delayFrame || 0) + (scenario.tellFrames || 0) + scenario.validStart);
          registerFailure(s, lastEntry, `Too early by ${tooEarlyBy}f. Wait for ${scenario.label} cue.`, 'TOO EARLY');
          setRenderTick(t => t + 1);
          loopRef.current = requestAnimationFrame(loop);
          return;
        }
      }
      let activeMoveForPassive = allMoves[targetMove] || MOVE_LIST['236P'];
      let expectedPassive = activeMoveForPassive.sequence[s.progress];

      const advancePassiveStep = () => {
        if (s.progress === 0) s.sequenceFrames = 1;
        s.progress++;
        s.framesSinceLastProgress = 0;
        s.waitStepFrames = 0;
        s.stepGlows[s.progress - 1] = s.totalFrames;
        if (s.progress === activeMoveForPassive.sequence.length) {
          completeSequence(s, activeMoveForPassive.sequence, activeMoveForPassive);
          return true;
        }
        return false;
      };

      if (isCommandObject(expectedPassive, 'charge')) {
        if (getChargeFrames(s.history, expectedPassive.dirs) >= expectedPassive.frames) {
          if (advancePassiveStep()) {
            setRenderTick(t => t + 1);
            loopRef.current = requestAnimationFrame(loop);
            return;
          }
          expectedPassive = activeMoveForPassive.sequence[s.progress];
        }
      }

      if (isCommandObject(expectedPassive, 'spin')) {
        if (get360Status(s.history, expectedPassive.frames, expectedPassive.count).isReady) {
          if (advancePassiveStep()) {
            setRenderTick(t => t + 1);
            loopRef.current = requestAnimationFrame(loop);
            return;
          }
          expectedPassive = activeMoveForPassive.sequence[s.progress];
        }
      }

      if (isCommandObject(expectedPassive, 'wait')) {
        if (currentDir === 5 && !anyActionPressed) {
          s.waitStepFrames++;
          if (s.waitStepFrames >= expectedPassive.frames) {
            if (advancePassiveStep()) {
              setRenderTick(t => t + 1);
              loopRef.current = requestAnimationFrame(loop);
              return;
            }
          }
        } else {
          registerFailure(s, lastEntry, `Wait failed! No inputs for ${expectedPassive.frames}f.`, "DROPPED COMBO");
        }
      } else {
        s.waitStepFrames = 0;
      }

      if (!dirChanged && !actionChanged) {
        lastEntry.frames += 1;
        let activeMove = allMoves[targetMove] || MOVE_LIST['236P'];
        let prevMatched = s.progress > 0 ? activeMove.sequence[s.progress - 1] : null;
        let isHoldingPrev = false;
        if (typeof prevMatched === 'number' && currentDir === prevMatched) isHoldingPrev = true;
        else if (typeof prevMatched === 'string' && prevMatched.includes('+')) {
            if (currentDir === parseInt(prevMatched.split('+')[0])) isHoldingPrev = true;
        }
        if (!isHoldingPrev && s.progress > 0) s.framesSinceLastProgress += 1;
      } else {
        if (actionChanged && anyActionPressed) {
           if (diagnosticRef.current.length > 0) { setDiagnostics([]); diagnosticRef.current = []; }
           initAudio(); // Gamepad fallback auth
        }

        let newEntry = { 
          id: s.nextId++, dir: currentDir, lp: cLp, mp: cMp, hp: cHp, lk: cLk, mk: cMk, hk: cHk,
          frames: 1, matchType: null, errorReason: null 
        };
        s.history.push(newEntry);
        if (s.history.length > 40) s.history.shift();

        evaluateInput(newEntry);
      }

      // Proactive Timeout Evaluation 
      if (s.progress > 0) {
         let activeMove = allMoves[targetMove] || MOVE_LIST['236P'];
         let currentExpected = activeMove.sequence[s.progress];
         if (isCommandObject(currentExpected)) {
            setRenderTick(t => t + 1);
            loopRef.current = requestAnimationFrame(loop);
            return;
         }
         if (trainingMode === 'reaction') {
            setRenderTick(t => t + 1);
            loopRef.current = requestAnimationFrame(loop);
            return;
         }
         let prevMatched = activeMove.sequence[s.progress - 1];
         let isComboLink = typeof prevMatched === 'string' && (prevMatched.includes('P') || prevMatched.includes('K') || prevMatched.includes('HP'));
         let timeoutLimit = isComboLink ? 45 : 12; 
         
         if (s.framesSinceLastProgress > timeoutLimit) {
            let failDetail = `Input was too slow. You took longer than ${timeoutLimit} frames.`;
            let pEntry = getLastInputEntry(s.history);
            registerFailure(s, pEntry, failDetail, "DROPPED COMBO");
         }
      }

      const glowMove = allMoves[targetMove] || MOVE_LIST['236P'];
      const chargeReadyNow = glowMove.charge ? getChargeFrames(s.history, glowMove.charge.dirs) >= glowMove.charge.frames : false;
      const spinReadyNow = glowMove.require360 ? get360Status(s.history, glowMove.require360.frames, glowMove.require360.count).isReady : false;

      if (chargeReadyNow && !s.wasChargeReady) s.chargeGlowFrame = s.totalFrames;
      if (spinReadyNow && !s.was360Ready) s.spinGlowFrame = s.totalFrames;
      s.wasChargeReady = chargeReadyNow;
      s.was360Ready = spinReadyNow;
      
      setRenderTick(t => t + 1);
      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(loopRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [screen, targetMove, trainingMode, successTarget, playerSide, keyMap, padMap, customMoves, reactionScenario]);

  const startTraining = (moveId) => {
    initAudio();
    const nextMoveId = moveId || targetMove;
    const nextMoveDef = allMoves[nextMoveId] || MOVE_LIST['236P'];
    setTargetMove(nextMoveId);
    setProgressCount(0); setHitCounter(0); setStats({ successes: 0, failures: 0 }); setSessionData([]); setDiagnostics([]);
    setSuccessBanner(null); diagnosticRef.current = [];
    stateRef.current = {
       totalFrames: 0, stepGlows: {}, chargeGlowFrame: -999, spinGlowFrame: -999,
       wasChargeReady: false, was360Ready: false,
       reaction: trainingMode === 'reaction' ? makeReactionRound(resolveReactionScenario(nextMoveDef, nextMoveId)) : null,
       lastReactionFrames: null,
       playerAttackSpriteId: null,
       playerAttackSpriteUntilFrame: -1,
       playerOnHitUntilFrame: -1,
       opponentOnHitUntilFrame: -1,
       inputLockUntilNeutral: false,
       lastFailureFrame: -1,
       shakeFrames: 0, shakeType: null,
       keys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
       effectiveKeys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
       history: [{ id: Date.now(), dir: 5, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false, frames: 0, matchType: null }],
       nextId: 1,
       progress: 0, framesSinceLastProgress: 0, waitStepFrames: 0, sloppyInputs: 0, sequenceFrames: 0, sequenceSloppy: 0,
       successesThisSession: 0, failuresThisSession: 0, attemptsThisSession: 0, currentStreak: 0,
       volume: volume, enableShake: enableShake
    };
    setScreen('training');
  };

  const handleManualReset = () => { resetTriggerRef.current = true; };

  const clearRecords = () => {
    localStorage.removeItem('ftg_trainer_stats');
    setRecords({});
    setShowOptions(false);
  };

  const openNewCustomEditor = () => {
    setEditingCustomId(null);
    setCustomDraft(createBlankEditor());
    setSelectedStepId(null);
    setEditorError('');
    setScreen('customEditor');
  };

  const openExistingCustomEditor = (id) => {
    setEditingCustomId(id);
    setCustomDraft(hydrateEditor(customMoves[id]));
    setSelectedStepId(null);
    setEditorError('');
    setScreen('customEditor');
  };

  const applyPresetToDraft = (presetId, insertIndex = null) => {
    const preset = COMMAND_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const newSteps = cloneEditorSteps(preset.steps);
    setCustomDraft(prev => {
      const steps = [...prev.steps];
      const index = insertIndex === null ? steps.length : Math.max(0, Math.min(insertIndex, steps.length));
      steps.splice(index, 0, ...newSteps);
      return {
        ...prev,
        steps
      };
    });
    if (newSteps[0]) setSelectedStepId(newSteps[0].id);
  };

  const moveDraftStep = (dragId, targetId) => {
    if (!dragId || !targetId || dragId === targetId) return;
    setCustomDraft(prev => {
      const steps = [...prev.steps];
      const from = steps.findIndex(step => step.id === dragId);
      const to = steps.findIndex(step => step.id === targetId);
      if (from < 0 || to < 0) return prev;
      const [step] = steps.splice(from, 1);
      steps.splice(to, 0, step);
      return { ...prev, steps };
    });
  };

  const updateDraftStep = (id, patch) => {
    setCustomDraft(prev => ({
      ...prev,
      steps: prev.steps.map(step => step.id === id ? { ...step, ...patch } : step)
    }));
  };

  const deleteDraftStep = (id) => {
    setCustomDraft(prev => ({ ...prev, steps: prev.steps.filter(step => step.id !== id) }));
    if (selectedStepId === id) setSelectedStepId(null);
  };

  const duplicateDraftStep = (id) => {
    setCustomDraft(prev => {
      const idx = prev.steps.findIndex(step => step.id === id);
      if (idx < 0) return prev;
      const copy = { ...prev.steps[idx], id: `step_${Date.now()}_${Math.random().toString(36).slice(2)}` };
      const steps = [...prev.steps];
      steps.splice(idx + 1, 0, copy);
      return { ...prev, steps };
    });
  };

  const saveCustomDraft = () => {
    const move = compileCustomMove(customDraft, editingCustomId);
    if (!customDraft.name.trim()) {
      setEditorError('Name required.');
      return null;
    }
    if (move.sequence.length === 0) {
      setEditorError('Add at least one command.');
      return null;
    }
    const id = editingCustomId || `custom_${Date.now()}`;
    const finalMove = { ...move, id };
    setCustomMoves(prev => ({ ...prev, [id]: finalMove }));
    setEditingCustomId(id);
    setTargetMove(id);
    setActiveTab('CUSTOM');
    setEditorError('');
    return { id, move: finalMove };
  };

  const saveCustomAndReturn = () => {
    const saved = saveCustomDraft();
    if (saved) setScreen('menu');
  };

  const saveCustomAndTrain = () => {
    const saved = saveCustomDraft();
    if (saved) startTraining(saved.id);
  };

  const deleteCustomMove = () => {
    if (!editingCustomId) {
      setScreen('menu');
      return;
    }
    setCustomMoves(prev => {
      const next = { ...prev };
      delete next[editingCustomId];
      return next;
    });
    if (targetMove === editingCustomId) setTargetMove('236P');
    setEditingCustomId(null);
    setActiveTab('CUSTOM');
    setScreen('menu');
  };

  const renderKeyBind = (label, keyId) => (
     <div className="flex justify-between items-center mb-3">
        <span className="text-zinc-400 text-xs font-bold uppercase">{label}</span>
        <button 
           onClick={() => setRemappingKey(keyId)}
           className={`w-24 py-1 text-xs font-mono rounded border transition-colors ${remappingKey === keyId ? 'bg-cyan-500 border-cyan-400 text-black animate-pulse' : 'bg-zinc-800 border-zinc-600 text-zinc-300 hover:border-cyan-400 hover:text-white'}`}
        >
           {remappingKey === keyId ? 'PRESS...' : formatKey(keyMap[keyId])}
        </button>
     </div>
  );

  const renderPadBind = (label, keyId) => (
     <div className="flex justify-between items-center mb-3">
        <span className="text-zinc-400 text-xs font-bold uppercase">{label}</span>
        <button 
           onClick={() => setRemappingPadKey(keyId)}
           className={`w-24 h-7 flex items-center justify-center rounded border transition-colors ${remappingPadKey === keyId ? 'bg-cyan-500 border-cyan-400 text-black animate-pulse' : 'bg-zinc-800 border-zinc-600 hover:border-cyan-400'}`}
        >
           {remappingPadKey === keyId ? <span className="text-[10px] font-black tracking-widest text-black">PRESS...</span> : <XboxIcon buttonId={padMap[keyId]} />}
        </button>
     </div>
  );

  const updateSpriteMeta = (spriteId, patch) => {
    setSpriteMeta(prev => mergeSpriteMeta({
      ...prev,
      [spriteId]: { ...(prev[spriteId] || DEFAULT_REACTION_SPRITE_META[spriteId]), ...patch }
    }));
  };

  const saveSpriteMeta = async () => {
    const merged = mergeSpriteMeta(spriteMeta);
    setSpriteMeta(merged);
    setSpriteMetaStatus('Saving metadata file...');
    try {
      await saveSpriteMetaFile(merged);
      localStorage.setItem(SPRITE_METADATA_STORAGE_KEY, JSON.stringify(merged));
      setSpriteMetaStatus('Saved to public/assets/sprites/reaction/metadata.json.');
    } catch (error) {
      localStorage.setItem(SPRITE_METADATA_STORAGE_KEY, JSON.stringify(merged));
      setSpriteMetaStatus(`Saved to browser cache only: ${error.message}`);
    }
  };

  const resetSpriteMeta = () => {
    const defaults = mergeSpriteMeta();
    setSpriteMeta(defaults);
    localStorage.removeItem(SPRITE_METADATA_STORAGE_KEY);
    setSpriteMetaStatus('Reset in the editor. Save to update the metadata file.');
  };

  const renderSpritePreview = (spriteId, facing = 1) => {
    const sprite = REACTION_SPRITE_BY_ID[spriteId] || REACTION_SPRITE_BY_ID.player_idle;
    const meta = spriteMeta[spriteId] || DEFAULT_REACTION_SPRITE_META[spriteId] || DEFAULT_REACTION_SPRITE_META.player_idle;
    return (
      <div className="absolute bottom-0 left-1/2 h-96 w-[42rem] -translate-x-1/2" style={{ transform: `translateX(-50%) scaleX(${facing})` }}>
        <img
          src={sprite.src}
          alt=""
          className="absolute w-auto max-w-none -translate-x-1/2"
          style={{
            imageRendering: 'pixelated',
            height: `${meta.height}px`,
            left: `calc(50% + ${meta.x}px)`,
            bottom: `${meta.y}px`,
            filter: `
              drop-shadow(3px 0 0 rgba(255,255,255,0.92))
              drop-shadow(-3px 0 0 rgba(255,255,255,0.92))
              drop-shadow(0 3px 0 rgba(255,255,255,0.92))
              drop-shadow(0 -3px 0 rgba(255,255,255,0.92))
              drop-shadow(0 0 18px rgba(34,211,238,0.7))
            `
          }}
          draggable={false}
        />
      </div>
    );
  };

  const renderOptionsModal = () => {
     if (!showOptions) return null;
     return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm">
           <div className="bg-zinc-900 border-2 border-zinc-800 p-8 rounded-lg w-[32rem] max-h-[90vh] overflow-y-auto flex flex-col relative shadow-2xl">
              <button onClick={() => {setShowOptions(false); setRemappingKey(null); setRemappingPadKey(null);}} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">✕</button>
              <h2 className="text-3xl font-black italic text-cyan-400 tracking-widest mb-8">OPTIONS</h2>
              
              <div className="mb-4">
                 <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex justify-between">
                    <span>SFX Volume</span> <span>{volume}%</span>
                 </label>
                 <input type="range" min="0" max="100" value={volume} onChange={(e)=>setVolume(e.target.value)} className="w-full accent-cyan-400" />
              </div>

              <div className="mb-4">
                 <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex justify-between">
                    <span>BGM Volume</span> <span>{bgmVolume}%</span>
                 </label>
                 <input type="range" min="0" max="100" value={bgmVolume} onChange={(e)=>setBgmVolume(Number(e.target.value))} className="w-full accent-pink-400" />
              </div>
              
              <div className="mb-6">
                 <div className="flex justify-between items-center bg-zinc-950 p-3 rounded border border-zinc-800">
                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Camera Shake</span>
                    <button 
                       onClick={() => setEnableShake(!enableShake)}
                       className={`w-12 h-6 rounded-full transition-colors relative ${enableShake ? 'bg-cyan-500' : 'bg-zinc-700'}`}
                    >
                       <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enableShake ? 'left-7' : 'left-1'}`}></div>
                    </button>
                 </div>
                 {enableShake && (
                    <div className="mt-2 grid grid-cols-2 gap-4 bg-zinc-950/50 p-3 rounded border border-zinc-800">
                       <div>
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex justify-between">
                             <span>Horizontal (X)</span> <span>{shakeStrengthX}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={shakeStrengthX} onChange={(e)=>setShakeStrengthX(e.target.value)} className="w-full accent-cyan-400" />
                       </div>
                       <div>
                          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 flex justify-between">
                             <span>Vertical (Y)</span> <span>{shakeStrengthY}%</span>
                          </label>
                          <input type="range" min="0" max="100" value={shakeStrengthY} onChange={(e)=>setShakeStrengthY(e.target.value)} className="w-full accent-cyan-400" />
                       </div>
                    </div>
                 )}
              </div>

              <div className="mb-6">
                 <div className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Training Background</div>
                 <div className="grid grid-cols-3 gap-3">
                    {Object.entries(TRAINING_BACKGROUND_THEMES).map(([id, theme]) => (
                       <button
                          key={id}
                          onClick={() => setBackgroundTheme(id)}
                          className={`p-2 rounded border transition-colors text-left ${backgroundTheme === id ? 'border-yellow-500 bg-yellow-500/10' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'}`}
                       >
                          <div className={`h-10 rounded bg-gradient-to-br ${theme.swatch} border border-black/30 mb-2`}></div>
                          <div className={`text-[10px] font-black uppercase tracking-widest ${backgroundTheme === id ? 'text-yellow-400' : 'text-zinc-400'}`}>
                             {theme.label}
                          </div>
                       </button>
                    ))}
                 </div>
              </div>

              <button
                onClick={() => { setShowOptions(false); setScreen('spriteDebug'); }}
                className="mb-6 w-full py-3 rounded border border-cyan-500/60 bg-cyan-500/10 text-cyan-300 text-xs font-black italic tracking-widest uppercase hover:bg-cyan-500/20 transition-colors"
              >
                Sprite Debug Lab
              </button>

              <div className="border-t border-zinc-800 pt-6 mb-6 min-h-[220px]">
                 <div className="flex gap-6 mb-4">
                    <button onClick={() => setOptionsTab('keyboard')} className={`text-xs font-black uppercase tracking-widest pb-1 border-b-2 transition-colors ${optionsTab === 'keyboard' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-zinc-500 hover:text-zinc-400'}`}>Keyboard</button>
                    <button onClick={() => setOptionsTab('gamepad')} className={`text-xs font-black uppercase tracking-widest pb-1 border-b-2 transition-colors ${optionsTab === 'gamepad' ? 'border-yellow-500 text-yellow-500' : 'border-transparent text-zinc-500 hover:text-zinc-400'}`}>Gamepad</button>
                 </div>
                 
                 {optionsTab === 'keyboard' ? (
                     <div className="grid grid-cols-2 gap-x-8">
                        <div>
                           <div className="text-[10px] text-zinc-600 mb-2 border-b border-zinc-800 pb-1">MOVEMENT</div>
                           {renderKeyBind('Up', 'up')}
                           {renderKeyBind('Down', 'down')}
                           {renderKeyBind('Left', 'left')}
                           {renderKeyBind('Right', 'right')}
                        </div>
                        <div>
                           <div className="text-[10px] text-zinc-600 mb-2 border-b border-zinc-800 pb-1">ACTIONS</div>
                           {renderKeyBind('Light Punch', 'lp')}
                           {renderKeyBind('Med. Punch', 'mp')}
                           {renderKeyBind('Heavy Punch', 'hp')}
                           {renderKeyBind('Light Kick', 'lk')}
                           {renderKeyBind('Med. Kick', 'mk')}
                           {renderKeyBind('Heavy Kick', 'hk')}
                        </div>
                     </div>
                 ) : (
                     <div className="grid grid-cols-2 gap-x-8">
                        <div>
                           <div className="text-[10px] text-zinc-600 mb-2 border-b border-zinc-800 pb-1">MOVEMENT</div>
                           {renderPadBind('Up', 'up')}
                           {renderPadBind('Down', 'down')}
                           {renderPadBind('Left', 'left')}
                           {renderPadBind('Right', 'right')}
                        </div>
                        <div>
                           <div className="text-[10px] text-zinc-600 mb-2 border-b border-zinc-800 pb-1">ACTIONS</div>
                           {renderPadBind('Light Punch', 'lp')}
                           {renderPadBind('Med. Punch', 'mp')}
                           {renderPadBind('Heavy Punch', 'hp')}
                           {renderPadBind('Light Kick', 'lk')}
                           {renderPadBind('Med. Kick', 'mk')}
                           {renderPadBind('Heavy Kick', 'hk')}
                        </div>
                     </div>
                 )}
              </div>

              <div className="border-t border-zinc-800 pt-6 mt-auto">
                 <button onClick={clearRecords} className="w-full py-2 border border-red-900/50 text-red-500 text-xs font-black italic tracking-widest rounded hover:bg-red-900/20 transition-colors">
                    RESET SAVED RECORDS
                 </button>
              </div>
           </div>
        </div>
     );
  };

  const renderSpriteDebug = () => {
    const selectedSprite = REACTION_SPRITE_BY_ID[spriteDebugSelected] || REACTION_SPRITE_BY_ID.opponent_idle;
    const selectedMeta = spriteMeta[selectedSprite.id] || DEFAULT_REACTION_SPRITE_META[selectedSprite.id];
    const activeSequence = SPRITE_DEBUG_SEQUENCES.find(item => item.id === spriteDebugSequence) || SPRITE_DEBUG_SEQUENCES[0];
    const previewFacing = selectedSprite.id.startsWith('opponent') ? 1 : 1;
    const updateNumber = (key, value) => updateSpriteMeta(selectedSprite.id, { [key]: parseInt(value, 10) || 0 });

    return (
      <div className="h-screen bg-zinc-950 text-white flex flex-col overflow-hidden select-none">
        <div className="h-20 px-8 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
          <div>
            <button onClick={() => setScreen('menu')} className="text-zinc-500 hover:text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1">BACK TO MENU</button>
            <h1 className="text-3xl font-black italic text-cyan-400 uppercase tracking-widest">SPRITE DEBUG LAB</h1>
          </div>
          <div className="flex gap-3">
            <button onClick={resetSpriteMeta} className="px-5 py-3 rounded border border-red-900/60 text-red-400 text-xs font-black uppercase hover:bg-red-950/40">Reset Defaults</button>
            <button onClick={saveSpriteMeta} className="px-6 py-3 rounded bg-yellow-500 text-black text-xs font-black uppercase hover:bg-yellow-400">Save Metadata</button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-[18rem_1fr_20rem] min-h-0">
          <div className="bg-zinc-950 border-r border-zinc-800 p-4 overflow-y-auto no-scrollbar">
            <div className="text-[10px] text-zinc-600 font-black tracking-widest uppercase mb-3">Playback</div>
            <div className="space-y-2 mb-6">
              {SPRITE_DEBUG_SEQUENCES.map(sequence => (
                <button
                  key={sequence.id}
                  onClick={() => setSpriteDebugSequence(sequence.id)}
                  className={`w-full text-left px-3 py-3 rounded border text-xs font-black uppercase tracking-widest transition-colors ${spriteDebugSequence === sequence.id ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {sequence.label}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-zinc-600 font-black tracking-widest uppercase mb-3">Sprites</div>
            <div className="space-y-2">
              {REACTION_SPRITE_DEFS.map(sprite => (
                <button
                  key={sprite.id}
                  onClick={() => { setSpriteDebugSelected(sprite.id); setSpriteDebugFrame(sprite.id); setSpriteDebugSequence(sprite.id); }}
                  className={`w-full text-left px-3 py-2 rounded border text-xs font-black uppercase tracking-widest transition-colors ${spriteDebugSelected === sprite.id ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-600'}`}
                >
                  {sprite.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative overflow-hidden" style={TRAINING_BACKGROUND_THEMES[backgroundTheme].style}>
            <div className="absolute left-0 right-0 bottom-0 h-[42%]" style={TRAINING_BACKGROUND_THEMES[backgroundTheme].floorStyle}></div>
            <div className="absolute left-0 right-0 bottom-24 h-[7px] bg-cyan-300/60 shadow-[0_2px_12px_rgba(0,0,0,0.35)]"></div>
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2">
              {activeSequence.frames.map(frame => (
                <button
                  key={frame}
                  onClick={() => { setSpriteDebugSelected(frame); setSpriteDebugFrame(frame); }}
                  className={`px-3 py-2 rounded border text-[10px] font-black uppercase tracking-widest ${spriteDebugFrame === frame ? 'border-yellow-500 bg-yellow-500/20 text-yellow-300' : 'border-zinc-700 bg-zinc-950/80 text-zinc-400'}`}
                >
                  {REACTION_SPRITE_BY_ID[frame]?.label || frame}
                </button>
              ))}
            </div>
            <div className="absolute bottom-24 left-1/2 h-96 w-[42rem] -translate-x-1/2">
              {renderSpritePreview(spriteDebugFrame, previewFacing)}
            </div>
          </div>

          <div className="bg-zinc-950 border-l border-zinc-800 p-5 overflow-y-auto no-scrollbar">
            <div className="text-[10px] text-zinc-600 font-black tracking-widest uppercase mb-2">Editing</div>
            <div className="text-xl font-black italic text-white uppercase mb-6">{selectedSprite.label}</div>

            {[
              ['height', 'Height', 180, 440],
              ['x', 'X Offset', -180, 180],
              ['y', 'Y Offset', -140, 140]
            ].map(([key, label, min, max]) => (
              <label key={key} className="block mb-5">
                <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2">
                  <span>{label}</span>
                  <span>{selectedMeta[key]}</span>
                </div>
                <input type="range" min={min} max={max} value={selectedMeta[key]} onChange={(e) => updateNumber(key, e.target.value)} className="w-full accent-cyan-400" />
                <input type="number" min={min} max={max} value={selectedMeta[key]} onChange={(e) => updateNumber(key, e.target.value)} className="mt-2 w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white" />
              </label>
            ))}

            <div className="grid grid-cols-2 gap-2 mt-6">
              <button onClick={() => updateSpriteMeta(selectedSprite.id, DEFAULT_REACTION_SPRITE_META[selectedSprite.id])} className="py-2 rounded border border-zinc-700 text-zinc-300 text-xs font-black uppercase hover:bg-zinc-900">Reset Sprite</button>
              <button onClick={saveSpriteMeta} className="py-2 rounded bg-cyan-500 text-black text-xs font-black uppercase hover:bg-cyan-400">Save</button>
            </div>

            <div className="mt-6 p-3 rounded border border-zinc-800 bg-zinc-900 text-[10px] font-mono text-zinc-500 leading-relaxed">
              {spriteMetaStatus}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStepEditor = (step) => {
    if (!step) return <div className="text-zinc-600 font-mono text-xs border border-dashed border-zinc-800 rounded p-4">SELECT STEP</div>;
    return (
      <div className="space-y-4">
        <div className="text-xs font-black text-zinc-500 tracking-widest uppercase">Step Settings</div>
        <label className="block">
          <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Type</span>
          <select value={step.type} onChange={(e) => updateDraftStep(step.id, { type: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white">
            <option value="direction">Direction</option>
            <option value="button">Button</option>
            <option value="anyButton">Any P/K</option>
            <option value="simul">Direction + Button</option>
            <option value="charge">Charge</option>
            <option value="spin">360 / 720</option>
            <option value="wait">Wait</option>
          </select>
        </label>
        {(step.type === 'direction' || step.type === 'simul') && (
          <label className="block">
            <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Direction</span>
            <select value={step.dir || 6} onChange={(e) => updateDraftStep(step.id, { dir: parseInt(e.target.value) })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white">
              {[1,2,3,4,5,6,7,8,9].map(dir => <option key={dir} value={dir}>{ERROR_MAP[dir] || dir}</option>)}
            </select>
          </label>
        )}
        {(step.type === 'button' || step.type === 'simul') && (
          <label className="block">
            <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Button</span>
            <select value={step.button || 'HP'} onChange={(e) => updateDraftStep(step.id, { button: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white">
              {['LP','MP','HP','LK','MK','HK','P','K'].map(btn => <option key={btn} value={btn}>{ERROR_MAP[btn] || btn}</option>)}
            </select>
          </label>
        )}
        {step.type === 'anyButton' && (
          <label className="block">
            <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Any Button</span>
            <select value={step.value || 'P'} onChange={(e) => updateDraftStep(step.id, { value: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white">
              <option value="P">Any Punch</option>
              <option value="K">Any Kick</option>
            </select>
          </label>
        )}
        {step.type === 'charge' && (
          <>
            <label className="block">
              <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Charge Direction</span>
              <select value={step.chargeDir || 'back'} onChange={(e) => updateDraftStep(step.id, { chargeDir: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white">
                <option value="back">Back</option>
                <option value="down">Down</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Frames</span>
              <input type="number" min="1" max="180" value={step.chargeFrames || 45} onChange={(e) => updateDraftStep(step.id, { chargeFrames: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white" />
            </label>
          </>
        )}
        {step.type === 'spin' && (
          <>
            <label className="block">
              <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Motion</span>
              <select value={step.spin || '360'} onChange={(e) => updateDraftStep(step.id, { spin: e.target.value, spinFrames: e.target.value === '720' ? 55 : 35 })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white">
                <option value="360">360</option>
                <option value="720">720</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Window Frames</span>
              <input type="number" min="1" max="180" value={step.spinFrames || (step.spin === '720' ? 55 : 35)} onChange={(e) => updateDraftStep(step.id, { spinFrames: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white" />
            </label>
          </>
        )}
        {step.type === 'wait' && (
          <label className="block">
            <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Wait Frames</span>
            <input type="number" min="1" max="300" value={step.waitFrames || 30} onChange={(e) => updateDraftStep(step.id, { waitFrames: e.target.value })} className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm font-bold text-white" />
          </label>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => duplicateDraftStep(step.id)} className="py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-black text-zinc-200 uppercase">Duplicate</button>
          <button onClick={() => deleteDraftStep(step.id)} className="py-2 bg-red-950/50 hover:bg-red-900/50 border border-red-900 rounded text-xs font-black text-red-400 uppercase">Delete</button>
        </div>
      </div>
    );
  };

  const renderCustomEditor = () => {
    const selectedStep = customDraft.steps.find(step => step.id === selectedStepId);
    const previewMove = compileCustomMove(customDraft);
    const presetGroups = COMMAND_PRESETS.reduce((acc, preset) => {
      acc[preset.group] = acc[preset.group] || [];
      acc[preset.group].push(preset);
      return acc;
    }, {});

    return (
      <div className="min-h-screen bg-zinc-950 text-white p-8 select-none">
        <div className="max-w-7xl mx-auto flex flex-col gap-6 h-[calc(100vh-4rem)]">
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => setScreen('menu')} className="text-zinc-500 hover:text-cyan-400 font-mono text-sm tracking-widest uppercase mb-3">BACK TO MENU</button>
              <h1 className="text-5xl font-black italic tracking-tighter text-yellow-500 uppercase">CUSTOM EDITOR</h1>
            </div>
            <div className="flex gap-3">
              {editingCustomId && <button onClick={deleteCustomMove} className="px-5 py-3 border border-red-900 text-red-400 hover:bg-red-950/50 rounded font-black italic uppercase">DELETE</button>}
              <button onClick={saveCustomAndReturn} className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 rounded font-black italic uppercase">SAVE</button>
              <button onClick={saveCustomAndTrain} className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black rounded font-black italic uppercase">TRAIN</button>
            </div>
          </div>
          <div className="grid grid-cols-[280px_1fr_300px] gap-6 min-h-0 flex-1">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 bg-zinc-950 border-b border-zinc-800 text-xs font-black text-zinc-500 tracking-widest uppercase">Preset Palette</div>
              <div className="p-4 overflow-y-auto no-scrollbar space-y-5">
                {Object.entries(presetGroups).map(([group, presets]) => (
                  <div key={group}>
                    <div className="text-[10px] text-zinc-600 font-black tracking-widest mb-2 uppercase">{group}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {presets.map(preset => (
                        <button key={preset.id} draggable onDragStart={(e) => e.dataTransfer.setData('preset', preset.id)} onClick={() => applyPresetToDraft(preset.id)}
                          className={`min-h-12 px-2 py-2 bg-zinc-950 border hover:border-yellow-500 rounded text-xs font-black uppercase flex items-center justify-center text-center ${getButtonColor(preset.label)?.border || 'border-zinc-800'} ${getButtonColor(preset.label) ? 'text-white' : 'text-zinc-200'}`}
                          style={getButtonColor(preset.label) ? { color: getButtonColor(preset.label).text } : {}}>
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex gap-4 items-center">
                <label className="flex-1">
                  <span className="block text-[10px] font-black text-zinc-500 tracking-widest mb-2 uppercase">Combo Name</span>
                  <input value={customDraft.name} onChange={(e) => setCustomDraft(prev => ({ ...prev, name: e.target.value }))} className="w-full bg-zinc-900 border border-zinc-700 rounded px-4 py-3 text-lg font-black italic text-white outline-none focus:border-yellow-500" />
                </label>
              </div>
              <div className="flex-1 p-6 overflow-y-auto no-scrollbar">
                <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const presetId = e.dataTransfer.getData('preset'); if (presetId) applyPresetToDraft(presetId); }}
                  className="min-h-48 border-2 border-dashed border-zinc-800 rounded-lg p-4 flex flex-wrap content-start gap-3">
                  {customDraft.steps.length === 0 && <div className="w-full h-36 flex items-center justify-center text-zinc-600 font-black italic tracking-widest uppercase">Drag presets here</div>}
                  {customDraft.steps.map((step, idx) => {
                    const command = stepToCommand(step);
                    const selected = selectedStepId === step.id;
                    return (
                      <button key={step.id} draggable
                        onDragStart={(e) => { setDraggingStepId(step.id); e.dataTransfer.setData('step', step.id); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => { e.preventDefault(); const presetId = e.dataTransfer.getData('preset'); const stepId = e.dataTransfer.getData('step') || draggingStepId; if (presetId) applyPresetToDraft(presetId, idx); else moveDraftStep(stepId, step.id); setDraggingStepId(null); }}
                        onClick={() => setSelectedStepId(step.id)}
                        className={`h-16 min-w-16 px-4 flex items-center justify-center gap-2 border-2 rounded transition-all ${selected ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-zinc-700 bg-zinc-950 hover:border-zinc-500'}`}>
                        <span className="text-[10px] text-zinc-600 font-mono">{idx + 1}</span>
                        <DirIcon dir={command} flip={playerSide === 'P2'} className="w-8 h-8 text-zinc-200" />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-5 bg-zinc-950 border border-zinc-800 rounded p-4">
                  <div className="text-[10px] font-black text-zinc-600 tracking-widest mb-3 uppercase">Preview</div>
                  <div className="flex flex-wrap gap-3 items-center">
                    {previewMove.charge && <div className="h-12 w-12 flex items-center justify-center border-2 border-yellow-500 rounded"><DirIcon dir={previewMove.charge.icon} flip={playerSide === 'P2'} className="w-7 h-7 text-yellow-500" /></div>}
                    {previewMove.require360 && <div className="h-12 w-12 flex items-center justify-center border-2 border-yellow-500 rounded"><DirIcon dir={previewMove.require360.label} flip={playerSide === 'P2'} className="w-7 h-7 text-yellow-500" /></div>}
                    {previewMove.sequence.map((step, idx) => <div key={idx} className="h-12 min-w-12 px-3 flex items-center justify-center border-2 border-zinc-700 rounded"><DirIcon dir={step} flip={playerSide === 'P2'} className="w-7 h-7 text-zinc-300" /></div>)}
                  </div>
                  {editorError && <div className="mt-4 text-red-400 font-mono text-xs uppercase">{editorError}</div>}
                </div>
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
              <div className="p-4 bg-zinc-950 border-b border-zinc-800 text-xs font-black text-zinc-500 tracking-widest uppercase">Modify</div>
              <div className="p-5 overflow-y-auto no-scrollbar">{renderStepEditor(selectedStep)}</div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ======================
  // 1. MENU SCREEN
  // ======================
  if (screen === 'spriteDebug') return renderSpriteDebug();
  if (screen === 'customEditor') return renderCustomEditor();

  if (screen === 'menu') {
    return (
      <div className="h-screen bg-zinc-950 text-white flex flex-col items-center justify-start px-6 pt-24 pb-6 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 to-zinc-950 select-none relative overflow-hidden">
        
        <button onClick={() => setShowOptions(true)} className="absolute top-6 right-7 text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-2">
           <span className="text-xl">⚙️</span><span className="font-bold tracking-widest text-sm">OPTIONS</span>
        </button>

        <h1 className="text-5xl xl:text-6xl leading-none font-black italic tracking-tighter mb-1 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-pink-500 drop-shadow-lg uppercase">
          EXECUTION TRAINER
        </h1>
        <p className="text-zinc-400 font-mono tracking-widest mb-4 text-sm">SELECT YOUR DRILL</p>

        <div className="flex w-full flex-1 min-h-0 max-h-[calc(100vh-13.5rem)] max-w-7xl mx-auto border-2 border-zinc-800 rounded-lg overflow-hidden shadow-2xl bg-zinc-900">
          
          <div className="w-60 bg-zinc-950 flex flex-col border-r border-zinc-800">
            <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 text-xs font-black text-zinc-500 tracking-widest uppercase">Categories</div>
            {TABS.map(tab => (
               <button key={tab} onClick={() => {
                  setActiveTab(tab);
                  const firstMove = Object.keys(allMoves).find(k => allMoves[k].tab === tab);
                  if (firstMove) setTargetMove(firstMove);
               }}
                 className={`w-full text-left px-6 py-4 font-black italic text-lg tracking-wider transition-colors border-l-4 ${activeTab === tab ? 'border-yellow-500 bg-zinc-800 text-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]' : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
                 {tab}
               </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col bg-zinc-900">
            <div className="px-4 py-3 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center">
               <span className="text-xs font-black text-zinc-500 tracking-widest uppercase">Command List</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 no-scrollbar">
               {Object.entries(allMoves).filter(([id, m]) => m.tab === activeTab).map(([id, move]) => {
                  const rec = records[id];
                  return (
                  <button key={id} onClick={() => setTargetMove(id)}
                    className={`w-full flex items-center justify-between gap-4 px-4 py-3 bg-zinc-950/50 border-2 rounded transition-all ${targetMove === id ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'}`}>
                     <div className="text-left flex flex-col">
                        <span className={`font-black italic text-xl tracking-tighter uppercase ${targetMove === id ? 'text-yellow-500' : 'text-zinc-200'}`}>{move.name}</span>
                        <div className="text-[10px] font-mono text-zinc-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 tracking-wider">
                           <span>BEST SR: <span className="text-pink-400">{rec?.bestSuccessRate || 0}%</span></span>
                           <span>BEST TIME: <span className="text-white">{rec?.bestFrames < 9999 ? rec.bestFrames : '--'}f</span></span>
                           <span>BEST PREC: <span className="text-cyan-400">{rec?.bestPrecision || 0}%</span></span>
                        </div>
                     </div>
                     <div className="shrink-0 flex items-center gap-2 bg-zinc-900 py-2 px-3 rounded border border-zinc-800 shadow-inner">
                        {move.charge && (
                           <div className="flex items-center gap-1">
                              <DirIcon dir={move.charge.icon} flip={playerSide === 'P2'} className="w-5 h-5 text-yellow-500 drop-shadow-md" />
                              <span className="text-[10px] font-black text-yellow-500 tracking-tighter mr-1">CHG</span>
                           </div>
                        )}
                        {move.require360 && <DirIcon dir={move.require360.label} flip={playerSide === 'P2'} className="w-8 h-8 text-yellow-500 drop-shadow-md" />}
                        {move.sequence.map((step, idx) => <DirIcon key={idx} dir={step} flip={playerSide === 'P2'} className="w-6 h-6 text-zinc-300" /> )}
                     </div>
                  </button>
               )})}
               {activeTab === 'CUSTOM' && (
                  <button onClick={openNewCustomEditor}
                    className="w-full min-h-28 flex items-center justify-center p-4 bg-zinc-950/30 border-2 border-dashed border-zinc-700 rounded transition-all hover:border-yellow-500 hover:bg-yellow-500/5">
                    <div className="text-center">
                      <div className="text-4xl leading-none text-yellow-500 font-black">+</div>
                      <div className="text-xs font-black italic tracking-widest text-zinc-400 uppercase mt-2">New Custom Combo</div>
                    </div>
                  </button>
               )}
            </div>
          </div>

          <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col">
            <div className="px-4 py-3 bg-yellow-500 text-black font-black italic tracking-widest text-center text-lg uppercase">Drill Config</div>
            <div className="p-4 flex-1 flex flex-col gap-5 overflow-y-auto no-scrollbar">
               
               <div>
                  <label className="text-xs font-black text-zinc-500 tracking-widest mb-3 block uppercase">Player Side</label>
                  <div className="flex bg-zinc-900 border border-zinc-800 rounded">
                     <button onClick={()=>setPlayerSide('P1')} className={`flex-1 py-2 font-black italic text-xs transition-all ${playerSide === 'P1' ? 'bg-cyan-500 text-black shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}>1P (Right)</button>
                     <button onClick={()=>setPlayerSide('P2')} className={`flex-1 py-2 font-black italic text-xs transition-all ${playerSide === 'P2' ? 'bg-pink-500 text-black shadow-inner' : 'text-zinc-500 hover:text-zinc-300'}`}>2P (Left)</button>
                  </div>
               </div>

               <div>
                  <label className="text-xs font-black text-zinc-500 tracking-widest mb-3 block uppercase">Training Mode</label>
                  <div className="flex flex-col gap-2">
                     <button onClick={()=>setTrainingMode('streak')} className={`py-3 px-4 font-black italic text-sm text-left border rounded transition-all ${trainingMode === 'streak' ? 'border-pink-500 bg-pink-500/10 text-pink-500' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>STREAK MODE</button>
                     <button onClick={()=>setTrainingMode('precision')} className={`py-3 px-4 font-black italic text-sm text-left border rounded transition-all ${trainingMode === 'precision' ? 'border-cyan-400 bg-cyan-400/10 text-cyan-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>PRECISION TEST</button>
                     <button onClick={()=>setTrainingMode('reaction')} className={`py-3 px-4 font-black italic text-sm text-left border rounded transition-all ${trainingMode === 'reaction' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>REACTION TEST</button>
                  </div>
               </div>

               {trainingMode === 'reaction' && (
                  <div>
                     <label className="text-xs font-black text-zinc-500 tracking-widest mb-3 block uppercase">Reaction Scenario</label>
                     <div className="grid grid-cols-3 gap-2">
                        {[
                           ['auto', 'AUTO'],
                           ['dash', 'DASH'],
                           ['jump', 'JUMP']
                        ].map(([id, label]) => (
                           <button key={id} onClick={() => setReactionScenario(id)}
                             className={`py-2 rounded border font-black italic text-xs ${reactionScenario === id ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}>
                             {label}
                           </button>
                        ))}
                     </div>
                  </div>
               )}
               
               <div>
                  <label className="flex justify-between text-xs font-black text-zinc-500 tracking-widest mb-4 uppercase">
                     <span>{trainingMode === 'precision' ? 'TOTAL ATTEMPTS' : 'TARGET SUCCESSES'}</span>
                     <span className={trainingMode === 'streak' ? 'text-pink-500 text-lg leading-none' : trainingMode === 'reaction' ? 'text-emerald-400 text-lg leading-none' : 'text-cyan-400 text-lg leading-none'}>{successTarget}</span>
                  </label>
                  <input type="range" min="1" max="100" value={successTarget} onChange={(e) => setSuccessTarget(parseInt(e.target.value))} className={`w-full ${trainingMode === 'streak' ? 'accent-pink-500' : trainingMode === 'reaction' ? 'accent-emerald-500' : 'accent-cyan-400'}`} />
                  <p className="text-[10px] text-zinc-600 font-mono mt-3 leading-tight">
                     {trainingMode === 'streak' ? 'Execute perfectly in a row. A single drop resets the streak.' : trainingMode === 'reaction' ? 'Wait for the opponent cue, then complete the selected command inside the timing window.' : 'Execute the target amount of times. Tracks your total failure rate and average precision.'}
                  </p>
               </div>

               {curTargetMove.custom && (
                  <button onClick={() => openExistingCustomEditor(targetMove)}
                    className="w-full py-3 border border-yellow-500/70 text-yellow-500 hover:bg-yellow-500/10 font-black italic tracking-widest rounded uppercase">
                    EDIT CUSTOM
                  </button>
               )}

            </div>
            
            <button onClick={() => (activeTab === 'CUSTOM' && !curTargetMove.custom ? openNewCustomEditor() : startTraining(targetMove))}
              className="py-5 bg-yellow-500 hover:bg-yellow-400 text-black font-black italic text-3xl tracking-tighter transition-colors uppercase">
               {activeTab === 'CUSTOM' && !curTargetMove.custom ? 'CREATE' : 'START'}
            </button>
          </div>
        </div>

        {/* Options Modal */}
        {renderOptionsModal()}

      </div>
    );
  }

  // ======================
  // 2. RESULTS SCREEN
  // ======================
  if (screen === 'results') {
    const successData = sessionData.filter(d => d.type === 'success');
    const avgFrames = successData.length ? Math.round(successData.reduce((a, b) => a + b.frames, 0) / successData.length) : 0;
    const avgPrec = successData.length ? Math.round(successData.reduce((a, b) => a + b.precision, 0) / successData.length) : 0;
    const successRate = sessionData.length ? Math.round((successData.length / sessionData.length) * 100) : 0;
    
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-zinc-800 to-zinc-950 select-none">
         <h1 className="text-6xl font-black italic text-cyan-400 tracking-tighter mb-2 drop-shadow-[0_0_20px_rgba(34,211,238,0.4)] uppercase">DRILL COMPLETE</h1>
         <p className="text-zinc-400 font-mono tracking-widest mb-10 uppercase">{curTargetMove.name} - {successTarget} {trainingMode === 'precision' ? 'ATTEMPTS' : 'SUCCESSES'}</p>
         
         <div className="flex gap-6 mb-10">
            <div className="bg-zinc-900 border-2 border-zinc-800 p-6 rounded-lg text-center shadow-lg w-48 flex flex-col justify-center">
               <div className="text-zinc-500 font-bold text-xs tracking-widest uppercase mb-2">Success Rate</div>
               <div className={`text-4xl font-black italic ${successRate >= 80 ? 'text-pink-500' : 'text-zinc-300'}`}>{successRate}%</div>
            </div>
            <div className="bg-zinc-900 border-2 border-zinc-800 p-6 rounded-lg text-center shadow-lg w-48 flex flex-col justify-center">
               <div className="text-zinc-500 font-bold text-xs tracking-widest uppercase mb-2">Avg. Execution</div>
               <div className="text-3xl font-black font-mono text-zinc-100">{avgFrames}f</div>
               <div className="text-sm text-zinc-400">({(avgFrames/60).toFixed(2)}s)</div>
            </div>
            <div className="bg-zinc-900 border-2 border-zinc-800 p-6 rounded-lg text-center shadow-lg w-48 flex flex-col justify-center">
               <div className="text-zinc-500 font-bold text-xs tracking-widest uppercase mb-2">Avg. Precision</div>
               <div className={`text-4xl font-black italic ${avgPrec >= 90 ? 'text-cyan-400' : 'text-yellow-500'}`}>{avgPrec}%</div>
            </div>
            {trainingMode === 'reaction' && (
              <div className="bg-zinc-900 border-2 border-zinc-800 p-6 rounded-lg text-center shadow-lg w-48 flex flex-col justify-center">
                 <div className="text-zinc-500 font-bold text-xs tracking-widest uppercase mb-2">Avg. Reaction</div>
                 <div className="text-4xl font-black italic text-emerald-400">{successData.length ? Math.round(successData.reduce((a, b) => a + (b.reactionFrames || 0), 0) / successData.length) : 0}f</div>
              </div>
            )}
         </div>

         <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-10 shadow-xl">
            <h3 className="text-pink-500 font-black italic tracking-widest mb-4 uppercase">EXECUTION LOG</h3>
            <div className="max-h-64 overflow-y-auto pr-4 space-y-2 no-scrollbar">
               {sessionData.map((d, i) => (
                   <div key={d.id} className={`flex justify-between items-center bg-zinc-950 p-3 rounded border ${d.type === 'error' ? 'border-red-900/50 bg-red-950/10' : 'border-zinc-800/50'}`}>
                       <span className="text-zinc-500 font-bold font-mono w-24">Attempt #{i + 1}</span>
                       {d.type === 'success' ? (
                          <>
                             <span className="text-zinc-300 font-mono tracking-wider">{d.frames}f <span className="text-zinc-600">({d.seconds}s)</span></span>
                             <span className={`font-black italic text-lg ${d.precision === 100 ? 'text-cyan-400' : 'text-yellow-500'}`}>{d.precision}%</span>
                          </>
                       ) : (
                          <span className="text-red-400 font-mono text-xs text-right truncate flex-1 ml-4">{d.reason}</span>
                       )}
                   </div>
               ))}
            </div>
         </div>

         <div className="flex gap-4">
            <button onClick={() => startTraining()} className="px-8 py-3 bg-cyan-500 text-zinc-950 font-black italic tracking-wider rounded hover:bg-cyan-400 transition-colors uppercase">PLAY AGAIN</button>
            <button onClick={() => setScreen('menu')} className="px-8 py-3 bg-zinc-800 text-zinc-300 font-black italic tracking-wider rounded hover:bg-zinc-700 transition-colors uppercase">MAIN MENU</button>
         </div>
      </div>
    );
  }

  // ======================
  // 3. TRAINING SCREEN
  // ======================
  const h = stateRef.current.history;
  const effKeys = stateRef.current.effectiveKeys;
  const activeProgress = stateRef.current.progress;
  const reaction = stateRef.current.reaction;
  const reactionDef = reaction ? REACTION_SCENARIOS[reaction.scenario] : null;
  const reactionIsActive = trainingMode === 'reaction';
  const playerStageX = playerSide === 'P1' ? 22 : 78;
  const opponentStageX = reaction ? (playerSide === 'P1' ? reaction.x : 100 - reaction.x) : (playerSide === 'P1' ? 80 : 20);
  const opponentStageY = reaction ? reaction.y : 0;
  const opponentFacing = playerSide === 'P1' ? 1 : -1;
  const playerFacing = playerSide === 'P1' ? 1 : -1;
  const playerOnHitActive = stateRef.current.totalFrames < stateRef.current.playerOnHitUntilFrame;
  const playerAttackSpriteActive = stateRef.current.totalFrames < stateRef.current.playerAttackSpriteUntilFrame;
  const playerReactionSpriteId = playerOnHitActive
    ? 'player_onhit'
    : playerAttackSpriteActive
    ? (stateRef.current.playerAttackSpriteId || 'player_idle')
    : 'player_idle';
  const playerReactionSprite = REACTION_SPRITE_BY_ID[playerReactionSpriteId]?.src || REACTION_SPRITE_BY_ID.player_idle.src;
  const playerReactionMeta = spriteMeta[playerReactionSpriteId] || DEFAULT_REACTION_SPRITE_META[playerReactionSpriteId] || DEFAULT_REACTION_SPRITE_META.player_idle;
  const opponentOnHitActive = stateRef.current.totalFrames < stateRef.current.opponentOnHitUntilFrame;
  const opponentReactionSpriteId = opponentOnHitActive ? 'opponent_onhit' : getReactionOpponentSpriteId(reaction);
  const opponentReactionSprite = REACTION_SPRITE_BY_ID[opponentReactionSpriteId]?.src || REACTION_SPRITE_BY_ID.opponent_idle.src;
  const opponentReactionMeta = spriteMeta[opponentReactionSpriteId] || DEFAULT_REACTION_SPRITE_META[opponentReactionSpriteId] || DEFAULT_REACTION_SPRITE_META.opponent_idle;
  const isSuccessLinger = !!successBanner;
  const latestDiagnostic = diagnostics.length > 0 ? diagnostics[diagnostics.length - 1] : null;
  const trainingBackground = TRAINING_BACKGROUND_THEMES[backgroundTheme] || TRAINING_BACKGROUND_THEMES.grid;
  const inputTheme = trainingBackground.input;
  
  const curMoveDef = curTargetMove;
  const chargeFramesCount = curMoveDef.charge ? getChargeFrames(h, curMoveDef.charge.dirs) : 0;
  
  const isChargeReady = curMoveDef.charge ? (activeProgress > 0 || chargeFramesCount >= curMoveDef.charge.frames) : false;
  const chargePercent = curMoveDef.charge ? (activeProgress > 0 ? 100 : Math.min(100, (chargeFramesCount / curMoveDef.charge.frames) * 100)) : 0;
  
  const status360 = curMoveDef.require360 ? get360Status(h, curMoveDef.require360.frames, curMoveDef.require360.count) : { isReady: false, percent: 0 };
  const is360Ready = curMoveDef.require360 ? (activeProgress > 0 || status360.isReady) : false;
  const spinPercent = curMoveDef.require360 ? (activeProgress > 0 ? 100 : status360.percent) : 0;
  const chargeGlowFramesPassed = stateRef.current.totalFrames - stateRef.current.chargeGlowFrame;
  const spinGlowFramesPassed = stateRef.current.totalFrames - stateRef.current.spinGlowFrame;
  const chargeGlowActive = chargeGlowFramesPassed < INPUT_GLOW_FRAMES;
  const spinGlowActive = spinGlowFramesPassed < INPUT_GLOW_FRAMES;
  const chargeFillPercent = isChargeReady ? 0 : chargePercent;
  const spinFillPercent = is360Ready ? 0 : spinPercent;
  const getSpecialInputGlowStyle = (framesPassed) => {
    const ratio = 1 - (framesPassed / INPUT_GLOW_FRAMES);
    const easeOut = 1 - Math.pow(1 - ratio, 3);

    return {
      transform: `scale(${1 + (easeOut * 0.10)})`,
      borderColor: `rgba(${trainingBackground.accentRgb},${easeOut * 0.9})`,
      color: inputTheme.currentText,
      backgroundColor: `rgba(${trainingBackground.accentRgb},${easeOut * 0.22})`,
      boxShadow: `0 0 ${20 * easeOut}px rgba(${trainingBackground.accentRgb},${easeOut * 0.46})`
    };
  };

  // Determine shake class
  let shakeClass = "";
  if (stateRef.current.shakeFrames > 0) {
      if (stateRef.current.shakeType === 'light') shakeClass = "animate-shake-light";
      else if (stateRef.current.shakeType === 'heavy') shakeClass = "animate-shake-heavy";
      else if (stateRef.current.shakeType === 'error') shakeClass = "animate-shake-error";
  }

  const mX = shakeStrengthX / 100;
  const mY = shakeStrengthY / 100;

  return (
    <div className={`flex h-screen w-full bg-zinc-950 text-zinc-100 font-sans overflow-hidden select-none relative ${shakeClass}`}>
      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes shake-light {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-${6 * mX}px, ${2 * mY}px); }
          50% { transform: translate(${4 * mX}px, -${1 * mY}px); }
          75% { transform: translate(-${2 * mX}px, ${1 * mY}px); }
        }
        @keyframes shake-heavy {
          0%, 100% { transform: translate(0, 0) scale(1); }
          15% { transform: translate(-${16 * mX}px, ${8 * mY}px) scale(1.03); filter: brightness(1.2); }
          35% { transform: translate(${12 * mX}px, -${6 * mY}px) scale(1.01); filter: brightness(1.1); }
          60% { transform: translate(-${8 * mX}px, ${4 * mY}px) scale(1); }
          80% { transform: translate(${4 * mX}px, -${2 * mY}px) scale(1); }
        }
        @keyframes shake-error {
          0%, 100% { transform: translate(0, 0); filter: contrast(1); }
          15% { transform: translate(-${12 * mX}px, ${4 * mY}px); filter: contrast(1.5) grayscale(0.5); }
          30% { transform: translate(${12 * mX}px, -${4 * mY}px); }
          45% { transform: translate(-${8 * mX}px, ${2 * mY}px); }
          60% { transform: translate(${8 * mX}px, -${2 * mY}px); }
          75% { transform: translate(-${4 * mX}px, ${1 * mY}px); }
          90% { transform: translate(${4 * mX}px, -${1 * mY}px); }
        }

        .animate-shake-light { animation: shake-light 0.15s ease-out forwards; }
        .animate-shake-heavy { animation: shake-heavy 0.3s ease-out forwards; }
        .animate-shake-error { animation: shake-error 0.3s ease-out forwards; }

        @keyframes punish-slide { 0% { transform: translateX(-50px) skewX(-10deg); opacity: 0; } 100% { transform: translateX(0) skewX(-10deg); opacity: 1; } }
        @keyframes punish-out { 0% { transform: translateY(0) skewX(-10deg); opacity: 1; } 100% { transform: translateY(-50px) skewX(-10deg); opacity: 0; } }
        .animate-punish { animation: punish-slide 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-punish-out { animation: punish-out 0.2s ease-in forwards; }
        
        @keyframes success-splash {
            0% { transform: translate(-50%, -20px) scale(0.9); opacity: 0; filter: brightness(1.5); }
            10% { transform: translate(-50%, 0) scale(1.1); opacity: 1; filter: brightness(1); }
            20% { transform: translate(-50%, 0) scale(1); opacity: 1; }
            90% { transform: translate(-50%, 0) scale(1); opacity: 1; }
            100% { transform: translate(-50%, -20px) scale(0.9); opacity: 0; }
        }
        .animate-success-splash { animation: success-splash 2.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

        @keyframes hit-bump {
            0% { transform: scale(1.5) translateX(20px); opacity: 0; }
            100% { transform: scale(1) translateX(0); opacity: 1; }
        }
        .animate-hit-bump { animation: hit-bump 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; display: inline-block; }
      `}} />

      {/* HEADER */}
      <div className="absolute top-0 left-0 w-full pl-80 p-6 flex justify-between items-start z-30 pointer-events-none">
         <div className="pointer-events-auto ml-6 flex flex-col gap-2">
            <button onClick={() => setScreen('menu')} className="px-6 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-black italic text-lg tracking-tighter transition-colors uppercase shadow-[0_0_18px_rgba(234,179,8,0.25)] w-max">
               BACK TO MENU
            </button>
            <h1 className="text-3xl font-black italic text-white tracking-tighter drop-shadow-lg uppercase">
              {curTargetMove.name}
            </h1>
            <div className="flex gap-2">
               <span className="text-[10px] font-bold tracking-widest px-2 py-1 bg-zinc-800 text-zinc-400 rounded uppercase">
                  {trainingMode === 'streak' ? 'STREAK MODE' : trainingMode === 'reaction' ? 'REACTION TEST' : 'PRECISION TEST'}
               </span>
               <span className={`text-[10px] font-bold tracking-widest px-2 py-1 rounded uppercase ${playerSide === 'P1' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-pink-500/20 text-pink-400'}`}>
                  SIDE: {playerSide}
               </span>
            </div>
         </div>
         
         <div className="pointer-events-auto flex items-center gap-4">
            <button onClick={() => setShowOptions(true)} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-cyan-400 rounded transition-all group">
               <span className="text-zinc-400 group-hover:text-cyan-400 font-bold tracking-wider text-xs">OPTIONS</span>
               <span className="font-mono text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-600">⚙️</span>
            </button>
            <button onClick={handleManualReset} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-700 hover:border-pink-500 rounded transition-all group">
               <span className="text-zinc-400 group-hover:text-pink-400 font-bold tracking-wider text-xs">RESET DRILL</span>
               <kbd className="font-mono text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-600">R</kbd>
            </button>
         </div>
      </div>

      {/* HIT COUNTER (Right Side Scaled Number) */}
      {hitCounter > 0 && (
         <div className="absolute right-8 top-[25%] z-40 flex flex-col items-end pointer-events-none">
            <div key={hitCounter} className="flex items-baseline gap-2 animate-hit-bump origin-right">
               <span className="text-[7rem] leading-none font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 via-yellow-500 to-orange-600 drop-shadow-[0_8px_8px_rgba(0,0,0,0.6)]" style={{WebkitTextStroke: '3px #4c1d95'}}>
                  {hitCounter}
               </span>
               <span className="text-4xl font-black italic text-yellow-500 drop-shadow-[0_4px_4px_rgba(0,0,0,0.6)]" style={{WebkitTextStroke: '2px #4c1d95'}}>
                  HIT
               </span>
            </div>
         </div>
      )}

      {/* CENTER SUCCESS SPLASH BANNER */}
      {successBanner && (
         <div className="absolute top-[20%] left-1/2 -translate-x-1/2 z-50 flex pointer-events-none animate-success-splash">
            <div className="bg-gradient-to-r from-transparent via-cyan-500 to-transparent px-16 py-3 skew-x-[-15deg] shadow-[0_0_30px_rgba(34,211,238,0.4)] border-y-4 border-cyan-300 flex flex-col items-center justify-center">
               <div className="skew-x-[15deg] flex flex-col items-center">
                  <h2 className="text-3xl font-black italic text-white tracking-widest uppercase drop-shadow-lg" style={{WebkitTextStroke: '1px rgba(0,0,0,0.5)'}}>
                     {trainingMode === 'reaction' ? 'REACTION SUCCESS' : 'COMBO SUCCESS'}
                  </h2>
                  <p className="text-cyan-100 font-bold tracking-widest font-mono text-sm mt-1 drop-shadow-md">
                     {trainingMode === 'reaction' ? `REACTION: ${successBanner.reactionFrames}f | PRECISION: ${successBanner.precision}%` : `TIME: ${successBanner.frames}f | PRECISION: ${successBanner.precision}%`}
                  </p>
               </div>
            </div>
         </div>
      )}

      {/* DIAGNOSTIC POPUP */}
      {diagnostics.map((diag, idx) => {
         const isOld = idx < diagnostics.length - 1;
         return (
            <div key={diag.id} className={`absolute left-[340px] top-[20%] z-50 flex pointer-events-none transition-all duration-300 ${isOld ? 'animate-punish-out' : 'animate-punish'}`}>
               <div className="bg-gradient-to-r from-orange-600 via-orange-500 to-transparent border-l-[8px] border-orange-300 pl-6 pr-24 py-3 shadow-[10px_0_20px_rgba(234,88,12,0.4)] skew-x-[-10deg]">
                  <div className="skew-x-[10deg] ml-2">
                    <h2 className="text-3xl font-black italic text-white tracking-widest uppercase drop-shadow-md" style={{WebkitTextStroke: '1px rgba(0,0,0,0.3)'}}>
                       {diag.title}
                    </h2>
                    <p className="text-orange-100 font-bold tracking-widest uppercase text-sm">
                       {diag.detail}
                    </p>
                  </div>
               </div>
            </div>
         );
      })}

      {/* LEFT PANEL: Input History Overlay */}
      <div className="w-80 absolute left-0 top-0 bottom-0 bg-zinc-950/80 border-r border-zinc-800 z-40 flex flex-col backdrop-blur-md shadow-[10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-4 bg-zinc-900 border-b border-pink-500/30">
          <h2 className="text-pink-500 font-black italic tracking-widest text-lg leading-none uppercase">HISTORY</h2>
          <div className="flex gap-3 mt-2 text-[10px] font-mono tracking-wider">
             <span className="text-cyan-400">■ STRICT</span>
             <span className="text-yellow-500">■ FUZZY</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col-reverse p-4 space-y-2 space-y-reverse">
          {[...h].reverse().map((entry) => (
            entry.marker ? (
              <div key={entry.id} className={`flex items-center gap-3 p-2 rounded border-l-4 ${entry.matchType === 'strict' ? 'bg-emerald-500/15 border-emerald-400 text-emerald-300' : 'bg-zinc-800/60 border-zinc-500 text-zinc-400'}`}>
                <div className="w-10 text-right font-mono text-[10px] text-zinc-500">--</div>
                <div className="text-[10px] font-black tracking-widest uppercase">{entry.label}</div>
              </div>
            ) : (
            <div key={entry.id} className={`group flex flex-col p-2 rounded transform transition-all
                ${entry.matchType === 'error' ? 'bg-red-500/10 border-l-4 border-red-500' : ''}
                ${entry.matchType === 'strict' ? 'bg-cyan-500/20 border-l-4 border-cyan-500' : ''}
                ${entry.matchType === 'fuzzy' ? 'bg-yellow-500/20 border-l-4 border-yellow-500' : ''}
                ${!entry.matchType ? 'bg-zinc-800/40 border-l-4 border-transparent' : ''}`}>
              
              <div className="flex items-center gap-4">
                 <div className="w-10 text-right font-mono text-sm text-zinc-500">{entry.frames}f</div>
                 <div className="w-6 h-6 flex items-center justify-center text-zinc-200">
                   <DirIcon dir={entry.dir} flip={playerSide === 'P2'} className="w-full h-full" />
                 </div>
                 <div className="flex-1 flex flex-wrap gap-1">
                   {entry.lp && <span className={`px-1.5 py-0.5 text-[9px] font-black ${BUTTON_COLORS.LP.bg} text-white rounded-sm`}>LP</span>}
                   {entry.mp && <span className={`px-1.5 py-0.5 text-[9px] font-black ${BUTTON_COLORS.MP.bg} text-white rounded-sm`}>MP</span>}
                   {entry.hp && <span className={`px-1.5 py-0.5 text-[9px] font-black ${BUTTON_COLORS.HP.bg} text-white rounded-sm`}>HP</span>}
                   {entry.lk && <span className={`px-1.5 py-0.5 text-[9px] font-black ${BUTTON_COLORS.LK.bg} text-white rounded-sm`}>LK</span>}
                   {entry.mk && <span className={`px-1.5 py-0.5 text-[9px] font-black ${BUTTON_COLORS.MK.bg} text-white rounded-sm`}>MK</span>}
                   {entry.hk && <span className={`px-1.5 py-0.5 text-[9px] font-black ${BUTTON_COLORS.HK.bg} text-white rounded-sm`}>HK</span>}
                 </div>
              </div>

              {entry.matchType === 'error' && (
                 <div className="hidden group-hover:block mt-2 ml-14 text-[10px] leading-tight text-red-200 bg-red-950/80 p-2 rounded border border-red-800/50 shadow-inner">
                    <div className="font-black italic text-red-500 mb-0.5 tracking-widest uppercase">Input Failed</div>
                    {entry.errorReason}
                 </div>
              )}
            </div>
            )
          ))}
        </div>
      </div>

      {/* CENTER STAGE */}
      <div
        className="flex-1 flex flex-col items-center justify-center pl-80 pr-0 relative overflow-hidden"
        style={trainingBackground.style}
      >
        <div className="absolute left-80 right-0 bottom-0 h-[45%] pointer-events-none" style={trainingBackground.floorStyle}></div>

        <div className={`${reactionIsActive ? 'absolute top-24 left-[calc(50%+10rem)] -translate-x-1/2' : 'mb-12 mt-24'} z-30 flex flex-col items-center`}>
           <div className="font-mono text-xs font-black tracking-widest mb-4 uppercase drop-shadow-[0_1px_1px_rgba(255,255,255,0.45)]" style={{ color: inputTheme.label }}>DESIRED INPUT</div>
           <div className="flex gap-4 items-center">
             
             {curMoveDef.charge && (
                <div className={`relative h-14 w-14 flex items-center justify-center border-2 rounded transform transition-all duration-100 overflow-hidden
                    ${chargeGlowActive ? 'transition-none' : ''}`}
                    style={chargeGlowActive ? getSpecialInputGlowStyle(chargeGlowFramesPassed) : {
                      color: inputTheme.idleText,
                      borderColor: inputTheme.idleBorder,
                      backgroundColor: inputTheme.idleBg
                    }}>
                    
                    <div className="absolute bottom-0 left-0 w-full" style={{ height: `${chargeFillPercent}%`, backgroundColor: `rgba(${trainingBackground.accentRgb},0.22)` }}></div>
                    <DirIcon dir={curMoveDef.charge.icon} flip={playerSide === 'P2'} className="relative z-10 w-8 h-8" />
                </div>
             )}
             
             {curMoveDef.require360 && (
                <div className={`relative h-14 w-14 flex items-center justify-center border-2 rounded transform transition-all duration-100 overflow-hidden
                    ${spinGlowActive ? 'transition-none' : ''}`}
                    style={spinGlowActive ? getSpecialInputGlowStyle(spinGlowFramesPassed) : {
                      color: inputTheme.idleText,
                      borderColor: inputTheme.idleBorder,
                      backgroundColor: inputTheme.idleBg
                    }}>
                    
                    <div className="absolute inset-0 opacity-40" style={{ background: `conic-gradient(rgb(${trainingBackground.accentRgb}) ${spinFillPercent}%, transparent 0)` }}></div>
                    <DirIcon dir={curMoveDef.require360.label} flip={playerSide === 'P2'} className="relative z-10 w-8 h-8" />
                </div>
             )}

             {curMoveDef.sequence.map((step, idx) => {
                const isCurrent = isSuccessLinger ? false : idx === activeProgress;
                const isError = latestDiagnostic && latestDiagnostic.step === idx && !isSuccessLinger;
                const isLast = idx === curMoveDef.sequence.length - 1;
                
                // Fetch the exact frame this step was activated
                const hitFrame = stateRef.current.stepGlows[idx] || -999;
                const framesPassed = stateRef.current.totalFrames - hitFrame;

                let containerClass = "h-14 px-3 flex items-center justify-center border-2 rounded ";
                let inlineStyle = {};

                if (isError) {
                   containerClass += "border-red-500 text-red-500 bg-red-500/20 scale-110 shadow-[0_0_20px_rgba(239,68,68,0.6)] transition-all duration-100";
                } else if (framesPassed < INPUT_GLOW_FRAMES) {
                   // Independent 45-frame (0.75s) smooth decay glow
                   const ratio = 1 - (framesPassed / INPUT_GLOW_FRAMES);
                   const easeOut = 1 - Math.pow(1 - ratio, 3);
                   
                   const scale = 1 + (easeOut * (isLast ? 0.25 : 0.10));
                   const shadowSpread = isLast ? 30 * easeOut : 15 * easeOut;
                   const alpha = easeOut * (isLast ? 0.9 : 0.6);
                   
                   inlineStyle = {
                       transform: `scale(${scale})`,
                       borderColor: `rgba(${trainingBackground.accentRgb},${alpha})`,
                       color: inputTheme.currentText,
                       backgroundColor: `rgba(${trainingBackground.accentRgb},${alpha * 0.24})`,
                       boxShadow: `0 0 ${shadowSpread}px rgba(${trainingBackground.accentRgb},${alpha})`,
                       zIndex: isLast ? 10 : 1
                   };
                   containerClass += "transition-none";
                } else if (isCurrent) {
                   inlineStyle = {
                     borderColor: inputTheme.currentBorder,
                     color: inputTheme.currentText,
                     backgroundColor: inputTheme.currentBg,
                     boxShadow: `0 0 14px rgba(${trainingBackground.accentRgb},0.28)`
                   };
                   containerClass += "scale-105 transition-all duration-100";
                } else {
                   inlineStyle = {
                     borderColor: inputTheme.idleBorder,
                     color: inputTheme.idleText,
                     backgroundColor: inputTheme.idleBg
                   };
                   containerClass += "transition-all duration-100";
                }

                return (
                   <div key={idx} className={containerClass} style={inlineStyle}>
                      <DirIcon dir={step} flip={playerSide === 'P2'} className="w-8 h-8" />
                   </div>
                )
             })}
           </div>
        </div>

        {reactionIsActive && (
          <div className="relative z-10 w-[72rem] max-w-[calc(100vw-24rem)] h-[25rem] mb-6 overflow-visible">
            <div
              className="absolute left-1/2 bottom-0 h-[7px] w-[calc(100vw-20rem)] -translate-x-1/2 rounded-full shadow-[0_2px_10px_rgba(0,0,0,0.28)]"
              style={{ backgroundColor: inputTheme.idleBorder }}
            ></div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 pointer-events-none">
              <span className="px-3 py-1 rounded bg-zinc-950/80 border border-zinc-700 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
                {reactionDef?.label || 'Reaction'}
              </span>
              <span className={`px-3 py-1 rounded border text-[10px] font-black tracking-widest uppercase ${reaction?.valid ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.35)]' : 'bg-zinc-950/80 border-zinc-700 text-zinc-500'}`}>
                {reaction?.phase === 'delay' ? 'WAIT' : reaction?.phase === 'tell' ? 'GET READY' : reaction?.valid ? 'NOW' : 'READ'}
              </span>
              {reaction?.lastResult && (
                <span className="px-3 py-1 rounded bg-zinc-950/80 border border-zinc-700 text-[10px] font-black tracking-widest text-zinc-400 uppercase">
                  {reaction.lastResult}
                </span>
              )}
            </div>

            <div className="absolute bottom-0 h-80 w-[34rem]"
              style={{ left: `${playerStageX}%`, transform: `translateX(-50%) scaleX(${playerFacing})` }}>
              <img
                src={playerReactionSprite}
                alt=""
                className="absolute w-auto max-w-none -translate-x-1/2"
                style={{
                  imageRendering: 'pixelated',
                  height: `${playerReactionMeta.height}px`,
                  left: `calc(50% + ${playerReactionMeta.x}px)`,
                  bottom: `${-5 + playerReactionMeta.y}px`,
                  filter: `
                    drop-shadow(3px 0 0 rgba(255,255,255,0.92))
                    drop-shadow(-3px 0 0 rgba(255,255,255,0.92))
                    drop-shadow(0 3px 0 rgba(255,255,255,0.92))
                    drop-shadow(0 -3px 0 rgba(255,255,255,0.92))
                    drop-shadow(0 0 18px rgba(239,68,68,0.9))
                  `
                }}
                draggable={false}
              />
            </div>

            <div className="absolute bottom-0 h-80 w-[34rem] transition-[filter] duration-75"
              style={{ left: `${opponentStageX}%`, transform: `translate(-50%, ${opponentStageY}px) scaleX(${opponentFacing})` }}>
              <img
                src={opponentReactionSprite}
                alt=""
                className="absolute w-auto max-w-none -translate-x-1/2"
                style={{
                  imageRendering: 'pixelated',
                  height: `${opponentReactionMeta.height}px`,
                  left: `calc(50% + ${opponentReactionMeta.x}px)`,
                  bottom: `${-5 + opponentReactionMeta.y}px`,
                  filter: `
                    drop-shadow(3px 0 0 rgba(255,255,255,0.92))
                    drop-shadow(-3px 0 0 rgba(255,255,255,0.92))
                    drop-shadow(0 3px 0 rgba(255,255,255,0.92))
                    drop-shadow(0 -3px 0 rgba(255,255,255,0.92))
                    drop-shadow(0 0 18px ${reaction?.valid ? 'rgba(16,185,129,0.95)' : 'rgba(34,211,238,0.85)'})
                  `
                }}
                draggable={false}
              />
            </div>
          </div>
        )}

        {/* Progress Tracker UI */}
        <div className="relative z-10 text-center w-80">
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">
             {trainingMode === 'precision' ? 'Total Attempts' : trainingMode === 'reaction' ? 'Reaction Clears' : 'Current Streak'}
          </div>
          <div className="text-3xl font-black italic text-cyan-400">
             {progressCount} <span className="text-zinc-600 text-xl">/ {successTarget}</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded mt-3 overflow-hidden">
             <div className="h-full bg-cyan-400 transition-all duration-300 shadow-[0_0_10px_#22d3ee]" style={{ width: `${(progressCount/successTarget)*100}%` }}></div>
          </div>

          {trainingMode === 'precision' && (
             <div className="flex justify-center gap-4 text-xs font-mono mt-3 border-t border-zinc-800 pt-3">
                <span className="text-cyan-400 font-bold tracking-wider">{stats.successes} SUCCESS</span>
                <span className="text-zinc-600 font-black">|</span>
                <span className="text-red-500 font-bold tracking-wider">{stats.failures} FAIL</span>
             </div>
          )}
        </div>
      </div>

      {/* BOTTOM PANEL: Virtual Controller */}
      <div className="absolute bottom-0 right-0 left-80 bg-zinc-900 border-t border-zinc-800 p-8 z-20">
        <div className="flex gap-12 items-center justify-center">
          
          <div className="grid grid-cols-3 gap-2 w-32 relative">
             <div className="col-start-2 w-10 h-10 rounded bg-zinc-800 flex items-center justify-center"><div className={`w-6 h-6 rounded-sm ${effKeys.up ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-zinc-700'}`}></div></div>
             <div className="col-start-1 row-start-2 w-10 h-10 rounded bg-zinc-800 flex items-center justify-center"><div className={`w-6 h-6 rounded-sm ${effKeys.left ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-zinc-700'}`}></div></div>
             <div className="col-start-2 row-start-2 w-10 h-10 rounded bg-zinc-800 flex items-center justify-center"><div className={`w-6 h-6 rounded-sm ${(effKeys.down||effKeys.up||effKeys.left||effKeys.right) ? 'bg-zinc-700' : 'bg-zinc-600'}`}></div></div>
             <div className="col-start-3 row-start-2 w-10 h-10 rounded bg-zinc-800 flex items-center justify-center"><div className={`w-6 h-6 rounded-sm ${effKeys.right ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-zinc-700'}`}></div></div>
             <div className="col-start-2 row-start-3 w-10 h-10 rounded bg-zinc-800 flex items-center justify-center"><div className={`w-6 h-6 rounded-sm ${effKeys.down ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-zinc-700'}`}></div></div>
          </div>

          <div className="grid grid-cols-3 gap-3">
             <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transform transition-transform ${effKeys.lp ? `${BUTTON_COLORS.LP.bg} ${BUTTON_COLORS.LP.border} scale-95 ${BUTTON_COLORS.LP.shadow}` : 'bg-zinc-800 border-zinc-800'}`}><span className="font-black text-xs text-white">LP</span></div>
             <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transform transition-transform ${effKeys.mp ? `${BUTTON_COLORS.MP.bg} ${BUTTON_COLORS.MP.border} scale-95 ${BUTTON_COLORS.MP.shadow}` : 'bg-zinc-800 border-zinc-800'}`}><span className="font-black text-xs text-white">MP</span></div>
             <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transform transition-transform ${effKeys.hp ? `${BUTTON_COLORS.HP.bg} ${BUTTON_COLORS.HP.border} scale-95 ${BUTTON_COLORS.HP.shadow}` : 'bg-zinc-800 border-zinc-800'}`}><span className="font-black text-xs text-white">HP</span></div>
             
             <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transform transition-transform ${effKeys.lk ? `${BUTTON_COLORS.LK.bg} ${BUTTON_COLORS.LK.border} scale-95 ${BUTTON_COLORS.LK.shadow}` : 'bg-zinc-800 border-zinc-800'}`}><span className="font-black text-xs text-white">LK</span></div>
             <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transform transition-transform ${effKeys.mk ? `${BUTTON_COLORS.MK.bg} ${BUTTON_COLORS.MK.border} scale-95 ${BUTTON_COLORS.MK.shadow}` : 'bg-zinc-800 border-zinc-800'}`}><span className="font-black text-xs text-white">MK</span></div>
             <div className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transform transition-transform ${effKeys.hk ? `${BUTTON_COLORS.HK.bg} ${BUTTON_COLORS.HK.border} scale-95 ${BUTTON_COLORS.HK.shadow}` : 'bg-zinc-800 border-zinc-800'}`}><span className="font-black text-xs text-white">HK</span></div>
          </div>

          <div className="text-xs text-zinc-500 font-mono text-left border-l border-zinc-800 pl-8">
            <p className="mb-2">MOVE: <span className="text-zinc-300">[{formatKey(keyMap.up)}] [{formatKey(keyMap.left)}] [{formatKey(keyMap.down)}] [{formatKey(keyMap.right)}] / Gamepad</span></p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
               <p className="flex items-center gap-1.5">LP: <span className="font-bold" style={{color: BUTTON_COLORS.LP.text}}>[{formatKey(keyMap.lp)}]</span> / <XboxIcon buttonId={padMap.lp} /></p>
               <p className="flex items-center gap-1.5">LK: <span className="font-bold" style={{color: BUTTON_COLORS.LK.text}}>[{formatKey(keyMap.lk)}]</span> / <XboxIcon buttonId={padMap.lk} /></p>
               <p className="flex items-center gap-1.5">MP: <span className="font-bold" style={{color: BUTTON_COLORS.MP.text}}>[{formatKey(keyMap.mp)}]</span> / <XboxIcon buttonId={padMap.mp} /></p>
               <p className="flex items-center gap-1.5">MK: <span className="font-bold" style={{color: BUTTON_COLORS.MK.text}}>[{formatKey(keyMap.mk)}]</span> / <XboxIcon buttonId={padMap.mk} /></p>
               <p className="flex items-center gap-1.5">HP: <span className="font-bold" style={{color: BUTTON_COLORS.HP.text}}>[{formatKey(keyMap.hp)}]</span> / <XboxIcon buttonId={padMap.hp} /></p>
               <p className="flex items-center gap-1.5">HK: <span className="font-bold" style={{color: BUTTON_COLORS.HK.text}}>[{formatKey(keyMap.hk)}]</span> / <XboxIcon buttonId={padMap.hk} /></p>
            </div>
          </div>
        </div>
      </div>

      {renderOptionsModal()}

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
