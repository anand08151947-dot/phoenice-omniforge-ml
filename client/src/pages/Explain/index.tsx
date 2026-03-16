import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import type { SHAPExplanation, CounterfactualResult } from '../../api/types'
import SHAPBeeswarm from './SHAPBeeswarm'
import SHAPWaterfall from './SHAPWaterfall'
import Counterfactual from './Counterfactual'
import { usePipelineStore } from '../../stores/pipeline'

interface TabPanelProps { children: React.ReactNode; value: number; index: number }
function TabPanel({ children, value, index }: TabPanelProps) {
  return <Box hidden={value !== index} sx={{ pt: 2 }}>{value === index && children}</Box>
}

export default function ExplainPage() {
  const [tab, setTab] = useState(0)
  const { datasetId } = usePipelineStore()
  const navigate = useNavigate()

  const { data: shapData, isLoading: shapLoading } = useQuery<SHAPExplanation>({
    queryKey: ['explain-shap', datasetId],
    queryFn: () => fetch(`/api/explain/shap?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
  })

  const { data: cfData, isLoading: cfLoading } = useQuery<CounterfactualResult>({
    queryKey: ['explain-cf', datasetId],
    queryFn: () => fetch(`/api/explain/counterfactual?dataset_id=${datasetId}`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json()
    }),
    enabled: !!datasetId,
  })

  if (!datasetId) {
    return (
      <Box>
        <PageHeader
          title="Model Explainability"
          subtitle="Phase 10 — SHAP global/local explanations and counterfactual analysis"
        />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Please upload and train a model first.
        </Alert>
      </Box>
    )
  }

  const loading = shapLoading || cfLoading
  if (loading) return <Box><PageHeader title="Model Explainability" subtitle="Phase 10 — SHAP global/local explanations and counterfactual analysis" /><Box sx={{ mt: 2 }}><LinearProgress /></Box></Box>

  return (
    <Box>
      <PageHeader
        title="Model Explainability"
        subtitle="Phase 10 — SHAP global/local explanations and counterfactual analysis"
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Global SHAP (Beeswarm)" />
        <Tab label="Local SHAP (Waterfall)" />
        <Tab label="Counterfactual" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        {shapData && <SHAPBeeswarm explanation={shapData} />}
      </TabPanel>
      <TabPanel value={tab} index={1}>
        {shapData && <SHAPWaterfall explanation={shapData} />}
      </TabPanel>
      <TabPanel value={tab} index={2}>
        {cfData && <Counterfactual cf={cfData} />}
      </TabPanel>
    </Box>
  )
}
