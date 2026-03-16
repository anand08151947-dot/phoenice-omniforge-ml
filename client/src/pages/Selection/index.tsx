import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import type { FeatureSelectionReport } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import FilterListIcon from '@mui/icons-material/FilterList'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PushPinIcon from '@mui/icons-material/PushPin'
import BlockIcon from '@mui/icons-material/Block'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'

interface SelectionAudit {
  applied_at: string
  selected_count: number
  dropped_count: number
  total_count: number
  kept_features: string[]
  dropped_features: string[]
  pinned_count: number
  excluded_count: number
  auto_count: number
  method: string
}

function AuditPanel({ audit }: { audit: SelectionAudit }) {
  const pct = Math.round((audit.selected_count / audit.total_count) * 100)
  return (
    <Box sx={{ border: '1px solid', borderColor: 'success.main', borderRadius: 2, p: 2, bgcolor: 'rgba(76,175,80,0.05)', mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'success.main' }}>
          Selection Applied — {new Date(audit.applied_at).toLocaleString()}
        </Typography>
      </Box>

      {/* Summary stats */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        {[
          { label: 'Features Kept', value: audit.selected_count, color: '#4caf50', icon: <CheckCircleIcon fontSize="small" /> },
          { label: 'Features Dropped', value: audit.dropped_count, color: '#ef5350' },
          { label: 'Auto-selected', value: audit.auto_count, color: '#6C63FF', icon: <AutoAwesomeIcon fontSize="small" /> },
          { label: 'Pinned (EDA)', value: audit.pinned_count, color: '#ff9800', icon: <PushPinIcon fontSize="small" /> },
          { label: 'Excluded (EDA)', value: audit.excluded_count, color: '#888', icon: <BlockIcon fontSize="small" /> },
          { label: '% Retained', value: `${pct}%`, color: pct >= 50 ? '#4caf50' : '#ff9800' },
        ].map(({ label, value, color, icon }) => (
          <Grid key={label} size={{ xs: 6, sm: 4, md: 2 }}>
            <Box sx={{ textAlign: 'center', p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, color }}>
                {icon}
                <Typography variant="h6" sx={{ fontWeight: 700, color }}>{value}</Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 1.5 }} />

      {/* Method */}
      <Typography variant="caption" color="text.secondary">
        Method: <strong>{audit.method}</strong>
      </Typography>

      {/* Kept features */}
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.main', display: 'block', mb: 0.75 }}>
          ✓ Kept ({audit.kept_features.length})
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {audit.kept_features.map((f) => (
            <Chip key={f} label={f} size="small" color="success" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.68rem' }} />
          ))}
        </Box>
      </Box>

      {/* Dropped features (collapsed) */}
      {audit.dropped_features.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', display: 'block', mb: 0.75 }}>
            ✗ Dropped ({audit.dropped_features.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxHeight: 80, overflowY: 'auto' }}>
            {audit.dropped_features.map((f) => (
              <Tooltip key={f} title="Dropped from training">
                <Chip label={f} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: '0.68rem', color: 'text.disabled', borderColor: 'divider' }} />
              </Tooltip>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default function SelectionPage() {
  const navigate = useNavigate()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)
  const queryClient = useQueryClient()
  const [keepOverrides, setKeepOverrides] = useState<Record<string, boolean>>({})
  const [audit, setAudit] = useState<SelectionAudit | null>(null)

  const { data, isLoading, error } = useQuery<FeatureSelectionReport>({
    queryKey: ['selection', datasetId],
    queryFn: () => fetch(`/api/selection?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`Selection API returned ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  useEffect(() => {
    if (data) {
      setPhaseStatus('selection', 'done')
      // Seed audit from DB on page load/refresh
      if (data.audit && !audit) setAudit(data.audit)
    }
  }, [data, setPhaseStatus])

  const applyMutation = useMutation({
    mutationFn: (features: any[]) =>
      fetch('/api/selection/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: datasetId, features }),
      }).then(async (r) => {
        if (!r.ok) throw new Error('Apply failed')
        return r.json()
      }),
    onSuccess: (result) => {
      setAudit(result.audit)
      setPhaseStatus('selection', 'done')
      // Clear training cache since feature selection changed
      queryClient.removeQueries({ queryKey: ['training', datasetId] })
      queryClient.removeQueries({ queryKey: ['evaluation', datasetId] })
    },
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

  const features = data.importances.map((f) => ({
    ...f,
    keep: keepOverrides[f.feature] ?? f.keep,
  }))
  const kept = features.filter((f) => f.keep).length

  return (
    <Box>
      <PageHeader
        title="Feature Selection"
        subtitle="Phase 6 — Rank and select the most predictive features"
        actions={
          <Button
            variant={audit ? 'outlined' : 'contained'}
            startIcon={<PlayArrowIcon />}
            onClick={() => applyMutation.mutate(features)}
            disabled={applyMutation.isPending}
          >
            {applyMutation.isPending ? 'Applying…' : audit ? 'Re-apply Selection' : 'Apply Selection'}
          </Button>
        }
      />

      {applyMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to apply selection. Please try again.</Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Total Features" value={data.importances.length} icon={<FilterListIcon />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Selected" value={kept} icon={<FilterListIcon />} color="#4CAF50" /></Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 4 }}><MetricCard label="Dropped" value={data.importances.length - kept} icon={<FilterListIcon />} color="#EF5350" /></Grid>
      </Grid>

      {/* Audit panel — shown after apply or from DB on refresh */}
      {audit && <AuditPanel audit={audit} />}

      <Grid container spacing={2} sx={{ mt: audit ? 2 : 0 }}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="Feature Importance Ranking" subheader={`Method: ${data.method} · Purple = kept · Grey = dropped`}>
            <Box sx={{ height: 500 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={features} layout="vertical" margin={{ top: 5, right: 20, left: 130, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" domain={[0, 0.2]} tickFormatter={(v) => v.toFixed(2)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="feature" width={125} tick={{ fontSize: 10 }} />
                  <RechartsTooltip formatter={(v: any) => [Number(v).toFixed(4), 'Importance']} />
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
          <SectionCard title="Keep / Drop Toggle" subheader="Override automatic selection — changes reflect in bar chart">
            <Box sx={{ maxHeight: 500, overflowY: 'auto' }}>
              {features.map((f) => (
                <Box key={f.feature} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Switch
                    size="small"
                    checked={f.keep}
                    onChange={(e) => setKeepOverrides((prev) => ({ ...prev, [f.feature]: e.target.checked }))}
                    color="success"
                  />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{f.feature}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {(f.importance * 100).toFixed(1)}% importance · rank #{f.rank}
                      {(f as any).override === 'pinned' && <Chip label="pinned" size="small" color="warning" sx={{ ml: 0.5, height: 14, fontSize: '0.6rem' }} />}
                      {(f as any).override === 'excluded' && <Chip label="excluded" size="small" sx={{ ml: 0.5, height: 14, fontSize: '0.6rem' }} />}
                    </Typography>
                  </Box>
                  <Chip label={f.keep ? 'Keep' : 'Drop'} color={f.keep ? 'success' : 'default'} size="small" />
                </Box>
              ))}
            </Box>
          </SectionCard>
        </Grid>
      </Grid>

      {applyMutation.isPending && <LinearProgress sx={{ mt: 2 }} />}
    </Box>
  )
}
