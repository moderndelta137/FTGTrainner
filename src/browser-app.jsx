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

const TABS = ['MOTION', 'CHARGE', 'GRAPPLER', 'COMBOS'];

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

const DirIcon = ({ dir, className, flip = false }) => {
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
      if (dir === 'P' || ['LP','MP','HP'].includes(dir)) return <span className={`font-black ${className} text-pink-400 drop-shadow-md`}>{dir}</span>;
      if (dir === 'K' || ['LK','MK','HK'].includes(dir)) return <span className={`font-black ${className} text-cyan-400 drop-shadow-md`}>{dir}</span>;
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
  const [enableShake, setEnableShake] = useState(true);
  const [shakeStrengthX, setShakeStrengthX] = useState(50);
  const [shakeStrengthY, setShakeStrengthY] = useState(50);
  
  const [, setRenderTick] = useState(0);

  const loopRef = useRef();
  const diagnosticRef = useRef([]); 
  const bannerTimeoutRef = useRef(null);
  const resetTriggerRef = useRef(false);
  
  const stateRef = useRef({
    totalFrames: 0,
    stepGlows: {},
    shakeFrames: 0,
    shakeType: null, // 'light' | 'heavy' | 'error'
    
    // Engine State
    keys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
    effectiveKeys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
    history: [{ id: 0, dir: 5, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false, frames: 0, matchType: null }],
    nextId: 1,
    progress: 0,
    framesSinceLastProgress: 0,
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
     const savedMap = localStorage.getItem('ftg_keymap');
     if (savedMap) setKeyMap(JSON.parse(savedMap));
     const savedPadMap = localStorage.getItem('ftg_padmap');
     if (savedPadMap) setPadMap(JSON.parse(savedPadMap));
     
     const savedVol = localStorage.getItem('ftg_vol');
     if (savedVol) setVolume(parseInt(savedVol));
     const savedShake = localStorage.getItem('ftg_shake');
     if (savedShake) setEnableShake(savedShake !== 'false');
     const savedShakeX = localStorage.getItem('ftg_shake_x');
     if (savedShakeX) setShakeStrengthX(parseInt(savedShakeX));
     const savedShakeY = localStorage.getItem('ftg_shake_y');
     if (savedShakeY) setShakeStrengthY(parseInt(savedShakeY));
  }, []);

  // Save Settings
  useEffect(() => { localStorage.setItem('ftg_keymap', JSON.stringify(keyMap)); }, [keyMap]);
  useEffect(() => { localStorage.setItem('ftg_padmap', JSON.stringify(padMap)); }, [padMap]);
  useEffect(() => { localStorage.setItem('ftg_vol', volume.toString()); }, [volume]);
  useEffect(() => { localStorage.setItem('ftg_shake', enableShake.toString()); }, [enableShake]);
  useEffect(() => { localStorage.setItem('ftg_shake_x', shakeStrengthX.toString()); }, [shakeStrengthX]);
  useEffect(() => { localStorage.setItem('ftg_shake_y', shakeStrengthY.toString()); }, [shakeStrengthY]);

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
  const evaluateInput = (pEntry) => {
    let s = stateRef.current;
    let moveDef = MOVE_LIST[targetMove];
    let seq = moveDef.sequence;
    let expected = seq[s.progress];
    let lastEntry = s.history[s.history.length - 2] || s.history[0];

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
          if (s.progress < seq.length && (
              (nextExp === 'P' && isPunch(actionPressed)) || 
              (nextExp === 'K' && isKick(actionPressed)) || 
              (nextExp === actionPressed)
          )) {
              s.progress++;
              consumedAction = actionPressed;
              s.stepGlows[s.progress - 1] = s.totalFrames;
          } else {
              failed = true;
              failDetail = `Pressed ${ERROR_MAP[actionPressed] || actionPressed} too early. Expected ${ERROR_MAP[nextExp] || nextExp}.`;
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
            if (diagnosticRef.current.length > 0) { setDiagnostics([]); diagnosticRef.current = []; }

            s.successesThisSession++;
            s.attemptsThisSession++;
            s.currentStreak++;
            setHitCounter(s.currentStreak);

            const lenFrames = s.sequenceFrames;
            const lenSecs = (lenFrames / 60).toFixed(2);
            let baseSeqLength = seq.length + (moveDef.charge ? 1 : 0) + (moveDef.require360 ? moveDef.require360.count * 4 : 0);
            const prec = Math.round((baseSeqLength / (baseSeqLength + s.sequenceSloppy)) * 100);
            
            const dataPoint = { id: Date.now(), type: 'success', frames: lenFrames, seconds: lenSecs, precision: prec };
            setSessionData(prev => [...prev, dataPoint]);

            setSuccessBanner(dataPoint);
            if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
            bannerTimeoutRef.current = setTimeout(() => setSuccessBanner(null), 2500);

            s.progress = 0; s.sequenceFrames = 0; s.sequenceSloppy = 0;

            setStats({ successes: s.successesThisSession, failures: s.failuresThisSession });
            setProgressCount(trainingMode === 'streak' ? s.successesThisSession : s.attemptsThisSession);

            if (trainingMode === 'streak' && s.successesThisSession >= successTarget) setScreen('results');
            else if (trainingMode === 'precision' && s.attemptsThisSession >= successTarget) setScreen('results');
          }
      }
    } 
    
    if (!matched || failed) {
      if (!failed && actionPressed) {
        failed = true;
        let expectedStr = ERROR_MAP[expected] || expected;
        if (expectedStr === undefined && typeof expected === 'number') expectedStr = `Direction (${expected})`;
        failDetail = `Expected ${expectedStr}, got ${ERROR_MAP[actionPressed] || actionPressed}.`;

        if (s.progress === 0) {
            if (moveDef.charge) failDetail = `Charge not ready! Needed ${moveDef.charge.frames}f of ${moveDef.charge.label}.`;
            if (moveDef.require360) failDetail = `Motion incomplete! Needed ${moveDef.require360.label} before pressing ${actionPressed}.`;
        }
      }

      if (failed) {
        playSFX('error', s.volume);
        if (s.enableShake) { s.shakeFrames = 15; s.shakeType = 'error'; }

        const diagObj = { id: Date.now(), title: failTitle, detail: failDetail, step: s.progress };
        setDiagnostics(prev => [...prev.slice(-1), diagObj]); 
        diagnosticRef.current = [...diagnosticRef.current.slice(-1), diagObj];
        
        s.failuresThisSession++;
        s.attemptsThisSession++;
        s.currentStreak = 0;
        setHitCounter(0);

        if (trainingMode === 'streak') {
           s.successesThisSession = 0; s.attemptsThisSession = 0; setSessionData([]);
        } else {
           setSessionData(prev => [...prev, { id: Date.now(), type: 'error', reason: failDetail }]);
        }

        pEntry.matchType = 'error'; pEntry.errorReason = failDetail;
        s.progress = 0; s.framesSinceLastProgress = 0; s.sloppyInputs = 0; s.sequenceFrames = 0; s.sequenceSloppy = 0;

        setStats({ successes: s.successesThisSession, failures: s.failuresThisSession });
        setProgressCount(trainingMode === 'streak' ? s.successesThisSession : s.attemptsThisSession);

        if (trainingMode === 'precision' && s.attemptsThisSession >= successTarget) setScreen('results');
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
          stateRef.current.keys = { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false };
          stateRef.current.effectiveKeys = { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false };
          stateRef.current.successesThisSession = 0; stateRef.current.failuresThisSession = 0; stateRef.current.attemptsThisSession = 0;
          stateRef.current.progress = 0; stateRef.current.framesSinceLastProgress = 0; stateRef.current.sloppyInputs = 0;
          stateRef.current.sequenceFrames = 0; stateRef.current.sequenceSloppy = 0; stateRef.current.currentStreak = 0;
          stateRef.current.history = [{ id: Date.now(), dir: 5, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false, frames: 0, matchType: null }];
          setProgressCount(0); setHitCounter(0); setStats({ successes: 0, failures: 0 }); setSessionData([]); setDiagnostics([]);
          diagnosticRef.current = []; setSuccessBanner(null);
      }

      let s = stateRef.current;
      s.totalFrames++;
      if (s.progress > 0) s.sequenceFrames++;
      if (s.shakeFrames > 0) s.shakeFrames--;

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
      let lastEntry = s.history[s.history.length - 1];

      let dirChanged = currentDir !== lastEntry.dir;
      let actionChanged = (cLp !== lastEntry.lp || cMp !== lastEntry.mp || cHp !== lastEntry.hp || cLk !== lastEntry.lk || cMk !== lastEntry.mk || cHk !== lastEntry.hk);
      let anyActionPressed = (cLp || cMp || cHp || cLk || cMk || cHk);

      if (!dirChanged && !actionChanged) {
        lastEntry.frames += 1;
        let prevMatched = s.progress > 0 ? MOVE_LIST[targetMove].sequence[s.progress - 1] : null;
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
         let prevMatched = MOVE_LIST[targetMove].sequence[s.progress - 1];
         let isComboLink = typeof prevMatched === 'string' && (prevMatched.includes('P') || prevMatched.includes('K') || prevMatched.includes('HP'));
         let timeoutLimit = isComboLink ? 45 : 12; 
         
         if (s.framesSinceLastProgress > timeoutLimit) {
            s.failuresThisSession++; s.attemptsThisSession++;
            s.currentStreak = 0; setHitCounter(0);

            let failDetail = `Input was too slow. You took longer than ${timeoutLimit} frames.`;
            let diagObj = { id: Date.now(), title: "DROPPED COMBO", detail: failDetail, step: s.progress };
            
            playSFX('error', s.volume);
            if (s.enableShake) { s.shakeFrames = 15; s.shakeType = 'error'; }

            setDiagnostics(prev => [...prev.slice(-1), diagObj]);
            diagnosticRef.current = [...diagnosticRef.current.slice(-1), diagObj];
            
            if (trainingMode === 'streak') {
               s.successesThisSession = 0; s.attemptsThisSession = 0; setSessionData([]);
            } else {
               setSessionData(prev => [...prev, { id: Date.now(), type: 'error', reason: failDetail }]);
            }
            
            let pEntry = s.history[s.history.length - 1];
            pEntry.matchType = 'error'; pEntry.errorReason = failDetail;
            
            s.progress = 0; s.framesSinceLastProgress = 0; s.sloppyInputs = 0; s.sequenceFrames = 0; s.sequenceSloppy = 0;

            setStats({ successes: s.successesThisSession, failures: s.failuresThisSession });
            setProgressCount(trainingMode === 'streak' ? s.successesThisSession : s.attemptsThisSession);

            if (trainingMode === 'precision' && s.attemptsThisSession >= successTarget) setScreen('results');
         }
      }
      
      setRenderTick(t => t + 1);
      loopRef.current = requestAnimationFrame(loop);
    };

    loopRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp);
      cancelAnimationFrame(loopRef.current);
      if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    };
  }, [screen, targetMove, trainingMode, successTarget, playerSide, keyMap, padMap]);

  const startTraining = (moveId) => {
    initAudio();
    setTargetMove(moveId || targetMove);
    setProgressCount(0); setHitCounter(0); setStats({ successes: 0, failures: 0 }); setSessionData([]); setDiagnostics([]);
    setSuccessBanner(null); diagnosticRef.current = [];
    stateRef.current = {
       totalFrames: 0, stepGlows: {}, shakeFrames: 0, shakeType: null,
       keys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
       effectiveKeys: { up: false, down: false, left: false, right: false, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false },
       history: [{ id: Date.now(), dir: 5, lp: false, mp: false, hp: false, lk: false, mk: false, hk: false, frames: 0, matchType: null }],
       nextId: 1,
       progress: 0, framesSinceLastProgress: 0, sloppyInputs: 0, sequenceFrames: 0, sequenceSloppy: 0,
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

  const renderOptionsModal = () => {
     if (!showOptions) return null;
     return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center backdrop-blur-sm">
           <div className="bg-zinc-900 border-2 border-zinc-800 p-8 rounded-lg w-[32rem] max-h-[90vh] overflow-y-auto flex flex-col relative shadow-2xl">
              <button onClick={() => {setShowOptions(false); setRemappingKey(null); setRemappingPadKey(null);}} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">✕</button>
              <h2 className="text-3xl font-black italic text-cyan-400 tracking-widest mb-8">OPTIONS</h2>
              
              <div className="mb-4">
                 <label className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4 flex justify-between">
                    <span>Audio Volume</span> <span>{volume}%</span>
                 </label>
                 <input type="range" min="0" max="100" value={volume} onChange={(e)=>setVolume(e.target.value)} className="w-full accent-cyan-400" />
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

  // ======================
  // 1. MENU SCREEN
  // ======================
  if (screen === 'menu') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800 to-zinc-950 select-none relative">
        
        <button onClick={() => setShowOptions(true)} className="absolute top-8 right-8 text-zinc-500 hover:text-cyan-400 transition-colors flex items-center gap-2">
           <span className="text-xl">⚙️</span><span className="font-bold tracking-widest text-sm">OPTIONS</span>
        </button>

        <h1 className="text-6xl font-black italic tracking-tighter mb-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-pink-500 drop-shadow-lg">
          EXECUTION TRAINER
        </h1>
        <p className="text-zinc-400 font-mono tracking-widest mb-10">SELECT YOUR DRILL</p>

        <div className="flex w-full h-[65vh] max-w-6xl mx-auto border-2 border-zinc-800 rounded-lg overflow-hidden shadow-2xl bg-zinc-900">
          
          <div className="w-64 bg-zinc-950 flex flex-col border-r border-zinc-800">
            <div className="p-4 bg-zinc-900 border-b border-zinc-800 text-xs font-black text-zinc-500 tracking-widest uppercase">Categories</div>
            {TABS.map(tab => (
               <button key={tab} onClick={() => { setActiveTab(tab); setTargetMove(Object.keys(MOVE_LIST).find(k => MOVE_LIST[k].tab === tab)); }}
                 className={`w-full text-left px-6 py-5 font-black italic text-lg tracking-wider transition-colors border-l-4 ${activeTab === tab ? 'border-yellow-500 bg-zinc-800 text-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.1)]' : 'border-transparent text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'}`}>
                 {tab}
               </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col bg-zinc-900">
            <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex justify-between items-center">
               <span className="text-xs font-black text-zinc-500 tracking-widest uppercase">Command List</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-3 no-scrollbar">
               {Object.entries(MOVE_LIST).filter(([id, m]) => m.tab === activeTab).map(([id, move]) => {
                  const rec = records[id];
                  return (
                  <button key={id} onClick={() => setTargetMove(id)}
                    className={`w-full flex items-center justify-between p-4 bg-zinc-950/50 border-2 rounded transition-all ${targetMove === id ? 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]' : 'border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/50'}`}>
                     <div className="text-left flex flex-col">
                        <span className={`font-black italic text-xl ${targetMove === id ? 'text-yellow-500' : 'text-zinc-200'}`}>{move.name}</span>
                        <div className="text-[10px] font-mono text-zinc-400 mt-1 flex gap-3">
                           <span>BEST SR: <span className="text-pink-400">{rec?.bestSuccessRate || 0}%</span></span>
                           <span>BEST TIME: <span className="text-white">{rec?.bestFrames < 9999 ? rec.bestFrames : '--'}f</span></span>
                           <span>BEST PREC: <span className="text-cyan-400">{rec?.bestPrecision || 0}%</span></span>
                        </div>
                     </div>
                     <div className="flex items-center gap-2 bg-zinc-900 py-2 px-3 rounded border border-zinc-800 shadow-inner">
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
            </div>
          </div>

          <div className="w-80 bg-zinc-950 border-l border-zinc-800 flex flex-col">
            <div className="p-4 bg-yellow-500 text-black font-black italic tracking-widest text-center text-lg uppercase">Drill Config</div>
            <div className="p-6 flex-1 flex flex-col gap-6 overflow-y-auto no-scrollbar">
               
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
                  </div>
               </div>
               
               <div>
                  <label className="flex justify-between text-xs font-black text-zinc-500 tracking-widest mb-4 uppercase">
                     <span>{trainingMode === 'streak' ? 'TARGET SUCCESSES' : 'TOTAL ATTEMPTS'}</span>
                     <span className={trainingMode === 'streak' ? 'text-pink-500 text-lg leading-none' : 'text-cyan-400 text-lg leading-none'}>{successTarget}</span>
                  </label>
                  <input type="range" min="1" max="100" value={successTarget} onChange={(e) => setSuccessTarget(parseInt(e.target.value))} className={`w-full ${trainingMode === 'streak' ? 'accent-pink-500' : 'accent-cyan-400'}`} />
                  <p className="text-[10px] text-zinc-600 font-mono mt-3 leading-tight">
                     {trainingMode === 'streak' ? 'Execute perfectly in a row. A single drop resets the streak.' : 'Execute the target amount of times. Tracks your total failure rate and average precision.'}
                  </p>
               </div>

            </div>
            
            <button onClick={() => startTraining(targetMove)} className="py-6 bg-yellow-500 hover:bg-yellow-400 text-black font-black italic text-3xl tracking-tighter transition-colors uppercase">
               START
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
         <p className="text-zinc-400 font-mono tracking-widest mb-10 uppercase">{MOVE_LIST[targetMove].name} - {successTarget} {trainingMode === 'streak' ? 'SUCCESSES' : 'ATTEMPTS'}</p>
         
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
  const isSuccessLinger = !!successBanner;
  const latestDiagnostic = diagnostics.length > 0 ? diagnostics[diagnostics.length - 1] : null;
  
  const curMoveDef = MOVE_LIST[targetMove];
  const chargeFramesCount = curMoveDef.charge ? getChargeFrames(h, curMoveDef.charge.dirs) : 0;
  
  const isChargeReady = curMoveDef.charge ? (activeProgress > 0 || isSuccessLinger || chargeFramesCount >= curMoveDef.charge.frames) : false;
  const chargePercent = curMoveDef.charge ? ((activeProgress > 0 || isSuccessLinger) ? 100 : Math.min(100, (chargeFramesCount / curMoveDef.charge.frames) * 100)) : 0;
  
  const status360 = curMoveDef.require360 ? get360Status(h, curMoveDef.require360.frames, curMoveDef.require360.count) : { isReady: false, percent: 0 };
  const is360Ready = curMoveDef.require360 ? (activeProgress > 0 || isSuccessLinger || status360.isReady) : false;
  const spinPercent = curMoveDef.require360 ? ((activeProgress > 0 || isSuccessLinger) ? 100 : status360.percent) : 0;

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
            <button onClick={() => setScreen('menu')} className="text-zinc-500 hover:text-cyan-400 font-mono text-sm tracking-widest flex items-center gap-2 transition-colors w-max uppercase">
               <span>◄</span> BACK TO MENU
            </button>
            <h1 className="text-3xl font-black italic text-white tracking-tighter drop-shadow-lg uppercase">
              {MOVE_LIST[targetMove].name}
            </h1>
            <div className="flex gap-2">
               <span className="text-[10px] font-bold tracking-widest px-2 py-1 bg-zinc-800 text-zinc-400 rounded uppercase">
                  {trainingMode === 'streak' ? 'STREAK MODE' : 'PRECISION TEST'}
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
                     COMBO SUCCESS
                  </h2>
                  <p className="text-cyan-100 font-bold tracking-widest font-mono text-sm mt-1 drop-shadow-md">
                     TIME: {successBanner.frames}f | PRECISION: {successBanner.precision}%
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
                   {entry.lp && <span className="px-1.5 py-0.5 text-[9px] font-black bg-pink-400 text-white rounded-sm">LP</span>}
                   {entry.mp && <span className="px-1.5 py-0.5 text-[9px] font-black bg-pink-500 text-white rounded-sm">MP</span>}
                   {entry.hp && <span className="px-1.5 py-0.5 text-[9px] font-black bg-pink-600 text-white rounded-sm">HP</span>}
                   {entry.lk && <span className="px-1.5 py-0.5 text-[9px] font-black bg-cyan-400 text-white rounded-sm">LK</span>}
                   {entry.mk && <span className="px-1.5 py-0.5 text-[9px] font-black bg-cyan-500 text-white rounded-sm">MK</span>}
                   {entry.hk && <span className="px-1.5 py-0.5 text-[9px] font-black bg-cyan-600 text-white rounded-sm">HK</span>}
                 </div>
              </div>

              {entry.matchType === 'error' && (
                 <div className="hidden group-hover:block mt-2 ml-14 text-[10px] leading-tight text-red-200 bg-red-950/80 p-2 rounded border border-red-800/50 shadow-inner">
                    <div className="font-black italic text-red-500 mb-0.5 tracking-widest uppercase">Input Failed</div>
                    {entry.errorReason}
                 </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CENTER STAGE */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 to-zinc-950 pl-80 pr-0">

        <div className="mb-12 flex flex-col items-center mt-24">
           <div className="text-zinc-500 font-mono text-xs tracking-widest mb-4 uppercase">DESIRED INPUT</div>
           <div className="flex gap-4 items-center">
             
             {curMoveDef.charge && (
                <div className={`relative h-14 w-14 flex items-center justify-center border-2 rounded transform transition-all duration-100 overflow-hidden
                    ${isChargeReady ? 'border-yellow-400 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'border-zinc-800 bg-zinc-900/50'}`}>
                    
                    <div className="absolute bottom-0 left-0 w-full bg-yellow-400/30" style={{ height: `${chargePercent}%` }}></div>
                    <DirIcon dir={curMoveDef.charge.icon} flip={playerSide === 'P2'} className={`relative z-10 w-8 h-8 ${isChargeReady ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-zinc-300'}`} />
                </div>
             )}
             
             {curMoveDef.require360 && (
                <div className={`relative h-14 w-14 flex items-center justify-center border-2 rounded transform transition-all duration-100 overflow-hidden
                    ${is360Ready ? 'border-yellow-400 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.4)]' : 'border-zinc-800 bg-zinc-900/50'}`}>
                    
                    <div className="absolute inset-0 opacity-40" style={{ background: `conic-gradient(#facc15 ${spinPercent}%, transparent 0)` }}></div>
                    <DirIcon dir={curMoveDef.require360.label} flip={playerSide === 'P2'} className={`relative z-10 w-8 h-8 ${is360Ready ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]' : 'text-zinc-300'}`} />
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
                } else if (framesPassed < 45) { 
                   // Independent 45-frame (0.75s) smooth decay glow
                   const ratio = 1 - (framesPassed / 45);
                   const easeOut = 1 - Math.pow(1 - ratio, 3);
                   
                   const scale = 1 + (easeOut * (isLast ? 0.25 : 0.10));
                   const shadowSpread = isLast ? 30 * easeOut : 15 * easeOut;
                   const alpha = easeOut * (isLast ? 0.9 : 0.6);
                   
                   inlineStyle = {
                       transform: `scale(${scale})`,
                       borderColor: `rgba(34,211,238,${alpha})`,
                       color: `rgba(34,211,238,${Math.max(0.3, alpha + 0.5)})`,
                       backgroundColor: `rgba(34,211,238,${alpha * 0.2})`,
                       boxShadow: `0 0 ${shadowSpread}px rgba(34,211,238,${alpha})`,
                       zIndex: isLast ? 10 : 1
                   };
                   containerClass += "transition-none";
                } else if (isCurrent) {
                   containerClass += "border-zinc-500 text-zinc-300 scale-105 transition-all duration-100";
                } else {
                   containerClass += "border-zinc-800 text-zinc-700 transition-all duration-100";
                }

                return (
                   <div key={idx} className={containerClass} style={inlineStyle}>
                      <DirIcon dir={step} flip={playerSide === 'P2'} className="w-8 h-8" />
                   </div>
                )
             })}
           </div>
        </div>

        {/* Progress Tracker UI */}
        <div className="text-center w-80">
          <div className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">
             {trainingMode === 'streak' ? 'Current Streak' : 'Total Attempts'}
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
             <div className={`w-12 h-12 rounded-full border-4 border-zinc-800 flex items-center justify-center transform transition-transform ${effKeys.lp ? 'bg-pink-400 scale-95 shadow-[0_0_15px_#f472b6]' : 'bg-zinc-800'}`}><span className="font-black text-xs text-white">LP</span></div>
             <div className={`w-12 h-12 rounded-full border-4 border-zinc-800 flex items-center justify-center transform transition-transform ${effKeys.mp ? 'bg-pink-500 scale-95 shadow-[0_0_15px_#ec4899]' : 'bg-zinc-800'}`}><span className="font-black text-xs text-white">MP</span></div>
             <div className={`w-12 h-12 rounded-full border-4 border-zinc-800 flex items-center justify-center transform transition-transform ${effKeys.hp ? 'bg-pink-600 scale-95 shadow-[0_0_15px_#db2777]' : 'bg-zinc-800'}`}><span className="font-black text-xs text-white">HP</span></div>
             
             <div className={`w-12 h-12 rounded-full border-4 border-zinc-800 flex items-center justify-center transform transition-transform ${effKeys.lk ? 'bg-cyan-400 scale-95 shadow-[0_0_15px_#22d3ee]' : 'bg-zinc-800'}`}><span className="font-black text-xs text-white">LK</span></div>
             <div className={`w-12 h-12 rounded-full border-4 border-zinc-800 flex items-center justify-center transform transition-transform ${effKeys.mk ? 'bg-cyan-500 scale-95 shadow-[0_0_15px_#06b6d4]' : 'bg-zinc-800'}`}><span className="font-black text-xs text-white">MK</span></div>
             <div className={`w-12 h-12 rounded-full border-4 border-zinc-800 flex items-center justify-center transform transition-transform ${effKeys.hk ? 'bg-cyan-600 scale-95 shadow-[0_0_15px_#0891b2]' : 'bg-zinc-800'}`}><span className="font-black text-xs text-white">HK</span></div>
          </div>

          <div className="text-xs text-zinc-500 font-mono text-left border-l border-zinc-800 pl-8">
            <p className="mb-2">MOVE: <span className="text-zinc-300">[{formatKey(keyMap.up)}] [{formatKey(keyMap.left)}] [{formatKey(keyMap.down)}] [{formatKey(keyMap.right)}] / Gamepad</span></p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
               <p className="flex items-center gap-1.5">LP: <span className="text-pink-400 font-bold">[{formatKey(keyMap.lp)}]</span> / <XboxIcon buttonId={padMap.lp} /></p>
               <p className="flex items-center gap-1.5">LK: <span className="text-cyan-400 font-bold">[{formatKey(keyMap.lk)}]</span> / <XboxIcon buttonId={padMap.lk} /></p>
               <p className="flex items-center gap-1.5">MP: <span className="text-pink-500 font-bold">[{formatKey(keyMap.mp)}]</span> / <XboxIcon buttonId={padMap.mp} /></p>
               <p className="flex items-center gap-1.5">MK: <span className="text-cyan-500 font-bold">[{formatKey(keyMap.mk)}]</span> / <XboxIcon buttonId={padMap.mk} /></p>
               <p className="flex items-center gap-1.5">HP: <span className="text-pink-600 font-bold">[{formatKey(keyMap.hp)}]</span> / <XboxIcon buttonId={padMap.hp} /></p>
               <p className="flex items-center gap-1.5">HK: <span className="text-cyan-600 font-bold">[{formatKey(keyMap.hk)}]</span> / <XboxIcon buttonId={padMap.hk} /></p>
            </div>
          </div>
        </div>
      </div>

      {renderOptionsModal()}

    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
