export function spacedPairingDigits(code: string) {
  return [...code].join(", ");
}

export function spokenPairingExpiry(isoDate: string) {
  const date = new Date(isoDate);
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const time = values.minute === "00" ? `${values.hour}h` : `${values.hour}h${values.minute}`;
  return `${values.weekday}, ${values.day} de ${values.month} de ${values.year}, às ${time}`;
}
