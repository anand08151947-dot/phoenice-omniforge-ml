import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import { useDropzone } from 'react-dropzone'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import type { Dataset, DatasetProfile, SmartProfile } from '../../api/types'
import CloudUploadIcon from '@mui/icons-material/CloudUpload'
import StorageIcon from '@mui/icons-material/Storage'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import { usePipelineStore } from '../../stores/pipeline'
import DatasetOverviewCard from './DatasetOverviewCard'
import TargetAdvisor from './TargetAdvisor'
import TaskRecommendationCard from './TaskRecommendationCard'
import TargetDistributionChart from './TargetDistributionChart'
import TimeAwarenessCard from './TimeAwarenessCard'
import DataQualityWarnings from './DataQualityWarnings'
import FeaturePreviewGrid from './FeaturePreviewGrid'
import TopFeaturesCard from './TopFeaturesCard'
import ProblemDifficultyCard from './ProblemDifficultyCard'
import IntentWizard from './IntentWizard'

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ── Smart Setup Panel ──────────────────────────────────────────────────────────

function SmartSetupPanel({ dataset, onSaved }: { dataset: Dataset; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [targetCol, setTargetCol] = useState(dataset.target_column ?? '')
  const [taskType, setTaskType] = useState(dataset.task_type ?? 'classification')
  const [timeOption, setTimeOption] = useState('time_aware')

  // Load basic profile for column list fallback
  const { data: profile } = useQuery<DatasetProfile>({
    queryKey: ['profile', dataset.id],
    queryFn: () => fetch(`/api/profile?dataset_id=${dataset.id}`).then(r => r.json()),
    enabled: dataset.status === 'ready',
  })

  // Smart profile — all the ML intelligence
  const { data: smart, isLoading: smartLoading } = useQuery<SmartProfile>({
    queryKey: ['smart-profile', dataset.id],
    queryFn: () =>
      fetch(`/api/datasets/${dataset.id}/smart-profile`).then(async r => {
        if (!r.ok) throw new Error('not ready')
        return r.json()
      }),
    enabled: dataset.status === 'ready',
    retry: false,
    staleTime: 60_000,
  })

  const columns = profile?.columns?.map(c => c.name) ?? []

  async function save(col: string, task: string) {
    if (!col) return
    setSaving(true)
    await fetch(`/api/datasets/${dataset.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_column: col, task_type: task }),
    })
    setSaving(false)
    onSaved()
  }

  function applyRecommended() {
    const rec = smart?.recommended_target
    const task = smart?.resolved_task ?? 'classification'
    if (rec) {
      setTargetCol(rec)
      setTaskType(task)
      save(rec, task)
    }
  }

  if (dataset.status !== 'ready') return null

  return (
    <Box sx={{ mt: 2 }}>
      {smartLoading && <LinearProgress sx={{ mb: 1 }} />}

      {smart && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

          {/* ── Overview ── */}
          <SectionCard title="📊 Dataset Overview">
            <DatasetOverviewCard overview={smart.overview} typeSummary={smart.column_type_summary} />
          </SectionCard>

          {/* ── Quality Warnings ── */}
          {smart.data_quality_warnings.length > 0 && (
            <DataQualityWarnings warnings={smart.data_quality_warnings} />
          )}

          {/* ── Time Awareness ── */}
          {smart.time_awareness.has_datetime && (
            <TimeAwarenessCard
              timeAwareness={smart.time_awareness}
              selectedOption={timeOption}
              onChange={setTimeOption}
            />
          )}

          {/* ── Target + Task (side by side) ── */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 7 }}>
              <SectionCard title="🎯 Target Column Advisor">
                {/* Recommended setup button */}
                {smart.recommended_target && (
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      color="success"
                      size="small"
                      startIcon={<AutoAwesomeIcon />}
                      onClick={applyRecommended}
                      disabled={saving}
                    >
                      Use Recommended Setup ({smart.recommended_target} · {smart.resolved_task})
                    </Button>
                  </Box>
                )}
                <TargetAdvisor
                  candidates={smart.target_candidates}
                  selectedTarget={targetCol}
                  onSelect={(col, task) => { setTargetCol(col); setTaskType(task); save(col, task) }}
                />
                {/* Manual override fallback */}
                <Divider sx={{ my: 2 }} />
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Target Column</InputLabel>
                    <Select
                      label="Target Column"
                      value={targetCol}
                      disabled={saving}
                      onChange={e => { setTargetCol(e.target.value); save(e.target.value, taskType) }}
                    >
                      {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <IntentWizard onSelect={task => { setTaskType(task); if (targetCol) save(targetCol, task) }} />
                </Box>
              </SectionCard>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <SectionCard title="🧩 Task & Difficulty">
                <TaskRecommendationCard
                  recommendation={smart.task_recommendation}
                  selectedTask={taskType}
                  onChange={task => { setTaskType(task); if (targetCol) save(targetCol, task) }}
                />
                <Divider sx={{ my: 2 }} />
                <ProblemDifficultyCard difficulty={smart.problem_difficulty} imbalance={smart.imbalance_severity} />
              </SectionCard>
            </Grid>
          </Grid>

          {/* ── Target Distribution ── */}
          {smart.target_distribution && (
            <SectionCard title="📉 Target Distribution">
              <TargetDistributionChart dist={smart.target_distribution} />
            </SectionCard>
          )}

          {/* ── Top Features + Feature Preview ── */}
          <Grid container spacing={2}>
            {smart.top_features.length > 0 && targetCol && (
              <Grid size={{ xs: 12, md: 4 }}>
                <SectionCard title="🔬 Predictive Signals">
                  <TopFeaturesCard features={smart.top_features} targetCol={targetCol} />
                </SectionCard>
              </Grid>
            )}
            <Grid size={{ xs: 12, md: smart.top_features.length && targetCol ? 8 : 12 }}>
              <SectionCard title="🔍 Feature Preview">
                <FeaturePreviewGrid features={smart.feature_preview} />
              </SectionCard>
            </Grid>
          </Grid>

          {/* ── Proceed ── */}
          {targetCol && (
            <Alert severity="success" sx={{ display: 'flex', alignItems: 'center' }}
              action={
                <Button color="inherit" size="small" endIcon={<ArrowForwardIcon />}
                  onClick={() => onSaved()}>
                  Proceed to Pipeline
                </Button>
              }
            >
              Target set: <strong>&nbsp;{targetCol}&nbsp;</strong> · Task: <strong>{taskType}</strong>
            </Alert>
          )}
        </Box>
      )}

      {/* Fallback when smart profile not yet available */}
      {!smart && !smartLoading && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Target Column</InputLabel>
            <Select
              label="Target Column"
              value={targetCol}
              disabled={saving}
              onChange={e => { setTargetCol(e.target.value); save(e.target.value, taskType) }}
            >
              {columns.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          {targetCol && (
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Task</InputLabel>
              <Select label="Task" value={taskType} disabled={saving} onChange={e => { setTaskType(e.target.value); save(targetCol, e.target.value) }}>
                <MenuItem value="classification">Classification</MenuItem>
                <MenuItem value="regression">Regression</MenuItem>
                <MenuItem value="clustering">Clustering</MenuItem>
                <MenuItem value="anomaly_detection">Anomaly Detection</MenuItem>
                <MenuItem value="text_classification">Text Classification</MenuItem>
                <MenuItem value="forecasting">Forecasting</MenuItem>
              </Select>
            </FormControl>
          )}
        </Box>
      )}
    </Box>
  )
}

// ── Main Upload Page ───────────────────────────────────────────────────────────

export default function UploadPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const setDataset = usePipelineStore((s) => s.setDataset)
  const setPhaseStatus = usePipelineStore((s) => s.setPhaseStatus)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null)

  const { data } = useQuery<Dataset[]>({
    queryKey: ['datasets'],
    queryFn: () => fetch('/api/datasets').then((r) => r.json()),
    refetchInterval: (query) => {
      const ds = query.state.data as Dataset[] | undefined
      return ds?.some((d) => d.status === 'processing') ? 3000 : false
    },
  })

  const datasets: Dataset[] = Array.isArray(data) ? data : []

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    setUploadProgress(0)
    const interval = setInterval(() => setUploadProgress((p) => Math.min(p + 10, 85)), 300)
    try {
      const formData = new FormData()
      formData.append('file', acceptedFiles[0])
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      clearInterval(interval)
      setUploadProgress(100)
      if (res.ok) {
        const ds: Dataset = await res.json()
        setDataset(ds.id, ds.name)
        setPhaseStatus('upload', 'done')
        setActiveDatasetId(ds.id)
        await queryClient.invalidateQueries({ queryKey: ['datasets'] })
      }
    } finally {
      setTimeout(() => { setUploading(false); setUploadProgress(0) }, 800)
    }
  }, [queryClient, setDataset, setPhaseStatus])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls', '.xlsx'], 'application/json': ['.json'], 'application/parquet': ['.parquet'] },
    maxFiles: 1,
  })

  function useDataset(ds: Dataset) {
    setDataset(ds.id, ds.name)
    setPhaseStatus('upload', 'done')
    navigate('/profile')
  }

  return (
    <Box>
      <PageHeader title="Upload Dataset" subtitle="Phase 0 — Import your data to begin the AutoML pipeline" />

      {/* Drop zone */}
      <Box
        {...getRootProps()}
        sx={{
          border: '2px dashed', borderColor: isDragActive ? 'primary.main' : 'divider',
          borderRadius: 3, p: 6, textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s', bgcolor: isDragActive ? 'action.hover' : 'background.paper',
          mb: 3, '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <input {...getInputProps()} />
        <CloudUploadIcon sx={{ fontSize: 56, color: isDragActive ? 'primary.main' : 'text.disabled', mb: 1.5 }} />
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {isDragActive ? 'Drop your file here' : 'Drag & drop your dataset'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Supports CSV, Excel, JSON, Parquet — max 2GB
        </Typography>
        <Button variant="outlined" size="small">Browse Files</Button>
      </Box>

      {uploading && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>Uploading… {uploadProgress}%</Typography>
          <LinearProgress variant="determinate" value={uploadProgress} sx={{ borderRadius: 2, height: 6 }} />
        </Box>
      )}

      {/* Recent datasets */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>Recent Datasets</Typography>
      <Grid container spacing={2}>
        {datasets.map((ds) => {
          const isActive = ds.id === activeDatasetId
          return (
            <Grid key={ds.id} size={{ xs: 12 }}>
              <Card sx={{ border: '1px solid', borderColor: isActive ? 'primary.main' : 'divider' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <StorageIcon color="primary" />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{ds.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ds.row_count != null ? ds.row_count.toLocaleString() : '—'} rows · {ds.col_count ?? '—'} cols · {formatBytes(ds.file_size)}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.disabled">{new Date(ds.created_at).toLocaleDateString()}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-end' }}>
                      <Chip label={ds.status} color={ds.status === 'ready' ? 'success' : 'warning'} size="small" />
                      {ds.target_column && <Chip label={`→ ${ds.target_column}`} size="small" color="primary" variant="outlined" />}
                      {ds.task_type && ds.task_type !== 'unknown' && <Chip label={ds.task_type} size="small" variant="outlined" />}
                      {ds.status === 'ready' && (
                        <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => useDataset(ds)}>
                          Use
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {/* Smart setup panel — expanded for active dataset */}
                  {ds.status === 'ready' && isActive && (
                    <SmartSetupPanel
                      dataset={ds}
                      onSaved={() => {
                        queryClient.invalidateQueries({ queryKey: ['datasets'] })
                        queryClient.invalidateQueries({ queryKey: ['smart-profile', ds.id] })
                      }}
                    />
                  )}

                  {/* Compact selector for non-active ready datasets */}
                  {ds.status === 'ready' && !isActive && (
                    <Box sx={{ mt: 1 }}>
                      <Button size="small" variant="text" onClick={() => setActiveDatasetId(ds.id)}>
                        ▶ Set up this dataset
                      </Button>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </Box>
  )
}
