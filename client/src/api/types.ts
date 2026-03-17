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
  n_parameters?: number
  model_type?: string
  eval_error?: string
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
  optuna_best_score?: number
  optuna_n_trials?: number
  optuna_best_params?: Record<string, unknown>
  // Clustering-specific
  n_clusters?: number
  silhouette_score?: number
  inertia?: number | null
  n_noise_points?: number
  eps_auto?: number
  // Anomaly detection-specific
  n_anomalies?: number
  detected_contamination?: number
  configured_contamination?: number
  anomaly_score_percentiles?: Record<string, number>
  precision?: number
  recall?: number
}

export interface TrainingResults {
  dataset_id: string
  candidates: ModelCandidate[]
  best_model?: string
  best_cv_score?: number
}

export interface HyperparamDef {
  name: string
  type: 'int' | 'float' | 'choice'
  min?: number
  max?: number
  step?: number
  default?: number | string
  choices?: string[]
  nullable?: boolean
}

export interface HyperparamSpaceResponse {
  model_name: string
  space: HyperparamDef[]
  fix_overfit_params: Record<string, unknown>
}

export interface RetrainSingleRequest {
  dataset_id: string
  model_id: string
  model_name: string
  hyperparams: Record<string, unknown>
}

export interface AutotuneRequest {
  dataset_id: string
  model_id: string
  model_name: string
  n_trials: number
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

// ── Smart Profile ─────────────────────────────────────────────
export interface SmartOverview {
  row_count: number
  col_count: number
  memory_mb: number
  duplicate_rows: number
  duplicate_pct: number
  missing_cells: number
  missing_pct: number
}

export interface ColumnTypeSummary {
  numeric: number
  categorical: number
  datetime: number
  text: number
  boolean: number
  high_cardinality: string[]
  constant_columns: string[]
}

export interface TargetCandidate {
  name: string
  score: number
  inferred_task: string
  reasons: string[]
  warnings: string[]
  is_recommended: boolean
}

export interface TaskRecommendation {
  task: string
  confidence: number
  why: string[]
  alternatives: string[]
}

export interface ClassDist {
  label: string
  count: number
  pct: number
}

export interface TargetDistribution {
  type: 'classification' | 'regression'
  // classification
  classes?: ClassDist[]
  imbalance?: string
  minority_pct?: number
  unique_count?: number
  // regression
  mean?: number
  std?: number
  min?: number
  max?: number
  skewness?: number
  outliers_likely?: boolean
  outlier_count?: number
  histogram?: Array<{ bin: string; count: number }>
  missing_pct: number
}

export interface ImbalanceSeverity {
  severity: string
  minority_pct?: number
  techniques: string[]
  recommended_metric?: string
  metric_reason?: string
}

export interface TimeAwareness {
  has_datetime: boolean
  datetime_columns: string[]
  options?: Array<{ id: string; label: string }>
  recommended?: string
}

export interface DataQualityWarning {
  type: string
  severity: 'high' | 'medium' | 'low'
  message: string
  column?: string
  correlation?: number
}

export interface FeaturePreviewItem {
  name: string
  type: string
  missing_pct: number
  unique_count: number
  is_constant: boolean
  is_id_like: boolean
  is_datetime: boolean
  min?: number
  max?: number
  skewed?: boolean
  outliers_likely?: boolean
  outlier_pct_est?: number
  suggested_transform?: string | null
  top_values?: string[]
  cardinality_health?: 'ok' | 'review' | 'problematic' | 'drop'
  suggested_encoding?: string
  rare_category_pct?: number
}

export interface FeatureQualityScore {
  score: number
  grade: 'Good' | 'Review' | 'Problematic'
  issues: string[]
}

export interface ComplexityIndicators {
  feature_count: number
  row_count: number
  feature_row_ratio: number
  sample_sufficiency: string
  warnings: string[]
  suggestions: string[]
}

export interface DataTypeIssue {
  column: string
  issue: string
  severity: 'low' | 'medium' | 'high'
  message: string
}

export interface TopFeature {
  feature: string
  correlation: number
}

export interface ProblemDifficulty {
  level: 'Easy' | 'Medium' | 'Hard'
  score: number
  baseline_accuracy: number
  reasons: string[]
}

export interface SmartProfile {
  overview: SmartOverview
  column_type_summary: ColumnTypeSummary
  target_candidates: TargetCandidate[]
  recommended_target: string | null
  task_recommendation: TaskRecommendation | null
  resolved_task: string
  target_distribution: TargetDistribution | null
  imbalance_severity: ImbalanceSeverity
  time_awareness: TimeAwareness
  data_quality_warnings: DataQualityWarning[]
  feature_preview: FeaturePreviewItem[]
  top_features: TopFeature[]
  problem_difficulty: ProblemDifficulty
  feature_quality_scores: Record<string, FeatureQualityScore>
  complexity_indicators: ComplexityIndicators
  data_type_issues: DataTypeIssue[]
}


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

export interface CalibrationPoint {
  mean_predicted: number
  fraction_positive: number
}

export interface PredictionBin {
  bin: number
  count_positive: number
  count_negative: number
}

export interface McNemarResult {
  statistic: number
  p_value: number
  significant: boolean
  ab: number
  ba: number
  champion: string
  challenger: string
}

export interface EvaluationReport {
  dataset_id: string
  champion_model_id: string
  champion_model_name?: string
  task_type?: string
  target_column?: string
  n_features?: number
  n_classes?: number | null
  sampling_strategy?: string
  leaderboard: LeaderboardEntry[]
  confusion_matrix: ConfusionMatrix
  roc_curve: ROCPoint[]
  pr_curve?: PRPoint[]
  per_class_metrics?: PerClassMetric[]
  threshold_analysis?: ThresholdPoint[]
  optimal_threshold?: number
  prediction_distribution?: PredictionBin[]
  calibration_data?: CalibrationPoint[]
  learning_curve?: LearningCurvePoint[]
  model_complexity?: ModelComplexity
  mcnemar?: McNemarResult
  feature_importances: FeatureImportance[]
  overfit_warnings?: string[]
  evaluated_at?: string
  stale?: boolean
  eval_error?: string
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
