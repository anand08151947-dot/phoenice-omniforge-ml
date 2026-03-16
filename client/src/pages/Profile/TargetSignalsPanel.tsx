/**
 * Target-aware signals panel for the Profile page.
 * Shows class imbalance, baseline accuracy, suggested metrics, and for regression:
 * target skew, outlier impact, loss function recommendation.
 */
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import type { TargetDistribution, ImbalanceSeverity, TaskRecommendation } from '../../api/types'

interface Props {
  targetCol: string
  resolvedTask: string
  targetDist: TargetDistribution | null
  imbalance: ImbalanceSeverity
  taskRec: TaskRecommendation | null
}

const METRIC_TOOLTIPS: Record<string, string> = {
  'F1 Score': 'Harmonic mean of precision and recall — ideal for imbalanced datasets',
  'Accuracy': 'Fraction of correct predictions — reliable only when classes are balanced',
  'ROC-AUC': 'Area under the ROC curve — threshold-independent ranking metric',
  'MAE': 'Mean Absolute Error — robust to outliers, easier to interpret',
  'MSE': 'Mean Squared Error — penalises large errors heavily',
  'RMSE': 'Root MSE — same scale as target, sensitive to outliers',
  'R²': 'Coefficient of determination — proportion of variance explained (0–1)',
}

export default function TargetSignalsPanel({ targetCol, resolvedTask, targetDist, imbalance, taskRec }: Props) {
  const isClassification = resolvedTask === 'classification'
  const isRegression = resolvedTask === 'regression'
  const hasImbalance = imbalance.severity !== 'n/a' && imbalance.severity !== 'none'

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        🎯 Target Analysis — <em>{targetCol}</em>
      </Typography>
      <Grid container spacing={2}>

        {/* Task + confidence */}
        {taskRec && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'primary.light', borderRadius: 2, height: '100%' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>Detected Task</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 0.75 }}>
                <Chip label={taskRec.task.replace('_', ' ')} color="primary" size="small" sx={{ fontWeight: 700, textTransform: 'capitalize' }} />
                <Typography variant="caption" color="text.secondary">{taskRec.confidence}% confidence</Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {taskRec.why.map((r, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 11, color: 'success.main' }} />
                    <Typography variant="caption" color="text.secondary">{r}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Grid>
        )}

        {/* Class distribution / imbalance */}
        {isClassification && targetDist && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: hasImbalance ? 'warning.main' : 'divider', borderRadius: 2, height: '100%' }}>
              <Typography variant="caption" color="text.secondary">Class Distribution</Typography>
              {targetDist.type === 'classification' && targetDist.classes && (
                <Box sx={{ mt: 0.75 }}>
                  {targetDist.classes.slice(0, 6).map((cls) => (
                    <Box key={cls.label} sx={{ mb: 0.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{cls.label}</Typography>
                        <Typography variant="caption" fontWeight={700}>{cls.pct.toFixed(1)}%</Typography>
                      </Box>
                      <Box sx={{ height: 4, borderRadius: 2, bgcolor: 'divider', overflow: 'hidden' }}>
                        <Box sx={{ width: `${cls.pct}%`, height: '100%', bgcolor: hasImbalance ? 'warning.main' : 'success.main', borderRadius: 2 }} />
                      </Box>
                    </Box>
                  ))}
                  {hasImbalance && (
                    <Chip
                      label={`${imbalance.severity} imbalance — ${imbalance.minority_pct?.toFixed(1)}% minority`}
                      color="warning"
                      size="small"
                      sx={{ mt: 0.5, fontSize: '0.65rem' }}
                    />
                  )}
                </Box>
              )}
            </Box>
          </Grid>
        )}

        {/* Regression target stats */}
        {isRegression && targetDist?.type === 'regression' && (
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
              <Typography variant="caption" color="text.secondary">Target Distribution</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5, mt: 0.75 }}>
                {[
                  ['Mean', targetDist.mean?.toFixed(2)],
                  ['Std', targetDist.std?.toFixed(2)],
                  ['Skew', targetDist.skewness?.toFixed(2)],
                  ['Outliers', targetDist.outlier_count ?? '—'],
                ].map(([k, v]) => (
                  <Box key={String(k)}>
                    <Typography variant="caption" color="text.disabled">{k}</Typography>
                    <Typography variant="caption" sx={{ ml: 0.5, fontWeight: 700 }}>{v}</Typography>
                  </Box>
                ))}
              </Box>
              {(targetDist.skewness ?? 0) > 1.5 && (
                <Alert severity="warning" sx={{ mt: 1, py: 0.25, fontSize: '0.7rem' }}>
                  High skew — consider log transform before training
                </Alert>
              )}
            </Box>
          </Grid>
        )}

        {/* Suggested metrics */}
        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
          <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
            <Typography variant="caption" color="text.secondary">Suggested Metrics</Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
              {(imbalance.recommended_metric
                ? [imbalance.recommended_metric]
                : isClassification
                  ? ['Accuracy', 'ROC-AUC']
                  : ['MAE', 'RMSE', 'R²']
              ).map(m => (
                <Tooltip key={m} title={METRIC_TOOLTIPS[m] ?? ''}>
                  <Chip label={m} size="small" color="primary" variant="outlined" sx={{ cursor: 'help', fontSize: '0.7rem' }} />
                </Tooltip>
              ))}
            </Box>
            {isClassification && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Baseline accuracy (majority class): <strong>
                    {targetDist?.type === 'classification' && targetDist.classes
                      ? `${Math.max(...targetDist.classes.map(c => c.pct)).toFixed(1)}%`
                      : '—'}
                  </strong>
                </Typography>
              </Box>
            )}
            {hasImbalance && imbalance.techniques.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary" sx={{ width: '100%' }}>
                  Imbalance techniques:
                </Typography>
                {imbalance.techniques.map(t => (
                  <Box key={t} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    <CheckCircleOutlineIcon sx={{ fontSize: 11, color: '#4caf50' }} />
                    <Typography variant="caption">{t}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  )
}
