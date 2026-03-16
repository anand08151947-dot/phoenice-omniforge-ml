import { http, HttpResponse } from 'msw'
import type { EvaluationReport } from '../../api/types'

const mockReport: EvaluationReport = {
  dataset_id: 'ds_001',
  champion_model_id: 'm1',
  leaderboard: [
    { rank: 1, model_id: 'm1', model_name: 'LightGBM', cv_score: 0.8932, train_score: 0.9412, f1: 0.6841, auc_roc: 0.9312, train_time_s: 42.3, status: 'champion' },
    { rank: 2, model_id: 'm6', model_name: 'CatBoost', cv_score: 0.8901, train_score: 0.9398, f1: 0.6789, auc_roc: 0.9278, train_time_s: 61.4, status: 'challenger' },
    { rank: 3, model_id: 'm2', model_name: 'XGBoost', cv_score: 0.8876, train_score: 0.9321, f1: 0.6723, auc_roc: 0.9241, train_time_s: 58.7, status: 'challenger' },
    { rank: 4, model_id: 'm3', model_name: 'Random Forest', cv_score: 0.8743, train_score: 0.9654, f1: 0.6512, auc_roc: 0.9098, train_time_s: 35.2, status: 'challenger' },
    { rank: 5, model_id: 'm5', model_name: 'Neural Network', cv_score: 0.8612, train_score: 0.9123, f1: 0.6234, auc_roc: 0.8987, train_time_s: 124.8, status: 'challenger' },
    { rank: 6, model_id: 'm4', model_name: 'Logistic Regression', cv_score: 0.8234, train_score: 0.8312, f1: 0.5821, auc_roc: 0.8634, train_time_s: 3.1, status: 'dropped' },
    { rank: 7, model_id: 'm7', model_name: 'SVM (RBF)', cv_score: 0.7921, train_score: 0.8012, f1: 0.5234, auc_roc: 0.8312, train_time_s: 312.4, status: 'dropped' },
  ],
  confusion_matrix: {
    labels: ['Not Churned', 'Churned'],
    values: [[9289, 211], [341, 659]],
  },
  roc_curve: Array.from({ length: 50 }, (_, i) => ({
    fpr: i / 49,
    tpr: Math.min(1, (i / 49) ** 0.35 + Math.random() * 0.02),
  })),
  feature_importances: [
    { feature: 'credit_score_scaled', importance: 0.187, rank: 1, method: 'random_forest', keep: true },
    { feature: 'age', importance: 0.162, rank: 2, method: 'random_forest', keep: true },
    { feature: 'balance', importance: 0.148, rank: 3, method: 'random_forest', keep: true },
    { feature: 'num_products', importance: 0.121, rank: 4, method: 'random_forest', keep: true },
    { feature: 'income_log', importance: 0.098, rank: 5, method: 'random_forest', keep: true },
  ],
}

export const evaluationHandlers = [
  http.get('/api/evaluation', () => HttpResponse.json(mockReport)),
  http.post('/api/evaluation/promote', async () => {
    await new Promise((r) => setTimeout(r, 800))
    return HttpResponse.json({ status: 'promoted', deployment_id: 'dep_001' })
  }),
]
