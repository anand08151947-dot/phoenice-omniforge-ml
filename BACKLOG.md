# Phoenice OmniForge ML — Product Backlog (Ordered)

> **Vision:** `Data → Automated Understanding → Automated Preparation → Automated Modeling → Output`
>
> Build a highly trained data scientist assistant that inspects your data, cleans it, engineers features,
> tries many models, chooses the best, explains the results, and deploys — all with minimal human effort,
> augmented by a local LLM (LM Studio) for semantic intelligence.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented / Exists |
| 🚧 | Partially implemented |
| 🔲 | Not yet started |
| 🤖 | Requires LM Studio / AI layer |
| ⚡ | High priority |
| 🎯 | MVP critical |
| 🆕 | New phase (added from backlog notes) |

---

## Dependency Map

Each phase must be **fully shippable** before phases that depend on it are started. Starting a dependent phase before its prerequisites are stable causes drift — features built on incomplete foundations require rework.

```
Phase 0 — Foundation
    └─► Phase 1 — Dataset Profiling
            └─► Phase 2 — EDA
                    └─► Phase 3 — Data Cleaning
                            └─► Phase 4 — Imbalanced Data & Sampling  [NEW]
                                    └─► Phase 5 — Feature Engineering
                                            └─► Phase 6 — Feature Selection
                                                    └─► Phase 7 — AutoML Training
                                                            ├─► Phase 8 — Overfitting & Robustness
                                                            └─► Phase 9 — Evaluation & Leaderboard
                                                                    ├─► Phase 10 — XAI & Interpretability  [NEW]
                                                                    ├─► Phase 11 — Deployment & MLOps
                                                                    │       ├─► Phase 12 — Active Learning  [NEW]
                                                                    │       └─► Phase 13 — Pipeline Orchestration  [NEW]
                                                                    └─► Phase 14 — AI Intelligence Layer (LM Studio)
                                                                            └─► Phase 15 — Conversational Interface

Cross-cutting (can progress in parallel after Phase 0):
    Phase 0 ──► Phase A — PII Detection & Privacy  [NEW]  (gates Phase 1 in production use)
    Phase 0 ──► Phase 16 — Advanced Data Sources
    Phase 9 ──► Phase 17 — Collaboration & Multi-User  [NEW]
    Phase 11 ─► Phase 18 — Developer Experience & Ecosystem
```

---

## Phase Sequence & Rationale

| # | Phase | Depends On | Blocks |
|---|-------|-----------|--------|
| 0 | Foundation & Infrastructure ✅ | — | All phases |
| A | PII Detection & Data Privacy 🆕 | 0 | Should gate Phase 1 in production; can parallel-track |
| 1 | Deep Dataset Profiling | 0 | 2, 3, 4, 5 |
| 2 | Exploratory Data Analysis (EDA) | 1 | 3, 4, 5, 6 |
| 3 | Automated Data Cleaning | 1, 2 | 4, 5, 6, 7 |
| 4 | Imbalanced Data & Sampling 🆕 | 2, 3 | 7 |
| 5 | Feature Engineering | 1, 3 | 6, 7 |
| 6 | Feature Selection & Dim. Reduction | 2, 5 | 7 |
| 7 | AutoML Training | 3, 4, 5, 6 | 8, 9 |
| 8 | Overfitting Detection & Robustness | 7 | 9 |
| 9 | Evaluation, Leaderboard & Model Selection | 7, 8 | 10, 11, 14 |
| 10 | XAI & Interpretability (Extended) 🆕 | 9 | 14, 15 |
| 11 | Deployment, Serving & MLOps | 9 | 12, 13, 18 |
| 12 | Active Learning & Human-in-the-Loop 🆕 | 11 | — |
| 13 | Pipeline Orchestration & Scheduled Retraining 🆕 | 11 | — |
| 14 | AI Intelligence Layer (LM Studio) | 9, 10 | 15 |
| 15 | Conversational Interface | 14 | — |
| 16 | Advanced Data Sources & Connectors | 0 | (parallel track) |
| 17 | Collaboration & Multi-User 🆕 | 9 | — |
| 18 | Developer Experience & Ecosystem | 11 | — |

> **Key insight:** Phases 14–15 (AI/LLM layer) depend on a stable evaluation result (Phase 9) to provide
> meaningful explanations and model reasoning. Bootstrapping LM Studio early (Phase A) is fine for the
> integration module, but AI-augmented intelligence features should not be merged into core phases until
> the rule-based baseline of each phase is working correctly.

---

## Phase 0 — Foundation & Infrastructure ✅ (Complete — Baseline)

> Core scaffolding already in place. All subsequent phases build on this.

**Depends on:** Nothing  
**Blocks:** Every other phase

### Backend
- ✅ FastAPI application (`api/main.py`) with REST endpoints
- ✅ SQLite metadata store (`api/db.py`)
- ✅ Basic CSV ingestion (`POST /upload-csv`)
- ✅ Task auto-detection: classification vs regression
- ✅ scikit-learn pipeline with imputation, scaling, encoding
- ✅ Random Forest, Gradient Boosting, MLP support
- ✅ Hyperparameter sweep (grid search)
- ✅ Optuna integration (`api/optuna_jobs.py`)
- ✅ Model export to `.pkl` with schema metadata
- ✅ `POST /predict`, `POST /predict-csv` endpoints
- ✅ SHAP / LIME explainability (`api/explain_utils.py`)
- ✅ Model registry & versioning (`api/models_router.py`)
- ✅ Experiment & run tracking
- ✅ Docker support (`Dockerfile`)
- ✅ Job ID-based async training (`api/models_router_jobid.py`)

### Frontend
- ✅ React + Vite + TypeScript client (`client/`)
- ✅ MUI component library integration
- ✅ Data upload, profiling, feature ops pages
- ✅ Model training & monitoring UI
- ✅ Predict form, batch predict, SHAP visualization
- ✅ Experiment manager, run viewer, model comparison dashboard
- ✅ Governance & promotions panel

### Tooling
- ✅ CLI (`cli.py`) with train / predict / export / serve / setup
- ✅ pytest test suite (`tests/`, `api/tests/`)
- ✅ E2E test plan (`E2E_TEST_PLAN.md`)
- ✅ GitHub Actions CI (`.github/`)

---

## Phase A — PII Detection & Data Privacy 🆕

> **Why here:** Any arbitrary CSV ingested by the platform may contain personal data. PII must be
> identified before profiling, EDA, or sharing results — otherwise sensitive data leaks into reports,
> logs, and exports. This is a regulatory requirement (GDPR, HIPAA).

**Depends on:** Phase 0  
**Blocks:** Should gate Phase 1 in regulated environments; can parallel-track for internal dev use

### A.1 PII Column Detection
- 🔲 **Pattern-based PII scanner** — detect email, phone, SSN, credit card, IP address, date-of-birth formats
- 🔲 **Name column detection** — heuristic + LM Studio semantic check for name-like columns
- 🔲 **PII risk classification** — High (SSN, CC) / Medium (email, phone) / Low (first name only)
- 🔲 **PII scan API** — `POST /pii/scan?dataset_id=` returns per-column PII risk report
- 🔲 **PII flag in dataset metadata** — columns tagged; downstream steps warned

### A.2 Anonymization & Masking
- 🔲 **Hashing** — SHA-256 hash of identifier columns
- 🔲 **Redaction** — replace sensitive values with `[REDACTED]`
- 🔲 **Generalization** — replace exact age with age band; replace postcode with region
- 🔲 **Pseudonymization** — consistent token replacement (same entity gets same token)
- 🔲 **Masking UI** — per-column anonymization action before profiling proceeds

### A.3 Synthetic Data Generation
- 🔲 **CTGAN integration** — GAN-based tabular synthetic data generation
- 🔲 **TVAE integration** — VAE-based alternative for small datasets
- 🔲 **SDV (Synthetic Data Vault)** — relational table synthesis
- 🔲 **Fidelity metrics** — statistical similarity score between real and synthetic distributions
- 🔲 **Privacy metrics** — membership inference risk, attribute disclosure risk
- 🔲 **Synthetic data export** — download privacy-safe dataset for sharing / testing

### A.4 Compliance Flags
- 🔲 **Regulatory risk report** — flag which columns may trigger GDPR / HIPAA obligations
- 🤖 **AI regulatory reasoning** — LM Studio infers compliance risk from column names + sample values

---

## Phase 1 — Deep Dataset Profiling 🎯

> Goal: Before any analysis, the system *inspects* and *fully understands* the dataset structure —
> column types, statistical properties, and relationships.

**Depends on:** Phase 0  
**Blocks:** Phase 2 (EDA builds on profiling output), Phase 3 (cleaning decisions start here), Phase 5 (FE uses column type knowledge)

### 1.1 Column Type Detection ⚡
- 🚧 **Numeric column detection** — extend beyond basic dtype; detect integer IDs disguised as numeric
- 🔲 **Categorical detection** — distinguish low vs high cardinality; flag high-cardinality fields (> N unique)
- 🔲 **Text column detection** — columns with long free-text strings (avg word count > threshold)
- 🔲 **Date/time detection** — parse and classify ISO dates, Unix timestamps, relative formats
- 🔲 **Boolean detection** — columns with only 0/1, true/false, yes/no values
- 🔲 **ID column detection** — unique identifier columns (100 % unique or near-unique)
- 🔲 **Mixed-type column detection** — flag columns mixing numerics and strings

### 1.2 Statistical Properties ⚡
- 🚧 **Mean, variance, std dev** — exists in profiling; surface in structured profile report
- 🔲 **Distribution shape classification** — normal, skewed, bimodal, uniform, heavy-tailed
- 🔲 **Skewness & kurtosis scores** — computed per numeric column
- 🔲 **Outlier flagging** — Z-score based + IQR-based detection per column
- 🔲 **Missing value audit** — count, percentage, pattern (MCAR / MAR / MNAR classification)
- 🔲 **Duplicate row detection** — exact and near-duplicate (fuzzy hash) detection
- 🔲 **Constant / near-constant column detection** — columns with < 1 % variance

### 1.3 Relationship Analysis
- 🔲 **Correlation matrix** — Pearson / Spearman; visualized as heatmap in UI
- 🔲 **Feature redundancy detection** — pairs with |corr| > 0.95 flagged
- 🔲 **Target leakage risk scoring** — columns with suspiciously high target correlation
- 🔲 **Multicollinearity report** — VIF (Variance Inflation Factor) computed per feature
- 🔲 **Mutual information with target** — ranked feature relevance report

### 1.4 Profile Report Output
- 🔲 **Structured JSON profile API** — `GET /data-profile?dataset_id=` returns full structured report
- 🔲 **Profile summary card UI** — expandable column cards with mini distribution charts
- 🔲 **Profile export** — downloadable HTML / PDF profiling report
- 🔲 **Profile diff** — compare profiles between two dataset versions

---

## Phase 2 — Exploratory Data Analysis (EDA) 🎯

> Goal: Transform profiling statistics into *insight*. Surface a prioritized **"Top Issues Affecting
> Model Quality"** summary that tells the user exactly what needs attention — rather than dumping charts.
>
> **Pipeline position:** Profiling → **EDA** → Cleaning → Feature Engineering → Modeling

**Depends on:** Phase 1 (column type detection, statistical properties, correlation)  
**Blocks:** Phase 3 (EDA → Cleaning handoff), Phase 4 (imbalance detected here), Phase 5 (FE decisions driven by EDA insights), Phase 6 (feature selection uses MI and correlation from EDA)

### 2.0 Intelligent Issues Summary ⚡
- 🔲 **Top issues report** — ranked list of the most impactful data quality and modeling risks, e.g.:
  - ⚠️ Severe class imbalance (95 / 5 split on target)
  - ⚠️ 38 % missing values in `credit_score` (key predictive column)
  - ⚠️ Strong leakage candidate: `approval_date` correlates 0.97 with target
  - ⚠️ Two highly correlated features: `income` ↔ `salary` (r = 0.99)
  - ⚠️ Nonlinear relationship detected between `age` and target
- 🔲 **Issue severity scoring** — each issue scored Critical / High / Medium / Low
- 🔲 **Actionable remediation links** — each issue links directly to the relevant cleaning or FE step
- 🔲 **Issues API** — `GET /eda/issues?dataset_id=` returns structured JSON issue list
- 🤖 **AI narrative summary** — LM Studio generates a plain-English dataset health brief

### 2.1 Dataset Overview Report (Tier 1 — Data Health) ⚡
- 🔲 **Row / column count** — with memory usage estimate (MB in RAM)
- 🔲 **Data type summary** — breakdown by type: numeric, categorical, text, date, boolean, ID
- 🔲 **Missing value percentages** — per column + overall dataset missingness rate
- 🔲 **Duplicate row count** — exact duplicates flagged with percentage
- 🔲 **Target variable distribution** — class counts (classification) or histogram (regression)
- 🔲 **Class imbalance ratio** — majority / minority class ratio; flag when > 5:1
- 🔲 **Dataset usability verdict** — system emits pass / warn / fail based on size, missingness, imbalance
- 🔲 **ydata-profiling integration** — `ydata_profiling.ProfileReport` as optional deep-dive backend

### 2.2 Column-Level Statistical Report (Tier 2) ⚡
- 🔲 **Numeric column stats** — Mean, Median, Std Dev, Min, Max, Percentiles (P25, P50, P75, P95, P99)
- 🔲 **Skewness score** — per numeric column; flag |skew| > 1 for log transform recommendation
- 🔲 **Kurtosis score** — detect heavy-tailed vs platykurtic distributions
- 🔲 **Categorical frequency report** — unique count, top-5 categories, dominant %, rare categories (< 1 %)
- 🔲 **High-cardinality flag** — categorical columns where unique count > configurable threshold (default 50)
- 🔲 **Encoding recommendation** — suggest one-hot vs target vs frequency encoding by cardinality
- 🔲 **Constant column detection** — columns with zero or near-zero variance flagged for removal
- 🔲 **Column-level EDA API** — `GET /eda/columns?dataset_id=` returns per-column stats JSON

### 2.3 Missing Data Report (Tier 1 — Data Health) ⚡
- 🔲 **Per-column missingness table** — count, percentage, data type, missing pattern type
- 🔲 **MCAR / MAR / MNAR classification** — statistical test to classify missing mechanism
- 🔲 **Missingness heatmap** — visual matrix showing which rows/columns co-occur missing (UI chart)
- 🔲 **Null co-occurrence plot** — which columns tend to be missing together
- 🔲 **Missingness vs target correlation** — flag columns where being-missing predicts the target
- 🔲 **Missing data report API** — `GET /eda/missing?dataset_id=` returns structured missingness report

### 2.4 Distribution Analysis (Tier 2) ⚡
- 🔲 **Histogram per numeric column** — rendered in UI with configurable bins
- 🔲 **Density plot (KDE)** — overlaid on histogram
- 🔲 **Box plot** — per numeric column; whiskers, IQR, outlier dots
- 🔲 **Violin plot** — combined density + box; comparing distributions by class
- 🔲 **Distribution shape tag** — auto-label each column: Normal / Right-skewed / Left-skewed / Bimodal / Uniform / Heavy-tailed
- 🔲 **Normality test** — Shapiro-Wilk (small N) or D'Agostino-Pearson (large N); p-value reported

### 2.5 Correlation & Relationship Report (Tier 3) ⚡
- 🔲 **Pearson correlation matrix** — numeric features; interactive heatmap
- 🔲 **Spearman correlation matrix** — rank-based; for non-linear monotonic relationships
- 🔲 **Redundant feature pairs** — |corr| > 0.95 highlighted; system recommends removing one
- 🔲 **Multicollinearity report** — VIF per feature; flag VIF > 10
- 🔲 **Feature ↔ target scatter plots** — regression: scatter per numeric feature vs target
- 🔲 **Feature ↔ target box plots** — classification: distribution of each feature per class
- 🔲 **Mutual information scores** — MI of each feature with target; ranked importance preview
- 🔲 **Correlation API** — `GET /eda/correlations?dataset_id=`

### 2.6 Categorical Relationship Analysis (Tier 3)
- 🔲 **Crosstab tables** — categorical feature × target; percentage breakdown
- 🔲 **Stacked bar charts** — visual crosstab for categorical pairs
- 🔲 **Chi-square test** — statistical significance of categorical ↔ target association
- 🔲 **Cramér's V** — effect size for categorical correlations

### 2.7 Time-Based Analysis (Tier 3)
- 🔲 **Date column auto-detection** — identify date columns and parse correctly
- 🔲 **Record volume over time** — line chart of row counts per time period; detect data gaps
- 🔲 **Trend plots** — numeric feature means over time; detect concept drift
- 🔲 **Seasonality pattern detection** — weekly, monthly, annual cycles surfaced
- 🔲 **Data leakage timeline risk** — flag features recorded after the target event
- 🔲 **Time-series modeling recommendation** — if temporal patterns detected, suggest time-series path

### 2.8 Outlier & Anomaly Report (Tier 2)
- 🔲 **Box plot outlier visualization** — per column; dots beyond whiskers labeled
- 🔲 **Isolation Forest score** — unsupervised global outlier score per row
- 🔲 **Distance-based anomaly score** — LOF (Local Outlier Factor) per row
- 🔲 **Outlier treatment recommendation** — system suggests cap / remove / keep-as-rare per column
- 🔲 **Outlier count API** — `GET /eda/outliers?dataset_id=`

### 2.9 Duplicate & Consistency Report (Tier 1)
- 🔲 **Exact duplicate rows** — count, percentage, preview
- 🔲 **Near-duplicate detection** — fuzzy matching on string columns
- 🔲 **Conflicting records** — same key, different values
- 🔲 **Key constraint violations** — columns expected to be unique that contain duplicates

### 2.10 Target Variable Analysis (Tier 1) ⚡
- 🔲 **Classification: class distribution bar chart** — count + percentage per class
- 🔲 **Classification: imbalance ratio** — severity flag (mild / moderate / severe)
- 🔲 **Regression: target histogram + KDE** — shape, skewness, outliers in target
- 🔲 **Regression: target outlier detection** — extreme target values flagged
- 🔲 **Recommended sampling strategy** — SMOTE / class weights / undersampling suggestion based on imbalance

### 2.11 Feature Importance Preview (Pre-Model Signal)
- 🔲 **Decision tree importance** — fast single-tree feature ranking as early signal
- 🔲 **Random forest quick importance** — shallow RF (100 trees, max_depth=5)
- 🔲 **Mutual information ranking** — MI score per feature against target
- 🔲 **Importance preview chart** — ranked horizontal bar chart in UI
- 🔲 **Weak feature warnings** — features with near-zero importance flagged

### 2.12 Interaction & Nonlinear Relationship Report
- 🔲 **Pair plots** — scatter matrix for top-N numeric features (sampled for large datasets)
- 🔲 **2D interaction heatmaps** — bin Feature A × Feature B; show mean target value per cell
- 🔲 **Partial dependence plots (PDP)** — 1D PDP for top features using a baseline model
- 🔲 **Nonlinear relationship tag** — classify feature ↔ target: linear / monotonic / nonlinear / none

### 2.13 EDA Dashboard (UI) ⚡
- 🔲 **Tier 1 panel: Data Health** — size, missingness, type breakdown, duplicate count, target balance
- 🔲 **Tier 2 panel: Feature Understanding** — distributions, category stats, outlier counts, cardinality
- 🔲 **Tier 3 panel: Relationships** — correlation heatmap, feature ↔ target charts
- 🔲 **Tier 4 panel: Modeling Readiness** — leakage risks, noise indicators, feature usefulness
- 🔲 **Column drill-down** — click any column card to expand full stats + charts
- 🔲 **EDA report export** — one-click HTML / PDF report
- 🔲 **EDA → Cleaning handoff** — "Fix these issues" button triggers pre-configured cleaning pipeline
- 🔲 **EDA API endpoint** — `POST /eda/run?dataset_id=`; `GET /eda/report?dataset_id=`

---

## Phase 3 — Automated Data Cleaning 🎯

> Goal: Fix data quality issues automatically, with explanations for every action taken.
> All cleaning decisions are informed by Phase 1 (profiling) and Phase 2 (EDA issues report).

**Depends on:** Phase 1 (profiling identifies what to clean), Phase 2 (EDA issues drive cleaning config)  
**Blocks:** Phase 4 (sampling strategies need clean data), Phase 5 (feature engineering needs clean data), Phase 7 (training on dirty data produces unreliable models)

### 3.1 Missing Value Handling ⚡
- 🚧 **Mean/median imputation** — basic imputation exists; extend to strategy selection
- 🔲 **Mode imputation for categoricals** — auto-select for categorical columns
- 🔲 **Model-based imputation** — iterative imputation (sklearn IterativeImputer / MICE)
- 🔲 **KNN imputation** — for datasets with spatial structure
- 🔲 **Indicator columns** — auto-add `col_was_missing` binary flags
- 🔲 **User-controlled imputation strategies** — per-column override via API / UI

### 3.2 Outlier & Noise Detection ⚡
- 🔲 **Z-score threshold filtering** — configurable sigma; flag or cap outliers
- 🔲 **IQR-based outlier detection** — whisker-based trimming
- 🔲 **Isolation Forest integration** — unsupervised outlier detection on full feature set
- 🔲 **Robust statistics mode** — use median/MAD instead of mean/std when outliers detected
- 🔲 **Clustering-based detection** — DBSCAN to flag noise points
- 🔲 **Outlier treatment options** — remove / cap / impute / flag (user configurable)

### 3.3 Invalid Data Detection
- 🔲 **Domain constraint validation** — configurable rules (e.g. age > 0, age < 120)
- 🔲 **Impossible timestamp detection** — future dates in historical data, dates before 1900
- 🔲 **Inconsistent format detection** — mixed date formats, mixed units in same column
- 🔲 **Negative value checks** — flag negative values in columns that should be non-negative
- 🔲 **Referential consistency** — foreign key-style consistency between related columns

### 3.4 Deduplication & Normalization
- 🔲 **Exact duplicate removal** — configurable keep-first / keep-last / drop-all
- 🔲 **Near-duplicate detection** — fuzzy string matching, record linkage
- 🔲 **String normalization** — strip whitespace, lowercase, accent normalization
- 🔲 **Category standardization** — map variant spellings to canonical forms (e.g., "USA" / "US")

### 3.5 Cleaning Audit Trail
- 🔲 **Cleaning log API** — JSON log of all transformations with before/after stats
- 🔲 **Cleaning preview UI** — show before/after for each action before applying
- 🔲 **Reversible transforms** — store pre-clean snapshot; allow rollback per column

---

## Phase 4 — Imbalanced Data & Sampling Strategies 🆕 🎯

> Goal: Treat class imbalance as a dedicated pipeline step — after cleaning, before feature engineering
> and training. Imbalance affects both feature engineering choices (e.g., target encoding leakage risk)
> and model selection (SMOTE changes the effective training distribution).
>
> **Why here, not later:** SMOTE and resampling must be applied *before* training splits are finalized.
> Applying them after feature engineering risks introducing data leakage into engineered features.

**Depends on:** Phase 2 (EDA detects and quantifies imbalance), Phase 3 (clean data is required before resampling)  
**Blocks:** Phase 7 (training needs balanced or appropriately weighted data)

### 4.1 Oversampling
- 🔲 **SMOTE** — Synthetic Minority Over-sampling Technique
- 🔲 **ADASYN** — Adaptive Synthetic Sampling
- 🔲 **Borderline-SMOTE** — focuses synthesis near the decision boundary
- 🔲 **SMOTE-NC** — SMOTE for mixed numeric + categorical datasets

### 4.2 Undersampling
- 🔲 **Random undersampling** — majority class random removal
- 🔲 **Tomek Links** — remove majority samples closest to minority
- 🔲 **Cluster centroids** — replace majority clusters with centroids

### 4.3 Combination Sampling
- 🔲 **SMOTEENN** — SMOTE + Edited Nearest Neighbours
- 🔲 **SMOTETomek** — SMOTE + Tomek Links cleaning

### 4.4 Cost-Sensitive Learning
- 🔲 **Class weight injection** — auto-compute and inject `class_weight` into estimators
- 🔲 **Focal loss** — down-weight easy examples; for extreme imbalance
- 🔲 **Decision threshold optimization** — tune threshold beyond 0.5 using precision-recall curve

### 4.5 Imbalanced-Aware Metrics
- 🔲 **AUC-PR (Average Precision)** — primary metric for imbalanced datasets
- 🔲 **G-mean** — geometric mean of class-wise recall
- 🔲 **MCC (Matthews Correlation Coefficient)** — balanced metric for binary classification
- 🔲 **Imbalance strategy recommendation** — system recommends approach based on imbalance severity

---

## Phase 5 — Automated Feature Engineering 🎯

> Goal: Transform raw columns into model-ready features using semantic understanding of data types.
> Applied to *clean* data (post Phase 3); uses column type knowledge from Phase 1.

**Depends on:** Phase 1 (column type detection), Phase 3 (clean data required)  
**Blocks:** Phase 6 (feature selection operates on engineered features), Phase 7 (training needs final feature set)

### 5.1 Numeric Feature Engineering ⚡
- 🚧 **Scaling / normalization** — StandardScaler, MinMaxScaler exist; expose strategy selection
- 🔲 **Log / Box-Cox / Yeo-Johnson transforms** — auto-apply to skewed numeric columns
- 🔲 **Polynomial feature generation** — degree-2 interaction terms for top features
- 🔲 **Binning / discretization** — equal-width, equal-frequency, decision-tree-based binning
- 🔲 **Ratio features** — auto-generate ratios between correlated numeric pairs

### 5.2 Categorical Feature Engineering ⚡
- 🚧 **One-hot encoding** — exists; extend to handle high-cardinality gracefully
- 🔲 **Target encoding** — mean-encode categoricals against target with cross-fold smoothing
- 🔲 **Frequency / count encoding** — replace category with its frequency in dataset
- 🔲 **Binary encoding** — for high-cardinality columns to reduce dimensionality
- 🔲 **Ordinal encoding** — for ordered categoricals (Small < Medium < Large)
- 🔲 **Leave-one-out encoding** — regularized target encoding to prevent leakage

### 5.3 Text Column Engineering
- 🔲 **TF-IDF vectorization** — sparse feature matrix for text columns
- 🔲 **Tokenization & bag-of-words** — configurable vocabulary size, stop words
- 🔲 **Character n-gram features** — for short noisy text (codes, IDs)
- 🔲 **Text statistics features** — word count, char count, special char ratio
- 🤖 **Semantic embeddings** — LM Studio embedding model to encode text columns into dense vectors

### 5.4 Date/Time Feature Engineering
- 🔲 **Temporal decomposition** — extract Year, Month, Day, Hour, DayOfWeek, Quarter
- 🔲 **Seasonality features** — sine/cosine encoding of cyclic time features
- 🔲 **Time since event features** — days since first record, days since last event per group
- 🔲 **Holiday / business day flags** — flag weekends, public holidays (country-configurable)
- 🔲 **Lag features** — for time-series: N-step lag values per key column
- 🔲 **Rolling aggregations** — rolling mean, std, min, max over configurable windows

### 5.5 Feature Engineering Pipeline
- 🔲 **Feature engineering config** — declarative YAML / JSON spec for transforms
- 🔲 **Auto feature suggestion** — system proposes transforms; user approves / rejects
- 🔲 **Feature engineering UI** — interactive builder with live preview of transformed distribution
- 🔲 **Feature lineage tracking** — trace each engineered feature back to source column

---

## Phase 6 — Feature Selection & Dimensionality Reduction

> Goal: Reduce feature space to the most informative, non-redundant subset before training.
> Cannot proceed until features exist (Phase 5) and relationships are understood (Phase 2).

**Depends on:** Phase 2 (MI scores, correlation from EDA), Phase 5 (engineered features)  
**Blocks:** Phase 7 (AutoML training needs finalized feature set)

### 6.1 Filter Methods ⚡
- 🔲 **Variance threshold filter** — remove near-zero-variance features
- 🔲 **Mutual information ranking** — rank features by MI score with target
- 🔲 **Chi-squared test** — for classification with categorical features
- 🔲 **ANOVA F-test** — for regression feature selection
- 🔲 **Correlation deduplication** — drop one of each highly correlated pair

### 6.2 Wrapper & Embedded Methods
- 🔲 **Recursive Feature Elimination (RFE)** — with configurable estimator and step size
- 🔲 **L1 / Lasso regularization selection** — embedded selection via penalized models
- 🔲 **Tree-based importance selection** — Random Forest / GBM importance threshold
- 🔲 **Permutation importance** — model-agnostic post-hoc importance ranking
- 🔲 **Boruta algorithm** — all-relevant feature selection (shadow feature method)

### 6.3 Dimensionality Reduction
- 🔲 **PCA** — configurable variance threshold; auto-select n_components
- 🔲 **UMAP** — non-linear dimensionality reduction for visualization and preprocessing
- 🔲 **Sparse PCA** — for high-dimensional sparse feature sets
- 🔲 **Feature clustering** — group correlated features; keep one representative per cluster

### 6.4 Feature Selection UI
- 🔲 **Feature importance chart** — ranked bar chart with model-based and MI scores
- 🔲 **Feature selection report** — which features kept, which dropped, and why
- 🔲 **Manual override** — user can pin / exclude specific features

---

## Phase 7 — Automated Model Selection & Training (AutoML)

> Goal: Automatically determine problem type, select candidate models, train with cross-validation,
> and return the best performer.

**Depends on:** Phase 3 (clean data), Phase 4 (balanced data), Phase 5 (engineered features), Phase 6 (selected feature set)  
**Blocks:** Phase 8 (overfitting detection needs trained models), Phase 9 (evaluation needs trained models)

### 7.1 Problem Type Detection ⚡
- 🚧 **Classification vs regression** — exists; extend to multi-label, multi-class
- 🔲 **Forecasting detection** — time-ordered target with date index → time-series path
- 🔲 **Anomaly detection framing** — extreme class imbalance + unlabeled data → anomaly path
- 🔲 **Clustering framing** — no target column provided → unsupervised path
- 🔲 **Ranking / ordinal detection** — ordered categorical target → ranking models
- 🔲 **Survival analysis detection** — time + event columns present → survival path
- 🤖 **AI-assisted problem framing** — LM Studio infers problem type from column names + data patterns

### 7.2 Candidate Model Library ⚡
- ✅ **Linear models** — Logistic Regression, Ridge, Lasso, ElasticNet
- ✅ **Tree-based models** — Decision Tree, Random Forest, Extra Trees
- ✅ **Gradient boosting** — Gradient Boosting, XGBoost, LightGBM, CatBoost
- ✅ **Neural networks** — MLP (scikit-learn); TensorFlow / PyTorch DNNs
- 🔲 **Support Vector Machines** — SVM / SVR with kernel selection
- 🔲 **K-Nearest Neighbors** — for small datasets
- 🔲 **Bayesian models** — Naive Bayes, Gaussian Process Regression
- 🔲 **Ensemble stacking** — auto-build stacking ensemble from top-N candidates
- 🔲 **Time-series models** — ARIMA, Prophet, N-BEATS, PatchTST
- 🔲 **Survival models** — Cox PH, Weibull AFT (lifelines)

### 7.3 Hyperparameter Optimization ⚡
- ✅ **Grid search** — exhaustive search (limited scale)
- ✅ **Optuna integration** — Bayesian HPO with trial management
- 🔲 **Random search** — fast random sampling baseline
- 🔲 **Hyperband / ASHA** — early stopping of unpromising trials
- 🔲 **Population-based training (PBT)** — for neural network HPO
- 🔲 **HPO budget controls** — max trials, max time, early exit on plateau

### 7.4 Cross-Validation Strategy
- ✅ **K-fold CV** — standard k-fold
- ✅ **Stratified K-fold** — for class-imbalanced classification
- ✅ **Time-series split** — no data leakage for temporal data
- ✅ **Group K-fold** — group-aware splits
- 🔲 **Nested CV** — outer loop for evaluation, inner loop for HPO
- 🔲 **Repeated K-fold** — for small datasets with high variance
- 🔲 **Leave-one-out CV** — for very small datasets (< 100 rows)

### 7.5 Training Orchestration
- ✅ **Background job execution** — async job with polling
- ✅ **Progress streaming** — SSE / WebSocket training metrics
- 🔲 **Multi-model parallel training** — run N model candidates concurrently
- 🔲 **Checkpoint & resume** — resume failed training from last checkpoint
- 🔲 **Resource controls** — CPU / memory limits per job; GPU detection
- 🔲 **Training queue** — queued job management for multi-user scenarios

---

## Phase 8 — Overfitting Detection & Robustness

> Goal: Detect and mitigate overfitting, noise sensitivity, and poor generalization.
> Applied during and after training, before final model selection.

**Depends on:** Phase 7 (trained models required)  
**Blocks:** Phase 9 (evaluation should include robustness-checked models)

### 8.1 Overfitting Detection
- 🔲 **Train vs validation gap monitoring** — flag when train metric >> val metric
- 🔲 **Learning curve analysis** — plot train/val score vs dataset size
- 🔲 **Bias-variance decomposition** — report bias and variance components

### 8.2 Regularization Controls
- 🚧 **L1 / L2 regularization** — exists in model configs; surface controls in UI
- 🔲 **Dropout for neural networks** — configurable dropout rate per layer
- 🔲 **Early stopping** — monitor val loss; stop when no improvement for N epochs
- 🔲 **Data augmentation** — for image/text data to increase effective training set size

### 8.3 Robustness
- 🔲 **Robust loss functions** — Huber loss for regression; focal loss for imbalanced classification
- 🔲 **Noise injection training** — optional Gaussian noise augmentation for regularization
- 🔲 **Adversarial training** — perturbation-based robustness (advanced)
- 🔲 **Calibration** — Platt scaling / isotonic regression for probability calibration

---

## Phase 9 — Evaluation, Leaderboard & Model Selection

> Goal: Evaluate all trained candidates against a held-out test set, rank them, and select the champion.

**Depends on:** Phase 7 (trained models), Phase 8 (robustness-checked models)  
**Blocks:** Phase 10 (XAI needs a final model), Phase 11 (deployment needs selected model), Phase 14 (AI layer explanations need a model to explain)

### 9.1 Evaluation Metrics ⚡
- ✅ **Classification** — Accuracy, Precision, Recall, F1, AUC-ROC, AUC-PR
- ✅ **Regression** — RMSE, MAE, R², MAPE
- 🔲 **Multi-class** — macro/micro/weighted F1, Cohen's Kappa, confusion matrix
- 🔲 **Ranking** — NDCG, MAP
- 🔲 **Time-series** — SMAPE, MASE, coverage intervals
- 🔲 **Survival** — C-index, integrated Brier score
- 🔲 **Custom metric** — user-defined metric function registered at runtime

### 9.2 Leaderboard & Comparison ⚡
- 🚧 **Run comparison dashboard** — exists; enhance with side-by-side metric table
- 🔲 **AutoML leaderboard API** — `GET /automl/leaderboard?experiment_id=` returns ranked models
- 🔲 **Leaderboard UI** — sortable, filterable table of all trained candidates with metrics
- 🔲 **Statistical significance testing** — Wilcoxon signed-rank test between top-2 candidates
- 🔲 **Champion challenger framework** — promote a challenger only if statistically better

### 9.3 Model Cards & Reporting
- 🔲 **Auto-generated model card** — dataset summary, training config, metrics, fairness notes
- 🔲 **PDF/HTML report export** — one-click report download for model documentation
- 🔲 **Lineage graph** — visual: Dataset → Experiment → Run → Model → Deployment

---

## Phase 10 — XAI & Interpretability (Extended) 🆕

> Goal: Go beyond the SHAP/LIME baseline to provide full, regulatory-grade explainability.
> SHAP and LIME exist today — this phase deepens and productizes them as a dedicated
> explanation platform, including AI-narrated explanations.
>
> **Note:** Phase 14 (AI Intelligence) will add LLM narrative explanations on top of this foundation.

**Depends on:** Phase 9 (champion model selected)  
**Blocks:** Phase 14 (AI explanation layer builds on top of this)

### 10.1 SHAP Extended Visualizations
- 🔲 **Waterfall plot** — per-prediction contribution breakdown
- 🔲 **Beeswarm plot** — global feature impact distribution across all samples
- 🔲 **Decision plot** — cumulative SHAP path to prediction
- 🔲 **Interaction values** — pairwise SHAP interaction effects

### 10.2 Partial Dependence & ICE
- 🔲 **1D PDP (Partial Dependence Plot)** — marginal effect of each feature on predictions
- 🔲 **2D PDP** — interaction surface between two features
- 🔲 **ICE plots (Individual Conditional Expectation)** — per-sample PDP lines

### 10.3 Counterfactual Explanation
- 🔲 **DiCE integration** — Diverse Counterfactual Explanations; "what would change the prediction?"
- 🔲 **Counterfactual builder UI** — user adjusts feature values; prediction updates in real time
- 🔲 **Actionable recourse** — suggest minimum-cost feature changes to change outcome

### 10.4 Global vs Local Explanation Modes
- 🔲 **Global explanation panel** — what the model has learned overall
- 🔲 **Local explanation panel** — why this specific row got this specific prediction
- 🔲 **Explanation export** — regulatory-grade PDF with SHAP charts + narrative

---

## Phase 11 — Deployment, Serving & MLOps

> Goal: Move from experiment to production. Deploy trained models as scalable REST endpoints
> with monitoring, versioning, and rollback.

**Depends on:** Phase 9 (champion model must be selected and validated)  
**Blocks:** Phase 12 (active learning requires a deployed endpoint), Phase 13 (orchestration manages deployed pipelines), Phase 18 (SDK needs stable endpoints)

### 11.1 Model Deployment ⚡
- 🚧 **Local model serving** — `POST /serve` exists; extend to persistent endpoint management
- 🔲 **Deployment wizard UI** — guided flow: select model/version → configure endpoint → deploy
- 🔲 **Docker image build** — auto-build container for selected model version
- 🔲 **Deployment health checks** — liveness & readiness probes for deployed endpoints
- 🔲 **A/B test framework** — route X % of traffic to challenger model

### 11.2 Inference Optimization
- 🔲 **ONNX export** — export sklearn/XGBoost/PyTorch models to ONNX for fast serving
- 🔲 **Model quantization** — reduce model size for edge deployment
- 🔲 **Batch inference optimization** — async batch endpoint with throughput controls
- 🔲 **Latency SLA monitoring** — alert when p95 latency exceeds configured threshold

### 11.3 Model Monitoring (Post-Deployment)
- 🔲 **Input drift detection** — statistical drift monitoring for incoming feature distributions
- 🔲 **Prediction drift detection** — monitor output distribution shift over time
- 🔲 **Data quality monitoring** — detect missing or invalid incoming features at serving time
- 🔲 **Performance monitoring** — track model accuracy over time with ground-truth feedback loop
- 🔲 **Auto-retraining trigger** — trigger retraining when drift or performance degrades below threshold

### 11.4 Model Governance
- 🚧 **Model versioning & registry** — exists; extend with immutable snapshots and audit log
- 🔲 **Promote / rollback workflow** — one-click promote challenger to champion; instant rollback
- 🔲 **Approval gate** — optional human-in-the-loop approval before production promotion
- 🔲 **Model lineage graph** — full lineage: Data Source → Feature Set → Experiment → Run → Deployment
- 🔲 **Compliance export** — export model card + lineage + fairness report for regulatory audit

---

## Phase 12 — Active Learning & Human-in-the-Loop Feedback 🆕

> Goal: Close the most important loop: Deployment → Ground Truth → Retraining.
> Without this, models degrade silently after deployment.

**Depends on:** Phase 11 (live deployment provides inference stream to sample from)  
**Blocks:** Nothing (final feedback loop phase)

### 12.1 Ground Truth Collection
- 🔲 **Ground truth ingestion endpoint** — `POST /ground-truth` to record true labels post-prediction
- 🔲 **Label matching** — link predictions to ground truth by prediction ID
- 🔲 **Feedback lag tracking** — how long after prediction does ground truth arrive?

### 12.2 Uncertainty Sampling
- 🔲 **Confidence-based sampling** — flag predictions with low model confidence for human review
- 🔲 **Entropy sampling** — for multi-class; flag high-entropy predictions
- 🔲 **Margin sampling** — flag predictions where top-2 class probabilities are close

### 12.3 Annotation Queue
- 🔲 **Annotation queue UI** — present uncertain samples to a human reviewer
- 🔲 **Label ingestion** — reviewed labels feed directly into next training run
- 🔲 **Reviewer dashboard** — queue size, review rate, label distribution

### 12.4 Incremental Retraining
- 🔲 **Drift + label drift detection** — trigger retraining when real-world distribution shifts
- 🔲 **Incremental training trigger** — re-train with newly labeled data; compare vs current champion
- 🔲 **Replay buffer** — mix new labeled samples with historical training data

---

## Phase 13 — Pipeline Orchestration & Scheduled Retraining 🆕

> Goal: Make the platform production-grade — declarative DAGs, scheduled runs, step caching,
> and failure recovery. This is what separates a demo from a production MLOps platform.

**Depends on:** Phase 11 (deployment in place to orchestrate)  
**Blocks:** Nothing (infrastructure upgrade)

### 13.1 DAG-Based Pipeline Definition
- 🔲 **Step dependency graph** — declare step dependencies explicitly (YAML / Python API)
- 🔲 **Step-level caching** — skip re-running profiling if data hasn't changed (content hash)
- 🔲 **Pipeline versioning** — track which pipeline version produced which model
- 🔲 **Pipeline visualization** — DAG viewer in UI showing step status

### 13.2 Scheduled & Event-Triggered Retraining
- 🔲 **Cron-based schedules** — "retrain weekly" or "retrain on the 1st of each month"
- 🔲 **Event-triggered retraining** — "retrain when drift score exceeds threshold"
- 🔲 **Retraining history log** — audit of when and why each retraining was triggered

### 13.3 Failure Recovery
- 🔲 **Step-level retry** — retry failed steps without re-running successful ones
- 🔲 **Failure notification** — webhook / email alert on pipeline failure
- 🔲 **Partial run resume** — continue a pipeline from the last successful checkpoint

---

## Phase 14 — AI Intelligence Layer (LM Studio) 🤖

> Goal: Replace rule-based heuristics with semantic, context-aware AI reasoning using a locally
> hosted LLM via LM Studio. **All AI calls are local — no data leaves the machine.**
>
> **Why here:** The AI layer augments an already-working rule-based pipeline. Building AI features
> before the underlying pipeline step is functional leads to drift — the AI has nothing reliable to
> augment. The LM Studio integration *module* (`llm_client.py`) should be bootstrapped early
> (Phase A), but AI-augmented phase features should only be merged once the base phase is done.

**Depends on:** Phase 9 (stable evaluation results for explanations), Phase 10 (XAI outputs for AI narration)  
**Blocks:** Phase 15 (conversational interface requires AI layer)

### 14.1 LM Studio Integration Module ⚡
- 🔲 **`src/generic_ml/llm_client.py`** — OpenAI-compatible local API client (bootstrap in Phase A)
- 🔲 **Health check** — verify LM Studio is running before AI calls
- 🔲 **Prompt template registry** — versioned prompt templates per use case
- 🔲 **LLM provider abstraction** — swap LM Studio for OpenAI / Anthropic / Ollama via config

### 14.2 Semantic Column Understanding 🤖 ⚡
- 🔲 **Column name interpretation** — LM Studio infers meaning (e.g., `txn_amt` → transaction amount)
- 🔲 **Column context mapping** — maps inferred meaning to ML role: ID / feature / target / date / text
- 🔲 **Domain detection** — infer domain (finance, healthcare, e-commerce, HR) from column set
- 🔲 **Unit inconsistency detection** — detect mixed units via AI
- 🔲 **Semantic anomaly detection** — flag `age=999`, `salary=-5000` using AI reasoning

### 14.3 Intelligent Data Cleaning 🤖
- 🔲 **AI-powered anomaly explanation** — LLM explains why a value is suspicious
- 🔲 **Semantic duplicate detection** — LLM identifies same entity despite different formatting
- 🔲 **Data entry error detection** — LLM distinguishes typos from valid rare values

### 14.4 Smart Feature Engineering 🤖
- 🔲 **AI feature suggestion** — LM Studio proposes domain-relevant features from column context
- 🔲 **Interaction feature suggestion** — AI recommends meaningful feature interactions
- 🔲 **Feature name generation** — human-readable names for engineered features

### 14.5 Target Leakage Detection 🤖 ⚡
- 🔲 **Temporal leakage detection** — AI reasons: "This column is created after the outcome — remove"
- 🔲 **Proxy leakage detection** — identify columns that encode the target indirectly
- 🔲 **Leakage risk report** — ranked list of leakage suspects with AI explanation
- 🔲 **Leakage prevention mode** — auto-exclude flagged columns before training

### 14.6 Intelligent Model Selection 🤖
- 🔲 **Context-aware model recommendation** — AI considers data size, feature types, noise, latency
- 🔲 **Model reasoning report** — "I recommend LightGBM because: large dataset, mixed types, speed"
- 🔲 **Fairness-aware selection** — AI flags models less likely to encode discriminatory patterns
- 🔲 **Interpretability-constrained selection** — restrict search to interpretable models when required

### 14.7 Auto-Explainability (Natural Language) 🤖 ⚡
- 🔲 **Prediction explanation in plain English** — LLM converts SHAP values to human narrative
  - e.g., "Default risk is high mainly due to high debt ratio and recent missed payments"
- 🔲 **Model behavior summary** — global explanation of what the model has learned
- 🔲 **Feature importance narration** — "The top 3 most important factors are..."
- 🔲 **Counterfactual explanation** — "If your income were $10K higher, the prediction would change to..."
- 🔲 **Non-technical report generation** — executive-level model summary for business stakeholders

### 14.8 Data Sufficiency & Quality Guidance 🤖
- 🔲 **Sample size adequacy check** — AI warns "Dataset too small for deep learning"
- 🔲 **Class imbalance guidance** — AI recommends SMOTE, class weights, or resampling strategy
- 🔲 **Data quality score** — AI assigns 0–100 data quality score with breakdown
- 🔲 **More-data recommendations** — AI identifies which class / time period needs more samples

### 14.9 Bias & Fairness Detection 🤖
- 🔲 **Protected attribute detection** — AI identifies potential proxy variables (age, gender, race)
- 🔲 **Disparate impact analysis** — measure outcome disparity across demographic groups
- 🔲 **Fairness report** — actionable fairness audit with regulatory risk flags
- 🔲 **Bias mitigation suggestions** — AI recommends reweighting, fairness constraints, or data collection

---

## Phase 15 — Conversational Interface 🤖

> Goal: Allow users to interact with the ML pipeline in natural language, translating intent into
> pipeline configuration changes.

**Depends on:** Phase 14 (LM Studio integration must be fully operational)  
**Blocks:** Nothing (final user-facing AI layer)

### 15.1 Chat Interface ⚡
- 🔲 **Chat panel UI** — persistent side panel in the React client for LLM conversation
- 🔲 **Session context** — LLM maintains awareness of current dataset, experiment, and model state
- 🔲 **Chat history** — persistent conversation log per experiment
- 🔲 **Streaming responses** — real-time token streaming from LM Studio to UI

### 15.2 Natural Language Pipeline Control
- 🔲 **Intent → config translation** — parse "Build a churn prediction model with high recall" into config
- 🔲 **Feature inclusion / exclusion commands** — "Ignore geographic features" → exclude geo columns
- 🔲 **Metric optimization directives** — "Optimize for interpretability" → constrain to linear/tree models
- 🔲 **Threshold adjustments** — "Increase precision" → adjust classification decision threshold
- 🔲 **What-if queries** — "What if I add 5,000 more samples?" → AI simulates impact

### 15.3 Proactive AI Suggestions
- 🔲 **Step recommendations** — AI proactively suggests next action after each pipeline step
- 🔲 **Warning surfacing** — AI alerts user to data quality issues, potential leakage, low data volume
- 🔲 **Best practice nudges** — "Your test set is too small; recommend 80/10/10 split"
- 🔲 **Pipeline health summary** — AI summarizes entire pipeline status on demand

---

## Phase 16 — Advanced Data Sources & Connectors

> Goal: Go beyond CSV uploads — connect to live data sources, databases, and streaming feeds.
> This is a parallel track that can be developed independently of the core ML pipeline.

**Depends on:** Phase 0 (ingestion pipeline must exist)  
**Blocks:** Nothing (parallel track; enriches data intake)

### 16.1 Data Source Connectors
- 🔲 **PostgreSQL / MySQL connector** — schema browsing, query builder, scheduled sync
- 🔲 **Snowflake / BigQuery connector** — cloud data warehouse integration
- 🔲 **S3 / GCS / Azure Blob** — remote file connector with path browser
- 🔲 **REST API connector** — ingest from any JSON REST endpoint
- 🔲 **Streaming connector** — Kafka / Kinesis for real-time feature ingestion
- 🔲 **Excel / Google Sheets connector** — for non-technical business users

### 16.2 Data Versioning
- 🔲 **Dataset snapshot on upload** — immutable versioned snapshot with hash
- 🔲 **Schema change detection** — alert when upstream schema changes break pipeline
- 🔲 **Column mapping** — map source columns to canonical feature names across versions

---

## Phase 17 — Experiment Collaboration & Multi-User 🆕

> Goal: Enable team adoption beyond a single data scientist.

**Depends on:** Phase 9 (core experiment platform must be stable)  
**Blocks:** Nothing (team features)

### 17.1 Access Control
- 🔲 **RBAC** — Admin / Data Scientist / Analyst / Viewer roles
- 🔲 **Shared workspaces / projects** — permission-managed shared spaces
- 🔲 **Audit log** — who trained what, when, with what data

### 17.2 Collaboration Features
- 🔲 **Experiment commenting and annotation** — per-run notes and tags
- 🔲 **@mention notifications** — activity feeds and alerts
- 🔲 **Team leaderboard** — compare runs across team members

---

## Phase 18 — Developer Experience & Ecosystem

> Goal: Make the platform easy to extend, integrate, and contribute to.

**Depends on:** Phase 11 (deployment and serving APIs must be stable)  
**Blocks:** Nothing (ecosystem layer)

### 18.1 SDK & API
- 🔲 **Python SDK** — `pip install phoenice-omniforge-ml`; typed client for all pipeline steps
- 🔲 **OpenAPI spec** — auto-generated, versioned OpenAPI 3.1 spec published at `/openapi.json`
- 🔲 **TypeScript SDK** — auto-generated from OpenAPI spec; published to npm
- 🔲 **Webhook support** — notify external systems on job completion, model promotion, drift alert

### 18.2 Plugin / Extension System
- 🔲 **Custom model plugin API** — register any sklearn-compatible estimator as a candidate
- 🔲 **Custom metric plugin** — register user-defined evaluation metrics
- 🔲 **Custom cleaning rule plugin** — register domain-specific validation rules
- 🔲 **LLM provider abstraction** — swap LM Studio for OpenAI / Anthropic / Ollama via config

### 18.3 Developer Tooling
- 🔲 **Storybook stories** — component-level interactive documentation for all UI components
- 🔲 **Mock API server** — MSW-based mock for frontend development without backend
- 🔲 **Dev seed data** — curated sample datasets for local development and demos
- 🔲 **One-command dev setup** — `make dev` starts backend + frontend + LM Studio check

---

## Backlog Metrics Summary

| # | Phase | Items Total | ✅ Done | 🚧 Partial | 🔲 Not Started |
|---|-------|------------|---------|-----------|---------------|
| 0 | Foundation | 24 | 24 | 0 | 0 |
| A | PII & Privacy 🆕 | 16 | 0 | 0 | 16 |
| 1 | Dataset Profiling | 20 | 0 | 2 | 18 |
| 2 | EDA | 48 | 0 | 0 | 48 |
| 3 | Data Cleaning | 20 | 0 | 1 | 19 |
| 4 | Imbalanced Data 🆕 | 15 | 0 | 0 | 15 |
| 5 | Feature Engineering | 22 | 0 | 2 | 20 |
| 6 | Feature Selection | 14 | 0 | 0 | 14 |
| 7 | AutoML Training | 25 | 10 | 2 | 13 |
| 8 | Overfitting & Robustness | 11 | 0 | 1 | 10 |
| 9 | Evaluation & Leaderboard | 14 | 4 | 1 | 9 |
| 10 | XAI & Interpretability 🆕 | 10 | 0 | 0 | 10 |
| 11 | Deployment & MLOps | 18 | 0 | 2 | 16 |
| 12 | Active Learning 🆕 | 12 | 0 | 0 | 12 |
| 13 | Pipeline Orchestration 🆕 | 9 | 0 | 0 | 9 |
| 14 | AI Intelligence (LM Studio) | 34 | 0 | 0 | 34 |
| 15 | Conversational Interface | 12 | 0 | 0 | 12 |
| 16 | Advanced Data Sources | 9 | 0 | 0 | 9 |
| 17 | Collaboration & Multi-User 🆕 | 6 | 0 | 0 | 6 |
| 18 | Developer Experience | 12 | 0 | 0 | 12 |
| | **Total** | **351** | **38** | **11** | **302** |

---

## Suggested Sprint Order (First 4 Sprints)

### Sprint 1 — Profiling & EDA Foundation
1. Phase A: PII scanner (bootstrap) — pattern-based detection + masking UI
2. Phase 1.1: Complete column type detection (date, text, boolean, ID)
3. Phase 1.2: Outlier flagging + missing value audit in profile report
4. Phase 2.1: Top Issues summary report + ydata-profiling integration
5. Phase 2.3: Missing data report + missingness heatmap UI

### Sprint 2 — EDA Depth + Cleaning
1. Phase 2.4: Distribution analysis (histogram, box plot, KDE, shape tag)
2. Phase 2.5: Correlation matrix + redundant feature detection
3. Phase 2.10: Target variable analysis (class imbalance, regression distribution)
4. Phase 3.1: Mode imputation + KNN imputation options
5. Phase 3.2: IQR outlier detection + configurable treatment (cap / remove / flag)

### Sprint 3 — Balancing + Feature Engineering
1. Phase 4: SMOTE / ADASYN oversampling + class weight injection
2. Phase 5.1: Log transform + binning for skewed numerics
3. Phase 5.2: Target encoding + frequency encoding
4. Phase 5.4: Full date/time decomposition + seasonality encoding
5. Phase 6.1: Variance threshold + MI ranking feature selection

### Sprint 4 — AI Layer Bootstrap + AutoML Hardening
1. Phase 14.1: `llm_client.py` LM Studio integration module
2. Phase 14.2: Semantic column understanding endpoint
3. Phase 14.5: Target leakage detection using AI
4. Phase 7.1: Extended problem type detection (forecasting, clustering, anomaly framing)
5. Phase 7.3: Random search + HPO budget controls

---

*Last updated: 2026-03-15*  
*Project: Phoenice OmniForge ML*
