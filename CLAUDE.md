# WhoIsLoafing

이 문서는 작업할 때마다 최신 상태로 유지해요. 기능을 추가하거나 구조가 바뀌면 커밋 전에 이 문서를 함께 수정해서 같은 커밋에 포함해요.

## 서비스 개요

GitHub 레포 링크를 입력하면 참여자별 기여도를 분석해서 채팅방처럼 대화 형식으로 풀어주는 웹 서비스예요. 공개 레포만 분석하고 로그인은 없어요. 비공개 레포는 분석하지 않아요.

분석 항목은 아래와 같아요.

- 레포 전체: README, 폴더 구조, 사용 언어를 보고 어떤 서비스의 어떤 레포인지 한 문장으로 정의하고, 의존성 파일까지 읽어서 기술 스택을 종류별(언어, 프레임워크, 데이터베이스, 인프라와 배포, 그 외 도구)로 정리
- 참여자별: 커밋 수, 추가와 삭제 라인 수, 기여도 %(커밋 수 기준과 라인 수 기준 두 가지), 개발한 기능 목록, 코드 스타일

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
- 그림자 효과는 쓰지 않아요. 입력창, 버튼, 말풍선, 팝업, 툴팁 어디에도 `shadow`를 넣지 않고, 경계가 필요하면 옅은 회색 테두리나 배경색 차이로 구분해요.
- 메인 화면은 얇은 헤더(좌측 로고), 중앙 타이틀, 입력창과 분석 버튼 하나로만 구성해요.
- 타이틀은 어절이 하나씩 흐릿하게 떠오르며 나타나고, 그 뒤로 "누가", "어떤 기능을", "얼마나 많이"가 차례로 메인 컬러로 물들어요.
- 메인 화면 타이틀은 과하게 크지 않게(데스크톱 30px), 입력창과 버튼은 하나의 둥근 칸 안에 담아요.
- 메인 화면 왼쪽 아래에는 숨은빚청년들 팀 홈페이지(https://hidly.dev/) 링크를, 오른쪽 아래에는 저작권 문구를 작게 둬요.
- 메인 화면에서 GitHub 레포 링크가 아닌 값을 내면 서버로 보내지 않고, 입력창이 흔들리면서 테두리가 빨갛게 바뀌고 아래에 "올바른 링크가 맞는지 확인해 주세요" 툴팁이 나와요. 링크 판별은 `shared/repo.ts`를 서버와 함께 써요.
- 입력창은 화면 정중앙에 두고, 타이틀은 그 위에 얹어요. 입력창은 반투명 배경에 블러를 줘서 뒤의 배경이 흐릿하게 비쳐요. 입력창에 포커스가 가도 테두리 색이나 바깥 링은 바뀌지 않아요.
- 메인 화면 배경에는 GitHub 기여도 그래프처럼 생긴 작은 칸들이 아주 옅게 반짝이고, 지렁이 몇 마리가 칸을 따라 기어다니면서 켜진 칸을 먹어요. 지렁이들은 돌아가면서 머리 위 작은 말풍선으로 이 서비스가 해 주는 일을 한마디씩 말해요. 문구는 `ContributionBackdrop`의 `WORM_LINES`에 있어요. 가운데 타이틀과 입력창 주변은 비워 두고, 움직임 줄이기 설정에서는 멈춰 있어요.
- 헤더는 화면 위에 겹쳐 있고 반투명 흰 배경에 배경 블러를 줘서, 채팅이 헤더 아래로 흐리게 비쳐요.
- 헤더 왼쪽에는 로고, 오른쪽에는 채팅 화면에서만 중단하기 또는 공유하기 버튼을 둬요.

## 기술 스택

- 프론트엔드: React + TypeScript (Vite)
- 스타일: Tailwind CSS v4 (`@tailwindcss/vite`)
- 서버: Express 5 + TypeScript (tsx로 실행). 같은 로직이 Cloudflare Pages Functions로도 돌아가요.
- 배포: Cloudflare Pages (정적 파일과 Functions)
- 저장소: Supabase (Postgres). 서버에서 service role 키로만 접근하고, 브라우저는 직접 붙지 않아요.
- 분석 도구: Google Analytics 4 (`VITE_GA_MEASUREMENT_ID`가 있을 때만 켜짐)
- AI: Gemini API (`@google/genai`, 기본 모델 `gemini-3.8-flash`, JSON 스키마 응답을 zod로 검증)

GitHub API, Gemini API 호출은 모두 서버에서 해요. 키와 토큰은 클라이언트에 절대 노출하지 않아요.

## 프로젝트 구조

```
index.html            폰트 로드, 탭 제목, 파비콘
public/favicon.svg
shared/types.ts       서버와 클라이언트가 함께 쓰는 타입 (채팅 이벤트, 참여자 수치)
shared/repo.ts        GitHub 레포 링크 판별
supabase/schema.sql   Supabase 테이블 정의 (chats, ai_usage, ai_usage_daily 뷰)
server/
  index.ts            Node에서 돌릴 때의 진입점. Express로 요청을 받아서 handlers에 넘겨요.
  handlers.ts         API의 실제 동작 (설정, 채팅 조회와 공유, 분석 SSE, 요청 횟수 제한). Express와 Pages Functions가 같이 써요.
  store.ts            Supabase 연결, 채팅 저장과 공유, AI 사용량 기록
  context.ts          요청마다 채팅 ID를 들고 다니는 컨텍스트
  env.ts              환경 변수를 필요한 순간에 읽기, Cloudflare가 주는 값을 옮기기
  github.ts           GitHub REST API 클라이언트 (오류와 호출 제한 처리, 통계 202 재시도)
  stats.ts            사람별 수치 계산, 제외 파일 규칙, 계정 기준 합치기, 기여도 순위
  gemini.ts           Gemini 프롬프트와 호출 (레포 요약, 역할, 코드 스타일)
  analyze.ts          분석 파이프라인, 채팅 메시지 생성, 예외 안내, 캐싱
  insights.ts         분석 뒤 추가 질문 답변 (활동 시간, 진행 흐름, 막판 작업, 커밋 규칙, PR, 참여자 상세)
  cache.ts            만료 시간이 있는 메모리 캐시
  text.ts             금지 문자 후처리, 길이 제한
functions/api/[[path]].ts   Cloudflare Pages에서 /api 아래 요청을 받는 함수. handlers를 그대로 불러 써요.
wrangler.toml         Cloudflare Pages 설정 (빌드 결과 폴더, nodejs_compat)
src/
  App.tsx             화면 전환(메인 화면과 채팅), 채팅 주소(/c/아이디) 처리, 공유
  index.css           Tailwind 테마 토큰, 자간, 애니메이션
  lib/api.ts          서버 호출, SSE 스트림 읽기, 브라우저 소유자 키
  lib/analytics.ts    Google Analytics 이벤트 전송
  hooks/useAnalysis.ts  채팅 메시지 큐, 입력 중 표시 타이밍
  components/         Header, Logo, Hero, ContributionBackdrop, RepoInput, Chat, Bubble, TypingDots, RichText, PeoplePicker, LeaveDialog, RankingCarousel, StatsCard, SummaryChart, Charts, Followup
```

## 실행 방법

```bash
npm install
cp .env.example .env   # 값을 채워요
npm run dev            # 프론트 http://localhost:5173, 서버 http://localhost:3001
```

- `npm run typecheck`: 클라이언트와 서버 타입 검사
- `npm run build`: 타입 검사 후 프론트엔드 빌드 (`dist`)
- `npm run pages:dev`: 빌드한 뒤 Cloudflare Pages 환경으로 내 컴퓨터에서 실행
- `npm start`: 프로덕션 모드. Express가 API와 빌드된 프론트엔드를 함께 서빙해요.

개발 중에는 Vite가 `/api` 요청을 Express(3001)로 프록시해요.

## Cloudflare Pages 배포

Pages는 Express를 그대로 돌릴 수 없어서, `/api` 요청은 `functions/api/[[path]].ts`가 받아요. 실제 동작은 `server/handlers.ts` 하나를 Express와 같이 쓰기 때문에, API를 고칠 때는 handlers만 고치면 두 곳에 모두 반영돼요.

대시보드에서 Git 저장소를 연결하고 아래처럼 설정해요.

- 빌드 명령: `npm run build`
- 빌드 결과 폴더: `dist` (`wrangler.toml`에 적혀 있어요)
- `nodejs_compat` 플래그는 `wrangler.toml`에서 켜요.

환경 변수는 Pages 프로젝트의 Settings, Variables and Secrets에서 넣어요. Production과 Preview에 각각 넣어야 해요.

| 이름 | 종류 | 쓰이는 시점 |
| --- | --- | --- |
| `GITHUB_TOKEN` | Secret | 실행할 때 (Functions) |
| `GEMINI_API_KEY` | Secret | 실행할 때 (Functions) |
| `SUPABASE_URL` | 일반 값 | 실행할 때 (Functions) |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | 실행할 때 (Functions) |
| `GEMINI_MODEL` (선택) | 일반 값 | 실행할 때 (Functions) |
| `VITE_GA_MEASUREMENT_ID` | 일반 값 | 빌드할 때. 바꾸면 다시 배포해야 반영돼요. |

- 서버 코드는 값을 파일을 불러올 때 고정하지 않고 필요한 순간에 읽어요(`server/env.ts`). Functions에서는 요청마다 `applyBindings`로 Cloudflare가 준 값을 옮겨요.
- 내 컴퓨터에서 Pages 환경 그대로 돌려 보려면 `.dev.vars.example`을 `.dev.vars`로 복사해서 채우고 `npm run pages:dev`를 실행해요. (http://localhost:8788)
- 분석 한 번에 GitHub와 Gemini로 나가는 요청이 수십 개예요. Cloudflare 무료 요금제는 요청 하나에서 밖으로 나가는 요청 수와 CPU 시간이 작게 제한되어 있어서, 참여자가 많은 레포나 "빼고 계산하기"에서는 한도를 넘을 수 있어요. 그럴 때는 Workers 유료 요금제가 필요해요.
- 결과 캐시와 요청 횟수 제한은 메모리에 있어서, Functions에서는 인스턴스가 바뀌면 사라져요. 캐시가 없으면 다시 계산할 뿐이라 동작에는 문제가 없어요.

## 환경 변수

`.env.example`에 정리되어 있어요. `.env`는 절대 커밋하지 않아요. (`.gitignore`에 등록됨)

| 이름 | 용도 |
| --- | --- |
| `GITHUB_TOKEN` | 공개 레포 분석에 쓰는 서버 토큰. 만료 기간은 366일 이하로 발급해요. |
| `GEMINI_API_KEY` | Gemini API 키. 없으면 수치만 보여줘요. |
| `PORT` (선택) | 프로덕션 서버 포트. 기본값 3001 |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase 연결. 없으면 채팅 저장과 공유, AI 사용량 기록이 꺼져요. service role 키는 서버 전용 비밀 값이에요. |
| `VITE_GA_MEASUREMENT_ID` | Google Analytics 4 측정 ID. 브라우저에 공개되는 값이고, 없으면 추적하지 않아요. |
| `GEMINI_MODEL` (선택) | Gemini 모델 변경용. 기본값 `gemini-3.8-flash` |

## 데이터 수집과 계산 규칙

- 기본 모드("전부 포함하기"): `/repos/{owner}/{repo}/stats/contributors` 를 써요. 202가 오면 3초 간격으로 최대 8번 재시도해요. 끝내 준비되지 않거나 라인 수가 비어 있으면 커밋 단위 분석으로 넘어가요.
- 링크를 받으면 서버가 레포를 먼저 확인하고, 어떤 레포인지 한 문장으로 소개한 다음, lock 파일과 빌드 결과물을 뺄지 말풍선의 버튼으로 물어봐요. 답을 받은 뒤에 분석을 시작해요.
- 커밋 단위 모드: 사용자가 "빼고 계산하기"를 고르면 실행해요. 최근 300개 커밋을 하나씩 읽고 lock 파일, 빌드 결과물, 자동 생성 파일, 바이너리 파일을 라인 수에서 빼요. 규칙은 `server/stats.ts`의 `isExcludedFile`에 있어요.
- 병합 커밋과 봇 계정은 집계에서 빼요.
- 여러 이메일로 커밋한 사람은 GitHub 계정 기준으로 합쳐요. 계정이 연결되지 않은 커밋은 같은 이메일, noreply 주소, 같은 이름, 계정 아이디와 같은 이름 순서로 계정을 찾아요. 끝내 계정을 찾지 못한 작성자는 이름이 같으면 한 사람으로 합쳐요.
- 통계 API가 계정이 연결되지 않은 커밋을 엉뚱한 계정 몫으로 돌려주는 경우가 있어요. 커밋이 300개 미만인 레포는 커밋 목록과 대조해서 원래 참여자에게 합쳐요. (`mergeMisattributed`)
- 기여도는 커밋 수 기준과 라인 수(추가 + 삭제) 기준을 각각 계산하고, 소개 순서는 두 값의 평균이 큰 순서예요.
- 참여자가 5명을 넘으면 순위와 기여도 해설까지 보여준 뒤, 누가 맡은 기능과 코드 스타일을 살펴볼지 물어봐요. "상위 5명만 분석하기"를 누르거나 "직접 고르기"로 최대 10명까지 골라요. 고른 사람들은 다음 요청의 `people`로 오고, 앞에서 모아 둔 수치(`collectedCache`)를 그대로 써요. 5명 이하면 묻지 않고 모두 분석해요.
- 개발한 기능 목록과 코드 스타일은 한 번에 최대 10명까지만 Gemini로 분석해요. 기능은 한 문장으로 뭉뚱그리지 않고 3개에서 8개 항목으로 나눠서 보여줘요. 모델이 혼잡하거나(503) 호출 제한에 걸리면(429) `gemini-3.7-flash`, `gemini-3.5-flash`, `gemini-3.5-flash-lite` 순서로 바로 넘어가고, 성공한 모델은 5분 동안 먼저 써요. 참여자별로 대표 커밋 5개를 고르고 diff 길이를 제한해서 보내요. 길이 제한 상수는 `server/analyze.ts` 위쪽에 모여 있어요.
- 캐싱: 결과는 레포와 마지막 푸시 시각을 키로 24시간 메모리에 캐싱해요.
- 비공개 레포는 분석하지 않아요. 서버 토큰으로 볼 수 있는 비공개 레포여도 결과를 내보내지 않고, 분석할 수 없다고 안내해요.

## 채팅 저장과 공유

Supabase 프로젝트의 SQL Editor에서 `supabase/schema.sql`을 한 번 실행해야 해요.

- 채팅은 UUID로 구분하고 주소는 `/c/{uuid}`예요. 링크를 내는 순간 브라우저가 UUID를 만들고, 요청이 끝날 때마다 서버가 그 요청에서 올라간 말풍선을 `chats.messages`에 이어 붙여요.
- 브라우저마다 무작위 소유자 키를 localStorage에 하나 두고 `X-Owner-Key` 헤더로 보내요. 로그인 정보나 토큰이 아니고, 서버에는 해시만 저장해요.
- 공유하기 전의 채팅은 만든 브라우저에서만 열고 이어서 쓸 수 있어요. 다른 브라우저에서는 열 수 없다고 안내해요.
- 헤더 오른쪽에는 분석 중일 때 중단하기 버튼이, 그 밖에는 공유하기 버튼이 보여요. 저장 기능(Supabase)이 꺼져 있으면 공유하기를 눌렀을 때 공유할 수 없다고 안내해요. 공유하면 `shared_at`이 기록되고, 그 뒤로는 링크를 아는 누구나 열람할 수 있지만 아무도 이어서 작업할 수 없어요. 서버도 공유된 채팅의 분석 요청을 거절해요.
- 공유는 되돌릴 수 없어서, 누르기 전에 확인 창으로 한 번 더 물어봐요.

## AI 사용량 기록

Gemini를 한 번 부를 때마다(실패와 대체 모델 재시도 포함) `ai_usage`에 한 줄을 남겨요. 채팅 ID, 목적(`repo_summary`, `contributor_profile`, `narration`), 대상, 모델, 성공 여부와 오류, 시스템 프롬프트와 사용자 프롬프트 전문, 응답 전문, 입력과 출력과 생각 토큰 수, 걸린 시간이 들어가요. 프롬프트에는 분석 대상 레포의 README와 diff가 그대로 들어 있어요. 날짜별 합계는 `ai_usage_daily` 뷰로 봐요. 기록은 분석을 기다리게 하지 않고, 실패해도 분석은 계속돼요.

## Google Analytics 이벤트

`src/lib/analytics.ts`의 `track`으로 보내요. 화면 전환은 `page_view`를 직접 보내고, 채팅 주소는 `/c/[id]`로 묶어서 보내요. 레포는 `owner/repo` 형태의 `repo` 값으로 남겨요.

| 이벤트 | 언제 | 주요 값 |
| --- | --- | --- |
| `page_view` | 화면이 바뀔 때 | `screen`(home, chat, shared_chat), `repo`, `is_owner` |
| `repo_submit` | 메인 화면에서 링크를 냈을 때 | `repo` |
| `repo_invalid_input` | 링크가 아닌 값을 냈을 때 | `length`, `looks_like_url` |
| `calc_mode_select` | 계산 방식을 골랐을 때 | `exclude_generated` |
| `people_pick` | 살펴볼 참여자를 골랐을 때 | `mode`(top, custom), `count` |
| `analysis_step_continue` | 계속하기를 눌렀을 때 | `next_step` |
| `analysis_complete` | 전체 기여도 비교까지 나왔을 때 | `contributors`, `duration_seconds` |
| `analysis_error` | 오류 말풍선이 나왔을 때 | `message`, `retryable` |
| `analysis_stop` | 중단하기를 눌렀을 때 | `question`, `duration_seconds` |
| `retry_click` | 다시 시도를 눌렀을 때 | `question` |
| `followup_ask`, `followup_answered` | 추가 질문을 고르고 답을 받았을 때 | `question`, `duration_seconds` |
| `followup_person_picker_toggle` | 참여자 고르기를 열고 닫을 때 | |
| `ranking_card_view` | 순위 카드를 넘겨 봤을 때 | `rank`, `total` |
| `scroll_to_bottom_click` | 맨 아래로 이동을 눌렀을 때 | |
| `share_open`, `share_cancel`, `share_confirm`, `share_failed` | 공유 확인 창을 열고, 취소하고, 공유했을 때 | `message_count` |
| `share_link_copy` | 공유 링크를 복사했을 때 | `success`, `is_owner` |
| `chat_open_failed` | 열 수 없는 채팅 주소로 들어왔을 때 | |
| `leave_confirm_open`, `leave_confirm`, `leave_cancel` | 분석 중에 로고를 눌러 확인 창이 뜨고, 떠나거나 남았을 때 | `message_count` |
| `home_click` | 로고나 홈 버튼으로 돌아갈 때 | `from` |
| `team_link_click` | 팀 홈페이지 링크를 눌렀을 때 | |

## 현재까지 구현된 기능

- 메인 화면 (헤더, 타이틀, 레포 링크 입력창, 분석 버튼)
- 레포 한 문장 정의, 참여자별 맡은 기능 목록과 코드 스타일 목록(둘 다 번호가 붙은 목록 말풍선)
- 참여자별 수치 카드는 말풍선 하나 안에서 기여도 순서대로 좌우로 넘겨 봐요. (터치 스와이프, 마우스 드래그, 아래 점 표시)
- 전체 기여도 비교는 말풍선 하나에 커밋 수 기준과 라인 수 기준 막대 그래프를 나란히 보여줘요.
- 새로 온 말풍선의 글은 타자를 치듯 한 글자씩 나타나고(최대 0.9초), 글이 다 나온 뒤에 카드, 그래프, 버튼이 따라 나와요. 저장된 채팅을 불러올 때는 바로 보여줘요.
- SSE로 메시지를 순서대로 전달하고, 말풍선 사이에 입력 중 표시. 오래 기다릴 때는 점 옆에 "커밋 기록 뒤적이는 중" 같은 문구가 번갈아 나와요.
- 분석은 단계별로 멈춰요. 순위와 기여도 해설, 맡은 기능, 코드 스타일이 끝날 때마다 계속하기 버튼과 다음 단계 안내가 나오고, 누르면 다음 단계가 이어져요. 서버는 멈추지 않고 뒤에서 계속 분석해 둬요.
- 채팅 흐름: 레포 소개, 기술 스택, 계산 방식 질문, 통계 가져오는 중 안내, 참여 인원, 순위 카드, 기능 분석 시작 안내와 참여자별 기능 목록, 코드 스타일 분석 시작 안내와 참여자별 코드 스타일, 전체 기여도 비교 순서예요.
- 채팅 화면에는 입력창을 두지 않아요. 다른 레포를 분석하려면 로고를 눌러 메인 화면으로 돌아가요.
- 화면 위쪽으로 밀려난 지난 말풍선은 흐리게 보이고, 스크롤해서 아래로 내려올수록 서서히 밝아져요.
- 말풍선 글에서 핵심 표현은 굵게 보여줘요. 서버가 보내는 글에서 별표 두 개로 감싼 부분만 굵게 그리고, 그 밖의 마크다운은 쓰지 않아요. AI 프롬프트에도 핵심 두세 군데만 강조하라고 적어 뒀어요.
- 채팅을 위로 올리면 화면 하단 중앙에 맨 아래로 이동 버튼이 나오고, 위로 올려서 읽는 동안에는 새 말풍선이 와도 스크롤을 끌어내리지 않아요.
- 분석 전에 lock 파일과 빌드 결과물을 뺄지 묻고, 고르면 커밋 단위로 계산
- 결과 캐싱
- 채팅 저장과 공유, AI 사용량 기록, Google Analytics 이벤트 추적 (위의 각 절 참고)
- 분석이 끝나면 "더 궁금한 점이 있나요?" 말풍선에서 추가 질문을 고를 수 있어요. 활동 시간대, 진행 흐름, 막판에 몰아서 작업한 사람, 커밋 메시지 규칙, PR 현황, 특정 참여자 상세를 지원하고, 답한 뒤에 다시 질문을 고를 수 있어요.
- 추가 질문의 숫자와 그래프는 커밋 목록(최근 1,000개)과 PR 목록(최근 100개)으로 계산하고, 시간은 사용자 기기의 시간대 기준이에요. 참여자별 활동 시간은 히트맵으로 보여줘요.
- 숫자를 그대로 읽어 주지 않고, 숫자가 뜻하는 바를 풀어서 설명해요. 순위 카드 다음의 기여도 해설, 마지막 팀 총평, 추가 질문의 답은 계산한 숫자를 Gemini에 넘겨서 "밤늦게 몰아서 작업하는 팀이네요" 같은 설명으로 받아요. 25초 안에 받지 못하면 기본 문장으로 대신해요.
- 내가 진행 중인 채팅 화면에서 로고를 누르면(분석이 돌고 있을 때뿐 아니라 질문을 기다리거나 끝난 뒤에도) "작업을 잃어버릴 수 있어요"라는 제목과 "진행 중인 작업을 그만두고 메인 화면으로 이동할까요? 이 작업은 되돌릴 수 없어요."라는 설명의 확인 창이 떠요. 그만두고 이동을 누르면 분석을 버리고 메인 화면으로 가고, 바깥을 누르거나 계속 분석하기를 누르면 그대로 이어가요.
- 분석이 돌고 있을 때 새로 고치거나 탭을 닫으려고 하면 브라우저의 경고 창이 떠요. 저장 기능이 꺼져 있으면 채팅이 화면에 있는 동안 계속 경고해요. 이 창의 문구는 브라우저가 정해서 바꿀 수 없어요.
- 분석 중에는 헤더의 중단하기 버튼으로 멈출 수 있어요. 서버와의 연결을 끊고 "분석을 중단했어요." 말풍선과 다시 시도 버튼을 보여줘요.
- 연결 끊김, 일시적인 분석 오류, 호출 제한 안내 말풍선에는 다시 시도 버튼이 있어요. 누르면 같은 레포를 같은 계산 방식으로 이어서 분석해요.
- 예외 안내 말풍선: 잘못된 링크, 찾을 수 없는 레포, 비공개 레포는 분석할 수 없다는 안내, 호출 제한 초과, 서버 토큰 접근 제한
- 모바일 반응형. 입력창 글자는 모바일에서 16px로 둬서 눌렀을 때 화면이 확대되지 않고, 버튼을 두 번 눌러도 확대되지 않아요. 두 손가락 확대는 막지 않아요.

## 남은 작업

- 실제 Supabase 프로젝트와 GA 측정 ID를 넣고 저장, 공유, 사용량 기록, 이벤트 수집을 실사용으로 검증
- 내가 만든 채팅 목록 보기
- 캐시를 메모리 대신 외부 저장소로 옮기기. 지금은 서버를 다시 시작하면 사라지고, 서버를 여러 대로 늘릴 수 없어요.
- 커밋이 300개를 넘는 레포의 커밋 단위 분석 범위 넓히기
- 테스트 코드
- Cloudflare에 실제로 배포해서 요금제 한도 안에서 도는지 확인

## 텍스트 작성 규칙

- 화면에 노출되는 모든 문구와 AI가 생성하는 분석 결과에서 긴 대시, 가운데점, 화살표 기호 같은 특수문자를 쓰지 않아요. 쉼표나 마침표로 자연스럽게 연결해요.
- 말투는 친근한 존댓말(~해요, ~네요)로 통일해요.
- 이모지는 쓰지 않아요. 참여 인원을 알리는 말풍선의 폭죽 이모지 하나만 예외예요.
- Gemini 프롬프트(`server/gemini.ts`의 `WRITING_RULES`)에 이 규칙과 말투 규칙을 명시하고, 응답은 `server/text.ts`의 `sanitize`로 후처리해서 금지 문자를 제거해요.
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
