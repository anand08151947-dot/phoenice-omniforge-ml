"""
FinRisk Credit Default Dataset Generator
=========================================
Generates: finrisk_credit_default_25k.csv
Rows:       25,000
Columns:    45
Target:     loan_default (binary, ~83/17 split)
Seed:       42 (fully reproducible)

Run:
    cd data
    python generate_dataset.py
"""

import hashlib
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from faker import Faker

# ── Reproducibility ──────────────────────────────────────────────────────────
SEED = 42
N = 25_000
rng = np.random.default_rng(SEED)
fake = Faker("en_US")
Faker.seed(SEED)

OUT_FILE = Path(__file__).parent / "finrisk_credit_default_25k.csv"

print(f"Generating {N:,} rows × 45 columns …")

# ── Step 1: Core latent variables (drive correlations) ───────────────────────
# credit_score: 300–850
credit_score = rng.normal(loc=660, scale=80, size=N).clip(300, 850).astype(int)

# annual_income: log-normal, right-skewed
log_income = rng.normal(loc=11.0, scale=0.6, size=N)  # ln(~60k)
annual_income = np.exp(log_income).round(2)

# default probability driven by credit_score + income
# Intercept tuned so mean default rate ≈ 17%
# At mean credit_score=660, annual_income=60k: logit ≈ 2.0 - 3.3 - 0.12 = -1.42 → sigmoid ≈ 19%
default_logit = (
    1.7
    + (-0.005) * credit_score
    + (-0.000002) * annual_income
    + rng.normal(0, 0.5, size=N)
)
default_prob = 1 / (1 + np.exp(-default_logit))
loan_default = (rng.random(N) < default_prob).astype(int)

# ── Step 2: Numeric features ─────────────────────────────────────────────────
loan_amount = (annual_income * rng.uniform(0.3, 4.0, N)).round(2).clip(1_000, 500_000)

monthly_debt = (annual_income / 12 * rng.uniform(0.1, 0.6, N)).round(2)
total_liabilities = (monthly_debt * rng.uniform(8, 20, N)).round(2)  # r≈0.88
total_assets = (annual_income * rng.uniform(0.5, 5, N) + rng.exponential(20_000, N)).round(2)

num_credit_accounts = rng.integers(1, 25, N)
num_late_payments = rng.choice(
    [0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 8, 12],
    size=N,
    p=[0.40, 0.15, 0.10, 0.08, 0.07, 0.07, 0.05, 0.03, 0.02, 0.01, 0.01, 0.01],
)

savings_balance = np.where(
    rng.random(N) < 0.45, 0.0,
    (annual_income * rng.uniform(0.01, 0.5, N)).round(2)
)

loan_term_months = rng.choice([12, 24, 36, 60], N, p=[0.10, 0.25, 0.40, 0.25])

# account_age_months: derived from account_open_date (integer, 1–180)
account_age_months = rng.integers(1, 181, N)

# region: 4-category derived from state
northeast = {"CT","ME","MA","NH","RI","VT","NJ","NY","PA"}
south     = {"DE","MD","VA","WV","NC","SC","GA","FL","AL","MS","TN","KY","AR","LA","OK","TX","DC"}
midwest   = {"IL","IN","MI","OH","WI","MN","IA","MO","ND","SD","NE","KS"}
west      = {"AZ","CO","ID","MT","NV","NM","UT","WY","AK","CA","HI","OR","WA"}
def state_to_region(s):
    if s in northeast: return "Northeast"
    if s in south:     return "South"
    if s in midwest:   return "Midwest"
    return "West"

# interest_rate inversely correlated with credit_score
interest_rate = (
    28 - 0.023 * credit_score + rng.normal(0, 1.5, N)
).clip(2.5, 35.0).round(2)

# derived ratios (redundant — to test feature selection)
debt_to_income_ratio = (monthly_debt * 12 / annual_income).round(4).clip(0, 1)
loan_to_income_ratio = (loan_amount / annual_income).round(4).clip(0, 10)
credit_utilization_rate = (rng.uniform(0, 1, N)).round(4)  # noisy proxy

num_dependents = rng.integers(0, 7, N)
age = rng.integers(21, 75, N)

# ── Step 3: Categorical features ─────────────────────────────────────────────
employment_status = rng.choice(
    ["employed", "self-employed", "unemployed", "retired"],
    N, p=[0.62, 0.18, 0.12, 0.08]
)
loan_purpose = rng.choice(
    ["home", "car", "education", "personal", "business", "medical"],
    N, p=[0.25, 0.20, 0.15, 0.20, 0.12, 0.08]
)
education_level = rng.choice(
    ["high_school", "associate", "bachelor", "master", "doctorate"],
    N, p=[0.25, 0.15, 0.35, 0.20, 0.05]
)
home_ownership = rng.choice(
    ["rent", "own", "mortgage"],
    N, p=[0.35, 0.25, 0.40]
)
marital_status = rng.choice(
    ["single", "married", "divorced", "widowed"],
    N, p=[0.35, 0.45, 0.15, 0.05]
)

us_states = [
    "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
    "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
    "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
    "TX","UT","VT","VA","WA","WV","WI","WY",
]
# Weight towards populous states
state_weights = rng.dirichlet(np.ones(50) * 2)
state = rng.choice(us_states, N, p=state_weights)

industry_sector = rng.choice(
    ["Finance","Technology","Healthcare","Retail","Manufacturing","Education",
     "Construction","Transportation","Government","Hospitality","Real Estate","Other"],
    N, p=[0.12,0.15,0.12,0.10,0.08,0.07,0.07,0.06,0.06,0.05,0.06,0.06]
)

# loan_grade — LEAKAGE RISK: nearly deterministic from default + credit_score
grade_score = credit_score - 40 * loan_default + rng.normal(0, 15, N)
grade_bins = np.percentile(grade_score, [14, 28, 42, 56, 70, 84])
loan_grade = np.select(
    [grade_score < grade_bins[0], grade_score < grade_bins[1],
     grade_score < grade_bins[2], grade_score < grade_bins[3],
     grade_score < grade_bins[4], grade_score < grade_bins[5]],
    ["G", "F", "E", "D", "C", "B"], default="A"
)

# ── Step 4: Booleans ─────────────────────────────────────────────────────────
has_cosigner = rng.random(N) < 0.18
has_collateral = rng.random(N) < 0.30
previous_bankruptcy = (rng.random(N) < (0.04 + 0.12 * loan_default)).astype(bool)
is_first_loan = rng.random(N) < 0.95  # low variance — 95% true

# ── Step 5: Datetime columns ─────────────────────────────────────────────────
base_date = pd.Timestamp("2022-01-01")
application_days = rng.integers(0, 3 * 365, N)
application_date = [
    (base_date + pd.Timedelta(days=int(d))).strftime("%Y-%m-%d")
    for d in application_days
]
account_open_days = application_days + rng.integers(30, 365 * 10, N)
account_open_date = [
    (base_date - pd.Timedelta(days=int(d))).strftime("%Y-%m-%d")
    for d in rng.integers(30, 365 * 15, N)
]
# last_payment_date — 15% missing (MNAR: new accounts)
is_new_account = rng.random(N) < 0.15
last_payment_raw = [
    (base_date + pd.Timedelta(days=int(d)) - pd.Timedelta(days=rng.integers(1, 180))).strftime("%Y-%m-%d")
    if not new else None
    for d, new in zip(application_days, is_new_account)
]

# months_employed: continuous, MAR — missing when self-employed
months_employed = (rng.exponential(scale=60, size=N) + 1).clip(1, 480).round(1)
is_self_employed = employment_status == "self-employed"
missing_employed_mask = is_self_employed & (rng.random(N) < 0.30 / 0.18)  # ≈30% overall for SE
months_employed_col = np.where(missing_employed_mask, np.nan, months_employed)

# ── Step 6: PII columns ───────────────────────────────────────────────────────
print("  Generating PII fields (faker) …")
customer_names, emails, phones, ssns, addresses, dobs, ccnums, ips, ibans = (
    [], [], [], [], [], [], [], [], []
)
for i in range(N):
    customer_names.append(fake.name())
    emails.append(fake.email())
    phones.append(fake.phone_number())
    ssns.append(fake.ssn())
    addresses.append(fake.address().replace("\n", ", "))
    dobs.append(fake.date_of_birth(minimum_age=21, maximum_age=75).strftime("%Y-%m-%d"))
    ccnums.append(fake.credit_card_number(card_type=None))
    ips.append(fake.ipv4())
    ibans.append(fake.iban())

# ── Step 7: Assemble dataframe ────────────────────────────────────────────────
print("  Assembling DataFrame …")
df = pd.DataFrame({
    # PII
    "customer_name":        customer_names,
    "email":                emails,
    "phone":                phones,
    "ssn":                  ssns,
    "address":              addresses,
    "date_of_birth":        dobs,
    "credit_card_number":   ccnums,
    "ip_address":           ips,
    "iban":                 ibans,
    # Numeric
    "annual_income":            annual_income,
    "loan_amount":              loan_amount,
    "credit_score":             credit_score,
    "monthly_debt":             monthly_debt,
    "total_liabilities":        total_liabilities,
    "total_assets":             total_assets,
    "num_credit_accounts":      num_credit_accounts,
    "num_late_payments":        num_late_payments,
    "months_employed":          months_employed_col,
    "age":                      age,
    "num_dependents":           num_dependents,
    "savings_balance":          savings_balance,
    "loan_term_months":         loan_term_months,
    "interest_rate":            interest_rate,
    "debt_to_income_ratio":     debt_to_income_ratio,
    "loan_to_income_ratio":     loan_to_income_ratio,
    "credit_utilization_rate":  credit_utilization_rate,
    # Datetime
    "application_date":     application_date,
    "account_open_date":    account_open_date,
    "last_payment_date":    last_payment_raw,
    # Categorical
    "loan_purpose":         loan_purpose,
    "employment_status":    employment_status,
    "education_level":      education_level,
    "home_ownership":       home_ownership,
    "marital_status":       marital_status,
    "state":                state,
    "industry_sector":      industry_sector,
    "loan_grade":           loan_grade,
    # Boolean
    "has_cosigner":         has_cosigner,
    "has_collateral":       has_collateral,
    "previous_bankruptcy":  previous_bankruptcy,
    "is_first_loan":        is_first_loan,
    # Derived / extra
    "account_age_months":   account_age_months,
    "region":               [state_to_region(s) for s in state],
    "loan_id":              [f"LN{i:07d}" for i in range(N)],
    # Target
    "loan_default":         loan_default,
})

# ── Step 8: Inject additional missing values ──────────────────────────────────
# annual_income: 5% MCAR
income_missing = rng.choice(N, size=int(N * 0.05), replace=False)
df.loc[income_missing, "annual_income"] = np.nan

# num_dependents: 8% MCAR
dep_missing = rng.choice(N, size=int(N * 0.08), replace=False)
df.loc[dep_missing, "num_dependents"] = np.nan

# ── Step 9: Inject outliers ───────────────────────────────────────────────────
outlier_idx = rng.choice(N, size=int(N * 0.01), replace=False)
df.loc[outlier_idx, "annual_income"] = rng.uniform(800_000, 2_000_000, len(outlier_idx)).round(2)
asset_outlier_idx = rng.choice(N, size=int(N * 0.01), replace=False)
df.loc[asset_outlier_idx, "total_assets"] = rng.uniform(1_000_000, 5_000_000, len(asset_outlier_idx)).round(2)

# ── Step 10: Inject duplicate rows (~2%) ─────────────────────────────────────
n_dupes = int(N * 0.02)
dupe_source = rng.choice(N, size=n_dupes, replace=True)
dupes = df.iloc[dupe_source].copy()
df = pd.concat([df, dupes], ignore_index=True)
df = df.sample(frac=1, random_state=SEED).reset_index(drop=True)

# ── Step 11: Save ─────────────────────────────────────────────────────────────
df.to_csv(OUT_FILE, index=False)
sha256 = hashlib.sha256(OUT_FILE.read_bytes()).hexdigest()

# ── Step 12: Validation report ────────────────────────────────────────────────
total_rows, total_cols = df.shape
default_rate = df["loan_default"].mean()
missing_income_pct = df["annual_income"].isna().mean()
missing_employed_pct = df["months_employed"].isna().mean()
missing_last_payment_pct = df["last_payment_date"].isna().mean()
missing_dependents_pct = df["num_dependents"].isna().mean()
n_duplicates = df.duplicated().sum()
grade_auc_proxy = (df.groupby("loan_grade")["loan_default"].mean()
                   .sort_values(ascending=False).index.tolist())

print()
print("=" * 55)
print("  DATASET GENERATION COMPLETE")
print("=" * 55)
print(f"  File:           {OUT_FILE.name}")
print(f"  Shape:          {total_rows:,} rows × {total_cols} columns")
print(f"  Default rate:   {default_rate:.1%}  (target ≈17%)")
print(f"  Missing income: {missing_income_pct:.1%}  (target ≈5%)")
print(f"  Missing months_employed: {missing_employed_pct:.1%}  (target ≈18-30%)")
print(f"  Missing last_payment:    {missing_last_payment_pct:.1%}  (target ≈15%)")
print(f"  Missing num_dependents:  {missing_dependents_pct:.1%}  (target ≈8%)")
print(f"  Duplicate rows: {n_duplicates:,}  (target ≥400)")
print(f"  loan_grade order (leakage check): {grade_auc_proxy}")
print(f"  File size:      {OUT_FILE.stat().st_size / 1_048_576:.1f} MB")
print(f"  SHA-256:        {sha256[:16]}…")
print("=" * 55)

# Acceptance checks
checks = [
    (24_500 <= total_rows <= 26_000,         f"Rows ≈25,500 ({total_rows:,})"),
    (total_cols == 45,                        f"Columns == 45 ({total_cols})"),
    (0.14 <= default_rate <= 0.22,           f"Default rate 14-22% ({default_rate:.1%})"),
    (0.04 <= missing_income_pct <= 0.08,     f"Missing income 4-8% ({missing_income_pct:.1%})"),
    (0.08 <= missing_employed_pct <= 0.35,   f"Missing months_employed 8-35% ({missing_employed_pct:.1%})"),
    (0.12 <= missing_last_payment_pct <= 0.20, f"Missing last_payment 12-20% ({missing_last_payment_pct:.1%})"),
    (n_duplicates >= 400,                     f"Duplicates ≥400 ({n_duplicates:,})"),
]

print()
all_pass = True
for ok, label in checks:
    status = "✓ PASS" if ok else "✗ FAIL"
    print(f"  [{status}] {label}")
    if not ok:
        all_pass = False

print()
if all_pass:
    print("  All acceptance checks passed ✓")
else:
    print("  Some checks failed — review above")
    sys.exit(1)
