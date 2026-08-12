const OLLAMA_CLOUD_ENDPOINT = 'https://ollama.com/v1/chat/completions';

export async function generateOllamaCloud({ prompt, systemInstruction, model, apiKey, structuredOutput, signal }) {
  if (!apiKey) throw new Error('Ollama Cloud API key chưa được cấu hình trong Settings.');
  if (!model) throw new Error('Chưa chọn model Ollama Cloud.');

  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    temperature: 0.4
  };

  if (structuredOutput) body.response_format = { type: 'json_object' };

  const res = await fetch(OLLAMA_CLOUD_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) throw new Error(`Ollama Cloud API lỗi ${res.status}: ${await safeMessage(res)}`);
  if (res.status === 403) throw new Error('Ollama Cloud từ chối truy cập — có thể bị chặn CORS.');

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const usage = {
    inputTokens: data?.usage?.prompt_tokens ?? null,
    outputTokens: data?.usage?.completion_tokens ?? null
  };
  return { text, usage };
}

function safeMessage(res) {
  return res.text().then(t => (t || res.statusText).slice(0, 500)).catch(() => res.statusText);
}