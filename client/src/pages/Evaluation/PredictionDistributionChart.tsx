import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import type { PredictionBin } from '../../api/types'

interface Props {
  data: PredictionBin[]
  optimalThreshold?: number
}

export default function PredictionDistributionChart({ data, optimalThreshold }: Props) {
  const totalPos = data.reduce((s, d) => s + d.count_positive, 0)
  const totalNeg = data.reduce((s, d) => s + d.count_negative, 0)

  // Separation quality: proportion of positives scoring > 0.5
  const posAboveHalf = data.filter(d => d.bin > 0.5).reduce((s, d) => s + d.count_positive, 0)
  const sepQuality = totalPos > 0 ? posAboveHalf / totalPos : 0
  const sepLabel =
    sepQuality > 0.8 ? { label: 'Excellent separation', color: '#4caf50' }
    : sepQuality > 0.6 ? { label: 'Good separation', color: '#ff9800' }
    : { label: 'Poor separation', color: '#f44336' }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip
          label={sepLabel.label}
          size="small"
          sx={{ bgcolor: `${sepLabel.color}18`, color: sepLabel.color, fontWeight: 700, border: `1px solid ${sepLabel.color}40` }}
        />
        <Typography variant="caption" color="text.secondary">
          {(sepQuality * 100).toFixed(0)}% of positives score above 0.5
        </Typography>
      </Box>
      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="bin"
              tickFormatter={(v) => v.toFixed(2)}
              label={{ value: 'Predicted probability', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
            />
            <YAxis label={{ value: 'Count', angle: -90, position: 'insideLeft', fontSize: 11 }} />
            <Tooltip
              labelFormatter={(l) => `Score ≈ ${Number(l).toFixed(2)}`}
              formatter={(v: number, name: string) => [v.toLocaleString(), name]}
            />
            <Legend verticalAlign="top" height={24} />
            <Bar dataKey="count_negative" name="Negative class" fill="#f44336" opacity={0.75} stackId="a" />
            <Bar dataKey="count_positive" name="Positive class" fill="#4caf50" opacity={0.85} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
        Ideal: negatives cluster left, positives cluster right — clear bimodal separation
      </Typography>
    </Box>
  )
}
