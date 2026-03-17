import Box from '@mui/material/Box'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/shared/PageHeader'
import type { SHAPExplanation, CounterfactualResult } from '../../api/types'
import SHAPBeeswarm from './SHAPBeeswarm'
import SHAPWaterfall from './SHAPWaterfall'
import Counterfactual from './Counterfactual'
import { PDPChart } from './PDPChart'
import { usePipelineStore } from '../../stores/pipeline'

interface TabPanelProps { children: React.ReactNode; value: number; index: number }
function TabPanel({ children, value, index }: TabPanelProps) {
  return <Box hidden={value !== index} sx={{ pt: 2 }}>{value === index && children}</Box>
}

interface PDPFeatureItem { feature: string; importance: number }
interface PDPResult {
  feature: string
  task_type: string
  is_classification: boolean
  n_samples: number
  points: { feature_value: number; mean_prediction: number; lower: number; upper: number }[]
}

export default function ExplainPage() {
  const [tab, setTab] = useState(0)
  const [selectedFeature, setSelectedFeature] = useState<string>('')
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

  // Fetch available features for PDP (top 20 by importance)
  const { data: featuresData } = useQuery<{ features: PDPFeatureItem[] }>({
    queryKey: ['explain-features', datasetId],
    queryFn: (): Promise<{ features: PDPFeatureItem[] }> =>
      fetch(`/api/explain/features?dataset_id=${datasetId}`).then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<{ features: PDPFeatureItem[] }>
      }),
    enabled: !!datasetId && tab === 3,
  })

  // Fetch PDP data for the selected feature
  const { data: pdpData, isLoading: pdpLoading } = useQuery<PDPResult>({
    queryKey: ['explain-pdp', datasetId, selectedFeature],
    queryFn: () =>
      fetch(`/api/explain/pdp?dataset_id=${datasetId}&feature=${encodeURIComponent(selectedFeature)}`).then(
        (r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        },
      ),
    enabled: !!datasetId && !!selectedFeature && tab === 3,
  })

  if (!datasetId) {
    return (
      <Box>
        <PageHeader
          title="Model Explainability"
          subtitle="Phase 10 — SHAP global/local explanations, counterfactual analysis and partial dependence"
        />
        <Alert severity="info" action={<Button size="small" onClick={() => navigate('/upload')}>Upload Dataset</Button>}>
          No dataset selected. Please upload and train a model first.
        </Alert>
      </Box>
    )
  }

  const loading = shapLoading || cfLoading
  if (loading) return (
    <Box>
      <PageHeader
        title="Model Explainability"
        subtitle="Phase 10 — SHAP global/local explanations, counterfactual analysis and partial dependence"
      />
      <Box sx={{ mt: 2 }}><LinearProgress /></Box>
    </Box>
  )

  // When features load, auto-select the top feature
  const pdpFeatures = featuresData?.features ?? []
  if (pdpFeatures.length > 0 && !selectedFeature) {
    setSelectedFeature(pdpFeatures[0].feature)
  }

  return (
    <Box>
      <PageHeader
        title="Model Explainability"
        subtitle="Phase 10 — SHAP global/local explanations, counterfactual analysis and partial dependence"
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Global SHAP (Beeswarm)" />
        <Tab label="Local SHAP (Waterfall)" />
        <Tab label="Counterfactual" />
        <Tab label="Partial Dependence (PDP)" />
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
      <TabPanel value={tab} index={3}>
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Partial Dependence Plots show the marginal effect of one feature on the model's predicted
            outcome, averaged over all other features. The shaded band spans the 10th–90th percentile of
            individual predictions (ICE-like spread).
          </Typography>

          {pdpFeatures.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 260, mb: 3 }}>
              <InputLabel id="pdp-feature-label">Feature</InputLabel>
              <Select
                labelId="pdp-feature-label"
                value={selectedFeature}
                label="Feature"
                onChange={(e) => setSelectedFeature(e.target.value)}
              >
                {pdpFeatures.map((f: PDPFeatureItem) => (
                  <MenuItem key={f.feature} value={f.feature}>
                    {f.feature}
                    <Typography
                      component="span"
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1 }}
                    >
                      (imp: {f.importance.toFixed(3)})
                    </Typography>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {pdpLoading && <LinearProgress sx={{ mb: 2 }} />}

          {pdpData && !pdpLoading && (
            <PDPChart
              feature={pdpData.feature}
              points={pdpData.points}
              isClassification={pdpData.is_classification}
            />
          )}

          {!pdpLoading && !pdpData && selectedFeature && (
            <Alert severity="warning">
              Could not compute PDP for "{selectedFeature}". This may be a categorical or non-numeric feature.
            </Alert>
          )}

          {pdpFeatures.length === 0 && !pdpLoading && (
            <Alert severity="info">
              No feature importance data available. Run training first, then return here.
            </Alert>
          )}
        </Box>
      </TabPanel>
    </Box>
  )
}
