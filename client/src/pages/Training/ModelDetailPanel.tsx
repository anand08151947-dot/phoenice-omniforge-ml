import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Chip from '@mui/material/Chip'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { ModelCandidate } from '../../api/types'

interface Props {
  candidate: ModelCandidate
  isClassifier: boolean
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function gapColor(gap: number) {
  if (gap > 0.15) return '#f44336'
  if (gap > 0.05) return '#ff9800'
  return '#4caf50'
}

export default function ModelDetailPanel({ candidate: c, isClassifier }: Props) {
  const hasThreshold = (c.threshold_analysis?.length ?? 0) > 0
  const hyperKeys = Object.keys(c.hyperparams ?? {}).slice(0, 12)

  return (
    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
      <Grid container spacing={3}>

        {/* Per-Fold Scores */}
        {(c.fold_scores?.length ?? 0) > 0 && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Per-Fold CV Scores
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Fold</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>CV</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Train</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Gap</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {c.fold_scores!.map((f) => (
                  <TableRow key={f.fold}>
                    <TableCell sx={{ py: 0.5 }}>{f.fold}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{pct(f.cv_score)}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{pct(f.train_score)}</TableCell>
                    <TableCell sx={{ py: 0.5, color: gapColor(f.gap), fontWeight: 600 }}>
                      {pct(f.gap)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ py: 0.5, fontWeight: 700 }}>Avg ± σ</TableCell>
                  <TableCell sx={{ py: 0.5, fontWeight: 700 }}>
                    {pct(c.cv_score)} ± {pct(c.cv_std ?? 0)}
                  </TableCell>
                  <TableCell sx={{ py: 0.5, fontWeight: 700 }}>{pct(c.train_score)}</TableCell>
                  <TableCell sx={{ py: 0.5 }} />
                </TableRow>
              </TableBody>
            </Table>
          </Grid>
        )}

        {/* Per-Class Metrics */}
        {isClassifier && (c.per_class_metrics?.length ?? 0) > 0 && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Per-Class Precision / Recall
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Class</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Precision</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Recall</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>F1</TableCell>
                  <TableCell sx={{ fontWeight: 700, py: 0.5 }}>Support</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {c.per_class_metrics!.map((m) => (
                  <TableRow key={m.class}>
                    <TableCell sx={{ py: 0.5 }}>
                      <Chip label={`Class ${m.class}`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>{pct(m.precision)}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{pct(m.recall)}</TableCell>
                    <TableCell sx={{ py: 0.5, fontWeight: 600 }}>{pct(m.f1)}</TableCell>
                    <TableCell sx={{ py: 0.5, color: 'text.secondary' }}>{m.support.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Grid>
        )}

        {/* Strengths & Weaknesses */}
        {((c.strengths?.length ?? 0) > 0 || (c.weaknesses?.length ?? 0) > 0) && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Model Assessment
            </Typography>
            <Box>
              {(c.strengths ?? []).map((s, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 15, color: '#4caf50', mt: 0.15, flexShrink: 0 }} />
                  <Typography variant="caption">{s}</Typography>
                </Box>
              ))}
              {(c.weaknesses ?? []).map((w, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, mb: 0.5 }}>
                  <WarningAmberIcon sx={{ fontSize: 15, color: '#ff9800', mt: 0.15, flexShrink: 0 }} />
                  <Typography variant="caption">{w}</Typography>
                </Box>
              ))}
            </Box>
          </Grid>
        )}

        {/* Threshold Analysis (binary classifier only) */}
        {isClassifier && hasThreshold && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Threshold Analysis (Business Decision Support)
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {['Threshold', 'Precision', 'Recall', 'F1', 'FPR', 'TP', 'FP', 'FN', 'TN'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, py: 0.5 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {c.threshold_analysis!.map((t) => (
                  <TableRow
                    key={t.threshold}
                    sx={t.threshold === 0.5 ? { bgcolor: 'rgba(33,150,243,0.08)' } : {}}
                  >
                    <TableCell sx={{ py: 0.5, fontWeight: t.threshold === 0.5 ? 700 : 400 }}>
                      {t.threshold.toFixed(1)}{t.threshold === 0.5 ? ' ★' : ''}
                    </TableCell>
                    <TableCell sx={{ py: 0.5 }}>{pct(t.precision)}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{pct(t.recall)}</TableCell>
                    <TableCell sx={{ py: 0.5, fontWeight: 600 }}>{pct(t.f1)}</TableCell>
                    <TableCell sx={{ py: 0.5, color: t.fpr > 0.3 ? '#f44336' : 'inherit' }}>{pct(t.fpr)}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{t.tp.toLocaleString()}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{t.fp.toLocaleString()}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{t.fn.toLocaleString()}</TableCell>
                    <TableCell sx={{ py: 0.5 }}>{t.tn.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              ★ Default threshold = 0.5. Lower threshold → more positives flagged (higher recall, higher FPR).
            </Typography>
          </Grid>
        )}

        {/* Hyperparameters */}
        {hyperKeys.length > 0 && (
          <Grid size={{ xs: 12, md: isClassifier && hasThreshold ? 6 : 4 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Key Hyperparameters
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {hyperKeys.map((k) => (
                <Chip
                  key={k}
                  label={`${k}: ${String(c.hyperparams[k])}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.68rem', fontFamily: 'monospace' }}
                />
              ))}
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: 'block' }}>
              random_state=42 · n_features={c.n_features ?? '—'}
            </Typography>
          </Grid>
        )}

      </Grid>
    </Box>
  )
}
