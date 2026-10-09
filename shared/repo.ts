/** 여러 형태의 GitHub 레포 주소에서 owner와 repo를 뽑아내요. */
export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim()
  const match =
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s?#]+)/i.exec(trimmed) ??
    /^git@github\.com:([^/\s]+)\/([^/\s]+)$/i.exec(trimmed) ??
    /^([^/\s]+)\/([^/\s]+)$/.exec(trimmed)
  if (!match) return null
  const owner = match[1]
  const repo = match[2].replace(/\.git$/i, '')
  const valid = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(owner) && /^[A-Za-z0-9._-]+$/.test(repo)
  return valid && repo !== '.' && repo !== '..' ? { owner, repo } : null
}
