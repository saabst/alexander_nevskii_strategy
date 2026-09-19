import { RESOURCE_META, type Resources } from '@nevsky/core';
import EtchedScale from './EtchedScale';
import Icon from './Icon';
import { TONE_COLOR, toneOf } from '../lib/effects';

const VERDICT = {
  good: 'спокойно',
  warn: 'тревожно',
  bad: 'опасно',
} as const;

/**
 * Два скрытых давления — «градусник», а не полоса ресурса.
 * Разница принципиальная: полосу хочется заполнить до конца, а градусник —
 * сбить. Игрок должен понимать, что высокое давление само по себе не «плюс».
 */
function Gauge({ value, label, hint }: { value: number; label: string; hint: string }) {
  const tone = toneOf('westernThreat', value);
  return (
    <div>
      <div className="flex items-baseline gap-2 text-sm">
        <Icon name="flame" size={16} className="text-ink-soft" />
        <span>{label}</span>
        <span className="ml-auto font-semibold tabular-nums" style={{ color: TONE_COLOR[tone] }}>
          {VERDICT[tone]}
        </span>
      </div>
      {/* Градусник, а не полоса: зарубка показывает, где давление стоит сейчас.
          Полосу хочется заполнить до конца, а градусник — сбить. */}
      <EtchedScale
        value={value}
        pinAt={value}
        tone={tone}
        label={label}
        valueText={`${label}: ${VERDICT[tone]}`}
        className="mt-1"
      />
      <div className="mt-0.5 text-xs text-ink-soft">{hint}</div>
    </div>
  );
}

export default function ThreatGauge({ resources }: { resources: Resources }) {
  return (
    <div className="space-y-3">
      <Gauge
        value={resources.westernThreat}
        label={RESOURCE_META.westernThreat.label}
        hint={RESOURCE_META.westernThreat.hint}
      />
      <Gauge
        value={resources.easternThreat}
        label={RESOURCE_META.easternThreat.label}
        hint={RESOURCE_META.easternThreat.hint}
      />
    </div>
  );
}
