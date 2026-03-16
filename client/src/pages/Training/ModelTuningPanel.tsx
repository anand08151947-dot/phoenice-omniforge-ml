/**
 * ModelTuningPanel — 3-tab drawer for model refinement
 *  Tab A: Fix Overfit  (one-click apply pre-computed remediation params)
 *  Tab B: Manual Tune  (sliders/inputs for each hyperparameter)
 *  Tab C: AutoTune     (Optuna n_trials config + progress)
 */
import {
  Box, Button, Chip, CircularProgress, Divider, Drawer, FormControl,
  InputLabel, MenuItem, Select, Slider, Stack, Tab, Tabs, TextField,
  Typography, Alert, LinearProgress,
} from '@mui/material'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import TuneIcon from '@mui/icons-material/Tune'
import ScienceIcon from '@mui/icons-material/Science'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import type { HyperparamDef, ModelCandidate } from '../../api/types'

// ─── API helpers ──────────────────────────────────────────────────────────────

async function fetchHyperparamSpace(modelName: string) {
  const r = await fetch(`/api/training/hyperparameter-space?model_name=${encodeURIComponent(modelName)}`)
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function postRetrainSingle(body: object) {
  const r = await fetch('/api/training/retrain-single', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

async function postAutotune(body: object) {
  const r = await fetch('/api/training/autotune', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ParamControl({
  def: p,
  value,
  onChange,
}: {
  def: HyperparamDef
  value: number | string
  onChange: (v: number | string) => void
}) {
  if (p.type === 'choice') {
    return (
      <FormControl size="small" fullWidth>
        <InputLabel>{p.name}</InputLabel>
        <Select
          label={p.name}
          value={value as string}
          onChange={e => onChange(e.target.value)}
        >
          {(p.choices ?? []).map(c => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </Select>
      </FormControl>
    )
  }
  const numVal = Number(value)
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="caption">{p.name}</Typography>
        <TextField
          size="small"
          type="number"
          value={numVal}
          inputProps={{ min: p.min, max: p.max, step: p.step ?? 1 }}
          sx={{ width: 90 }}
          onChange={e => onChange(p.type === 'int' ? parseInt(e.target.value) : parseFloat(e.target.value))}
        />
      </Stack>
      <Slider
        min={p.min}
        max={p.max}
        step={p.step ?? 1}
        value={numVal}
        onChange={(_, v) => onChange(v as number)}
        size="small"
      />
    </Box>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  candidate: ModelCandidate
  datasetId: string
}

export default function ModelTuningPanel({ open, onClose, candidate, datasetId }: Props) {
  const [tab, setTab] = useState(0)
  const qc = useQueryClient()

  // Load hyperparameter space
  const { data: spaceData } = useQuery({
    queryKey: ['hparam-space', candidate.model_name],
    queryFn: () => fetchHyperparamSpace(candidate.model_name),
    enabled: open,
  })

  const space: HyperparamDef[] = spaceData?.space ?? []
  const fixOverfitParams: Record<string, unknown> = spaceData?.fix_overfit_params ?? {}

  // Manual tune state — initialise from current hyperparams
  const [manualParams, setManualParams] = useState<Record<string, number | string>>(() => {
    const init: Record<string, number | string> = {}
    for (const p of space) {
      const cur = candidate.hyperparams?.[p.name]
      init[p.name] = (cur !== undefined && cur !== null) ? (cur as number | string) : (p.default ?? p.min ?? 0)
    }
    return init
  })
  // Sync when space loads for the first time
  const [paramsInitialised, setParamsInitialised] = useState(false)
  if (space.length > 0 && !paramsInitialised) {
    const init: Record<string, number | string> = {}
    for (const p of space) {
      const cur = candidate.hyperparams?.[p.name]
      init[p.name] = (cur !== undefined && cur !== null) ? (cur as number | string) : (p.default ?? p.min ?? 0)
    }
    setManualParams(init)
    setParamsInitialised(true)
  }

  const [nTrials, setNTrials] = useState(30)

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['training', datasetId] })
    onClose()
  }

  // Fix overfit mutation
  const fixMutation = useMutation({
    mutationFn: () => postRetrainSingle({
      dataset_id: datasetId,
      model_id: candidate.id,
      model_name: candidate.model_name,
      hyperparams: fixOverfitParams,
    }),
    onSuccess: invalidate,
  })

  // Manual retrain mutation
  const manualMutation = useMutation({
    mutationFn: () => postRetrainSingle({
      dataset_id: datasetId,
      model_id: candidate.id,
      model_name: candidate.model_name,
      hyperparams: manualParams,
    }),
    onSuccess: invalidate,
  })

  // AutoTune mutation
  const autotuneMutation = useMutation({
    mutationFn: () => postAutotune({
      dataset_id: datasetId,
      model_id: candidate.id,
      model_name: candidate.model_name,
      n_trials: nTrials,
    }),
    onSuccess: invalidate,
  })

  const isLoading = fixMutation.isPending || manualMutation.isPending || autotuneMutation.isPending
  const error = fixMutation.error ?? manualMutation.error ?? autotuneMutation.error

  const gap = candidate.train_score - candidate.cv_score
  const isHighOverfit = gap > 0.1

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 420, p: 2 } }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        🔧 Tune Model — {candidate.model_name}
      </Typography>
      <Stack direction="row" spacing={1} mb={2}>
        <Chip label={`CV: ${(candidate.cv_score * 100).toFixed(1)}%`} color="primary" size="small" />
        <Chip label={`Train: ${(candidate.train_score * 100).toFixed(1)}%`} size="small" />
        {isHighOverfit && (
          <Chip label={`Gap: ${(gap * 100).toFixed(1)}% ⚠️`} color="warning" size="small" />
        )}
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth" sx={{ mb: 2 }}>
        <Tab icon={<AutoFixHighIcon />} label="Fix Overfit" iconPosition="start" />
        <Tab icon={<TuneIcon />} label="Manual" iconPosition="start" />
        <Tab icon={<ScienceIcon />} label="AutoTune" iconPosition="start" />
      </Tabs>

      {isLoading && <LinearProgress sx={{ mb: 2 }} />}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {(error as Error).message}
        </Alert>
      )}

      {/* ── Tab A: Fix Overfit ─────────────────────────────── */}
      {tab === 0 && (
        <Box>
          {!isHighOverfit && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Overfitting gap is low ({(gap * 100).toFixed(1)}%). Fix Overfit is most useful when gap &gt; 10%.
            </Alert>
          )}
          {isHighOverfit && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              High gap detected ({(gap * 100).toFixed(1)}%). One-click fix applies conservative
              regularisation parameters.
            </Alert>
          )}

          {Object.keys(fixOverfitParams).length > 0 ? (
            <Box mb={2}>
              <Typography variant="subtitle2" gutterBottom>Parameters that will be applied:</Typography>
              <Stack spacing={0.5}>
                {Object.entries(fixOverfitParams).map(([k, v]) => {
                  const cur = candidate.hyperparams?.[k]
                  const changed = cur !== undefined && String(cur) !== String(v)
                  return (
                    <Stack key={k} direction="row" spacing={1} alignItems="center">
                      <Typography variant="caption" sx={{ minWidth: 160, fontFamily: 'monospace' }}>{k}</Typography>
                      {changed && (
                        <Typography variant="caption" color="text.disabled" sx={{ textDecoration: 'line-through' }}>
                          {String(cur)}
                        </Typography>
                      )}
                      <Typography variant="caption" color={changed ? 'primary' : 'text.primary'} fontWeight={changed ? 700 : 400}>
                        {String(v)}
                      </Typography>
                      {changed && <Chip label="changed" size="small" sx={{ height: 16, fontSize: 10 }} />}
                    </Stack>
                  )
                })}
              </Stack>
            </Box>
          ) : (
            <Alert severity="info">No fix-overfit preset available for this model type.</Alert>
          )}

          <Divider sx={{ my: 2 }} />
          <Button
            variant="contained"
            color="warning"
            fullWidth
            disabled={isLoading || Object.keys(fixOverfitParams).length === 0}
            onClick={() => fixMutation.mutate()}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
          >
            Apply Fix &amp; Retrain
          </Button>
        </Box>
      )}

      {/* ── Tab B: Manual Tune ────────────────────────────── */}
      {tab === 1 && (
        <Box>
          {space.length === 0 ? (
            <Alert severity="info">No tunable parameters defined for {candidate.model_name}.</Alert>
          ) : (
            <Stack spacing={2.5} mb={2}>
              {space.map(p => (
                <ParamControl
                  key={p.name}
                  def={p}
                  value={manualParams[p.name] ?? p.default ?? p.min ?? 0}
                  onChange={v => setManualParams(prev => ({ ...prev, [p.name]: v }))}
                />
              ))}
            </Stack>
          )}
          <Divider sx={{ my: 2 }} />
          <Button
            variant="contained"
            fullWidth
            disabled={isLoading || space.length === 0}
            onClick={() => manualMutation.mutate()}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <TuneIcon />}
          >
            Retrain with These Params
          </Button>
        </Box>
      )}

      {/* ── Tab C: AutoTune ───────────────────────────────── */}
      {tab === 2 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Optuna will search the hyperparameter space over <strong>{nTrials} trials</strong> using
            cross-validation, then retrain the best configuration with full diagnostics.
          </Alert>

          <Box mb={3}>
            <Typography variant="subtitle2" gutterBottom>
              Number of Optuna trials: <strong>{nTrials}</strong>
            </Typography>
            <Slider
              min={5} max={100} step={5}
              value={nTrials}
              onChange={(_, v) => setNTrials(v as number)}
              marks={[{ value: 5, label: '5' }, { value: 30, label: '30' }, { value: 100, label: '100' }]}
            />
            <Typography variant="caption" color="text.secondary">
              More trials = better params, longer runtime. ~30 is a good balance.
            </Typography>
          </Box>

          {candidate.optuna_best_score !== undefined && (
            <Alert severity="success" sx={{ mb: 2 }}>
              Previous AutoTune: best score {(candidate.optuna_best_score * 100).toFixed(2)}%
              over {candidate.optuna_n_trials} trials.
            </Alert>
          )}

          {autotuneMutation.isPending && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Running {nTrials} Optuna trials… this may take a few minutes.
            </Alert>
          )}

          <Divider sx={{ my: 2 }} />
          <Button
            variant="contained"
            color="secondary"
            fullWidth
            disabled={isLoading}
            onClick={() => autotuneMutation.mutate()}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <ScienceIcon />}
          >
            {autotuneMutation.isPending ? `Searching (${nTrials} trials)…` : 'Start AutoTune'}
          </Button>
        </Box>
      )}
    </Drawer>
  )
}
