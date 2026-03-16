import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import type { DatasetProfile } from '../../api/types'
import ColumnCard from '../Profile/ColumnCard'

interface FeatureStatsProps {
  profile: DatasetProfile
}

export default function FeatureStats({ profile }: FeatureStatsProps) {
  const numericCols = profile.columns.filter((c) => c.inferred_type === 'numeric' || c.inferred_type === 'categorical')

  return (
    <Box>
      <Grid container spacing={2}>
        {numericCols.map((col) => (
          <Grid key={col.name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <ColumnCard col={col} />
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
