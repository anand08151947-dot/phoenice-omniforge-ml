import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import SectionCard from '../../components/shared/SectionCard'
import type { EDAReport } from '../../api/types'

interface RelationshipsProps {
  report: EDAReport
}

function CorrHeatmap({ columns, values }: { columns: string[]; values: number[][] }) {
  const n = columns.length
  // Use minmax so cells shrink to fill available space; allow scroll only if truly too narrow
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `50px repeat(${n}, minmax(36px, 1fr))`, gap: '2px', minWidth: Math.min(n * 36 + 50, 300) }}>
        {/* header row */}
        <Box />
        {columns.map((c) => (
          <Box key={c} sx={{ p: '2px', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', minHeight: 44 }}>
            <Box component="span" sx={{ fontSize: 9, color: 'text.secondary', transform: 'rotate(-45deg)', whiteSpace: 'nowrap', transformOrigin: 'bottom center' }}>
              {c.replace(/_/g, ' ')}
            </Box>
          </Box>
        ))}
        {/* data rows */}
        {values.map((row, ri) => (
          <>
            <Box key={`lbl-${ri}`} sx={{ fontSize: 9, color: 'text.secondary', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', pr: 0.5, whiteSpace: 'nowrap' }}>
              {columns[ri].replace(/_/g, ' ')}
            </Box>
            {row.map((v, ci) => {
              const abs = Math.abs(v)
              const isPos = v >= 0
              const alpha = ri === ci ? 1 : abs * 0.85 + 0.05
              return (
                <Box
                  key={ci}
                  title={`${columns[ri]} ↔ ${columns[ci]}: ${v.toFixed(3)}`}
                  sx={{
                    bgcolor: ri === ci
                      ? 'rgba(108,99,255,0.9)'
                      : isPos
                        ? `rgba(108,99,255,${alpha})`
                        : `rgba(239,83,80,${alpha})`,
                    borderRadius: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    aspectRatio: '1',
                    cursor: 'default',
                  }}
                >
                  <Box component="span" sx={{ fontSize: 8, color: abs > 0.5 ? 'white' : 'text.secondary' }}>
                    {v.toFixed(2)}
                  </Box>
                </Box>
              )
            })}
          </>
        ))}
      </Box>
    </Box>
  )
}

export default function Relationships({ report }: RelationshipsProps) {
  const { correlation_matrix, mi_scores } = report
  const top10MI = [...mi_scores].sort((a, b) => b.score - a.score).slice(0, 10)

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionCard title="Pearson Correlation Heatmap">
          <Box sx={{ height: 420, overflowY: 'auto' }}>
            <CorrHeatmap columns={correlation_matrix.columns} values={correlation_matrix.values} />
          </Box>
        </SectionCard>
      </Grid>

      <Grid size={{ xs: 12, lg: 5 }}>
        <SectionCard title="Top-10 Mutual Information Scores">
          <Box sx={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10MI} layout="vertical" margin={{ top: 10, right: 20, left: 100, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                <XAxis type="number" domain={[0, 0.35]} tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(2)} />
                <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={95} />
                <Tooltip formatter={(v: any) => [Number(v).toFixed(4), 'MI Score']} />
                <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                  {top10MI.map((_, i) => (
                    <Cell key={i} fill={`hsl(${250 - i * 18}, 80%, 65%)`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </SectionCard>
      </Grid>
    </Grid>
  )
}
