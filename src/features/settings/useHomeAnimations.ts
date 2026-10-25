import { useEffect, useState } from 'react'
import { useOpenCoffeeShopPreferences } from './openCoffeeShopPreferences'

/** OS reduced motion remains authoritative, even with the app toggle on. */
export function useHomeAnimations() {
  const { preferences } = useOpenCoffeeShopPreferences()
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return preferences.animationsEnabled && !reducedMotion
}
