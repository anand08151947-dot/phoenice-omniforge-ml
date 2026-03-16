import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import { usePipelineStore } from '../../stores/pipeline'
import type { ModelCandidate } from '../../api/types'

interface TrainingResults {
  dataset_id: string
  task_type: string
  target_column: string
  n_features: number
  features_used: string[]
  sampling_strategy: string
  candidates: ModelCandidate[]
  best_model: string | null
  best_cv_score: number
}

function ScoreBadge({ value, isPercent = true }: { value: number; isPercent?: boolean }) {
  const color = value >= 0.85 ? '#4caf50' : value >= 0.70 ? '#ff9800' : '#f44336'
  return (
    <Typography variant="body2" sx={{ fontWeight: 700, color }}>
      {isPercent ? `${(value * 100).toFixed(2)}%` : value.toFixed(4)}
    </Typography>
  )
}

export default function TrainingPage() {
  const { datasetId, setPhaseStatus } = usePipelineStore()
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)

  const { data, isLoading, error } = useQuery<TrainingResults>({
    queryKey: ['training', datasetId],
    queryFn: () =>
      fetch(`/api/training?dataset_id=${datasetId}`).then((r) => {
        if (!r.ok) throw new Error('no_results')
        return r.json()
      }),
    enabled: !!datasetId,
    retry: false,
  })

  useEffect(() => {
    if (data?.candidates?.length) {
      setPhaseStatus('training', 'done')
    }
  }, [data, setPhaseStatus])

  const runMutation = useMutation({
    mutationFn: () =>
      fetch('/api/training/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: datasetId }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.detail || 'Training failed')
        }
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training', datasetId] })
      setRunning(false)
    },
    onError: () => setRunning(false),
  })

  function handleRun() {
    setRunning(true)
    runMutation.mutate()
  }

  if (!datasetId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">No dataset selected. Please upload a dataset first.</Alert>
      </Box>
    )
  }

  const isClassifier = data?.task_type === 'classification' || data?.task_type === 'anomaly_detection'
  const primaryMetric = isClassifier ? 'cv_score' : 'cv_score'

  return (
    <Box>
      <PageHeader
        title="AutoML Training"
        subtitle="Phase 7 — Train multiple models with cross-validation and compare results"
        actions={
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrowIcon />}
            onClick={handleRun}
            disabled={running || runMutation.isPending}
          >
            {running || runMutation.isPending ? 'Training… (this may take a few minutes)' : data ? 'Re-run Training' : 'Run AutoML'}
          </Button>
        }
      />

      {(running || runMutation.isPending) && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            Training in progress — running LightGBM, XGBoost, Random Forest, and Logistic Regression with 5-fold cross-validation…
          </Alert>
          <LinearProgress />
        </Box>
      )}

      {runMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(runMutation.error as Error)?.message || 'Training failed'}
        </Alert>
      )}

      {isLoading && <LinearProgress />}

      {!data && !isLoading && !running && !runMutation.isPending && (
        <SectionCard title="Ready to Train">
          <Alert severity="info">
            Click <strong>Run AutoML</strong> to train all models. Training uses the selected features from Phase 6 and respects your sampling strategy.
          </Alert>
        </SectionCard>
      )}

      {data && (
        <>
          {/* Context summary */}
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: 'Task Type', value: data.task_type },
              { label: 'Target Column', value: data.target_column },
              { label: 'Features Used', value: `${data.n_features} features` },
              { label: 'Sampling Strategy', value: data.sampling_strategy || 'none' },
              { label: 'Best Model', value: data.best_model || '—' },
              {
                label: 'Best CV Score',
                value: isClassifier
                  ? `${(data.best_cv_score * 100).toFixed(2)}%`
                  : data.best_cv_score.toFixed(4),
              },
            ].map(({ label, value }) => (
              <Grid key={label} size={{ xs: 6, sm: 4, md: 2 }}>
                <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, mt: 0.5 }}>{value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Leaderboard */}
          <SectionCard
            title="Model Leaderboard"
            subheader={`${data.candidates.length} models trained · Ranked by ${isClassifier ? 'CV Accuracy' : 'CV R²'}`}
          >
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Library</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    {isClassifier ? 'CV Accuracy' : 'CV R²'}
                    <Tooltip title="Cross-validation score (5-fold). Higher is better.">
                      <InfoOutlinedIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: 'text.secondary' }} />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Train Score</TableCell>
                  {isClassifier && <TableCell sx={{ fontWeight: 700 }}>F1 (weighted)</TableCell>}
                  {isClassifier && <TableCell sx={{ fontWeight: 700 }}>AUC-ROC</TableCell>}
                  {!isClassifier && <TableCell sx={{ fontWeight: 700 }}>RMSE</TableCell>}
                  <TableCell sx={{ fontWeight: 700 }}>Train Time</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.candidates.map((c, idx) => {
                  const isBest = idx === 0 && c.status === 'done'
                  return (
                    <TableRow
                      key={c.id}
                      sx={{
                        backgroundColor: isBest ? 'rgba(76,175,80,0.08)' : undefined,
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                    >
                      <TableCell>
                        {isBest ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <EmojiEventsIcon sx={{ color: '#ffd700', fontSize: 18 }} />
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>1</Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">{idx + 1}</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: isBest ? 700 : 400 }}>{c.model_name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={c.library} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell>
                        <ScoreBadge value={c.cv_score} />
                      </TableCell>
                      <TableCell>
                        <ScoreBadge value={c.train_score} />
                      </TableCell>
                      {isClassifier && (
                        <TableCell>
                          <ScoreBadge value={c.f1} />
                        </TableCell>
                      )}
                      {isClassifier && (
                        <TableCell>
                          <ScoreBadge value={c.auc_roc} />
                        </TableCell>
                      )}
                      {!isClassifier && (
                        <TableCell>
                          <Typography variant="body2">{c.rmse?.toFixed(4) ?? '—'}</Typography>
                        </TableCell>
                      )}
                      <TableCell>
                        <Typography variant="body2">{c.train_time_s}s</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={c.status}
                          size="small"
                          color={c.status === 'done' ? 'success' : c.status === 'failed' ? 'error' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </SectionCard>
        </>
      )}
    </Box>
  )
}

