import { http, HttpResponse } from 'msw'
import type { SHAPExplanation, CounterfactualResult } from '../../api/types'

const features = ['credit_score', 'age', 'balance', 'num_products', 'income', 'tenure_months', 'is_active_member', 'country', 'gender', 'estimated_salary']
const n = 100

const globalShap: SHAPExplanation['global_shap'] = features.map((f, i) => ({
  feature: f,
  mean_abs_shap: Number((0.4 - i * 0.035).toFixed(3)),
  values: Array.from({ length: n }, () => Number(((Math.random() - 0.5) * (0.4 - i * 0.03)).toFixed(4))),
}))

const mockExplanation: SHAPExplanation = {
  model_id: 'm1',
  base_value: -1.3862,
  prediction: 0.0821,
  global_shap: globalShap,
  local_shap: [
    { feature: 'credit_score', shap_value: -0.342, feature_value: 480, normalized_value: 0.18 },
    { feature: 'num_products', shap_value: 0.281, feature_value: 4, normalized_value: 1.0 },
    { feature: 'balance', shap_value: 0.198, feature_value: 142300, normalized_value: 0.72 },
    { feature: 'age', shap_value: -0.154, feature_value: 62, normalized_value: 0.81 },
    { feature: 'is_active_member', shap_value: 0.132, feature_value: 0, normalized_value: 0.0 },
    { feature: 'income', shap_value: -0.089, feature_value: 89000, normalized_value: 0.58 },
    { feature: 'tenure_months', shap_value: 0.067, feature_value: 8, normalized_value: 0.07 },
    { feature: 'country', shap_value: -0.042, feature_value: 1, normalized_value: 0.5 },
    { feature: 'gender', shap_value: 0.021, feature_value: 0, normalized_value: 0.0 },
    { feature: 'estimated_salary', shap_value: -0.011, feature_value: 112000, normalized_value: 0.62 },
  ],
}

const mockCounterfactual: CounterfactualResult = {
  original_prediction: 0.821,
  cf_prediction: 0.178,
  original_class: 'Churned',
  cf_class: 'Not Churned',
  distance: 1.24,
  features: [
    { feature: 'credit_score', original_value: 480, cf_value: 650, min: 300, max: 850, step: 10 },
    { feature: 'num_products', original_value: 4, cf_value: 2, min: 1, max: 4, step: 1 },
    { feature: 'balance', original_value: 142300, cf_value: 50000, min: 0, max: 250000, step: 1000 },
    { feature: 'is_active_member', original_value: 0, cf_value: 1, min: 0, max: 1, step: 1 },
    { feature: 'age', original_value: 62, cf_value: 62, min: 18, max: 89, step: 1 },
    { feature: 'tenure_months', original_value: 8, cf_value: 36, min: 1, max: 120, step: 1 },
    { feature: 'income', original_value: 89000, cf_value: 89000, min: 0, max: 200000, step: 1000 },
  ],
}

export const explainHandlers = [
  http.get('/api/explain/shap', () => HttpResponse.json(mockExplanation)),
  http.get('/api/explain/counterfactual', () => HttpResponse.json(mockCounterfactual)),
]
