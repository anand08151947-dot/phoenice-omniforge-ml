import Box from "@mui/material/Box"
import Grid from "@mui/material/Grid"
import Typography from "@mui/material/Typography"
import Table from "@mui/material/Table"
import TableHead from "@mui/material/TableHead"
import TableBody from "@mui/material/TableBody"
import TableRow from "@mui/material/TableRow"
import TableCell from "@mui/material/TableCell"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import StorageIcon from "@mui/icons-material/Storage"
import SpeedIcon from "@mui/icons-material/Speed"
import AccountTreeIcon from "@mui/icons-material/AccountTree"
import MemoryIcon from "@mui/icons-material/Memory"
import type { ModelCandidate } from "../../api/types"
import ConfusionMatrixChart from "./ConfusionMatrixChart"
import ROCPRChart from "./ROCPRChart"
import FeatureImportanceChart from "./FeatureImportanceChart"
import LearningCurveChart from "./LearningCurveChart"

interface Props {
  candidate: ModelCandidate
  isClassifier: boolean
}

function pct(v: number) {
  return `${(v * 100).toFixed(1)}%`
}

function gapColor(gap: number) {
  if (gap > 0.15) return "#f44336"
  if (gap > 0.05) return "#ff9800"
  return "#4caf50"
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{title}</Typography>
      {children}
    </Box>
  )
}

export default function ModelDetailPanel({ candidate: c, isClassifier }: Props) {
  const hasThreshold = (c.threshold_analysis?.length ?? 0) > 0
  const hasFolds = (c.fold_scores?.length ?? 0) > 0
  const hasPerClass = (c.per_class_metrics?.length ?? 0) > 0
  const hasCM = isClassifier && !!c.confusion_matrix_data?.labels?.length
  const hasROC = isClassifier && (c.roc_curve_data?.length ?? 0) > 0
  const hasPR = isClassifier && (c.pr_curve_data?.length ?? 0) > 0
  const hasFI = (c.feature_importances?.length ?? 0) > 0
  const hasLC = (c.learning_curve?.length ?? 0) > 0
  const hasSW = (c.strengths?.length ?? 0) > 0 || (c.weaknesses?.length ?? 0) > 0
  const hasComplexity = !!c.complexity && Object.keys(c.complexity).length > 0
  const hyperKeys = Object.keys(c.hyperparams ?? {}).slice(0, 12)

  return (
    <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 1 }}>
      <Grid container spacing={3}>

        {/* ── 1. Per-Fold CV Table ──────────────────────────────── */}
        {hasFolds && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Section title="Per-Fold CV Scores">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Fold", "CV", "Train", "Gap"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, py: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {c.fold_scores!.map((f) => (
                    <TableRow key={f.fold}>
                      <TableCell sx={{ py: 0.5 }}>{f.fold}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{pct(f.cv_score)}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{pct(f.train_score)}</TableCell>
                      <TableCell sx={{ py: 0.5, color: gapColor(f.gap), fontWeight: 600 }}>
                        {pct(f.gap)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow sx={{ bgcolor: "action.hover" }}>
                    <TableCell sx={{ py: 0.5, fontWeight: 700 }}>Avg ± σ</TableCell>
                    <TableCell sx={{ py: 0.5, fontWeight: 700 }}>
                      {pct(c.cv_score)} ± {pct(c.cv_std ?? 0)}
                    </TableCell>
                    <TableCell sx={{ py: 0.5, fontWeight: 700 }}>{pct(c.train_score)}</TableCell>
                    <TableCell sx={{ py: 0.5 }} />
                  </TableRow>
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Min: {pct(c.cv_min ?? 0)} &nbsp;|&nbsp; Max: {pct(c.cv_max ?? 0)}
              </Typography>
            </Section>
          </Grid>
        )}

        {/* ── 2. Per-Class Metrics ──────────────────────────────── */}
        {isClassifier && hasPerClass && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Section title="Per-Class Precision / Recall">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Class", "Precision", "Recall", "F1", "Support"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, py: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {c.per_class_metrics!.map((m) => (
                    <TableRow key={m.class}>
                      <TableCell sx={{ py: 0.5 }}>
                        <Chip label={`Class ${m.class}`} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell sx={{ py: 0.5 }}>{pct(m.precision)}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{pct(m.recall)}</TableCell>
                      <TableCell sx={{ py: 0.5, fontWeight: 600 }}>{pct(m.f1)}</TableCell>
                      <TableCell sx={{ py: 0.5, color: "text.secondary" }}>
                        {m.support.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Section>
          </Grid>
        )}

        {/* ── 3. Strengths & Weaknesses ─────────────────────────── */}
        {hasSW && (
          <Grid size={{ xs: 12, md: 4 }}>
            <Section title="Model Assessment">
              {(c.strengths ?? []).map((s, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, mb: 0.5 }}>
                  <CheckCircleOutlineIcon sx={{ fontSize: 15, color: "#4caf50", mt: 0.15, flexShrink: 0 }} />
                  <Typography variant="caption">{s}</Typography>
                </Box>
              ))}
              {(c.weaknesses ?? []).map((w, i) => (
                <Box key={i} sx={{ display: "flex", alignItems: "flex-start", gap: 0.75, mb: 0.5 }}>
                  <WarningAmberIcon sx={{ fontSize: 15, color: "#ff9800", mt: 0.15, flexShrink: 0 }} />
                  <Typography variant="caption">{w}</Typography>
                </Box>
              ))}
            </Section>
          </Grid>
        )}

        {/* ── 4. Confusion Matrix ───────────────────────────────── */}
        {hasCM && (
          <Grid size={{ xs: 12, md: 6 }}>
            <ConfusionMatrixChart data={c.confusion_matrix_data!} />
          </Grid>
        )}

        {/* ── 5. ROC + PR Curves ────────────────────────────────── */}
        {(hasROC || hasPR) && (
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }} />
            <ROCPRChart
              roc={c.roc_curve_data}
              pr={c.pr_curve_data}
              auc={c.auc_roc}
              modelName={c.model_name}
            />
          </Grid>
        )}

        {/* ── 6. Feature Importance ─────────────────────────────── */}
        {hasFI && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Divider sx={{ my: 1 }} />
            <FeatureImportanceChart
              importances={c.feature_importances!}
              title={`Feature Importance — ${c.model_name}`}
            />
          </Grid>
        )}

        {/* ── 7. Learning Curve ─────────────────────────────────── */}
        {hasLC && (
          <Grid size={{ xs: 12, md: hasFI ? 6 : 12 }}>
            <Divider sx={{ my: 1 }} />
            <LearningCurveChart
              data={c.learning_curve!}
              modelName={c.model_name}
              metric={isClassifier ? "Accuracy" : "R²"}
            />
          </Grid>
        )}

        {/* ── 8. Threshold Analysis ─────────────────────────────── */}
        {isClassifier && hasThreshold && (
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }} />
            <Section title="Threshold Analysis (Business Decision Support)">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {["Threshold", "Precision", "Recall", "F1", "FPR", "TP", "FP", "FN", "TN"].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700, py: 0.5 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {c.threshold_analysis!.map((t) => (
                    <TableRow
                      key={t.threshold}
                      sx={t.threshold === 0.5 ? { bgcolor: "rgba(33,150,243,0.08)" } : {}}
                    >
                      <TableCell sx={{ py: 0.5, fontWeight: t.threshold === 0.5 ? 700 : 400 }}>
                        {t.threshold.toFixed(1)}{t.threshold === 0.5 ? " ★" : ""}
                      </TableCell>
                      <TableCell sx={{ py: 0.5 }}>{pct(t.precision)}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{pct(t.recall)}</TableCell>
                      <TableCell sx={{ py: 0.5, fontWeight: 600 }}>{pct(t.f1)}</TableCell>
                      <TableCell sx={{ py: 0.5, color: t.fpr > 0.3 ? "#f44336" : "inherit" }}>
                        {pct(t.fpr)}
                      </TableCell>
                      <TableCell sx={{ py: 0.5 }}>{t.tp.toLocaleString()}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{t.fp.toLocaleString()}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{t.fn.toLocaleString()}</TableCell>
                      <TableCell sx={{ py: 0.5 }}>{t.tn.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                ★ Default threshold = 0.5. Lower threshold → more positives flagged (higher recall, higher FPR).
              </Typography>
            </Section>
          </Grid>
        )}

        {/* ── 9. Model Complexity & Inference ──────────────────── */}
        {hasComplexity && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Divider sx={{ my: 1 }} />
            <Section title="Model Complexity & Inference">
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {c.complexity!.n_estimators != null && (
                  <Chip icon={<AccountTreeIcon />} label={`${c.complexity!.n_estimators} estimators`}
                    size="small" variant="outlined" />
                )}
                {c.complexity!.max_depth != null && (
                  <Chip icon={<AccountTreeIcon />} label={`depth/leaves: ${c.complexity!.max_depth}`}
                    size="small" variant="outlined" />
                )}
                {c.complexity!.model_size_kb != null && (
                  <Chip icon={<StorageIcon />} label={`${c.complexity!.model_size_kb} KB`}
                    size="small" variant="outlined" />
                )}
                {c.complexity!.inference_ms_per_row != null && (
                  <Chip icon={<SpeedIcon />}
                    label={`${c.complexity!.inference_ms_per_row.toFixed(3)} ms/row`}
                    size="small" variant="outlined" />
                )}
                {c.complexity!.batch_throughput_per_sec != null && (
                  <Chip icon={<MemoryIcon />}
                    label={`~${c.complexity!.batch_throughput_per_sec.toLocaleString()} rows/sec`}
                    size="small" variant="outlined" color="primary" />
                )}
              </Box>
            </Section>
          </Grid>
        )}

        {/* ── 10. Hyperparameters ───────────────────────────────── */}
        {hyperKeys.length > 0 && (
          <Grid size={{ xs: 12, md: hasComplexity ? 6 : 12 }}>
            {hasComplexity && <Divider sx={{ my: 1 }} />}
            <Section title="Key Hyperparameters">
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {hyperKeys.map((k) => (
                  <Chip
                    key={k}
                    label={`${k}: ${String(c.hyperparams[k])}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: "0.68rem", fontFamily: "monospace" }}
                  />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
                random_state=42 · n_features={c.n_features ?? "—"}
              </Typography>
            </Section>
          </Grid>
        )}

      </Grid>
    </Box>
  )
}
