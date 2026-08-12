import { generateGemini } from './gemini.js';
import { generateOpenAI } from './openai.js';
import { generateOllamaCloud } from './ollama-cloud.js';

export function getProvider(providerId) {
  const providers = {
    gemini: {
      generate: generateGemini,
      supportsWebGrounding: true
    },
    openai: {
      generate: generateOpenAI,
      supportsWebGrounding: false
    },
    ollamaCloud: {
      generate: generateOllamaCloud,
      supportsWebGrounding: false
    }
  };
  const provider = providers[providerId];
  if (!provider) throw new Error(`Provider không tồn tại: ${providerId}`);
  return provider;
}