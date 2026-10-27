import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { SETTINGS } from '../data/game.js';

// 학생이 찍어서 들어올 주소: game.js 의 appUrl 이 있으면 그 주소, 없으면 지금 열린 주소
export function appUrl() {
  if (SETTINGS.appUrl) return SETTINGS.appUrl;
  return `${location.origin}${location.pathname}`;
}

function useQr(url, size) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: size, errorCorrectionLevel: 'M', color: { dark: '#2a2118', light: '#f4ecd6' } })
      .then((d) => alive && setSrc(d))
      .catch(() => alive && setSrc(null));
    return () => { alive = false; };
  }, [url, size]);
  return src;
}

const shortUrl = (u) => u.replace(/^https?:\/\//, '').replace(/\/$/, '');

export function QrCard() {
  const url = appUrl();
  const src = useQr(url, 360);
  const [big, setBig] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 복사 불가 환경 */ }
  };
  return (
    <>
      <button className="qr-card" onClick={() => setBig(true)} aria-label="QR 코드 크게 보기">
        {src ? <img src={src} alt={`앱 주소 QR 코드: ${url}`} /> : <span className="qr-wait">QR 만드는 중</span>}
        <span className="qr-text">
          <strong>태블릿 카메라로 찍어 입장</strong>
          <span className="qr-url">{shortUrl(url)}</span>
          <span className="qr-hint">눌러서 크게 보기</span>
        </span>
      </button>
      {big && <QrBig url={url} onClose={() => setBig(false)} copy={copy} copied={copied} />}
    </>
  );
}

// 상단 막대에 늘 보이는 작은 QR: 어느 화면에서든 눌러서 크게 띄울 수 있습니다
export function QrMini() {
  const url = appUrl();
  const src = useQr(url, 160);
  const [big, setBig] = useState(false);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 복사 불가 환경 */ }
  };
  return (
    <>
      <button className="qr-mini" onClick={() => setBig(true)} aria-label="입장 QR 코드 크게 보기" title="눌러서 크게 보기">
        {src ? <img src={src} alt="" /> : <span className="qr-mini-wait" />}
        <span className="qr-mini-text">입장 QR</span>
      </button>
      {big && <QrBig url={url} onClose={() => setBig(false)} copy={copy} copied={copied} />}
    </>
  );
}

function QrBig({ url, onClose, copy, copied }) {
  const src = useQr(url, 900);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="qr-big" onClick={onClose}>
      <div className="qr-big-card" onClick={(e) => e.stopPropagation()}>
        <div className="qr-big-title">모둠 태블릿 카메라로 찍으세요</div>
        {src && <img src={src} alt={`앱 주소 QR 코드: ${url}`} />}
        <div className="qr-big-url">{shortUrl(url)}</div>
        <div className="row center">
          <button className="btn ghost dark" onClick={copy}>{copied ? '주소를 복사했어요' : '주소 복사'}</button>
          <button className="btn" onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
}
