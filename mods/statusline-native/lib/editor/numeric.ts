import type { DescribeResult } from '../generated-contracts.ts';
import { text as message } from '../i18n/index.ts';

export function numericDiagnostic(description: DescribeResult, field: NumericField) {
  const range = field === 'padding' ? description.options.padding : description.options['refresh-interval'];
  return message(field === 'refresh_interval' ? 'native.numeric.event' : 'native.numeric.number',
                 {minimum: range.minimum, maximum: range.maximum});
}

export type NumericField = 'padding' | 'refresh_interval';
export const NUMERIC_FIELDS: readonly NumericField[] = [
  'padding',
  'refresh_interval',
];

export function numericValue(
  description: DescribeResult,
  field: NumericField,
  input: string,
):
  | { value: number | 'event'; error?: never }
  | { error: string; value?: never } {
  const text = input.trim();
  const range =
    field === 'padding'
      ? description.options.padding
      : description.options['refresh-interval'];
  if (field === 'refresh_interval' && text === 'event')
    return { value: 'event' };
  if (
    /^\d+$/.test(text) &&
    Number.isSafeInteger(Number(text)) &&
    Number(text) >= range.minimum &&
    Number(text) <= range.maximum
  ) {
    return { value: Number(text) };
  }
  return {
    error: numericDiagnostic(description, field).fallback,
  };
}
