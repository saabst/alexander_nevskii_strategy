import { RESOURCE_META, type ResourceKey, type Resources } from '@nevsky/core';
import EtchedScale from './EtchedScale';
import Icon, { type IconName } from './Icon';
import { toneOf } from '../lib/effects';

const ICON_OF: Partial<Record<ResourceKey, IconName>> = {
  army: 'shield',
  treasury: 'coins',
  authority: 'crown',
  stability: 'scales',
};

const OPEN: ResourceKey[] = ['army', 'treasury', 'authority', 'stability'];

/**
 * Четыре открытые шкалы. При наведении на вариант шкала показывает, куда
 * сдвинется, и оставляет зарубку там, где стоит сейчас: решение должно
 * взвешиваться, а не угадываться.
 */
export default function ResourcePanel({
  resources, preview, className = '',
}: { resources: Resources; preview?: Partial<Resources>; className?: string }) {
  return (
    <ul className={`space-y-2.5 ${className}`}>
      {OPEN.map((key) => {
        const value = resources[key];
        const delta = preview?.[key] ?? 0;
        const after = Math.max(0, Math.min(100, value + delta));
        const meta = RESOURCE_META[key];
        const tone = toneOf(key, after);
        return (
          <li key={key}>
            <div className="flex items-baseline gap-2 text-sm">
              <Icon name={ICON_OF[key] ?? 'shield'} size={16} className="text-ink-soft" />
              <span>{meta.label}</span>
              <span className="ml-auto tabular-nums">{value}</span>
              {delta !== 0 && (
                <span
                  className="tabular-nums text-xs font-semibold"
                  style={{ color: delta > 0 ? 'var(--color-fact)' : 'var(--color-guess)' }}
                >
                  {delta > 0 ? `+${delta}` : delta} → {after}
                </span>
              )}
            </div>
            <EtchedScale
              value={delta !== 0 ? after : value}
              pinAt={delta !== 0 ? value : undefined}
              tone={tone}
              label={meta.label}
              className="mt-1"
            />
            <div className="mt-0.5 text-xs text-ink-soft">{meta.hint}</div>
          </li>
        );
      })}
    </ul>
  );
}
