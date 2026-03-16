# OmniForge ML — Test Dataset Plan

> **Purpose:** A single, realistic, reproducible dataset used as the primary test vehicle throughout all phases of development. Every phase of the OmniForge ML workbench must be exercisable end-to-end with this dataset alone.

---

## Dataset Identity

| Property          | Value                                    |
|-------------------|------------------------------------------|
| **Name**          | FinRisk Credit Default                   |
| **File**          | `data/finrisk_credit_default_25k.csv`    |
| **Generator**     | `data/generate_dataset.py`               |
| **Rows**          | 25,000                                   |
| **Columns**       | 45                                       |
| **Format**        | CSV (~14 MB)                             |
| **Target**        | `loan_default` (binary: 0 = no default, 1 = default) |
| **Class Balance** | ~83% no-default / ~17% default (real-world imbalance) |
| **Random Seed**   | 42 (fully reproducible)                  |

### Domain: Loan Application / Credit Default

A credit risk dataset was chosen because it **naturally contains every data characteristic** needed to exercise all 15+ phases without artificial padding:
- PII in every form (names, SSN, emails, DOB, IBAN, etc.)
- Mixed dtypes (numeric, categorical, boolean, datetime)
- Real-world data quality issues (missingness, outliers, duplicates, leakage)
- Meaningful class imbalance
- Multicollinearity and derivable features
- High-cardinality categoricals
- A well-understood target for SHAP/XAI interpretation

---

## Columns

### 🔴 PII Columns — *tests Phase A (PII Detection)*

| Column              | PII Entity Type | Sensitivity | Recommended Action |
|---------------------|-----------------|-------------|-------------------|
| `customer_name`     | NAME            | High        | pseudonymize       |
| `email`             | EMAIL           | High        | mask               |
| `phone`             | PHONE           | High        | mask               |
| `ssn`               | SSN             | High        | hash               |
| `address`           | ADDRESS         | Medium      | mask               |
| `date_of_birth`     | DATE_OF_BIRTH   | High        | mask               |
| `credit_card_number`| CREDIT_CARD     | High        | drop               |
| `ip_address`        | IP_ADDRESS      | Low         | mask               |
| `iban`              | IBAN            | High        | hash               |

> Expected PII risk score: **~90/100**

---

### 📊 Numeric Features — *tests Phases 1, 2, 3, 5, 6*

| Column                   | Distribution / Characteristic                                     |
|--------------------------|-------------------------------------------------------------------|
| `annual_income`          | Right-skewed, outliers > $800K; ~5% MCAR missing; log-transform candidate |
| `loan_amount`            | Correlated with `annual_income`; extreme values present           |
| `credit_score`           | 300–850, roughly normal; strong predictor of target               |
| `monthly_debt`           | Correlated with `annual_income` (multicollinearity)               |
| `num_credit_accounts`    | Integer; low variance in certain employment groups                |
| `num_late_payments`      | Zero-inflated (most applicants = 0)                               |
| `months_employed`        | Missing ~30% for `self-employed` (MAR pattern)                    |
| `age`                    | Derived from `date_of_birth` — tests redundancy detection         |
| `num_dependents`         | Integer 0–6; ~8% MCAR missing                                     |
| `total_assets`           | High variance; outliers present                                   |
| `total_liabilities`      | Correlated with `monthly_debt`                                    |
| `savings_balance`        | Zero-inflated / sparse                                            |
| `loan_term_months`       | Discrete: {12, 24, 36, 60} — categorical-like numeric             |
| `interest_rate`          | Correlated with `credit_score`; engineered by lender              |
| `debt_to_income_ratio`   | Derivable from `monthly_debt / annual_income * 12`; tests redundancy |
| `loan_to_income_ratio`   | Derivable from `loan_amount / annual_income`; tests redundancy    |
| `credit_utilization_rate`| Computed but included; tests feature selection (redundant)        |

---

### 📅 Datetime Features — *tests Phase 5 (date decomposition)*

| Column               | Characteristic                                             |
|----------------------|------------------------------------------------------------|
| `application_date`   | 3-year date range; seasonal trends in default rate         |
| `account_open_date`  | Used to derive `account_age_months`                        |
| `last_payment_date`  | ~15% missing for new accounts that never made a payment (MNAR) |

---

### 🏷️ Categorical Features — *tests Phases 2, 5 (encoding)*

| Column              | Cardinality | Notes                                              |
|---------------------|------------|-----------------------------------------------------|
| `loan_purpose`      | 6          | home, car, education, personal, business, medical   |
| `employment_status` | 4          | employed, self-employed, unemployed, retired        |
| `education_level`   | 5          | high_school, associate, bachelor, master, doctorate |
| `home_ownership`    | 3          | own, rent, mortgage                                 |
| `marital_status`    | 4          | single, married, divorced, widowed                  |
| `state`             | 50         | High cardinality — one-hot explosion risk; target-encode candidate |
| `industry_sector`   | 12         | Finance, Tech, Healthcare, Retail, etc.             |
| `loan_grade`        | 7          | A–G; **leakage risk** — highly correlated with target; should be flagged and dropped |

---

### ✅ Boolean Features

| Column               | Notes                                                |
|----------------------|------------------------------------------------------|
| `has_cosigner`       | Protective factor for default                        |
| `has_collateral`     | Protective factor                                    |
| `previous_bankruptcy`| Strong predictor of default                         |
| `is_first_loan`      | ~95% true — low variance; tests low-variance warning |

---

### 🎯 Target

| Column         | Type   | Values          |
|----------------|--------|-----------------|
| `loan_default` | Binary | 0 = no default, 1 = default |

---

## Embedded Data Quality Issues — *tests Phases 1, 2, 3*

| Issue              | Column(s)                        | Missingness Pattern | Expected Phase to Handle |
|--------------------|----------------------------------|---------------------|--------------------------|
| 30% missing        | `months_employed`                | **MAR** (only for self-employed) | Phase 3 (impute) |
| 5% missing         | `annual_income`                  | **MCAR** (random)   | Phase 3 (median impute)  |
| 8% missing         | `num_dependents`                 | **MCAR**            | Phase 3 (mode impute)    |
| 15% missing        | `last_payment_date`              | **MNAR** (new accounts) | Phase 3 (constant fill / drop) |
| Outliers           | `annual_income`, `total_assets`  | ~1% values > 3σ     | Phase 3 (clip)           |
| Duplicate rows     | random                           | ~2% (≈500 rows)     | Phase 3 (drop)           |
| Data leakage       | `loan_grade`                     | AUC ≈ 0.97 with target | Phase 6 (flag + drop)  |
| Low variance       | `is_first_loan`                  | 95% = True          | Phase 2 / Phase 6 (warn) |
| High cardinality   | `state`                          | 50 unique values    | Phase 5 (target encode)  |
| Multicollinearity  | `monthly_debt` ↔ `total_liabilities` | r ≈ 0.88       | Phase 2 (correlation)    |
| Redundant features | `debt_to_income_ratio`, `loan_to_income_ratio` | Derivable | Phase 6 (select) |
| Skewness           | `annual_income`, `loan_amount`   | Skew > 2            | Phase 5 (log transform)  |
| Zero-inflation     | `num_late_payments`, `savings_balance` | 40–60% zeros | Phase 5 (binning)        |

---

## Phase Coverage Matrix

| Phase | What This Dataset Exercises |
|-------|-----------------------------|
| **Phase 0** — Foundation | Upload CSV; persist metadata (rows, cols, file size, created_at) |
| **Phase A** — PII Detection | Detect all 9 PII columns; compute risk score ~90/100; mask/hash/drop |
| **Phase 1** — Dataset Profiling | Profile all 45 columns: dtype, missing%, histograms, top values, skewness, kurtosis |
| **Phase 2** — EDA | Correlation heatmap; missingness patterns (MCAR/MAR/MNAR); leakage flag on `loan_grade`; class imbalance visualisation |
| **Phase 3** — Data Cleaning | Impute `annual_income` (median), `num_dependents` (mode), `months_employed` (group median); clip outliers; drop 500 duplicates |
| **Phase 4** — Imbalanced Data & Sampling | 83/17 split → recommend SMOTE or class weights; show before/after distribution |
| **Phase 5** — Feature Engineering | Log(`annual_income`), decompose dates into year/month/day/day_of_week, derive `account_age_months`, target-encode `state`, one-hot `loan_purpose` |
| **Phase 6** — Feature Selection | Rank 35+ features by RF importance + mutual info; drop `loan_grade` (leakage), PII columns, redundant ratios |
| **Phase 7** — AutoML Training | Train LightGBM, XGBoost, Logistic Regression, Random Forest; binary classification; CV with stratified folds |
| **Phase 8** — Overfitting & Robustness | Cross-fold variance; learning curves; train vs. val gap |
| **Phase 9** — Evaluation & Leaderboard | AUC-ROC ~0.82–0.87; F1; confusion matrix; precision/recall at threshold |
| **Phase 10** — XAI & Interpretability | SHAP: `credit_score`, `annual_income`, `previous_bankruptcy` as top drivers |
| **Phase 11** — Deployment & MLOps | Serve champion model; predict on new loan application rows |
| **Phase 14** — AI Intelligence Layer | LLM explains: "Why was this loan flagged?" using SHAP + feature context |
| **Phase 15** — Conversational Interface | User asks: "Which customers are highest risk?" → LLM queries model |

---

## Generation Script

**Location:** `data/generate_dataset.py`

**Key design decisions:**
- `numpy` random seed = 42 (reproducible)
- `faker` for PII values (realistic names, emails, SSN, IBAN, addresses)
- Correlations baked in mathematically:
  - `credit_score` ↔ `loan_default` (primary driver, r ≈ −0.45)
  - `annual_income` ↔ `loan_amount` (r ≈ 0.62)
  - `monthly_debt` ↔ `total_liabilities` (r ≈ 0.88)
  - `interest_rate` ↔ `credit_score` (r ≈ −0.71)
  - `loan_grade` ↔ `loan_default` (near-perfect correlation — leakage)
- Missing values injected deliberately by pattern (MAR/MCAR/MNAR)
- Duplicate rows injected at 2% rate
- Outliers injected at 1% rate for income and assets

**To regenerate:**
```bash
cd data
python generate_dataset.py
# Output: finrisk_credit_default_25k.csv
```

---

## Acceptance Criteria

The dataset is considered ready when:

- [ ] 25,000 rows × 45 columns confirmed after generation
- [ ] All 9 PII columns detectable by the regex scanner in Phase A
- [ ] `loan_default` class ratio ≈ 83/17
- [ ] `months_employed` missing rate ≈ 28–32% (for self-employed rows only)
- [ ] `annual_income` missing rate ≈ 4–6%
- [ ] `loan_grade` achieves AUC > 0.90 alone (confirms leakage)
- [ ] ≥ 400 duplicate rows present
- [ ] CSV loads cleanly with `pandas.read_csv()` with no parse errors
- [ ] Reproducible: re-running `generate_dataset.py` produces identical file (same SHA256)
