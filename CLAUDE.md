# WhoIsLoafing

이 문서는 작업할 때마다 최신 상태로 유지해요. 기능을 추가하거나 구조가 바뀌면 커밋 전에 이 문서를 함께 수정해서 같은 커밋에 포함해요.

## 서비스 개요

GitHub 레포 링크를 입력하면 참여자별 기여도를 분석해서 채팅방처럼 대화 형식으로 풀어주는 웹 서비스예요. 공개 레포는 로그인 없이 분석할 수 있고, GitHub로 로그인하면 본인이 접근 권한을 가진 비공개 레포도 분석할 수 있어요.

분석 항목은 아래와 같아요.

- 레포 전체: README, 폴더 구조, 사용 언어를 보고 어떤 서비스의 어떤 레포인지 한 문장으로 정의
- 참여자별: 커밋 수, 추가와 삭제 라인 수, 기여도 %(커밋 수 기준과 라인 수 기준 두 가지), 역할, 코드 스타일

## 브랜딩 규칙

- 서비스명: 표기는 WhoIsLoafing, 도메인이나 패키지명처럼 소문자가 필요한 곳은 whoisloafing
- 로고: 텍스트 로고. Bricolage Grotesque(Google Fonts, OFL) 굵기 700에서 800. 이 폰트는 로고에만 써요.
- 본문 폰트: Pretendard. 전체 자간은 -0.02em
- 메인 컬러: #2E90FA, hover는 #1570EF, 연한 배경은 #EFF8FF
  - 버튼, 링크, 입력창 포커스, 사용자 말풍선, 기여도 막대 그래프 같은 강조 요소에만 써요.
  - 나머지는 흰 배경과 회색 계열 텍스트로 절제해요.
- 컬러와 폰트는 `src/index.css`의 `@theme`에 토큰으로 등록되어 있어요. (`brand`, `brand-hover`, `brand-soft`, `font-sans`, `font-logo`)
- 탭 제목은 WhoIsLoafing, 파비콘은 메인 컬러 배경에 흰색 W
- 디자인 원칙: 여백 위주의 미니멀. 장식, 그라데이션, 이모지, 아이콘 남발 금지. 타이틀 위에 태그, 뱃지, 라벨을 붙이지 않아요.
- 메인 화면은 얇은 헤더(좌측 로고, 우측 로그인), 중앙 타이틀, 입력창과 분석 버튼 하나로만 구성해요.

## 기술 스택

- 프론트엔드: React + TypeScript (Vite)
- 스타일: Tailwind CSS v4 (`@tailwindcss/vite`)
- 서버: Express 5 + TypeScript (tsx로 실행)
- 세션: express-session (httpOnly 쿠키, 메모리 저장소)
- AI: Claude API (`@anthropic-ai/sdk`, 기본 모델 `claude-opus-5-5`, 구조화 출력은 zod)

GitHub API, Claude API 호출과 로그인 처리는 모두 서버에서 해요. 키와 토큰은 클라이언트에 절대 노출하지 않아요. GitHub 액세스 토큰은 서버 세션에만 보관하고, 클라이언트 코드나 localStorage에 저장하지 않아요.

## 프로젝트 구조

```
index.html            폰트 로드, 탭 제목, 파비콘
public/favicon.svg
shared/types.ts       서버와 클라이언트가 함께 쓰는 타입 (채팅 이벤트, 참여자 수치)
server/
  index.ts            Express 앱, 세션, /api/analyze SSE 라우트, 요청 횟수 제한
  env.ts              환경 변수 로드
  auth.ts             GitHub OAuth 로그인, 로그아웃, 내 정보
  github.ts           GitHub REST API 클라이언트 (오류와 호출 제한 처리, 통계 202 재시도)
  stats.ts            사람별 수치 계산, 제외 파일 규칙, 계정 기준 합치기, 기여도 순위
  claude.ts           Claude 프롬프트와 호출 (레포 요약, 역할, 코드 스타일)
  analyze.ts          분석 파이프라인, 채팅 메시지 생성, 예외 안내, 캐싱
  cache.ts            만료 시간이 있는 메모리 캐시
  text.ts             금지 문자 후처리, 길이 제한
src/
  App.tsx             화면 전환(메인 화면과 채팅), 로그인 후 이어서 분석
  index.css           Tailwind 테마 토큰, 자간, 애니메이션
  lib/api.ts          서버 호출, SSE 스트림 읽기
  hooks/useAuth.ts    로그인 상태
  hooks/useAnalysis.ts  채팅 메시지 큐, 입력 중 표시 타이밍
  components/         Header, Logo, Hero, RepoInput, Chat, Bubble, TypingDots, RankingCarousel, StatsCard, SummaryChart
```

## 실행 방법

```bash
npm install
cp .env.example .env   # 값을 채워요
npm run dev            # 프론트 http://localhost:5173, 서버 http://localhost:3001
```

- `npm run typecheck`: 클라이언트와 서버 타입 검사
- `npm run build`: 타입 검사 후 프론트엔드 빌드 (`dist`)
- `npm start`: 프로덕션 모드. Express가 API와 빌드된 프론트엔드를 함께 서빙해요.

개발 중에는 Vite가 `/api` 요청을 Express(3001)로 프록시해요.

## 환경 변수

`.env.example`에 정리되어 있어요. `.env`는 절대 커밋하지 않아요. (`.gitignore`에 등록됨)

| 이름 | 용도 |
| --- | --- |
| `GITHUB_TOKEN` | 로그인하지 않은 사용자의 공개 레포 분석에 쓰는 서버 토큰 |
| `ANTHROPIC_API_KEY` | Claude API 키. 없으면 수치만 보여줘요. |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | GitHub OAuth App |
| `SESSION_SECRET` | 세션 쿠키 서명. 프로덕션에서는 필수 |
| `APP_URL` (선택) | 브라우저에서 접속하는 주소. 기본값 `http://localhost:5173` |
| `PORT` (선택) | 프로덕션 서버 포트. 기본값 3001 |
| `ANTHROPIC_MODEL` (선택) | Claude 모델 변경용. 기본값 `claude-opus-5-5` |

GitHub OAuth App의 콜백 URL은 `{APP_URL}/api/auth/github/callback` 으로 등록해요.

## 데이터 수집과 계산 규칙

- 기본 모드("전부 포함하기"): `/repos/{owner}/{repo}/stats/contributors` 를 써요. 202가 오면 3초 간격으로 최대 8번 재시도해요. 끝내 준비되지 않거나 라인 수가 비어 있으면 커밋 단위 분석으로 넘어가요.
- 링크를 받으면 서버가 레포를 먼저 확인하고, 어떤 레포인지 한 문장으로 소개한 다음, lock 파일과 빌드 결과물을 뺄지 말풍선의 버튼으로 물어봐요. 답을 받은 뒤에 분석을 시작해요.
- 커밋 단위 모드: 사용자가 "빼고 계산하기"를 고르면 실행해요. 최근 300개 커밋을 하나씩 읽고 lock 파일, 빌드 결과물, 자동 생성 파일, 바이너리 파일을 라인 수에서 빼요. 규칙은 `server/stats.ts`의 `isExcludedFile`에 있어요.
- 병합 커밋과 봇 계정은 집계에서 빼요.
- 여러 이메일로 커밋한 사람은 GitHub 계정 기준으로 합쳐요. 계정이 연결되지 않은 커밋은 같은 이메일, noreply 주소, 같은 이름, 계정 아이디와 같은 이름 순서로 계정을 찾아요. 끝내 계정을 찾지 못한 작성자는 이름이 같으면 한 사람으로 합쳐요.
- 통계 API가 계정이 연결되지 않은 커밋을 엉뚱한 계정 몫으로 돌려주는 경우가 있어요. 커밋이 300개 미만인 레포는 커밋 목록과 대조해서 원래 참여자에게 합쳐요. (`mergeMisattributed`)
- 기여도는 커밋 수 기준과 라인 수(추가 + 삭제) 기준을 각각 계산하고, 소개 순서는 두 값의 평균이 큰 순서예요.
- 역할과 코드 스타일은 상위 10명까지만 Claude로 분석해요. 참여자별로 대표 커밋 3개를 고르고 diff 길이를 제한해서 보내요. 길이 제한 상수는 `server/analyze.ts` 위쪽에 모여 있어요.
- 캐싱: 결과는 레포와 마지막 푸시 시각을 키로 24시간 메모리에 캐싱해요. 비공개 레포는 사용자 ID별로 키를 분리하고, 캐시를 쓰기 전에 항상 요청자의 토큰으로 접근 권한을 다시 확인해요.

## 현재까지 구현된 기능

- 메인 화면 (헤더, 타이틀, 레포 링크 입력창, 분석 버튼)
- GitHub OAuth 로그인과 로그아웃 (scope는 repo, 헤더에 프로필 이미지 표시)
- 레포 한 문장 정의, 역할, 코드 스타일
- 참여자별 수치 카드는 말풍선 하나 안에서 기여도 순서대로 좌우로 넘겨 봐요. (터치 스와이프, 마우스 드래그, 아래 점 표시)
- 전체 기여도 비교는 말풍선 하나에 커밋 수 기준과 라인 수 기준 막대 그래프를 나란히 보여줘요.
- SSE로 메시지를 순서대로 전달하고, 말풍선 사이에 입력 중 표시
- 분석이 끝난 뒤 하단 입력창에서 다른 레포 이어서 분석
- 분석 전에 lock 파일과 빌드 결과물을 뺄지 묻고, 고르면 커밋 단위로 계산
- 결과 캐싱 (비공개 레포는 사용자별 분리)
- 예외 안내 말풍선: 잘못된 링크, 찾을 수 없는 레포, 호출 제한 초과, 비공개 레포 로그인 안내(말풍선 안 로그인 버튼), 접근 권한 없음, 로그인 만료
- 말풍선의 로그인 버튼으로 로그인하면 돌아와서 같은 레포를 바로 이어서 분석
- 모바일 반응형

## 남은 작업

- 실제 `ANTHROPIC_API_KEY`와 OAuth App으로 AI 분석과 로그인 흐름 실사용 검증
- 세션과 캐시를 메모리 대신 외부 저장소(Redis 등)로 옮기기. 지금은 서버를 다시 시작하면 사라지고, 서버를 여러 대로 늘릴 수 없어요.
- 커밋이 300개를 넘는 레포의 커밋 단위 분석 범위 넓히기
- 테스트 코드와 배포 설정

## 텍스트 작성 규칙

- 화면에 노출되는 모든 문구와 AI가 생성하는 분석 결과에서 긴 대시, 가운데점, 화살표 기호 같은 특수문자를 쓰지 않아요. 쉼표나 마침표로 자연스럽게 연결해요.
- 말투는 친근한 존댓말(~해요, ~네요)로 통일해요.
- 이모지를 쓰지 않아요.
- Claude 프롬프트(`server/claude.ts`의 `WRITING_RULES`)에 이 규칙과 말투 규칙을 명시하고, 응답은 `server/text.ts`의 `sanitize`로 후처리해서 금지 문자를 제거해요.
- 안내와 오류는 모두 채팅 말풍선으로 보여줘요.

## Git 작업 규칙

- 요청받은 작업이 끝나면 승인을 기다리지 않고 바로 커밋과 푸시를 함께 진행해요.
- 커밋 메시지는 "태그: 구현한 내용" 형식으로, 가장 간단한 한국어로 써요. 예: `feat: 회원가입 기능 구현`
- 사용할 수 있는 태그
  - `feat`: 새 기능을 추가했을 때
  - `fix`: 버그를 수정했을 때
  - `docs`: 문서를 수정했을 때
  - `refactor`: 코드를 리팩토링했을 때
  - `build`: 빌드 관련 파일을 수정했을 때
  - `ci`: CI 설정 파일을 수정했을 때
  - `chore`: 그 외 자잘한 수정을 했을 때
  - `remove`: 파일 삭제만 했을 때
- 커밋 메시지에 파일명, 폴더명, 패키지명을 드러내지 않고 어떤 작업을 했는지만 적어요.
  - 좋은 예: `feat: 채팅 형식 분석 결과 화면 구현`
  - 나쁜 예: `feat: ChatBubble.tsx와 useAnalysis 훅 추가`
- 커밋 메시지에 Co-Authored-By 같은 협업자 표기를 절대 넣지 않아요. Claude를 contributor로 등록하지 않아요.
- `.claude/settings.json`에 `"includeCoAuthoredBy": false` 가 설정되어 있고, 이 파일도 저장소에 포함해요.
- 한 커밋에는 하나의 목적만 담고, 성격이 다른 작업은 커밋을 나눠요.
