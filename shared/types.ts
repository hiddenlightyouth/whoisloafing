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
export type FollowupQuestion = 'hours' | 'timeline' | 'spurt' | 'convention' | 'pulls' | 'person'

export const FOLLOWUP_LABELS: Record<FollowupQuestion, string> = {
  hours: '우리 팀은 보통 몇 시에 활동했나요?',
  timeline: '프로젝트는 어떤 흐름으로 진행됐나요?',
  spurt: '막판에 가장 몰아서 작업한 사람은 누구인가요?',
  convention: '커밋 메시지는 어떤 규칙으로 썼나요?',
  pulls: 'PR은 누가 얼마나 올렸나요?',
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
  | { type: 'chart'; text: string; charts: ChartSpec[] }
  /** 이름과 값이 짝을 이루는 표 */
  | { type: 'facts'; text: string; items: { label: string; value: string }[] }
  /** 추가 질문을 고르는 말풍선 */
  | { type: 'followup'; text: string; people: FollowupPerson[] }
  /** 분석을 시작하기 전에 lock 파일과 빌드 결과물을 뺄지 물어봐요. */
  | { type: 'ask'; text: string }
  /** action이 있으면 말풍선 안에 로그인 버튼이나 다시 시도 버튼을 보여줘요. */
  | { type: 'error'; text: string; action?: 'login' | 'retry' }
  | { type: 'done' }

export interface AnalyzeRequest {
  url: string
  /**
   * true면 커밋 단위로 분석해서 lock 파일, 빌드 결과물, 자동 생성 파일, 바이너리 파일을 라인 수에서 제외해요.
   * 값을 보내지 않으면 서버가 레포를 확인한 뒤 어떻게 계산할지 먼저 물어봐요.
   */
  excludeGenerated?: boolean
  /** 분석이 끝난 뒤의 추가 질문. 있으면 분석 대신 이 질문에만 답해요. */
  question?: FollowupQuestion
  /** question이 person일 때 살펴볼 참여자 */
  person?: string
  /** 시간대별 통계를 사용자의 시간대로 계산하기 위한 값 (예: Asia/Seoul) */
  timeZone?: string
}

export interface SessionUser {
  login: string
  avatarUrl: string
}
