import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Divider from '@mui/material/Divider'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import CleaningRule from './CleaningRule'
import type { CleaningPlan, CleaningStrategy } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import CleaningServicesIcon from '@mui/icons-material/CleaningServices'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

export default function CleaningPage() {
  const navigate = useNavigate()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)
  const [strategies, setStrategies] = useState<Record<string, CleaningStrategy>>({})
  const [applying, setApplying] = useState(false)
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
    try {
      const res = await fetch('/api/cleaning/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: datasetId, strategies }),
      })
      if (!res.ok) throw new Error(`Apply failed: ${res.status}`)
      const result = await res.json()
      setPhaseStatus('cleaning', 'done')
      setSnack({ open: true, msg: `Cleaning applied! ${result.rows_removed ?? 0} rows removed, ${result.cols_removed ?? 0} columns dropped.`, severity: 'success' })
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
            startIcon={<PlayArrowIcon />}
            onClick={handleApply}
            disabled={applying}
          >
            {applying ? 'Applying…' : 'Apply Cleaning Plan'}
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Issues Found" value={plan.actions.length} icon={<CleaningServicesIcon />} color="#EF5350" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Rows Affected" value={plan.estimated_rows_affected.toLocaleString()} icon={<CleaningServicesIcon />} color="#FFA726" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}>
          <MetricCard label="Columns to Drop" value={plan.estimated_cols_removed} icon={<CleaningServicesIcon />} color="#9E9E9E" />
        </Grid>
      </Grid>

      <SectionCard title="Cleaning Rules" subheader="Configure the strategy for each detected issue" noPadding>
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
        autoHideDuration={6000}
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

