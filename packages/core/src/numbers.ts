/** Fixed-point rounding of the actual IEEE-754 value, with Python's ties-to-even. */
export function fixed(value: number, places: number): string {
  if (!Number.isFinite(value) || !Number.isSafeInteger(places) || places < 0 || places > 20) throw new RangeError('Invalid fixed-point number');
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value);
  const bits = view.getBigUint64(0), negative = bits >> 63n === 1n;
  const exponent = Number((bits >> 52n) & 0x7ffn);
  const mantissa = (bits & 0xfffffffffffffn) + (exponent ? 1n << 52n : 0n);
  const shift = (exponent || 1) - 1023 - 52;
  let numerator = mantissa * 10n ** BigInt(places), denominator = 1n;
  if (shift >= 0) numerator <<= BigInt(shift); else denominator <<= BigInt(-shift);
  let rounded = numerator / denominator;
  const remainder = numerator % denominator;
  if (2n * remainder > denominator || (2n * remainder === denominator && rounded % 2n !== 0n)) rounded++;
  const digits = String(rounded).padStart(places + 1, '0');
  return (negative ? '-' : '') + (places ? digits.slice(0, -places) + '.' + digits.slice(-places) : digits);
}
