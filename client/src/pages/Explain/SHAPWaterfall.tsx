import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { SHAPExplanation } from '../../api/types'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

interface SHAPWaterfallProps {
  explanation: SHAPExplanation
}

export default function SHAPWaterfall({ explanation }: SHAPWaterfallProps) {
  const { local_shap, base_value, prediction } = explanation
  const sorted = [...local_shap].sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))

  const data = sorted.map((s) => ({
    name: `${s.feature} = ${typeof s.feature_value === 'number' ? s.feature_value.toLocaleString() : s.feature_value}`,
    value: s.shap_value,
  }))

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Starting from base value <strong>{base_value.toFixed(3)}</strong> → final prediction <strong>{prediction.toFixed(3)}</strong> (logit)
      </Typography>
      <Box sx={{ height: 460 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 10, right: 60, left: 180, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => v.toFixed(3)} tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={175} />
            <Tooltip formatter={(v: any) => [(v > 0 ? '+' : '') + Number(v).toFixed(4), 'SHAP']} />
            <ReferenceLine x={0} stroke="#777" />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((d, i) => (
                <Cell key={i} fill={d.value > 0 ? '#EF5350' : '#6C63FF'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  )
}
