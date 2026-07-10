// Lightweight dependency-free SVG charts for the admin dashboard.

interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export function BarList({ data, emptyText = "No data" }: { data: BarDatum[]; emptyText?: string }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-gray-400">{emptyText}</p>;
  }
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="truncate text-gray-700" title={d.label}>
              {d.label}
            </span>
            <span className="ml-2 font-semibold text-gray-900">{d.value}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? "#4f46e5",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LinePoint {
  date: string;
  count: number;
}

export function LineChart({ data, height = 200 }: { data: LinePoint[]; height?: number }) {
  if (!data.length) {
    return <p className="py-8 text-center text-sm text-gray-400">No data</p>;
  }
  const width = 640;
  const padding = { top: 16, right: 16, bottom: 28, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;
  const max = Math.max(...data.map((d) => d.count), 1);

  const x = (i: number) => padding.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => padding.top + innerH - (v / max) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.count)}`).join(" ");
  const areaPath =
    `M ${x(0)} ${padding.top + innerH} ` +
    data.map((d, i) => `L ${x(i)} ${y(d.count)}`).join(" ") +
    ` L ${x(data.length - 1)} ${padding.top + innerH} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 480 }}>
        {/* horizontal gridlines */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + innerH * t}
            y2={padding.top + innerH * t}
            stroke="#f1f5f9"
            strokeWidth={1}
          />
        ))}
        <path d={areaPath} fill="#4f46e5" fillOpacity={0.08} />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.date} cx={x(i)} cy={y(d.count)} r={3} fill="#4f46e5">
            <title>{`${d.date}: ${d.count}`}</title>
          </circle>
        ))}
        {/* x-axis labels — show first, middle, last */}
        {[0, Math.floor(data.length / 2), data.length - 1]
          .filter((v, idx, arr) => arr.indexOf(v) === idx)
          .map((i) => (
            <text
              key={i}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-gray-400"
              fontSize={11}
            >
              {data[i]?.date.slice(5)}
            </text>
          ))}
      </svg>
    </div>
  );
}

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function Donut({ data, size = 160 }: { data: DonutSlice[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return <p className="py-8 text-center text-sm text-gray-400">No data</p>;
  }
  const radius = size / 2;
  const stroke = size * 0.16;
  const r = radius - stroke / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${radius} ${radius})`}>
          {data.map((d) => {
            const frac = d.value / total;
            const dash = frac * circumference;
            const el = (
              <circle
                key={d.label}
                cx={radius}
                cy={radius}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeDashoffset={-offset}
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
        </g>
        <text x={radius} y={radius} textAnchor="middle" dominantBaseline="central" fontSize={22} fontWeight={700} className="fill-gray-900">
          {total}
        </text>
      </svg>
      <div className="space-y-2">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: d.color }} />
            <span className="text-gray-700">{d.label}</span>
            <span className="ml-auto font-semibold text-gray-900">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
