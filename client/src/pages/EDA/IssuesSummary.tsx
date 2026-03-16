import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { EDAIssue } from '../../api/types'
import IssueAlert from '../../components/shared/IssueAlert'

interface IssuesSummaryProps {
  issues: EDAIssue[]
}

const order = { critical: 0, high: 1, medium: 2, low: 3 }

export default function IssuesSummary({ issues }: IssuesSummaryProps) {
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity])

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length} critical/high priority issues require immediate attention.
      </Typography>
      {sorted.map((issue) => (
        <IssueAlert key={issue.id} {...issue} />
      ))}
    </Box>
  )
}
