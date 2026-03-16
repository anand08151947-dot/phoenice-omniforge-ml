import { http, HttpResponse } from 'msw'
import type { TrainingJob } from '../../api/types'

const mockJob: TrainingJob = {
  job_id: 'job_001',
  dataset_id: 'ds_001',
  status: 'done',
  started_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  current_trial: 42,
  total_trials: 50,
  best_score: 0.8932,
  candidates: [
    { id: 'm1', model_name: 'LightGBM', library: 'lightgbm', hyperparams: { n_estimators: 300, learning_rate: 0.05, max_depth: 6 }, cv_score: 0.8932, train_score: 0.9412, val_score: 0.8798, f1: 0.6841, auc_roc: 0.9312, train_time_s: 42.3, status: 'done', progress: 100 },
    { id: 'm2', model_name: 'XGBoost', library: 'xgboost', hyperparams: { n_estimators: 250, learning_rate: 0.08, max_depth: 7 }, cv_score: 0.8876, train_score: 0.9321, val_score: 0.8712, f1: 0.6723, auc_roc: 0.9241, train_time_s: 58.7, status: 'done', progress: 100 },
    { id: 'm3', model_name: 'Random Forest', library: 'sklearn', hyperparams: { n_estimators: 200, max_depth: 10 }, cv_score: 0.8743, train_score: 0.9654, val_score: 0.8601, f1: 0.6512, auc_roc: 0.9098, train_time_s: 35.2, status: 'done', progress: 100 },
    { id: 'm4', model_name: 'Logistic Regression', library: 'sklearn', hyperparams: { C: 0.1, solver: 'lbfgs' }, cv_score: 0.8234, train_score: 0.8312, val_score: 0.8198, f1: 0.5821, auc_roc: 0.8634, train_time_s: 3.1, status: 'done', progress: 100 },
    { id: 'm5', model_name: 'Neural Network', library: 'pytorch', hyperparams: { hidden_layers: [256, 128, 64], dropout: 0.3, lr: 0.001 }, cv_score: 0.8612, train_score: 0.9123, val_score: 0.8478, f1: 0.6234, auc_roc: 0.8987, train_time_s: 124.8, status: 'done', progress: 100 },
    { id: 'm6', model_name: 'CatBoost', library: 'catboost', hyperparams: { iterations: 300, depth: 6 }, cv_score: 0.8901, train_score: 0.9398, val_score: 0.8756, f1: 0.6789, auc_roc: 0.9278, train_time_s: 61.4, status: 'running', progress: 72 },
    { id: 'm7', model_name: 'SVM (RBF)', library: 'sklearn', hyperparams: { C: 10, gamma: 'scale' }, cv_score: 0, train_score: 0, val_score: 0, f1: 0, auc_roc: 0, train_time_s: 0, status: 'pending', progress: 0 },
  ],
}

export const trainingHandlers = [
  http.get('/api/training', () => HttpResponse.json(mockJob)),
  http.post('/api/training/launch', async () => {
    await new Promise((r) => setTimeout(r, 500))
    return HttpResponse.json({ job_id: 'job_002', status: 'running' })
  }),
  http.get('/api/training/progress', () => {
    return HttpResponse.json({
      job_id: 'job_001',
      elapsed_s: 480,
      remaining_s: 120,
      candidates: mockJob.candidates,
    })
  }),
]
