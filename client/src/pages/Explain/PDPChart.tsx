import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface PDPPoint {
  feature_value: number
  mean_prediction: number
  lower: number
  upper: number
}

interface PDPChartProps {
  feature: string
  points: PDPPoint[]
  isClassification: boolean
}

export function PDPChart({ feature, points, isClassification }: PDPChartProps) {
  const data = points.map((p) => ({
    x: p.feature_value,
    mean: p.mean_prediction,
    band_lower: p.lower,
    band_upper: p.upper,
    // recharts Area uses [lower, upper] as a range when given two keys
    range: [p.lower, p.upper] as [number, number],
  }))

  const yLabel = isClassification ? 'Predicted Probability' : 'Predicted Value'

  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 10, right: 24, left: 8, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis
          dataKey="x"
          type="number"
          domain={['auto', 'auto']}
          tickCount={8}
          label={{ value: feature, position: 'insideBottom', offset: -10 }}
          tickFormatter={(v: number) => v.toFixed(2)}
        />
        <YAxis
          tickFormatter={(v: number) => (isClassification ? `${(v * 100).toFixed(0)}%` : v.toFixed(2))}
          label={{ value: yLabel, angle: -90, position: 'insideLeft', offset: 12 }}
          width={72}
        />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => {
            if (name === 'range') return null
            const num = typeof value === 'number' ? value : parseFloat(String(value))
            const formatted = isClassification
              ? `${(num * 100).toFixed(1)}%`
              : num.toFixed(4)
            return [formatted, name === 'mean' ? 'Mean Prediction' : name]
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          labelFormatter={(label: any) => `${feature}: ${Number(label).toFixed(3)}`}
        />
        <Legend verticalAlign="top" formatter={(v) => (v === 'mean' ? 'Mean Prediction' : '80% Band')} />
        {/* Confidence band */}
        <Area
          dataKey="range"
          fill="#90caf9"
          stroke="none"
          fillOpacity={0.35}
          name="range"
          legendType="rect"
        />
        {/* Mean PDP line */}
        <Line
          type="monotone"
          dataKey="mean"
          stroke="#1976d2"
          strokeWidth={2.5}
          dot={false}
          name="mean"
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
