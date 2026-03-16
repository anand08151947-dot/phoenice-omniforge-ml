import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import type { FeatureSelectionReport } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import FilterListIcon from '@mui/icons-material/FilterList'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'

export default function SelectionPage() {
  const navigate = useNavigate()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const [keepOverrides, setKeepOverrides] = useState<Record<string, boolean>>({})
  const [applying, setApplying] = useState(false)

  const { data, isLoading, error } = useQuery<FeatureSelectionReport>({
    queryKey: ['selection', datasetId],
    queryFn: () => fetch(`/api/selection?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`Selection API returned ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  if (!datasetId) {
    return (
      <Box>
        <PageHeader title="Feature Selection" subtitle="Phase 6 — Rank and select the most predictive features" />
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
        <PageHeader title="Feature Selection" subtitle={`Phase 6 — ${datasetName}`} />
        <Alert severity="warning">Feature selection report not available yet. Complete feature engineering first.</Alert>
      </Box>
    )
  }

  const report = data

  const features = report.importances.map((f) => ({
    ...f,
    keep: keepOverrides[f.feature] ?? f.keep,
  }))
  const kept = features.filter((f) => f.keep).length

  async function handleApply() {
    setApplying(true)
    await fetch('/api/selection/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, features }),
    })
    setApplying(false)
  }

  return (
    <Box>
      <PageHeader
        title="Feature Selection"
        subtitle="Phase 6 — Rank and select the most predictive features"
        actions={<Button variant="contained" startIcon={<PlayArrowIcon />} onClick={handleApply} disabled={applying}>{applying ? 'Applying…' : 'Apply Selection'}</Button>}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Total Features" value={report.importances.length} icon={<FilterListIcon />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Selected" value={kept} icon={<FilterListIcon />} color="#4CAF50" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Dropped" value={report.importances.length - kept} icon={<FilterListIcon />} color="#EF5350" /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Feature Importance Ranking">
            <Box sx={{ height: 500 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={features} layout="vertical" margin={{ top: 5, right: 20, left: 130, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" domain={[0, 0.2]} tickFormatter={(v) => v.toFixed(2)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="feature" width={125} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => [Number(v).toFixed(4), 'Importance']} />
                  <ReferenceLine x={0.05} stroke="#FFA726" strokeDasharray="4 4" label={{ value: 'threshold', fontSize: 10, fill: '#FFA726' }} />
                  <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
                    {features.map((f, i) => (
                      <Cell key={i} fill={f.keep ? '#6C63FF' : '#555'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Keep / Drop Toggle" subheader="Override automatic selection">
            <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
              {features.map((f) => (
                <Box key={f.feature} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Switch
                    size="small"
                    checked={f.keep}
                    onChange={(e) => setKeepOverrides((prev) => ({ ...prev, [f.feature]: e.target.checked }))}
                    color="success"
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{f.feature}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {(f.importance * 100).toFixed(1)}% importance · rank #{f.rank}
                    </Typography>
                  </Box>
                  <Chip label={f.keep ? 'Keep' : 'Drop'} color={f.keep ? 'success' : 'default'} size="small" />
                </Box>
              ))}
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      {applying && <LinearProgress sx={{ mt: 2 }} />}
    </Box>
  )
}
