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

/** Correctly rounded integer true division without an intermediate float cast. */
export function divideIntegers(numerator: bigint, denominator: bigint): number {
  if (denominator === 0n) throw new RangeError('division by zero');
  const negative = (numerator < 0n) !== (denominator < 0n);
  const n = numerator < 0n ? -numerator : numerator, d = denominator < 0n ? -denominator : denominator;
  if (n === 0n) return negative ? -0 : 0;
  let exponent = n.toString(2).length - d.toString(2).length;
  if (exponent >= 0 ? n < d << BigInt(exponent) : n << BigInt(-exponent) < d) exponent--;
  if (exponent > 1023) throw new RangeError('integer division result too large for a float');
  const shift = exponent < -1022 ? 1074 : 52 - exponent;
  const top = shift >= 0 ? n << BigInt(shift) : n, bottom = shift >= 0 ? d : d << BigInt(-shift);
  let quotient = top / bottom;
  const remainder = top % bottom;
  if (2n * remainder > bottom || 2n * remainder === bottom && quotient % 2n !== 0n) quotient++;
  const value = Number(quotient) * 2 ** (exponent < -1022 ? -1074 : exponent - 52);
  if (!Number.isFinite(value)) throw new RangeError('integer division result too large for a float');
  return negative ? -value : value;
}
