import { useState, createContext, useContext } from 'react';
import { GLOSSARY, SOURCE_FILES } from '../data/game.js';
import { useImageOk } from '../lib/store.js';

// ---------- 낱말 풀이 ----------
const GlossCtx = createContext(() => {});
export function GlossProvider({ children }) {
  const [word, setWord] = useState(null);
  return (
    <GlossCtx.Provider value={setWord}>
      {children}
      {word && (
        <div className="gloss-pop" role="dialog" onClick={() => setWord(null)}>
          <div className="gloss-card" onClick={(e) => e.stopPropagation()}>
            <div className="gloss-word">{word}</div>
            <p>{GLOSSARY[word] || '뜻을 준비 중이에요.'}</p>
            <button className="btn small" onClick={() => setWord(null)}>알겠어요</button>
          </div>
        </div>
      )}
    </GlossCtx.Provider>
  );
}

export function T({ children, inert = false }) {
  const open = useContext(GlossCtx);
  const text = String(children ?? '');
  const parts = text.split(/(\{\{[^}]+\}\})/g);
  return (
    <>
      {parts.map((p, i) => {
        const m = p.match(/^\{\{(.+)\}\}$/);
        if (m && inert) return <b key={i} className="gloss-inert">{m[1]}</b>;
        if (m) {
          return (
            <button key={i} className="gloss" onClick={(e) => { e.stopPropagation(); open(m[1]); }}>
              {m[1]}
            </button>
          );
        }
        return p.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
        ));
      })}
    </>
  );
}
export const plain = (s) => String(s).replace(/\{\{([^}]+)\}\}/g, '$1');

// ---------- 해 지기까지 남은 시간 ----------
export function SunBar({ left, total }) {
  const p = Math.max(0, Math.min(1, left / total));
  const mm = String(Math.floor(Math.max(0, left) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((Math.max(0, left) % 60000) / 1000)).padStart(2, '0');
  return (
    <div className={`sunbar ${p < 0.2 ? 'urgent' : ''}`} aria-label={`해 지기까지 ${mm}분 ${ss}초`}>
      <span className="sunbar-label">해 지기까지</span>
      <div className="sunbar-track"><div className="sunbar-fill" style={{ width: `${p * 100}%` }} /></div>
      <span className="sunbar-time">{mm}:{ss}</span>
    </div>
  );
}

// ---------- 사료 카드 ----------
export function SourceImage({ srcKey, caption, onClick, children }) {
  const meta = SOURCE_FILES[srcKey];
  const ok = useImageOk(meta?.file);
  if (ok) {
    return (
      <figure className="source-img">
        <div className="source-img-wrap" onClick={onClick}>
          <img src={`sources/${meta.file}`} alt={meta.label} />
          {children}
        </div>
        <figcaption><T inert>{caption || meta.label}</T>{meta.credit && <small className="credit">{meta.credit}</small>}</figcaption>
      </figure>
    );
  }
  return (
    <figure className="source-img missing">
      <div className="source-missing">
        <strong>사료 그림 자리</strong>
        <span>{meta?.label}</span>
        <code>public/sources/{meta?.file}</code>
        {ok === null && <em>불러오는 중…</em>}
      </div>
      <figcaption>{plain(caption || meta?.label || '')}</figcaption>
    </figure>
  );
}

export function SourceCard({ s, zoom }) {
  if (s.type === 'image') {
    return <SourceImage srcKey={s.src} caption={s.caption} onClick={() => zoom?.({ key: s.src, caption: s.caption })} />;
  }
  if (s.type === 'table') {
    return (
      <div className="paper">
        <div className="paper-title">{s.title}</div>
        <table className="ledger">
          <thead><tr>{s.head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{s.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><T>{c}</T></td>)}</tr>)}</tbody>
        </table>
        {s.note && <div className="paper-note">{s.note}</div>}
      </div>
    );
  }
  return (
    <div className="paper">
      {s.title && <div className="paper-title">{s.title}</div>}
      <p className="paper-body"><T>{s.body}</T></p>
      {s.cite && <div className="paper-cite">— {s.cite}</div>}
      {s.note && <div className="paper-note">{s.note}</div>}
    </div>
  );
}

export function Zoom({ srcKey, caption, onClose }) {
  const meta = SOURCE_FILES[srcKey];
  return (
    <div className="zoom" onClick={onClose}>
      <img src={`sources/${meta.file}`} alt={plain(caption || meta.label)} onClick={(e) => e.stopPropagation()} />
      <div className="zoom-cap">{plain(caption || meta.label)} · 두 손가락으로 확대할 수 있어요 · 바깥을 누르면 닫혀요</div>
    </div>
  );
}

// ---------- 교사 PIN ----------
export function PinModal({ title, pin, onOk, onCancel, children }) {
  const [v, setV] = useState('');
  const [err, setErr] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    if (v === pin) onOk(); else { setErr(true); setV(''); }
  };
  return (
    <div className="modal-back">
      <form className="modal paper-dark" onSubmit={submit}>
        <h3>{title}</h3>
        {children}
        <label className="pin-label">교사 PIN
          <input type="password" inputMode="numeric" autoFocus value={v} onChange={(e) => { setV(e.target.value); setErr(false); }} />
        </label>
        {err && <div className="err">PIN이 맞지 않아요.</div>}
        <div className="row">
          <button type="button" className="btn ghost" onClick={onCancel}>닫기</button>
          <button className="btn">확인</button>
        </div>
      </form>
    </div>
  );
}

// 퍼즐 단계 안(선택지·카드)에 들어 있는 낱말을 모아 칩으로 보여 줌
export function StepWords({ step }) {
  const open = useContext(GlossCtx);
  const texts = [];
  const walk = (v) => {
    if (typeof v === 'string') texts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.entries(v).forEach(([k, x]) => k !== 'q' && k !== 'hints' && walk(x));
  };
  walk(step);
  const words = [...new Set(texts.join(' ').match(/\{\{([^}]+)\}\}/g)?.map((w) => w.slice(2, -2)) || [])];
  if (!words.length) return null;
  return (
    <div className="step-words">
      <span>이 문제의 낱말</span>
      {words.map((w) => <button key={w} className="word-chip" onClick={() => open(w)}>{w}</button>)}
    </div>
  );
}
