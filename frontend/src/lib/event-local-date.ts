// Convierte la hora elegida en el recinto a un instante con offset explícito para la API.
export function localDateWithOffset(input: string, timezone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(input);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match.map(Number);
  if (year < 100) return null;
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(nominal);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day ||
      check.getUTCHours() !== hour || check.getUTCMinutes() !== minute) return null;
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "shortOffset",
    });
  } catch { return null; }
  const matches: number[] = [];
  for (const probe of [nominal - 86_400_000, nominal, nominal + 86_400_000]) {
    const zone = formatter.formatToParts(probe).find((part) => part.type === "timeZoneName")?.value ?? "";
    const offset = /^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/.exec(zone);
    if (!offset) return null;
    const minutes = offset[1] ? (offset[1] === "+" ? 1 : -1) * (Number(offset[2]) * 60 + Number(offset[3] ?? 0)) : 0;
    if (matches.includes(minutes)) continue;
    const actual = formatter.formatToParts(nominal - minutes * 60_000);
    const part = (kind: string) => Number(actual.find((item) => item.type === kind)?.value);
    if (part("year") === year && part("month") === month && part("day") === day &&
        part("hour") === hour && part("minute") === minute) matches.push(minutes);
  }
  if (matches.length !== 1) return null; // Hora inexistente o ambigua por cambio de horario.
  const offset = matches[0];
  const sign = offset < 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  return `${input}:00${sign}${String(Math.floor(absolute / 60)).padStart(2, "0")}:${String(absolute % 60).padStart(2, "0")}`;
}

export function dateInputValue(instant: string | null, timezone: string): string {
  if (!instant) return "";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit",
      day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
    const part = (kind: string) => parts.find((item) => item.type === kind)?.value ?? "";
    return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
  } catch { return ""; }
}
