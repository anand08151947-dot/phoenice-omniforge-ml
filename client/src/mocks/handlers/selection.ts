import { http, HttpResponse } from 'msw'
import type { FeatureSelectionReport } from '../../api/types'

const mockReport: FeatureSelectionReport = {
  dataset_id: 'ds_001',
  method: 'random_forest + mutual_info ensemble',
  selected_count: 15,
  dropped_count: 19,
  importances: [
    { feature: 'credit_score_scaled', importance: 0.187, rank: 1, method: 'random_forest', keep: true },
    { feature: 'age', importance: 0.162, rank: 2, method: 'random_forest', keep: true },
    { feature: 'balance', importance: 0.148, rank: 3, method: 'random_forest', keep: true },
    { feature: 'num_products', importance: 0.121, rank: 4, method: 'random_forest', keep: true },
    { feature: 'income_log', importance: 0.098, rank: 5, method: 'random_forest', keep: true },
    { feature: 'tenure_months', importance: 0.089, rank: 6, method: 'random_forest', keep: true },
    { feature: 'credit_income_ratio', importance: 0.077, rank: 7, method: 'random_forest', keep: true },
    { feature: 'country_ohe_France', importance: 0.062, rank: 8, method: 'random_forest', keep: true },
    { feature: 'country_ohe_Germany', importance: 0.058, rank: 9, method: 'random_forest', keep: true },
    { feature: 'is_active_member', importance: 0.049, rank: 10, method: 'random_forest', keep: true },
    { feature: 'age_bin', importance: 0.041, rank: 11, method: 'random_forest', keep: true },
    { feature: 'income_per_product', importance: 0.038, rank: 12, method: 'mutual_info', keep: true },
    { feature: 'tenure_years', importance: 0.031, rank: 13, method: 'mutual_info', keep: true },
    { feature: 'has_credit_card', importance: 0.024, rank: 14, method: 'mutual_info', keep: true },
    { feature: 'gender_encoded', importance: 0.018, rank: 15, method: 'mutual_info', keep: true },
    { feature: 'salary', importance: 0.011, rank: 16, method: 'random_forest', keep: false },
    { feature: 'estimated_salary', importance: 0.009, rank: 17, method: 'random_forest', keep: false },
    { feature: 'country_ohe_Spain', importance: 0.008, rank: 18, method: 'random_forest', keep: false },
    { feature: 'age_scaled', importance: 0.007, rank: 19, method: 'random_forest', keep: false },
    { feature: 'balance_sqrt', importance: 0.006, rank: 20, method: 'random_forest', keep: false },
  ],
}

export const selectionHandlers = [
  http.get('/api/selection', () => HttpResponse.json(mockReport)),
  http.post('/api/selection/apply', async () => {
    await new Promise((r) => setTimeout(r, 1000))
    return HttpResponse.json({ status: 'applied', selected_features: 15 })
  }),
]
