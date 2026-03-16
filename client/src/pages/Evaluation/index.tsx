import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import { useQuery } from '@tanstack/react-query'
import { AgGridReact } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import PageHeader from '../../components/shared/PageHeader'
import SectionCard from '../../components/shared/SectionCard'
import MetricCard from '../../components/shared/MetricCard'
import type { EvaluationReport } from '../../api/types'
import { usePipelineStore } from '../../stores/pipeline'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { useMemo } from 'react'

function ConfusionMatrix({ labels, values }: { labels: string[]; values: number[][] }) {
  const max = Math.max(...values.flat())
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, p: 2, height: '100%', justifyContent: 'center' }}>
      {/* Column header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: `80px repeat(${labels.length}, 1fr)`, gap: 0.5, mb: 0.5 }}>
        <Box />
        {labels.map((l) => (
          <Typography key={l} variant="caption" align="center" color="text.secondary" sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {l.split(' ')[0]}
          </Typography>
        ))}
      </Box>
      {values.map((row, ri) => (
        <Box key={ri} sx={{ display: 'grid', gridTemplateColumns: `80px repeat(${labels.length}, 1fr)`, gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {labels[ri].split(' ')[0]}
          </Typography>
          {row.map((val, ci) => {
            const intensity = val / max
            const isCorrect = ri === ci
            return (
              <Box
                key={ci}
                sx={{
                  bgcolor: isCorrect
                    ? `rgba(108,99,255,${0.2 + intensity * 0.8})`
                    : `rgba(239,83,80,${0.1 + intensity * 0.6})`,
                  borderRadius: 1,
                  p: 1.5,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: 64,
                  border: '1px solid',
                  borderColor: isCorrect ? 'primary.main' : 'error.main',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1 }}>{val.toLocaleString()}</Typography>
                <Typography variant="caption" color="text.secondary">{(intensity * 100).toFixed(0)}%</Typography>
              </Box>
            )
          })}
        </Box>
      ))}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 1 }}>
        <Typography variant="caption" color="text.secondary">← Actual · Predicted →</Typography>
      </Box>
    </Box>
  )
}

export default function EvaluationPage() {
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)

  const { data, isLoading, error } = useQuery<EvaluationReport>({
    queryKey: ['evaluation', datasetId],
    queryFn: () => fetch(`/api/evaluation?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`Evaluation API returned ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  const colDefs: any[] = useMemo(() => [
    { field: 'rank', headerName: '#', width: 50, sortable: true },
    { field: 'model_name', headerName: 'Model', flex: 2, sortable: true,
      cellStyle: (p: any) => p.data.status === 'champion' ? { background: 'rgba(255,215,0,0.15)', fontWeight: 700 } : {} },
    { field: 'cv_score', headerName: 'CV Score', flex: 1, sortable: true, valueFormatter: (p: any) => p.value.toFixed(4) },
    { field: 'f1', headerName: 'F1', flex: 1, sortable: true, valueFormatter: (p: any) => p.value.toFixed(4) },
    { field: 'auc_roc', headerName: 'AUC-ROC', flex: 1, sortable: true, valueFormatter: (p: any) => p.value.toFixed(4) },
    { field: 'train_score', headerName: 'Train Score', flex: 1, sortable: true, valueFormatter: (p: any) => p.value.toFixed(4) },
    { field: 'train_time_s', headerName: 'Train Time', flex: 1, sortable: true, valueFormatter: (p: any) => `${p.value.toFixed(1)}s` },
    { field: 'status', headerName: 'Status', flex: 1, cellRenderer: (p: any) => {
      const color = p.value === 'champion' ? '#FFD700' : p.value === 'challenger' ? '#6C63FF' : '#888'
      return <span style={{ color, fontWeight: 700, textTransform: 'capitalize' }}>{p.value}</span>
    }},
  ], [])

  if (isLoading) return <LinearProgress />

  if (error || !data) {
    return (
      <Box>
        <PageHeader title="Model Evaluation" subtitle={`Phase 9 — ${datasetName ?? 'No dataset selected'}`} />
        <Alert severity="info">No evaluation report available yet. Complete model training first.</Alert>
      </Box>
    )
  }

  const report = data
  const champion = report.leaderboard.find((m) => m.model_id === report.champion_model_id)

  return (
    <Box>
      <PageHeader
        title="Model Evaluation"
        subtitle="Phase 9 — Compare all trained models and select the champion"
        actions={<Button variant="contained" startIcon={<RocketLaunchIcon />} color="success">Promote to Production</Button>}
      />

      {champion && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 6, md: 3 }}><MetricCard label="Champion Model" value={champion.model_name} icon={<EmojiEventsIcon />} color="#FFD700" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><MetricCard label="CV Score" value={champion.cv_score.toFixed(4)} icon={<EmojiEventsIcon />} color="#6C63FF" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><MetricCard label="F1 Score" value={champion.f1.toFixed(4)} icon={<EmojiEventsIcon />} color="#4CAF50" /></Grid>
          <Grid size={{ xs: 6, md: 3 }}><MetricCard label="AUC-ROC" value={champion.auc_roc.toFixed(4)} icon={<EmojiEventsIcon />} color="#FF6584" /></Grid>
        </Grid>
      )}

      <SectionCard title="Model Leaderboard" noPadding>
        <div className="ag-theme-alpine-dark" style={{ height: 320, width: '100%' }}>
          <AgGridReact
            rowData={report.leaderboard}
            columnDefs={colDefs}
            defaultColDef={{ resizable: true }}
            suppressMovableColumns
            animateRows
          />
        </div>
      </SectionCard>

      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionCard title="Confusion Matrix">
            <ConfusionMatrix labels={report.confusion_matrix.labels} values={report.confusion_matrix.values} />
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionCard title="ROC Curve">
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.roc_curve} margin={{ top: 10, right: 20, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="fpr" tickFormatter={(v) => v.toFixed(1)} label={{ value: 'FPR', position: 'insideBottomRight', offset: -5, fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => v.toFixed(1)} label={{ value: 'TPR', angle: -90, position: 'insideLeft', fontSize: 12 }} />
                  <Tooltip formatter={(v: any) => [Number(v).toFixed(3)]} />
                  <ReferenceLine x={0} y={0} stroke="#555" />
                  <Line type="monotone" dataKey="tpr" stroke="#6C63FF" strokeWidth={2} dot={false} name="ROC" />
                  <Line type="monotone" dataKey="fpr" stroke="#555" strokeDasharray="5 5" dot={false} name="Random" strokeWidth={1} />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}
