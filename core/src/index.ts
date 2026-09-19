/**
 * Публичный интерфейс пакета @nevsky/core.
 *
 * Здесь только то, что нужно интерфейсу: типы, движок, валидация и контент.
 * Никакого React, никакой сети, никаких ключей — пакет обязан работать в тестах,
 * в браузере и на сервере одинаково.
 */
export * from './types/scenario';
export * from './types/map';
export * from './engine';
export * from './validation/schema';
export * from './validation/map-schema';
export * from './storage/persist';
export * from './map/projection';
export * from './map/geography';
export * from './map/view';
export * from './map/layers';
export * from './map/routes';

import type { Scenario } from './types/scenario';
import type { MapContent } from './types/map';
import neva1240 from './content/scenarios/neva-1240.json';
import neva1240Map from './content/map/neva-1240.map.json';

/** Все опубликованные сценарии. Пока один — «Нева, 1240». */
export const scenarios: Scenario[] = [neva1240 as unknown as Scenario];

/** Объекты карты по сценариям. Ключ — id самого набора, а не сценария. */
export const mapContents: MapContent[] = [neva1240Map as unknown as MapContent];

export function getMapById(id: string): MapContent | undefined {
  return mapContents.find((m) => m.id === id);
}

export function getScenarioBySlug(slug: string): Scenario | undefined {
  return scenarios.find((s) => s.slug === slug && s.published);
}

export function getScenarioById(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
