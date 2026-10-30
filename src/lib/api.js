// 모둠 진행판 서버(역사교사 아카이브의 /api/sechaek)와 주고받기.
// 서버가 없는 곳(내 컴퓨터, 다른 주소)에서는 실패하고, 게임은 혼자 그대로 작동합니다.
import { useEffect, useRef, useState } from 'react';
import { SETTINGS } from '../data/game.js';

const BASE = SETTINGS.apiBase;

async function call(path, { method = 'GET', body, key } = {}) {
  const headers = {};
  if (body) headers['content-type'] = 'application/json';
  if (key) headers['x-teacher-key'] = key;
  let res;
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  } catch {
    throw new Error('서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new Error(data?.error || '진행판 서버를 찾지 못했어요. 역사교사 아카이브 주소로 열었는지 확인해 주세요.');
  return data;
}

export const createClass = (title, minutes) => call('/classes', { method: 'POST', body: { title, minutes } });
export const getClass = (code, key) => call(`/classes/${encodeURIComponent(code)}`, { key });
export const giveTime = (code, key, teamId, minutes) => call(`/classes/${encodeURIComponent(code)}`, { method: 'PATCH', key, body: { team_id: teamId, minutes } });
export const judgeFinal = (code, key, teamId, pass, comment) => call(`/classes/${encodeURIComponent(code)}`, { method: 'PATCH', key, body: { team_id: teamId, verdict: { pass, comment } } });
const pushProgress = (code, body) => call(`/classes/${encodeURIComponent(code)}/progress`, { method: 'POST', body });

export const newTeamId = () => {
  const a = crypto.getRandomValues(new Uint8Array(9));
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
};

/** 수업 코드로 들어온 모둠의 기록을 서버로 보내고, 교사가 진행판에서 준 시간과 결론 판정을 받아 온다 */
export function useSync(game, update) {
  const [status, setStatus] = useState('off'); // off | ok | error
  const latest = useRef(game);
  latest.current = game;
  const code = game.classCode;

  const send = useRef(null);
  send.current = async () => {
    const g = latest.current;
    if (!g.classCode || !g.teamId) return;
    try {
      const r = await pushProgress(g.classCode, { team_id: g.teamId, team: g.team, klass: g.klass, state: g });
      setStatus('ok');
      const extra = r.extra_min || 0;
      if (extra > (g.remoteMinutes || 0)) {
        update((x) => {
          const add = extra - (x.remoteMinutes || 0);
          if (add <= 0) return x;
          x.remoteMinutes = extra;
          x.addedMinutes = (x.addedMinutes || 0) + add;
          x.endAt = Math.max(x.endAt || 0, Date.now()) + add * 60000;
          if (x.outcome === 'caught') x.outcome = null;
          x.timeReq = null;
          return x;
        });
      }
      const v = r.verdict;
      if (v && g.final?.submitted && v.at > g.final.submitted.at) {
        update((x) => {
          const sub = x.final.submitted;
          if (!sub || v.at <= sub.at) return x;
          x.final.attempts.push({ text: sub.text, pass: v.pass, comment: v.comment, at: v.at });
          x.final.submitted = null;
          if (v.pass) { x.final.passed = true; x.outcome = 'escaped'; x.escapedAt = v.at; }
          return x;
        });
      }
    } catch {
      setStatus('error');
    }
  };

  // 기록이 바뀌면 잠깐 모았다가 보내기
  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => send.current(), 1500);
    return () => clearTimeout(t);
  }, [game, code]);

  // 바뀐 게 없어도 15초마다 연결 알리기 (교사가 준 시간도 이때 받음).
  // 선생님 확인을 기다리는 중(시간 요청, 결론 제출)에는 4초마다 물어본다
  const waiting = !!(game.timeReq || game.final?.submitted);
  useEffect(() => {
    if (!code) { setStatus('off'); return; }
    const t = setInterval(() => send.current(), waiting ? 4000 : 15000);
    return () => clearInterval(t);
  }, [code, waiting]);

  return status;
}
