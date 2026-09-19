/**
 * Картинки к событиям.
 *
 * Сам файл картинки ищется по имени, записанному в контенте: так данные
 * остаются данными, а сборка сама решает, отдать файл отдельно или вшить его
 * в документ. В офлайн-сборке он вшивается целиком — поэтому «один файл,
 * двойной клик с флешки» остаётся правдой и с картинками.
 *
 * Имена собираются разбором путей, а не списком руками: список пришлось бы
 * поддерживать в согласии с папкой, и он бы разошёлся.
 */
const modules = import.meta.glob('../assets/images/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const BY_NAME = new Map<string, string>();
for (const [path, url] of Object.entries(modules)) {
  const name = path.split('/').pop();
  if (name) BY_NAME.set(name, url);
}

/** Адрес картинки по имени файла из контента. Нет файла — нет картинки. */
export function illustrationUrl(file: string): string | undefined {
  return BY_NAME.get(file);
}

/** Имена, для которых картинка есть. По ним контент проверяется тестом. */
export const ILLUSTRATION_FILES: string[] = [...BY_NAME.keys()].sort();
