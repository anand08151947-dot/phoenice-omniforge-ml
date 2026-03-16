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
import TableContainer from '@mui/material/TableContainer'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Collapse from '@mui/material/Collapse'
import Tooltip from '@mui/material/Tooltip'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import { usePipelineStore } from '../../stores/pipeline'
import type { ModelCandidate } from '../../api/types'
import ModelDetailPanel from './ModelDetailPanel'

interface LeakageWarning {
  feature: string
  correlation: number
}

interface TrainingResults {
  dataset_id: string
  task_type: string
  target_column: string
  n_features: number
  features_used: string[]
  sampling_strategy: string
  leakage_warnings: LeakageWarning[]
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

function OverfitBadge({ trainScore, cvScore }: { trainScore: number; cvScore: number }) {
  const gap = trainScore - cvScore
  if (gap > 0.15)
    return <Chip label={`🚨 High (${(gap * 100).toFixed(1)}%)`} size="small" color="error" />
  if (gap > 0.05)
    return <Chip label={`⚠ Mild (${(gap * 100).toFixed(1)}%)`} size="small" color="warning" />
  return <Chip label="✓ OK" size="small" color="success" />
}

function CvStdCell({ cvScore, cvStd }: { cvScore: number; cvStd?: number }) {
  if (!cvStd) return <ScoreBadge value={cvScore} />
  const stdPct = (cvStd * 100).toFixed(1)
  const stability = cvStd < 0.02 ? '✓ Stable' : cvStd > 0.05 ? '⚠ Unstable' : '~ Moderate'
  return (
    <Tooltip title={`σ = ${stdPct}% — ${stability}`}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700, color: cvScore >= 0.85 ? '#4caf50' : cvScore >= 0.70 ? '#ff9800' : '#f44336' }}>
          {(cvScore * 100).toFixed(2)}%
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ±{stdPct}%
        </Typography>
      </Box>
    </Tooltip>
  )
}

export default function TrainingPage() {
  const { datasetId, setPhaseStatus } = usePipelineStore()
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  function toggleExpand(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  if (!datasetId) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">No dataset selected. Please upload a dataset first.</Alert>
      </Box>
    )
  }

  const isClassifier = data?.task_type === 'classification' || data?.task_type === 'anomaly_detection'

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

          {/* Leakage Warnings */}
          {(data.leakage_warnings?.length ?? 0) > 0 && (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon />}
              sx={{ mb: 2 }}
            >
              <strong>Potential Data Leakage Detected</strong> — The following features have suspiciously high correlation with the target (|ρ| &gt; 0.85), which may indicate leakage. Investigate before deploying:{' '}
              {data.leakage_warnings.map((w) => (
                <Chip
                  key={w.feature}
                  label={`${w.feature} (ρ=${w.correlation.toFixed(3)})`}
                  size="small"
                  color="warning"
                  sx={{ ml: 0.5, mb: 0.25 }}
                />
              ))}
            </Alert>
          )}

          {/* Leaderboard */}
          <SectionCard
            title="Model Leaderboard"
            subheader={`${data.candidates.length} models trained · Ranked by ${isClassifier ? 'CV Accuracy' : 'CV R²'} · Click Details to inspect per-fold scores, class metrics, and threshold analysis`}
          >
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Library</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {isClassifier ? 'CV Accuracy ± σ' : 'CV R² ± σ'}
                      <Tooltip title="Mean ± Std deviation across 5 folds. Lower σ = more stable model.">
                        <InfoOutlinedIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: 'text.secondary' }} />
                      </Tooltip>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      Overfit?
                      <Tooltip title="Train score minus CV score. Gap > 15% = High; 5-15% = Mild; < 5% = OK.">
                        <InfoOutlinedIcon sx={{ fontSize: 14, ml: 0.5, verticalAlign: 'middle', color: 'text.secondary' }} />
                      </Tooltip>
                    </TableCell>
                    {isClassifier && <TableCell sx={{ fontWeight: 700 }}>F1 (weighted)</TableCell>}
                    {isClassifier && <TableCell sx={{ fontWeight: 700 }}>AUC-ROC</TableCell>}
                    {!isClassifier && <TableCell sx={{ fontWeight: 700 }}>RMSE</TableCell>}
                    <TableCell sx={{ fontWeight: 700 }}>Train Time</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.candidates.map((c, idx) => {
                    const isBest = idx === 0 && c.status === 'done'
                    const isExpanded = expandedId === c.id
                    const colSpan = isClassifier ? 10 : 9

                    return (
                      <>
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
                            <CvStdCell cvScore={c.cv_score} cvStd={c.cv_std} />
                          </TableCell>
                          <TableCell>
                            <OverfitBadge trainScore={c.train_score} cvScore={c.cv_score} />
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
                          <TableCell>
                            {c.status === 'done' && (
                              <Button
                                size="small"
                                variant="outlined"
                                endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                onClick={() => toggleExpand(c.id)}
                                sx={{ fontSize: '0.7rem', py: 0.25, px: 1 }}
                              >
                                {isExpanded ? 'Hide' : 'Details'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>

                        {/* Expandable detail row */}
                        <TableRow key={`${c.id}-detail`}>
                          <TableCell colSpan={colSpan} sx={{ p: 0, border: 0 }}>
                            <Collapse in={isExpanded} unmountOnExit>
                              <ModelDetailPanel candidate={c} isClassifier={isClassifier ?? false} />
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </SectionCard>
        </>
      )}
    </Box>
  )
}
