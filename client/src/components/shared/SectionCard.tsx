import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import type { ReactNode } from 'react'

interface SectionCardProps {
  title?: string
  subheader?: string
  toolbar?: ReactNode
  children: ReactNode
  sx?: object
  noPadding?: boolean
}

export default function SectionCard({ title, subheader, toolbar, children, sx, noPadding }: SectionCardProps) {
  return (
    <Card sx={{ mb: 2, ...sx }}>
      {title && (
        <CardHeader
          title={title}
          subheader={subheader}
          titleTypographyProps={{ variant: 'h6', fontWeight: 700 }}
          subheaderTypographyProps={{ variant: 'caption' }}
          action={toolbar}
          sx={{ pb: 0 }}
        />
      )}
      {noPadding ? children : <CardContent>{children}</CardContent>}
    </Card>
  )
}
