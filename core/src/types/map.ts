import type { Certainty, GeoPoint } from './scenario';

/**
 * Объекты карты — отдельно от контента.
 *
 * Зачем вынесено в данные: контент ссылается на места ПО ИМЕНИ
 * (`show: ["svei-camp"]`), но самих мест в коде не было — демо рисовало всё
 * сразу и всегда, а механизма «показать это, убрать то» не существовало.
 * Теперь карта — функция от хода игры: прошли разведку — появился путь
 * сторожи, нашли лагерь — появился лагерь.
 *
 * Каждому объекту положены `note` и `source`: из этих полей собирается
 * научный лист («аппарат»), поэтому пустые они бессмысленны.
 */

/** Форма знака. Меняется только вместе с данными — от неё зависит рисунок. */
export type PlaceKind =
  | 'city'
  | 'fortress'
  | 'battle'
  | 'camp'
  | 'pogost'
  | 'hoard';

/** Куда ставить подпись относительно знака. */
export type LabelSide = 'r' | 'l' | 't' | 'b' | 'rt' | 'lt' | 'rb' | 'lb';

export interface MapPlace {
  /** id, на который ссылается контент в show/hide */
  id: string;
  /** как называли тогда */
  name: string;
  /** как называется сегодня — только если иначе */
  now?: string;
  lat: number;
  lon: number;
  kind: PlaceKind;
  certainty: Certainty;
  labelSide?: LabelSide;
  /** видно всегда, без ссылки из контента: география региона */
  base?: boolean;
  /** тесная группа (устье Невы): на общем плане уходит во врезку-лупу */
  cluster?: string;
  /** подписывать и на общем плане, хотя место ушло во врезку */
  mainLabel?: boolean;
  /** во сколько раз отодвинуть подпись: нужно там, где рядом стоят два знака */
  labelOffset?: number;
  /**
   * Подпись к уже нарисованной зарубке, без своей.
   *
   * Так показана добыча: она осталась там же, где был бой, и вторая зарубка
   * в той же точке слиплась бы с первой. Одна точка — две подписи, соединённые
   * выноской.
   */
  sameSpot?: boolean;
  /** с какого увеличения показывать на самой карте */
  minZoom?: number;
  /** что это за место — для научного листа */
  note?: string;
  /** откуда знаем — для научного листа */
  source?: string;
}

/** Вид области. `zone` — предел знания, `phenomenon` — природное явление. */
export type AreaKind = 'land' | 'water' | 'zone' | 'phenomenon';

export interface MapArea {
  id: string;
  label: string;
  lat: number;
  lon: number;
  kind: AreaKind;
  certainty: Certainty;
  /** полуоси эллипса в градусах — для zone и phenomenon */
  rx?: number;
  ry?: number;
  rot?: number;
  /** видно всегда: подписи земель и морей */
  base?: boolean;
  /**
   * С какой стороны пятна стоит название. По умолчанию снизу: сверху его
   * перебивают подписи земель. Но если снизу стоит соседняя зона, название
   * уходит наверх — иначе две подписи лягут друг на друга.
   */
  labelSide?: 'above' | 'below';
  minZoom?: number;
  /**
   * Куда идёт вода — от и до. Нужно для волховского «взвода»: это не маршрут
   * дружины, а само явление, и показать его линией пути было бы враньём.
   */
  arrow?: { from: GeoPoint; to: GeoPoint };
  note?: string;
  source?: string;
}

/** Чего в 1240 году ещё нет: города позднейших веков. */
export interface MapGhost {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** «осн. 1293» — чтобы год был виден рядом с именем, а не в сноске */
  year: string;
  cluster?: string;
  note?: string;
}

/**
 * Путь на карте.
 *
 * Геометрия маршрутов лежит в geography.json (она собрана по настоящим руслам
 * рек и прошла растровую проверку «вода/суша»), здесь — только смысл:
 * что это за путь, насколько он твёрд и откуда взят.
 */
export interface MapRouteDef {
  id: string;
  /** id маршрута в geography.routes */
  from: string;
  label: string;
  certainty: Certainty;
  /** идти по маршруту назад */
  reverse?: boolean;
  /**
   * Доля пути [от, до], 0..1. Нужна там, где известна только часть дороги:
   * сторожа ушла к Неве и вернулась, но своего описания хода не оставила.
   */
  portion?: [number, number];
  note?: string;
}

export interface MapContent {
  id: string;
  /**
   * Окно врезки-лупы: центр и полуразмеры в градусах. Вынесено в данные,
   * потому что «где тесно» — свойство этих мест, а не вёрстки.
   */
  loupe?: {
    /** какую тесную группу показывает врезка: имя живёт здесь, а не в коде */
    cluster: string;
    lat: number;
    lon: number;
    dLat: number;
    dLon: number;
  };
  places: MapPlace[];
  areas: MapArea[];
  ghosts: MapGhost[];
  routes: MapRouteDef[];
}

/** Что на карте открыто прямо сейчас. */
export interface LayerState {
  show: ReadonlySet<string>;
  /**
   * Тумблер «чего ещё нет» — отдельно от show: это не знание игрока о 1240
   * годе, а сравнение с сегодняшним днём, и включать его должен он сам.
   */
  ghosts: boolean;
}
