import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { SHAPExplanation } from '../../api/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

interface SHAPBeeswarmProps {
  explanation: SHAPExplanation
}

export default function SHAPBeeswarm({ explanation }: SHAPBeeswarmProps) {
  const { global_shap } = explanation
  const sorted = [...global_shap].sort((a, b) => b.mean_abs_shap - a.mean_abs_shap).slice(0, 10)

  const data = sorted.map((f) => ({
    feature: f.feature,
    importance: f.mean_abs_shap,
  }))

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Mean |SHAP| value per feature — higher = more impact on model output.
      </Typography>
      <Box sx={{ height: 480 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 40, left: 120, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => v.toFixed(3)} tick={{ fontSize: 10 }} label={{ value: 'Mean |SHAP|', position: 'insideBottomRight', offset: -5, fontSize: 11 }} />
            <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={115} />
            <Tooltip formatter={(v: any) => [Number(v).toFixed(4), 'Mean |SHAP|']} />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={`hsl(${250 + i * 15}, 75%, ${70 - i * 3}%)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  )
}
