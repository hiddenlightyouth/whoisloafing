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
  | { type: 'stats'; text: string; contributor: ContributorStats }
  | {
      type: 'summary'
      text: string
      contributors: ContributorStats[]
      othersCount: number
      /** lock 파일과 빌드 결과물을 빼고 다시 계산할 수 있는지 여부 */
      canRefine: boolean
    }
  | { type: 'error'; text: string; action?: 'login' }
  | { type: 'done' }

export interface AnalyzeRequest {
  url: string
  /** 커밋 단위로 분석해서 lock 파일, 빌드 결과물, 자동 생성 파일, 바이너리 파일을 라인 수에서 제외해요. */
  excludeGenerated?: boolean
}

export interface SessionUser {
  login: string
  avatarUrl: string
}
