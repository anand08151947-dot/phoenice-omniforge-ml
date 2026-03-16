import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import type { ConfusionMatrixData } from '../../api/types'

interface Props {
  data: ConfusionMatrixData
  title?: string
}

// Interpolate between white and a strong colour based on value 0–1
function cellBg(pct: number): string {
  // Light blue → dark blue heatmap
  const r = Math.round(255 - pct * 180)
  const g = Math.round(255 - pct * 130)
  const b = 255
  return `rgb(${r},${g},${b})`
}

function textColor(pct: number): string {
  return pct > 0.5 ? '#fff' : '#111'
}

export default function ConfusionMatrixChart({ data, title = 'Confusion Matrix' }: Props) {
  if (!data?.labels?.length) return null

  const { labels, values, values_pct } = data
  const total = values.flat().reduce((a, b) => a + b, 0)

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>

      {/* Column header: Predicted */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box sx={{ display: 'flex', ml: 7 }}>
          {labels.map((lbl) => (
            <Box key={lbl} sx={{ width: 72, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Pred {lbl}
              </Typography>
            </Box>
          ))}
        </Box>

        {values.map((row, ri) => (
          <Box key={ri} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {/* Row label: Actual */}
            <Box sx={{ width: 56, textAlign: 'right', pr: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Act {labels[ri]}
              </Typography>
            </Box>

            {row.map((val, ci) => {
              const pct = values_pct[ri][ci]
              const isDiag = ri === ci
              const tooltipText = isDiag
                ? `True ${labels[ri]}: ${val.toLocaleString()} (${pct}%)`
                : `Actual ${labels[ri]} predicted as ${labels[ci]}: ${val.toLocaleString()} (${pct}%)`

              return (
                <Tooltip key={ci} title={tooltipText} arrow>
                  <Box
                    sx={{
                      width: 72,
                      height: 52,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 1,
                      bgcolor: cellBg(pct / 100),
                      border: isDiag ? '2px solid #1976d2' : '1px solid rgba(0,0,0,0.1)',
                      cursor: 'default',
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: 700, color: textColor(pct / 100) }}
                    >
                      {val.toLocaleString()}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: textColor(pct / 100), opacity: 0.9 }}
                    >
                      {pct}%
                    </Typography>
                  </Box>
                </Tooltip>
              )
            })}
          </Box>
        ))}
      </Box>

      {/* Legend */}
      <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
        {labels.length === 2 && (
          <>
            <Typography variant="caption" color="text.secondary">
              ✅ TP={values[1]?.[1]?.toLocaleString() ?? '—'} &nbsp; ✅ TN={values[0]?.[0]?.toLocaleString() ?? '—'}
            </Typography>
            <Typography variant="caption" color="error.main">
              ❌ FP={values[0]?.[1]?.toLocaleString() ?? '—'} &nbsp; ❌ FN={values[1]?.[0]?.toLocaleString() ?? '—'}
            </Typography>
          </>
        )}
        <Typography variant="caption" color="text.secondary">
          Total: {total.toLocaleString()} samples
        </Typography>
      </Box>
    </Box>
  )
}
