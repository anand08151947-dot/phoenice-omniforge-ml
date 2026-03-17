import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { PRPoint } from '../../api/types'

interface Props {
  data: PRPoint[]
  prevalence?: number  // minority class fraction — shown as baseline
  auc?: number
  isROC?: boolean      // When true, renders as FPR vs TPR (ROC mode)
}

export default function PRCurveChart({ data, prevalence, auc, isROC = false }: Props) {
  // Compute AUC via trapezoidal rule if not provided
  const computedAuc = auc ?? (() => {
    let a = 0
    for (let i = 1; i < data.length; i++) {
      a += Math.abs(data[i].recall - data[i - 1].recall) * ((data[i].precision + data[i - 1].precision) / 2)
    }
    return Math.abs(a)
  })()

  const xLabel = isROC ? 'False Positive Rate' : 'Recall'
  const yLabel = isROC ? 'True Positive Rate' : 'Precision'
  const lineName = isROC ? 'ROC Curve' : 'PR Curve'
  const lineColor = isROC ? '#2196f3' : '#4caf50'
  const aucLabel = isROC ? 'AUC-ROC' : 'AUC-PR'

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {aucLabel} = <strong>{computedAuc.toFixed(4)}</strong>
          </Typography>
          {!isROC && prevalence != null && (
            <Typography variant="caption" color="text.secondary">
              Baseline = <strong>{prevalence.toFixed(3)}</strong>
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis
              dataKey="recall"
              type="number"
              domain={[0, 1]}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: xLabel, position: 'insideBottomRight', offset: -5, fontSize: 11 }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => v.toFixed(1)}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11 }}
            />
            <Tooltip formatter={(v: number) => v.toFixed(4)} />
            <Legend verticalAlign="top" height={24} />
            {isROC && (
              <ReferenceLine
                stroke="#888"
                strokeDasharray="4 4"
                segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
                label={{ value: 'No-skill', position: 'insideTopLeft', fontSize: 10, fill: '#888' }}
              />
            )}
            {!isROC && prevalence != null && (
              <ReferenceLine
                y={prevalence}
                stroke="#ff9800"
                strokeDasharray="6 3"
                label={{ value: 'No-skill baseline', position: 'insideTopRight', fontSize: 10, fill: '#ff9800' }}
              />
            )}
            <Line
              type="monotone"
              dataKey="precision"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              name={lineName}
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 0.5 }}>
        {isROC
          ? 'ROC Curve — higher area under curve = better discrimination'
          : 'PR Curve is more informative than ROC when classes are imbalanced'}
      </Typography>
    </Box>
  )
}
