// 방 아이콘 (거중기 도르래, 책, 탈, 산봉우리)
export function RoomIcon({ kind, size = 28 }) {
  const p = { width: size, height: size, viewBox: '0 0 32 32', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (kind === 'gear') return (
    <svg {...p}><path d="M5 28 16 5l11 23" /><circle cx="16" cy="6" r="3" /><path d="M18.5 7v12" /><rect x="15" y="19" width="7" height="6" rx="1" /></svg>
  );
  if (kind === 'book') return (
    <svg {...p}><path d="M4 7h10a2 2 0 0 1 2 2v17a2 2 0 0 0-2-2H4z" /><path d="M28 7H18a2 2 0 0 0-2 2v17a2 2 0 0 1 2-2h10z" /><path d="M7 12h5M7 16h5M20 12h5M20 16h5" /></svg>
  );
  if (kind === 'mask') return (
    <svg {...p}><ellipse cx="16" cy="16" rx="10" ry="12" /><path d="M10 13q2-2 4 0M18 13q2-2 4 0" /><path d="M11 20q5 5 10 0" /></svg>
  );
  if (kind === 'door') return (
    <svg {...p}><path d="M7 29V5h18v24" /><path d="M4 29h24" /><path d="M7 5l11 3v21" /><circle cx="15" cy="18" r="1" fill="currentColor" /></svg>
  );
  return (
    <svg {...p}><path d="M2 27 11 11l5 8 4-6 10 14z" /><path d="M11 11l-2 6M20 13l-1 4" /></svg>
  );
}

export function ClueIcon({ kind }) {
  const q = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (kind === 'check') return <svg {...q}><path d="M5 12.5 10 17l9-10" /></svg>;
  if (kind === 'scroll') return <svg {...q}><path d="M7 4h11a2 2 0 0 1 0 4H9" /><path d="M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M9 12h6M9 16h4" /></svg>;
  if (kind === 'box') return <svg {...q}><rect x="3" y="8" width="18" height="12" rx="1" /><path d="M3 8l2-4h14l2 4" /><path d="M10 12h4" /></svg>;
  return <svg {...q}><path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z" /><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z" /></svg>;
}

const sm = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
export const HomeIcon = () => <svg {...sm}><path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>;
export const LockIcon = () => <svg {...sm}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
