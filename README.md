# 1860, 한양 세책점의 비밀

조선 후기 문화(실학, 서학과 동학, 서민 문화, 진경산수화)를 사료로 탐구하는 중학교 역사② 방탈출 웹앱입니다.
성취기준 [9역11-03], [9역11-04].

- 학생: 표지 → 도입 영상 → 모둠 입장 → 세책점 지도 → 4개 방(퍼즐 12개) → 대문 → 최종 질문 → 탈출
- 교사: 주소 끝에 `#/teacher` (처음 PIN `1860`) — 제한 시간·PIN 설정, 모둠 기록 인쇄, 시간 추가, 사료 그림 상태 확인
- 서버 없이 작동합니다. 게임 기록은 각 태블릿(브라우저)에 저장됩니다. 이름·학번은 받지 않습니다.

## 폴더 안내

| 위치 | 내용 |
| --- | --- |
| `src/data/game.js` | 사료, 질문, 힌트, 기록, 낱말 풀이 — 내용은 여기서만 고치면 됩니다 |
| `public/sources/` | 실제 사료 그림을 넣는 곳 (아래 파일 이름 그대로) |
| `public/art/` | 콘티 삽화(상상 그림) — 배경용 |
| `public/media/intro.mp4` | 도입 애니메이션 |

## 사료 그림 넣기

`public/sources/` 폴더에 아래 이름으로 넣으면 자동으로 나타납니다. 없으면 '사료 그림 자리'가 보이고,
씨름 위치 찾기는 고르기 문제로, 조각 맞추기는 번호 조각으로 바뀌어 게임은 그대로 진행됩니다.

| 파일 이름 | 사료 |
| --- | --- |
| `geojunggi.jpg` | 『화성성역의궤』 「거중기전도」 |
| `ssireum.jpg` | 김홍도, 「씨름」 |
| `ideal_landscape.jpg` | 중국풍 관념 산수화 한 점 |
| `geumgang.jpg` | 정선, 「금강전도」 |
| `inwang.jpg` | 정선, 「인왕제색도」 |

국립중앙박물관 e뮤지엄 등에서 공공누리 제1유형으로 공개된 이미지를 쓰고, 출처는 `game.js`의 caption에 적어 주세요.
「씨름」 정답 영역은 `game.js`의 3-1 `region`(그림 전체를 100으로 본 x, y, 너비, 높이)으로 맞춥니다.

## 내 컴퓨터에서 실행

```
npm install
npm run dev
```

## Cloudflare Pages에 배포 (GitHub 연결)

1. GitHub에 새 저장소(예: `sechaek-escape`)를 만들고 이 폴더를 올립니다.
2. Cloudflare 대시보드 → Workers & Pages → 만들기 → Pages → Git에 연결 → 저장소 선택
3. 빌드 설정
   - 프레임워크 기본값: Vite (또는 없음)
   - 빌드 명령: `npm run build`
   - 빌드 출력 디렉터리: `dist`
4. 저장 및 배포 → `https://sechaek-escape.pages.dev` 같은 주소가 생깁니다.
5. 역사교사 아카이브의 'AI 웹앱' 메뉴에 이 주소를 '바로 사용' 링크로 등록합니다.

GitHub 없이 바로 올리려면: `npm run build` 후 `npx wrangler pages deploy dist --project-name sechaek-escape`

## 표지 QR 코드

표지 오른쪽의 QR 코드는 지금 열린 주소를 자동으로 담습니다. 배포한 주소(예: `https://sechaek-escape.pages.dev/`)로 연 표지를 TV에 띄우면 학생이 태블릿 카메라로 찍어 바로 들어올 수 있어요.
QR을 누르면 TV용으로 크게 보입니다. 다른 주소를 고정하고 싶으면 `src/data/game.js`의 `appUrl`에 적으세요.

## 다음 단계 (PRD 4단계)

여러 모둠의 진행을 교사 TV 한 화면에서 보는 진행판은 Cloudflare Pages Functions + D1로 붙입니다.
