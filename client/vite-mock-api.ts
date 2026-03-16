/**
 * Vite dev-server middleware that serves mock API responses.
 * Replaces MSW (service worker) approach — runs in the Vite Node.js process,
 * so there is zero browser/SW interference with Vite's HMR and module serving.
 */
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

// ─── Mock data ────────────────────────────────────────────────────────────────

const datasets = [
  { id: 'ds_001', name: 'customer_churn.csv', file_size: 8.4 * 1024 * 1024, row_count: 50000, col_count: 22, created_at: '2024-01-15T10:30:00Z', status: 'ready', target_column: 'churn', task_type: 'classification' },
  { id: 'ds_002', name: 'loan_default.csv', file_size: 12.1 * 1024 * 1024, row_count: 84000, col_count: 31, created_at: '2024-01-14T08:20:00Z', status: 'ready', target_column: 'default', task_type: 'classification' },
  { id: 'ds_003', name: 'house_prices.csv', file_size: 3.2 * 1024 * 1024, row_count: 20000, col_count: 48, created_at: '2024-01-13T14:10:00Z', status: 'ready', target_column: 'price', task_type: 'regression' },
]

const piiReport = {
  dataset_id: 'ds_001', scanned_at: new Date().toISOString(), total_columns: 22, risk_score: 72,
  pii_columns: [
    { column: 'customer_email', entity_type: 'EMAIL', sensitivity: 'high', sample_values: ['j***@ex***.com'], match_count: 49800, match_pct: 0.996, recommended_action: 'mask', status: 'pending' },
    { column: 'phone_number', entity_type: 'PHONE', sensitivity: 'high', sample_values: ['+1-555-***-1234'], match_count: 48200, match_pct: 0.964, recommended_action: 'hash', status: 'pending' },
    { column: 'ssn', entity_type: 'SSN', sensitivity: 'high', sample_values: ['***-**-1234'], match_count: 31500, match_pct: 0.630, recommended_action: 'drop', status: 'pending' },
    { column: 'full_name', entity_type: 'NAME', sensitivity: 'medium', sample_values: ['J*** D**'], match_count: 50000, match_pct: 1.0, recommended_action: 'pseudonymize', status: 'pending' },
    { column: 'home_address', entity_type: 'ADDRESS', sensitivity: 'medium', sample_values: ['1** M*** St, NY'], match_count: 44200, match_pct: 0.884, recommended_action: 'mask', status: 'masked' },
    { column: 'date_of_birth', entity_type: 'DATE_OF_BIRTH', sensitivity: 'medium', sample_values: ['19**-**-**'], match_count: 50000, match_pct: 1.0, recommended_action: 'mask', status: 'masked' },
    { column: 'ip_address', entity_type: 'IP_ADDRESS', sensitivity: 'low', sample_values: ['192.168.*.*'], match_count: 38000, match_pct: 0.76, recommended_action: 'mask', status: 'approved' },
    { column: 'iban', entity_type: 'IBAN', sensitivity: 'high', sample_values: ['DE89****3702****0485'], match_count: 22000, match_pct: 0.44, recommended_action: 'encrypt', status: 'pending' },
  ],
}

const profileData = {
  dataset_id: 'ds_001', row_count: 50000, col_count: 22, duplicate_rows: 134,
  missing_cells: 8920, missing_pct: 0.081, memory_usage_mb: 8.4,
  generated_at: new Date().toISOString(),
  columns: [
    { name: 'customer_id', dtype: 'object', inferred_type: 'categorical', missing_pct: 0, unique_count: 50000, top_values: [{ value: 'C001', count: 1 }] },
    { name: 'age', dtype: 'float64', inferred_type: 'numeric', missing_pct: 0.02, unique_count: 78, mean: 42.3, std: 14.1, min: 18, max: 89, skewness: 0.32, kurtosis: -0.14, histogram: [{ bin: '18-28', count: 5400 }, { bin: '28-38', count: 9200 }, { bin: '38-48', count: 12300 }, { bin: '48-58', count: 11100 }, { bin: '58-68', count: 8200 }, { bin: '68-78', count: 2900 }, { bin: '78-89', count: 900 }] },
    { name: 'credit_score', dtype: 'float64', inferred_type: 'numeric', missing_pct: 0.38, unique_count: 612, mean: 651.4, std: 97.2, min: 300, max: 850, skewness: -0.21, kurtosis: 0.08, histogram: [{ bin: '300-400', count: 1200 }, { bin: '400-500', count: 3400 }, { bin: '500-600', count: 8900 }, { bin: '600-700', count: 14200 }, { bin: '700-800', count: 12100 }, { bin: '800-850', count: 4800 }], warnings: ['38% missing values – key predictive feature'] },
    { name: 'income', dtype: 'float64', inferred_type: 'numeric', missing_pct: 0.05, unique_count: 28340, mean: 58400, std: 32100, min: 12000, max: 480000, skewness: 2.1, kurtosis: 8.4, histogram: [{ bin: '0-50k', count: 22000 }, { bin: '50-100k', count: 18000 }, { bin: '100-150k', count: 6000 }, { bin: '150-200k', count: 2500 }, { bin: '200k+', count: 1500 }] },
    { name: 'balance', dtype: 'float64', inferred_type: 'numeric', missing_pct: 0, unique_count: 49856, mean: 76485.9, std: 62397.1, min: 0, max: 250898.1, skewness: 0.09 },
    { name: 'tenure_months', dtype: 'int64', inferred_type: 'numeric', missing_pct: 0, unique_count: 120, mean: 60.2, std: 34.8, min: 1, max: 120, skewness: 0.01 },
    { name: 'num_products', dtype: 'int64', inferred_type: 'numeric', missing_pct: 0, unique_count: 4, mean: 1.53, std: 0.58, min: 1, max: 4, skewness: 0.98, top_values: [{ value: 1, count: 24500 }, { value: 2, count: 19000 }, { value: 3, count: 5000 }, { value: 4, count: 1500 }] },
    { name: 'country', dtype: 'object', inferred_type: 'categorical', missing_pct: 0, unique_count: 3, top_values: [{ value: 'France', count: 25000 }, { value: 'Germany', count: 15000 }, { value: 'Spain', count: 10000 }] },
    { name: 'gender', dtype: 'object', inferred_type: 'categorical', missing_pct: 0, unique_count: 2, top_values: [{ value: 'Male', count: 26000 }, { value: 'Female', count: 24000 }] },
    { name: 'is_active_member', dtype: 'int64', inferred_type: 'boolean', missing_pct: 0, unique_count: 2, top_values: [{ value: 1, count: 29000 }, { value: 0, count: 21000 }] },
    { name: 'has_credit_card', dtype: 'int64', inferred_type: 'boolean', missing_pct: 0, unique_count: 2, top_values: [{ value: 1, count: 35000 }, { value: 0, count: 15000 }] },
    { name: 'estimated_salary', dtype: 'float64', inferred_type: 'numeric', missing_pct: 0.02, unique_count: 48000, mean: 100090, std: 57510, min: 11.58, max: 199992.5, skewness: -0.01 },
    { name: 'approval_date', dtype: 'object', inferred_type: 'datetime', missing_pct: 0.01, unique_count: 3652, warnings: ['Potential target leakage – corr=0.97 with target'] },
    { name: 'churn', dtype: 'int64', inferred_type: 'boolean', missing_pct: 0, unique_count: 2, top_values: [{ value: 0, count: 47500 }, { value: 1, count: 2500 }], is_target: true, warnings: ['Severe class imbalance: 95/5 split'] },
  ],
}

const cols = ['age', 'credit_score', 'income', 'salary', 'balance', 'tenure_months', 'num_products', 'estimated_salary']
const corrValues = cols.map((_, i) => cols.map((__, j) => {
  if (i === j) return 1
  if ((i === 2 && j === 3) || (i === 3 && j === 2)) return 0.99
  return Number((Math.random() * 0.6 - 0.3).toFixed(2))
}))

const edaReport = {
  dataset_id: 'ds_001',
  issues: [
    { id: 'i1', severity: 'critical', type: 'class_imbalance', title: 'Severe class imbalance', detail: '95/5 split on target `churn`', phase: 'sampling', metric: 0.05, affected_columns: ['churn'] },
    { id: 'i2', severity: 'high', type: 'missing_values', title: '38% missing values in credit_score', detail: 'Column `credit_score` — key predictive feature', phase: 'cleaning', metric: 0.38, affected_columns: ['credit_score'] },
    { id: 'i3', severity: 'high', type: 'leakage', title: 'Target leakage risk detected', detail: '`approval_date` correlates 0.97 with target', phase: 'features', metric: 0.97, affected_columns: ['approval_date'] },
    { id: 'i4', severity: 'medium', type: 'correlation', title: 'Highly redundant features', detail: '`income` ↔ `salary` (r = 0.99)', phase: 'selection', metric: 0.99, affected_columns: ['income', 'salary'] },
    { id: 'i5', severity: 'medium', type: 'outliers', title: 'Extreme outliers in income', detail: '312 rows exceed 3σ threshold', phase: 'cleaning', metric: 312, affected_columns: ['income'] },
    { id: 'i6', severity: 'low', type: 'duplicates', title: '134 duplicate rows', detail: 'Exact row duplicates found', phase: 'cleaning', metric: 134 },
  ],
  missingness: [
    { column: 'credit_score', missing_count: 19000, missing_pct: 0.38, pattern: 'MAR' },
    { column: 'income', missing_count: 2500, missing_pct: 0.05, pattern: 'MCAR' },
    { column: 'age', missing_count: 1000, missing_pct: 0.02, pattern: 'MCAR' },
  ],
  correlation_matrix: { columns: cols, values: corrValues },
  target_distribution: [{ label: 'Not Churned (0)', count: 47500 }, { label: 'Churned (1)', count: 2500 }],
  mi_scores: [
    { feature: 'credit_score', score: 0.312 }, { feature: 'age', score: 0.287 },
    { feature: 'balance', score: 0.241 }, { feature: 'num_products', score: 0.198 },
    { feature: 'tenure_months', score: 0.176 }, { feature: 'income', score: 0.132 },
  ],
}

const cleaningPlan = {
  dataset_id: 'ds_001', estimated_rows_affected: 22134, estimated_cols_removed: 1,
  actions: [
    { id: 'c1', column: 'credit_score', issue_type: 'missing_values', issue_detail: '38% missing values', severity: 'high', strategy: 'median_impute', affected_rows: 19000, estimated_impact: 'Fills 19,000 rows with median value (651)' },
    { id: 'c2', column: 'income', issue_type: 'missing_values', issue_detail: '5% missing values', severity: 'medium', strategy: 'mean_impute', affected_rows: 2500, estimated_impact: 'Fills 2,500 rows with mean ($58,400)' },
    { id: 'c3', column: 'age', issue_type: 'missing_values', issue_detail: '2% missing values', severity: 'low', strategy: 'median_impute', affected_rows: 1000, estimated_impact: 'Fills 1,000 rows with median (42)' },
    { id: 'c4', column: 'income', issue_type: 'outliers', issue_detail: '312 extreme outliers (>3σ)', severity: 'medium', strategy: 'clip_outliers', affected_rows: 312, estimated_impact: 'Clips values to [0, 200000] range' },
    { id: 'c5', column: 'approval_date', issue_type: 'leakage', issue_detail: 'Potential target leakage', severity: 'high', strategy: 'drop_column', affected_rows: 0, estimated_impact: 'Removes column to prevent data leakage' },
    { id: 'c6', column: '*', issue_type: 'duplicates', issue_detail: '134 duplicate rows', severity: 'low', strategy: 'drop_rows', affected_rows: 134, estimated_impact: 'Removes 134 exact duplicate rows' },
  ],
}

const samplingData = {
  imbalance: {
    dataset_id: 'ds_001', target_column: 'churn', imbalance_ratio: 19.0, recommended_strategy: 'oversample_smote',
    class_distribution: [{ label: 'Not Churned (0)', count: 47500, pct: 0.95 }, { label: 'Churned (1)', count: 2500, pct: 0.05 }],
  },
  config: { strategy: 'oversample_smote', target_ratio: 0.3, random_seed: 42, test_size: 0.2, val_size: 0.1 },
}

const featuresData = {
  dataset_id: 'ds_001', total_features_in: 21, total_features_out: 34,
  specs: [
    { id: 'f1', source_columns: ['income'], output_name: 'income_log', transform: 'log', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f2', source_columns: ['age'], output_name: 'age_scaled', transform: 'standard_scale', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f3', source_columns: ['credit_score'], output_name: 'credit_score_scaled', transform: 'min_max_scale', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f4', source_columns: ['country'], output_name: 'country_ohe', transform: 'one_hot_encode', dtype_in: 'object', dtype_out: 'float64', enabled: true },
    { id: 'f5', source_columns: ['gender'], output_name: 'gender_encoded', transform: 'label_encode', dtype_in: 'object', dtype_out: 'int64', enabled: true },
    { id: 'f6', source_columns: ['age'], output_name: 'age_bin', transform: 'bin', params: { bins: [18, 30, 45, 60, 90] }, dtype_in: 'float64', dtype_out: 'int64', enabled: true },
    { id: 'f7', source_columns: ['income', 'num_products'], output_name: 'income_per_product', transform: 'interaction', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
    { id: 'f8', source_columns: ['balance'], output_name: 'balance_sqrt', transform: 'sqrt', dtype_in: 'float64', dtype_out: 'float64', enabled: false },
    { id: 'f9', source_columns: ['tenure_months'], output_name: 'tenure_years', transform: 'none', params: { formula: 'tenure_months / 12' }, dtype_in: 'int64', dtype_out: 'float64', enabled: true },
    { id: 'f10', source_columns: ['credit_score', 'income'], output_name: 'credit_income_ratio', transform: 'interaction', dtype_in: 'float64', dtype_out: 'float64', enabled: true },
  ],
}

const selectionReport = {
  dataset_id: 'ds_001', method: 'random_forest + mutual_info ensemble', selected_count: 15, dropped_count: 19,
  importances: [
    { feature: 'credit_score_scaled', importance: 0.187, rank: 1, method: 'random_forest', keep: true },
    { feature: 'age', importance: 0.162, rank: 2, method: 'random_forest', keep: true },
    { feature: 'balance', importance: 0.148, rank: 3, method: 'random_forest', keep: true },
    { feature: 'num_products', importance: 0.121, rank: 4, method: 'random_forest', keep: true },
    { feature: 'income_log', importance: 0.098, rank: 5, method: 'random_forest', keep: true },
    { feature: 'tenure_months', importance: 0.089, rank: 6, method: 'random_forest', keep: true },
    { feature: 'credit_income_ratio', importance: 0.077, rank: 7, method: 'random_forest', keep: true },
    { feature: 'country_ohe_France', importance: 0.062, rank: 8, method: 'random_forest', keep: true },
    { feature: 'is_active_member', importance: 0.049, rank: 10, method: 'random_forest', keep: true },
    { feature: 'salary', importance: 0.011, rank: 16, method: 'random_forest', keep: false },
    { feature: 'estimated_salary', importance: 0.009, rank: 17, method: 'random_forest', keep: false },
  ],
}

const trainingJob = {
  job_id: 'job_001', dataset_id: 'ds_001', status: 'done',
  started_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
  estimated_completion: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
  current_trial: 42, total_trials: 50, best_score: 0.8932,
  candidates: [
    { id: 'm1', model_name: 'LightGBM', library: 'lightgbm', hyperparams: { n_estimators: 300, learning_rate: 0.05, max_depth: 6 }, cv_score: 0.8932, train_score: 0.9412, val_score: 0.8798, f1: 0.6841, auc_roc: 0.9312, train_time_s: 42.3, status: 'done', progress: 100 },
    { id: 'm2', model_name: 'XGBoost', library: 'xgboost', hyperparams: { n_estimators: 250 }, cv_score: 0.8876, train_score: 0.9321, val_score: 0.8712, f1: 0.6723, auc_roc: 0.9241, train_time_s: 58.7, status: 'done', progress: 100 },
    { id: 'm3', model_name: 'Random Forest', library: 'sklearn', hyperparams: { n_estimators: 200 }, cv_score: 0.8743, train_score: 0.9654, val_score: 0.8601, f1: 0.6512, auc_roc: 0.9098, train_time_s: 35.2, status: 'done', progress: 100 },
    { id: 'm4', model_name: 'Logistic Regression', library: 'sklearn', hyperparams: { C: 0.1 }, cv_score: 0.8234, train_score: 0.8312, val_score: 0.8198, f1: 0.5821, auc_roc: 0.8634, train_time_s: 3.1, status: 'done', progress: 100 },
    { id: 'm5', model_name: 'Neural Network', library: 'pytorch', hyperparams: { hidden_layers: [256, 128, 64] }, cv_score: 0.8612, train_score: 0.9123, val_score: 0.8478, f1: 0.6234, auc_roc: 0.8987, train_time_s: 124.8, status: 'done', progress: 100 },
    { id: 'm6', model_name: 'CatBoost', library: 'catboost', hyperparams: { iterations: 300 }, cv_score: 0.8901, train_score: 0.9398, val_score: 0.8756, f1: 0.6789, auc_roc: 0.9278, train_time_s: 61.4, status: 'running', progress: 72 },
  ],
}

const evaluationReport = {
  dataset_id: 'ds_001', champion_model_id: 'm1',
  leaderboard: [
    { rank: 1, model_id: 'm1', model_name: 'LightGBM', cv_score: 0.8932, train_score: 0.9412, f1: 0.6841, auc_roc: 0.9312, train_time_s: 42.3, status: 'champion' },
    { rank: 2, model_id: 'm6', model_name: 'CatBoost', cv_score: 0.8901, train_score: 0.9398, f1: 0.6789, auc_roc: 0.9278, train_time_s: 61.4, status: 'challenger' },
    { rank: 3, model_id: 'm2', model_name: 'XGBoost', cv_score: 0.8876, train_score: 0.9321, f1: 0.6723, auc_roc: 0.9241, train_time_s: 58.7, status: 'challenger' },
    { rank: 4, model_id: 'm3', model_name: 'Random Forest', cv_score: 0.8743, train_score: 0.9654, f1: 0.6512, auc_roc: 0.9098, train_time_s: 35.2, status: 'challenger' },
    { rank: 5, model_id: 'm5', model_name: 'Neural Network', cv_score: 0.8612, train_score: 0.9123, f1: 0.6234, auc_roc: 0.8987, train_time_s: 124.8, status: 'challenger' },
  ],
  confusion_matrix: { labels: ['Not Churned', 'Churned'], values: [[9289, 211], [341, 659]] },
  roc_curve: Array.from({ length: 50 }, (_, i) => ({ fpr: i / 49, tpr: Math.min(1, (i / 49) ** 0.35 + Math.random() * 0.02) })),
  feature_importances: [
    { feature: 'credit_score_scaled', importance: 0.187, rank: 1, method: 'random_forest', keep: true },
    { feature: 'age', importance: 0.162, rank: 2, method: 'random_forest', keep: true },
    { feature: 'balance', importance: 0.148, rank: 3, method: 'random_forest', keep: true },
    { feature: 'num_products', importance: 0.121, rank: 4, method: 'random_forest', keep: true },
    { feature: 'income_log', importance: 0.098, rank: 5, method: 'random_forest', keep: true },
  ],
}

const features = ['credit_score', 'age', 'balance', 'num_products', 'income', 'tenure_months', 'is_active_member']
const shapExplanation = {
  model_id: 'm1', base_value: -1.3862, prediction: 0.0821,
  global_shap: features.map((f, i) => ({
    feature: f,
    mean_abs_shap: Number((0.4 - i * 0.05).toFixed(3)),
    values: Array.from({ length: 50 }, () => Number(((Math.random() - 0.5) * (0.4 - i * 0.05)).toFixed(4))),
  })),
  local_shap: [
    { feature: 'credit_score', shap_value: -0.342, feature_value: 480, normalized_value: 0.18 },
    { feature: 'num_products', shap_value: 0.281, feature_value: 4, normalized_value: 1.0 },
    { feature: 'balance', shap_value: 0.198, feature_value: 142300, normalized_value: 0.72 },
    { feature: 'age', shap_value: -0.154, feature_value: 62, normalized_value: 0.81 },
    { feature: 'is_active_member', shap_value: 0.132, feature_value: 0, normalized_value: 0.0 },
  ],
}

const counterfactual = {
  original_prediction: 0.821, cf_prediction: 0.178, original_class: 'Churned', cf_class: 'Not Churned', distance: 1.24,
  features: [
    { feature: 'credit_score', original_value: 480, cf_value: 650, min: 300, max: 850, step: 10 },
    { feature: 'num_products', original_value: 4, cf_value: 2, min: 1, max: 4, step: 1 },
    { feature: 'balance', original_value: 142300, cf_value: 50000, min: 0, max: 250000, step: 1000 },
    { feature: 'is_active_member', original_value: 0, cf_value: 1, min: 0, max: 1, step: 1 },
  ],
}

const now = Date.now()
const monitoringData = {
  deployment_id: 'dep_001', timestamp: new Date().toISOString(),
  p50_latency_ms: 24, p95_latency_ms: 87, p99_latency_ms: 142,
  requests_per_min: 324, error_rate: 0.002,
  drift_metrics: [
    { feature: 'credit_score', psi: 0.08, ks_statistic: 0.12, status: 'stable' },
    { feature: 'income', psi: 0.21, ks_statistic: 0.31, status: 'warning' },
    { feature: 'balance', psi: 0.45, ks_statistic: 0.52, status: 'drift' },
  ],
  prediction_volume: Array.from({ length: 24 }, (_, i) => ({
    timestamp: new Date(now - (23 - i) * 3600 * 1000).toISOString(),
    count: Math.floor(280 + Math.random() * 100),
  })),
}

const chatResponses: Record<string, string> = {
  default: "I'm your AutoML assistant. I can help you understand your model, interpret predictions, and suggest next steps.",
  imbalance: "The class imbalance (95/5) is severe. SMOTE oversampling is recommended — after applying it your minority class will be ~23%, significantly improving recall for churned customers.",
  predictions: "LightGBM uses credit_score, age, and balance as top predictors. Low credit scores (<500) strongly increase churn probability, while long tenure and high balance reduce churn risk.",
  next: "Recommended next steps: 1) Apply cleaning plan (handle 38% missing credit_score), 2) Configure SMOTE sampling, 3) Build feature interactions, 4) Launch AutoML training.",
}

// ─── Route table ──────────────────────────────────────────────────────────────

type Handler = (req: IncomingMessage, body: unknown) => Promise<unknown> | unknown

const routes: Array<{ method: string; pattern: RegExp; handler: Handler }> = [
  { method: 'GET', pattern: /^\/api\/datasets$/, handler: () => ({ datasets }) },
  { method: 'POST', pattern: /^\/api\/upload$/, handler: async () => { await delay(1500); return { id: `ds_${Date.now()}`, name: 'uploaded.csv', status: 'ready' } } },

  { method: 'GET', pattern: /^\/api\/pii$/, handler: () => piiReport },
  { method: 'POST', pattern: /^\/api\/pii\/apply$/, handler: async () => { await delay(800); return { status: 'applied', masked_columns: 3 } } },

  { method: 'GET', pattern: /^\/api\/profile$/, handler: () => profileData },

  { method: 'GET', pattern: /^\/api\/eda$/, handler: () => edaReport },
  { method: 'GET', pattern: /^\/api\/eda\/issues$/, handler: () => ({ dataset_id: 'ds_001', issues: edaReport.issues }) },

  { method: 'GET', pattern: /^\/api\/cleaning$/, handler: () => cleaningPlan },
  { method: 'POST', pattern: /^\/api\/cleaning\/apply$/, handler: async () => { await delay(2000); return { status: 'applied', rows_after: 49866, cols_after: 21 } } },

  { method: 'GET', pattern: /^\/api\/sampling$/, handler: () => samplingData },
  { method: 'POST', pattern: /^\/api\/sampling\/apply$/, handler: async () => { await delay(1500); return { status: 'applied', rows_before: 50000, rows_after: 61500 } } },

  { method: 'GET', pattern: /^\/api\/features$/, handler: () => featuresData },
  { method: 'POST', pattern: /^\/api\/features\/apply$/, handler: async () => { await delay(1000); return { status: 'applied', features_out: 34 } } },

  { method: 'GET', pattern: /^\/api\/selection$/, handler: () => selectionReport },
  { method: 'POST', pattern: /^\/api\/selection\/apply$/, handler: async () => { await delay(1000); return { status: 'applied', selected_features: 15 } } },

  { method: 'GET', pattern: /^\/api\/training$/, handler: () => trainingJob },
  { method: 'GET', pattern: /^\/api\/training\/progress$/, handler: () => ({ job_id: 'job_001', elapsed_s: 480, remaining_s: 120, candidates: trainingJob.candidates }) },
  { method: 'POST', pattern: /^\/api\/training\/launch$/, handler: async () => { await delay(500); return { job_id: 'job_002', status: 'running' } } },

  { method: 'GET', pattern: /^\/api\/evaluation$/, handler: () => evaluationReport },
  { method: 'POST', pattern: /^\/api\/evaluation\/promote$/, handler: async () => { await delay(800); return { status: 'promoted', deployment_id: 'dep_001' } } },

  { method: 'GET', pattern: /^\/api\/explain\/shap$/, handler: () => shapExplanation },
  { method: 'GET', pattern: /^\/api\/explain\/counterfactual$/, handler: () => counterfactual },

  { method: 'GET', pattern: /^\/api\/deploy\/monitoring$/, handler: () => monitoringData },
  { method: 'POST', pattern: /^\/api\/deploy$/, handler: async () => { await delay(2000); return { deployment_id: 'dep_001', endpoint_url: 'http://localhost:8000/v1/predict', status: 'active' } } },

  {
    method: 'POST', pattern: /^\/api\/chat$/, handler: async (req) => {
      const body = await readJson(req) as { message?: string }
      const msg = (body?.message ?? '').toLowerCase()
      let reply = chatResponses.default
      if (msg.includes('imbalance') || msg.includes('smote')) reply = chatResponses.imbalance
      else if (msg.includes('predict') || msg.includes('explain')) reply = chatResponses.predictions
      else if (msg.includes('next') || msg.includes('recommend')) reply = chatResponses.next
      await delay(800)
      return { role: 'assistant', content: reply, id: Date.now().toString(), timestamp: new Date().toISOString() }
    },
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => { data += chunk })
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, body: unknown, status = 200) {
  const json = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(json)
}

// ─── Vite plugin ─────────────────────────────────────────────────────────────

export default function mockApiPlugin(): Plugin {
  return {
    name: 'vite-mock-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0] ?? ''
        if (!url.startsWith('/api/')) { next(); return }

        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' })
          res.end(); return
        }

        const route = routes.find(r => r.method === req.method && r.pattern.test(url))
        if (!route) { sendJson(res, { error: 'Not found' }, 404); return }

        try {
          const result = await route.handler(req, null)
          sendJson(res, result)
        } catch (err) {
          console.error('[mock-api] Error handling', url, err)
          sendJson(res, { error: 'Internal error' }, 500)
        }
      })
    },
  }
}
