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
  /** 참여자가 개발한 기능 목록 */
  | { type: 'features'; text: string; items: string[] }
  /** 분석을 시작하기 전에 lock 파일과 빌드 결과물을 뺄지 물어봐요. */
  | { type: 'ask'; text: string }
  | { type: 'error'; text: string; action?: 'login' }
  | { type: 'done' }

export interface AnalyzeRequest {
  url: string
  /**
   * true면 커밋 단위로 분석해서 lock 파일, 빌드 결과물, 자동 생성 파일, 바이너리 파일을 라인 수에서 제외해요.
   * 값을 보내지 않으면 서버가 레포를 확인한 뒤 어떻게 계산할지 먼저 물어봐요.
   */
  excludeGenerated?: boolean
}

export interface SessionUser {
  login: string
  avatarUrl: string
}
