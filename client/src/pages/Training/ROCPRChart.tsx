import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { ROCPoint, PRPoint } from '../../api/types'

interface ROCProps {
  roc: ROCPoint[]
  auc: number
  modelName: string
}

interface PRProps {
  pr: PRPoint[]
  modelName: string
}

interface Props {
  roc?: ROCPoint[]
  pr?: PRPoint[]
  auc?: number
  modelName: string
}

function ROCChart({ roc, auc, modelName }: ROCProps) {
  const data = [{ fpr: 0, tpr: 0 }, ...roc]
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        ROC Curve — {modelName}
        <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          AUC = {auc.toFixed(3)}
        </Typography>
      </Typography>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="fpr"
            type="number"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10 }}
            label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -2, fontSize: 10 }}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10 }}
            label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <RechartTooltip
            formatter={(val: any, name: any) => [`${(val * 100).toFixed(1)}%`, name]}
          />
          {/* Diagonal baseline (random classifier) */}
          <Line
            data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]}
            type="linear"
            dataKey="tpr"
            stroke="#bdbdbd"
            strokeDasharray="5 5"
            dot={false}
            name="Random"
          />
          <Line
            type="monotone"
            dataKey="tpr"
            stroke="#1976d2"
            dot={false}
            strokeWidth={2}
            name="ROC"
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}

function PRChart({ pr, modelName }: PRProps) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        Precision-Recall Curve — {modelName}
      </Typography>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={pr} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="recall"
            type="number"
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10 }}
            label={{ value: 'Recall', position: 'insideBottom', offset: -2, fontSize: 10 }}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            tick={{ fontSize: 10 }}
            label={{ value: 'Precision', angle: -90, position: 'insideLeft', fontSize: 10 }}
          />
          <RechartTooltip
            formatter={(val: any, name: any) => [`${(val * 100).toFixed(1)}%`, name]}
          />
          <Line
            type="monotone"
            dataKey="precision"
            stroke="#e91e63"
            dot={false}
            strokeWidth={2}
            name="Precision"
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  )
}

export default function ROCPRChart({ roc, pr, auc = 0, modelName }: Props) {
  if ((!roc || roc.length === 0) && (!pr || pr.length === 0)) return null
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
      {roc && roc.length > 0 && <ROCChart roc={roc} auc={auc} modelName={modelName} />}
      {pr && pr.length > 0 && <PRChart pr={pr} modelName={modelName} />}
    </Box>
  )
}
