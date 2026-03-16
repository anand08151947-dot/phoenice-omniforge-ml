import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import LinearProgress from '@mui/material/LinearProgress'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import type { EDAReport, DatasetProfile } from '../../api/types'
import IssuesSummary from './IssuesSummary'
import DataHealth from './DataHealth'
import FeatureStats from './FeatureStats'
import Relationships from './Relationships'
import ModelReadiness from './ModelReadiness'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { usePipelineStore } from '../../stores/pipeline'

interface TabPanelProps {
  children: React.ReactNode
  value: number
  index: number
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return <Box hidden={value !== index} sx={{ pt: 2 }}>{value === index && children}</Box>
}

export default function EDAPage() {
  const [tab, setTab] = useState(0)
  const navigate = useNavigate()
  const datasetId = usePipelineStore((s) => s.datasetId)
  const datasetName = usePipelineStore((s) => s.datasetName)

  const { data: edaReport, isLoading: edaLoading, error: edaError } = useQuery<EDAReport>({
    queryKey: ['eda', datasetId],
    queryFn: () => fetch(`/api/eda?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`EDA API returned ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
    retry: false,
  })

  const { data: profileData } = useQuery<DatasetProfile>({
    queryKey: ['profile', datasetId],
    queryFn: () => fetch(`/api/profile?dataset_id=${datasetId}`).then((r) => r.json()),
    enabled: !!datasetId,
  })

  if (!datasetId) {
    return (
      <Box>
        <PageHeader title="Exploratory Data Analysis" subtitle="Phase 2 — Automated insights, issue detection, and readiness assessment" />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Upload or select a dataset first.
        </Alert>
      </Box>
    )
  }

  if (edaLoading) return <LinearProgress />

  if (edaError || !edaReport) {
    return (
      <Box>
        <PageHeader title="Exploratory Data Analysis" subtitle={`Phase 2 — ${datasetName}`} />
        <Alert severity="warning" sx={{ mb: 2 }}>
          EDA report not available yet. Profile the dataset first, then EDA will be computed automatically.
        </Alert>
        {profileData && <FeatureStats profile={profileData} />}
      </Box>
    )
  }

  const report = edaReport
  const criticalCount = report.issues.filter((i) => i.severity === 'critical' || i.severity === 'high').length

  return (
    <Box>
      <PageHeader
        title="Exploratory Data Analysis"
        subtitle="Phase 2 — Automated insights, issue detection, and readiness assessment"
        badge={criticalCount > 0 ? <Chip icon={<WarningAmberIcon />} label={`${criticalCount} Critical Issues`} color="error" size="small" /> : undefined}
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tab label={`Issues (${report.issues.length})`} />
        <Tab label="Data Health" />
        <Tab label="Feature Stats" />
        <Tab label="Relationships" />
        <Tab label="Model Readiness" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <Suspense fallback={<LinearProgress />}>
          <IssuesSummary issues={report.issues} />
        </Suspense>
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <DataHealth report={report} profileRowCount={profileData?.row_count} profileDuplicates={profileData?.duplicate_rows} />
      </TabPanel>
      <TabPanel value={tab} index={2}>
        {profileData ? <FeatureStats profile={profileData} /> : <LinearProgress />}
      </TabPanel>
      <TabPanel value={tab} index={3}>
        <Relationships report={report} />
      </TabPanel>
      <TabPanel value={tab} index={4}>
        <ModelReadiness report={report} />
      </TabPanel>
    </Box>
  )
}
