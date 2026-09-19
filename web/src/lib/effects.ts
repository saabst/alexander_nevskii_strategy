import type { Choice, Effect, ResourceKey, Session } from '@nevsky/core';
import { RESOURCE_META, checkCondition } from '@nevsky/core';

const SIGN = (v: number) => (v > 0 ? '+' : '');

/** Один эффект — по-русски и со знаком. */
export function describeEffect(e: Effect): string {
  if (e.type === 'flag') return '';           // флаги игроку не показываем: это внутреннее
  const label = RESOURCE_META[e.key].label.toLowerCase();
  return `${label} ${SIGN(e.value)}${e.value}`;
}

/** Все ресурсные эффекты варианта — списком для карточки выбора. */
export function describeEffects(effects: Effect[]): string[] {
  return effects.map(describeEffect).filter(Boolean);
}

/**
 * Почему вариант недоступен. Игрок обязан видеть причину, а не пустую кнопку:
 * «спрятано» — то же самое, что «сломано».
 */
export function blockedReason(session: Session, choice: Choice): string | null {
  if (!choice.conditions?.length) return null;
  for (const c of choice.conditions) {
    if (checkCondition(session, c)) continue;
    switch (c.type) {
      case 'resource_min':
        return `нужно ${RESOURCE_META[c.key].label.toLowerCase()} не меньше ${c.value}, а у вас ${session.resources[c.key]}`;
      case 'resource_max':
        return `${RESOURCE_META[c.key].label} выше ${c.value} — так нельзя`;
      case 'flag_true':
        return 'этот ход недоступен: раньше не сложилось';
      case 'flag_false':
        return 'этот ход больше недоступен';
    }
  }
  return null;
}

/** Три тона шкалы. Вынесены в тип: их используют и панель ресурсов, и шкалы давлений. */
export type Tone = 'bad' | 'warn' | 'good';

/** Раскраска шкалы: опасно / терпимо / хорошо. */
export function toneOf(key: ResourceKey, value: number): Tone {
  const threat = key === 'westernThreat' || key === 'easternThreat';
  if (threat) return value >= 70 ? 'bad' : value >= 45 ? 'warn' : 'good';
  return value <= 25 ? 'bad' : value <= 45 ? 'warn' : 'good';
}

export const TONE_COLOR: Record<Tone, string> = {
  bad: 'var(--color-guess)',
  warn: 'var(--color-recon)',
  good: 'var(--color-fact)',
};
