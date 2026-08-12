const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function generateGemini({ prompt, systemInstruction, model, apiKey, webGrounding, structuredOutput, signal }) {
  if (!apiKey) throw new Error('Gemini API key chưa được cấu hình trong Settings.');
  if (!model) throw new Error('Chưa chọn model Gemini.');

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];
  const body = {
    contents,
    generationConfig: {
      temperature: 0.4
    }
  };

  if (systemInstruction) body.systemInstruction = { parts: [{ text: systemInstruction }] };

  // Gemini does not allow responseMimeType=application/json together with
  // Google Search grounding/tool use. Nodes still validate/parse the JSON in
  // the CRSM layer, so when web grounding is enabled we deliberately let the
  // model return plain text JSON instead of asking the API for JSON MIME mode.
  if (structuredOutput && !webGrounding) {
    body.generationConfig.responseMimeType = 'application/json';
  }

  if (webGrounding) {
    body.tools = [{ googleSearch: {} }];
  }

  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) {
    const detail = await safeMessage(res);
    throw new Error(`Gemini API lỗi ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const usage = {
    inputTokens: data?.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data?.usageMetadata?.candidatesTokenCount ?? null
  };
  return { text, usage };
}

function safeMessage(res) {
  return res.text().then(t => (t || res.statusText).slice(0, 500)).catch(() => res.statusText);
}
