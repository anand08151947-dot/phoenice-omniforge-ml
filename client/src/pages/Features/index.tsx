import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import FeatureRow from './FeatureRow'
import type { FeatureEngineeringPlan, TransformType } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import BuildIcon from '@mui/icons-material/Build'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import StorageIcon from '@mui/icons-material/Storage'

interface ApplyResult {
  original_cols: number
  output_cols: number
  output_rows: number
  feature_path: string
}

export default function FeaturesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)
  const [overrides, setOverrides] = useState<Record<string, { enabled?: boolean; transform?: TransformType }>>({})
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<ApplyResult | null>(null)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' })

  const { data, isLoading, error } = useQuery<FeatureEngineeringPlan>({
    queryKey: ['features', datasetId],
    queryFn: () => fetch(`/api/features?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`Features API returned ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  if (!datasetId) {
    return (
      <Box>
        <PageHeader title="Feature Engineering" subtitle="Phase 5 — Build and transform features for model training" />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Upload or select a dataset first.
        </Alert>
      </Box>
    )
  }

  if (isLoading) return <LinearProgress />

  if (error || !data) {
    return (
      <Box>
        <PageHeader title="Feature Engineering" subtitle={`Phase 5 — ${datasetName}`} />
        <Alert severity="warning">Feature engineering plan not available yet. Complete cleaning first.</Alert>
      </Box>
    )
  }

  const plan = data
  const specs = plan.specs.map((s) => ({ ...s, ...overrides[s.id] }))
  const enabledCount = specs.filter((s) => s.enabled).length
  const disabledCount = specs.length - enabledCount

  // Show audit from local result (just applied) OR from persisted plan.audit (page refresh)
  const audit = result ?? plan.audit ?? null

  async function handleApply() {
    setApplying(true)
    setResult(null)
    try {
      const res = await fetch('/api/features/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: datasetId, specs }),
      })
      if (!res.ok) throw new Error(`Apply failed: ${res.status}`)
      const r = await res.json()
      setResult({ original_cols: r.original_cols, output_cols: r.output_cols, output_rows: r.output_rows, feature_path: r.feature_path })
      setPhaseStatus('features', 'done')
      // Invalidate downstream caches
      queryClient.invalidateQueries({ queryKey: ['features', datasetId] })
      queryClient.removeQueries({ queryKey: ['selection', datasetId] })
      setSnack({ open: true, msg: `Features applied: ${r.output_cols} output columns saved.`, severity: 'success' })
    } catch (err: any) {
      setSnack({ open: true, msg: `Error: ${err.message}`, severity: 'error' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title="Feature Engineering"
        subtitle={`Phase 5 — ${datasetName}`}
        actions={
          <Button
            variant={audit ? 'outlined' : 'contained'}
            color={audit ? 'success' : 'primary'}
            startIcon={audit ? <CheckCircleIcon /> : <PlayArrowIcon />}
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? 'Applying…' : audit ? 'Re-Apply Features' : 'Apply Features'}
          </Button>
        }
      />

      {/* Audit panel — persists on page refresh via plan.audit in DB */}
      {audit && (
        <SectionCard
          title="Feature Engineering Applied"
          subheader={
            (audit as any).applied_at
              ? `Applied ${new Date((audit as any).applied_at).toLocaleString()} — transformed dataset saved`
              : 'Features transformed and saved to storage'
          }
          sx={{ mb: 3, border: '1px solid', borderColor: 'success.dark' }}
        >
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Input Columns</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{audit.original_cols}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Output Columns</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{audit.output_cols}</Typography>
                <Chip
                  label={audit.output_cols > audit.original_cols ? `+${audit.output_cols - audit.original_cols} added` : `${audit.output_cols - audit.original_cols} net`}
                  size="small"
                  color={audit.output_cols > audit.original_cols ? 'primary' : 'default'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Rows</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{audit.output_rows.toLocaleString()}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Transforms Applied</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#6C63FF' }}>{enabledCount}</Typography>
                {disabledCount > 0 && <Chip label={`${disabledCount} skipped`} size="small" sx={{ mt: 0.5 }} />}
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ mx: 2 }} />
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
              Transformed dataset saved to storage.
            </Typography>
            <StorageIcon sx={{ fontSize: '0.9rem', color: 'text.disabled' }} />
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
              {audit.feature_path}
            </Typography>
            <Button size="small" endIcon={<ArrowForwardIcon />} sx={{ ml: 'auto' }} onClick={() => navigate('/selection')}>
              Proceed to Feature Selection
            </Button>
          </Box>
        </SectionCard>
      )}

      {/* Plan summary metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Input Features" value={plan.total_features_in} icon={<BuildIcon />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Output Features" value={plan.total_features_out} icon={<BuildIcon />} color="#6C63FF" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Enabled Transforms" value={`${enabledCount}/${plan.specs.length}`} icon={<BuildIcon />} color="#4CAF50" /></Grid>
      </Grid>

      <SectionCard title="Feature Transformations" subheader="Enable/disable transforms and configure type-specific parameters" noPadding>
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '40px 18% 1fr 15% 9% 11% 40px', gap: 2 }}>
            {['', 'Output Name', 'Source Columns', 'Transform', 'Dtype In', 'Dtype Out', 'Status'].map((h) => (
              <Typography key={h} variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5 }}>{h}</Typography>
            ))}
          </Box>
        </Box>
        {specs.map((spec) => (
          <FeatureRow
            key={spec.id}
            spec={spec}
            onToggle={(id, enabled) => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], enabled } }))}
            onTransformChange={(id, transform) => setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], transform } }))}
          />
        ))}
      </SectionCard>

      {applying && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Applying {enabledCount} transforms and writing feature dataset to storage…
          </Typography>
        </Box>
      )}

      <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  )
}
