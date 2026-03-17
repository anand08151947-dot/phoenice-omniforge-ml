import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Chip from '@mui/material/Chip'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import MetricCard from '../../components/shared/MetricCard'
import type { EvaluationReport } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import AssessmentIcon from '@mui/icons-material/Assessment'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useEffect, useMemo, useState } from 'react'

import PRCurveChart from './PRCurveChart'
import PerClassMetricsTable from './PerClassMetricsTable'
import ThresholdSlider from './ThresholdSlider'
import LearningCurveChart from './LearningCurveChart'
import CalibrationChart from './CalibrationChart'
import PredictionDistributionChart from './PredictionDistributionChart'
import ModelComplexityPanel from './ModelComplexityPanel'
import BusinessImpactCalculator from './BusinessImpactCalculator'

function ConfusionMatrix({ labels, values }: { labels: string[]; values: number[][] }) {
  const max = Math.max(...values.flat()) || 1
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 2, height: '100%', justifyContent: 'center' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `80px repeat(${labels.length}, 1fr)`, gap: 0.5, mb: 0.5 }}>
        <Box />
        {labels.map((l) => (
          <Typography key={l} variant="caption" align="center" color="text.secondary" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l}
          </Typography>
        ))}
      </Box>
      {values.map((row, ri) => (
        <Box key={ri} sx={{ display: 'grid', gridTemplateColumns: `80px repeat(${labels.length}, 1fr)`, gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center' }}>
            {labels[ri]}
          </Typography>
          {row.map((val, ci) => {
            const intensity = val / max
            const isCorrect = ri === ci
            return (
              <Tooltip key={ci} title={`Actual: ${labels[ri]} → Predicted: ${labels[ci]}: ${val.toLocaleString()}`}>
                <Box sx={{
                  bgcolor: isCorrect ? `rgba(108,99,255,${0.2 + intensity * 0.8})` : `rgba(239,83,80,${0.1 + intensity * 0.6})`,
                  borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', minHeight: 56,
                  border: '1px solid', borderColor: isCorrect ? 'primary.main' : 'error.main', cursor: 'default',
                }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>{val.toLocaleString()}</Typography>
                  <Typography variant="caption" color="text.secondary">{(intensity * 100).toFixed(0)}%</Typography>
                </Box>
              </Tooltip>
            )
          })}
        </Box>
      ))}
      <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 1 }}>Rows = Actual · Columns = Predicted</Typography>
    </Box>
  )
}

export default function EvaluationPage() {
  const { datasetId, datasetName, setPhaseStatus } = usePipelineStore()
  const queryClient = useQueryClient()
  const [running, setRunning] = useState(false)
  const [activeTab, setActiveTab] = useState(0)

  const { data, isLoading } = useQuery<EvaluationReport>({
    queryKey: ['evaluation', datasetId],
    queryFn: () => fetch(`/api/evaluation?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error('no_results')
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  useEffect(() => {
    if (data?.champion_model_id) setPhaseStatus('evaluation', 'done')
  }, [data, setPhaseStatus])

  const runMutation = useMutation({
    mutationFn: () =>
      fetch('/api/evaluation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset_id: datasetId }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}))
          throw new Error(err.detail || 'Evaluation failed')
        }
        return r.json()
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evaluation', datasetId] })
      setRunning(false)
    },
    onError: () => setRunning(false),
  })

  const colDefs: any[] = useMemo(() => [
    { field: 'rank', headerName: '#', width: 55, sortable: true },
    { field: 'model_name', headerName: 'Model', flex: 2, sortable: true,
      cellStyle: (p: any) => p.data.status === 'champion' ? { background: 'rgba(255,215,0,0.15)', fontWeight: 700 } : {} },
    { field: 'cv_score', headerName: 'CV Score', flex: 1, sortable: true, valueFormatter: (p: any) => `${(p.value * 100).toFixed(2)}%` },
    { field: 'train_score', headerName: 'Train Score', flex: 1, sortable: true, valueFormatter: (p: any) => `${(p.value * 100).toFixed(2)}%` },
    { field: 'f1', headerName: 'F1', flex: 1, sortable: true, valueFormatter: (p: any) => p.value.toFixed(4) },
    { field: 'auc_roc', headerName: 'AUC-ROC', flex: 1, sortable: true, valueFormatter: (p: any) => p.value.toFixed(4) },
    { field: 'train_time_s', headerName: 'Time', flex: 1, sortable: true, valueFormatter: (p: any) => `${p.value.toFixed(1)}s` },
    { field: 'overfit', headerName: 'Overfit?', flex: 1, cellRenderer: (p: any) =>
      p.value
        ? <span style={{ color: '#ff9800', fontWeight: 700 }}>⚠ Yes ({p.data.overfit_gap > 0 ? '+' : ''}{(p.data.overfit_gap * 100).toFixed(1)}%)</span>
        : <span style={{ color: '#4caf50' }}>✓ OK</span>
    },
    { field: 'status', headerName: 'Status', flex: 1, cellRenderer: (p: any) => {
      const color = p.value === 'champion' ? '#FFD700' : p.value === 'challenger' ? '#6C63FF' : '#888'
      return <span style={{ color, fontWeight: 700, textTransform: 'capitalize' }}>{p.value}</span>
    }},
  ], [])

  if (!datasetId) return <Alert severity="warning" sx={{ m: 2 }}>No dataset selected.</Alert>
  if (isLoading) return <LinearProgress />

  const champion = data?.leaderboard?.find((m) => m.model_id === data.champion_model_id)

  // Derive TP/FP/FN/TN for threshold analysis from optimal threshold point
  const optimalThreshPt = data?.threshold_analysis?.find(
    (pt) => Math.abs(pt.threshold - (data.optimal_threshold ?? 0.5)) < 0.03
  ) ?? data?.threshold_analysis?.[0]

  // Prevalence = positive class fraction (for PR baseline)
  const prevalence = data?.confusion_matrix?.values?.length === 2
    ? (data.confusion_matrix.values[0][0] + data.confusion_matrix.values[0][1]) /
      Math.max(data.confusion_matrix.values.flat().reduce((a, b) => a + b, 0), 1)
    : undefined

  return (
    <Box>
      <PageHeader
        title="Model Evaluation"
        subtitle={`Phase 8+9 — Overfitting detection & model selection · ${datasetName ?? ''}`}
        actions={
          <Button
            variant="contained"
            size="large"
            startIcon={<AssessmentIcon />}
            onClick={() => { setRunning(true); runMutation.mutate() }}
            disabled={running || runMutation.isPending}
            color={data ? 'inherit' : 'primary'}
          >
            {running || runMutation.isPending ? 'Evaluating…' : data ? 'Re-run Evaluation' : 'Run Evaluation'}
          </Button>
        }
      />

      {(running || runMutation.isPending) && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="info" sx={{ mb: 1 }}>
            Evaluating champion model — computing confusion matrix, ROC/PR curves, feature importances, learning curves, calibration, and complexity…
          </Alert>
          <LinearProgress />
        </Box>
      )}

      {runMutation.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(runMutation.error as Error)?.message}
        </Alert>
      )}

      {!data && !running && !runMutation.isPending && (
        <SectionCard title="Ready to Evaluate">
          <Alert severity="info">
            Click <strong>Run Evaluation</strong> to compute confusion matrix, ROC/PR curves, feature importances, threshold analysis, learning curves, and model complexity.
          </Alert>
        </SectionCard>
      )}

      {data && (
        <>
          {/* Stale evaluation warning */}
          {data.stale && (
            <Alert
              severity="warning"
              sx={{ mb: 2 }}
              action={
                <Button
                  size="small"
                  color="inherit"
                  onClick={() => { setRunning(true); runMutation.mutate() }}
                  disabled={running || runMutation.isPending}
                >
                  Re-run Now
                </Button>
              }
            >
              <strong>Evaluation is out of date.</strong> Training was run after the last evaluation — the champion shown here may differ from the current Rank 1 model in training. Re-run evaluation to sync.
            </Alert>
          )}

          {/* Evaluation engine error — surfaced for diagnostics */}
          {data.eval_error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <strong>Evaluation engine error (deep metrics unavailable):</strong> {data.eval_error}
            </Alert>
          )}

          {/* Overfitting warnings */}
          {(data.overfit_warnings ?? []).length > 0 && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
              <strong>Overfitting detected in candidate models</strong> — these non-champion candidates may generalise poorly:
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {data.overfit_warnings!.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </Alert>
          )}

          {/* McNemar significance badge */}
          {data.mcnemar && (
            <Alert
              severity={data.mcnemar.significant ? 'success' : 'info'}
              sx={{ mb: 2 }}
            >
              Statistical significance (McNemar test): champion <strong>{data.mcnemar.champion}</strong> vs challenger <strong>{data.mcnemar.challenger}</strong> —{' '}
              p = <strong>{data.mcnemar.p_value.toFixed(4)}</strong>
              {data.mcnemar.significant ? ' ✅ Champion is significantly better.' : ' — difference not statistically significant at α=0.05.'}
            </Alert>
          )}

          {/* Champion summary */}
          {champion && (
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                { label: 'Champion Model', value: data.champion_model_name || champion.model_name, icon: <EmojiEventsIcon />, color: '#FFD700' },
                { label: 'CV Score', value: `${(champion.cv_score * 100).toFixed(2)}%`, color: '#6C63FF' },
                { label: 'F1 Score', value: champion.f1.toFixed(4), color: '#4CAF50' },
                { label: 'AUC-ROC', value: champion.auc_roc.toFixed(4), color: '#FF6584' },
              ].map(({ label, value, icon, color }) => (
                <Grid key={label} size={{ xs: 6, md: 3 }}>
                  <MetricCard label={label} value={value} icon={icon ?? <EmojiEventsIcon />} color={color} />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Tab navigation */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} variant="scrollable" scrollButtons="auto">
              <Tab label="Overview" />
              <Tab label="Per-Class Metrics" />
              <Tab
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Threshold & Impact
                    {data.optimal_threshold != null && (
                      <Chip label={`opt=${data.optimal_threshold.toFixed(2)}`} size="small" color="success" sx={{ fontSize: '0.65rem', height: 18 }} />
                    )}
                  </Box>
                }
              />
              <Tab label="Curves" />
              <Tab label="Complexity" />
            </Tabs>
          </Box>

          {/* ── Tab 0: Overview ── */}
          {activeTab === 0 && (
            <>
              {/* Leaderboard */}
              <SectionCard title="Model Leaderboard" subheader="Click column headers to sort · Overfit = train-CV gap > 10%" noPadding sx={{ mb: 2 }}>
                <div className="ag-theme-alpine-dark" style={{ height: 280, width: '100%' }}>
                  <AgGridReact
                    rowData={data.leaderboard}
                    columnDefs={colDefs}
                    defaultColDef={{ resizable: true }}
                    suppressMovableColumns
                    animateRows
                  />
                </div>
              </SectionCard>

              <Grid container spacing={2}>
                {/* Confusion matrix */}
                {data.confusion_matrix?.labels?.length > 0 && (
                  <Grid size={{ xs: 12, lg: 5 }}>
                    <SectionCard title="Confusion Matrix" subheader={`Champion: ${data.champion_model_name}`}>
                      <ConfusionMatrix labels={data.confusion_matrix.labels} values={data.confusion_matrix.values} />
                    </SectionCard>
                  </Grid>
                )}

                {/* ROC curve */}
                {data.roc_curve?.length > 0 && (
                  <Grid size={{ xs: 12, lg: 7 }}>
                    <SectionCard title="ROC Curve" subheader={`AUC = ${champion?.auc_roc.toFixed(4)}`}>
                      <Box sx={{ height: 280 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={data.roc_curve} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="fpr" tickFormatter={(v) => v.toFixed(1)} label={{ value: 'FPR', position: 'insideBottomRight', offset: -5, fontSize: 12 }} />
                            <YAxis tickFormatter={(v) => v.toFixed(1)} label={{ value: 'TPR', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                            <RechartsTooltip formatter={(v: any) => [Number(v).toFixed(3)]} />
                            <ReferenceLine stroke="#555" segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} strokeDasharray="5 5" />
                            <Line type="monotone" dataKey="tpr" stroke="#6C63FF" strokeWidth={2} dot={false} name="ROC" />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    </SectionCard>
                  </Grid>
                )}

                {/* Feature importances */}
                {data.feature_importances?.length > 0 && (
                  <Grid size={{ xs: 12 }}>
                    <SectionCard title="Feature Importances" subheader={`Champion model: ${data.champion_model_name} · Top ${Math.min(data.feature_importances.length, 20)}`}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                        {data.feature_importances.slice(0, 20).map((fi: any) => (
                          <Box key={fi.feature} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ width: 180, flexShrink: 0, fontFamily: 'monospace' }}>{fi.feature}</Typography>
                            <Box sx={{ flex: 1, bgcolor: 'action.hover', borderRadius: 1, height: 14, position: 'relative' }}>
                              <Box sx={{ width: `${(fi.importance * 100).toFixed(1)}%`, bgcolor: 'primary.main', borderRadius: 1, height: '100%', minWidth: 2 }} />
                            </Box>
                            <Typography variant="caption" sx={{ width: 52, textAlign: 'right', flexShrink: 0 }}>
                              {(fi.importance * 100).toFixed(2)}%
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    </SectionCard>
                  </Grid>
                )}
              </Grid>
            </>
          )}

          {/* ── Tab 1: Per-Class Metrics ── */}
          {activeTab === 1 && (
            <SectionCard title="Per-Class Metrics" subheader="Precision, Recall, F1, and support per class — color codes: 🟢 ≥0.7 · 🟡 0.5–0.7 · 🔴 <0.5">
              {data.per_class_metrics?.length
                ? <PerClassMetricsTable metrics={data.per_class_metrics} />
                : <Alert severity="info">Click <strong>Re-run Evaluation</strong> to compute per-class metrics for the champion model.</Alert>
              }
            </SectionCard>
          )}

          {/* ── Tab 2: Threshold & Business Impact ── */}
          {activeTab === 2 && (
            <Grid container spacing={2}>
              {(data.n_classes ?? 2) > 2 ? (
                <Grid size={12}>
                  <Alert severity="info">
                    <strong>Threshold analysis is only available for binary classification.</strong>
                    {' '}This model has {data.n_classes} output classes. For per-class performance, see the <em>Per-Class Metrics</em> tab.
                  </Alert>
                </Grid>
              ) : data.threshold_analysis?.length ? (
                <>
                  <Grid size={{ xs: 12 }}>
                    <SectionCard
                      title="Decision Threshold Analysis"
                      subheader={`Drag slider to explore trade-offs · Optimal threshold (max F1) = ${data.optimal_threshold?.toFixed(2) ?? '0.50'}`}
                    >
                      <ThresholdSlider data={data.threshold_analysis} optimalThreshold={data.optimal_threshold ?? 0.5} />
                    </SectionCard>
                  </Grid>
                  {optimalThreshPt && (
                    <Grid size={{ xs: 12 }}>
                      <SectionCard
                        title="Business Impact Calculator"
                        subheader={`Counts at optimal threshold (${data.optimal_threshold?.toFixed(2) ?? '0.50'}) — adjust values to match your cost model`}
                      >
                        <BusinessImpactCalculator
                          tp={optimalThreshPt.tp}
                          fp={optimalThreshPt.fp}
                          fn={optimalThreshPt.fn}
                          tn={optimalThreshPt.tn}
                        />
                      </SectionCard>
                    </Grid>
                  )}
                </>
              ) : (
                <Grid size={12}>
                  <Alert severity="info">Click <strong>Re-run Evaluation</strong> to compute threshold sweep and business impact analysis.</Alert>
                </Grid>
              )}
            </Grid>
          )}

          {/* ── Tab 3: Curves ── */}
          {activeTab === 3 && (
            <Grid container spacing={2}>
              {/* ROC curve — binary or multiclass OVR best-class */}
              {data.roc_curve && data.roc_curve.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard
                    title={(data.n_classes ?? 2) > 2 ? 'ROC Curve (best class, one-vs-rest)' : 'ROC Curve'}
                    subheader={(data.n_classes ?? 2) > 2
                      ? `Multiclass OVR: showing highest-AUC class · ${data.n_classes} total classes`
                      : 'True positive rate vs false positive rate'}
                  >
                    {/* Reuse PRCurveChart as a simple ROC renderer */}
                    <PRCurveChart data={data.roc_curve.map((p: any) => ({ recall: p.fpr, precision: p.tpr }))} prevalence={0} isROC />
                  </SectionCard>
                </Grid>
              )}
              {/* PR curve — binary only */}
              {data.pr_curve && data.pr_curve.length > 0 && (data.n_classes ?? 2) === 2 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard title="Precision-Recall Curve" subheader="Critical for imbalanced datasets — area under curve should exceed baseline">
                    <PRCurveChart data={data.pr_curve} prevalence={prevalence} />
                  </SectionCard>
                </Grid>
              )}
              {data.learning_curve && data.learning_curve.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard title="Learning Curves" subheader="Train vs validation score as training data grows — diagnoses over/underfitting">
                    <LearningCurveChart data={data.learning_curve} />
                  </SectionCard>
                </Grid>
              )}
              {data.calibration_data && data.calibration_data.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard title="Calibration Curve" subheader="Do predicted probabilities match actual frequencies? (reliability diagram)">
                    <CalibrationChart data={data.calibration_data} />
                  </SectionCard>
                </Grid>
              )}
              {data.prediction_distribution && data.prediction_distribution.length > 0 && (
                <Grid size={{ xs: 12, md: 6 }}>
                  <SectionCard title="Score Distribution" subheader="Distribution of model output probabilities by true class — wider separation = better">
                    <PredictionDistributionChart data={data.prediction_distribution} optimalThreshold={data.optimal_threshold} />
                  </SectionCard>
                </Grid>
              )}
              {!data.roc_curve?.length && !data.pr_curve?.length && !data.learning_curve?.length && !data.calibration_data?.length && !data.prediction_distribution?.length && (
                <Grid size={12}>
                  <Alert severity="info">Click <strong>Re-run Evaluation</strong> to compute ROC curve, learning curves, calibration, and score distribution charts.</Alert>
                </Grid>
              )}
            </Grid>
          )}

          {/* ── Tab 4: Complexity ── */}
          {activeTab === 4 && (
            <SectionCard title="Model Complexity & Deployment Readiness" subheader={`Champion: ${data.champion_model_name} · Estimated at evaluation time`}>
              {data.model_complexity
                ? <ModelComplexityPanel complexity={data.model_complexity} />
                : <Alert severity="info">Click <strong>Re-run Evaluation</strong> to compute model size, inference latency, and throughput estimates.</Alert>
              }
            </SectionCard>
          )}

          {/* Promote button */}
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" color="success" startIcon={<RocketLaunchIcon />} size="large" disabled>
              Promote Champion to Production (Phase 11)
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}

