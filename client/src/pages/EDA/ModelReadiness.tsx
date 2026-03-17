import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import Tooltip from '@mui/material/Tooltip'
import Snackbar from '@mui/material/Snackbar'
import LinearProgress from '@mui/material/LinearProgress'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTip, ResponsiveContainer, Cell } from 'recharts'
import SectionCard from '../../components/shared/SectionCard'
import type { EDAReport } from '../../api/types'
import { useState, useEffect } from 'react'
import type React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { usePipelineStore } from '../../stores/pipeline'
import PushPinIcon from '@mui/icons-material/PushPin'
import BlockIcon from '@mui/icons-material/Block'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import SaveIcon from '@mui/icons-material/Save'

type OverrideState = 'auto' | 'include' | 'exclude'

const OVERRIDE_CONFIG: Record<OverrideState, { label: string; color: 'default' | 'success' | 'error'; icon: React.ReactNode; next: OverrideState; tip: string }> = {
  auto:    { label: 'Auto',    color: 'default', icon: <AutorenewIcon sx={{ fontSize: '0.9rem' }} />, next: 'include', tip: 'ML auto-selected — click to Pin (force include)' },
  include: { label: 'Pinned', color: 'success',  icon: <PushPinIcon   sx={{ fontSize: '0.9rem' }} />, next: 'exclude', tip: 'Pinned — always kept regardless of MI score. Click to Exclude.' },
  exclude: { label: 'Exclude', color: 'error',   icon: <BlockIcon     sx={{ fontSize: '0.9rem' }} />, next: 'auto',    tip: 'Excluded — always dropped regardless of MI score. Click to reset to Auto.' },
}

const BAR_COLOR: Record<OverrideState, string> = { auto: '#9E97FF', include: '#4CAF50', exclude: '#EF5350' }

interface ModelReadinessProps {
  report: EDAReport
}

export default function ModelReadiness({ report }: ModelReadinessProps) {
  const datasetId = usePipelineStore((s) => s.datasetId)
  const queryClient = useQueryClient()
  const leakageIssues = report.issues.filter((i) => i.type === 'leakage')

  // Initialise from persisted overrides or default to 'auto'
  const [overrides, setOverrides] = useState<Record<string, OverrideState>>(() => {
    const saved = report.feature_overrides ?? {}
    return Object.fromEntries(report.mi_scores.map((f) => [f.feature, (saved[f.feature] as OverrideState) ?? 'auto']))
  })

  // Sync when report.feature_overrides changes (e.g. after save invalidates the EDA query)
  useEffect(() => {
    const saved = report.feature_overrides ?? {}
    setOverrides(Object.fromEntries(
      report.mi_scores.map((f) => [f.feature, (saved[f.feature] as OverrideState) ?? 'auto'])
    ))
  }, [report.feature_overrides, report.mi_scores])

  const [snack, setSnack] = useState<{ open: boolean; msg: string; severity: 'success' | 'error' }>({ open: false, msg: '', severity: 'success' })

  const saveMutation = useMutation({
    mutationFn: () => fetch('/api/eda/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataset_id: datasetId, overrides }),
    }).then(async (r) => {
      if (!r.ok) throw new Error(await r.text())
      return r.json()
    }),
    onSuccess: () => {
      // Invalidate EDA cache so report.feature_overrides refreshes from DB
      queryClient.invalidateQueries({ queryKey: ['eda', datasetId] })
      // Clear selection cache so Phase 6 recomputes with new overrides
      queryClient.removeQueries({ queryKey: ['selection', datasetId] })
      setSnack({ open: true, msg: 'Feature overrides saved. Phase 6 Selection will apply them automatically.', severity: 'success' })
    },
    onError: (e: any) => setSnack({ open: true, msg: `Save failed: ${e.message}`, severity: 'error' }),
  })

  function toggle(feature: string) {
    setOverrides((prev) => ({ ...prev, [feature]: OVERRIDE_CONFIG[prev[feature]].next }))
  }

  const pinnedCount  = Object.values(overrides).filter((v) => v === 'include').length
  const excludedCount = Object.values(overrides).filter((v) => v === 'exclude').length
  const isDirty = JSON.stringify(overrides) !== JSON.stringify(
    Object.fromEntries(report.mi_scores.map((f) => [f.feature, (report.feature_overrides?.[f.feature] as OverrideState) ?? 'auto']))
  )

  const topFeatures = [...report.mi_scores]
    .sort((a, b) => b.score - a.score)
    .map((f) => ({ ...f, override: overrides[f.feature] ?? 'auto' }))

  return (
    <Grid container spacing={2}>
      {/* Left — Leakage + Checklist */}
      <Grid size={{ xs: 12, lg: 4 }}>
        <SectionCard title="Leakage Risk Assessment">
          {leakageIssues.length === 0 ? (
            <Alert severity="success">No target leakage detected.</Alert>
          ) : (
            leakageIssues.map((issue) => (
              <Alert key={issue.id} severity="error" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{issue.title}</Typography>
                <Typography variant="caption">{issue.detail}</Typography>
              </Alert>
            ))
          )}

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Model Readiness Checklist</Typography>
            {[
              { label: 'Target column defined', ok: true },
              { label: 'Missing values handled', ok: false },
              { label: 'Class imbalance addressed', ok: false },
              { label: 'No target leakage', ok: leakageIssues.length === 0 },
              { label: 'Categorical encoding planned', ok: true },
              { label: 'Feature scaling configured', ok: false },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Chip label={item.ok ? '✓' : '✗'} color={item.ok ? 'success' : 'error'} size="small" sx={{ width: 28, height: 20, fontSize: '0.65rem' }} />
                <Typography variant="body2">{item.label}</Typography>
              </Box>
            ))}
          </Box>
        </SectionCard>
      </Grid>

      {/* Right — Feature Importance + Overrides */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <SectionCard
          title="Feature Importance — Override Controls"
          subheader="Click a feature's badge to cycle: Auto → Pin ✓ → Exclude ✗. Overrides flow into Phase 6 Selection."
          toolbar={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, mr: 1 }}>
              {pinnedCount > 0 && <Chip label={`${pinnedCount} pinned`} size="small" color="success" icon={<PushPinIcon />} />}
              {excludedCount > 0 && <Chip label={`${excludedCount} excluded`} size="small" color="error" icon={<BlockIcon />} />}
              <Button
                size="small"
                variant={isDirty ? 'contained' : 'outlined'}
                startIcon={saveMutation.isPending ? undefined : <SaveIcon />}
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !isDirty}
                color={isDirty ? 'primary' : 'success'}
              >
                {saveMutation.isPending ? 'Saving…' : isDirty ? 'Save Overrides' : '✓ Saved'}
              </Button>
            </Box>
          }
        >
          {saveMutation.isPending && <LinearProgress sx={{ mb: 1 }} />}

          {/* Bar chart — coloured by override state */}
          <Box sx={{ height: 300, mb: 2 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topFeatures} layout="vertical" margin={{ top: 5, right: 20, left: 140, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(2)} />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 10 }} width={135} />
                <RechartsTip formatter={(v: any) => [Number(v).toFixed(4), 'MI Score']} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {topFeatures.map((f, i) => (
                    <Cell key={i} fill={BAR_COLOR[f.override]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>

          {/* Feature override table */}
          <Box sx={{ maxHeight: 320, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }}>Feature</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }} align="right">MI Score</TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem' }} align="center">Override</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {topFeatures.map((f) => {
                  const cfg = OVERRIDE_CONFIG[overrides[f.feature] ?? 'auto']
                  return (
                    <TableRow key={f.feature} sx={{ opacity: overrides[f.feature] === 'exclude' ? 0.45 : 1, '&:hover': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{f.feature}</TableCell>
                      <TableCell align="right" sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
                        {f.score.toFixed(4)}
                      </TableCell>
                      <TableCell align="center">
                        <Tooltip title={cfg.tip} placement="left" arrow>
                          <Chip
                            icon={cfg.icon as React.ReactElement}
                            label={cfg.label}
                            size="small"
                            color={cfg.color}
                            onClick={() => toggle(f.feature)}
                            sx={{ cursor: 'pointer', fontSize: '0.68rem', '&:hover': { opacity: 0.85 } }}
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Box>
        </SectionCard>
      </Grid>

      <Snackbar open={snack.open} autoHideDuration={6000} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity={snack.severity} onClose={() => setSnack((s) => ({ ...s, open: false }))}>{snack.msg}</Alert>
      </Snackbar>
    </Grid>
  )
}
