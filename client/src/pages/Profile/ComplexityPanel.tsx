/**
 * Complexity indicators + data type issues for the Profile page.
 */
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Tooltip from '@mui/material/Tooltip'
import type { ComplexityIndicators, DataTypeIssue } from '../../api/types'

interface Props {
  complexity: ComplexityIndicators
  dtypeIssues: DataTypeIssue[]
}

export default function ComplexityPanel({ complexity, dtypeIssues }: Props) {
  const hasWarnings = complexity.warnings.length > 0
  const hasDtypeIssues = dtypeIssues.length > 0

  if (!hasWarnings && !hasDtypeIssues) return null

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>🧬 Dataset Complexity</Typography>
      <Grid container spacing={2}>

        {/* Complexity indicators */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ p: 2, border: '1px solid', borderColor: hasWarnings ? 'warning.main' : 'divider', borderRadius: 2, height: '100%' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1.5 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Features</Typography>
                <Typography variant="body2" fontWeight={700}>{complexity.feature_count}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Rows</Typography>
                <Typography variant="body2" fontWeight={700}>{complexity.row_count.toLocaleString()}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Feature/Row Ratio</Typography>
                <Typography variant="body2" fontWeight={700} color={complexity.feature_row_ratio > 0.05 ? 'warning.main' : 'text.primary'}>
                  {complexity.feature_row_ratio.toFixed(4)}
                </Typography>
              </Box>
              <Box>
                <Tooltip title="Rule of thumb: need ~50× rows per feature for reliable models">
                  <Box sx={{ cursor: 'help' }}>
                    <Typography variant="caption" color="text.secondary">Sample Sufficiency</Typography>
                    <Typography variant="body2" fontWeight={700} color={complexity.sample_sufficiency === 'Sufficient' ? 'success.main' : 'warning.main'} sx={{ fontSize: '0.7rem' }}>
                      {complexity.sample_sufficiency}
                    </Typography>
                  </Box>
                </Tooltip>
              </Box>
            </Box>

            {complexity.warnings.map((w, i) => (
              <Alert key={i} severity="warning" sx={{ mb: 0.5, py: 0.25, '& .MuiAlert-message': { py: 0.5 } }}>
                <Typography variant="caption">{w}</Typography>
              </Alert>
            ))}
            {complexity.suggestions.map((s, i) => (
              <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                💡 {s}
              </Typography>
            ))}
          </Box>
        </Grid>

        {/* Data type issues */}
        {hasDtypeIssues && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}>
              <Typography variant="subtitle2" fontWeight={700} gutterBottom>🧱 Data Type Issues</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                {dtypeIssues.map((issue, i) => (
                  <Alert
                    key={i}
                    severity={issue.severity === 'high' ? 'error' : issue.severity === 'medium' ? 'warning' : 'info'}
                    sx={{ py: 0.25, '& .MuiAlert-message': { py: 0.5 } }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip label={issue.column} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', height: 18 }} />
                      <Typography variant="caption">{issue.message.replace(`'${issue.column}' `, '')}</Typography>
                    </Box>
                  </Alert>
                ))}
              </Box>
            </Box>
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
