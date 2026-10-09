export interface ContributorStats {
  /** GitHub 계정이 연결되지 않은 커밋 작성자는 login이 null이에요. */
  login: string | null
  name: string
  avatarUrl: string | null
  profileUrl: string | null
  commits: number
  additions: number
  deletions: number
  /** 커밋 수 기준 기여도 (%) */
  commitShare: number
  /** 라인 수(추가 + 삭제) 기준 기여도 (%) */
  lineShare: number
}

/** 분석이 끝난 뒤에 이어서 물어볼 수 있는 질문 */
export type FollowupQuestion = 'hours' | 'timeline' | 'spurt' | 'convention' | 'pulls' | 'teamwork' | 'person'

export const FOLLOWUP_LABELS: Record<FollowupQuestion, string> = {
  hours: '우리 팀은 보통 몇 시에 활동했나요?',
  timeline: '프로젝트는 어떤 흐름으로 진행됐나요?',
  spurt: '막판에 가장 몰아서 작업한 사람은 누구인가요?',
  convention: '커밋 메시지는 어떤 규칙으로 썼나요?',
  pulls: 'PR은 누가 얼마나 올렸나요?',
  teamwork: '이 팀의 협업 방식을 훔치고 싶어요',
  person: '특정 참여자만 자세히 보고 싶어요',
}

export interface FollowupPerson {
  id: string
  name: string
}

export type ChartSpec =
  | {
      title: string
      /** columns는 세로 막대(시간 흐름), bars는 가로 막대(항목 비교) */
      kind: 'columns' | 'bars'
      items: { label: string; value: number; display?: string }[]
    }
  | {
      title: string
      /** 줄마다 한 사람, 칸마다 한 시간대를 색의 진하기로 보여줘요. */
      kind: 'heatmap'
      columns: string[]
      rows: { label: string; values: number[] }[]
    }

/** 기술 스택을 종류별로 묶은 것 */
export interface StackGroup {
  category: string
  items: string[]
}

export type ChatEvent =
  | { type: 'text'; text: string }
  /** 기여도 순서대로 정렬된 참여자별 수치 카드 묶음. 화면에서는 말풍선 하나 안에서 좌우로 넘겨 봐요. */
  | { type: 'ranking'; text: string; contributors: ContributorStats[] }
  | {
      type: 'summary'
      text: string
      contributors: ContributorStats[]
      othersCount: number
    }
  /** 번호가 붙은 목록 말풍선. 참여자가 맡은 기능과 코드 스타일에 써요. */
  | { type: 'list'; text: string; items: string[] }
  /** 레포에서 사용한 기술 스택 */
  | { type: 'stack'; text: string; groups: StackGroup[] }
  | { type: 'chart'; text: string; charts: ChartSpec[] }
  /** 이름과 값이 짝을 이루는 표 */
  | { type: 'facts'; text: string; items: { label: string; value: string }[] }
  /** 추가 질문을 고르는 말풍선 */
  | { type: 'followup'; text: string; people: FollowupPerson[] }
  /** 참여자가 많을 때, 맡은 기능과 코드 스타일을 살펴볼 사람을 고르게 해요. top은 "상위 N명"의 N, max는 고를 수 있는 최대 인원이에요. */
  | { type: 'pick'; text: string; people: FollowupPerson[]; top: number; max: number }
  /** 분석을 시작하기 전에 lock 파일과 빌드 결과물을 뺄지 물어봐요. */
  | { type: 'ask'; text: string }
  /** action이 있으면 말풍선 안에 다시 시도 버튼을 보여줘요. */
  | { type: 'error'; text: string; action?: 'retry' }
  /** 한 단계가 끝났어요. 사용자가 계속하기를 누를 때까지 다음 말풍선을 올리지 않아요. next는 다음 단계 안내예요. */
  | { type: 'pause'; next: string }
  | { type: 'done' }

/** 저장된 채팅의 말풍선 하나. 화면에 올라간 순서대로 쌓여요. */
export type StoredMessage =
  | { from: 'user'; text: string }
  | { from: 'bot'; event: Exclude<ChatEvent, { type: 'done' | 'pause' }>; request?: AnalyzeRequest }

/** 서버가 저장된 채팅을 돌려줄 때의 모양 */
export interface ChatSnapshot {
  id: string
  repoUrl: string
  /** 공유된 채팅은 누구나 열람할 수 있고, 더 이상 이어서 작업할 수 없어요. */
  shared: boolean
  /** 지금 보고 있는 브라우저가 이 채팅을 만든 곳인지 여부 */
  owner: boolean
  messages: StoredMessage[]
}

export interface AnalyzeRequest {
  url: string
  /** 저장할 채팅방의 ID. Supabase가 켜져 있을 때만 써요. */
  chatId?: string
  /** 이 요청과 함께 화면에 올라간 사용자 말풍선의 글. 채팅을 저장할 때 같이 남겨요. */
  userText?: string
  /**
   * true면 커밋 단위로 분석해서 lock 파일, 빌드 결과물, 자동 생성 파일, 바이너리 파일을 라인 수에서 제외해요.
   * 값을 보내지 않으면 서버가 레포를 확인한 뒤 어떻게 계산할지 먼저 물어봐요.
   */
  excludeGenerated?: boolean
  /** 분석이 끝난 뒤의 추가 질문. 있으면 분석 대신 이 질문에만 답해요. */
  question?: FollowupQuestion
  /** question이 person일 때 살펴볼 참여자 */
  person?: string
  /** 맡은 기능과 코드 스타일을 살펴볼 참여자들. 참여자가 많아서 고르라고 물어봤을 때 답으로 보내요. */
  people?: string[]
  /** 시간대별 통계를 사용자의 시간대로 계산하기 위한 값 (예: Asia/Seoul) */
  timeZone?: string
}
