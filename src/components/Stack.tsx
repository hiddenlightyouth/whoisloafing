import type { TechGroup } from '../../shared/types'

/**
 * 심층 분석의 기술 스택 탭이에요. 종류마다 한 줄로 세우고, 기술마다 구조 맵의 칸과 같은 모양의 칸에 이름, 버전, 이 프로젝트에서 맡은 역할을 적어요.
 * 언어는 코드에서 차지하는 비율을 오른쪽 숫자와 칸 아래의 가는 선으로 같이 보여줘요.
 */
export function Stack({ groups }: { groups: TechGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center bg-gray-50 px-6">
        <p className="animate-rise text-center text-[14px] leading-relaxed text-gray-600">아직 살펴볼 기술이 없어요.</p>
      </div>
    )
  }

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-gray-50 p-4">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-8">
        {groups.map((group, column) => (
          <section key={group.category} className="w-60 animate-rise" style={{ animationDelay: `${column * 60}ms` }}>
            <h3 className="flex h-9 items-center gap-1.5 px-1 text-[13px] font-medium text-gray-500">
              {group.category}
              <span className="text-gray-400 tabular-nums">{group.items.length}</span>
            </h3>
            <ul className="space-y-2">
              {group.items.map((item) => (
                <li key={item.name} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white px-3.5 py-2.5">
                  <p className="flex items-baseline gap-1.5">
                    <span className="min-w-0 truncate text-[13.5px] font-semibold text-gray-900">{item.name}</span>
                    {item.version && <span className="shrink-0 text-[12px] text-gray-500 tabular-nums">{item.version}</span>}
                    {item.share !== undefined && <span className="ml-auto shrink-0 text-[12px] text-gray-500 tabular-nums">{item.share}%</span>}
                  </p>
                  {item.role && <p className="mt-0.5 truncate text-[12px] text-gray-500">{item.role}</p>}
                  {item.share !== undefined && (
                    <span className="absolute bottom-0 left-0 h-[3px] origin-left animate-grow bg-brand" style={{ width: `${Math.max(3, item.share)}%`, opacity: 0.55 }} aria-hidden="true" />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
