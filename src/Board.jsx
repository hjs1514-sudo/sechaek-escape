// 모둠 진행판: 여러 모둠 태블릿의 진행을 교사 화면(TV) 하나에서 봅니다.
// 수업을 열면 4자리 코드가 나오고, 학생이 입장할 때 그 코드를 넣으면 이 화면에 모둠이 나타납니다.
import { useCallback, useEffect, useRef, useState } from 'react';
import { ROOMS, FINAL, SETTINGS } from './data/game.js';
import { fmtTime, useNow } from './lib/store.js';
import { createClass, getClass, giveTime, judgeFinal } from './lib/api.js';
import { QrMini } from './components/QrCard.jsx';

const SAVE_KEY = 'sechaek-board-v1';
const POLL_MS = 5000;
const STALE_MS = 45000;
const PUZZLES = ROOMS.flatMap((r) => r.puzzles.map((p) => ({ r, p })));

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || []; } catch { return []; }
}
function storeSaved(list) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(list.slice(0, 8))); } catch { /* 저장 불가 환경 */ }
}

/** 주소 #/board?c=1234&k=... 로 들어오면 그 수업을 이 기기에 기억 */
function fromHash() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const code = q.get('c');
  const key = q.get('k');
  if (!code || !key) return null;
  history.replaceState(null, '', location.pathname + location.search + '#/board');
  return { code, key, title: '', minutes: null };
}

export default function Board() {
  const [saved, setSaved] = useState(() => {
    const list = loadSaved();
    const h = fromHash();
    if (h && !list.some((c) => c.code === h.code)) list.unshift(h);
    storeSaved(list);
    return list;
  });
  const [current, setCurrent] = useState(() => {
    const q = new URLSearchParams(location.hash.split('?')[1] || '');
    return q.get('c') || saved[0]?.code || null;
  });
  const remember = (list) => { storeSaved(list); setSaved(list); };
  const cls = saved.find((c) => c.code === current);

  return (
    <div className="board">
      <header className="board-head">
        <h1>모둠 진행판 · 한양 세책점의 비밀</h1>
        <div className="row">
          <QrMini />
          {cls && <button className="btn ghost small" onClick={() => setCurrent(null)}>수업 목록</button>}
          <button className="btn ghost small" onClick={() => { location.hash = '#/teacher'; }}>교사 화면</button>
          <button className="btn ghost small" onClick={() => { location.hash = '#cover'; }}>첫 화면</button>
        </div>
      </header>
      {cls ? (
        <ClassView cls={cls} onForget={() => { remember(saved.filter((c) => c.code !== cls.code)); setCurrent(null); }} />
      ) : (
        <ClassPicker saved={saved} onPick={setCurrent} onCreate={(c) => { remember([c, ...saved.filter((x) => x.code !== c.code)]); setCurrent(c.code); }} />
      )}
    </div>
  );
}

function ClassPicker({ saved, onPick, onCreate }) {
  const [title, setTitle] = useState('');
  const [minutes, setMinutes] = useState(SETTINGS.minutes);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const make = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const c = await createClass(title.trim(), minutes);
      onCreate({ code: c.code, key: c.key, title: c.title, minutes: c.minutes, created_at: Date.now() });
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  };
  return (
    <>
      <section className="t-card">
        <h2>새 수업 열기</h2>
        <form className="t-form" onSubmit={make}>
          <label>수업 이름 (선택)<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2-3반 5교시" maxLength={40} style={{ width: 200 }} /></label>
          <label>제한 시간(분)<input type="number" min="5" max="90" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
          <button className="btn small" disabled={busy}>{busy ? '여는 중…' : '수업 열기'}</button>
        </form>
        {err && <p className="noc">{err}</p>}
        <p className="small-note">수업을 열면 숫자 4자리 수업 코드가 나와요. 학생은 모둠 입장 화면의 '수업 코드' 칸에 넣으면 되고, 제한 시간도 여기서 정한 대로 맞춰져요. 이름·학번은 받지 않고, 수업 기록은 3일 뒤 서버에서 지워져요.</p>
      </section>
      {saved.length > 0 && (
        <section className="t-card">
          <h2>이 기기에서 연 수업</h2>
          <div className="row">
            {saved.map((c) => (
              <button key={c.code} className="btn ghost" onClick={() => onPick(c.code)}>
                {c.code}{c.title ? ` · ${c.title}` : ''}
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

// ---------- 모둠 상태 계산 ----------
function summarize(t, now) {
  const g = t.state || {};
  const ps = PUZZLES.map(({ r, p }) => g.rooms?.[r.id]?.puzzles?.[p.id] || null);
  const keys = ROOMS.filter((r) => g.rooms?.[r.id]?.done).length;
  const wrong = ps.reduce((n, s) => n + (s?.wrong || 0), 0);
  const hints = ps.reduce((n, s) => n + (s?.hints || 0), 0);
  const solved = ps.filter((s) => s?.done).length;
  const status = g.outcome === 'escaped' ? 'escaped' : g.outcome === 'caught' ? 'caught' : g.outcome === 'arrested' ? 'arrested' : g.startedAt ? 'playing' : 'waiting';
  const left = status === 'playing' && g.endAt ? g.endAt - now : null;
  const stale = status === 'playing' && now - t.updated_at > STALE_MS;
  const stuck = ps.filter((s) => s && !s.done && (s.wrong >= 3 || s.hints >= 2)).length;
  // 선생님 확인이 필요한 것: 5분 추가 요청, 결론 제출 (이미 처리해 태블릿에 전달 중이면 빼기)
  const granted = (t.extra_min || 0) > (g.remoteMinutes || 0);
  const timeAsk = !!g.timeReq && !granted && (status === 'playing' || status === 'caught') ? g.timeReq : null;
  const sub = g.final?.submitted;
  const finalAsk = sub && status !== 'escaped' && !(t.verdict && t.verdict.at > sub.at) ? sub : null;
  return { g, ps, keys, wrong, hints, solved, status, left, stale, stuck, timeAsk, finalAsk };
}

// ---------- 선생님 알림 ----------
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.18].forEach((d) => {
      const o = ctx.createOscillator();
      const v = ctx.createGain();
      o.frequency.value = 880;
      v.gain.setValueAtTime(0.15, ctx.currentTime + d);
      v.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.15);
      o.connect(v).connect(ctx.destination);
      o.start(ctx.currentTime + d);
      o.stop(ctx.currentTime + d + 0.16);
    });
    setTimeout(() => ctx.close(), 600);
  } catch { /* 소리를 못 내는 환경 */ }
}

function Alerts({ teams, onAdd, onJudge }) {
  const items = teams.flatMap((t) => [
    t.s.timeAsk && { kind: 'time', id: `time-${t.team_id}-${t.s.timeAsk.at}`, t, at: t.s.timeAsk.at },
    t.s.finalAsk && { kind: 'final', id: `final-${t.team_id}-${t.s.finalAsk.at}`, t, at: t.s.finalAsk.at },
  ].filter(Boolean)).sort((a, b) => a.at - b.at);
  const [busy, setBusy] = useState({});
  const seen = useRef(null);
  useEffect(() => {
    const ids = new Set(items.map((x) => x.id));
    if (seen.current && [...ids].some((id) => !seen.current.has(id))) beep();
    seen.current = ids;
  });
  if (!items.length) return null;
  const act = async (id, fn) => { setBusy((b) => ({ ...b, [id]: true })); await fn(); setBusy((b) => ({ ...b, [id]: false })); };
  return (
    <section className="alerts" aria-live="polite">
      <h2>선생님 확인이 필요해요 ({items.length})</h2>
      {items.map(({ kind, id, t }) => (
        <div key={id} className={`alert-item ${kind}`}>
          <div className="alert-text">
            <b>{t.team || '(이름 없음)'}{t.klass ? ` · ${t.klass}반` : ''}</b>
            {kind === 'time'
              ? <span>5분 추가를 요청했어요. {t.s.status === 'caught' ? '(시간 초과로 멈춤)' : t.s.left !== null ? `남은 시간 ${fmtTime(t.s.left)}` : ''}</span>
              : <span>결론을 제출했어요: “{t.s.finalAsk.text}”</span>}
          </div>
          <div className="row">
            {kind === 'time' ? (
              <button className="btn small" disabled={busy[id]} onClick={() => act(id, () => onAdd(t.team_id))}>5분 추가하기</button>
            ) : (
              <>
                <button className="btn ghost small" disabled={busy[id]} onClick={() => act(id, () => onJudge(t.team_id, false))}>다시 생각해 보기</button>
                <button className="btn small" disabled={busy[id]} onClick={() => act(id, () => onJudge(t.team_id, true))}>통과 — 대문 열기</button>
              </>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

const STATUS_LABEL = { playing: '진행 중', escaped: '탈출', caught: '시간 초과', arrested: '포졸에게 잡힘', waiting: '입장 전' };

function ClassView({ cls, onForget }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(false);
  const now = useNow(1000);

  const load = useCallback(async () => {
    try {
      setData(await getClass(cls.code, cls.key));
      setErr('');
    } catch (x) {
      setErr(x.message);
    }
  }, [cls.code, cls.key]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const addTime = async (teamId) => {
    try {
      await giveTime(cls.code, cls.key, teamId, 5);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };

  const judge = async (teamId, pass) => {
    let comment = '';
    if (!pass) {
      const c = prompt('모둠에게 보낼 한마디 (비워도 돼요)', '');
      if (c === null) return;
      comment = c;
    }
    try {
      await judgeFinal(cls.code, cls.key, teamId, pass, comment);
      load();
    } catch (x) {
      setErr(x.message);
    }
  };

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}#/board?c=${cls.code}&k=${encodeURIComponent(cls.key)}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 3000); } catch { prompt('이 주소를 다른 기기에서 열어 주세요', url); }
  };

  const teams = (data?.teams || []).map((t) => ({ ...t, s: summarize(t, now) }));
  const title = data?.title || cls.title;
  const openTeam = teams.find((t) => t.team_id === open);

  return (
    <>
      <section className="board-class">
        <div className="board-code">
          <small>수업 코드</small>
          <strong>{cls.code}</strong>
        </div>
        <div className="board-meta">
          <div className="board-title">{title || '이름 없는 수업'}</div>
          <div className="small-note">
            제한 시간 {data?.minutes ?? cls.minutes ?? '-'}분 · 모둠 {teams.length}개 · 탈출 {teams.filter((t) => t.s.status === 'escaped').length}
            {' · '}{err ? <span className="noc">{err}</span> : data ? '5초마다 새로고침' : '불러오는 중…'}
          </div>
          <div className="row">
            <button className="btn ghost small" onClick={copyLink}>{copied ? '주소를 복사했어요' : '다른 기기(TV)에서 열 주소 복사'}</button>
            <button className="btn ghost small" onClick={onForget}>이 기기에서 수업 지우기</button>
          </div>
        </div>
      </section>

      <Alerts teams={teams} onAdd={addTime} onJudge={judge} />

      {data && teams.length === 0 && (
        <section className="t-card">
          <p>아직 들어온 모둠이 없어요. 학생들에게 모둠 입장 화면의 <b>수업 코드</b> 칸에 <b>{cls.code}</b>를 넣으라고 알려 주세요.</p>
        </section>
      )}

      <section className="team-grid">
        {teams.map((t) => <TeamCard key={t.team_id} t={t} onOpen={() => setOpen(t.team_id)} onAdd={() => addTime(t.team_id)} />)}
      </section>

      {teams.length > 0 && <PuzzleSummary teams={teams} />}

      {openTeam && <TeamDetail t={openTeam} onClose={() => setOpen(null)} />}
    </>
  );
}

function TeamCard({ t, onOpen, onAdd }) {
  const { s } = t;
  return (
    <article className={`team-card ${s.status} ${s.stale ? 'stale' : ''}`}>
      <header>
        <div>
          <strong className="team-name">{t.team || '(이름 없음)'}</strong>
          {t.klass && <span className="small-note"> {t.klass}반</span>}
        </div>
        <span className={`pill ${s.status}`}>{STATUS_LABEL[s.status]}</span>
      </header>
      <div className="team-stats">
        <div><small>남은 시간</small><b className={s.left !== null && s.left < 5 * 60000 ? 'noc' : ''}>{s.left !== null ? fmtTime(s.left) : s.status === 'escaped' && s.g.escapedAt ? fmtTime(s.g.escapedAt - s.g.startedAt) : '-'}</b></div>
        <div><small>열쇠</small><b>{s.keys}/{ROOMS.length}</b></div>
        <div><small>퍼즐</small><b>{s.solved}/{PUZZLES.length}</b></div>
        <div><small>오답</small><b>{s.wrong}</b></div>
        <div><small>힌트</small><b>{s.hints}</b></div>
      </div>
      <div className="cells" style={{ gridTemplateColumns: `repeat(${ROOMS.length}, 1fr)` }}>
        {ROOMS.map((r) => (
          <div key={r.id} className="cell-room" title={r.name}>
            {r.puzzles.map((p) => {
              const ps = s.g.rooms?.[r.id]?.puzzles?.[p.id];
              const cls = ps?.done ? 'done' : ps ? ((ps.wrong >= 3 || ps.hints >= 2) ? 'stuck' : 'doing') : '';
              return <i key={p.id} className={`cell ${cls}`} title={`${p.id} ${p.title}${ps ? ` · 오답 ${ps.wrong} · 힌트 ${ps.hints}` : ''}`}>{p.id}</i>;
            })}
          </div>
        ))}
      </div>
      <footer className="row">
        {s.stale && <span className="noc small">연결 끊김 {Math.round((Date.now() - t.updated_at) / 1000)}초</span>}
        {!s.stale && s.stuck > 0 && <span className="warn small">막힌 퍼즐 {s.stuck}개</span>}
        {s.g.final?.attempts?.length > 0 && s.status !== 'escaped' && <span className="warn small">최종 답 {s.g.final.attempts.length}번 냄</span>}
        <span className="grow" />
        {s.timeAsk && <span className="warn small">5분 요청</span>}
        {s.finalAsk && <span className="warn small">결론 제출</span>}
        {(s.status === 'playing' || s.status === 'caught') && <button className="btn ghost small" onClick={onAdd}>+5분</button>}
        <button className="btn small" onClick={onOpen}>자세히</button>
      </footer>
      {t.extra_min > 0 && <div className="small-note">진행판에서 준 시간 {t.extra_min}분{t.extra_min > (s.g.remoteMinutes || 0) ? ' (태블릿 전달 중)' : ''}</div>}
    </article>
  );
}

function PuzzleSummary({ teams }) {
  const rows = PUZZLES.map(({ r, p }, i) => {
    const list = teams.map((t) => t.s.ps[i]).filter(Boolean);
    const firsts = list.flatMap((s) => (s.firstTry || []).filter(Boolean));
    const times = list.filter((s) => s.done && s.endAt && s.startAt).map((s) => s.endAt - s.startAt);
    return {
      r, p,
      started: list.length,
      done: list.filter((s) => s.done).length,
      firstOk: firsts.length ? Math.round((firsts.filter((f) => f.ok).length / firsts.length) * 100) : null,
      wrong: list.reduce((n, s) => n + (s.wrong || 0), 0),
      hints: list.reduce((n, s) => n + (s.hints || 0), 0),
      avg: times.length ? times.reduce((a, b) => a + b, 0) / times.length : null,
    };
  });
  const hardest = [...rows].filter((x) => x.started).sort((a, b) => (b.wrong + b.hints) - (a.wrong + a.hints)).slice(0, 3).filter((x) => x.wrong + x.hints > 0);
  return (
    <section className="t-card">
      <h2>퍼즐별 모아 보기</h2>
      {hardest.length > 0 && (
        <p>정리 시간에 짚어 볼 퍼즐: {hardest.map((x) => <b key={x.p.id} className="warn">{x.p.id} {x.p.title} </b>)}</p>
      )}
      <div className="table-wrap">
        <table className="t-table">
          <thead><tr><th>퍼즐</th><th>푼 모둠</th><th>첫 답 정답률</th><th>오답 합</th><th>힌트 합</th><th>평균 시간</th></tr></thead>
          <tbody>
            {rows.map((x) => (
              <tr key={x.p.id}>
                <td>{x.r.no}방 {x.p.id} {x.p.title}</td>
                <td>{x.done}/{teams.length}{x.started > x.done ? ` (푸는 중 ${x.started - x.done})` : ''}</td>
                <td>{x.firstOk === null ? '-' : `${x.firstOk}%`}</td>
                <td>{x.wrong}</td>
                <td>{x.hints}</td>
                <td>{x.avg === null ? '-' : fmtTime(x.avg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TeamDetail({ t, onClose }) {
  const { s } = t;
  const g = s.g;
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="t-card team-detail" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h2 className="grow">{t.team} {t.klass && `· ${t.klass}반`} — {STATUS_LABEL[s.status]}</h2>
          <button className="btn ghost small" onClick={onClose}>닫기</button>
        </div>
        {g.startedAt && (
          <p className="small-note">
            시작 {new Date(g.startedAt).toLocaleTimeString('ko-KR')}
            {g.escapedAt ? ` · 탈출 ${fmtTime(g.escapedAt - g.startedAt)}` : ''}
            {g.addedMinutes ? ` · 추가 시간 ${g.addedMinutes}분` : ''}
            {' · '}마지막 연결 {new Date(t.updated_at).toLocaleTimeString('ko-KR')}
          </p>
        )}
        <div className="table-wrap">
          <table className="t-table">
            <thead><tr><th>퍼즐</th><th>첫 답</th><th>오답</th><th>힌트</th><th>걸린 시간</th><th>상태</th></tr></thead>
            <tbody>
              {PUZZLES.map(({ r, p }, i) => {
                const ps = s.ps[i];
                return (
                  <tr key={p.id}>
                    <td>{r.no}방 {p.id} {p.title}</td>
                    <td>{ps?.firstTry?.length ? ps.firstTry.map((f, j) => <span key={j} className={f?.ok ? 'okc' : 'noc'} title={f?.answer ? String(f.answer) : ''}>{f?.ok ? '○' : '×'} </span>) : '-'}</td>
                    <td>{ps?.wrong ?? '-'}</td>
                    <td>{ps?.hints ?? '-'}</td>
                    <td>{ps?.endAt ? fmtTime(ps.endAt - ps.startAt) : '-'}</td>
                    <td>{ps?.done ? '완료' : ps ? '푸는 중' : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <h3>최종 결론</h3>
        <p className="small-note">{FINAL.conclusion.map((c) => c.text).join(' ')}</p>
        {!g.final?.attempts?.length && <p>{g.final?.submitted ? '결론을 내고 선생님 확인을 기다리는 중이에요.' : '아직 결론을 내지 않았어요.'}</p>}
        {g.final?.attempts?.map((a, i) => (
          <div key={i} className="t-answer">
            <b>{i + 1}차 · {a.pass ? '통과' : '다시 생각해 보기'}</b> {a.text}
            {a.comment && <div className="small-note">교사 한마디: {a.comment}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
