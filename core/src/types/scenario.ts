/**
 * Типы контента «Невский».
 *
 * Главное отличие от обычного квеста: у каждого утверждения на карте и в тексте
 * есть СТАТУС ЗНАНИЯ (certainty). Это требование ТЗ «разделять факт и интерпретацию»,
 * но не сноской мелким шрифтом, а полем данных — чтобы фильтр «показать только факты»
 * и итоговый разбор работали автоматически.
 */

/** Насколько твёрдо мы это знаем. */
export type Certainty =
  | 'fact'     // есть в летописи или документе
  | 'recon'    // вывод историков и археологии
  | 'legend'   // житие, сказание — не документ
  | 'guess';   // наша догадка, спорно

/** Ресурсы: всё в шкале 0..100. */
export interface Resources {
  army: number;
  treasury: number;
  authority: number;
  stability: number;
  /** Давление с Запада: чем выше — тем хуже. Скрытая шкала, не «ресурс». */
  westernThreat: number;
  /** Давление с Востока (Орда). */
  easternThreat: number;
}

export type ResourceKey = keyof Resources;

export const RESOURCE_KEYS: ResourceKey[] = [
  'army', 'treasury', 'authority', 'stability', 'westernThreat', 'easternThreat',
];

/** Подписи и подсказки для интерфейса. */
export const RESOURCE_META: Record<ResourceKey, { label: string; hint: string; hidden?: boolean }> = {
  army:           { label: 'Войско',   hint: 'Дружина и ополчение' },
  treasury:       { label: 'Казна',    hint: 'Серебро, хлеб, припасы' },
  authority:      { label: 'Авторитет', hint: 'Как смотрят на князя Новгород и свои' },
  stability:      { label: 'Стабильность', hint: 'Спокойствие земель' },
  westernThreat:  { label: 'Угроза с Запада', hint: 'Шведы, немцы, датчане', hidden: true },
  easternThreat:  { label: 'Угроза с Востока', hint: 'Орда', hidden: true },
};

/** Точка на карте. */
export interface GeoPoint {
  lat: number;
  lon: number;
}

/** Что карта должна сделать при входе в событие или при выборе варианта. */
export interface MapDirective {
  /** Куда навести взгляд. */
  focus?: GeoPoint & { zoom?: number };
  /** Показать слои/объекты (id из content/map/layers). */
  show?: string[];
  /** Убрать слои/объекты. */
  hide?: string[];
  /** Проиграть маршрут (в демо: 'knyaz' | 'svei'). */
  route?: string | null;
  /** Точки, которые мигнут один раз. */
  pulse?: GeoPoint[];
  /** Альтернативные положения, если точное место неизвестно. */
  alternatives?: Array<GeoPoint & { label: string }>;
  /** Радиус неопределённости вокруг focus, км. Рисуется как «предел знания». */
  uncertaintyKm?: number;
}

export interface Advisor {
  id: string;
  name: string;
  role: string;
  /** Реплика советника. */
  text: string;
  certainty: Certainty;
  portrait?: string;
}

/** Условие показа/срабатывания. */
export type Condition =
  | { type: 'resource_min'; key: ResourceKey; value: number; note?: string }
  | { type: 'resource_max'; key: ResourceKey; value: number; note?: string }
  | { type: 'flag_true'; key: string; note?: string }
  | { type: 'flag_false'; key: string; note?: string };

/** Изменение состояния. */
export type Effect =
  | { type: 'resource'; key: ResourceKey; value: number }
  | { type: 'flag'; key: string; value: boolean };

export interface Choice {
  id: string;
  title: string;
  description?: string;
  effects: Effect[];
  /** Куда идём. null — конец сценария. */
  nextEventId: string | null;
  /** Показывать вариант только при выполнении всех условий. */
  conditions?: Condition[];
  /** Что игрок увидит сразу после выбора. */
  outcomeText?: string;
  /** Поступил бы так же Александр по летописи? Для честного итогового разбора. */
  canonical?: boolean;
  certainty?: Certainty;
  map?: MapDirective;
}

/**
 * Подлинник, которым иллюстрируется событие.
 *
 * Все поля обязательны, и это не формальность: картинка из интернета без
 * автора, даты и лицензии — это картинка, за которую нельзя отвечать. Отдельно
 * стоит `contemporaneous`: вещь XIII века и картина XIX века о XIII веке —
 * разные свидетельства, и путать их нельзя.
 */
export interface Illustration {
  /** файл в папке изображений; по нему ищется сама картинка */
  file: string;
  /** название работы */
  title: string;
  /** автор вещи или «неизвестен»; для фотографии — фотограф */
  author: string;
  /** когда сделана сама вещь, а не когда сфотографирована */
  date: string;
  /** короткое имя лицензии, как его отдаёт хранилище */
  license: string;
  licenseUrl: string;
  /** страница, откуда взято: по ней проверяют лицензию */
  sourceUrl: string;
  /** что это и зачем оно в игре — по-русски, одной-двумя фразами */
  caption: string;
  /**
   * Свидетель эпохи или позднейшее свидетельство о ней.
   * Ложь здесь дороже всего: миниатюра XVI века не свидетель битвы,
   * а её поздний пересказ, и подписана она должна быть именно так.
   *
   * Речь о самом свидетеле, а не о том, когда его сняли. Свидетель эпохи —
   * то, что сделано тогда же или существовало тогда и дошло до наших дней:
   * берестяная грамота, шлем, печать, собор, сама река. Позднейшее
   * свидетельство создано через века после: миниатюра Лицевого свода,
   * житийная икона, гравюра 1720 года, стены крепости XV века.
   * Год съёмки поэтому пишется в скобках, а до скобок обязан быть назван
   * век или год самого свидетеля: иначе пометка ни на чём не стоит.
   */
  contemporaneous: boolean;
}

export interface ScenarioEvent {
  id: string;
  title: string;
  /** Текст события. Живой язык, без псевдоархаики. */
  text: string;
  /** Насколько твёрдо известны сами события. */
  certainty: Certainty;
  /** Откуда мы это знаем (для карточки «источник»). */
  sources: string[];
  location?: GeoPoint & { name: string };
  advisors: Advisor[];
  choices: Choice[];
  /** Справка: что говорит летопись, что житие, чего не знает никто. */
  historicalNote?: string;
  /** Подлинник к событию. Нет подлинника — нет картинки, и это честно. */
  illustration?: Illustration;
  /** Внутрисценарный узел: сюда приходят и отсюда уходят. */
  map?: MapDirective;
  /** Прямая отсылка к листу карты (id слоя/маршрута). */
  ending?: boolean;
}

export interface Scenario {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  startEventId: string;
  year: number;
  /** Хронология эпохи для подвала интерфейса. */
  eraNote?: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedMinutes: number;
  tags: string[];
  published: boolean;
  coverImage?: string;
  /** Стартовые ресурсы. */
  resources: Resources;
  events: ScenarioEvent[];
}

/** Запись о сделанном выборе — основа итогового отчёта. */
export interface ChoiceRecord {
  eventId: string;
  eventTitle: string;
  choiceId: string;
  choiceTitle: string;
  effects: Effect[];
  canonical: boolean;
  certainty: Certainty;
  createdAt: string;
}

export interface Session {
  id: string;
  scenarioId: string;
  userId?: string;
  startedAt: string;
  finishedAt?: string;
  currentEventId: string;
  resources: Resources;
  flags: Record<string, boolean>;
  history: ChoiceRecord[];
  status: 'active' | 'finished' | 'abandoned';
  /** Накопленная «историчность»: сколько решений совпало с летописью. */
  canonicalHits: number;
  canonicalTotal: number;
}

export interface Outcome {
  sessionId: string;
  completed: boolean;
  finalResources: Resources;
  initialResources: Resources;
  totalChoices: number;
  keyDecisions: ChoiceRecord[];
  summaryText: string;
  historicalNotes: string[];
  /** Итоговый счёт 0..100: взвешенная оценка состояния земель. */
  score: number;
  /** Отдельная оценка «насколько поступил как в летописи», 0..100. */
  historicityScore: number;
  /** Разбор спорного: где мы честно расписались в незнании. */
  uncertaintyNotes: string[];
  endingId?: string;
}
