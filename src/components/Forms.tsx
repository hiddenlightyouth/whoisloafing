import type { ReactNode } from 'react'
import type { FormField, FormTemplate, RepoLabel } from '../../shared/types'
import { Source, tag } from './DeepParts'
import { messages, useMessages } from '../lib/i18n'

const TEXT = messages({
  ko: {
    title: '제목',
    free: (issue: boolean) => `따로 나눈 항목 없이 자유롭게 쓰는 ${issue ? '이슈' : 'PR'} 양식이에요.`,
    labelsUsed: '이 라벨이 사용됨',
    assignees: '자동으로 정해지는 담당자',
    required: '필수',
    labels: '라벨',
    issues: (count: number) => `${count.toLocaleString('ko-KR')}개의 이슈`,
    more: (count: number) => `그 밖에 ${count}개`,
  },
  en: {
    title: 'Title',
    free: (issue: boolean) => `A free-form ${issue ? 'issue' : 'PR'} template with no separate sections.`,
    labelsUsed: 'Labels applied',
    assignees: 'Auto-assigned to',
    required: 'Required',
    labels: 'Labels',
    issues: (count: number) => `${count.toLocaleString('en-US')} ${count === 1 ? 'issue' : 'issues'}`,
    more: (count: number) => `${count} more`,
  },
})

interface Props {
  kind: 'issue' | 'pull'
  templates: FormTemplate[]
  labels?: RepoLabel[]
  /** 넓은 자리에 그릴 때 true. 양식 옆에 원문을 나란히 보여주고, 라벨도 설명과 함께 다 보여줘요. */
  large: boolean
}

/** 말풍선 안에서는 라벨을 이만큼만 보여줘요. */
const COMPACT_LABELS = 10

/**
 * 이슈 템플릿이나 PR 템플릿을 원문 대신 실제로 글을 쓸 때 보이는 양식처럼 그려요.
 * 무엇을 적어야 하는지, 무엇이 필수인지, 어떤 라벨이 자동으로 붙는지가 한눈에 보여요.
 */
export function Forms({ kind, templates, labels = [], large }: Props) {
  return (
    <div className="space-y-4">
      {/* 템플릿은 고르게 하지 않고 한 번에 다 보여줘요. 왼쪽이 양식, 오른쪽이 원문이에요. */}
      {templates.map((template) => (
        <div key={template.path} className={large ? 'lg:grid lg:grid-cols-2 lg:items-start lg:gap-4' : ''}>
          <Preview template={template} kind={kind} labels={labels} scroll={!large} />
          {large ? (
            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 lg:mt-0">
              <Source path={template.path} content={template.content} kind={kind} />
            </div>
          ) : (
            <p className="mt-2 font-mono text-[12px] tracking-normal break-all text-gray-400">{template.path}</p>
          )}
        </div>
      ))}

      {labels.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <Labels labels={labels} large={large} />
        </div>
      )}
    </div>
  )
}

function Preview({ template, kind, labels, scroll }: { template: FormTemplate; kind: 'issue' | 'pull'; labels: RepoLabel[]; scroll: boolean }) {
  const L = useMessages(TEXT)
  const colorOf = (name: string) => labels.find((label) => label.name === name)?.color ?? ''

  return (
    <div className={`rounded-xl border border-gray-200 bg-white p-5 ${scroll ? 'max-h-96 overflow-y-auto' : ''}`}>
      <p className="text-[15.5px] font-semibold text-gray-900">{template.name}</p>
      {template.about && <p className="mt-1 text-[13px] leading-snug text-gray-500">{template.about}</p>}

      <div className="mt-5 space-y-5">
        {template.title && (
          <Field label={L.title}>
            <Box>{template.title}</Box>
          </Field>
        )}
        {template.fields.map((field, item) => (
          <FieldView key={`${item}:${field.label}`} field={field} />
        ))}
        {template.fields.length === 0 && (
          <p className="text-[13px] text-gray-500">
            {L.free(kind === 'issue')}
          </p>
        )}
      </div>

      {(template.labels.length > 0 || template.assignees.length > 0) && (
        <dl className="mt-6 space-y-3 border-t border-gray-100 pt-4">
          {template.labels.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <dt className="mr-1 text-[13px] text-gray-500">{L.labelsUsed}</dt>
              {template.labels.map((name) => (
                <dd key={name}>
                  <LabelChip name={name} color={colorOf(name)} />
                </dd>
              ))}
            </div>
          )}
          {template.assignees.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <dt className="mr-1 text-[13px] text-gray-500">{L.assignees}</dt>
              {template.assignees.map((name) => (
                <dd key={name} className={tag}>
                  {name}
                </dd>
              ))}
            </div>
          )}
        </dl>
      )}
    </div>
  )
}

function FieldView({ field }: { field: FormField }) {
  if (field.kind === 'note') {
    return <p className="rounded-md bg-gray-50 px-3 py-2 text-[12.5px] leading-snug text-gray-600">{field.label}</p>
  }

  if (field.kind === 'checkboxes') {
    return (
      <Field label={field.label} hint={field.hint}>
        <ul className="space-y-2">
          {(field.options ?? []).map((option, item) => (
            <li key={`${item}:${option}`} className="flex gap-2.5 text-[13.5px] leading-snug text-gray-700">
              <span className="mt-[1px] size-4 shrink-0 rounded-[5px] border border-gray-300" aria-hidden="true" />
              <span className="min-w-0">{option}</span>
            </li>
          ))}
        </ul>
      </Field>
    )
  }

  if (field.kind === 'dropdown') {
    return (
      <Field label={field.label} hint={field.hint} required={field.required}>
        <div className="flex flex-wrap gap-1.5">
          {(field.options ?? []).map((option, item) => (
            <span key={`${item}:${option}`} className={tag}>
              {option}
            </span>
          ))}
        </div>
      </Field>
    )
  }

  return (
    <Field label={field.label} required={field.required}>
      <Box tall={field.kind === 'textarea'} muted>
        {field.hint ?? ''}
      </Box>
    </Field>
  )
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  const L = useMessages(TEXT)
  return (
    <div>
      <p className="text-[13.5px] font-medium text-gray-900">
        {label}
        {required && <span className="ml-2 text-[12px] font-medium text-brand">{L.required}</span>}
      </p>
      {hint && <p className="mt-1 text-[12.5px] leading-snug text-gray-500">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** 글을 적는 칸을 흉내 낸 빈 상자예요. 실제로 입력할 수는 없어요. */
function Box({ children, tall = false, muted = false }: { children: ReactNode; tall?: boolean; muted?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-[13px] leading-snug ${tall ? 'min-h-20' : 'min-h-10'} ${
        muted ? 'text-gray-400' : 'text-gray-700'
      }`}
    >
      {children}
    </div>
  )
}

function Labels({ labels, large }: { labels: RepoLabel[]; large: boolean }) {
  const L = useMessages(TEXT)
  const shown = large ? labels : labels.slice(0, COMPACT_LABELS)
  const hidden = labels.length - shown.length

  return (
    <div>
      <p className="mb-3 text-[13px] font-medium text-gray-500">{L.labels}</p>
      {large ? (
        <ul className="divide-y divide-gray-100">
          {shown.map((label) => (
            <li key={label.name} className="flex items-center gap-3 py-2.5">
              <span className="shrink-0">
                <LabelChip name={label.name} color={label.color} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-gray-500">{label.description ?? ''}</span>
              <span className="shrink-0 text-[12.5px] text-gray-500 tabular-nums">{L.issues(label.count)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((label) => (
            <LabelChip key={label.name} name={label.name} color={label.color} count={label.count} />
          ))}
          {hidden > 0 && <span className="self-center text-[12px] text-gray-400">{L.more(hidden)}</span>}
        </div>
      )}
    </div>
  )
}

/** 라벨 색은 GitHub에 등록된 값을 그대로 써요. 테마와 상관없는 자료라 토큰 색을 쓰지 않아요. */
function LabelChip({ name, color, count }: { name: string; color: string; count?: number }) {
  return (
    <span className={tag}>
      <span
        className="size-2 shrink-0 rounded-full bg-gray-300"
        style={/^[0-9a-f]{6}$/i.test(color) ? { backgroundColor: `#${color}` } : undefined}
        aria-hidden="true"
      />
      <span className="truncate">{name}</span>
      {count !== undefined && count > 0 && <span className="text-gray-400 tabular-nums">{count}</span>}
    </span>
  )
}
