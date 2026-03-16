import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import MetricCard from '../../components/shared/MetricCard'
import type { DatasetProfile, SmartProfile } from '../../api/types'
import ColumnCard from './ColumnCard'
import TargetSignalsPanel from './TargetSignalsPanel'
import ComplexityPanel from './ComplexityPanel'
import StorageIcon from '@mui/icons-material/Storage'
import TableRowsIcon from '@mui/icons-material/TableRows'
import WarningIcon from '@mui/icons-material/Warning'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { usePipelineStore } from '../../stores/pipeline'
import TopFeaturesCard from '../Upload/TopFeaturesCard'
import DataQualityWarnings from '../Upload/DataQualityWarnings'
import TimeAwarenessCard from '../Upload/TimeAwarenessCard'

export default function ProfilePage() {
  const navigate = useNavigate()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)

  const { data, isLoading, error } = useQuery<DatasetProfile | { status: string }>({
    queryKey: ['profile', datasetId],
    queryFn: () => fetch(`/api/profile?dataset_id=${datasetId}`).then((r) => r.json()),
    enabled: !!datasetId,
    refetchInterval: (query) => {
      const d = query.state.data as any
      return d?.status === 'processing' ? 3000 : false
    },
  })

  // Smart profile for ML-expert signals
  const { data: smart } = useQuery<SmartProfile>({
    queryKey: ['smart-profile', datasetId],
    queryFn: () =>
      fetch(`/api/datasets/${datasetId}/smart-profile`).then(async r => {
        if (!r.ok) throw new Error('not ready')
        return r.json()
      }),
    enabled: !!datasetId && !!(data as DatasetProfile)?.columns,
    retry: false,
    staleTime: 120_000,
  })

  const profile = (data as DatasetProfile)?.columns ? (data as DatasetProfile) : null

  useEffect(() => {
    if (profile) {
      setPhaseStatus('profile', 'done')
    }
  }, [profile, setPhaseStatus])

  if (!datasetId) {
    return (
      <Box>
        <PageHeader title="Dataset Profile" subtitle="Phase 1 — Statistical summary of all columns" />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Upload or select a dataset first.
        </Alert>
      </Box>
    )
  }

  if (isLoading) return <LinearProgress />

  const processing = (data as any)?.status === 'processing'
  if (processing) {
    return (
      <Box>
        <PageHeader title="Dataset Profile" subtitle={`Profiling: ${datasetName}`} />
        <Alert severity="info">Profiling in progress… This may take a moment.</Alert>
        <LinearProgress sx={{ mt: 2 }} />
      </Box>
    )
  }

  if (error || !profile) {
    return (
      <Box>
        <PageHeader title="Dataset Profile" subtitle="Phase 1 — Statistical summary of all columns" />
        <Alert severity="error">Failed to load profile. Try re-uploading the dataset.</Alert>
      </Box>
    )
  }

  const qualityScores = smart?.feature_quality_scores ?? {}
  const targetCol = smart?.recommended_target ?? null
  const hasSmartData = !!smart

  return (
    <Box>
      <PageHeader
        title="Dataset Profile"
        subtitle="Phase 1 — Statistical summary of all columns"
      />

      {/* Summary metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Rows" value={profile.row_count.toLocaleString()} icon={<TableRowsIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Columns" value={profile.col_count} icon={<StorageIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Missing %" value={`${(profile.missing_pct * 100).toFixed(1)}%`} icon={<WarningIcon />} color={profile.missing_pct > 0.1 ? '#EF5350' : '#FFA726'} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Duplicates" value={profile.duplicate_rows} icon={<ContentCopyIcon />} color={profile.duplicate_rows > 0 ? '#FFA726' : '#4CAF50'} />
        </Grid>
      </Grid>

      {/* ── ML-Expert Panels (shown when smart profile is ready) ── */}
      {hasSmartData && (
        <>
          {/* Target-aware signals */}
          {targetCol && smart.task_recommendation && (
            <TargetSignalsPanel
              targetCol={targetCol}
              resolvedTask={smart.resolved_task}
              targetDist={smart.target_distribution}
              imbalance={smart.imbalance_severity}
              taskRec={smart.task_recommendation}
            />
          )}

          {/* Data quality warnings (missing, constant, leakage) */}
          {smart.data_quality_warnings.length > 0 && (
            <Box sx={{ mb: 3 }}>
              <DataQualityWarnings warnings={smart.data_quality_warnings} />
            </Box>
          )}

          {/* Time awareness */}
          {smart.time_awareness.has_datetime && (
            <Box sx={{ mb: 3 }}>
              <TimeAwarenessCard timeAwareness={smart.time_awareness} selectedOption="time_aware" onChange={() => {}} />
            </Box>
          )}

          {/* Predictive signals (top features) */}
          {targetCol && smart.top_features.length > 0 && (
            <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <TopFeaturesCard features={smart.top_features} targetCol={targetCol} />
            </Box>
          )}

          {/* Complexity + type issues */}
          <ComplexityPanel complexity={smart.complexity_indicators} dtypeIssues={smart.data_type_issues} />

          <Divider sx={{ mb: 3 }}>
            <Typography variant="caption" color="text.secondary">Column Details</Typography>
          </Divider>
        </>
      )}

      {/* Column cards */}
      <Grid container spacing={2}>
        {profile.columns.map((col) => (
          <Grid key={col.name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ColumnCard col={col} qualityScore={qualityScores[col.name]} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
