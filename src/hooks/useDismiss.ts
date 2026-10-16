import { useEffect, useRef, type RefObject } from 'react'

interface Options {
  /** 누름을 캡처 단계에서 받아요. 안쪽에서 누름을 막아 두는 화면(구조 맵)에서도 닫히게 할 때 써요. */
  capture?: boolean
  /** 바깥을 눌렀어도 닫지 않을 곳이에요. 메뉴를 여닫는 버튼처럼 스스로 닫는 것을 고를 때 써요. */
  ignore?: (target: Element) => boolean
}

/** 열려 있는 동안 바깥을 누르거나 Esc를 누르면 닫아요. ref가 없으면 Esc만 받아요. */
export function useDismiss(open: boolean, ref: RefObject<HTMLElement | null> | null, close: () => void, options: Options = {}) {
  // close와 ignore는 그릴 때마다 새로 만들어지기 쉬워서, 최신 값만 들고 있고 다시 등록하지 않아요.
  const latest = useRef({ close, ignore: options.ignore })
  latest.current = { close, ignore: options.ignore }
  const capture = options.capture ?? false

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!ref) return
      const target = event.target as Element
      if (ref.current?.contains(target) || latest.current.ignore?.(target)) return
      latest.current.close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') latest.current.close()
    }
    document.addEventListener('pointerdown', onPointerDown, capture)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, capture)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, ref, capture])
}
