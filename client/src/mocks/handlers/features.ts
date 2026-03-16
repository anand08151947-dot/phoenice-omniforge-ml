import { http, HttpResponse } from 'msw'
import type { FeatureEngineeringPlan } from '../../api/types'

const mockPlan: FeatureEngineeringPlan = {
  dataset_id: 'ds_001',
  total_features_in: 21,
  total_features_out: 34,
  specs: [
    { id: 'f1', source_columns: ['income'], output_name: 'income_log', transform: 'log', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f2', source_columns: ['age'], output_name: 'age_scaled', transform: 'standard_scale', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f3', source_columns: ['credit_score'], output_name: 'credit_score_scaled', transform: 'min_max_scale', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f4', source_columns: ['country'], output_name: 'country_ohe', transform: 'one_hot_encode', dtype_in: 'object', dtype_out: 'float64', enabled: true },
    { id: 'f5', source_columns: ['gender'], output_name: 'gender_encoded', transform: 'label_encode', dtype_in: 'object', dtype_out: 'int64', enabled: true },
    { id: 'f6', source_columns: ['age'], output_name: 'age_bin', transform: 'bin', params: { bins: [18, 30, 45, 60, 90], labels: ['young', 'adult', 'middle', 'senior'] }, dtype_in: 'float64', dtype_out: 'int64', enabled: true },
    { id: 'f7', source_columns: ['income', 'num_products'], output_name: 'income_per_product', transform: 'interaction', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f8', source_columns: ['balance'], output_name: 'balance_sqrt', transform: 'sqrt', dtype_in: 'float64', dtype_out: 'float64', enabled: false },
    { id: 'f9', source_columns: ['tenure_months'], output_name: 'tenure_years', transform: 'none', params: { formula: 'tenure_months / 12' }, dtype_in: 'int64', dtype_out: 'float64', enabled: true },
    { id: 'f10', source_columns: ['credit_score', 'income'], output_name: 'credit_income_ratio', transform: 'interaction', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
  ],
}

export const featuresHandlers = [
  http.get('/api/features', () => HttpResponse.json(mockPlan)),
  http.post('/api/features/apply', async () => {
    await new Promise((r) => setTimeout(r, 1000))
    return HttpResponse.json({ status: 'applied', features_out: 34 })
  }),
]
