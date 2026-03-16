import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { LearningCurvePoint } from '../../api/types'

interface Props {
  data: LearningCurvePoint[]
  modelName: string
  metric?: string
}

export default function LearningCurveChart({ data, modelName, metric = 'Accuracy' }: Props) {
  if (!data || data.length === 0) return null

  // Detect clear overfit: last point gap > 10%
  const lastPoint = data[data.length - 1]
  const isOverfit = lastPoint && (lastPoint.train_score - lastPoint.val_score) > 0.10

  const chartData = data.map((p) => ({
    size: p.training_size.toLocaleString(),
    fraction: `${Math.round(p.training_fraction * 100)}%`,
    'Train Score': round1(p.train_score * 100),
    'Val Score': round1(p.val_score * 100),
    gap: round1(p.gap * 100),
  }))

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Learning Curve — {modelName}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          ({metric} vs training size)
        </Typography>
      </Typography>

      {isOverfit && (
        <Alert severity="warning" sx={{ py: 0.25, mb: 1, fontSize: '0.75rem' }}>
          Train-val gap remains large at full training size — model is overfitting.
          Consider regularization or more data.
        </Alert>
      )}

      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="fraction"
            tick={{ fontSize: 10 }}
            label={{ value: 'Training Set Size', position: 'insideBottom', offset: -2, fontSize: 10 }}
          />
          <YAxis
            domain={['auto', 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 10 }}
            label={{ value: metric, angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <RechartTooltip
            formatter={(val: number, name: string) => [`${val.toFixed(1)}%`, name]}
            labelFormatter={(label) => `Training size: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <ReferenceLine y={100} stroke="#bdbdbd" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="Train Score"
            stroke="#1976d2"
            strokeWidth={2}
            dot={{ r: 4, fill: '#1976d2' }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="Val Score"
            stroke="#e91e63"
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={{ r: 4, fill: '#e91e63' }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <Typography variant="caption" color="text.secondary">
        📌 Converging lines = good generalisation. Persistent gap = overfitting. Rising val score with more data = needs more training data.
      </Typography>
    </Box>
  )
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}
