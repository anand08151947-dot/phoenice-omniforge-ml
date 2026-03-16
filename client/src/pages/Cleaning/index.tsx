import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import CleaningRule from './CleaningRule'
import type { CleaningPlan, CleaningStrategy } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'

interface CleaningResult {
  original_rows: number
  original_cols: number
  cleaned_rows: number
  cleaned_cols: number
  rows_removed: number
  cols_removed: number
  cleaned_path: string
}

export default function CleaningPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)
  const [strategies, setStrategies] = useState<Record<string, CleaningStrategy>>({})
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<CleaningResult | null>(null)
  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({
    open: false, msg: '', severity: 'success'
  })

  const { data: plan, isLoading, error } = useQuery<CleaningPlan>({
    queryKey: ['cleaning', datasetId],
    queryFn: () => fetch(`/api/cleaning?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`Cleaning API returned ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  if (!datasetId) {
    return (
      <Box>
        <PageHeader title="Data Cleaning" subtitle="Phase 3 — Configure and apply remediation strategies" />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Upload or select a dataset first.
        </Alert>
      </Box>
    )
  }

  if (isLoading) return <LinearProgress />

  if (error || !plan) {
    return (
      <Box>
        <PageHeader title="Data Cleaning" subtitle={`Phase 3 — ${datasetName}`} />
        <Alert severity="warning">
          Cleaning plan not available. Ensure the dataset has been profiled first.
        </Alert>
      </Box>
    )
  }

  async function handleApply() {
    setApplying(true)
    setResult(null)
    try {
      const res = await fetch('/api/cleaning/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: datasetId, strategies }),
      })
      if (!res.ok) throw new Error(`Apply failed: ${res.status}`)
      const r: CleaningResult = await res.json()
      setResult(r)
      setPhaseStatus('cleaning', 'done')
      // Invalidate profile, eda and cleaning queries so downstream pages reload from cleaned data
      await queryClient.invalidateQueries({ queryKey: ['profile', datasetId] })
      await queryClient.invalidateQueries({ queryKey: ['eda', datasetId] })
      await queryClient.invalidateQueries({ queryKey: ['cleaning', datasetId] })
      setSnack({ open: true, msg: 'Cleaning applied and saved to storage.', severity: 'success' })
    } catch (err: any) {
      setSnack({ open: true, msg: `Error: ${err.message}`, severity: 'error' })
    } finally {
      setApplying(false)
    }
  }

  return (
    <Box>
      <PageHeader
        title="Data Cleaning"
        subtitle={`Phase 3 — ${datasetName}`}
        actions={
          <Button
            variant="contained"
            startIcon={result ? <CheckCircleIcon /> : <PlayArrowIcon />}
            onClick={handleApply}
            disabled={applying}
            color={result ? 'success' : 'primary'}
          >
            {applying ? 'Applying…' : result ? 'Re-Apply Plan' : 'Apply Cleaning Plan'}
          </Button>
        }
      />

      {/* Before stats (plan estimates) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Issues Detected" value={plan.actions.length} icon={<CleaningServicesIcon />} color="#EF5350" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Est. Rows Affected" value={plan.estimated_rows_affected.toLocaleString()} icon={<CleaningServicesIcon />} color="#FFA726" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Est. Columns to Drop" value={plan.estimated_cols_removed} icon={<CleaningServicesIcon />} color="#9E9E9E" />
        </Grid>
      </Grid>

      {/* After stats (actual result) */}
      {result && (
        <SectionCard
          title="Cleaning Results"
          subheader="Actual changes applied to the dataset"
          sx={{ mb: 3, border: '1px solid', borderColor: 'success.dark' }}
        >
          <Grid container spacing={3} sx={{ p: 2 }}>
            {/* Rows */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Rows Before</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>{result.original_rows.toLocaleString()}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Rows After</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{result.cleaned_rows.toLocaleString()}</Typography>
                <Chip label={`−${result.rows_removed.toLocaleString()} removed`} size="small" color={result.rows_removed > 0 ? 'warning' : 'default'} sx={{ mt: 0.5 }} />
              </Box>
            </Grid>
            {/* Cols */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Columns Before</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>{result.original_cols}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Columns After</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{result.cleaned_cols}</Typography>
                <Chip label={`−${result.cols_removed} dropped`} size="small" color={result.cols_removed > 0 ? 'warning' : 'default'} sx={{ mt: 0.5 }} />
              </Box>
            </Grid>
          </Grid>
          <Divider sx={{ mx: 2 }} />
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
              Cleaned dataset saved to storage.
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', ml: 1 }}>
              {result.cleaned_path}
            </Typography>
            <Button size="small" endIcon={<ArrowForwardIcon />} sx={{ ml: 'auto' }} onClick={() => navigate('/eda')}>
              Proceed to EDA
            </Button>
          </Box>
        </SectionCard>
      )}

      <SectionCard title="Cleaning Rules" subheader="Configure the strategy for each detected issue — then click Apply" noPadding>
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '16% 1fr 12% 18% 1fr', gap: 2 }}>
            {['Column', 'Issue', 'Severity', 'Strategy', 'Impact'].map((h) => (
              <Typography key={h} variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5 }}>{h}</Typography>
            ))}
          </Box>
        </Box>
        {plan.actions.map((action) => (
          <CleaningRule
            key={action.id}
            action={action}
            onStrategyChange={(id, strategy) => setStrategies((prev) => ({ ...prev, [id]: strategy }))}
          />
        ))}
      </SectionCard>

      {applying && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Applying cleaning rules and writing cleaned dataset to storage…
          </Typography>
        </Box>
      )}

      <Snackbar
        open={snack.open}
        autoHideDuration={5000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>
          {snack.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}