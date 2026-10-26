import { useState } from 'react';
import { ROOMS, FINAL, SOURCE_FILES, STANDARDS } from './data/game.js';
import { useGame, useSettings, fmtTime, useImageOk } from './lib/store.js';
import { PinModal, plain } from './components/common.jsx';
import { ConfirmButton } from './App.jsx';

function SourceStatus({ k }) {
  const meta = SOURCE_FILES[k];
  const ok = useImageOk(meta.file);
  return (
    <tr>
      <td>{meta.label}</td>
      <td><code>public/sources/{meta.file}</code></td>
      <td className={ok ? 'okc' : 'noc'}>{ok === null ? '확인 중' : ok ? '있음' : '없음'}</td>
    </tr>
  );
}

export default function Teacher() {
  const [settings, setSettings] = useSettings();
  const [game, update, reset] = useGame();
  const [authed, setAuthed] = useState(() => {
    try { return sessionStorage.getItem('sechaek-teacher') === '1'; } catch { return false; }
  });
  const pass = () => { try { sessionStorage.setItem('sechaek-teacher', '1'); } catch { /* 저장 불가 환경 */ } setAuthed(true); };
  const goHome = () => { location.hash = '#cover'; };
  const [minutes, setMinutes] = useState(settings.minutes);
  const [pin, setPin] = useState(settings.pin);
  const [saved, setSaved] = useState(false);

  if (!authed) {
    return (
      <div className="teacher-gate">
        <PinModal title="교사 화면" pin={settings.pin} onOk={pass} onCancel={goHome}>
          <p>처음 PIN은 1860이에요. 들어가서 바꿀 수 있어요.</p>
        </PinModal>
      </div>
    );
  }

  const rows = [];
  for (const r of ROOMS) for (const p of r.puzzles) {
    const s = game.rooms[r.id]?.puzzles?.[p.id];
    rows.push({ r, p, s });
  }

  return (
    <div className="teacher">
      <header className="teacher-head no-print">
        <h1>교사 화면 · 한양 세책점의 비밀</h1>
        <div className="row">
          <button className="btn ghost small" onClick={goHome}>첫 화면으로</button>
          <button className="btn ghost small" onClick={() => { location.hash = ''; }}>게임 화면으로</button>
          <button className="btn ghost small" onClick={() => { try { sessionStorage.removeItem('sechaek-teacher'); } catch { /* */ } goHome(); }}>잠그고 나가기</button>
        </div>
      </header>

      <section className="t-card no-print">
        <h2>설정</h2>
        <div className="t-form">
          <label>제한 시간(분)<input type="number" min="5" max="90" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
          <label>교사 PIN<input value={pin} onChange={(e) => setPin(e.target.value)} /></label>
          <button className="btn small" onClick={() => { setSettings({ minutes, pin: pin || '1860' }); setSaved(true); }}>저장</button>
          {saved && <span className="okc">저장했어요. 새로 입장하는 모둠부터 적용돼요.</span>}
        </div>
        <p className="small-note">이 설정은 이 기기에만 저장돼요. 모둠 태블릿마다 한 번씩 저장해 주세요. 여러 기기를 한 화면에서 보는 진행판은 다음 단계(Cloudflare D1)에서 붙일 예정이에요.</p>
      </section>

      <section className="t-card print-area">
        <h2>모둠 기록 — {game.team || '(입장 전)'} {game.klass && `· ${game.klass}반`}</h2>
        {game.startedAt && (
          <p>시작 {new Date(game.startedAt).toLocaleTimeString('ko-KR')} · 결과 {game.outcome === 'escaped' ? `탈출 (${fmtTime(game.escapedAt - game.startedAt)})` : game.outcome === 'caught' ? '시간 초과' : '진행 중'}{game.addedMinutes ? ` · 추가 시간 ${game.addedMinutes}분` : ''}</p>
        )}
        <table className="t-table">
          <thead><tr><th>퍼즐</th><th>첫 답</th><th>오답</th><th>힌트</th><th>걸린 시간</th><th>상태</th></tr></thead>
          <tbody>
            {rows.map(({ r, p, s }) => (
              <tr key={p.id}>
                <td>{r.no}방 {p.id} {p.title}</td>
                <td>{s?.firstTry?.length ? s.firstTry.map((f, i) => <span key={i} className={f?.ok ? 'okc' : 'noc'}>{f?.ok ? '○' : '×'} </span>) : '-'}</td>
                <td>{s?.wrong ?? '-'}</td>
                <td>{s?.hints ?? '-'}</td>
                <td>{s?.endAt ? fmtTime(s.endAt - s.startAt) : '-'}</td>
                <td>{s?.done ? '완료' : s ? '푸는 중' : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3>최종 질문</h3>
        <p className="small-note">{plain(FINAL.question)}</p>
        {game.final.attempts.length === 0 && <p>아직 답을 내지 않았어요.</p>}
        {game.final.attempts.map((a, i) => (
          <div key={i} className="t-answer">
            <b>{i + 1}차 · {a.pass ? '통과' : '다시 생각해 보기'}</b> {a.text}
            {a.comment && <div className="small-note">교사 한마디: {a.comment}</div>}
          </div>
        ))}
        <p className="small-note">성취기준 {STANDARDS.join(' / ')}</p>
      </section>

      <section className="t-card no-print">
        <div className="row">
          <button className="btn" onClick={() => print()}>모둠 기록 인쇄·PDF 저장</button>
          <button className="btn ghost" onClick={() => update((g) => { g.endAt = (g.endAt || Date.now()) + 5 * 60000; g.addedMinutes = (g.addedMinutes || 0) + 5; if (g.outcome === 'caught') g.outcome = null; return g; })}>이 모둠 5분 추가</button>
          <ConfirmButton className="btn ghost" label="기록 지우고 새 모둠 받기" confirmLabel="한 번 더 누르면 이 기기 기록이 지워져요" onConfirm={reset} />
        </div>
      </section>

      <section className="t-card no-print">
        <h2>사료 그림 상태</h2>
        <table className="t-table">
          <tbody>{Object.keys(SOURCE_FILES).map((k) => <SourceStatus key={k} k={k} />)}</tbody>
        </table>
        <p className="small-note">그림이 없으면 학생 화면에 '사료 그림 자리'가 보이고, 씨름 위치 찾기는 고르기 문제로, 조각 맞추기는 번호 조각으로 바뀌어요.</p>
      </section>

      <section className="t-card no-print">
        <h2>정리 시간에 덧붙일 내용</h2>
        <ul>{ROOMS.filter((r) => r.teacherNote).map((r) => <li key={r.id}>{r.name}: {r.teacherNote}</li>)}</ul>
        <p className="small-note">「씨름」 위치 찾기의 정답 영역은 src/data/game.js 의 region 값(그림 전체를 100으로 본 x, y, 너비, 높이)으로 조정해요.</p>
      </section>
    </div>
  );
}
