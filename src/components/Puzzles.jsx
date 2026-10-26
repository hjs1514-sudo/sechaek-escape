import { useMemo, useState, useEffect } from 'react';
import { T, plain, SourceImage } from './common.jsx';
import { SOURCE_FILES } from '../data/game.js';
import { shuffle, useImageOk } from '../lib/store.js';

// 모든 퍼즐은 onResult(correct:boolean, answerSummary:string) 을 부릅니다.

export function Choice({ step, onResult, locked }) {
  const [picked, setPicked] = useState(null);
  const [wrongs, setWrongs] = useState([]);
  useEffect(() => { setPicked(null); setWrongs([]); }, [step]);
  const choose = (i) => {
    if (locked) return;
    setPicked(i);
    const ok = i === step.answer;
    if (!ok) setWrongs((w) => [...w, i]);
    onResult(ok, plain(step.options[i]));
  };
  return (
    <div className="choices">
      {step.options.map((o, i) => (
        <button
          key={i}
          className={`choice ${picked === i && i === step.answer ? 'right' : ''} ${wrongs.includes(i) ? 'wrong' : ''}`}
          onClick={() => choose(i)}
          disabled={locked || wrongs.includes(i)}
        >
          <span className="choice-no">{'①②③④⑤⑥'[i]}</span>
          <span><T inert>{o}</T></span>
        </button>
      ))}
    </div>
  );
}

export function Match({ step, onResult, locked }) {
  const [sel, setSel] = useState(null);
  const [pairs, setPairs] = useState({}); // left -> right
  const [bad, setBad] = useState([]);
  const rightOrder = useMemo(() => shuffle(step.right, 11), [step]);
  const usedRight = Object.values(pairs);
  const pickRight = (ri) => {
    if (sel === null || locked) return;
    const next = { ...pairs };
    for (const k of Object.keys(next)) if (next[k] === ri) delete next[k];
    next[sel] = ri;
    setPairs(next); setSel(null); setBad([]);
  };
  const check = () => {
    const wrong = step.left.map((_, i) => i).filter((i) => pairs[i] !== step.answer[i]);
    setBad(wrong);
    onResult(wrong.length === 0, step.left.map((l, i) => `${l}→${plain(step.right[pairs[i]] ?? '?')}`).join(', '));
  };
  return (
    <div className="match">
      <div className="match-cols">
        <div className="match-col">
          {step.left.map((l, i) => (
            <button key={i} className={`match-item ${sel === i ? 'sel' : ''} ${pairs[i] !== undefined ? 'paired' : ''} ${bad.includes(i) ? 'wrong' : ''}`}
              onClick={() => !locked && setSel(i)}>
              <span><T inert>{l}</T></span>
              {pairs[i] !== undefined && <small>→ {plain(step.right[pairs[i]])}</small>}
            </button>
          ))}
        </div>
        <div className="match-col">
          {rightOrder.map(([r, ri]) => (
            <button key={ri} className={`match-item right-side ${usedRight.includes(ri) ? 'used' : ''}`} onClick={() => pickRight(ri)} disabled={sel === null}>
              <span><T inert>{r}</T></span>
            </button>
          ))}
        </div>
      </div>
      <p className="howto">왼쪽 카드를 누른 뒤, 짝이 되는 오른쪽 카드를 누르세요.</p>
      <button className="btn" disabled={locked || Object.keys(pairs).length < step.left.length} onClick={check}>연결 확인</button>
    </div>
  );
}

export function Order({ step, onResult, locked }) {
  const pool = useMemo(() => shuffle(step.items, 5), [step]);
  const [seq, setSeq] = useState([]);
  const [bad, setBad] = useState(false);
  const add = (i) => { if (!locked && !seq.includes(i)) { setSeq([...seq, i]); setBad(false); } };
  const check = () => {
    const ok = seq.every((v, k) => v === k);
    setBad(!ok);
    onResult(ok, seq.map((i) => i + 1).join('-'));
    if (!ok) setTimeout(() => setSeq([]), 900);
  };
  return (
    <div className="order">
      <div className="order-slots">
        {step.items.map((_, k) => (
          <div key={k} className={`order-slot ${bad ? 'wrong' : ''}`}>
            <span className="order-no">{k + 1}</span>
            {seq[k] !== undefined ? <span><T inert>{step.items[seq[k]]}</T></span> : <em>카드를 눌러 놓으세요</em>}
          </div>
        ))}
      </div>
      <div className="order-pool">
        {pool.map(([it, i]) => (
          <button key={i} className="card-btn" disabled={seq.includes(i) || locked} onClick={() => add(i)}><T inert>{it}</T></button>
        ))}
      </div>
      <div className="row">
        <button className="btn ghost" onClick={() => setSeq([])} disabled={locked}>처음부터</button>
        <button className="btn" disabled={locked || seq.length < step.items.length} onClick={check}>순서 확인</button>
      </div>
    </div>
  );
}

export function Classify({ step, onResult, locked }) {
  const items = useMemo(() => shuffle(step.items, 3), [step]);
  const [put, setPut] = useState({}); // idx -> bin
  const [bad, setBad] = useState([]);
  const check = () => {
    const wrong = step.items.map((_, i) => i).filter((i) => put[i] !== step.items[i].bin);
    setBad(wrong);
    onResult(wrong.length === 0, `틀린 카드 ${wrong.length}장`);
  };
  return (
    <div className="classify">
      {items.map(([it, i]) => (
        <div key={i} className={`classify-row ${bad.includes(i) ? 'wrong' : ''}`}>
          <span className="classify-text"><T inert>{it.text}</T></span>
          <div className="seg">
            {step.bins.map((b, bi) => (
              <button key={bi} className={put[i] === bi ? 'on' : ''} disabled={locked}
                onClick={() => { setPut({ ...put, [i]: bi }); setBad(bad.filter((x) => x !== i)); }}>{b}</button>
            ))}
          </div>
        </div>
      ))}
      <button className="btn" disabled={locked || Object.keys(put).length < step.items.length} onClick={check}>나누기 확인</button>
    </div>
  );
}

export function Hotspot({ step, onResult, locked }) {
  const meta = SOURCE_FILES[step.image];
  const ok = useImageOk(meta.file);
  const [mark, setMark] = useState(null);
  if (ok === false) {
    return (
      <div>
        <p className="notice">사료 그림이 아직 없어서 고르기 문제로 바꿔 풀어요.</p>
        <p className="q"><T>{step.fallback.q}</T></p>
        <Choice step={step.fallback} onResult={onResult} locked={locked} />
      </div>
    );
  }
  const tap = (e) => {
    if (locked) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    const g = step.region;
    const hit = x >= g.x && x <= g.x + g.w && y >= g.y && y <= g.y + g.h;
    setMark({ x, y, hit });
    onResult(hit, `(${x.toFixed(0)}%, ${y.toFixed(0)}%)`);
  };
  return (
    <div className="hotspot">
      <div className="hotspot-wrap" onClick={tap}>
        <img src={`sources/${meta.file}`} alt="그림 속 위치를 누르는 문제" draggable={false} />
        {mark && <span className={`hot-mark ${mark.hit ? 'right' : 'wrong'}`} style={{ left: `${mark.x}%`, top: `${mark.y}%` }} />}
      </div>
      <p className="howto">그림을 직접 눌러요. 크게 보려면 화면을 두 손가락으로 벌리세요.</p>
    </div>
  );
}

export function Jigsaw({ step, onResult, locked }) {
  const meta = SOURCE_FILES[step.image];
  const ok = useImageOk(meta.file);
  const n = step.size || 3;
  const start = useMemo(() => {
    const s = shuffle([...Array(n * n).keys()], 23).map(([v]) => v);
    return s.every((v, i) => v === i) ? s.reverse() : s;
  }, [n]);
  const [tiles, setTiles] = useState(start);
  const [sel, setSel] = useState(null);
  const [solved, setSolved] = useState(false);
  const [ratio, setRatio] = useState(1.6);
  useEffect(() => {
    if (!ok) return;
    const img = new Image();
    img.onload = () => setRatio(img.naturalWidth / img.naturalHeight);
    img.src = `sources/${meta.file}`;
  }, [ok, meta.file]);
  const tapTile = (k) => {
    if (locked || solved) return;
    if (sel === null) { setSel(k); return; }
    const t = [...tiles];
    [t[sel], t[k]] = [t[k], t[sel]];
    setTiles(t); setSel(null);
    if (t.every((v, i) => v === i)) { setSolved(true); onResult(true, '완성'); }
  };
  return (
    <div className="jigsaw">
      {ok === false && <p className="notice">사료 그림이 아직 없어 번호 조각으로 맞춰요. 그림을 넣으면 실제 그림 조각이 나와요.</p>}
      <div className={`jig-grid ${solved ? 'solved' : ''}`} style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, aspectRatio: String(ratio), width: `min(100%, calc((100vh - 230px) * ${ratio}))` }}>
        {tiles.map((v, k) => {
          const cx = v % n, cy = Math.floor(v / n);
          const style = ok
            ? { backgroundImage: `url(sources/${meta.file})`, backgroundSize: `${n * 100}% ${n * 100}%`, backgroundPosition: `${(cx / (n - 1)) * 100}% ${(cy / (n - 1)) * 100}%` }
            : {};
          return (
            <button key={k} data-v={v} className={`jig-tile ${sel === k ? 'sel' : ''} ${ok ? '' : 'num'} ${v === k && !solved ? 'placed' : ''}`} style={style} onClick={() => tapTile(k)} aria-label={`조각 ${k + 1}${v === k ? ' (제자리)' : ''}`}>
              {!ok && v + 1}
            </button>
          );
        })}
      </div>
      {solved ? <p className="good">그림이 완성되었어요!</p> : (
        <p className="jig-count">
          제자리에 놓인 조각 <b>{tiles.filter((v, i) => v === i).length}</b> / {n * n}
          {tiles.filter((v, i) => v === i).length >= n * n - 2 && <span> · 거의 다 됐어요! 비슷해 보이는 조각끼리 바꿔 보세요.</span>}
        </p>
      )}
    </div>
  );
}

export function Step({ step, onResult, locked }) {
  const P = { choice: Choice, match: Match, order: Order, classify: Classify, hotspot: Hotspot, jigsaw: Jigsaw }[step.type];
  return <P step={step} onResult={onResult} locked={locked} />;
}

export { SourceImage };
