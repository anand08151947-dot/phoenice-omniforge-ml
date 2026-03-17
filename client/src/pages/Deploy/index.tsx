import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import StepContent from '@mui/material/StepContent'
import TextField from '@mui/material/TextField'
import RadioGroup from '@mui/material/RadioGroup'
import FormControlLabel from '@mui/material/FormControlLabel'
import Radio from '@mui/material/Radio'
import Switch from '@mui/material/Switch'
import FormLabel from '@mui/material/FormLabel'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import { useState } from 'react'
import PageHeader from '../../components/shared/PageHeader'
import MonitoringPanel from './MonitoringPanel'
import ApprovalPanel from './ApprovalPanel'
import DriftPanel from './DriftPanel'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { usePipelineStore } from '../../stores/pipeline'

const STEPS = ['Select Model', 'Configure Endpoint', 'Deploy', 'Monitor']

export default function DeployPage() {
  const [activeStep, setActiveStep] = useState(2)
  const [target, setTarget] = useState('rest_api')
  const [replicas, setReplicas] = useState(2)
  const [enableMonitoring, setEnableMonitoring] = useState(true)
  const [enableLogging, setEnableLogging] = useState(true)
  const [deploying, setDeploying] = useState(false)
  const [deploymentId, setDeploymentId] = useState<string | undefined>(undefined)
  const { datasetId } = usePipelineStore()

  async function handleDeploy() {
    setDeploying(true)
    const deployRes = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, replicas, enable_monitoring: enableMonitoring, dataset_id: datasetId }),
    })
    const deployData = await deployRes.json()
    setDeploymentId(deployData.deployment_id)
    setDeploying(false)
    setActiveStep(3)
  }

  return (
    <Box>
      <PageHeader
        title="Model Deployment"
        subtitle="Phase 11 — Package, configure and deploy your champion model"
      />

      <Stepper activeStep={activeStep} orientation="vertical">
        <Step>
          <StepLabel>Select Model</StepLabel>
          <StepContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, my: 1 }}>
              <Chip label="LightGBM" color="primary" sx={{ fontWeight: 700 }} />
              <Chip label="Champion" sx={{ bgcolor: '#FFD700', color: '#000', fontWeight: 700 }} />
              <Typography variant="body2" color="text.secondary">CV Score: 0.8932 · AUC-ROC: 0.9312</Typography>
            </Box>
            <Button size="small" variant="contained" onClick={() => setActiveStep(1)}>Continue</Button>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Configure Endpoint</StepLabel>
          <StepContent>
            <Grid container spacing={2} sx={{ my: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Endpoint Name" defaultValue="lgbm-churn-v1" size="small" fullWidth />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormLabel sx={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', mb: 0.5 }}>Deploy Target</FormLabel>
                <RadioGroup row value={target} onChange={(e) => setTarget(e.target.value)}>
                  {[['rest_api', 'REST API'], ['batch', 'Batch'], ['edge', 'Edge']].map(([v, l]) => (
                    <FormControlLabel key={v} value={v} control={<Radio size="small" />} label={<Typography variant="body2">{l}</Typography>} />
                  ))}
                </RadioGroup>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormLabel sx={{ fontWeight: 700, fontSize: '0.85rem', display: 'block', mb: 0.5 }}>Replicas: {replicas}</FormLabel>
                <Slider value={replicas} onChange={(_, v) => setReplicas(v as number)} min={1} max={10} step={1} marks />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControlLabel control={<Switch checked={enableMonitoring} onChange={(e) => setEnableMonitoring(e.target.checked)} />} label="Enable drift monitoring" />
                <br />
                <FormControlLabel control={<Switch checked={enableLogging} onChange={(e) => setEnableLogging(e.target.checked)} />} label="Enable prediction logging" />
              </Grid>
            </Grid>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => setActiveStep(0)}>Back</Button>
              <Button size="small" variant="contained" onClick={() => setActiveStep(2)}>Continue</Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Deploy</StepLabel>
          <StepContent>
            <Alert severity="info" sx={{ mb: 2 }}>
              Model <strong>LightGBM</strong> will be deployed as a <strong>REST API</strong> with {replicas} replica(s).
              Endpoint URL will be: <code>https://api.omniforge.ai/v1/models/lgbm-churn-v1/predict</code>
            </Alert>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button size="small" onClick={() => setActiveStep(1)}>Back</Button>
              <Button size="small" variant="contained" color="success" startIcon={<RocketLaunchIcon />} onClick={handleDeploy} disabled={deploying}>
                {deploying ? 'Deploying…' : 'Deploy Now'}
              </Button>
            </Box>
          </StepContent>
        </Step>

        <Step>
          <StepLabel>Monitor</StepLabel>
          <StepContent>
            <Alert severity="success" sx={{ mb: 2 }}>
              ✅ Model deployed successfully! Endpoint: <code>https://api.omniforge.ai/v1/models/lgbm-churn-v1/predict</code>
            </Alert>
            <MonitoringPanel deploymentId={deploymentId} datasetId={datasetId ?? undefined} />
          </StepContent>
        </Step>
      </Stepper>

      <Divider sx={{ my: 3 }} />
      <ApprovalPanel />

      {deploymentId && (
        <Box sx={{ mt: 3 }}>
          <DriftPanel deploymentId={deploymentId} />
        </Box>
      )}
    </Box>
  )
}
