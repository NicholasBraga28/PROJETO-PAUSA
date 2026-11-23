export function checkInUrl(token: string, origin: string): string {
  const path = `/check-in/${encodeURIComponent(token)}`;
  return new URL(path, origin).toString();
}
