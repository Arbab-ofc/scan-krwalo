export function normalizeTelegramUsername(input: string): string {
  const normalized = input.trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@+/, "");
  if (!/^[A-Za-z0-9_]{5,32}$/.test(normalized)) {
    throw new Error("Invalid Telegram username");
  }
  return normalized;
}

export function telegramContactUrl(username: string): string {
  return `https://t.me/${normalizeTelegramUsername(username)}`;
}
