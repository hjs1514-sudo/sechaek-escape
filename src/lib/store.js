// 이 기기(모둠 태블릿)에 게임 상태를 저장합니다. 새로고침해도 이어집니다.
import { useEffect, useState, useCallback } from 'react';
import { SETTINGS } from '../data/game.js';

const GAME_KEY = 'sechaek-escape-game-v1';
const SET_KEY = 'sechaek-escape-settings-v1';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 저장 공간을 못 쓰는 환경에서는 화면 상태만 유지 */
  }
}

export const emptyGame = () => ({
  team: '',
  klass: '',
  startedAt: null,
  endAt: null,
  rooms: {},          // roomId -> { done, doneAt, puzzles: { pid -> {...} } }
  inserted: [],       // 대문에 꽂은 열쇠 roomId 목록
  final: { text: '', attempts: [], passed: false },
  outcome: null,      // 'escaped' | 'caught' | null
  addedMinutes: 0,
  minutes: null,      // 이 모둠의 제한 시간(분). 수업 코드로 들어오면 교사가 정한 시간
  classCode: '',      // 모둠 진행판 수업 코드 (없으면 이 기기 안에서만)
  teamId: '',
  remoteMinutes: 0,   // 진행판에서 받은 추가 시간(분) 합계
});

export function useGame() {
  const [game, setGame] = useState(() => read(GAME_KEY, emptyGame()));
  useEffect(() => write(GAME_KEY, game), [game]);
  const update = useCallback((fn) => setGame((g) => fn(structuredClone(g))), []);
  const reset = useCallback(() => setGame(emptyGame()), []);
  return [game, update, reset];
}

export function useSettings() {
  const [settings, setSettings] = useState(() => read(SET_KEY, { minutes: SETTINGS.minutes, pin: SETTINGS.teacherPin }));
  useEffect(() => write(SET_KEY, settings), [settings]);
  return [settings, setSettings];
}

export function puzzleState(game, roomId, pid) {
  return game.rooms[roomId]?.puzzles?.[pid] || null;
}

export function ensurePuzzle(g, roomId, pid) {
  g.rooms[roomId] ||= { done: false, doneAt: null, puzzles: {} };
  g.rooms[roomId].puzzles[pid] ||= {
    step: 0, done: false, wrong: 0, hints: 0, firstTry: [], startAt: Date.now(), endAt: null,
  };
  return g.rooms[roomId].puzzles[pid];
}

export function useNow(interval = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [interval]);
  return now;
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

// 사료 그림이 public/sources 에 있는지 확인
const cache = {};
export function useImageOk(file) {
  const [ok, setOk] = useState(file ? cache[file] ?? null : false);
  useEffect(() => {
    if (!file) return;
    if (cache[file] !== undefined) { setOk(cache[file]); return; }
    const img = new Image();
    img.onload = () => { cache[file] = true; setOk(true); };
    img.onerror = () => { cache[file] = false; setOk(false); };
    img.src = `sources/${file}`;
  }, [file]);
  return ok;
}

export function shuffle(arr, seed = 7) {
  const a = arr.map((v, i) => [v, i]);
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
