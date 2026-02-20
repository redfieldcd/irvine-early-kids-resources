/**
 * Replaces {key} placeholders in a translation string with provided values.
 * Example: interpolate("{count} resources", { count: 5 }) => "5 resources"
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>
): string {
  return template.replace(
    /\{(\w+)\}/g,
    (_, key) => String(values[key] ?? `{${key}}`)
  );
}
