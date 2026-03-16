import { http, HttpResponse } from 'msw'

const responses: Record<string, string> = {
  default: "I'm your AutoML assistant. I can help you understand your model, interpret predictions, and suggest next steps in your pipeline.",
  imbalance: "The class imbalance (95/5) is quite severe. SMOTE oversampling is recommended to generate synthetic minority samples. After applying SMOTE, your minority class ratio will increase to ~23%, which should significantly improve recall for churned customers.",
  predictions: "The top model (LightGBM) primarily uses credit_score, age, and balance to make predictions. Low credit scores below 500 strongly increase churn probability, while long tenure and high balance reduce churn risk.",
  next: "Based on your current pipeline state: ✅ Profile complete, ✅ EDA complete. Recommended next steps: 1) Apply cleaning plan (handle 38% missing credit_score), 2) Configure SMOTE sampling, 3) Build feature interactions, 4) Launch AutoML training.",
}

export const chatHandlers = [
  http.post('/api/chat', async ({ request }) => {
    const body = await request.json() as { message: string }
    const msg = body.message.toLowerCase()
    let reply = responses.default
    if (msg.includes('imbalance') || msg.includes('smote')) reply = responses.imbalance
    else if (msg.includes('predict') || msg.includes('explain')) reply = responses.predictions
    else if (msg.includes('next') || msg.includes('recommend')) reply = responses.next
    await new Promise((r) => setTimeout(r, 800))
    return HttpResponse.json({ role: 'assistant', content: reply, id: Date.now().toString(), timestamp: new Date().toISOString() })
  }),
]
