import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
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
import HistoryIcon from '@mui/icons-material/History'

interface CleaningAudit {
  original_rows: number
  original_cols: number
  cleaned_rows: number
  cleaned_cols: number
  rows_removed: number
  cols_removed: number
  cleaned_path: string
  applied_strategies: Record<string, string>
  applied_at: string
}

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

  const audit = (result as any) ?? plan?.audit ?? null

  return (
    <Box>
      <PageHeader
        title="Data Cleaning"
        subtitle={`Phase 3 — ${datasetName}`}
        actions={
          <Button
            variant="contained"
            startIcon={audit ? <CheckCircleIcon /> : <PlayArrowIcon />}
            onClick={handleApply}
            disabled={applying}
            color={audit ? 'success' : 'primary'}
          >
            {applying ? 'Applying…' : audit ? 'Re-Apply Plan' : 'Apply Cleaning Plan'}
          </Button>
        }
      />

      {/* Cleaning audit — persists across page refresh via plan.audit in DB */}
      {audit && (
        <SectionCard
          title="Cleaning Audit"
          subheader={
            audit.applied_at
              ? `Applied ${new Date(audit.applied_at).toLocaleString()} — dataset cleaned and saved`
              : 'Cleaning applied — dataset saved to storage'
          }
          sx={{ mb: 3, border: '1px solid', borderColor: 'success.dark' }}
        >
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Rows Before</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{audit.original_rows.toLocaleString()}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Rows After</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{audit.cleaned_rows.toLocaleString()}</Typography>
                <Chip
                  label={audit.rows_removed > 0 ? `−${audit.rows_removed.toLocaleString()} removed` : 'No rows removed'}
                  size="small"
                  color={audit.rows_removed > 0 ? 'warning' : 'success'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Columns Before</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>{audit.original_cols}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>Columns After</Typography>
                <Typography variant="h5" sx={{ fontWeight: 700, color: 'success.main' }}>{audit.cleaned_cols}</Typography>
                <Chip
                  label={audit.cols_removed > 0 ? `−${audit.cols_removed} dropped` : 'No columns dropped'}
                  size="small"
                  color={audit.cols_removed > 0 ? 'warning' : 'success'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
            </Grid>
          </Grid>

          {/* Applied strategies breakdown */}
          {audit.applied_strategies && Object.keys(audit.applied_strategies).length > 0 && (
            <>
              <Divider sx={{ mx: 2 }} />
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                  <HistoryIcon sx={{ fontSize: '1rem' }} /> Strategies Applied
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {Object.entries(audit.applied_strategies).map(([actionId, strategy]) => (
                    <Tooltip key={actionId} title={`Rule: ${actionId}`} placement="top" arrow>
                      <Chip
                        label={`${actionId.split('_').slice(0, 2).join(' ')} → ${strategy.replace(/_/g, ' ')}`}
                        size="small"
                        variant="outlined"
                        color="info"
                        sx={{ fontSize: '0.68rem', fontFamily: 'monospace' }}
                      />
                    </Tooltip>
                  ))}
                </Box>
              </Box>
            </>
          )}

          <Divider sx={{ mx: 2 }} />
          <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <CheckCircleIcon color="success" fontSize="small" />
            <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
              Cleaned dataset saved to storage.
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', ml: 1 }}>
              {audit.cleaned_path}
            </Typography>
            <Button size="small" endIcon={<ArrowForwardIcon />} sx={{ ml: 'auto' }} onClick={() => navigate('/eda')}>
              View EDA
            </Button>
          </Box>
        </SectionCard>
      )}

      {/* Before stats (plan estimates — only meaningful if there are pending issues) */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Issues Detected" value={plan.actions.length} icon={<CleaningServicesIcon />} color={plan.actions.length > 0 ? '#EF5350' : '#4CAF50'} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Est. Rows Affected" value={plan.estimated_rows_affected.toLocaleString()} icon={<CleaningServicesIcon />} color="#FFA726" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Est. Columns to Drop" value={plan.estimated_cols_removed} icon={<CleaningServicesIcon />} color="#9E9E9E" />
        </Grid>
      </Grid>

      {plan.actions.length === 0 && audit ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          <strong>Dataset is clean.</strong> All issues were resolved in the previous cleaning run. The cleaned dataset is ready for EDA and downstream phases.
        </Alert>
      ) : plan.actions.length === 0 ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          No cleaning issues detected in this dataset. Proceed to EDA.
        </Alert>
      ) : null}

      <SectionCard
        title="Cleaning Rules"
        subheader={plan.actions.length > 0 ? 'Configure the strategy for each detected issue — then click Apply' : 'No pending issues — dataset is clean'}
        noPadding
      >
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '16% 1fr 12% 18% 1fr', gap: 2 }}>
            {['Column', 'Issue', 'Severity', 'Strategy', 'Impact'].map((h) => (
              <Typography key={h} variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5 }}>{h}</Typography>
            ))}
          </Box>
        </Box>
        {plan.actions.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <CheckCircleIcon color="success" sx={{ fontSize: '2.5rem', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No issues — all columns are clean</Typography>
          </Box>
        ) : plan.actions.map((action) => (
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