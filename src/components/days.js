// Days and times as Irish readers see them. No imports, so scripts/days.test.mjs can run it in Node.

// "Today", "Tomorrow" or "Yesterday" for a day ("YYYY-MM-DD", or a Date at midnight UTC),
// by the reader's date in Ireland; "" for any other day. Worked out in the browser, so a
// page built yesterday still says the right thing today.
export const relativeDay = (day, now = new Date()) => {
  const text = day instanceof Date ? day.toISOString().slice(0, 10) : String(day);
  const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Dublin"}).format(now);
  const offset = Math.round((Date.parse(`${text}T00:00Z`) - Date.parse(`${today}T00:00Z`)) / 864e5);
  return {"-1": "Yesterday", 0: "Today", 1: "Tomorrow"}[offset] ?? "";
};

// The time of day in Ireland, e.g. "17:00".
export const irishClock = (date) =>
  date.toLocaleString("en-IE", {timeZone: "Europe/Dublin", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});

// The date in Ireland `offset` days from now, as "YYYY-MM-DD": irishDay(1) is tomorrow.
export const irishDay = (offset = 0, now = new Date()) => {
  const today = new Intl.DateTimeFormat("en-CA", {timeZone: "Europe/Dublin"}).format(now);
  return new Date(Date.parse(`${today}T00:00Z`) + offset * 864e5).toISOString().slice(0, 10);
};
