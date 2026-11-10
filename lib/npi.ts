export function isValidNpi(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const payload = `80840${value.slice(0, 9)}`;
  let sum = 0;
  let doubleDigit = true;
  for (let index = payload.length - 1; index >= 0; index -= 1) {
    let digit = Number(payload[index]);
    if (doubleDigit) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit; doubleDigit = !doubleDigit;
  }
  return (10 - (sum % 10)) % 10 === Number(value[9]);
}

export function formatPostalCode(value = ""): string {
  return value.length === 9 ? `${value.slice(0, 5)}-${value.slice(5)}` : value;
}
