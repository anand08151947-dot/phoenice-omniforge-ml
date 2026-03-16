import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
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

interface EvalReportExtended extends EvaluationReport {
  champion_model_name?: string
  overfit_warnings?: string[]
  sampling_strategy?: string
}

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

  const { data, isLoading } = useQuery<EvalReportExtended>({
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
            Evaluating champion model with cross-validation — computing confusion matrix, ROC curve, and feature importances…
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
            Click <strong>Run Evaluation</strong> to compute confusion matrix, ROC curve, feature importances, and overfitting analysis for all trained models.
          </Alert>
        </SectionCard>
      )}

      {data && (
        <>
          {/* Overfitting warnings */}
          {(data.overfit_warnings ?? []).length > 0 && (
            <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mb: 2 }}>
              <strong>Overfitting detected:</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                {data.overfit_warnings!.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
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

          {/* Promote button */}
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" color="success" startIcon={<RocketLaunchIcon />} size="large" disabled>
              Promote Champion to Production (Phase 11)
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}

