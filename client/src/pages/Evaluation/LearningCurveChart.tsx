import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'
import type { LearningCurvePoint } from '../../api/types'

interface Props {
  data: LearningCurvePoint[]
}

export default function LearningCurveChart({ data }: Props) {
  if (!data.length) return <Alert severity="info">Learning curve data not available.</Alert>

  const lastPoint = data[data.length - 1]
  const gap = lastPoint.gap
  const diagnosis =
    gap > 0.15
      ? { label: 'Overfitting', color: '#f44336', advice: 'Model fits training data too well — try regularisation, more data, or pruning.' }
      : lastPoint.val_score < 0.6
        ? { label: 'Underfitting', color: '#ff9800', advice: 'Model has low capacity — try more features, more complex model, or fewer constraints.' }
        : { label: 'Good Fit', color: '#4caf50', advice: 'Training and validation scores converge — model generalises well.' }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ px: 1.5, py: 0.25, borderRadius: 1, bgcolor: `${diagnosis.color}18`, border: `1px solid ${diagnosis.color}40` }}>
          <Typography variant="caption" sx={{ color: diagnosis.color, fontWeight: 700 }}>{diagnosis.label}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">{diagnosis.advice}</Typography>
      </Box>

      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="training_size"
              tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
              label={{ value: 'Training examples', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
            />
            <YAxis domain={['auto', 1]} tickFormatter={(v) => v.toFixed(2)} />
            <Tooltip
              formatter={(v: number, name: string) => [v.toFixed(4), name]}
              labelFormatter={(l) => `Training size: ${Number(l).toLocaleString()}`}
            />
            <Legend verticalAlign="top" height={24} />
            <Line type="monotone" dataKey="train_score" stroke="#6C63FF" strokeWidth={2} dot name="Train" />
            <Line type="monotone" dataKey="val_score" stroke="#4caf50" strokeWidth={2} dot name="Validation" strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
        Gap at full training size: <strong style={{ color: gap > 0.1 ? '#f44336' : '#4caf50' }}>{(gap * 100).toFixed(1)}%</strong>
      </Typography>
    </Box>
  )
}
