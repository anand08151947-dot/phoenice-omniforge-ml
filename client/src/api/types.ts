// ============================================================
// Phoenice OmniForge ML – TypeScript API type definitions
// ============================================================

// ── Dataset ──────────────────────────────────────────────────
export interface Dataset {
  id: string
  name: string
  file_size: number
  row_count: number
  col_count: number
  created_at: string
  status: 'ready' | 'processing' | 'error'
  target_column?: string
  task_type?: 'classification' | 'regression' | 'clustering' | 'anomaly_detection' | 'forecasting'
}

export interface ColumnProfile {
  name: string
  dtype: string
  inferred_type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'boolean'
  missing_pct: number
  unique_count: number
  mean?: number
  std?: number
  min?: number
  max?: number
  skewness?: number
  kurtosis?: number
  top_values?: Array<{ value: string | number; count: number }>
  histogram?: Array<{ bin: string; count: number }>
  is_target?: boolean
  warnings?: string[]
}

export interface DatasetProfile {
  dataset_id: string
  row_count: number
  col_count: number
  duplicate_rows: number
  missing_cells: number
  missing_pct: number
  memory_usage_mb: number
  columns: ColumnProfile[]
  generated_at: string
}

// ── EDA ──────────────────────────────────────────────────────
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low'
export type IssueType =
  | 'class_imbalance'
  | 'missing_values'
  | 'leakage'
  | 'correlation'
  | 'outliers'
  | 'low_variance'
  | 'duplicates'
  | 'data_drift'

export interface EDAIssue {
  id: string
  severity: IssueSeverity
  type: IssueType
  title: string
  detail: string
  phase: string
  metric: number
  affected_columns?: string[]
}

export interface MissingnessReport {
  column: string
  missing_count: number
  missing_pct: number
  pattern: 'MCAR' | 'MAR' | 'MNAR' | 'unknown'
}

export interface CorrelationMatrix {
  columns: string[]
  values: number[][]
}

export interface EDAReport {
  dataset_id: string
  issues: EDAIssue[]
  missingness: MissingnessReport[]
  correlation_matrix: CorrelationMatrix
  target_distribution: Array<{ label: string; count: number }>
  mi_scores: Array<{ feature: string; score: number }>
  feature_overrides?: Record<string, 'auto' | 'include' | 'exclude'>
}

// ── PII ──────────────────────────────────────────────────────
export type PIISensitivity = 'high' | 'medium' | 'low'
export type PIIEntityType =
  | 'EMAIL'
  | 'PHONE'
  | 'SSN'
  | 'CREDIT_CARD'
  | 'NAME'
  | 'ADDRESS'
  | 'DATE_OF_BIRTH'
  | 'IP_ADDRESS'
  | 'IBAN'

export interface PIIColumn {
  column: string
  entity_type: PIIEntityType
  sensitivity: PIISensitivity
  sample_values: string[]
  match_count: number
  match_pct: number
  recommended_action: 'mask' | 'hash' | 'drop' | 'pseudonymize' | 'encrypt'
  status: 'pending' | 'masked' | 'dropped' | 'approved'
}

export interface PIIReport {
  dataset_id: string
  scanned_at: string
  total_columns: number
  pii_columns: PIIColumn[]
  risk_score: number
}

// ── Cleaning ─────────────────────────────────────────────────
export type CleaningStrategy =
  | 'mean_impute'
  | 'median_impute'
  | 'mode_impute'
  | 'drop_rows'
  | 'drop_column'
  | 'constant_fill'
  | 'knn_impute'
  | 'forward_fill'
  | 'backward_fill'
  | 'clip_outliers'
  | 'remove_outliers'
  | 'none'

export interface CleaningAction {
  id: string
  column: string
  issue_type: string
  issue_detail: string
  severity: IssueSeverity
  strategy: CleaningStrategy
  affected_rows: number
  estimated_impact: string
}

export interface CleaningPlan {
  dataset_id: string
  actions: CleaningAction[]
  estimated_rows_affected: number
  estimated_cols_removed: number
  audit?: {
    original_rows: number
    original_cols: number
    cleaned_rows: number
    cleaned_cols: number
    rows_removed: number
    cols_removed: number
    cleaned_path: string
    applied_strategies: Record<string, string>
    applied_at: string
  }
}

// ── Sampling ─────────────────────────────────────────────────
export interface ClassDistribution {
  label: string
  count: number
  pct: number
}

export interface ImbalanceReport {
  dataset_id: string
  target_column: string
  class_distribution: ClassDistribution[]
  imbalance_ratio: number
  recommended_strategy: string
}

export type SamplingStrategy =
  | 'none'
  | 'oversample_smote'
  | 'oversample_random'
  | 'undersample_random'
  | 'class_weights'
  | 'stratified_split'

export interface SamplingConfig {
  strategy: SamplingStrategy
  target_ratio?: number
  random_seed: number
  test_size: number
  val_size: number
}

// ── Features ─────────────────────────────────────────────────
export type TransformType =
  | 'log'
  | 'sqrt'
  | 'standard_scale'
  | 'min_max_scale'
  | 'one_hot_encode'
  | 'label_encode'
  | 'target_encode'
  | 'bin'
  | 'polynomial'
  | 'interaction'
  | 'date_parts'
  | 'tfidf'
  | 'embedding'
  | 'none'

export interface FeatureSpec {
  id: string
  source_columns: string[]
  output_name: string
  transform: TransformType
  params?: Record<string, unknown>
  dtype_in: string
  dtype_out: string
  enabled: boolean
}

export interface FeatureEngineeringPlan {
  dataset_id: string
  specs: FeatureSpec[]
  total_features_in: number
  total_features_out: number
  audit?: {
    original_cols: number
    output_cols: number
    output_rows: number
    feature_path: string
    applied_at: string
  }
}

// ── Feature Selection ─────────────────────────────────────────
export interface FeatureImportance {
  feature: string
  importance: number
  rank: number
  method: 'random_forest' | 'mutual_info' | 'permutation' | 'shap' | 'pearson_abs'
  keep: boolean
}

export interface FeatureSelectionReport {
  dataset_id: string
  importances: FeatureImportance[]
  selected_count: number
  dropped_count: number
  method: string
  audit?: {
    applied_at: string
    selected_count: number
    dropped_count: number
    total_count: number
    kept_features: string[]
    dropped_features: string[]
    pinned_count: number
    excluded_count: number
    auto_count: number
    method: string
  }
}

// ── Training ─────────────────────────────────────────────────
export type ModelStatus = 'pending' | 'running' | 'done' | 'failed' | 'pruned'

export interface FoldScore {
  fold: number
  cv_score: number
  train_score: number
  gap: number
}

export interface PerClassMetric {
  class: string
  precision: number
  recall: number
  f1: number
  support: number
}

export interface ThresholdPoint {
  threshold: number
  precision: number
  recall: number
  f1: number
  fpr: number
  tp: number
  fp: number
  fn: number
  tn: number
}

export interface ConfusionMatrixData {
  labels: string[]
  values: number[][]
  values_pct: number[][]
}

export interface ROCPoint {
  fpr: number
  tpr: number
}

export interface PRPoint {
  recall: number
  precision: number
}

export interface FeatureImportanceItem {
  feature: string
  importance: number
}

export interface LearningCurvePoint {
  training_size: number
  training_fraction: number
  train_score: number
  val_score: number
  gap: number
}

export interface ModelComplexity {
  n_estimators?: number
  max_depth?: number
  model_size_kb?: number
  inference_ms_per_row?: number
  batch_throughput_per_sec?: number
}

export interface ModelCandidate {
  id: string
  model_name: string
  library: string
  hyperparams: Record<string, unknown>
  cv_score: number
  cv_std?: number
  cv_min?: number
  cv_max?: number
  train_score: number
  val_score: number
  f1: number
  auc_roc: number
  rmse?: number
  train_time_s: number
  status: ModelStatus
  progress: number
  n_features?: number
  fold_scores?: FoldScore[]
  per_class_metrics?: PerClassMetric[]
  threshold_analysis?: ThresholdPoint[]
  confusion_matrix_data?: ConfusionMatrixData
  roc_curve_data?: ROCPoint[]
  pr_curve_data?: PRPoint[]
  feature_importances?: FeatureImportanceItem[]
  complexity?: ModelComplexity
  learning_curve?: LearningCurvePoint[]
  strengths?: string[]
  weaknesses?: string[]
  error?: string
}

export interface TrainingJob {
  job_id: string
  dataset_id: string
  status: 'pending' | 'running' | 'done' | 'failed'
  started_at: string
  estimated_completion?: string
  candidates: ModelCandidate[]
  current_trial: number
  total_trials: number
  best_score: number
}

export interface TrainingProgress {
  job_id: string
  elapsed_s: number
  remaining_s: number
  candidates: ModelCandidate[]
}

// ── Evaluation ────────────────────────────────────────────────
export type EvalStatus = 'champion' | 'challenger' | 'dropped'

export interface LeaderboardEntry {
  rank: number
  model_id: string
  model_name: string
  cv_score: number
  train_score: number
  f1: number
  auc_roc: number
  rmse?: number
  train_time_s: number
  status: EvalStatus
}

export interface ConfusionMatrix {
  labels: string[]
  values: number[][]
}

export interface ROCPoint {
  fpr: number
  tpr: number
}

export interface EvaluationReport {
  dataset_id: string
  champion_model_id: string
  leaderboard: LeaderboardEntry[]
  confusion_matrix: ConfusionMatrix
  roc_curve: ROCPoint[]
  feature_importances: FeatureImportance[]
}

// ── Explain ──────────────────────────────────────────────────
export interface SHAPValue {
  feature: string
  shap_value: number
  feature_value: number
  normalized_value: number
}

export interface SHAPExplanation {
  model_id: string
  global_shap: Array<{ feature: string; mean_abs_shap: number; values: number[] }>
  local_shap: SHAPValue[]
  base_value: number
  prediction: number
}

export interface CounterfactualFeature {
  feature: string
  original_value: number
  cf_value: number
  min: number
  max: number
  step: number
}

export interface CounterfactualResult {
  original_prediction: number
  cf_prediction: number
  original_class: string
  cf_class: string
  features: CounterfactualFeature[]
  distance: number
}

// ── Deploy ───────────────────────────────────────────────────
export type DeployTarget = 'rest_api' | 'batch' | 'edge' | 'streaming'

export interface DeploymentConfig {
  model_id: string
  endpoint_name: string
  target: DeployTarget
  replicas: number
  max_latency_ms: number
  enable_monitoring: boolean
  enable_logging: boolean
}

export interface DriftMetric {
  feature: string
  psi: number
  ks_statistic: number
  status: 'stable' | 'warning' | 'drift'
}

export interface MonitoringMetrics {
  deployment_id: string
  timestamp: string
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  requests_per_min: number
  error_rate: number
  drift_metrics: DriftMetric[]
  prediction_volume: Array<{ timestamp: string; count: number }>
}

// ── Chat ─────────────────────────────────────────────────────
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  sources?: string[]
  isStreaming?: boolean
}
