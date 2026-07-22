const SCALE = 100n;

export function displayToMinorUnits(input: string): bigint {
  const normalized = input.trim().replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Invalid money amount");
  }
  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(2, "0"));
}

export function minorUnitsToDisplay(amount: bigint | number | string): string {
  const value = BigInt(amount);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(2, "0");
  return `${sign}${whole}.${fraction}`;
}

export function formatMoney(amount: bigint | number | string, currency = "INR"): string {
  const symbol = currency === "INR" ? "Rs. " : currency === "USDT" ? "USDT " : `${currency} `;
  return `${symbol}${minorUnitsToDisplay(amount)}`;
}
