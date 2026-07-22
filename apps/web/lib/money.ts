export function minorUnitsToDisplay(amount: string | number | bigint) {
  const value = BigInt(amount);
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatMoney(amount: string | number | bigint, currency = "USDT") {
  return `${currency} ${minorUnitsToDisplay(amount)}`;
}
