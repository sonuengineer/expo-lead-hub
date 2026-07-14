// Reusable circular score gauge (0–100), shared by the roast report and the
// booth partnership calculator.

export function scoreColor(v?: number | null) {
  if (v == null) return "#94a3b8";
  if (v >= 90) return "#16a34a";
  if (v >= 50) return "#f59e0b";
  return "#dc2626";
}

export function ScoreRing({
  label,
  value,
  size = 64,
  color,
}: {
  label?: string;
  value?: number | null;
  size?: number;
  color?: string;
}) {
  const v = value ?? 0;
  const stroke = Math.max(4, Math.round(size * 0.094));
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const dash = (Math.min(100, Math.max(0, v)) / 100) * c;
  const cx = size / 2;
  const ringColor = color ?? scoreColor(value);
  const fontSize = Math.round(size * 0.24);

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${c - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        <text
          x={cx}
          y={cx}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontWeight={700}
          fill="currentColor"
        >
          {value == null ? "–" : Math.round(v)}
        </text>
      </svg>
      {label && <span className="text-xs font-medium opacity-70">{label}</span>}
    </div>
  );
}
