import { getProviderConfig, getAssignment } from './settings.js';

export const NODE_REQUIREMENTS = {
  node1: { webGrounding: true, structuredOutput: true },
  node2: { webGrounding: true, structuredOutput: true },
  node3: { webGrounding: false, structuredOutput: true },
  node4: { webGrounding: true, structuredOutput: true },
  node5: { webGrounding: false, structuredOutput: true },
  node6a: { webGrounding: false, structuredOutput: false },
  node6b: { webGrounding: false, structuredOutput: false }
};

export async function resolveProviderModel(nodeId, settings) {
  const assignment = getAssignment(settings, nodeId);
  if (!assignment) throw new Error(`Chưa có gán model cho node ${nodeId}.`);
  if (!assignment.enabled) throw new Error(`Node ${nodeId} đang bị tắt (disabled) trong Settings.`);
  if (!assignment.provider) throw new Error(`Node ${nodeId} chưa chọn provider.`);
  if (assignment.provider === 'local') return { local: true, nodeId };

  const providerCfg = getProviderConfig(settings, assignment.provider);
  if (!providerCfg) throw new Error(`Provider "${assignment.provider}" chưa được cấu hình.`);
  if (!providerCfg.apiKey) {
    throw new Error(
      `Node ${nodeId} dùng provider "${assignment.provider}" nhưng chưa cấu hình API key. Vào tab CRSM → Settings để thêm key.`
    );
  }

  const model = (providerCfg.models || []).find(m => m.id === assignment.model);
  if (!model) {
    throw new Error(
      `Node ${nodeId} trỏ tới model "${assignment.model}" nhưng không tồn tại trong provider "${assignment.provider}".`
    );
  }

  const requirements = NODE_REQUIREMENTS[nodeId] || {};
  const capabilities = model.capabilities || {};

  if (requirements.webGrounding && !capabilities.webGrounding) {
    throw new Error(
      `Node ${nodeId} yêu cầu web grounding nhưng model "${assignment.model}" (${assignment.provider}) không hỗ trợ. Chọn model khác hoặc thay provider.`
    );
  }
  if (requirements.structuredOutput && !capabilities.structuredOutput) {
    throw new Error(
      `Node ${nodeId} yêu cầu structured output nhưng model "${assignment.model}" (${assignment.provider}) không hỗ trợ.`
    );
  }

  return {
    local: false,
    nodeId,
    provider: assignment.provider,
    model: assignment.model,
    modelCfg: model,
    apiKey: providerCfg.apiKey,
    webGrounding: !!capabilities.webGrounding,
    structuredOutput: !!capabilities.structuredOutput
  };
}
