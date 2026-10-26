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
  return (
    <svg {...p}><path d="M2 27 11 11l5 8 4-6 10 14z" /><path d="M11 11l-2 6M20 13l-1 4" /></svg>
  );
}
