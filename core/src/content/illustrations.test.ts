import { describe, expect, it } from 'vitest';
import neva1240 from './scenarios/neva-1240.json';
import { validateScenario } from '../validation/schema';
import { scenarios } from '../index';

const scenario = scenarios[0]!;

describe('картинки к событиям', () => {
  it('контент проходит проверку вместе с картинками', () => {
    const { ok, issues } = validateScenario(neva1240);
    expect(issues).toEqual([]);
    expect(ok).toBe(true);
  });

  it('имя файла у каждой картинки своё', () => {
    const files = scenario.events
      .map((e) => e.illustration?.file)
      .filter((f): f is string => Boolean(f));
    expect(files.length).toBeGreaterThan(5);
    expect(new Set(files).size, 'два события ссылаются на один файл').toBe(files.length);
  });

  it('под каждой картинкой есть кому и когда её сделать', () => {
    for (const e of scenario.events) {
      if (!e.illustration) continue;
      const i = e.illustration;
      expect(i.author.trim().length, `${e.id}: не указан автор`).toBeGreaterThan(1);
      expect(i.date.trim().length, `${e.id}: не указана дата`).toBeGreaterThan(1);
      expect(i.title.trim().length, `${e.id}: не указано название`).toBeGreaterThan(2);
      expect(i.caption.length, `${e.id}: подпись слишком коротка`).toBeGreaterThan(40);
      expect(i.sourceUrl, `${e.id}: нет ссылки на источник`).toMatch(/^https:/);
    }
  });

  it('картинку берут только под свободной лицензией', () => {
    for (const e of scenario.events) {
      if (!e.illustration) continue;
      // Схема это уже проверяет, но список лицензий — обещание продукта,
      // и оно должно быть видно в тесте, а не только внутри z-схемы.
      expect(
        e.illustration.license.toLowerCase(),
        `${e.id}: лицензия «${e.illustration.license}» не свободна`,
      ).toMatch(/public domain|cc0|pd-old|pd-art|pd-russia/);
    }
  });

  it('вещь XVI века не выдаётся за свидетельницу битвы', () => {
    // Вот это — ложь, которая дороже всего остального: миниатюра Лицевого
    // свода и икона XVI века сделаны через триста лет после 1240 года.
    // Если дата вещи говорит о позднейших веках или о годе после 1500,
    // пометка «сделано тогда же» стоять не может.
    const later = /(XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI)\s*век|1[5-9]\d\d|20\d\d/;
    for (const e of scenario.events) {
      const i = e.illustration;
      if (!i) continue;
      const made = i.date.split('(')[0]!;
      if (later.test(made)) {
        expect(
          i.contemporaneous,
          `${e.id}: «${i.title}» (${made}) помечена как свидетель той же эпохи`,
        ).toBe(false);
      }
    }
  });

  it('о свидетеле сказано, к какому времени он относится', () => {
    // Дыра, найденная на живых данных: у Волхова в дате стояло просто «река»,
    // год фотографии прятался в скобках — и проверка выше такую запись
    // пропускала. Перед скобками обязан быть назван век или год самого
    // свидетеля, иначе пометка «свидетель той же эпохи» ни на чём не стоит.
    for (const e of scenario.events) {
      const i = e.illustration;
      if (!i) continue;
      const depicts = i.date.split('(')[0]!;
      expect(
        depicts,
        `${e.id}: «${i.title}» — из даты не видно, к какому времени относится сам свидетель (дата: «${i.date}»)`,
      ).toMatch(/век|год/);
    }
  });

  it('есть и вещи той же эпохи, и позднейшие изображения', () => {
    const marks = scenario.events
      .map((e) => e.illustration?.contemporaneous)
      .filter((v): v is boolean => v !== undefined);
    expect(marks).toContain(true);
    expect(marks).toContain(false);
  });

  it('у большинства событий картинка есть, но не у всех', () => {
    const withImage = scenario.events.filter((e) => e.illustration).length;
    expect(withImage).toBeGreaterThanOrEqual(10);
    // Где подлинника нет — там пусто. Приделать «что-нибудь похожее»
    // было бы нарушением главного правила продукта.
    expect(withImage).toBeLessThan(scenario.events.length);
  });
});
