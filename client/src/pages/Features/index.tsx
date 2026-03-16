import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import { useQuery } from '@tanstack/react-query'
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

export default function FeaturesPage() {
  const navigate = useNavigate()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const [overrides, setOverrides] = useState<Record<string, { enabled?: boolean; transform?: TransformType }>>({})
  const [applying, setApplying] = useState(false)

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
        <Alert severity="warning">
          Feature engineering plan not available yet. Complete cleaning first.
        </Alert>
      </Box>
    )
  }

  const plan = data
  const specs = plan.specs.map((s) => ({ ...s, ...overrides[s.id] }))
  const enabledCount = specs.filter((s) => s.enabled).length

  async function handleApply() {
    setApplying(true)
    await fetch('/api/features/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, specs }),
    })
    setApplying(false)
  }

  return (
    <Box>
      <PageHeader
        title="Feature Engineering"
        subtitle={`Phase 5 — ${datasetName}`}
        actions={<Button variant="contained" startIcon={<PlayArrowIcon />} onClick={handleApply} disabled={applying}>{applying ? 'Applying…' : 'Apply Features'}</Button>}
      />

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

      {applying && <LinearProgress sx={{ mt: 2 }} />}
    </Box>
  )
}
