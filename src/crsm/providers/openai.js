const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

export async function generateOpenAI({ prompt, systemInstruction, model, apiKey, structuredOutput, signal }) {
  if (!apiKey) throw new Error('OpenAI API key chưa được cấu hình trong Settings.');
  if (!model) throw new Error('Chưa chọn model OpenAI.');

  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const body = {
    model,
    messages,
    temperature: 0.4
  };

  if (structuredOutput) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body),
    signal
  });

  if (!res.ok) throw new Error(`OpenAI API lỗi ${res.status}: ${await safeMessage(res)}`);

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