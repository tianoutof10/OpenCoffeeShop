import { useId, useRef, type PointerEvent } from 'react'
import { t } from '../../i18n/index.ts'
import './tasteSquare.css'

export interface TastePoint { extraction: number; strength: number }

interface TasteSquareProps {
  /** The point being set (interactive) or the latest tasting (display). */
  value?: TastePoint
  onChange?: (point: TastePoint) => void
  /** Earlier tastings of this bag, oldest first, drawn as a joined path. */
  path?: TastePoint[]
  /** A refractometer reading placed on the same square. */
  measured?: TastePoint
  /** Milk drinks: the target sits higher on strength. */
  targetStrength?: number
  /** Target radius in axis units. */
  targetRadius?: number
  size?: 'large' | 'small'
  /** Hides axis words (for very small inline use). */
  bare?: boolean
}

const EXTENT = 1.12
const clamp = (value: number) => Math.max(-1, Math.min(1, value))
const round = (value: number) => Math.round(value * 100) / 100
const sx = (extraction: number) => extraction
const sy = (strength: number) => -strength

/**
 * The brewing control chart as one square: sour ← → bitter across, weak ↓ ↑
 * strong. Tap or drag to set a tasting; arrow keys move it in tenths. The ring
 * is the target (it moves up for milk drinks).
 */
export function TasteSquare({ value, onChange, path = [], measured, targetStrength = 0, targetRadius = 0.3, size = 'large', bare = false }: TasteSquareProps) {
  const id = useId()
  const svg = useRef<SVGSVGElement>(null)
  const dragging = useRef(false)
  const interactive = Boolean(onChange)
  const set = (point: TastePoint) => onChange?.({ extraction: round(clamp(point.extraction)), strength: round(clamp(point.strength)) })
  const fromPointer = (event: PointerEvent<SVGSVGElement>) => {
    const box = svg.current?.getBoundingClientRect()
    if (!box) return
    const x = ((event.clientX - box.left) / box.width) * 2 * EXTENT - EXTENT
    const y = ((event.clientY - box.top) / box.height) * 2 * EXTENT - EXTENT
    set({ extraction: x, strength: -y })
  }
  const points = path.map(point => `${sx(point.extraction)},${sy(point.strength)}`).join(' ')
  const lastPath = path.at(-1)
  const showValue = value && !(lastPath && lastPath.extraction === value.extraction && lastPath.strength === value.strength && !interactive)

  return <div className={`taste-square taste-square--${size}${interactive ? ' taste-square--interactive' : ''}${bare ? ' taste-square--bare' : ''}`}>
    {!bare && <>
      <span className="taste-square__axis taste-square__axis--top">{t('insights.taste.strong')}</span>
      <span className="taste-square__axis taste-square__axis--bottom">{t('insights.taste.weak')}</span>
      <span className="taste-square__axis taste-square__axis--left">{t('insights.taste.sour')}</span>
      <span className="taste-square__axis taste-square__axis--right">{t('insights.taste.bitter')}</span>
    </>}
    <svg ref={svg} className="taste-square__plot" viewBox={`${-EXTENT} ${-EXTENT} ${EXTENT * 2} ${EXTENT * 2}`} role={interactive ? 'presentation' : 'img'} aria-label={interactive ? undefined : t('insights.taste.pathAriaLabel', { count: path.length })}
      onPointerDown={interactive ? (event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); fromPointer(event) } : undefined}
      onPointerMove={interactive ? (event) => { if (dragging.current) fromPointer(event) } : undefined}
      onPointerUp={interactive ? () => { dragging.current = false } : undefined}
      onPointerCancel={interactive ? () => { dragging.current = false } : undefined}>
      <rect className="taste-square__frame" x={-EXTENT} y={-EXTENT} width={EXTENT * 2} height={EXTENT * 2} rx={size === 'large' ? 0.06 : 0.1} />
      <line className="taste-square__cross" x1={-EXTENT} y1={0} x2={EXTENT} y2={0} />
      <line className="taste-square__cross" x1={0} y1={-EXTENT} x2={0} y2={EXTENT} />
      <circle className="taste-square__target" cx={0} cy={sy(targetStrength)} r={targetRadius} />
      {path.length > 1 && <polyline className="taste-square__path" points={points} />}
      {path.map((point, index) => <circle key={index} className={`taste-square__dot${index === path.length - 1 && !showValue ? ' taste-square__dot--latest' : ''}`} cx={sx(point.extraction)} cy={sy(point.strength)} r={index === path.length - 1 && !showValue ? 0.065 : 0.04} />)}
      {measured && <circle className="taste-square__measured" cx={sx(measured.extraction)} cy={sy(measured.strength)} r={0.07} />}
      {showValue && <>
        {lastPath && interactive && <line className="taste-square__step" x1={sx(lastPath.extraction)} y1={sy(lastPath.strength)} x2={sx(value.extraction)} y2={sy(value.strength)} />}
        <circle className="taste-square__value-halo" cx={sx(value.extraction)} cy={sy(value.strength)} r={0.14} />
        <circle className="taste-square__value" cx={sx(value.extraction)} cy={sy(value.strength)} r={0.075} />
      </>}
    </svg>
    {interactive && <div className="taste-square__keys">
      <label htmlFor={`${id}-x`}>{t('insights.taste.extractionAxis')}</label>
      <input id={`${id}-x`} type="range" min={-1} max={1} step={0.1} value={value?.extraction ?? 0} aria-valuetext={value ? undefined : t('insights.taste.notSet')} onChange={event => set({ extraction: Number(event.target.value), strength: value?.strength ?? 0 })} />
      <label htmlFor={`${id}-y`}>{t('insights.taste.strengthAxis')}</label>
      <input id={`${id}-y`} type="range" min={-1} max={1} step={0.1} value={value?.strength ?? 0} aria-valuetext={value ? undefined : t('insights.taste.notSet')} onChange={event => set({ extraction: value?.extraction ?? 0, strength: Number(event.target.value) })} />
    </div>}
  </div>
}
