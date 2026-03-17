import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import type { CalibrationPoint } from '../../api/types'

interface Props {
  data: CalibrationPoint[]
}

export default function CalibrationChart({ data }: Props) {
  // Calibration error = mean |predicted - actual|
  const calibrationError = data.length
    ? data.reduce((s, d) => s + Math.abs(d.mean_predicted - d.fraction_positive), 0) / data.length
    : 0

  const quality =
    calibrationError < 0.05
      ? { label: 'Well Calibrated', color: '#4caf50' }
      : calibrationError < 0.10
        ? { label: 'Moderate', color: '#ff9800' }
        : { label: 'Poorly Calibrated', color: '#f44336' }

  // Merge with the perfect diagonal for chart
  const chartData = data.map((d) => ({
    ...d,
    perfect: d.mean_predicted,
  }))

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Chip label={quality.label} size="small" sx={{ bgcolor: `${quality.color}20`, color: quality.color, fontWeight: 700, border: `1px solid ${quality.color}40` }} />
        <Typography variant="caption" color="text.secondary">
          Mean calibration error: <strong>{(calibrationError * 100).toFixed(1)}%</strong>
        </Typography>
      </Box>
      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="mean_predicted"
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: 'Mean predicted probability', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: 'Fraction of positives', angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(v: any) => v.toFixed(4)} />
            {/* Perfect calibration diagonal */}
            <Line type="monotone" dataKey="perfect" stroke="#555" strokeWidth={1} strokeDasharray="5 5" dot={false} name="Perfect" />
            {/* Actual calibration */}
            <Line type="monotone" dataKey="fraction_positive" stroke="#6C63FF" strokeWidth={2.5} dot={{ r: 4 }} name="Model" />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
        A perfectly calibrated model follows the dashed diagonal — its predicted probabilities match true frequencies
      </Typography>
    </Box>
  )
}
