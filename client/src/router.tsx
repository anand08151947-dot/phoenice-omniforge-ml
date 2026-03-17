import { createBrowserRouter, useRouteError } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import AppShell from './components/layout/AppShell'
import LinearProgress from '@mui/material/LinearProgress'

function RouteError() {
  const error = useRouteError() as Error
  return (
    <div style={{ padding: 32, fontFamily: 'monospace' }}>
      <h2 style={{ color: 'red' }}>Route Error</h2>
      <pre style={{ background: '#111', color: '#f88', padding: 16, borderRadius: 8, overflow: 'auto' }}>
        {error?.message ?? String(error)}
        {'\n\n'}
        {error?.stack}
      </pre>
    </div>
  )
}

const HomePage = lazy(() => import('./pages/Home'))
const ProjectsPage = lazy(() => import('./pages/Projects'))
const ProjectDashboardPage = lazy(() => import('./pages/Projects/ProjectDashboard'))
const UploadPage = lazy(() => import('./pages/Upload'))
const PIIPage = lazy(() => import('./pages/PII'))
const ProfilePage = lazy(() => import('./pages/Profile'))
const EDAPage = lazy(() => import('./pages/EDA'))
const CleaningPage = lazy(() => import('./pages/Cleaning'))
const SamplingPage = lazy(() => import('./pages/Sampling'))
const FeaturesPage = lazy(() => import('./pages/Features'))
const SelectionPage = lazy(() => import('./pages/Selection'))
const TrainingPage = lazy(() => import('./pages/Training'))
const EvaluationPage = lazy(() => import('./pages/Evaluation'))
const ExplainPage = lazy(() => import('./pages/Explain'))
const DeployPage = lazy(() => import('./pages/Deploy'))
const ChatPage = lazy(() => import('./pages/Chat'))
const PipelinePage = lazy(() => import('./pages/Pipeline'))
const ActiveLearningPage = lazy(() => import('./pages/ActiveLearning'))

function Fallback() {
  return <LinearProgress />
}

function Wrap({ component: C }: { component: React.ComponentType }) {
  return <Suspense fallback={<Fallback />}><C /></Suspense>
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Wrap component={ProjectsPage} /> },
      { path: 'home', element: <Wrap component={HomePage} /> },
      { path: 'projects/:id', element: <Wrap component={ProjectDashboardPage} /> },
      { path: 'upload', element: <Wrap component={UploadPage} /> },
      { path: 'pii', element: <Wrap component={PIIPage} /> },
      { path: 'profile', element: <Wrap component={ProfilePage} /> },
      { path: 'eda', element: <Wrap component={EDAPage} /> },
      { path: 'cleaning', element: <Wrap component={CleaningPage} /> },
      { path: 'sampling', element: <Wrap component={SamplingPage} /> },
      { path: 'features', element: <Wrap component={FeaturesPage} /> },
      { path: 'selection', element: <Wrap component={SelectionPage} /> },
      { path: 'training', element: <Wrap component={TrainingPage} /> },
      { path: 'evaluation', element: <Wrap component={EvaluationPage} /> },
      { path: 'explain', element: <Wrap component={ExplainPage} /> },
      { path: 'deploy', element: <Wrap component={DeployPage} /> },
      { path: 'chat', element: <Wrap component={ChatPage} /> },
      { path: 'pipeline', element: <Wrap component={PipelinePage} /> },
      { path: 'active-learning', element: <Wrap component={ActiveLearningPage} /> },
    ],
  },
])
