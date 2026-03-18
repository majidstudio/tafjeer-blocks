import React, { useState, useEffect, useCallback, useRef, useMemo, useReducer } from “react”;

/* ═══════════════════════════════════════════════════════════
تفجير البلوكات! — BLOCK BLAST SA v11 (Production Grade)
Architecture: useReducer + State Machine + Error Boundary
═══════════════════════════════════════════════════════════ */

/* ── Constants ── */
const GRID_SIZE = 8, GAP = 3, PAD = 10, TRAY_SCALE = 0.48;
const SAVE_KEY = “desert-blocks-save”;
const SAVE_VERSION = 2;
const MILESTONES = [50,100,200,350,500,750,1000,1500,2000,3000,5000];
const DAILY_TARGET = 500, DAILY_REWARD = 100;

/* ── Saudi Humor System ── */
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const SAUDI_CLEAR = [
[“كفووو! 🔥”,“يا زين! ✨”],
[“يا سلام! ⚡”,“وناسة! 🎉”],
[“ما شاء الله! 💥”,“تبارك الرحمن! 🌟”],
[“أسطوري! 👑”,“يا جبل ما يهزك ريح! 🏔️”],
[“خرافي! 🏆”,“فوق المستوى! 💎”],
];
const SAUDI_STREAK = [“حامي الوطيس! 🔥🔥”,“ما يوقفك أحد! 💪”,“مسيطر! 🦅”];
const SAUDI_BROKE = [“طيب عادي المرة الجاية 😅”,“راحت عليك 🫠”,“يلا من جديد 💫”];
const SAUDI_OVER = [“يالله توكلنا على الله 🤲”,“المرة الجاية إن شاء الله 🙏”,“يا حظك! ما علينا 😤”,“ما قصرت بس الحظ خانك 🫡”];
const SAUDI_RECORD = [“أنت وحش يا وحش! 🐺”,“ملك البلوكات! 👑”,“ذبحتها ذبح! 🗡️”];
const SAUDI_BOMB = [“تررررا! 💥”,“بووووم! 🧨”,“دمار شامل! 😈”];
const SAUDI_ALMOST_FULL = [“ضاقت عليك الدنيا؟ 😂”,“الوضع حرج! 🚨”,“يا ساتر! 😰”];

function getCellSize() {
if (typeof window === “undefined”) return 42;
const maxW = Math.min(window.innerWidth * 0.92, 520);
return Math.min(56, Math.floor((maxW - PAD * 2 - GAP * (GRID_SIZE - 1)) / GRID_SIZE));
}

/* ── Colors ── */
const COLORS = [
{ bg: “#c8900e”, glow: “#f5cb42”, dark: “#7a5808” },
{ bg: “#0f8a3e”, glow: “#3de88a”, dark: “#064d22” },
{ bg: “#1d6ec2”, glow: “#5aacff”, dark: “#0c3d6e” },
{ bg: “#c42b2b”, glow: “#ff6666”, dark: “#6e1717” },
{ bg: “#7530d4”, glow: “#a87bef”, dark: “#3e1880” },
{ bg: “#c06008”, glow: “#ffb340”, dark: “#6e3704” },
];

/* ── Shapes (weighted pools) ── */
const SHAPES_SMALL = [[[1]],[[1,1]],[[1],[1]],[[1,1,1]],[[1],[1],[1]],[[1,1],[1,0]],[[1,1],[0,1]],[[1,0],[1,1]],[[0,1],[1,1]]];
const SHAPES_MED = [[[1,1],[1,1]],[[1,0],[1,0],[1,1]],[[0,1],[0,1],[1,1]],[[1,1],[1,0],[1,0]],[[1,1],[0,1],[0,1]],[[1,1,1],[0,1,0]],[[0,1],[1,1],[0,1]],[[1,0],[1,1],[1,0]],[[0,1,0],[1,1,1]],[[1,1,1,1]],[[1],[1],[1],[1]],[[1,1,0],[0,1,1]],[[0,1,1],[1,1,0]]];
const SHAPES_LARGE = [[[1,0,0],[1,0,0],[1,1,1]],[[0,0,1],[0,0,1],[1,1,1]],[[1,1,1],[0,0,1],[0,0,1]],[[1,1,1],[1,0,0],[1,0,0]],[[1,1,1,1,1]],[[1],[1],[1],[1],[1]],[[1,1,1],[1,1,1],[1,1,1]]];

/* ── Pure Game Logic (testable) ── */
const randomColor = () => Math.floor(Math.random() * COLORS.length);
const randomPiece = () => {
const roll = Math.random();
const pool = roll < 0.55 ? SHAPES_SMALL : roll < 0.88 ? SHAPES_MED : SHAPES_LARGE;
return { shape: pool[Math.floor(Math.random() * pool.length)], color: randomColor(), id: Math.random().toString(36).slice(2, 8) };
};
const generateThree = () => [randomPiece(), randomPiece(), randomPiece()];
const emptyGrid = () => Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(-1));

const canPlace = (grid, shape, row, col) => {
for (let r = 0; r < shape.length; r++)
for (let c = 0; c < shape[r].length; c++)
if (shape[r][c]) {
const nr = row + r, nc = col + c;
if (nr < 0 || nr >= GRID_SIZE || nc < 0 || nc >= GRID_SIZE || grid[nr][nc] !== -1) return false;
}
return true;
};

const anyFits = (grid, pieces) => pieces.some(p => {
if (!p) return false;
for (let r = 0; r < GRID_SIZE; r++)
for (let c = 0; c < GRID_SIZE; c++)
if (canPlace(grid, p.shape, r, c)) return true;
return false;
});

const generateThreeSafe = (grid) => {
for (let attempt = 0; attempt < 8; attempt++) {
const pieces = generateThree();
if (!grid || anyFits(grid, pieces)) return pieces;
}
return generateThree();
};

const countBlocks = shape => { let n = 0; shape.forEach(r => r.forEach(v => { if (v) n++; })); return n; };

const findCompletions = (grid) => {
const fullRows = [], fullCols = [];
for (let r = 0; r < GRID_SIZE; r++) if (grid[r].every(v => v !== -1)) fullRows.push(r);
for (let c = 0; c < GRID_SIZE; c++) if (grid.every(row => row[c] !== -1)) fullCols.push(c);
return { fullRows, fullCols, totalCleared: fullRows.length + fullCols.length };
};

const clearLines = (grid, fullRows, fullCols) => {
const newGrid = grid.map(r => […r]);
fullRows.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) newGrid[r][c] = -1; });
fullCols.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) newGrid[r][c] = -1; });
return newGrid;
};

const calculateScore = (blockCount, linesCleared, streakLevel) => {
let pts = blockCount;
if (linesCleared > 0) {
pts += linesCleared * 10;
if (linesCleared >= 2) pts += linesCleared * 20;
if (linesCleared >= 3) pts += linesCleared * 35;
if (linesCleared >= 4) pts += linesCleared * 50;
if (streakLevel > 1) pts += streakLevel * 10;
}
return pts;
};

const calculateCoinReward = (linesCleared, streakLevel) => linesCleared * 3 + (streakLevel > 1 ? streakLevel * 2 : 0);

/* ── Persistence (localStorage for web) ── */
function saveGame(data) {
try { localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, …data })); } catch (e) {}
}
function loadGame() {
try {
const raw = localStorage.getItem(SAVE_KEY);
if (!raw) return null;
const data = JSON.parse(raw);
if (!data || typeof data !== “object”) return null;
if (data.version !== SAVE_VERSION) return { best: data.best || 0, coins: data.coins || 50, games: data.games || 0, totalLines: data.totalLines || 0 };
return data;
} catch (e) { return null; }
}

/* ── Game State Reducer ── */
const PHASE = { IDLE: “idle”, CLEARING: “clearing” };

const initialGameState = {
grid: emptyGrid(), pieces: generateThree(), score: 0, best: 0, coins: 50,
lines: 0, streak: 0, games: 0, totalLines: 0, dBest: 0,
phase: PHASE.IDLE, over: false, hasBomb: false, bombActive: false,
hasUndo: false, revived: false, dailyRewarded: false,
// Undo snapshots
prevGrid: null, prevPieces: null, prevScore: 0,
};

function gameReducer(state, action) {
switch (action.type) {
case “LOAD_SAVE”: return { …state, …action.data };
case “START_GAME”: return {
…state, grid: emptyGrid(), pieces: generateThree(), score: 0, streak: 0,
lines: 0, over: false, bombActive: false, hasBomb: false, hasUndo: false,
revived: false, prevGrid: null, games: state.games + 1, phase: PHASE.IDLE,
};
case “PLACE_PIECE”: {
const { pieceIndex, row, col } = action;
const piece = state.pieces[pieceIndex];
if (!piece || !canPlace(state.grid, piece.shape, row, col) || state.phase === PHASE.CLEARING) return state;

```
  const newGrid = state.grid.map(r => [...r]);
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c]) newGrid[row + r][col + c] = piece.color;

  const { fullRows, fullCols, totalCleared } = findCompletions(newGrid);
  const newStreak = totalCleared > 0 ? state.streak + 1 : 0;
  const points = calculateScore(countBlocks(piece.shape), totalCleared, newStreak);
  const coinReward = totalCleared > 0 ? calculateCoinReward(totalCleared, newStreak) : 0;
  const newScore = state.score + points;
  const newBest = Math.max(state.best, newScore);
  const newDBest = Math.max(state.dBest, newScore);

  // Daily reward check
  let dailyBonus = 0;
  let newDailyRewarded = state.dailyRewarded;
  if (newScore >= DAILY_TARGET && !state.dailyRewarded) { dailyBonus = DAILY_REWARD; newDailyRewarded = true; }

  // Milestone check
  const newTotalLines = state.totalLines + totalCleared;
  let milestoneBonus = 0;
  const milestone = MILESTONES.find(m => state.totalLines < m && newTotalLines >= m);
  if (milestone) milestoneBonus = Math.floor(milestone / 5);

  const newPieces = [...state.pieces]; newPieces[pieceIndex] = null;
  const allUsed = newPieces.every(p => p === null);
  const freshPieces = allUsed ? generateThree() : newPieces;

  // For clear branch, grid gets cleared after animation
  const displayGrid = totalCleared > 0 ? newGrid : newGrid;

  return {
    ...state,
    grid: displayGrid, pieces: freshPieces, score: newScore, best: newBest, dBest: newDBest,
    streak: newStreak, lines: state.lines + totalCleared, totalLines: newTotalLines,
    coins: state.coins + coinReward + dailyBonus + milestoneBonus,
    phase: totalCleared > 0 ? PHASE.CLEARING : PHASE.IDLE,
    dailyRewarded: newDailyRewarded,
    prevGrid: state.grid, prevPieces: [...state.pieces], prevScore: state.score,
    // Pass clear info for effects
    _clearInfo: totalCleared > 0 ? { fullRows, fullCols, totalCleared, streak: newStreak, points, milestone, dailyBonus } : null,
    _streakBroke: totalCleared === 0 && state.streak > 1,
  };
}
case "CLEAR_DONE": {
  if (!state._clearInfo) return { ...state, phase: PHASE.IDLE };
  const clearedGrid = clearLines(state.grid, state._clearInfo.fullRows, state._clearInfo.fullCols);
  const gameOver = !anyFits(clearedGrid, state.pieces);
  return { ...state, grid: clearedGrid, phase: PHASE.IDLE, over: gameOver, _clearInfo: null };
}
case "CHECK_GAME_OVER": {
  if (state.phase === PHASE.CLEARING) return state;
  return { ...state, over: !anyFits(state.grid, state.pieces) };
}
case "GAME_OVER": return { ...state, over: true };
case "UNDO": {
  if (!state.prevGrid || !state.hasUndo) return state;
  return { ...state, grid: state.prevGrid, pieces: state.prevPieces, score: state.prevScore, hasUndo: false, prevGrid: null };
}
case "USE_BOMB": {
  const { row, col } = action;
  const newGrid = state.grid.map(r => [...r]);
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) newGrid[nr][nc] = -1;
    }
  return { ...state, grid: newGrid, bombActive: false, hasBomb: false };
}
case "BUY_ITEM": {
  const { item } = action;
  if (item === "undo" && state.coins >= 40 && !state.hasUndo) return { ...state, coins: state.coins - 40, hasUndo: true };
  if (item === "bomb" && state.coins >= 40 && !state.hasBomb) return { ...state, coins: state.coins - 40, hasBomb: true };
  if (item === "coins500") return { ...state, coins: state.coins + 500 };
  return state;
}
case "TOGGLE_BOMB": return { ...state, bombActive: !state.bombActive };
case "ADD_COINS": return { ...state, coins: state.coins + action.amount };
case "REVIVE": {
  const g = state.grid.map(r => [...r]);
  const nonEmpty = [];
  for (let r = 0; r < GRID_SIZE; r++) if (g[r].some(v => v !== -1)) nonEmpty.push(r);
  nonEmpty.sort(() => Math.random() - 0.5).slice(0, Math.min(2, nonEmpty.length)).forEach(r => {
    for (let c = 0; c < GRID_SIZE; c++) g[r][c] = -1;
  });
  return { ...state, grid: g, over: false, revived: true, pieces: generateThreeSafe(g), phase: PHASE.IDLE };
}
default: return state;
```

}
}

/* ── Sound Engine (encapsulated) ── */
function createSoundEngine() {
let ctx = null, buffers = {}, initialized = false;
const getCtx = () => { if (!ctx) try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {} if (ctx && ctx.state === “suspended”) ctx.resume(); return ctx; };
const mkBuf = (sr, dur, fn) => { const n = Math.floor(sr * dur), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = fn(i / sr); return b; };
const play = (name, vol, rate) => { const c = getCtx(); if (!c || !buffers[name]) return; const s = c.createBufferSource(); s.buffer = buffers[name]; s.playbackRate.value = rate || 1; const g = c.createGain(); g.gain.value = vol || 0.4; s.connect(g); g.connect(c.destination); s.start(); };

const init = () => {
const c = getCtx(); if (!c || initialized) return; const sr = c.sampleRate, P = Math.PI * 2;
buffers.snap = mkBuf(sr,0.05,t=>(Math.sin(P*400*t)*0.25*Math.exp(-t*55)+Math.sin(P*750*t)*0.07*Math.exp(-t*120)+(Math.random()*2-1)*0.04*Math.exp(-t*280))*Math.exp(-t*70)*0.55);
buffers.pick = mkBuf(sr,0.09,t=>(Math.sin(P*(200+140*t/0.09)*t)*0.22+Math.sin(P*(100+70*t/0.09)*t)*0.08*Math.exp(-t*25))*Math.exp(-t*20));
buffers.place = mkBuf(sr,0.16,t=>{const f=150*Math.exp(-t*5.5);return(Math.sin(P*f*t)*0.4*Math.exp(-t*12)+Math.sin(P*320*t)*0.14*Math.exp(-t*28)+(Math.random()*2-1)*0.06*Math.exp(-t*130))*Math.exp(-t*10)*0.7;});
buffers.clr1 = mkBuf(sr,0.38,t=>{const f=420;return(Math.sin(P*f*t)*0.22*Math.exp(-t*6)+Math.sin(P*f*0.5*t)*0.07*Math.exp(-t*10))*Math.exp(-t*5.5);});
buffers.clr2 = mkBuf(sr,0.48,t=>{let v=0;[420,530].forEach((f,i)=>{const l=Math.max(0,t-i*0.11);if(l<=0)return;v+=Math.sin(P*f*l)*0.18*Math.exp(-l*5);});return v;});
buffers.clr3 = mkBuf(sr,0.6,t=>{let v=0;[420,530,630,750].forEach((f,i)=>{const l=Math.max(0,t-i*0.09);if(l<=0)return;v+=Math.sin(P*f*l)*0.15*Math.exp(-l*4.5);});return v*0.8;});
buffers.combo1 = mkBuf(sr,0.32,t=>([250,315,375].reduce((v,f)=>v+Math.sin(P*f*t)*0.13,0))*Math.exp(-t*4.5));
buffers.combo2 = mkBuf(sr,0.38,t=>([315,397,472,630].reduce((v,f)=>v+Math.sin(P*f*t)*0.1,0))*Math.exp(-t*4));
buffers.err = mkBuf(sr,0.1,t=>Math.sin(P*(110*Math.exp(-t*9))*t)*0.18*Math.exp(-t*22));
buffers.bomb = mkBuf(sr,0.5,t=>(Math.sin(P*55*Math.exp(-t*2)*t)*0.35+(Math.random()*2-1)*0.06*Math.exp(-t*8))*Math.exp(-t*3.5));
buffers.over = mkBuf(sr,1.3,t=>{let v=0;[[0,[158,188,236]],[0.38,[141,168,210]],[0.75,[126,158]]].forEach(([st,ns])=>{const l=t-st;if(l<0||l>0.55)return;ns.forEach(f=>{v+=Math.sin(P*f*l)*0.08*Math.exp(-l*3.2);});});return v;});
buffers.coin = mkBuf(sr,0.16,t=>Math.sin(P*750*t)*0.12*Math.exp(-t*28)+(t>0.06?Math.sin(P*1000*(t-0.06))*0.1*Math.exp(-(t-0.06)*25):0));
buffers.menu = mkBuf(sr,0.22,t=>(Math.sin(P*210*t)*0.15+Math.sin(P*315*t)*0.06*Math.exp(-t*12))*Math.exp(-t*7));
buffers.btn = mkBuf(sr,0.04,t=>Math.sin(P*480*t)*0.08*Math.exp(-t*65));
buffers.jing1 = mkBuf(sr,0.5,t=>{let v=Math.sin(P*659*t)*0.2*Math.exp(-t*6);if(t>0.1){const l=t-0.1;v+=Math.sin(P*784*l)*0.2*Math.exp(-l*6);}if(t>0.18){const l=t-0.18;v+=Math.sin(P*1047*l)*0.22*Math.exp(-l*4);}return v*0.7;});
buffers.jing2 = mkBuf(sr,0.7,t=>{let v=0;[523,659,784,988,1319].forEach((f,i)=>{const l=t-i*0.07;if(l<=0)return;v+=Math.sin(P*f*l)*0.17*Math.exp(-l*5);});return v*0.7;});
buffers.jing3 = mkBuf(sr,0.9,t=>{let v=0;if(t<0.4)[262,330,392,523,659].forEach(f=>v+=Math.sin(P*f*t)*0.1*Math.exp(-t*3.5));[784,988,1175,1319,1568].forEach((f,i)=>{const l=t-0.12-i*0.06;if(l>0)v+=Math.sin(P*f*l)*0.1*Math.exp(-l*6);});return v*0.65;});
buffers.milestone = mkBuf(sr,0.8,t=>{let v=0;[523,659,784,1047].forEach((f,i)=>{const l=t-i*0.1;if(l>0)v+=Math.sin(P*f*l)*0.18*Math.exp(-l*4);});return v*0.6;});
initialized = true;
};

let bgmNode = null, bgmGain = null;
const startBGM = () => {
const c = getCtx(); if (!c || bgmNode) return;
bgmGain = c.createGain(); bgmGain.gain.value = 0.06; bgmGain.connect(c.destination);
// Procedural ambient: low drone + pentatonic arpeggios
const sr = c.sampleRate, dur = 8, n = sr * dur, buf = c.createBuffer(1, n, sr), d = buf.getChannelData(0);
const P = Math.PI * 2;
const notes = [220, 261, 293, 349, 392, 440, 523]; // A minor pentatonic-ish
for (let i = 0; i < n; i++) {
const t = i / sr;
let v = Math.sin(P * 110 * t) * 0.15; // low drone
v += Math.sin(P * 165 * t) * 0.06; // fifth
// Gentle arpeggios
const noteIdx = Math.floor((t % 4) / 0.57) % notes.length;
const noteT = (t % 0.57);
v += Math.sin(P * notes[noteIdx] * t) * 0.04 * Math.exp(-noteT * 2.5);
// Soft shimmer
v += Math.sin(P * 880 * t) * 0.008 * Math.sin(P * 0.3 * t);
d[i] = v * (0.8 + 0.2 * Math.sin(P * 0.125 * t)); // gentle volume swell
}
bgmNode = c.createBufferSource(); bgmNode.buffer = buf; bgmNode.loop = true;
bgmNode.connect(bgmGain); bgmNode.start();
};
const stopBGM = () => { if (bgmNode) { try { bgmNode.stop(); } catch(e) {} bgmNode = null; } };
const setBGMVolume = (v) => { if (bgmGain) bgmGain.gain.value = v; };

return {
init,
snap: () => play(“snap”,0.4,0.93+Math.random()*0.14), pick: () => play(“pick”,0.3),
place: () => play(“place”,0.5), err: () => play(“err”,0.25), bomb: () => play(“bomb”,0.5),
over: () => play(“over”,0.35), coin: () => play(“coin”,0.28), menu: () => play(“menu”,0.25),
btn: () => play(“btn”,0.2),
clear: n => play(n>=3?“clr3”:n>=2?“clr2”:“clr1”,0.4),
combo: lv => play(lv>=2?“combo2”:“combo1”,0.35),
jingle: lv => play(lv>=3?“jing3”:lv>=2?“jing2”:“jing1”,lv>=3?0.55:lv>=2?0.5:0.45),
milestone: () => play(“milestone”,0.5),
startBGM, stopBGM, setBGMVolume,
};
}

/* ── CSS ── */
const FONTS = “https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;900&display=swap”;
const CSS = `*{box-sizing:border-box;-webkit-tap-highlight-color:transparent} html,body{overflow:hidden;position:fixed;width:100%;height:100%;touch-action:none;overscroll-behavior:none} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}} @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}} @keyframes fadeUp{0%{opacity:0;transform:translateY(18px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}} @keyframes popIn{0%{transform:scale(0);opacity:0}50%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}} @keyframes cellPlace{0%{transform:scale(0.2);opacity:0.3}50%{transform:scale(1.14)}100%{transform:scale(1);opacity:1}} @keyframes clearGlow{0%{transform:scale(1);filter:brightness(1.8);opacity:1}50%{transform:scale(1.08);opacity:0.4}100%{transform:scale(0);opacity:0}} @keyframes ghostPulse{0%,100%{opacity:0.3}50%{opacity:0.55}} @keyframes scorePop{0%{transform:translateY(0) scale(0.6);opacity:0}12%{transform:translateY(-5px) scale(1.12);opacity:1}100%{transform:translateY(-38px);opacity:0}} @keyframes adBar{0%{width:0}100%{width:100%}} @keyframes rowHint{0%,100%{opacity:0.35}50%{opacity:0.7}} @keyframes badShake{0%,100%{transform:translateX(0)}15%{transform:translateX(-5px)}30%{transform:translateX(5px)}45%{transform:translateX(-3px)}60%{transform:translateX(2px)}} @keyframes starSpin{0%{transform:rotate(0)}100%{transform:rotate(360deg)}} @keyframes newRecord{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}} @keyframes camelWalk{0%{transform:translateX(calc(100vw + 80px))}100%{transform:translateX(-80px)}} @keyframes carDrive{0%{transform:translateX(calc(100vw + 120px))}100%{transform:translateX(-120px)}} @keyframes horseRun{0%{transform:translateX(calc(100vw + 60px))}100%{transform:translateX(-60px)}} @keyframes cloudDrift{0%{transform:translateX(-100px)}100%{transform:translateX(calc(100vw + 100px))}} @keyframes kafoBounce{0%{transform:translate(-50%,-50%) scale(0) rotate(-12deg);opacity:0}12%{transform:translate(-50%,-50%) scale(1.35) rotate(4deg);opacity:1}28%{transform:translate(-50%,-50%) scale(0.95) rotate(-1deg)}45%{transform:translate(-50%,-50%) scale(1.08) rotate(0);opacity:1}100%{transform:translate(-50%,-65%) scale(0.75);opacity:0}} @keyframes scoreBump{0%{transform:scale(1.3);color:#c8900e}100%{transform:scale(1);color:#8a6b0f}} @keyframes streakFade{0%{transform:scale(1);opacity:1}100%{transform:scale(0.5);opacity:0}} @keyframes milestonePop{0%{transform:translate(-50%,-50%) scale(0);opacity:0}30%{transform:translate(-50%,-50%) scale(1.2);opacity:1}100%{transform:translate(-50%,-80%) scale(0.7);opacity:0}} @keyframes pulseGuide{0%,100%{transform:scale(1);opacity:0.6}50%{transform:scale(1.15);opacity:1}} button{transition:all 0.12s ease;font-family:'Tajawal',sans-serif} button:hover{transform:translateY(-1px) scale(1.025)!important;filter:brightness(1.06)} button:active{transform:translateY(0) scale(0.97)!important}`;

/* ── Desert Background ── */
const DesertBG = () => (

  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    <div style={{position:"absolute",top:"4%",right:"14%",width:"clamp(40px,10vw,60px)",height:"clamp(40px,10vw,60px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(255,215,80,0.5),rgba(255,200,60,0.15),transparent)"}}/>
    <div style={{position:"absolute",top:"7%",fontSize:"clamp(18px,4vw,28px)",opacity:0.15,animation:"cloudDrift 50s linear infinite"}}>☁️</div>
    <div style={{position:"absolute",top:"12%",fontSize:"clamp(14px,3vw,22px)",opacity:0.1,animation:"cloudDrift 65s linear infinite",animationDelay:"-25s"}}>☁️</div>
    <svg style={{position:"absolute",bottom:"5%",left:0,width:"100%",height:"32%",opacity:0.2}} viewBox="0 0 1000 300" preserveAspectRatio="none"><path d="M0 300Q150 100 300 200Q450 110 600 185Q750 70 900 165Q960 130 1000 180L1000 300Z" fill="#c4a265"/><path d="M0 300Q200 150 400 225Q550 140 700 205Q850 120 1000 205L1000 300Z" fill="#d4b57a"/></svg>
    <svg style={{position:"absolute",bottom:"9%",right:"6%",width:"clamp(24px,6vw,36px)",height:"clamp(90px,22vw,140px)",opacity:0.16}} viewBox="0 0 30 120"><path d="M12 120L12 14Q12 4 15 0Q18 4 18 14L18 120Z" fill="#8a7a5a"/><ellipse cx="15" cy="24" rx="4" ry="5.5" fill="#c4a265" opacity="0.5"/></svg>
    <svg style={{position:"absolute",bottom:"6%",left:"3%",width:"clamp(28px,7vw,40px)",height:"clamp(45px,11vw,68px)",opacity:0.14}} viewBox="0 0 40 70"><line x1="20" y1="70" x2="20" y2="22" stroke="#6b5430" strokeWidth="3"/><path d="M20 23Q10 11 3 19" stroke="#5a7a3a" strokeWidth="2.2" fill="none"/><path d="M20 23Q30 11 37 19" stroke="#5a7a3a" strokeWidth="2.2" fill="none"/></svg>
    <div style={{position:"absolute",bottom:"6.5%",fontSize:"clamp(18px,4.5vw,26px)",opacity:0.16,animation:"camelWalk 36s linear infinite",animationDelay:"-6s"}}>🐫</div>
    <div style={{position:"absolute",bottom:"7.5%",fontSize:"clamp(14px,3.5vw,20px)",opacity:0.1,animation:"camelWalk 46s linear infinite",animationDelay:"-20s"}}>🐪</div>
    <div style={{position:"absolute",bottom:"6%",fontSize:"clamp(16px,4vw,22px)",opacity:0.13,animation:"horseRun 22s linear infinite",animationDelay:"-9s"}}>🐎</div>
    <div style={{position:"absolute",bottom:"5.5%",fontSize:"clamp(17px,4.2vw,24px)",opacity:0.15,animation:"carDrive 19s linear infinite",animationDelay:"-4s"}}>🛻</div>
    <svg style={{position:"absolute",bottom:0,left:0,width:"100%",height:"8%",opacity:0.14}} viewBox="0 0 1000 100" preserveAspectRatio="none"><path d="M0 100Q250 35 500 72Q750 25 1000 62L1000 100Z" fill="#c4a265"/></svg>
    <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",opacity:0.04}}><defs><pattern id="isl" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M32 0L64 16V48L32 64L0 48V16Z" fill="none" stroke="#b8860b" strokeWidth="0.3"/><circle cx="32" cy="32" r="9" fill="none" stroke="#b8860b" strokeWidth="0.18"/></pattern></defs><rect width="100%" height="100%" fill="url(#isl)"/></svg>
  </div>
);

/* ── Error Boundary ── */
class ErrorBoundary extends React.Component {
constructor(props) { super(props); this.state = { hasError: false }; }
static getDerivedStateFromError() { return { hasError: true }; }
render() {
if (this.state.hasError) return (
<div style={{minHeight:“100vh”,display:“flex”,flexDirection:“column”,alignItems:“center”,justifyContent:“center”,background:”#f8f0de”,fontFamily:”‘Tajawal’,sans-serif”,padding:“20px”,textAlign:“center”}}>
<div style={{fontSize:“48px”,marginBottom:“12px”}}>🏜️</div>
<h2 style={{color:”#8a6b0f”,fontFamily:”‘Amiri’,serif”,fontSize:“22px”,margin:“0 0 8px”}}>حدث خطأ</h2>
<p style={{color:“rgba(120,90,40,0.4)”,fontSize:“12px”,margin:“0 0 16px”}}>Something went wrong</p>
<button onClick={() => { this.setState({ hasError: false }); }} style={{background:“linear-gradient(140deg,#c8900e,#c8900edd)”,border:“none”,color:”#fff”,borderRadius:“13px”,padding:“12px 32px”,fontWeight:700,fontSize:“14px”,cursor:“pointer”}}>🔄 أعد المحاولة</button>
</div>
);
return this.props.children;
}
}

/* ── Subcomponents ── */
const AdOverlay = ({onDone}) => {
const [timer, setTimer] = useState(3);
useEffect(() => { const i = setInterval(() => setTimer(p => { if (p <= 1) { clearInterval(i); setTimeout(onDone, 200); return 0; } return p - 1; }), 1000); return () => clearInterval(i); }, [onDone]);
return (
<div style={{position:“fixed”,inset:0,background:“rgba(0,0,0,0.6)”,zIndex:2000,display:“flex”,alignItems:“center”,justifyContent:“center”,backdropFilter:“blur(8px)”}}>
<div style={{background:“linear-gradient(150deg,#f5efe0,#ede3cc)”,borderRadius:“20px”,padding:“36px 32px”,textAlign:“center”,border:“1px solid rgba(180,140,60,0.15)”,maxWidth:“290px”,animation:“fadeUp 0.4s”,boxShadow:“0 10px 36px rgba(0,0,0,0.12)”}}>
<p style={{fontSize:“10px”,color:“rgba(120,90,40,0.4)”,margin:“0 0 10px”,fontFamily:”‘Amiri’,serif”,letterSpacing:“2px”}}>إعلان • AD</p>
<div style={{fontSize:“44px”,margin:“0 0 10px”}}>📺</div>
<div style={{width:“130px”,height:“4px”,borderRadius:“2px”,background:“rgba(180,140,60,0.12)”,margin:“0 auto”,overflow:“hidden”}}><div style={{height:“100%”,background:“linear-gradient(90deg,#b8860b,#d4a017,#f5cb42)”,borderRadius:“2px”,animation:“adBar 3s linear forwards”}}/></div>
<p style={{color:“rgba(120,90,40,0.35)”,fontSize:“13px”,fontWeight:700,marginTop:“8px”}}>{timer}</p>
</div>
</div>
);
};

const ShopModal = ({coins, onBuy, onClose, hasBomb, hasUndo}) => {
const items = [
{id:“undo”,emoji:“↩️”,nameAr:“تراجع”,nameEn:“Undo (1 per game)”,price:40,owned:hasUndo},
{id:“bomb”,emoji:“💣”,nameAr:“قنبلة”,nameEn:“Bomb 3×3”,price:40,owned:hasBomb},
{id:“coins500”,emoji:“🪙”,nameAr:“٥٠٠ عملة”,nameEn:“500 Coins”,price:”$0.99”},
{id:“noads”,emoji:“✨”,nameAr:“إزالة الإعلانات”,nameEn:“No Ads”,price:”$2.99”},
];
return (
<div onClick={onClose} style={{position:“fixed”,inset:0,background:“rgba(0,0,0,0.35)”,zIndex:1500,display:“flex”,alignItems:“center”,justifyContent:“center”,backdropFilter:“blur(8px)”}}>
<div onClick={e => e.stopPropagation()} style={{background:“linear-gradient(155deg,#f7f1e3,#ede3cc)”,borderRadius:“22px”,padding:“24px 20px”,width:“min(300px,90vw)”,border:“1px solid rgba(180,140,60,0.12)”,animation:“fadeUp 0.3s”,boxShadow:“0 10px 36px rgba(0,0,0,0.1)”}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:“12px”}}>
<div/><div style={{textAlign:“center”}}><h3 style={{fontFamily:”‘Amiri’,serif”,fontSize:“24px”,color:”#8a6b0f”,margin:0}}>السوق</h3><p style={{color:“rgba(120,90,40,0.35)”,fontSize:“12px”,margin:0}}>The Souq</p></div>
<button onClick={onClose} style={{background:“none”,border:“none”,color:“rgba(120,90,40,0.25)”,fontSize:“17px”,cursor:“pointer”}}>✕</button>
</div>
<div style={{textAlign:“center”,marginBottom:“12px”}}><span style={{background:“rgba(180,140,60,0.08)”,padding:“4px 14px”,borderRadius:“16px”,fontSize:“14px”,color:”#8a6b0f”,border:“1px solid rgba(180,140,60,0.1)”}}>🪙 {coins}</span></div>
<div style={{display:“flex”,flexDirection:“column”,gap:“5px”}}>
{items.map(it => (
<button key={it.id} onClick={() => onBuy(it.id)} style={{display:“flex”,alignItems:“center”,gap:“9px”,padding:“11px 13px”,background:it.owned?“rgba(15,138,62,0.05)”:“rgba(180,140,60,0.04)”,border:`1px solid ${it.owned?"rgba(15,138,62,0.1)":"rgba(180,140,60,0.06)"}`,borderRadius:“11px”,color:”#4a3a18”,cursor:“pointer”,fontSize:“14px”,width:“100%”,textAlign:“left”}}>
<span style={{fontSize:“20px”,width:“28px”,textAlign:“center”}}>{it.emoji}</span>
<span style={{flex:1}}><span style={{fontWeight:600}}>{it.nameAr}</span><br/><span style={{fontSize:“12px”,color:“rgba(120,90,40,0.35)”}}>{it.nameEn}</span></span>
{it.owned ? <span style={{fontSize:“12px”,color:”#0f8a3e”,fontWeight:700}}>✓</span> : <span style={{background:“linear-gradient(135deg,#d4a017,#b8860b)”,padding:“4px 10px”,borderRadius:“7px”,fontSize:“12px”,fontWeight:700,color:”#fff”}}>{typeof it.price === “number” ? `🪙${it.price}` : it.price}</span>}
</button>
))}
</div>
</div>
</div>
);
};

/* ── Theme System ── */
const THEMES = {
desert: {
name: “🏜️ صحراوي”, bg: “linear-gradient(170deg,#f8f0de 0%,#f0e4c8 30%,#e8daba 60%,#f2ead4 100%)”,
boardBg: “rgba(255,255,255,0.4)”, boardBorder: “1px solid rgba(180,140,60,0.1)”,
cellEmpty: “rgba(180,150,100,0.08)”, cellBorder: “1px solid rgba(160,130,80,0.1)”,
textPrimary: “#3d2e12”, textScore: “#8a6b0f”, textMuted: “rgba(120,90,40,0.25)”,
accent: “#c8900e”, trayBg: “rgba(255,255,255,0.3)”, trayBorder: “1px solid rgba(180,140,60,0.06)”,
cardBg: “linear-gradient(155deg,#f7f1e3,#ede3cc)”, cardBorder: “1px solid rgba(180,140,60,0.12)”,
overlayBg: “rgba(0,0,0,0.3)”, price: 0,
},
night: {
name: “🌙 ليلي”, bg: “linear-gradient(170deg,#0a0e1a 0%,#111827 30%,#0f172a 60%,#1a1f35 100%)”,
boardBg: “rgba(255,255,255,0.06)”, boardBorder: “1px solid rgba(100,130,200,0.12)”,
cellEmpty: “rgba(100,130,200,0.06)”, cellBorder: “1px solid rgba(100,130,200,0.08)”,
textPrimary: “#e2e8f0”, textScore: “#fbbf24”, textMuted: “rgba(148,163,184,0.5)”,
accent: “#fbbf24”, trayBg: “rgba(255,255,255,0.04)”, trayBorder: “1px solid rgba(100,130,200,0.08)”,
cardBg: “linear-gradient(155deg,#1e293b,#0f172a)”, cardBorder: “1px solid rgba(100,130,200,0.15)”,
overlayBg: “rgba(0,0,0,0.5)”, price: 200,
},
};

/* ── Main Game Component ── */
function DesertBlocksGame() {
const [game, dispatch] = useReducer(gameReducer, initialGameState);
const [screen, setScreen] = useState(“menu”);
const [cellSize, setCellSize] = useState(42);
const [showShop, setShowShop] = useState(false);
const [showAd, setShowAd] = useState(false);
const [soundOn, setSoundOn] = useState(true);
const [loaded, setLoaded] = useState(false);
const [hasSave, setHasSave] = useState(false);
const [showOnboard, setShowOnboard] = useState(true);
const [theme, setTheme] = useState(“desert”);
const [ownedThemes, setOwnedThemes] = useState([“desert”]);

// Drag state (UI-only, not in reducer)
const [dragIndex, setDragIndex] = useState(null);
const [dragPos, setDragPos] = useState(null);
const [hoverCell, setHoverCell] = useState(null);
const [lastSnap, setLastSnap] = useState(null);

// Visual effects (UI-only)
const [clearingCells, setClearingCells] = useState(new Set());
const [placedCells, setPlacedCells] = useState(new Set());
const [flash, setFlash] = useState(null);
const [milestoneFlash, setMilestoneFlash] = useState(null);
const [shake, setShake] = useState(false);
const [scoreBump, setScoreBump] = useState(false);
const [streakBroke, setStreakBroke] = useState(false);
const [particles, setParticles] = useState([]);
const [scorePops, setScorePops] = useState([]);
const [highlightRows, setHighlightRows] = useState(new Set());
const [highlightCols, setHighlightCols] = useState(new Set());

const boardRef = useRef(null);
const particleId = useRef(0);
const adMode = useRef(“coins”);
const saveTimer = useRef(null);
const soundEngine = useRef(null);

// Initialize sound engine once
if (!soundEngine.current) soundEngine.current = createSoundEngine();
const sfx = soundEngine.current;

const boardWidth = GRID_SIZE * (cellSize + GAP) - GAP + PAD * 2;

// ── Load/Save ──
useEffect(() => {
const data = loadGame();
if (data) {
dispatch({ type: “LOAD_SAVE”, data: { best: data.best||0, coins: data.coins!=null?data.coins:50, games: data.games||0, totalLines: data.totalLines||0, dBest: data.dBest||0, dailyRewarded: data.dailyRewarded||false } });
if (data.onboardDone) setShowOnboard(false);
const today = new Date().toDateString();
if (data.dailyDate !== today) dispatch({ type: “LOAD_SAVE”, data: { dBest: 0, dailyRewarded: false } });
if (data.ag && data.ag.g && data.ag.p) setHasSave(true);
}
setLoaded(true);
setCellSize(getCellSize());
}, []);

useEffect(() => {
if (!loaded) return;
if (saveTimer.current) clearTimeout(saveTimer.current);
saveTimer.current = setTimeout(() => {
const ag = screen === “game” && !game.over ? { g: game.grid, p: game.pieces, s: game.score, l: game.lines, k: game.streak } : null;
saveGame({ best: game.best, coins: game.coins, games: game.games, totalLines: game.totalLines, onboardDone: !showOnboard, dBest: game.dBest, dailyDate: new Date().toDateString(), ag, dailyRewarded: game.dailyRewarded });
}, 1500);
}, [game.best, game.coins, game.games, game.totalLines, loaded, game.dBest, game.grid, game.score, screen, game.over, game.dailyRewarded, showOnboard]);

useEffect(() => { const h = () => setCellSize(getCellSize()); window.addEventListener(“resize”, h); return () => window.removeEventListener(“resize”, h); }, []);

// ── Handle clear phase ──
useEffect(() => {
if (game.phase === PHASE.CLEARING && game._clearInfo) {
const info = game._clearInfo;
const cs = new Set();
info.fullRows.forEach(r => { for (let c = 0; c < GRID_SIZE; c++) cs.add(`${r},${c}`); });
info.fullCols.forEach(c => { for (let r = 0; r < GRID_SIZE; r++) cs.add(`${r},${c}`); });
setClearingCells(cs);

```
  if (soundOn) { sfx.clear(info.totalCleared); setTimeout(() => sfx.jingle(Math.min(info.totalCleared + (info.streak > 1 ? info.streak - 1 : 0), 3)), 150); }
  if (info.streak > 1 && soundOn) sfx.combo(info.streak - 2);
  if (info.milestone && soundOn) setTimeout(() => sfx.milestone(), 200);

  const fi = Math.min((info.streak > 1 ? info.streak - 1 : 0) + (info.totalCleared >= 2 ? info.totalCleared - 1 : 0), 4);
  let flashText = pick(SAUDI_CLEAR[fi]);
  if (info.streak >= 3) flashText = pick(SAUDI_STREAK);
  setFlash(flashText);
  setTimeout(() => setFlash(null), 1400);

  if (info.milestone) { setMilestoneFlash(info.milestone); setTimeout(() => setMilestoneFlash(null), 2000); }
  if (soundOn) setTimeout(sfx.coin, 340);

  setTimeout(() => { setClearingCells(new Set()); dispatch({ type: "CLEAR_DONE" }); }, 450);
}
```

}, [game.phase]);

// ── Handle game over ──
useEffect(() => {
if (game.phase === PHASE.IDLE && !game.over && screen === “game” && loaded) {
const t = setTimeout(() => {
if (!anyFits(game.grid, game.pieces)) { dispatch({ type: “GAME_OVER” }); if (soundOn) { sfx.over(); sfx.stopBGM(); } }
}, game._clearInfo ? 0 : 200);
return () => clearTimeout(t);
}
}, [game.grid, game.pieces, game.phase, game.over, screen, loaded]);

// ── Streak broke effect ──
useEffect(() => {
if (game._streakBroke) { setStreakBroke(true); setFlash(pick(SAUDI_BROKE)); setTimeout(() => { setStreakBroke(false); setFlash(null); }, 1000); }
}, [game._streakBroke]);

// ── Interstitial ──
useEffect(() => { if (game.over && game.games > 0 && game.games % 3 === 0) setTimeout(() => setShowAd(true), 600); }, [game.over]);

// ── Helpers ──
const spawnParticles = useCallback((bx, by, color, n = 8) => {
const ps = Array.from({length:n},(_,i) => {const a=(i/n)*Math.PI*2+Math.random()*0.5,d=20+Math.random()*32;return {id:++particleId.current,x:bx+Math.cos(a)*d,y:by+Math.sin(a)*d,sz:3+Math.random()*4,c:color,dur:350+Math.random()*280};});
setParticles(p => […p,…ps]); setTimeout(() => setParticles(p => p.filter(pp => !ps.find(x => x.id === pp.id))), 750);
}, []);

const addScorePop = useCallback((bx, by, pts, big) => {
const p = {id:++particleId.current,x:bx,y:by,pts,big};
setScorePops(pp => […pp,p]); setTimeout(() => setScorePops(pp => pp.filter(x => x.id !== p.id)), 900);
}, []);

const computeHighlight = useCallback((grid, shape, row, col, color) => {
const t = grid.map(r => […r]);
for (let r = 0; r < shape.length; r++) for (let c = 0; c < shape[r].length; c++) if (shape[r][c]) t[row+r][col+c] = color;
const rows = new Set(), cols = new Set();
for (let r = 0; r < GRID_SIZE; r++) if (t[r].every(v => v !== -1)) rows.add(r);
for (let c = 0; c < GRID_SIZE; c++) if (t.every(row => row[c] !== -1)) cols.add(c);
return { rows, cols };
}, []);

// ── Place piece handler ──
const handlePlace = useCallback((idx, row, col) => {
const piece = game.pieces[idx];
if (!piece || !canPlace(game.grid, piece.shape, row, col) || game.phase === PHASE.CLEARING) {
if (game.phase !== PHASE.CLEARING) { setShake(true); setTimeout(() => setShake(false), 400); if (soundOn) sfx.err(); }
return;
}
if (soundOn) sfx.place();
if (showOnboard) setShowOnboard(false);

```
const pl = new Set();
for (let r = 0; r < piece.shape.length; r++) for (let c = 0; c < piece.shape[r].length; c++) if (piece.shape[r][c]) pl.add(`${row+r},${col+c}`);
setPlacedCells(pl); setTimeout(() => setPlacedCells(new Set()), 350);

const pts = calculateScore(countBlocks(piece.shape), findCompletions((() => { const g = game.grid.map(r => [...r]); for (let r = 0; r < piece.shape.length; r++) for (let c = 0; c < piece.shape[r].length; c++) if (piece.shape[r][c]) g[row+r][col+c] = piece.color; return g; })()).totalCleared, game.streak + 1);
addScorePop(PAD + (col + piece.shape[0].length/2)*(cellSize+GAP), PAD + row*(cellSize+GAP), pts, pts > 15);
setScoreBump(true); setTimeout(() => setScoreBump(false), 250);

dispatch({ type: "PLACE_PIECE", pieceIndex: idx, row, col });
```

}, [game, soundOn, showOnboard, cellSize, sfx, addScorePop]);

// ── Drag handlers ──
const handleDragStart = (idx, e) => {
if (game.over || !game.pieces[idx] || game.bombActive || game.phase === PHASE.CLEARING) return;
e.preventDefault(); sfx.init();
setDragIndex(idx);
setDragPos({x: e.touches ? e.touches[0].clientX : e.clientX, y: e.touches ? e.touches[0].clientY : e.clientY});
if (soundOn) sfx.pick();
};

const handleDragMove = useCallback(e => {
if (dragIndex === null) return; e.preventDefault();
const cx = e.touches ? e.touches[0].clientX : e.clientX, cy = e.touches ? e.touches[0].clientY : e.clientY;
setDragPos({x:cx,y:cy});
if (boardRef.current && game.pieces[dragIndex]) {
const rect = boardRef.current.getBoundingClientRect(), piece = game.pieces[dragIndex];
const gr = Math.round((cy - 45 - rect.top - PAD)/(cellSize+GAP) - piece.shape.length/2);
const gc = Math.round((cx - rect.left - PAD)/(cellSize+GAP) - piece.shape[0].length/2);
if (canPlace(game.grid, piece.shape, gr, gc)) {
const nk = `${gr},${gc}`;
if (nk !== lastSnap) { setLastSnap(nk); if (soundOn) sfx.snap(); }
setHoverCell({r:gr,c:gc});
const {rows,cols} = computeHighlight(game.grid, piece.shape, gr, gc, piece.color);
setHighlightRows(rows); setHighlightCols(cols);
} else { setHoverCell(null); setHighlightRows(new Set()); setHighlightCols(new Set()); setLastSnap(null); }
}
}, [dragIndex, game.pieces, game.grid, computeHighlight, soundOn, lastSnap, cellSize]);

const handleDragEnd = useCallback(() => {
if (dragIndex !== null && hoverCell) handlePlace(dragIndex, hoverCell.r, hoverCell.c);
setDragIndex(null); setDragPos(null); setHoverCell(null); setHighlightRows(new Set()); setHighlightCols(new Set()); setLastSnap(null);
}, [dragIndex, hoverCell, handlePlace]);

useEffect(() => {
const m = e => handleDragMove(e), u = () => handleDragEnd();
window.addEventListener(“mousemove”,m); window.addEventListener(“mouseup”,u);
window.addEventListener(“touchmove”,m,{passive:false}); window.addEventListener(“touchend”,u);
return () => { window.removeEventListener(“mousemove”,m); window.removeEventListener(“mouseup”,u); window.removeEventListener(“touchmove”,m); window.removeEventListener(“touchend”,u); };
}, [handleDragMove, handleDragEnd]);

// ── Actions ──
const startGame = () => { sfx.init(); dispatch({type:“START_GAME”}); setHasSave(false); setScreen(“game”); if(soundOn) { sfx.menu(); sfx.startBGM(); } };
const resumeGame = () => { sfx.init(); const d = loadGame(); if(d&&d.ag&&d.ag.g&&d.ag.p) { dispatch({type:“LOAD_SAVE”,data:{grid:d.ag.g,pieces:d.ag.p,score:d.ag.s||0,lines:d.ag.l||0,streak:d.ag.k||0,over:false}}); setScreen(“game”); setHasSave(false); if(soundOn) sfx.startBGM(); } else startGame(); if(soundOn) sfx.menu(); };

// ── Ghost cells ──
const ghostCells = useMemo(() => {
if (!hoverCell || dragIndex === null || !game.pieces[dragIndex]) return new Set();
const s = new Set();
game.pieces[dragIndex].shape.forEach((row,ri) => row.forEach((v,ci) => { if(v) s.add(`${hoverCell.r+ri},${hoverCell.c+ci}`); }));
return s;
}, [hoverCell, dragIndex, game.pieces]);
const ghostColor = (dragIndex !== null && game.pieces[dragIndex]) ? game.pieces[dragIndex].color : 0;

// ── Milestone progress ──
const nextMilestone = MILESTONES.find(m => m > game.totalLines) || null;
const milestoneProgress = nextMilestone ? Math.min(((game.totalLines - (MILESTONES[MILESTONES.indexOf(nextMilestone)-1]||0)) / (nextMilestone - (MILESTONES[MILESTONES.indexOf(nextMilestone)-1]||0))) * 100, 100) : 100;

// ── Styles ──
const T = THEMES[theme];
const wrapStyle = {minHeight:“100vh”,display:“flex”,flexDirection:“column”,alignItems:“center”,background:T.bg,fontFamily:”‘Tajawal’,sans-serif”,color:T.textPrimary,position:“relative”,overflow:“hidden”,userSelect:“none”,WebkitUserSelect:“none”,touchAction:“none”,overscrollBehavior:“none”};
const makeBtn = (bg=”#d4a017”,sz=“md”) => ({background:`linear-gradient(140deg,${bg},${bg}dd)`,border:“none”,color:”#fff”,borderRadius:“13px”,cursor:“pointer”,fontWeight:700,boxShadow:`0 3px 12px ${bg}28`,padding:sz===“lg”?“13px 44px”:sz===“sm”?“6px 13px”:“10px 28px”,fontSize:sz===“lg”?“17px”:sz===“sm”?“11px”:“14px”});
const emptyCellBg = T.cellEmpty, emptyCellBorder = T.cellBorder;

// ── MENU SCREEN ──
if (screen === “menu”) return (
<div style={wrapStyle} onClick={() => sfx.init()}><link href={FONTS} rel="stylesheet"/><style>{CSS}</style><DesertBG/>
<div style={{position:“relative”,zIndex:1,display:“flex”,flexDirection:“column”,alignItems:“center”,marginTop:“24px”,padding:“0 16px”,width:“100%”,maxWidth:“390px”}}>
<div style={{display:“flex”,gap:“4px”,marginBottom:“6px”,animation:“float 3.5s ease-in-out infinite”}}>{COLORS.map((c,i) => <div key={i} style={{width:“20px”,height:“20px”,borderRadius:“5px”,background:`linear-gradient(140deg,${c.glow}88,${c.bg})`,border:`1px solid ${c.glow}35`}}/>)}</div>
<h1 style={{fontFamily:”‘Amiri’,serif”,fontSize:“clamp(30px,8vw,40px)”,fontWeight:700,margin:“2px 0 0”,background:“linear-gradient(135deg,#8a6b0f,#d4a017,#f5cb42,#d4a017,#8a6b0f)”,backgroundSize:“300% auto”,WebkitBackgroundClip:“text”,WebkitTextFillColor:“transparent”,animation:“shimmer 5s linear infinite”,lineHeight:1.2}}>تفجير البلوكات!</h1>
<p style={{color:“rgba(138,107,15,0.4)”,fontSize:“13px”,letterSpacing:“3px”,margin:“1px 0 0”,fontWeight:500}}>BLOCK BLAST 💥</p>
<div style={{width:“36px”,height:“1px”,background:“linear-gradient(90deg,transparent,rgba(180,140,60,0.3),transparent)”,margin:“14px 0 16px”}}/>
<div style={{width:“100%”,background:“rgba(255,255,255,0.45)”,borderRadius:“13px”,border:“1px solid rgba(180,140,60,0.08)”,padding:“10px 14px”,marginBottom:“10px”}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:“6px”}}>
<span style={{fontSize:“13px”,color:“rgba(120,90,40,0.4)”}}>📏 {game.totalLines} خطوط</span>
{nextMilestone && <span style={{fontSize:“12px”,color:“rgba(120,90,40,0.3)”}}>التالي: {nextMilestone} → 🪙{Math.floor(nextMilestone/5)}</span>}
</div>
<div style={{height:“5px”,borderRadius:“3px”,background:“rgba(180,140,60,0.1)”,overflow:“hidden”}}><div style={{height:“100%”,width:`${milestoneProgress}%`,background:“linear-gradient(90deg,#c8900e,#f5cb42)”,borderRadius:“3px”,transition:“width 0.3s”}}/></div>
</div>
<div style={{width:“100%”,background:“rgba(255,255,255,0.45)”,borderRadius:“13px”,border:“1px solid rgba(180,140,60,0.08)”,padding:“11px 14px”,marginBottom:“12px”,display:“flex”,alignItems:“center”,gap:“10px”}}>
<div style={{fontSize:“22px”,animation:“starSpin 8s linear infinite”}}>⭐</div>
<div style={{flex:1}}><p style={{fontFamily:”‘Amiri’,serif”,color:”#8a6b0f”,fontSize:“15px”,margin:0,fontWeight:700}}>تحدي اليوم</p><p style={{color:“rgba(80,60,20,0.35)”,fontSize:“12px”,margin:“1px 0 0”}}>Score {DAILY_TARGET}+ → 🪙{DAILY_REWARD}</p></div>
<p style={{color:”#c8900e”,fontSize:“16px”,fontWeight:900,margin:0}}>{game.dBest}</p>
</div>
<div style={{display:“flex”,flexDirection:“column”,gap:“7px”,width:“100%”}}>
{hasSave && <button style={makeBtn(”#e6850e”,“lg”)} onClick={resumeGame}>▶ استمر</button>}
<button style={makeBtn(”#c8900e”,hasSave?“md”:“lg”)} onClick={startGame}>{hasSave?“🔄 لعبة جديدة”:“▶ ابدأ اللعب”}</button>
<div style={{display:“flex”,gap:“7px”}}><button style={{…makeBtn(”#0f8a3e”),flex:1}} onClick={() => {sfx.btn();setShowShop(true);}}>🛒 السوق</button><button style={{…makeBtn(soundOn?”#2171c7”:”#999”),width:“50px”}} onClick={() => {setSoundOn(!soundOn);sfx.btn();}}>{soundOn?“🔊”:“🔇”}</button></div>
</div>
<div style={{marginTop:“14px”,display:“flex”,gap:“16px”,fontSize:“13px”,color:“rgba(138,107,15,0.3)”}}><span>🪙 {game.coins}</span><span>🏆 {game.best}</span><span>🎮 {game.games}</span></div>
<div style={{marginTop:“18px”,width:“100%”,background:“rgba(255,255,255,0.3)”,borderRadius:“11px”,border:“1px solid rgba(180,140,60,0.05)”,padding:“10px 12px”}}>
<p style={{fontFamily:”‘Amiri’,serif”,color:“rgba(138,107,15,0.45)”,fontSize:“14px”,margin:“0 0 5px”,textAlign:“center”}}>كيف تلعب</p>
<div style={{display:“flex”,justifyContent:“space-around”,textAlign:“center”,fontSize:“12px”,color:“rgba(80,60,20,0.35)”,lineHeight:1.5}}><div>🧩<br/>اسحب القطعة</div><div>📏<br/>أكمل صف أو عمود</div><div>✨<br/>يتم مسحه</div><div>🔥<br/>كفووو!</div></div>
</div>
</div>
{showShop && <ShopModal coins={game.coins} onBuy={id => {sfx.coin();dispatch({type:“BUY_ITEM”,item:id});}} onClose={() => setShowShop(false)} hasBomb={game.hasBomb} hasUndo={game.hasUndo}/>}
</div>
);

// ── GAME SCREEN ──
return (
<div style={wrapStyle}><link href={FONTS} rel="stylesheet"/><style>{CSS}</style><DesertBG/>
<div style={{position:“relative”,zIndex:1,width:“100%”,maxWidth:`${boardWidth+10}px`,padding:“7px 5px 0”}}>
<div style={{display:“flex”,justifyContent:“space-between”,alignItems:“center”,marginBottom:“4px”}}>
<button onClick={() => {sfx.btn();setScreen(“menu”)}} style={{background:“rgba(180,140,60,0.06)”,border:“1px solid rgba(180,140,60,0.08)”,borderRadius:“8px”,color:“rgba(120,90,40,0.45)”,padding:“4px 10px”,cursor:“pointer”,fontSize:“15px”}}>☰</button>
<span style={{fontSize:“26px”,fontWeight:900,color:T.textScore,display:“inline-block”,animation:scoreBump?“scoreBump 0.25s ease”:“none”}}>{game.score}</span>
<div style={{display:“flex”,gap:“4px”,alignItems:“center”}}>
{game.hasBomb && <button onClick={() => {sfx.btn();dispatch({type:“TOGGLE_BOMB”})}} style={{background:game.bombActive?“rgba(200,144,14,0.1)”:“rgba(180,140,60,0.05)”,border:`1px solid ${game.bombActive?"rgba(200,144,14,0.2)":"rgba(180,140,60,0.06)"}`,borderRadius:“8px”,color:game.bombActive?”#c8900e”:“rgba(120,90,40,0.35)”,padding:“4px 8px”,cursor:“pointer”,fontSize:“15px”}}>💣</button>}
{game.hasUndo && <button onClick={() => {sfx.btn();dispatch({type:“UNDO”})}} style={{background:“rgba(180,140,60,0.05)”,border:“1px solid rgba(180,140,60,0.06)”,borderRadius:“8px”,color:“rgba(120,90,40,0.35)”,padding:“4px 8px”,cursor:“pointer”,fontSize:“15px”}}>↩️</button>}
<button onClick={() => {const next=!soundOn;setSoundOn(next);sfx.btn();if(next){sfx.setBGMVolume(0.06);}else{sfx.setBGMVolume(0);}}} style={{background:“rgba(180,140,60,0.05)”,border:“1px solid rgba(180,140,60,0.06)”,borderRadius:“8px”,color:“rgba(120,90,40,0.35)”,padding:“4px 8px”,cursor:“pointer”,fontSize:“13px”}}>{soundOn?“🔊”:“🔇”}</button>
<span style={{fontSize:“12px”,color:“rgba(138,107,15,0.35)”}}>🪙{game.coins}</span>
<button onClick={() => {sfx.btn();setShowShop(true)}} style={{background:“rgba(180,140,60,0.06)”,border:“1px solid rgba(180,140,60,0.06)”,borderRadius:“6px”,color:“rgba(138,107,15,0.5)”,padding:“3px 8px”,cursor:“pointer”,fontSize:“12px”}}>🛒</button>
</div>
</div>
<div style={{display:“flex”,justifyContent:“center”,gap:“12px”,fontSize:“12px”,color:T.textMuted,marginBottom:“5px”}}>
<span>🏆{game.best}</span><span>📏{game.lines}</span>
{game.streak > 1 && <span style={{color:”#c8900e”,fontWeight:900,fontSize:“16px”,background:“rgba(200,144,14,0.1)”,padding:“1px 10px”,borderRadius:“10px”,border:“1px solid rgba(200,144,14,0.15)”,animation:“pulseGuide 0.8s ease-in-out infinite”}}>🔥×{game.streak}</span>}
{streakBroke && <span style={{color:“rgba(200,100,20,0.5)”,fontWeight:700,fontSize:“13px”,animation:“streakFade 0.8s ease-out forwards”}}>🔥 انتهى!</span>}
</div>
</div>

```
  {/* Board */}
  <div ref={boardRef} style={{position:"relative",zIndex:1,display:"grid",gridTemplateColumns:`repeat(${GRID_SIZE},${cellSize}px)`,gap:`${GAP}px`,padding:`${PAD}px`,borderRadius:"14px",background:T.boardBg,border:T.boardBorder,boxShadow:"0 4px 22px rgba(0,0,0,0.05)",animation:shake?"badShake 0.4s ease":"none",cursor:game.bombActive?"crosshair":"default"}}>
    {game.grid.map((row,r) => row.map((cell,c) => {
      const key = `${r},${c}`, isGhost = ghostCells.has(key), isClearing = clearingCells.has(key), isPlaced = placedCells.has(key);
      const hr = highlightRows.has(r), hc = highlightCols.has(c), willComplete = (hr||hc) && cell !== -1, willClear = hr||hc;
      const cl = cell >= 0 ? COLORS[cell] : null, gcl = isGhost ? COLORS[ghostColor] : null;
      return (
        <div key={key} onClick={() => game.bombActive && dispatch({type:"USE_BOMB",row:r,col:c})} style={{
          width:cellSize, height:cellSize, borderRadius:Math.max(6,cellSize/6)+"px", position:"relative",
          background: cell>=0 ? (willComplete ? `radial-gradient(circle at 30% 30%,${cl.glow}90,${cl.bg},${cl.dark})` : `radial-gradient(circle at 30% 30%,${cl.glow}50,${cl.bg},${cl.dark})`) : isGhost ? `radial-gradient(circle at 30% 30%,${gcl.glow}30,${gcl.bg}38)` : willClear && !isGhost ? "rgba(212,170,60,0.18)" : emptyCellBg,
          border: cell>=0 ? (willComplete ? `2px solid ${cl.glow}70` : `1.5px solid ${cl.glow}30`) : isGhost ? `1.5px solid ${gcl.glow}25` : willClear && !isGhost ? "1.5px solid rgba(200,160,40,0.2)" : emptyCellBorder,
          boxShadow: cell>=0 ? `0 2px 5px ${cl.dark}38,inset 0 1px 0 ${cl.glow}20${willComplete?`,0 0 12px ${cl.glow}60`:""}` : isGhost ? `inset 0 0 6px ${gcl.glow}15` : "none",
          animation: isClearing ? "clearGlow 0.32s ease forwards" : isPlaced ? "cellPlace 0.22s ease" : isGhost ? "ghostPulse 0.6s ease-in-out infinite" : willClear && cell===-1 ? "rowHint 0.5s ease-in-out infinite" : undefined,
          transition:"background 0.1s,border 0.1s", cursor:game.bombActive?"crosshair":"default", transform:willComplete?"scale(1.06)":"scale(1)",
        }}>{cell>=0 && <div style={{position:"absolute",top:"2px",left:"3px",width:"30%",height:"20%",borderRadius:"50%",background:`radial-gradient(ellipse,${cl.glow}28,transparent)`,pointerEvents:"none"}}/>}</div>
      );
    }))}
    {particles.map(p => <div key={p.id} style={{position:"absolute",left:p.x,top:p.y,width:p.sz,height:p.sz,borderRadius:"50%",background:p.c,pointerEvents:"none",zIndex:30,animation:`popIn ${p.dur}ms ease-out forwards`}}/>)}
    {scorePops.map(p => <div key={p.id} style={{position:"absolute",left:p.x,top:p.y,pointerEvents:"none",zIndex:25,fontWeight:900,fontSize:p.big?"22px":"16px",color:p.big?"#8a6b0f":"#b8860b",textShadow:"0 1px 5px rgba(212,160,23,0.35)",animation:"scorePop 1.2s ease-out forwards"}}>+{p.pts}</div>)}
    {flash && <div style={{position:"absolute",top:"50%",left:"50%",fontSize:"clamp(22px,6vw,30px)",fontFamily:"'Amiri',serif",color:"#8a6b0f",fontWeight:700,textShadow:"0 2px 14px rgba(212,160,23,0.5),0 0 25px rgba(212,160,23,0.2)",animation:"kafoBounce 1.3s ease-out forwards",pointerEvents:"none",zIndex:28,whiteSpace:"nowrap"}}>{flash}</div>}
    {milestoneFlash && <div style={{position:"absolute",top:"50%",left:"50%",fontSize:"16px",fontWeight:700,color:"#0f8a3e",textShadow:"0 1px 8px rgba(15,138,62,0.3)",animation:"milestonePop 2s ease-out forwards",pointerEvents:"none",zIndex:29,whiteSpace:"nowrap"}}>🏅 {milestoneFlash} خطوط! +🪙{Math.floor(milestoneFlash/5)}</div>}
    {showOnboard && game.pieces[0] && !dragIndex && <div style={{position:"absolute",bottom:"-36px",left:"50%",transform:"translateX(-50%)",fontSize:"14px",color:"#c8900e",fontWeight:600,animation:"pulseGuide 1.2s ease-in-out infinite",whiteSpace:"nowrap",pointerEvents:"none"}}>👆 اسحب القطعة للشبكة</div>}
  </div>

  {game.bombActive && <p style={{position:"relative",zIndex:1,fontSize:"13px",color:"#c8900e",marginTop:"5px",fontWeight:700,animation:"ghostPulse 0.6s ease-in-out infinite"}}>💣 اضغط لتفجير • <span onClick={() => dispatch({type:"TOGGLE_BOMB"})} style={{color:"rgba(120,90,40,0.4)",textDecoration:"underline",cursor:"pointer"}}>إلغاء</span></p>}

  {/* Piece Tray */}
  <div style={{position:"relative",zIndex:1,display:"flex",justifyContent:"center",alignItems:"center",gap:"8px",marginTop:"10px",minHeight:"70px",padding:"6px 8px",background:T.trayBg,borderRadius:"11px",border:T.trayBorder,width:`${boardWidth}px`}}>
    {game.pieces.map((piece, idx) => {
      if (!piece) return <div key={idx} style={{width:`${Math.floor(boardWidth/3-14)}px`,height:"60px",borderRadius:"8px",border:"1.5px dashed rgba(180,140,60,0.1)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:"14px",opacity:0.12}}>✓</span></div>;
      const pw = piece.shape[0].length, ph = piece.shape.length;
      const scale = Math.min(TRAY_SCALE, 50/(Math.max(pw,ph)*(cellSize+GAP)));
      return (
        <div key={piece.id} onMouseDown={e => handleDragStart(idx,e)} onTouchStart={e => handleDragStart(idx,e)} style={{display:"inline-grid",gridTemplateColumns:`repeat(${pw},${Math.round(cellSize*scale)}px)`,gap:`${Math.round(GAP*scale)}px`,cursor:"grab",opacity:dragIndex===idx?0.2:1,transition:"opacity 0.1s",animation:"popIn 0.25s ease",padding:"4px"}}>
          {piece.shape.map((row,ri) => row.map((v,ci) => <div key={`${ri}-${ci}`} style={{width:Math.round(cellSize*scale),height:Math.round(cellSize*scale),borderRadius:`${Math.max(3,Math.round(5*scale))}px`,background:v?`radial-gradient(circle at 28% 28%,${COLORS[piece.color].glow}50,${COLORS[piece.color].bg})`:"transparent",border:v?`1px solid ${COLORS[piece.color].glow}28`:"none",boxShadow:v?`0 1px 3px ${COLORS[piece.color].dark}30`:"none"}}/>))}
        </div>
      );
    })}
  </div>

  {/* Dragged piece */}
  {dragIndex !== null && dragPos && game.pieces[dragIndex] && (
    <div style={{position:"fixed",left:dragPos.x-(game.pieces[dragIndex].shape[0].length*(cellSize+GAP))/2,top:dragPos.y-(game.pieces[dragIndex].shape.length*(cellSize+GAP))/2-45,zIndex:100,pointerEvents:"none",opacity:0.9,display:"inline-grid",gridTemplateColumns:`repeat(${game.pieces[dragIndex].shape[0].length},${cellSize}px)`,gap:`${GAP}px`,filter:"drop-shadow(0 6px 20px rgba(0,0,0,0.18))"}}>
      {game.pieces[dragIndex].shape.map((row,ri) => row.map((v,ci) => <div key={`d${ri}${ci}`} style={{width:cellSize,height:cellSize,borderRadius:Math.max(6,cellSize/6)+"px",background:v?`radial-gradient(circle at 28% 28%,${COLORS[game.pieces[dragIndex].color].glow}60,${COLORS[game.pieces[dragIndex].color].bg})`:"transparent",border:v?`1.5px solid ${COLORS[game.pieces[dragIndex].color].glow}40`:"none",boxShadow:v?`0 3px 8px ${COLORS[game.pieces[dragIndex].color].dark}40`:"none"}}/>))}
    </div>
  )}

  {/* Game Over */}
  {game.over && (
    <div style={{position:"fixed",inset:0,background:T.overlayBg,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(10px)"}}>
      <div style={{background:T.cardBg,borderRadius:"22px",border:T.cardBorder,padding:"28px 24px",textAlign:"center",maxWidth:"min(320px,90vw)",animation:"fadeUp 0.4s",boxShadow:"0 10px 36px rgba(0,0,0,0.1)"}}>
        <div style={{fontSize:"40px",marginBottom:"3px"}}>🏜️</div>
        <h2 style={{fontFamily:"'Amiri',serif",fontSize:"24px",color:T.textScore,margin:"0 0 2px"}}>انتهت اللعبة</h2>
        <p style={{color:T.textMuted,fontSize:"14px",margin:"0 0 10px"}}>{pick(SAUDI_OVER)}</p>
        <div style={{fontSize:"42px",fontWeight:900,color:T.accent}}>{game.score}</div>
        <div style={{display:"flex",justifyContent:"center",gap:"12px",fontSize:"12px",color:T.textMuted,margin:"4px 0 0"}}><span>📏{game.lines}</span><span>🔥{game.streak}</span><span>📏{game.totalLines} إجمالي</span></div>
        {game.score >= game.best && game.score > 0 && <p style={{color:T.textScore,fontSize:"14px",margin:"6px 0 0",fontWeight:700,animation:"newRecord 0.6s ease-in-out infinite"}}>{pick(SAUDI_RECORD)}</p>}
        <div style={{display:"flex",flexDirection:"column",gap:"6px",marginTop:"16px"}}>
          {!game.revived && <button style={{...makeBtn("#e6850e"),padding:"14px 28px",fontSize:"15px"}} onClick={() => {sfx.btn();adMode.current="revive";setShowAd(true)}}>🎬 شاهد إعلان وأكمل اللعب!</button>}
          <button style={{...makeBtn("#c8900e","lg"),padding:"16px 48px",fontSize:"19px"}} onClick={() => {sfx.btn();startGame()}}>🔄 العب مجدداً</button>
          <div style={{display:"flex",gap:"6px",marginTop:"4px"}}>
            <button style={{...makeBtn("#0f8a3e","sm"),flex:1,fontSize:"12px"}} onClick={() => {sfx.btn();adMode.current="coins";setShowAd(true)}}>🎬 +50🪙</button>
            <button style={{...makeBtn("#1d6ec2","sm"),flex:1,fontSize:"12px"}} onClick={() => {try{navigator.share?.({title:"تفجير البلوكات! 💥",text:`⚡ اتحداك تكسر نتيجتي!\n\n🏆 نتيجتي: ${game.score} نقطة\n📏 ${game.lines} صف\n🔥 أعلى سلسلة: ${game.streak}\n\nتفجير البلوكات! — أول لعبة بازل سعودية! 💥🏜️\nالعب الحين 🎮👇`})}catch(e){}}}>📤 تحدى صديقك</button>
            <button style={{...makeBtn("#999","sm"),flex:1,fontSize:"12px"}} onClick={() => {sfx.btn();setScreen("menu")}}>القائمة</button>
          </div>
        </div>
      </div>
    </div>
  )}
  {showShop && <ShopModal coins={game.coins} onBuy={id => {sfx.coin();dispatch({type:"BUY_ITEM",item:id});}} onClose={() => setShowShop(false)} hasBomb={game.hasBomb} hasUndo={game.hasUndo}/>}
  {showAd && <AdOverlay onDone={() => {setShowAd(false);if(adMode.current==="revive"){dispatch({type:"REVIVE"});}else{dispatch({type:"ADD_COINS",amount:50});}if(soundOn)sfx.coin();}}/>}
</div>
```

);
}

/* ── Export with Error Boundary ── */
export default function DesertBlocks() {
return <ErrorBoundary><DesertBlocksGame/></ErrorBoundary>;
}
