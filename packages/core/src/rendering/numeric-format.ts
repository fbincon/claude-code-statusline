/** Python's general-format significant digits, rounded from the exact binary64. */
export function general(value: number, precision = 6): string {
    if (!Number.isFinite(value) || !Number.isSafeInteger(precision) || precision < 1 || precision > 20)
        throw new RangeError('Invalid general format');
    const negative = value < 0 || Object.is(value, -0), sign = negative ? '-' : '', absolute = Math.abs(value);
    if (absolute === 0)
        return sign + '0';
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, absolute);
    const bits = view.getBigUint64(0), binaryExponent = Number(bits >> 52n & 0x7ffn);
    let numerator = (bits & 0xfffffffffffffn) + (binaryExponent ? 1n << 52n : 0n), denominator = 1n;
    const shift = (binaryExponent || 1) - 1023 - 52;
    if (shift >= 0)
        numerator <<= BigInt(shift);
    else
        denominator <<= BigInt(-shift);
    let exponent = Number(absolute.toExponential().split('e')[1]);
    const atLeastPower = (power: number) => power >= 0 ? numerator >= denominator * 10n ** BigInt(power) : numerator * 10n ** BigInt(-power) >= denominator;
    while (!atLeastPower(exponent))
        exponent--;
    while (atLeastPower(exponent + 1))
        exponent++;
    const places = precision - 1 - exponent;
    if (places >= 0)
        numerator *= 10n ** BigInt(places);
    else
        denominator *= 10n ** BigInt(-places);
    let rounded = numerator / denominator;
    const remainder = numerator % denominator;
    if (2n * remainder > denominator || 2n * remainder === denominator && rounded % 2n !== 0n)
        rounded++;
    if (rounded >= 10n ** BigInt(precision)) {
        rounded /= 10n;
        exponent++;
    }
    const digits = String(rounded).padStart(precision, '0');
    if (exponent < -4 || exponent >= precision) {
        const fraction = digits.slice(1).replace(/0+$/u, '');
        return sign + digits[0] + (fraction ? '.' + fraction : '') + 'e' + (exponent < 0 ? '-' : '+') + String(Math.abs(exponent)).padStart(2, '0');
    }
    const position = exponent + 1;
    const text = position <= 0 ? '0.' + '0'.repeat(-position) + digits : digits.slice(0, position) + (position < digits.length ? '.' + digits.slice(position) : '');
    return sign + (text.includes('.') ? text.replace(/0+$/u, '').replace(/\.$/u, '') : text);
}
export function grouped(value: string): string { const [whole, fraction] = value.split('.'); return whole!.replace(/\B(?=(?:\d{3})+(?!\d))/gu, ',') + (fraction === undefined ? '' : '.' + fraction); }
