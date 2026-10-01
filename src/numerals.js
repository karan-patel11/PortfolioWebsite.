export function roman(value) {
  let remaining = Math.max(1, Math.trunc(value)), result = '';
  for (const [number, symbol] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) {
    while (remaining >= number) { result += symbol; remaining -= number; }
  }
  return result;
}
