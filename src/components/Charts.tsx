import type { ChartSpec } from '../../shared/types'

/** 세로 막대. 시간 흐름처럼 순서가 있는 값을 보여줘요. 아래 이름표는 몇 개만 골라서 보여줘요. */
function Columns({ items }: { items: ChartSpec['items'] }) {
  const max = Math.max(1, ...items.map((item) => item.value))
  const step = Math.max(1, Math.ceil(items.length / 5))

  return (
    <div className="mt-3">
      <div className="flex h-24 items-end gap-[3px]">
        {items.map((item, index) => (
          <div
            key={`${index}:${item.label}`}
            title={item.display ?? `${item.label}, ${item.value}`}
            className="flex h-full min-w-0 flex-1 items-end"
          >
            <div
              className={`w-full rounded-t-[3px] ${item.value === max ? 'bg-brand' : 'bg-brand/40'}`}
              style={{ height: `${item.value > 0 ? Math.max(4, (item.value / max) * 100) : 0}%`, minHeight: item.value > 0 ? 2 : 0 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] border-t border-gray-100 pt-1.5">
        {items.map((item, index) => (
          <span key={`${index}:${item.label}`} className="relative h-4 min-w-0 flex-1">
            {index % step === 0 && (
              <span className="absolute left-0 whitespace-nowrap text-[11px] text-gray-400 tabular-nums">{item.label}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 가로 막대. 사람이나 항목끼리 비교할 때 써요. */
function Bars({ items }: { items: ChartSpec['items'] }) {
  const max = Math.max(1, ...items.map((item) => item.value))

  return (
    <ul className="mt-2.5 space-y-2">
      {items.map((item, index) => (
        <li key={`${index}:${item.label}`} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-[13px] text-gray-900 sm:w-28">{item.label}</span>
          <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${item.value > 0 ? Math.max(1.5, (item.value / max) * 100) : 0}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs text-gray-700 tabular-nums">{item.display ?? item.value}</span>
        </li>
      ))}
    </ul>
  )
}

export function Charts({ charts }: { charts: ChartSpec[] }) {
  return (
    <div className="mt-3 space-y-5 rounded-xl bg-white p-4">
      {charts.map((chart) => (
        <section key={chart.title}>
          <h3 className="text-xs font-medium text-gray-500">{chart.title}</h3>
          {chart.kind === 'columns' ? <Columns items={chart.items} /> : <Bars items={chart.items} />}
        </section>
      ))}
    </div>
  )
}

export function Facts({ items }: { items: { label: string; value: string }[] }) {
  return (
    <dl className="mt-3 mb-1.5 divide-y divide-gray-100 rounded-xl bg-white px-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-4 py-2.5">
          <dt className="shrink-0 text-[13px] text-gray-500">{item.label}</dt>
          <dd className="min-w-0 text-right text-[14px] font-medium text-gray-900 tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
