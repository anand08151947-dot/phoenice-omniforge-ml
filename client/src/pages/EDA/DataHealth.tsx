import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import MetricCard from '../../components/shared/MetricCard'
import SectionCard from '../../components/shared/SectionCard'
import type { EDAReport } from '../../api/types'
import WarningIcon from '@mui/icons-material/Warning'
import TableRowsIcon from '@mui/icons-material/TableRows'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

interface DataHealthProps {
  report: EDAReport
  profileRowCount?: number
  profileDuplicates?: number
}

export default function DataHealth({ report, profileRowCount = 50000, profileDuplicates = 134 }: DataHealthProps) {
  const missingData = report.missingness.map((m) => ({
    column: m.column,
    pct: Number((m.missing_pct * 100).toFixed(1)),
  }))

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Total Rows" value={profileRowCount.toLocaleString()} icon={<TableRowsIcon />} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Missing Columns" value={report.missingness.length} icon={<WarningIcon />} color="#FFA726" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Duplicate Rows" value={profileDuplicates} icon={<ContentCopyIcon />} color="#FFA726" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <MetricCard label="Issues Found" value={report.issues.length} icon={<WarningIcon />} color="#EF5350" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SectionCard title="Missing Values by Column (%)">
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={missingData} margin={{ top: 10, right: 20, left: -10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="column" tick={{ fontSize: 11 }} angle={-35} textAnchor="end" />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip formatter={(v: any) => [`${v}%`, 'Missing']} />
                  <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                    {missingData.map((d, i) => (
                      <Cell key={i} fill={d.pct > 30 ? '#EF5350' : d.pct > 10 ? '#FFA726' : '#6C63FF'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, sm: 6 }}>
          <SectionCard title="Target Distribution">
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report.target_distribution} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => v.toLocaleString()} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => [Number(v).toLocaleString(), 'Count']} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {report.target_distribution.map((_, i) => (
                      <Cell key={i} fill={i === 0 ? '#6C63FF' : '#FF6584'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </SectionCard>
        </Grid>
      </Grid>
    </Box>
  )
}
