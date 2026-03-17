import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { FeatureImportanceItem } from '../../api/types'

interface Props {
  importances: FeatureImportanceItem[]
  title?: string
  topN?: number
}

const COLORS = [
  '#1976d2', '#1565c0', '#1e88e5', '#42a5f5', '#64b5f6',
  '#90caf9', '#0d47a1', '#2196f3', '#0288d1', '#0277bd',
]

export default function FeatureImportanceChart({
  importances,
  title = 'Feature Importance',
  topN = 15,
}: Props) {
  if (!importances || importances.length === 0) return null

  const data = importances
    .slice(0, topN)
    .map((item, i) => ({
      name: item.feature.length > 20 ? item.feature.slice(0, 18) + '…' : item.feature,
      fullName: item.feature,
      importance: round2(item.importance * 100),
      color: COLORS[i % COLORS.length],
    }))
    .reverse() // highest importance at top in horizontal chart

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: (typeof data)[0] }> }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload
    return (
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider',
                  borderRadius: 1, p: 1, boxShadow: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 700 }}>{d.fullName}</Typography>
        <Typography variant="caption" display="block" color="text.secondary">
          Importance: {d.importance.toFixed(2)}%
        </Typography>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      <ResponsiveContainer width="100%" height={Math.max(data.length * 22 + 20, 120)}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 48, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
          <XAxis
            type="number"
            tickFormatter={(v) => `${v.toFixed(1)}%`}
            tick={{ fontSize: 10 }}
            domain={[0, 'dataMax + 2']}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 10 }}
            width={130}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="importance" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 10, formatter: (v: any) => `${v.toFixed(1)}%` }}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Box>
  )
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
