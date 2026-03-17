import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Slider from '@mui/material/Slider'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { ThresholdPoint } from '../../api/types'

interface Props {
  data: ThresholdPoint[]
  optimalThreshold?: number
}

function MetricBox({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <Box sx={{ textAlign: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{label}</Typography>
      <Typography variant="h6" fontWeight={700} sx={{ color: color ?? 'text.primary', lineHeight: 1.3 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Typography>
    </Box>
  )
}

export default function ThresholdSlider({ data, optimalThreshold = 0.5 }: Props) {
  const [threshold, setThreshold] = useState<number>(optimalThreshold)

  const current = useMemo(() => {
    // Find closest point
    return data.reduce((best, pt) =>
      Math.abs(pt.threshold - threshold) < Math.abs(best.threshold - threshold) ? pt : best,
      data[0] ?? { threshold: 0.5, precision: 0, recall: 0, f1: 0, fpr: 0, tp: 0, fp: 0, fn: 0, tn: 0 }
    )
  }, [data, threshold])

  return (
    <Box>
      {/* Chart */}
      <Box sx={{ height: 200, mb: 2 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="threshold" tickFormatter={(v) => v.toFixed(2)} label={{ value: 'Threshold', position: 'insideBottomRight', offset: -5, fontSize: 11 }} />
            <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} />
            <Tooltip formatter={(v: number) => v.toFixed(4)} labelFormatter={(l) => `Threshold: ${Number(l).toFixed(2)}`} />
            <ReferenceLine x={threshold} stroke="#fff" strokeDasharray="4 2" strokeWidth={1.5} />
            <ReferenceLine x={optimalThreshold} stroke="#ffd700" strokeDasharray="6 3" label={{ value: 'Optimal', position: 'top', fontSize: 9, fill: '#ffd700' }} />
            <Line type="monotone" dataKey="f1" stroke="#6C63FF" strokeWidth={2} dot={false} name="F1" />
            <Line type="monotone" dataKey="precision" stroke="#4caf50" strokeWidth={1.5} dot={false} name="Precision" />
            <Line type="monotone" dataKey="recall" stroke="#ff6584" strokeWidth={1.5} dot={false} name="Recall" />
          </LineChart>
        </ResponsiveContainer>
      </Box>

      {/* Slider */}
      <Box sx={{ px: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">Decision Threshold</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={`Current: ${threshold.toFixed(2)}`}
              size="small"
              color="primary"
              sx={{ fontSize: '0.7rem' }}
            />
            {Math.abs(threshold - optimalThreshold) > 0.02 && (
              <Chip
                label={`Optimal: ${optimalThreshold.toFixed(2)}`}
                size="small"
                color="success"
                variant="outlined"
                sx={{ fontSize: '0.7rem', cursor: 'pointer' }}
                onClick={() => setThreshold(optimalThreshold)}
              />
            )}
          </Box>
        </Box>
        <Slider
          value={threshold}
          min={0.05}
          max={0.95}
          step={0.05}
          onChange={(_, v) => setThreshold(v as number)}
          marks={[
            { value: 0.05, label: '0.05' },
            { value: 0.5, label: '0.50' },
            { value: optimalThreshold, label: '★' },
            { value: 0.95, label: '0.95' },
          ]}
          sx={{ '& .MuiSlider-markLabel': { fontSize: '0.65rem' } }}
        />
      </Box>

      {/* Confusion matrix cells */}
      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid size={3}><MetricBox label="True Positive" value={current.tp} color="#4caf50" /></Grid>
        <Grid size={3}><MetricBox label="False Positive" value={current.fp} color="#f44336" /></Grid>
        <Grid size={3}><MetricBox label="False Negative" value={current.fn} color="#ff9800" /></Grid>
        <Grid size={3}><MetricBox label="True Negative" value={current.tn} color="#2196f3" /></Grid>
      </Grid>

      {/* Metric summary */}
      <Grid container spacing={1}>
        <Grid size={4}><MetricBox label="Precision" value={current.precision.toFixed(4)} /></Grid>
        <Grid size={4}><MetricBox label="Recall" value={current.recall.toFixed(4)} /></Grid>
        <Grid size={4}><MetricBox label="F1" value={current.f1.toFixed(4)} color="#6C63FF" /></Grid>
      </Grid>
    </Box>
  )
}
