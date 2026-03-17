import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import type { ModelComplexity } from '../../api/types'

interface Props {
  complexity: ModelComplexity
}

function ComplexityCard({ label, value, unit, status }: { label: string; value: string | number; unit?: string; status?: 'ok' | 'warn' | 'alert' }) {
  const colors = { ok: '#4caf50', warn: '#ff9800', alert: '#f44336', undefined: '#9e9e9e' }
  const color = colors[status ?? 'undefined']
  return (
    <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5, textAlign: 'center' }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
        <Typography variant="h5" fontWeight={800} sx={{ color }}>{value}</Typography>
        {unit && <Typography variant="caption" color="text.secondary">{unit}</Typography>}
      </Box>
    </Box>
  )
}

export default function ModelComplexityPanel({ complexity }: Props) {
  const sizeKb = complexity.model_size_kb ?? 0
  const latencyMs = complexity.inference_ms_per_row ?? 0
  const sizeStatus = sizeKb < 500 ? 'ok' : sizeKb < 5000 ? 'warn' : 'alert'
  const latencyStatus = latencyMs < 5 ? 'ok' : latencyMs < 50 ? 'warn' : 'alert'
  const throughput = latencyMs > 0 ? Math.round(1000 / latencyMs) : null
  const throughputStatus = throughput == null ? undefined : throughput > 500 ? 'ok' : throughput > 50 ? 'warn' : 'alert'

  return (
    <Box>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={3}>
          <ComplexityCard
            label="Model Size"
            value={sizeKb >= 1024 ? (sizeKb / 1024).toFixed(1) : sizeKb.toFixed(0)}
            unit={sizeKb >= 1024 ? 'MB' : 'KB'}
            status={sizeStatus}
          />
        </Grid>
        <Grid size={3}>
          <ComplexityCard
            label="Inference / sample"
            value={latencyMs.toFixed(2)}
            unit="ms"
            status={latencyStatus}
          />
        </Grid>
        <Grid size={3}>
          <ComplexityCard
            label="Throughput"
            value={throughput ?? '—'}
            unit={throughput != null ? 'pred/s' : undefined}
            status={throughputStatus}
          />
        </Grid>
        <Grid size={3}>
          <ComplexityCard
            label="Num. parameters"
            value={complexity.n_parameters != null
              ? complexity.n_parameters >= 1_000_000
                ? `${(complexity.n_parameters / 1_000_000).toFixed(1)}M`
                : complexity.n_parameters >= 1_000
                  ? `${(complexity.n_parameters / 1_000).toFixed(0)}k`
                  : complexity.n_parameters
              : '—'}
          />
        </Grid>
      </Grid>

      {/* Deployment readiness */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>Deployment readiness:</Typography>
        <Chip
          label={sizeStatus === 'ok' ? '✅ Lightweight' : sizeStatus === 'warn' ? '⚠️ Large model' : '🚨 Very large'}
          size="small"
          sx={{ fontSize: '0.7rem' }}
        />
        <Chip
          label={latencyStatus === 'ok' ? '✅ Fast inference' : latencyStatus === 'warn' ? '⚠️ Medium latency' : '🚨 High latency'}
          size="small"
          sx={{ fontSize: '0.7rem' }}
        />
        {complexity.model_type && (
          <Chip label={`Type: ${complexity.model_type}`} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
        )}
      </Box>
    </Box>
  )
}
