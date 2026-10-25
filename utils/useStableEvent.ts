import { useCallback, useLayoutEffect, useRef } from 'react'

/** Stable event prop for memoized display components. Read the latest committed
 * callback at interaction time, never retain an old profile/connection closure.
 * Only call the returned function from events, not during rendering. */
export function useStableEvent<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const current = useRef(callback)
  useLayoutEffect(() => { current.current = callback })
  return useCallback((...args: Args) => current.current(...args), [])
}
