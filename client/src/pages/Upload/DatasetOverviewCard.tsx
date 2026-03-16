import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import TableRowsIcon from '@mui/icons-material/TableRows'
import ViewColumnIcon from '@mui/icons-material/ViewColumn'
import MemoryIcon from '@mui/icons-material/Memory'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import type { SmartOverview, ColumnTypeSummary } from '../../api/types'

function StatTile({ icon, label, value, warn }: {
  icon: React.ReactNode; label: string; value: string; warn?: boolean
}) {
  return (
    <Box sx={{
      p: 1.5, border: '1px solid', borderColor: warn ? 'warning.main' : 'divider',
      borderRadius: 1.5, textAlign: 'center', bgcolor: warn ? 'rgba(255,152,0,0.05)' : 'background.paper',
    }}>
      <Box sx={{ color: warn ? 'warning.main' : 'primary.main', mb: 0.5 }}>{icon}</Box>
      <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1 }}>{value}</Typography>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  )
}

interface Props {
  overview: SmartOverview
  typeSummary: ColumnTypeSummary
}

export default function DatasetOverviewCard({ overview, typeSummary }: Props) {
  const typeChips = [
    { label: 'Numeric', count: typeSummary.numeric, color: '#1976d2' },
    { label: 'Categorical', count: typeSummary.categorical, color: '#7b1fa2' },
    { label: 'DateTime', count: typeSummary.datetime, color: '#0288d1' },
    { label: 'Text', count: typeSummary.text, color: '#388e3c' },
    { label: 'Boolean', count: typeSummary.boolean, color: '#f57c00' },
  ].filter(c => c.count > 0)

  return (
    <Box>
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatTile icon={<TableRowsIcon />} label="Rows" value={overview.row_count.toLocaleString()} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatTile icon={<ViewColumnIcon />} label="Columns" value={String(overview.col_count)} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatTile icon={<MemoryIcon />} label="Memory" value={`${overview.memory_mb} MB`} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatTile
            icon={<ContentCopyIcon />}
            label="Duplicates"
            value={`${overview.duplicate_pct}%`}
            warn={overview.duplicate_pct > 2}
          />
        </Grid>
        <Grid size={{ xs: 6, sm: 4, md: 2 }}>
          <StatTile
            icon={<WarningAmberIcon />}
            label="Missing Cells"
            value={`${overview.missing_pct}%`}
            warn={overview.missing_pct > 5}
          />
        </Grid>
      </Grid>

      {/* Column type breakdown */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>Column types:</Typography>
        {typeChips.map(c => (
          <Box key={c.label} sx={{
            px: 1.5, py: 0.25, borderRadius: 10, fontSize: '0.72rem', fontWeight: 600,
            bgcolor: `${c.color}18`, color: c.color, border: `1px solid ${c.color}40`,
          }}>
            {c.label}: {c.count}
          </Box>
        ))}
        {typeSummary.high_cardinality.length > 0 && (
          <Tooltip title={`High cardinality: ${typeSummary.high_cardinality.join(', ')}`}>
            <Box sx={{
              px: 1.5, py: 0.25, borderRadius: 10, fontSize: '0.72rem', fontWeight: 600,
              bgcolor: 'rgba(244,67,54,0.08)', color: '#f44336', border: '1px solid rgba(244,67,54,0.3)',
              cursor: 'help',
            }}>
              High Cardinality: {typeSummary.high_cardinality.length}
            </Box>
          </Tooltip>
        )}
        {typeSummary.constant_columns.length > 0 && (
          <Tooltip title={`Constant columns: ${typeSummary.constant_columns.join(', ')}`}>
            <Box sx={{
              px: 1.5, py: 0.25, borderRadius: 10, fontSize: '0.72rem', fontWeight: 600,
              bgcolor: 'rgba(255,152,0,0.08)', color: '#ff9800', border: '1px solid rgba(255,152,0,0.3)',
              cursor: 'help',
            }}>
              Constant: {typeSummary.constant_columns.length}
            </Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  )
}
