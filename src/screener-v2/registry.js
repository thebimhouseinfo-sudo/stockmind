export const SANDBOX_REGISTRY = Object.freeze({
  registry_id: 'screener-v2-sandbox',
  registry_version: '2026-08-14.d1-d3-momentum-volume-sandbox',
  calibration_status: 'SANDBOX',
  scope: 'D1_D2_D3_PRICE_DISLOCATION_PLUS_MOMENTUM_VOLUME_SANDBOX',
  effective_date: '2026-08-14',
  parser_version: 'tradingview-clipboard-v2',
  mapping_version: 'tradingview-current-v2',
  evaluation_version: 'screener-v2-sandbox-price-dislocation-momentum-volume',
  classification_version: 'sandbox-classification-v1',
  ranking: {
    registry_id: 'ranking-registry',
    registry_version: 'sandbox-composite-ranking-v1',
    tie_policy_version: 'sandbox-shared-rank-v1',
    percentile_policy: 'DISPLAYED_UNIVERSE_PERCENTILE',
    unknown_policy: 'UNRANKABLE'
  },
  price_dislocation: {
    registry_id: 'derived-metric-registry',
    registry_version: 'sandbox-price-dislocation-v1',
    required_fields: ['price', 'high_52w', 'low_52w'],
    metrics: {
      drawdown_52w: {
        metric_id: 'drawdown_52w',
        version: 'sandbox-v1',
        family: 'PRICE_DISLOCATION',
        formula: '(Price / High_52W) - 1',
        output_type: 'percentage',
        direction: 'CONTEXT_INITIALLY',
        used_by_factors: [],
        critical_inputs: ['price', 'high_52w'],
        anomaly_signal: 'SEVERE_DRAWDOWN'
      },
      upside_to_52w_high: {
        metric_id: 'upside_to_52w_high',
        version: 'sandbox-v1',
        family: 'PRICE_DISLOCATION',
        formula: '(High_52W / Price) - 1',
        output_type: 'percentage',
        direction: 'CONTEXT_INITIALLY',
        used_by_factors: [],
        critical_inputs: ['price', 'high_52w'],
        structural_relationship: 'same_price_to_high_information_as_drawdown_52w'
      },
      position_52w_range: {
        metric_id: 'position_52w_range',
        version: 'sandbox-v1',
        family: 'PRICE_DISLOCATION',
        formula: '(Price - Low_52W) / (High_52W - Low_52W)',
        output_type: 'ratio',
        direction: 'CONTEXT_INITIALLY',
        used_by_factors: [],
        critical_inputs: ['price', 'high_52w', 'low_52w']
      }
    },
    signals: {
      severe_drawdown_threshold: -0.30,
      near_52w_high_threshold: -0.05,
      narrow_range_ratio_threshold: 0.05
    }
  },
  momentum_volume: {
    registry_id: 'derived-metric-registry',
    registry_version: 'sandbox-momentum-volume-v1',
    required_fields: ['perf_1m', 'perf_3m', 'perf_6m'],
    optional_fields: ['perf_1w', 'perf_1y', 'perf_ytd', 'volume', 'relative_volume', 'avg_volume_10d', 'avg_volume_30d', 'avg_volume_60d'],
    metrics: {
      medium_momentum: {
        metric_id: 'medium_momentum',
        version: 'sandbox-v1',
        family: 'MOMENTUM_VOLUME',
        formula: 'weighted average of Perf 1M / 3M / 6M where available',
        output_type: 'percentage_points',
        direction: 'CONTEXT_INITIALLY',
        used_by_factors: [],
        critical_inputs: ['perf_1m', 'perf_3m', 'perf_6m']
      },
      momentum_stack: {
        metric_id: 'momentum_stack',
        version: 'sandbox-v1',
        family: 'MOMENTUM_VOLUME',
        formula: 'count positive available performance periods',
        output_type: 'ratio',
        direction: 'CONTEXT_INITIALLY',
        used_by_factors: [],
        critical_inputs: ['perf_1m', 'perf_3m', 'perf_6m']
      },
      volume_confirmation: {
        metric_id: 'volume_confirmation',
        version: 'sandbox-v1',
        family: 'MOMENTUM_VOLUME',
        formula: 'positive medium momentum plus Relative Volume above sandbox threshold',
        output_type: 'tri_state',
        direction: 'SIGNAL_DERIVED',
        used_by_factors: [],
        critical_inputs: ['relative_volume']
      }
    },
    signals: {
      strong_medium_momentum_threshold: 15,
      weak_medium_momentum_threshold: -10,
      volume_confirmation_rel_vol_threshold: 1.2,
      low_relative_volume_threshold: 0.5
    }
  }
});

export function getSandboxRegistry() {
  return SANDBOX_REGISTRY;
}
