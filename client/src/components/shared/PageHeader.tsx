import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  badge?: ReactNode
}

export default function PageHeader({ title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{title}</Typography>
          {badge}
        </Box>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexShrink: 0, ml: 2 }}>{actions}</Box>
      )}
    </Box>
  )
}
