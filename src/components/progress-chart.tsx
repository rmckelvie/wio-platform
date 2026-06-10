/**
 * Minimal server-rendered SVG line chart. One series, one Y-axis, week
 * indices on the X-axis. No client JS — renders straight from props.
 *
 * Designed for "top set weight per week" visualisations on the cross-week
 * exercise view. Handles sparse data (gaps for weeks with no logs) by
 * connecting only consecutive populated points.
 */
export interface ChartPoint {
  weekIndex: number
  value: number | null // null = no data this week
  label?: string // e.g. "65kg × 5"
}

export function ProgressChart({
  points,
  yLabel = 'Top set (kg)',
  height = 180,
}: {
  points: ChartPoint[]
  yLabel?: string
  height?: number
}) {
  if (points.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No data to chart yet.</p>
    )
  }

  const populated = points.filter((p) => p.value !== null) as Array<
    ChartPoint & { value: number }
  >
  if (populated.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sets logged yet — log some to see a chart.
      </p>
    )
  }

  // ViewBox: 0..VW horizontally, 0..VH vertically. Use a generous coord
  // space so SVG scales crisply at any rendered size.
  const VW = 600
  const VH = 240
  const padL = 48
  const padR = 16
  const padT = 16
  const padB = 36
  const chartW = VW - padL - padR
  const chartH = VH - padT - padB

  const xs = points.map((p) => p.weekIndex)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs, minX + 1) // avoid divide-by-zero when one point

  const ys = populated.map((p) => p.value)
  const rawMax = Math.max(...ys)
  const rawMin = Math.min(...ys)
  // Add a bit of headroom; bottom at floor or 0 if data near zero
  const yMax = niceCeil(rawMax + (rawMax - rawMin) * 0.1 || rawMax + 1)
  const yMin =
    rawMin === rawMax
      ? Math.max(0, rawMin - rawMin * 0.2 || -1)
      : Math.max(0, niceFloor(rawMin - (rawMax - rawMin) * 0.1))

  const xPos = (weekIndex: number) =>
    padL +
    ((weekIndex - minX) / Math.max(1, maxX - minX)) * chartW

  const yPos = (v: number) =>
    padT + chartH - ((v - yMin) / Math.max(1, yMax - yMin)) * chartH

  // Y-axis ticks: 4 evenly-spaced
  const ticks = 4
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) * i) / ticks
    return { v, y: yPos(v) }
  })

  // Build polyline segments that skip null-gap rows
  const segments: Array<Array<{ x: number; y: number }>> = []
  let current: Array<{ x: number; y: number }> = []
  for (const p of points) {
    if (p.value === null) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
    } else {
      current.push({ x: xPos(p.weekIndex), y: yPos(p.value) })
    }
  }
  if (current.length > 0) segments.push(current)

  return (
    <figure
      className="rounded-xl border border-border bg-card p-3"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label={`Line chart of ${yLabel} across ${points.length} weeks`}
      >
        {/* Grid lines + Y labels */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={VW - padR}
              y1={t.y}
              y2={t.y}
              stroke="currentColor"
              strokeOpacity={i === 0 ? 0.3 : 0.12}
              strokeWidth={1}
            />
            <text
              x={padL - 6}
              y={t.y + 4}
              textAnchor="end"
              fontSize={12}
              fill="currentColor"
              fillOpacity={0.6}
            >
              {formatTick(t.v)}
            </text>
          </g>
        ))}

        {/* X axis labels (every week) */}
        {points.map((p) => (
          <text
            key={p.weekIndex}
            x={xPos(p.weekIndex)}
            y={VH - padB + 18}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            fillOpacity={0.6}
          >
            W{p.weekIndex}
          </text>
        ))}

        {/* Line(s) */}
        {segments.map((seg, i) => (
          <polyline
            key={i}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
          />
        ))}

        {/* Points */}
        {populated.map((p) => (
          <g key={p.weekIndex}>
            <circle
              cx={xPos(p.weekIndex)}
              cy={yPos(p.value)}
              r={4.5}
              fill="var(--color-brand)"
            />
            {p.label && (
              <text
                x={xPos(p.weekIndex)}
                y={yPos(p.value) - 10}
                textAnchor="middle"
                fontSize={11}
                fontWeight={500}
                fill="currentColor"
                fillOpacity={0.9}
              >
                {p.label}
              </text>
            )}
          </g>
        ))}

        {/* Y-axis title */}
        <text
          transform={`rotate(-90, 14, ${padT + chartH / 2})`}
          x={14}
          y={padT + chartH / 2}
          textAnchor="middle"
          fontSize={11}
          fill="currentColor"
          fillOpacity={0.55}
        >
          {yLabel}
        </text>
      </svg>
    </figure>
  )
}

function formatTick(v: number): string {
  if (Number.isInteger(v)) return v.toString()
  return v.toFixed(1)
}

/** Round up to the nearest "nice" number — multiples of 5/10/25 etc. */
function niceCeil(v: number): number {
  if (v <= 10) return Math.ceil(v)
  const mag = Math.pow(10, Math.floor(Math.log10(v)))
  const norm = v / mag
  let nice: number
  if (norm <= 1) nice = 1
  else if (norm <= 2) nice = 2
  else if (norm <= 2.5) nice = 2.5
  else if (norm <= 5) nice = 5
  else nice = 10
  return Math.ceil(v / (nice * mag / 5)) * (nice * mag / 5)
}

function niceFloor(v: number): number {
  if (v <= 0) return 0
  if (v <= 10) return Math.floor(v)
  return Math.floor(v / 5) * 5
}
