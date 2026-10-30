import { useEffect, useMemo, useRef, useState } from 'react';
import { ROOMS, FINAL, SETTINGS } from './data/game.js';
import { useGame, useSettings, useNow, ensurePuzzle, fmtTime } from './lib/store.js';
import { GlossProvider, T, SunBar, SourceCard, Zoom, PinModal, StepWords } from './components/common.jsx';
import { Step } from './components/Puzzles.jsx';
import Teacher from './Teacher.jsx';
import { RoomIcon, HomeIcon, LockIcon, ClueIcon } from './components/icons.jsx';
import { QrCard, QrMini } from './components/QrCard.jsx';
import Board from './Board.jsx';
import { getClass, newTeamId, useSync } from './lib/api.js';

const roomDone = (game, r) => !!game.rooms[r.id]?.done;
const MAIN_ROOMS = ROOMS.filter((r) => !r.hidden);
const TOTAL_PUZZLES = ROOMS.reduce((n, r) => n + r.puzzles.length, 0);

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const f = () => setHash(location.hash);
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return (
    <GlossProvider>
      {hash.startsWith('#/teacher') ? <Teacher /> : hash.startsWith('#/board') ? <Board /> : <Game key={hash === '#cover' ? 'cover' : 'game'} />}
    </GlossProvider>
  );
}

function Game() {
  const [game, update, reset] = useGame();
  const [settings] = useSettings();
  const [screen, setScreen] = useState(() => {
    if (location.hash === '#cover') { history.replaceState(null, '', location.pathname + location.search); return 'cover'; }
    return game.startedAt ? 'map' : 'cover';
  });
  const [teacherPin, setTeacherPin] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [recordOf, setRecordOf] = useState(null);
  const now = useNow(1000);
  const sync = useSync(game, update);

  const total = ((game.minutes || settings.minutes) + (game.addedMinutes || 0)) * 60000;
  const left = game.endAt ? game.endAt - now : total;
  const running = game.startedAt && !game.outcome;

  useEffect(() => {
    if (running && left <= 0) update((g) => { g.outcome = 'caught'; return g; });
  }, [running, left, update]);

  const keys = ROOMS.filter((r) => roomDone(game, r));
  const room = ROOMS.find((r) => r.id === roomId);
  const mainDone = MAIN_ROOMS.every((r) => roomDone(game, r));
  const keysNeeded = mainDone ? ROOMS.length : MAIN_ROOMS.length;
  const [startPid, setStartPid] = useState(null);
  const openRoom = (id) => {
    const r = ROOMS.find((x) => x.id === id);
    setRoomId(id);
    setScreen(r?.hidden ? 'scene' : 'room');
  };

  const afterIntro = () => setScreen(game.startedAt ? 'map' : 'join');
  let body;
  if (screen === 'cover') body = <Cover started={!!game.startedAt} team={game.team} onStart={() => setScreen('intro')} onSkip={afterIntro} />;
  else if (screen === 'intro') body = <Intro started={!!game.startedAt} onDone={afterIntro} />;
  else if (game.outcome === 'escaped') body = <Escaped game={game} onRecord={setRecordOf} recordOf={recordOf} onReset={() => { reset(); setScreen('cover'); }} />;
  else if (game.outcome === 'arrested') body = <Arrested game={game} settings={settings} update={update} />;
  else if (game.outcome === 'caught') body = <Caught game={game} settings={settings} update={update} onRecord={setRecordOf} recordOf={recordOf} />;
  else if (screen === 'join') body = (
    <Join
      onJoin={(team, klass, cls) => {
        update((g) => {
          g.team = team; g.klass = klass; g.startedAt = Date.now();
          g.minutes = cls?.minutes || settings.minutes;
          g.endAt = Date.now() + g.minutes * 60000;
          if (cls) { g.classCode = cls.code; g.teamId = newTeamId(); }
          return g;
        });
        setScreen('map');
      }}
    />
  );
  else if (screen === 'scene' && room) body = (
    <Scene
      room={room}
      game={game}
      onBack={() => setScreen('map')}
      onPick={(pid) => { setStartPid(pid); setScreen('room'); }}
      onRecord={() => setRecordOf(room.id)}
    />
  );
  else if (screen === 'room' && room) body = (
    <Room
      key={`${room.id}-${startPid || ''}`}
      room={room}
      game={game}
      update={update}
      startPid={room.hidden ? startPid : null}
      sceneMode={!!room.hidden}
      onBack={() => setScreen(room.hidden ? 'scene' : 'map')}
      onDone={() => { setRecordOf(room.id); setScreen('map'); }}
    />
  );
  else if (screen === 'gate') body = <Gate game={game} update={update} settings={settings} onBack={() => setScreen('map')} />;
  else body = (
    <MapScreen
      game={game}
      keys={keys}
      onRoom={openRoom}
      update={update}
      mainDone={mainDone}
      onGate={() => setScreen('gate')}
      onRecord={setRecordOf}
    />
  );

  return (
    <div className="app">
      {screen !== 'intro' && (
        <header className="topbar">
          <button className="brand" onClick={() => setScreen('cover')} title="첫 화면으로">1860 · 한양 세책점의 비밀</button>
          {running ? <SunBar left={left} total={total} /> : <span className="topbar-space" />}
          {game.startedAt && (
            <div className="team">
              {game.classCode && <i className={`sync-dot ${sync}`} title={sync === 'error' ? '진행판에 연결이 끊겼어요. 게임은 계속돼요.' : '진행판에 연결됨'} />}
              {game.team} <span className="keys">열쇠 {keys.length}/{keysNeeded}</span>
            </div>
          )}
          {running && <TimeRequest game={game} update={update} settings={settings} />}
          <QrMini />
          <nav className="topnav" aria-label="화면 이동">
            <button className="nav-btn" onClick={() => setScreen('cover')} disabled={screen === 'cover'}>
              <HomeIcon /> <span>첫 화면</span>
            </button>
            <button className="nav-btn" onClick={() => setTeacherPin(true)}>
              <LockIcon /> <span>교사 화면</span>
            </button>
          </nav>
        </header>
      )}
      {body}
      {recordOf && !game.outcome && <RecordModal room={ROOMS.find((r) => r.id === recordOf)} onClose={() => setRecordOf(null)} />}
      {teacherPin && (
        <PinModal title="교사 화면" pin={settings.pin} onCancel={() => setTeacherPin(false)}
          onOk={() => { try { sessionStorage.setItem('sechaek-teacher', '1'); } catch { /* 저장 불가 환경 */ } location.hash = '#/teacher'; }}>
          <p>교사 PIN을 넣어야 들어갈 수 있어요.</p>
        </PinModal>
      )}
    </div>
  );
}

// ---------- 표지 ----------
function Cover({ started, team, onStart, onSkip }) {
  return (
    <section className="cover" style={{ backgroundImage: 'url(art/library.webp)' }}>
      <div className="cover-shade" />
      <img className="cover-book" src="art/book.webp" alt="" />
      <div className="cover-title">
        <h1 className="sr-only">1860, 한양 세책점의 비밀</h1>
        <img className="signboard" src="art/signboard.webp" alt="1860 한양 세책점의 비밀 — 해가 지기 전에, 첫째 상자를 열어라" />
        <p className="cover-sub">조선 후기 문화 방탈출 · 실학 · 서학과 동학 · 서민 문화 · 진경산수화</p>
      </div>
      <div className="cover-bottom">
        <div className="cover-actions">
          {started ? (
            <>
              <button className="btn big" onClick={onSkip}>{team} 이어서 하기</button>
              <button className="btn ghost" onClick={onStart}>도입 영상 다시 보기</button>
            </>
          ) : (
            <>
              <button className="btn big" onClick={onStart}>도입 영상 보기</button>
              <button className="btn ghost" onClick={onSkip}>영상 건너뛰고 입장</button>
            </>
          )}
        </div>
        <QrCard />
      </div>
    </section>
  );
}

// ---------- 도입 영상 ----------
function Intro({ started, onDone }) {
  const [ended, setEnded] = useState(false);
  return (
    <section className="intro">
      {!ended ? (
        <>
          <video src="media/intro.mp4" poster="media/intro_poster.jpg" controls autoPlay playsInline onEnded={() => setEnded(true)} />
          <button className="btn ghost skip" onClick={() => setEnded(true)}>건너뛰기</button>
        </>
      ) : (
        <div className="intro-end" style={{ backgroundImage: 'url(art/shop.webp)' }}>
          <div className="note-paper" style={{ backgroundImage: 'url(art/paper.webp)' }}>
            <p>해가 지면 포도청이 금서를 찾으러 온다.</p>
            <p>내가 이 가게에 상자 네 개를 숨겨 두었다.</p>
            <p>네 개의 열쇠를 모두 모아야 대문이 열린다.</p>
            <p className="sign">— 세책점 주인</p>
          </div>
          <button className="btn big" onClick={onDone}>{started ? '세책점으로 돌아가기' : '모둠 입장하기'}</button>
        </div>
      )}
    </section>
  );
}

// ---------- 입장 ----------
function Join({ onJoin }) {
  const [team, setTeam] = useState('');
  const [klass, setKlass] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    if (!team.trim() || busy) return;
    if (!code.trim()) { onJoin(team.trim(), klass.trim(), null); return; }
    setBusy(true); setErr('');
    try {
      onJoin(team.trim(), klass.trim(), await getClass(code.trim()));
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };
  return (
    <section className="join" style={{ backgroundImage: 'url(art/hanyang.webp)' }}>
      <figure className="hero">
        <img src="art/hero.webp" alt="" />
        <figcaption>책장을 넘기자 1860년 한양에 서 있었다</figcaption>
      </figure>
      <form className="join-card paper-sheet" style={{ backgroundImage: 'url(art/paper.webp)' }} onSubmit={submit}>
        <h2>세책점에 들어가기</h2>
        <label>모둠 이름<input value={team} onChange={(e) => setTeam(e.target.value)} placeholder="예: 3모둠" autoFocus maxLength={20} /></label>
        <label>반<input value={klass} onChange={(e) => setKlass(e.target.value)} placeholder="예: 2-3" maxLength={10} /></label>
        <label>수업 코드 <small className="small-note">선생님이 알려 준 숫자 4자리 (없으면 비워 두기)</small>
          <input value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, 4)); setErr(''); }} inputMode="numeric" placeholder="예: 4821" />
        </label>
        {err && (
          <div className="join-err">
            {err}
            <button type="button" className="btn ghost dark small" onClick={() => onJoin(team.trim(), klass.trim(), null)}>코드 없이 시작하기</button>
          </div>
        )}
        <p className="small-note">이름이나 학번은 적지 않아요. 입장하면 해 지기까지 시간이 흐르기 시작합니다.</p>
        <button className="btn big" disabled={!team.trim() || busy || (code && code.length < 4)}>{busy ? '확인 중…' : '입장'}</button>
      </form>
    </section>
  );
}

// ---------- 세책점 지도 ----------
const SPOTS = { silhak: [20, 48], geumseo: [43, 36], jangteo: [80, 48], sansu: [60, 70] };
const SPOTS_SECRET = { silhak: [15, 40], geumseo: [40, 34], jangteo: [85, 40], sansu: [63, 60], seogo: [26, 76] };
function MapScreen({ game, keys, onRoom, onGate, onRecord, update, mainDone }) {
  const secret = ROOMS.find((r) => r.hidden);
  const secretDone = roomDone(game, secret);
  const all = keys.length === ROOMS.length;
  const showReveal = mainDone && !game.secretSeen;
  const shown = ROOMS.filter((r) => !r.hidden || mainDone);
  return (
    <section className={`map ${mainDone ? 'compact' : ''}`} style={{ backgroundImage: 'url(art/map.webp)' }}>
      <div className="map-shade" />
      <div className="map-guide">
        <img src="art/strip_clue.webp" alt="단서는 모두 이 상자들 안에 있다" />
        <span>{mainDone ? '책장 뒤에 숨겨진 서고 창고가 열렸어요.' : '상자를 골라 들어가세요. 어떤 순서로 열어도 돼요.'}</span>
      </div>
      {shown.map((r) => {
        const done = roomDone(game, r);
        const solved = Object.values(game.rooms[r.id]?.puzzles || {}).filter((p) => p.done).length;
        const [x, y] = (mainDone ? SPOTS_SECRET : SPOTS)[r.id];
        return (
          <div key={r.id} className={`spot ${done ? 'done' : ''} ${r.hidden ? 'secret' : ''}`} style={{ left: `${x}%`, top: `${y}%` }}>
            <button className="chest" onClick={() => onRoom(r.id)}>
              <img src={r.hidden ? r.chest : done ? 'art/chest_open.webp' : r.chest} alt={`${r.name}${done ? ' (열림)' : ''}`} />
            </button>
            <div className="spot-label">
              <small>{r.hidden ? '숨겨진 방' : `${r.no}방`}</small>
              <strong>{r.name}</strong>
              <span className="dots">{r.puzzles.map((p, i) => <i key={i} className={i < solved ? 'on' : ''} />)}</span>
              {done && <button className="key-chip" onClick={() => onRecord(r.id)}>{mainDone ? `「${r.keyWord}」 기록` : `열쇠 「${r.keyWord}」 · 기록 보기`}</button>}
            </div>
          </div>
        );
      })}
      <button className={`gate-btn ${all ? 'ready' : ''}`} onClick={onGate} disabled={!all}>
        {all ? '대문으로 가기' : mainDone && !secretDone ? `대문: 열쇠 ${keys.length}/${ROOMS.length} · 숨겨진 창고를 살펴보세요` : `대문: 열쇠 ${keys.length}/${mainDone ? ROOMS.length : MAIN_ROOMS.length}`}
      </button>
      {showReveal && (
        <div className="modal-back">
          <div className="reveal">
            <img src="art/seogo_corridor.webp" alt="책장 사이로 이어진 어두운 통로" />
            <div className="reveal-text">
              <div className="reveal-kicker">네 개의 열쇠가 모두 모였다</div>
              <h3>책장이 스르륵 밀려나며, 숨겨진 서고 창고가 나타났다</h3>
              <p>대문을 열려면 다섯 번째 열쇠가 필요하다. 등불이 비추는 창고 안을 살펴보자.</p>
              <div className="row">
                <button className="btn" onClick={() => { update((g) => { g.secretSeen = true; return g; }); onRoom(secret.id); }}>창고로 들어가기</button>
                <button className="btn ghost" onClick={() => update((g) => { g.secretSeen = true; return g; })}>지도 먼저 보기</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- 숨겨진 서고 창고: 장면 속 단서 ----------
function Scene({ room, game, onBack, onPick, onRecord }) {
  const [note, setNote] = useState(!game.rooms[room.id]);
  const done = (pid) => !!game.rooms[room.id]?.puzzles?.[pid]?.done;
  const solved = room.puzzles.filter((p) => done(p.id)).length;
  const allDone = roomDone(game, room);
  return (
    <section className="room scene-room" >
      {/* 배경 주소를 CSS 변수로 넘기면 빌드 후 assets/ 기준으로 풀려 그림이 안 나오므로 바로 지정 */}
      <div className="room-bg" style={{ backgroundImage: `url(${room.bg})` }} />
      <div className="room-head">
        <button className="btn ghost small" onClick={onBack}>← 지도</button>
        <h2><span>숨겨진 방</span> {room.name}</h2>
        <div className="scene-progress">찾은 단서 <b>{solved}</b> / {room.puzzles.length}</div>
      </div>
      <div className="scene-wrap">
        <div className="scene" style={{ backgroundImage: `url(${room.scene})` }}>
          <button className="lantern-spot" style={{ left: `${room.lantern.x}%`, top: `${room.lantern.y}%` }} onClick={() => setNote(true)} aria-label="등불 옆 쪽지 읽기">
            <span className="lantern-ring" />
          </button>
          {room.spots.map((s) => {
            const p = room.puzzles.find((q) => q.id === s.puzzle);
            const d = done(s.puzzle);
            return (
              <button key={s.puzzle} className={`clue-spot ${d ? 'done' : ''}`} style={{ left: `${s.x}%`, top: `${s.y}%` }} onClick={() => onPick(s.puzzle)}>
                <span className="clue-ring"><ClueIcon kind={d ? 'check' : s.icon} /></span>
                <span className="clue-label">{s.label}<small>{d ? `열쇠 조각 「${p.piece}」` : p.title}</small></span>
              </button>
            );
          })}
        </div>
        <p className="scene-tip">{allDone ? '세 단서를 모두 찾았어요. 다섯 번째 열쇠 「' + room.keyWord + '」를 얻었습니다.' : '빛나는 곳을 누르면 단서를 살펴볼 수 있어요. 등불을 누르면 주인의 쪽지를 다시 읽어요.'}</p>
        {allDone && <button className="btn" onClick={onRecord}>세책점 주인의 기록 보기</button>}
      </div>
      {note && (
        <div className="modal-back" onClick={() => setNote(false)}>
          <div className="note-paper small-note-paper" style={{ backgroundImage: 'url(art/paper.webp)' }} onClick={(e) => e.stopPropagation()}>
            <p><T>{room.intro}</T></p>
            <button className="btn" onClick={() => setNote(false)}>창고 살펴보기</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- 방 ----------
function Room({ room, game, update, onBack, onDone, startPid = null, sceneMode = false }) {
  const rs = game.rooms[room.id];
  const firstOpen = room.puzzles.findIndex((p) => !rs?.puzzles?.[p.id]?.done);
  const startIdx = startPid ? room.puzzles.findIndex((p) => p.id === startPid) : -1;
  const [pi, setPi] = useState(startIdx >= 0 ? startIdx : firstOpen === -1 ? 0 : firstOpen);
  const puzzle = room.puzzles[pi];
  const ps = rs?.puzzles?.[puzzle.id];
  const stepIdx = ps?.done ? puzzle.steps.length - 1 : ps?.step || 0;
  const step = puzzle.steps[stepIdx];
  const [hintOpen, setHintOpen] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [zoom, setZoom] = useState(null);
  const [piece, setPiece] = useState(null);
  const tries = useRef(0);

  useEffect(() => { setHintOpen(0); setFeedback(null); tries.current = 0; }, [pi, stepIdx]);
  useEffect(() => { update((g) => { ensurePuzzle(g, room.id, puzzle.id); return g; }); }, [room.id, puzzle.id, update]);

  const onResult = (ok, summary) => {
    const first = tries.current === 0;
    tries.current += 1;
    update((g) => {
      const p = ensurePuzzle(g, room.id, puzzle.id);
      if (first) p.firstTry[stepIdx] = { ok, answer: summary };
      if (!ok) {
        p.wrong += 1;
        p.miss = (p.miss || 0) + 1;
        if (WRONG_LIMIT && p.miss >= WRONG_LIMIT) { g.outcome = 'arrested'; g.arrest = { room: room.id, puzzle: puzzle.id, at: Date.now() }; }
        return g;
      }
      p.miss = 0;
      if (stepIdx + 1 < puzzle.steps.length) { p.step = stepIdx + 1; return g; }
      p.done = true; p.endAt = Date.now();
      const r = g.rooms[room.id];
      if (room.puzzles.every((q) => r.puzzles[q.id]?.done)) { r.done = true; r.doneAt = Date.now(); }
      return g;
    });
    if (!ok) { setFeedback({ ok: false, danger: true, text: dangerText((ps?.miss || 0) + 1) }); return; }
    if (stepIdx + 1 < puzzle.steps.length) { setFeedback({ ok: true, text: '맞았어요! 다음 질문으로 넘어가요.' }); return; }
    setPiece(puzzle.piece);
    setFeedback(null);
  };

  const afterPiece = () => {
    setPiece(null);
    const next = room.puzzles.findIndex((p, i) => i !== pi && !game.rooms[room.id]?.puzzles?.[p.id]?.done);
    if (next === -1) onDone(); else if (sceneMode) onBack(); else setPi(next);
  };

  const openHint = () => {
    const n = Math.min(2, hintOpen + 1);
    if (n > hintOpen) update((g) => { ensurePuzzle(g, room.id, puzzle.id).hints += 1; return g; });
    setHintOpen(n);
  };

  const hints = step.hints || [];
  const visual = step.type === 'hotspot' || step.type === 'jigsaw';
  return (
    <section className="room">
      {/* 배경 주소를 CSS 변수로 넘기면 빌드 후 assets/ 기준으로 풀려 그림이 안 나오므로 바로 지정 */}
      <div className="room-bg" style={{ backgroundImage: `url(${room.bg})` }} />
      <div className="room-head">
        <button className="btn ghost small" onClick={onBack}>{sceneMode ? '← 창고' : '← 지도'}</button>
        <img className="room-chest" src={room.chest} alt="" />
        <h2><span>{room.hidden ? '숨겨진 방' : `${room.no}방`}</span> {sceneMode ? puzzle.title : room.name}</h2>
        <div className="tabs" hidden={sceneMode}>
          {room.puzzles.map((p, i) => {
            const d = rs?.puzzles?.[p.id]?.done;
            return (
              <button key={p.id} className={`tab ${i === pi ? 'on' : ''} ${d ? 'done' : ''}`} onClick={() => setPi(i)}>
                {p.id} {p.title}{d ? ' ✓' : ''}
              </button>
            );
          })}
        </div>
      </div>
      <div className={`room-body ${visual ? 'visual' : ''}`}>
        <div className="sources">
          {visual ? (
            <div className="visual-step">
              <Step key={`${puzzle.id}-${stepIdx}`} step={step} onResult={onResult} locked={!!ps?.done} />
            </div>
          ) : (
            <>
              {puzzle.sources.map((s, i) => <SourceCard key={i} s={s} zoom={setZoom} />)}
              <p className="art-note">배경 그림은 이야기를 위한 상상 그림이에요. 사료는 종이 카드와 액자 속 자료예요.</p>
            </>
          )}
        </div>
        <div className="question">
          <div className="step-count">
            질문 {stepIdx + 1} / {puzzle.steps.length}
            {!ps?.done && WRONG_LIMIT > 0 && <Chances miss={ps?.miss || 0} />}
          </div>
          <p className="q"><T>{step.q}</T></p>
          <StepWords step={step} />
          {!visual && <Step key={`${puzzle.id}-${stepIdx}`} step={step} onResult={onResult} locked={!!ps?.done} />}
          {visual && puzzle.sources.filter((s) => s.type !== 'image').map((s, i) => <div key={i} className="side-source"><SourceCard s={s} /></div>)}
          {feedback && <div key={feedback.danger ? `d${ps?.miss}` : 'f'} className={`feedback ${feedback.ok ? 'ok' : 'no'} ${feedback.danger ? 'danger' : ''}`}>{feedback.text}</div>}
          {ps?.done && <div className="feedback ok">이 퍼즐은 풀었어요. 열쇠 조각 「{puzzle.piece}」</div>}
          {!ps?.done && hints.length > 0 && (
            <div className="hints">
              {hintOpen < 2 && <button className="btn ghost small" onClick={openHint}>힌트 {hintOpen + 1} 열기</button>}
              {hints.slice(0, hintOpen).map((h, i) => <div key={i} className="hint"><b>힌트 {i + 1}</b> <T>{h}</T></div>)}
            </div>
          )}
        </div>
      </div>
      {zoom && <Zoom srcKey={zoom.key} caption={zoom.caption} onClose={() => setZoom(null)} />}
      {piece && (
        <div className="modal-back" onClick={afterPiece}>
          <div className="piece-pop">
            <div className="piece-label">열쇠 조각</div>
            <div className="piece-word">{piece}</div>
            <button className="btn">계속</button>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- 오답 경고 ----------
const WRONG_LIMIT = SETTINGS.wrongLimit ?? 3;
const DANGER = [
  '어디선가 발소리가 들린다… 포졸이 세책점 골목으로 들어섰다!',
  '횃불 빛이 창호지에 어른거린다! 포졸이 문 앞까지 왔다!',
];
function dangerText(miss) {
  const left = WRONG_LIMIT - miss;
  if (left <= 0) return '포졸이 문을 박차고 들어왔다!';
  const msg = DANGER[Math.min(miss - 1, DANGER.length - 1)];
  return left === 1 ? `${msg} 한 번만 더 틀리면 붙잡혀요.` : `${msg} 남은 기회 ${left}번. 사료를 다시 살펴보세요.`;
}
function Chances({ miss }) {
  const left = Math.max(0, WRONG_LIMIT - miss);
  return (
    <span className={`chances ${left <= 1 ? 'last' : ''}`} title={`이 질문에서 남은 기회 ${left}번`}>
      남은 기회 {Array.from({ length: WRONG_LIMIT }, (_, i) => <i key={i} className={i < left ? 'on' : ''} />)}
    </span>
  );
}

// ---------- 세책점 주인의 기록 ----------
function RecordModal({ room, onClose }) {
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="record" onClick={(e) => e.stopPropagation()} style={{ backgroundImage: 'url(art/paper.webp)' }}>
        <div className="record-head">세책점 주인의 기록 · {room.no}방 {room.name}</div>
        <p className="record-body"><T>{room.record}</T></p>
        <div className="record-key">
          <span>열쇠</span><strong>{room.keyWord}</strong>
          <small>{room.keyNote}</small>
        </div>
        <span className="record-seal" aria-hidden="true">冊</span>
        <button className="btn" onClick={onClose}>지도로 돌아가기</button>
      </div>
    </div>
  );
}

// ---------- 대문과 최종 결론 ----------
const CONCLUSION = FINAL.conclusion.map((c) => c.text).join(' ');
function Gate({ game, update, settings, onBack }) {
  const inserted = game.inserted || [];
  const allIn = ROOMS.every((r) => inserted.includes(r.id));
  const text = CONCLUSION;
  const [check, setCheck] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [comment, setComment] = useState('');
  const [shown, setShown] = useState(game.final.attempts.length || game.final.submitted ? FINAL.conclusion.length : 0);
  const last = game.final.attempts.at(-1);
  const waiting = game.final.submitted;
  const remote = !!game.classCode;
  const insert = (id) => update((g) => { if (!g.inserted.includes(id)) g.inserted.push(id); return g; });

  // 열쇠를 다 꽂으면 결론이 한 구절씩 나타난다
  useEffect(() => {
    if (!allIn || shown >= FINAL.conclusion.length) return;
    const t = setTimeout(() => setShown((n) => n + 1), shown === 0 ? 700 : 1300);
    return () => clearTimeout(t);
  }, [allIn, shown]);

  // 수업 코드로 들어왔으면 진행판(교사 화면)으로 제출, 아니면 이 태블릿에서 선생님 PIN으로 확인
  const submit = () => {
    if (!remote) { setCheck(true); return; }
    update((g) => { g.final.text = text; g.final.submitted = { text, at: Date.now() }; return g; });
  };

  const decide = (pass) => {
    update((g) => {
      g.final.text = text;
      g.final.attempts.push({ text, pass, comment, at: Date.now() });
      if (pass) { g.final.passed = true; g.outcome = 'escaped'; g.escapedAt = Date.now(); }
      return g;
    });
    setCheck(false); setUnlocked(false); setComment('');
  };

  return (
    <section className="gate" style={{ backgroundImage: 'url(art/gate.webp)' }}>
      <div className="map-shade" />
      <button className="btn ghost small back" onClick={onBack}>← 지도</button>
      {!allIn ? (
        <div className="gate-panel">
          <h2>대문 자물쇠</h2>
          <p>모은 열쇠를 하나씩 눌러 자물쇠에 꽂으세요.</p>
          <div className="slots">
            {ROOMS.map((r) => (
              <div key={r.id} className={`slot ${inserted.includes(r.id) ? 'in' : ''}`}>
                <RoomIcon kind={r.icon} />
                <span>{inserted.includes(r.id) ? r.keyWord : '　'}</span>
              </div>
            ))}
          </div>
          <div className="key-row">
            {ROOMS.filter((r) => !inserted.includes(r.id)).map((r) => (
              <button key={r.id} className="key-btn" onClick={() => insert(r.id)}>{r.keyWord}</button>
            ))}
          </div>
        </div>
      ) : (
        <div className="gate-panel paper-sheet" style={{ backgroundImage: 'url(art/paper.webp)' }}>
          <h2>다섯 열쇠가 말하는 결론</h2>
          <div className="keys-recap">{ROOMS.map((r) => <span key={r.id}>{r.name} · 「{r.keyWord}」</span>)}</div>
          <div className="conclusion">
            {FINAL.conclusion.map((c, i) => (
              <p key={i} className={`conclusion-line ${i < shown ? 'on' : ''}`}>
                <span>{c.text}</span>
                <small>{c.keys.map((k) => `「${k}」`).join(' ')}</small>
              </p>
            ))}
          </div>
          {shown >= FINAL.conclusion.length && (
            waiting ? (
              <div className="feedback wait">결론을 냈어요. 선생님 화면에서 확인을 기다리는 중…</div>
            ) : (
              <>
                {last && !last.pass && (
                  <div className="feedback no">선생님: 다시 생각해 보기{last.comment ? ` — ${last.comment}` : ''}</div>
                )}
                <p className="small-note">모둠이 함께 결론을 소리 내어 읽고, 맞다고 생각하면 제출하세요.</p>
                <button className="btn big" onClick={submit}>결론 제출하기</button>
              </>
            )
          )}
        </div>
      )}
      {check && !unlocked && (
        <PinModal title="선생님 확인" pin={settings.pin} onOk={() => setUnlocked(true)} onCancel={() => setCheck(false)}>
          <p>선생님이 PIN을 넣으면 모둠의 결론을 확인할 수 있어요.</p>
        </PinModal>
      )}
      {check && unlocked && (
        <div className="modal-back">
          <div className="modal paper-dark">
            <h3>{game.team}의 결론</h3>
            <blockquote>{text}</blockquote>
            <input placeholder="한마디 (다시 생각해 보기를 줄 때)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="row">
              <button className="btn ghost" onClick={() => decide(false)}>다시 생각해 보기</button>
              <button className="btn" onClick={() => decide(true)}>통과 — 대문 열기</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------- 결과 ----------
function Summary({ game }) {
  const st = useMemo(() => {
    let hints = 0, wrong = 0, solved = 0;
    for (const r of Object.values(game.rooms)) for (const p of Object.values(r.puzzles)) { hints += p.hints; wrong += p.wrong; solved += p.done ? 1 : 0; }
    return { hints, wrong, solved };
  }, [game]);
  const used = (game.escapedAt || Date.now()) - game.startedAt;
  return (
    <div className="summary">
      <div><b>{fmtTime(used)}</b><span>걸린 시간</span></div>
      <div><b>{st.solved}/{TOTAL_PUZZLES}</b><span>푼 퍼즐</span></div>
      <div><b>{st.hints}</b><span>힌트</span></div>
    </div>
  );
}

function Escaped({ game, onRecord, recordOf, onReset }) {
  return (
    <section className="ending" style={{ backgroundImage: 'url(art/escape.webp)' }}>
      <div className="ending-panel">
        <h1>탈출 성공!</h1>
        <p>{game.team}은(는) 해가 지기 전에 세책점의 대문을 열었다.</p>
        <Summary game={game} />
        <div className="record-btns">{ROOMS.map((r) => <button key={r.id} className="btn ghost small" onClick={() => onRecord(r.id)}>{r.name} 기록</button>)}</div>
        <p className="small-note">선생님과 함께 네 방의 기록을 정리해 보세요.</p>
        <ConfirmButton label="처음으로" confirmLabel="정말 기록을 지우고 처음으로" onConfirm={onReset} />
      </div>
      {recordOf && <RecordModal room={ROOMS.find((r) => r.id === recordOf)} onClose={() => onRecord(null)} />}
    </section>
  );
}

function Caught({ game, settings, update, onRecord, recordOf }) {
  const [pin, setPin] = useState(false);
  const opened = ROOMS.filter((r) => roomDone(game, r));
  return (
    <section className="ending caught" style={{ backgroundImage: 'url(art/caught.webp)' }}>
      <div className="ending-panel">
        <h1>해가 졌다… 포졸이 도착했다</h1>
        <p>그래도 연 상자의 기록은 남아 있어요. 다시 도전하려면 선생님께 시간을 받아요.</p>
        <Summary game={game} />
        <div className="record-btns">
          {opened.length === 0 && <span className="small-note">아직 연 상자가 없어요.</span>}
          {opened.map((r) => <button key={r.id} className="btn ghost small" onClick={() => onRecord(r.id)}>{r.name} 기록</button>)}
        </div>
        <div className="row center">
          {game.classCode && <TimeRequest game={game} update={update} settings={settings} big />}
          <button className={game.classCode ? 'btn ghost' : 'btn'} onClick={() => setPin(true)}>선생님: 5분 더 주기</button>
        </div>
      </div>
      {pin && (
        <PinModal title="시간 더 주기" pin={settings.pin} onCancel={() => setPin(false)}
          onOk={() => { update((g) => { g.outcome = null; g.addedMinutes = (g.addedMinutes || 0) + 5; g.endAt = Date.now() + 5 * 60000; return g; }); setPin(false); }}>
          <p>5분이 추가되고 하던 곳에서 이어집니다.</p>
        </PinModal>
      )}
      {recordOf && <RecordModal room={ROOMS.find((r) => r.id === recordOf)} onClose={() => onRecord(null)} />}
    </section>
  );
}

// ---------- 5분 추가 요청 ----------
// 수업 코드로 들어왔으면 모둠 진행판(교사 화면)에 알림이 가고, 선생님이 누르면 5분이 더해진다.
// 수업 코드 없이 하면 이 태블릿에서 선생님이 PIN을 넣어 바로 5분을 더한다
function TimeRequest({ game, update, settings, big = false }) {
  const [pin, setPin] = useState(false);
  const pending = !!game.timeReq;
  const ask = () => {
    if (!game.classCode) { setPin(true); return; }
    update((g) => { g.timeReq = { at: Date.now() }; return g; });
  };
  const cls = big ? 'btn' : `nav-btn time-req ${pending ? 'pending' : ''}`;
  return (
    <>
      <button className={cls} onClick={ask} disabled={pending} title={pending ? '선생님 확인을 기다리는 중' : '선생님께 5분 더 달라고 요청'}>
        <i aria-hidden="true">⏳</i> <span>{pending ? '5분 요청 보냄' : '5분 추가 요청'}</span>
      </button>
      {pin && (
        <PinModal title="5분 추가" pin={settings.pin} onCancel={() => setPin(false)}
          onOk={() => { update((g) => { g.outcome = g.outcome === 'caught' ? null : g.outcome; g.addedMinutes = (g.addedMinutes || 0) + 5; g.endAt = Math.max(g.endAt || 0, Date.now()) + 5 * 60000; return g; }); setPin(false); }}>
          <p>선생님이 PIN을 넣으면 5분이 더해져요.</p>
        </PinModal>
      )}
    </>
  );
}

function Arrested({ game, settings, update }) {
  const [pin, setPin] = useState(false);
  const p = ROOMS.flatMap((r) => r.puzzles).find((q) => q.id === game.arrest?.puzzle);
  const retry = () => {
    update((g) => {
      const a = g.arrest;
      const ps = a && g.rooms[a.room]?.puzzles?.[a.puzzle];
      if (ps) ps.miss = 0;
      g.outcome = null;
      g.arrests = (g.arrests || 0) + 1;
      return g;
    });
    setPin(false);
  };
  return (
    <section className="ending caught arrested" style={{ backgroundImage: 'url(art/caught.webp)' }}>
      <div className="ending-panel">
        <h1>포졸들에게 붙잡혔다!</h1>
        <p>"게 섰거라! 금서를 뒤지던 자들이 바로 너희로구나!"</p>
        <p>{game.team}은(는) 어림짐작으로 답을 고르다 포도청으로 끌려갔다.{p ? ` (${p.id} ${p.title}에서 ${WRONG_LIMIT}번 틀림)` : ''}</p>
        <Summary game={game} />
        <p className="small-note">답은 찍는 것이 아니라 사료에서 찾는 것. 선생님께 다시 기회를 받으면 그 질문부터 이어서 할 수 있어요.</p>
        <button className="btn" onClick={() => setPin(true)}>선생님: 다시 기회 주기</button>
      </div>
      {pin && (
        <PinModal title="다시 기회 주기" pin={settings.pin} onCancel={() => setPin(false)} onOk={retry}>
          <p>잡힌 질문의 기회가 다시 {WRONG_LIMIT}번으로 채워지고 하던 곳에서 이어집니다. 제한 시간은 그대로 흘러요.</p>
        </PinModal>
      )}
    </section>
  );
}

export function ConfirmButton({ label, confirmLabel, onConfirm, className = 'btn ghost small' }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return (
    <button className={armed ? 'btn danger small' : className} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}
