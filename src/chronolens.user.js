// ==UserScript==
// @name         ChronoLens — Date & Calendar Intelligence Toolkit
// @name:tr      ChronoLens — Tarih ve Takvim Araç Seti
// @namespace    https://jwcalendar.com/
// @version      1.0.0
// @description  Inspect selected dates, ISO weeks, calendar arithmetic, time zones, DST transitions and ICS events locally in your browser.
// @description:tr Seçili tarihleri inceleyin; ISO hafta, takvim işlemleri, saat dilimleri, DST geçişleri ve ICS etkinliklerini tarayıcınızda yerel olarak yönetin.
// @author       Karen Cohen
// @license      MIT
// @homepageURL  https://jwcalendar.com/
// @supportURL   https://github.com/karencohenjw/chronolens-userscript/issues
// @match        http://*/*
// @match        https://*/*
// @run-at       document-idle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.registerMenuCommand
// ==/UserScript==

/* ChronoLens is deliberately self-contained and readable for Greasy Fork review. */
(function chronolensModule(scope) {
  'use strict';

  const DAY_MS = 86400000;
  const DEFAULT_ZONES = ['UTC', 'Europe/Istanbul', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'];
  const DEFAULTS = { weekStart: 'monday', dateOrder: 'ask', locale: 'en-US', hourCycle: '24', zones: DEFAULT_ZONES, selectionBubble: false, theme: 'system', showIsoWeeks: true, icsDurationMinutes: 60 };

  function isLeapYear(year) { return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0); }
  function daysInMonth(year, month) {
    if (!Number.isInteger(month) || month < 1 || month > 12) return 0;
    return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  }
  function isCivilDate(y, m, d) { return Number.isInteger(y) && y >= 1 && y <= 9999 && Number.isInteger(m) && Number.isInteger(d) && d >= 1 && d <= daysInMonth(y, m); }
  function utcDate(y, m, d, hour = 0, minute = 0, second = 0, ms = 0) {
    const date = new Date(0);
    date.setUTCFullYear(y, m - 1, d);
    date.setUTCHours(hour, minute, second, ms);
    return date;
  }
  function weekday(y, m, d) { return utcDate(y, m, d).getUTCDay(); }
  function ordinalDay(y, m, d) { return Math.round((utcDate(y, m, d) - utcDate(y, 1, 1)) / DAY_MS) + 1; }
  function isoWeek(y, m, d) {
    const date = utcDate(y, m, d);
    const isoDay = (date.getUTCDay() + 6) % 7 + 1;
    date.setUTCDate(date.getUTCDate() + 4 - isoDay);
    const weekYear = date.getUTCFullYear();
    const firstThursday = utcDate(weekYear, 1, 4);
    const firstIsoDay = (firstThursday.getUTCDay() + 6) % 7 + 1;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstIsoDay + 1);
    const week = Math.floor((utcDate(y, m, d) - firstThursday) / (7 * DAY_MS)) + 1;
    return { year: weekYear, week, weekday: isoDay, text: `${weekYear}-W${String(week).padStart(2, '0')}-${isoDay}` };
  }
  function toIsoDate({ year, month, day }) { return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
  function addDays(civil, amount) {
    const date = utcDate(civil.year, civil.month, civil.day);
    date.setUTCDate(date.getUTCDate() + amount);
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }
  function addMonths(civil, amount) {
    if (!Number.isInteger(amount) || Math.abs(amount) > 120000) throw new RangeError('Month amount is outside the supported range.');
    const index = civil.year * 12 + (civil.month - 1) + amount;
    const year = Math.floor(index / 12); const month = index - year * 12 + 1;
    if (year < 1 || year > 9999) throw new RangeError('Result is outside the supported year range.');
    return { year, month, day: Math.min(civil.day, daysInMonth(year, month)) };
  }
  function addYears(civil, amount) { return addMonths(civil, amount * 12); }
  function daysBetween(a, b) { return Math.round((utcDate(b.year, b.month, b.day) - utcDate(a.year, a.month, a.day)) / DAY_MS); }
  function calendarDifference(start, end) {
    const sign = daysBetween(start, end) < 0 ? -1 : 1;
    let a = sign < 0 ? end : start; let b = sign < 0 ? start : end;
    let years = b.year - a.year; let cursor = addYears(a, years);
    if (daysBetween(cursor, b) < 0) { years--; cursor = addYears(a, years); }
    let months = 0;
    while (months < 11 && daysBetween(addMonths(cursor, 1), b) >= 0) { cursor = addMonths(cursor, 1); months++; }
    const days = daysBetween(cursor, b) * sign || 0;
    return { years: years * sign, months: months * sign, days };
  }
  function inspectCivil(civil) {
    if (!isCivilDate(civil.year, civil.month, civil.day)) throw new RangeError('Invalid civil date.');
    const wk = isoWeek(civil.year, civil.month, civil.day);
    const yearLength = isLeapYear(civil.year) ? 366 : 365;
    const prior = addDays(civil, -1); const next = addDays(civil, 1);
    return { isoDate: toIsoDate(civil), year: civil.year, month: civil.month, day: civil.day, weekday: weekday(civil.year, civil.month, civil.day), ordinal: ordinalDay(civil.year, civil.month, civil.day), isoWeek: wk, quarter: Math.floor((civil.month - 1) / 3) + 1, daysInMonth: daysInMonth(civil.year, civil.month), daysInYear: yearLength, daysRemainingInYear: yearLength - ordinalDay(civil.year, civil.month, civil.day), leapYear: isLeapYear(civil.year), previousDate: toIsoDate(prior), nextDate: toIsoDate(next) };
  }

  const MONTHS = { january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3, april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9, october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12 };
  function validClock(h, min, sec, ms = 0) { return h >= 0 && h <= 23 && min >= 0 && min <= 59 && sec >= 0 && sec <= 59 && ms >= 0 && ms <= 999; }
  function parseInput(value, options = {}) {
    const raw = String(value ?? '').trim();
    if (!raw) return { status: 'invalid', reason: 'Enter a date, date-time, or Unix timestamp.' };
    let m;
    const rfc = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?([Zz]|[+-]\d{2}:?\d{2})$/;
    if ((m = raw.match(rfc))) {
      const [, ys, mos, ds, hs, mis, ss = '0', frac = '', zone] = m;
      const y = +ys, mo = +mos, d = +ds, h = +hs, mi = +mis, s = +ss, milli = +(frac.slice(0, 3).padEnd(3, '0'));
      if (!isCivilDate(y, mo, d) || !validClock(h, mi, s, milli)) return { status: 'invalid', reason: 'The date or time is outside the valid calendar range.' };
      let offset = 0;
      if (zone.toUpperCase() !== 'Z') {
        const z = zone.match(/^([+-])(\d{2}):?(\d{2})$/); const zh = +z[2], zm = +z[3];
        if (zh > 23 || zm > 59) return { status: 'invalid', reason: 'Invalid UTC offset.' };
        offset = (zh * 60 + zm) * (z[1] === '+' ? 1 : -1);
      }
      const instant = utcDate(y, mo, d, h, mi, s, milli).getTime() - offset * 60000;
      return { status: 'instant', input: raw, civil: { year: y, month: mo, day: d }, time: { hour: h, minute: mi, second: s, millisecond: milli }, offsetMinutes: offset, instant, zoneLabel: zone.toUpperCase() === 'Z' ? 'UTC' : zone };
    }
    const wall = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
    if ((m = raw.match(wall))) {
      const [, ys, mos, ds, hs, mis, ss = '0', frac = ''] = m; const civil = { year: +ys, month: +mos, day: +ds };
      const time = { hour: +hs, minute: +mis, second: +ss, millisecond: +(frac.padEnd(3, '0') || '0') };
      if (!isCivilDate(civil.year, civil.month, civil.day) || !validClock(time.hour, time.minute, time.second, time.millisecond)) return { status: 'invalid', reason: 'The date or time is outside the valid calendar range.' };
      return { status: 'wall-time', input: raw, civil, time };
    }
    const dateMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(raw);
    if (dateMatch) {
      const civil = { year: +dateMatch[1], month: +dateMatch[2], day: +dateMatch[3] };
      return isCivilDate(civil.year, civil.month, civil.day) ? { status: 'civil-date', input: raw, civil } : { status: 'invalid', reason: 'Invalid calendar date.' };
    }
    const named = /^(?:(\d{1,2})\s+([a-z]+)|([a-z]+)\s+(\d{1,2})),?\s+(\d{4})$/i.exec(raw);
    if (named) {
      const monthName = (named[2] || named[3]).toLowerCase(); const month = MONTHS[monthName]; const day = +(named[1] || named[4]); const year = +named[5]; const civil = { year, month, day };
      return month && isCivilDate(year, month, day) ? { status: 'civil-date', input: raw, civil } : { status: 'invalid', reason: 'Invalid month name or calendar date.' };
    }
    const numeric = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(raw);
    if (numeric) {
      const a = +numeric[1], b = +numeric[2], y = +numeric[3];
      const dmy = { year: y, month: b, day: a }; const mdy = { year: y, month: a, day: b };
      const candidates = [];
      if (isCivilDate(y, dmy.month, dmy.day)) candidates.push({ order: 'DMY', civil: dmy });
      if (isCivilDate(y, mdy.month, mdy.day) && !(a === b)) candidates.push({ order: 'MDY', civil: mdy });
      if (candidates.length === 0) return { status: 'invalid', reason: 'Neither day/month interpretation is a valid date.' };
      if (candidates.length === 1) return { status: 'civil-date', input: raw, civil: candidates[0].civil, inferredOrder: candidates[0].order };
      const selectedOrder = options.dateOrder === 'DMY' || options.dateOrder === 'MDY' ? options.dateOrder : null;
      return { status: 'ambiguous', input: raw, candidates, selected: selectedOrder ? candidates.find(c => c.order === selectedOrder) || null : null };
    }
    const timestamp = /^@?(-?\d{10}|-?\d{13})$/.exec(raw);
    if (timestamp) {
      const digits = timestamp[1]; let instant = Number(digits);
      if (Math.abs(instant) < 100000000000) instant *= 1000;
      const date = new Date(instant);
      if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return { status: 'invalid', reason: 'Timestamp is outside the supported range.' };
      return { status: 'instant', input: raw, instant, timestamp: true };
    }
    return { status: 'invalid', reason: 'Unrecognized date format. Try YYYY-MM-DD, RFC 3339, a named month, or a Unix timestamp.' };
  }

  function zoneFormatter(zone, options = {}) { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', ...options }); }
  function zoneParts(instant, zone) {
    const parts = Object.fromEntries(zoneFormatter(zone).formatToParts(new Date(instant)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
    return { year: +parts.year, month: +parts.month, day: +parts.day, hour: +parts.hour, minute: +parts.minute, second: +parts.second };
  }
  function offsetAt(instant, zone) {
    const date = new Date(instant); const parts = zoneParts(instant, zone);
    const wallAsUtc = utcDate(parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second).getTime();
    return Math.round((wallAsUtc - Math.floor(instant / 1000) * 1000) / 60000);
  }
  function formatOffset(minutes) { const sign = minutes < 0 ? '-' : '+'; const abs = Math.abs(minutes); return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`; }
  function validateZone(zone) { try { zoneFormatter(zone).format(new Date(0)); return true; } catch { return false; } }
  function zoneMatrix(instant, zones, sourceDate) {
    return zones.map(zone => {
      if (!validateZone(zone)) return { zone, error: 'Invalid IANA time zone.' };
      const parts = zoneParts(instant, zone); const offsetMinutes = offsetAt(instant, zone);
      return { zone, date: toIsoDate(parts), time: `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}:${String(parts.second).padStart(2, '0')}`, weekday: weekday(parts.year, parts.month, parts.day), offsetMinutes, offset: formatOffset(offsetMinutes), dateRollover: sourceDate ? Math.sign(daysBetween(sourceDate, parts)) : 0 };
    });
  }
  function sameWall(a, b) { return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute && a.second === b.second; }
  function resolveWallTime(civil, time, zone) {
    if (!validateZone(zone)) return { status: 'invalid-zone', zone };
    const nominal = utcDate(civil.year, civil.month, civil.day, time.hour, time.minute, time.second, time.millisecond || 0).getTime();
    const offsets = new Set();
    for (let delta = -48 * 60; delta <= 48 * 60; delta += 180) offsets.add(offsetAt(nominal + delta * 60000, zone));
    const candidates = [...offsets].map(offset => nominal - offset * 60000).filter(ms => sameWall(zoneParts(ms, zone), { ...civil, ...time })).sort((a, b) => a - b);
    if (candidates.length === 1) return { status: 'unique', instants: candidates };
    if (candidates.length > 1) return { status: 'fold', instants: candidates.slice(0, 2) };
    return { status: 'gap', instants: [] };
  }
  function findTransitions(zone, year) {
    if (!validateZone(zone)) throw new RangeError('Invalid IANA time zone.');
    if (!Number.isInteger(year) || year < 1970 || year > 2100) throw new RangeError('Choose a year from 1970 to 2100.');
    const start = utcDate(year, 1, 1).getTime(); const end = utcDate(year + 1, 1, 1).getTime(); const step = 6 * 3600000;
    const transitions = []; let left = start; let oldOffset = offsetAt(left, zone);
    for (let right = Math.min(left + step, end); right <= end; right = Math.min(right + step, end)) {
      const newOffset = offsetAt(right, zone);
      if (newOffset !== oldOffset) {
        let lo = left; let hi = right;
        while (hi - lo > 1000) { const mid = Math.floor((lo + hi) / 2000) * 1000; if (offsetAt(mid, zone) === oldOffset) lo = mid; else hi = mid; }
        const instant = Math.ceil(hi / 1000) * 1000; const after = offsetAt(instant, zone);
        transitions.push({ instant, oldOffsetMinutes: oldOffset, newOffsetMinutes: after, direction: after > oldOffset ? 'forward' : 'backward', classification: after > oldOffset ? 'gap' : 'fold' });
        oldOffset = after;
      }
      if (right === end) break;
      left = right;
    }
    return transitions;
  }

  const PAGE_DATE_PATTERN = /\b(?:\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:[Zz]|[+-]\d{2}:?\d{2})?|\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi;
  function scanPage(root, limits = {}) {
    const maxChars = limits.maxChars || 250000; const maxCandidates = limits.maxCandidates || 100; const textParts = [];
    if (!root || !root.ownerDocument) return [];
    const doc = root.ownerDocument; const walker = doc.createTreeWalker(root, 4); let node; let total = 0;
    while ((node = walker.nextNode()) && total < maxChars) {
      const parent = node.parentElement; if (!parent) continue;
      if (parent.closest('script,style,noscript,template,textarea,input,select,option,[contenteditable="true"],[type="password"],[hidden],[aria-hidden="true"]')) continue;
      const view = doc.defaultView; let hidden = false;
      if (view && view.getComputedStyle) for (let ancestor = parent; ancestor; ancestor = ancestor.parentElement) {
        const computed = view.getComputedStyle(ancestor);
        if (computed.display === 'none' || computed.visibility === 'hidden') { hidden = true; break; }
        if (ancestor === root) break;
      }
      if (hidden) continue;
      const text = node.nodeValue || ''; if (!text.trim()) continue;
      const clipped = text.slice(0, maxChars - total); textParts.push({ text: clipped, context: parent }); total += clipped.length;
    }
    const joined = textParts.map(x => x.text).join(' '); const results = []; PAGE_DATE_PATTERN.lastIndex = 0; let match;
    while ((match = PAGE_DATE_PATTERN.exec(joined)) && results.length < maxCandidates) {
      const parsed = parseInput(match[0]); if (parsed.status === 'invalid') continue;
      const start = Math.max(0, match.index - 55); const end = Math.min(joined.length, match.index + match[0].length + 55);
      results.push({ text: match[0], parsed, snippet: joined.slice(start, end).replace(/\s+/g, ' ').trim() });
      if (match[0].length === 0) PAGE_DATE_PATTERN.lastIndex++;
    }
    return results;
  }

  function escapeIcsText(value) { return String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function foldIcsLine(line) {
    const out = []; let current = ''; let bytes = 0;
    for (const char of line) { const size = new TextEncoder().encode(char).length; if (bytes + size > 75) { out.push(current); current = ` ${char}`; bytes = size + 1; } else { current += char; bytes += size; } }
    out.push(current); return out.join('\r\n');
  }
  function compactUtc(instant) { const d = new Date(instant); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}Z`; }
  function compactDate(civil) { return `${String(civil.year).padStart(4, '0')}${String(civil.month).padStart(2, '0')}${String(civil.day).padStart(2, '0')}`; }
  function makeIcsEvent(event) {
    const summary = String(event.summary || 'ChronoLens event').trim() || 'ChronoLens event'; const uid = (scope.crypto && scope.crypto.randomUUID) ? scope.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}@chronolens.local`;
    const now = Date.now(); const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ChronoLens//Date Toolkit 1.0.0//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${compactUtc(now)}`];
    if (event.allDay) {
      const start = event.civil; const end = addDays(start, 1);
      lines.push(`DTSTART;VALUE=DATE:${compactDate(start)}`, `DTEND;VALUE=DATE:${compactDate(end)}`);
    } else {
      const start = event.instant; const end = start + Math.max(1, Number(event.durationMinutes) || 60) * 60000;
      lines.push(`DTSTART:${compactUtc(start)}`, `DTEND:${compactUtc(end)}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (event.description) lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcsText(event.location)}`);
    lines.push('END:VEVENT', 'END:VCALENDAR');
    return lines.map(foldIcsLine).join('\r\n') + '\r\n';
  }

  function defaultSettings() { return JSON.parse(JSON.stringify(DEFAULTS)); }
  function settingsStore() {
    const modernGM = typeof GM === 'object' && GM ? GM : null;
    const gmGet = typeof GM_getValue === 'function' ? GM_getValue : modernGM && typeof modernGM.getValue === 'function' ? modernGM.getValue.bind(modernGM) : null;
    const gmSet = typeof GM_setValue === 'function' ? GM_setValue : modernGM && typeof modernGM.setValue === 'function' ? modernGM.setValue.bind(modernGM) : null;
    return {
      async get() {
        try { const value = gmGet ? gmGet('chronolens.settings', null) : null; const saved = value && typeof value.then === 'function' ? await value : value; return { ...defaultSettings(), ...(saved && typeof saved === 'object' ? saved : {}) }; }
        catch { return defaultSettings(); }
      },
      async set(settings) { try { if (gmSet) { const result = gmSet('chronolens.settings', settings); if (result && typeof result.then === 'function') await result; } } catch { /* Settings remain session-local if manager storage is unavailable. */ } }
    };
  }

  const api = { isLeapYear, daysInMonth, isCivilDate, ordinalDay, isoWeek, toIsoDate, addDays, addMonths, addYears, daysBetween, calendarDifference, inspectCivil, parseInput, zoneParts, offsetAt, formatOffset, validateZone, zoneMatrix, resolveWallTime, findTransitions, scanPage, escapeIcsText, foldIcsLine, makeIcsEvent, defaultSettings };
  if (typeof module === 'object' && module && module.exports) module.exports = api;

  function startBrowserUI() {
    if (!scope.document || !scope.document.documentElement || scope.document.getElementById('chronolens-host')) return;
    const doc = scope.document; const store = settingsStore(); let settings = defaultSettings(); let activeTab = 'Inspect'; let currentResult = null; let currentInput = ''; let scanResults = []; let currentCalendar = null; let currentIcs = ''; let previousFocus = null;
    const host = doc.createElement('div'); host.id = 'chronolens-host'; host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;inset:0 auto auto 0;'; doc.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const style = doc.createElement('style');
    style.textContent = `:host{all:initial;color-scheme:light dark}*{box-sizing:border-box}.cl-shell{position:fixed;right:18px;top:18px;width:min(920px,calc(100vw - 36px));height:min(700px,calc(100vh - 36px));display:none;background:#f8fafb;color:#172b3a;border:1px solid #cbd5dc;border-radius:16px;box-shadow:0 18px 60px #10203045;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;overflow:hidden;isolation:isolate}.cl-shell.open{display:flex;flex-direction:column}.cl-shell[data-theme=dark]{background:#111a22;color:#e7eff3;border-color:#354552}.cl-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid #dce4e9}.cl-shell[data-theme=dark] .cl-head,.cl-shell[data-theme=dark] .cl-nav{border-color:#34434f}.cl-brand{font-size:16px;font-weight:700;letter-spacing:.02em}.cl-tag{color:#657985;font-size:12px;flex:1}.cl-shell[data-theme=dark] .cl-tag,.cl-shell[data-theme=dark] .muted{color:#aab9c3}.cl-close,.cl-btn,.cl-tab{font:inherit;cursor:pointer;border:1px solid #b7c7d0;background:#fff;color:inherit;border-radius:8px;padding:7px 10px}.cl-shell[data-theme=dark] .cl-close,.cl-shell[data-theme=dark] .cl-btn,.cl-shell[data-theme=dark] .cl-tab{background:#1b2934;border-color:#455965}.cl-btn.primary,.cl-tab[aria-selected=true]{background:#d7eeeb;border-color:#5faaa4;color:#123c3a}.cl-shell[data-theme=dark] .cl-btn.primary,.cl-shell[data-theme=dark] .cl-tab[aria-selected=true]{background:#174b4b;color:#e3ffff}.cl-btn:hover,.cl-tab:hover{border-color:#338d87}.cl-nav{display:flex;gap:6px;padding:10px 14px;border-bottom:1px solid #dce4e9;overflow:auto}.cl-tab{white-space:nowrap;padding:6px 9px}.cl-body{padding:18px;overflow:auto;flex:1}.cl-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.cl-col{display:flex;flex-direction:column;gap:5px;min-width:180px;flex:1}.cl-input,.cl-select,.cl-textarea{font:inherit;border:1px solid #aabac3;border-radius:8px;padding:9px 10px;background:#fff;color:#182c3a;min-width:0}.cl-shell[data-theme=dark] .cl-input,.cl-shell[data-theme=dark] .cl-select,.cl-shell[data-theme=dark] .cl-textarea{background:#17242d;color:#e7eff3;border-color:#465a66}.cl-textarea{width:100%;min-height:88px;resize:vertical}.cl-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px}.cl-card{background:#fff;border:1px solid #d8e1e6;border-radius:10px;padding:12px;min-width:0}.cl-shell[data-theme=dark] .cl-card{background:#17242d;border-color:#354752}.cl-card b{display:block;font-size:12px;color:#607783;margin-bottom:5px}.cl-value{font-size:15px;overflow-wrap:anywhere}.cl-title{font-size:18px;margin:0 0 8px}.cl-hint,.muted{font-size:12px;color:#687c87}.cl-error{padding:10px;border-radius:8px;background:#fff0ec;color:#8e2f1b}.cl-shell[data-theme=dark] .cl-error{background:#44271f;color:#ffd5c8}.cl-list{display:grid;gap:7px;margin:10px 0}.cl-listitem{border:1px solid #d8e1e6;border-radius:8px;padding:9px;background:#fff}.cl-shell[data-theme=dark] .cl-listitem{background:#17242d;border-color:#354752}.cl-calendar{display:grid;grid-template-columns:repeat(7,minmax(28px,1fr));gap:4px;text-align:center}.cl-day{padding:8px 2px;border-radius:7px}.cl-day.selected{outline:2px solid #2c938b}.cl-day.today{background:#dce8ff}.cl-shell[data-theme=dark] .cl-day.today{background:#293b57}.cl-day.out{opacity:.4}.cl-bubble{display:none;position:fixed;z-index:2147483647;padding:4px;border:1px solid #8fa2ac;border-radius:9px;background:#fff;box-shadow:0 4px 18px #20304035}.cl-bubble.visible{display:block}.cl-bubble button{border:0;background:#123f45;color:white;border-radius:6px;padding:6px 9px;cursor:pointer}.cl-input:focus-visible,.cl-select:focus-visible,.cl-textarea:focus-visible,.cl-btn:focus-visible,.cl-tab:focus-visible{outline:3px solid #4aa59d;outline-offset:2px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#edf2f4;padding:12px;border-radius:8px;max-height:320px;overflow:auto}.cl-shell[data-theme=dark] pre{background:#0d151b}@media(prefers-color-scheme:dark){.cl-shell[data-theme=theme]{background:#111a22;color:#e7eff3;border-color:#354552}.cl-shell[data-theme=theme] .cl-card{background:#17242d;border-color:#354752}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}`;
    shadow.appendChild(style);
    const shell = doc.createElement('section'); shell.className = 'cl-shell'; shell.setAttribute('role', 'dialog'); shell.setAttribute('aria-modal', 'false'); shell.setAttribute('aria-label', 'ChronoLens date and calendar toolkit'); shell.tabIndex = -1;
    const bubble = doc.createElement('div'); bubble.className = 'cl-bubble'; bubble.setAttribute('role', 'group'); bubble.setAttribute('aria-label', 'Selection actions');
    shadow.append(shell, bubble);
    const el = (tag, text, cls) => { const n = doc.createElement(tag); if (text !== undefined) n.textContent = text; if (cls) n.className = cls; return n; };
    const btn = (text, handler, primary = false) => { const b = el('button', text, `cl-btn${primary ? ' primary' : ''}`); b.type = 'button'; b.addEventListener('click', handler); return b; };
    const input = (labelText, type = 'text', value = '') => { const wrap = el('label', undefined, 'cl-col'); wrap.append(el('span', labelText)); const field = el(type === 'textarea' ? 'textarea' : 'input', undefined, type === 'textarea' ? 'cl-textarea' : 'cl-input'); if (type !== 'textarea') field.type = type; field.value = value; field.setAttribute('aria-label', labelText); wrap.append(field); return { wrap, field }; };
    function showError(parent, message) { parent.append(el('div', message, 'cl-error')); }
    function card(parent, title, value) { const c = el('div', undefined, 'cl-card'); c.append(el('b', title), el('div', String(value), 'cl-value')); parent.append(c); }
    function h2(parent, title, description) { parent.append(el('h2', title, 'cl-title')); if (description) parent.append(el('p', description, 'cl-hint')); }
    function applyTheme() { shell.dataset.theme = settings.theme === 'system' ? 'theme' : settings.theme; }
    function openPanel(value = '') { if (!shell.classList.contains('open')) previousFocus = shadow.activeElement || doc.activeElement; shell.classList.add('open'); bubble.classList.remove('visible'); if (value) { currentInput = value; activeTab = 'Inspect'; } render(); shell.focus(); }
    function closePanel() { shell.classList.remove('open'); bubble.classList.remove('visible'); if (previousFocus && previousFocus.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus(); previousFocus = null; }
    function addCopy(parent, text, label = 'Copy') { parent.append(btn(label, async () => { try { await navigator.clipboard.writeText(text); } catch { const area = doc.createElement('textarea'); area.value = text; shadow.append(area); area.select(); doc.execCommand('copy'); area.remove(); } })); }
    function renderHeader() {
      const head = el('header', undefined, 'cl-head'); head.append(el('div', 'ChronoLens', 'cl-brand'), el('div', 'Inspect, convert and understand dates without leaving the page.', 'cl-tag'));
      const close = el('button', 'Close', 'cl-close'); close.type = 'button'; close.setAttribute('aria-label', 'Close ChronoLens'); close.addEventListener('click', closePanel); head.append(close); shell.append(head);
      const nav = el('nav', undefined, 'cl-nav'); nav.setAttribute('aria-label', 'ChronoLens views');
      for (const name of ['Inspect', 'Calculate', 'Time Zones', 'Calendar', 'ICS', 'Page Dates', 'Settings', 'About']) { const b = el('button', name, 'cl-tab'); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(activeTab === name)); b.tabIndex = activeTab === name ? 0 : -1; b.addEventListener('click', () => { activeTab = name; render(); }); nav.append(b); }
      nav.addEventListener('keydown', event => { const items = [...nav.querySelectorAll('[role="tab"]')]; const index = items.indexOf(event.target); if (index < 0) return; let next = index; if (event.key === 'ArrowRight') next = (index + 1) % items.length; else if (event.key === 'ArrowLeft') next = (index + items.length - 1) % items.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = items.length - 1; else return; event.preventDefault(); items[next].focus(); items[next].click(); });
      shell.append(nav);
    }
    function renderInspect(body) {
      h2(body, 'Inspect a date or instant', 'Date-only values stay civil dates. A time without an offset is a local wall time, not a unique instant.');
      const row = el('div', undefined, 'cl-row'); const f = el('input', undefined, 'cl-input'); f.type = 'text'; f.placeholder = '2027-01-01 · 2027-01-01T14:30:00Z · 03/04/2027'; f.value = currentInput; f.dataset.input = 'inspect'; f.setAttribute('aria-label', 'Date, date-time, or Unix timestamp'); f.style.flex = '1'; const inspect = () => { currentInput = f.value; render(); }; f.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); inspect(); } }); const go = btn('Inspect', inspect, true); row.append(f, go); body.append(row);
      const selected = getSelectionText(); if (!currentInput && selected) { const hint = el('div', `Selected text: ${selected.slice(0, 140)}`, 'cl-hint'); body.append(hint, btn('Use selection', () => { currentInput = selected; render(); })); }
      if (!currentInput) { body.append(el('p', 'Enter a date manually, select date-like text on the page, or use Alt + Shift + D.', 'cl-hint')); return; }
      currentResult = parseInput(currentInput, settings);
      if (currentResult.status === 'invalid') { showError(body, currentResult.reason); return; }
      if (currentResult.status === 'ambiguous') {
        showError(body, `AMBIGUOUS DATE: ${currentResult.input} has multiple valid interpretations. Choose one explicitly.`);
        const list = el('div', undefined, 'cl-row'); for (const candidate of currentResult.candidates) list.append(btn(`${candidate.order}: ${toIsoDate(candidate.civil)}`, () => { currentInput = toIsoDate(candidate.civil); render(); })); body.append(list); return;
      }
      if (currentResult.status === 'civil-date' || currentResult.status === 'wall-time') {
        const civil = currentResult.civil; const data = inspectCivil(civil); const cards = el('div', undefined, 'cl-grid');
        const weekdays = new Intl.DateTimeFormat(settings.locale, { weekday: 'long', timeZone: 'UTC' });
        card(cards, 'ISO date', data.isoDate); card(cards, 'Weekday', weekdays.format(utcDate(civil.year, civil.month, civil.day))); card(cards, 'Day of year', data.ordinal); card(cards, 'ISO week / weekday', data.isoWeek.text); card(cards, 'Quarter', data.quarter); card(cards, 'Month length', data.daysInMonth); card(cards, 'Year length / remaining', `${data.daysInYear} / ${data.daysRemainingInYear}`); card(cards, 'Leap year', data.leapYear ? 'Yes' : 'No'); card(cards, 'Previous / next', `${data.previousDate} / ${data.nextDate}`);
        if (currentResult.status === 'wall-time') card(cards, 'Local wall time', `${toIsoDate(civil)} ${String(currentResult.time.hour).padStart(2, '0')}:${String(currentResult.time.minute).padStart(2, '0')}:${String(currentResult.time.second).padStart(2, '0')} · no unique instant without a time zone`);
        body.append(cards); const controls = el('div', undefined, 'cl-row'); addCopy(controls, data.isoDate, 'Copy ISO date'); addCopy(controls, data.isoWeek.text, 'Copy ISO week date'); body.append(controls);
      } else if (currentResult.status === 'instant') {
        const d = new Date(currentResult.instant); const matrix = zoneMatrix(currentResult.instant, settings.zones, currentResult.civil || { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }); const cards = el('div', undefined, 'cl-grid');
        card(cards, 'UTC instant', d.toISOString()); card(cards, 'Unix timestamp (ms)', d.getTime()); card(cards, 'UTC date', d.toISOString().slice(0, 10)); body.append(cards);
        const list = el('div', undefined, 'cl-list'); for (const zone of matrix) { const rollover = zone.dateRollover < 0 ? ' · previous date' : zone.dateRollover > 0 ? ' · next date' : ''; const zoneTime = new Intl.DateTimeFormat(settings.locale, { timeZone: zone.zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: settings.hourCycle === '12' ? 'h12' : 'h23' }).format(new Date(currentResult.instant)); list.append(el('div', `${zone.zone}: ${zone.error || `${zone.date} ${zoneTime} ${zone.offset}${rollover} (${new Intl.DateTimeFormat(settings.locale, { weekday: 'long', timeZone: zone.zone }).format(new Date(currentResult.instant))})`}`, 'cl-listitem')); } body.append(el('h3', 'Time-zone matrix'), list);
        const controls = el('div', undefined, 'cl-row'); addCopy(controls, d.toISOString(), 'Copy RFC3339'); addCopy(controls, String(Math.floor(d.getTime() / 1000)), 'Copy Unix seconds'); addCopy(controls, JSON.stringify({ schemaVersion: 1, input: currentInput, classification: 'instant', instant: d.toISOString(), zones: matrix }, null, 2), 'Copy JSON'); body.append(controls);
      }
    }
    function renderCalculate(body) {
      h2(body, 'Calendar arithmetic', 'Month and year changes use CLAMP semantics: January 31 + 1 month becomes the last day of February.');
      const a = input('Start date', 'text', currentInput && parseInput(currentInput).civil ? toIsoDate(parseInput(currentInput).civil) : '2027-01-31'); const amount = input('Amount (negative subtracts)', 'number', '1'); const unit = doc.createElement('select'); unit.className = 'cl-select'; unit.setAttribute('aria-label', 'Calendar unit'); for (const u of ['days', 'weeks', 'months', 'years']) { const o = el('option', u); o.value = u; unit.append(o); }
      const row = el('div', undefined, 'cl-row'); row.append(a.wrap, amount.wrap, unit); const result = el('div'); row.append(btn('Calculate', () => { result.replaceChildren(); const parsed = parseInput(a.field.value); if (!parsed.civil) return showError(result, 'Enter a valid civil date.'); const n = Number(amount.field.value); if (!Number.isInteger(n) || Math.abs(n) > 100000) return showError(result, 'Enter a whole number from -100000 to 100000.'); try { const out = unit.value === 'days' ? addDays(parsed.civil, n) : unit.value === 'weeks' ? addDays(parsed.civil, n * 7) : unit.value === 'months' ? addMonths(parsed.civil, n) : addYears(parsed.civil, n); card(result, 'Result', toIsoDate(out)); } catch (e) { showError(result, e.message); } }, true)); body.append(row, result);
      const diffRow = el('div', undefined, 'cl-row'); const first = input('Difference from', 'text', '2027-01-01'); const second = input('Difference to', 'text', '2028-03-01'); const diff = el('div'); diffRow.append(first.wrap, second.wrap, btn('Compare', () => { diff.replaceChildren(); const x = parseInput(first.field.value), y = parseInput(second.field.value); if (!x.civil || !y.civil) return showError(diff, 'Enter two valid civil dates.'); const days = daysBetween(x.civil, y.civil); const cal = calendarDifference(x.civil, y.civil); card(diff, 'Exact days', days); card(diff, 'Weeks + days', `${Math.trunc(days / 7)} weeks + ${Math.abs(days % 7)} days`); card(diff, 'Calendar difference', `${cal.years} years, ${cal.months} months, ${cal.days} days`); })); body.append(el('h3', 'Date difference'), diffRow, diff);
    }
    function renderTimeZones(body) {
      h2(body, 'Time zones and daylight-saving diagnostics', 'Use an instant for conversions. For a local wall time, select a zone to check for a DST gap or fold. Browser-provided time-zone history may vary.');
      const parsed = parseInput(currentInput); const instant = parsed.status === 'instant' ? parsed.instant : Date.now(); const cards = el('div', undefined, 'cl-list');
      if (parsed.status === 'wall-time') { const zoneField = input('IANA time zone', 'text', settings.zones[0] || 'UTC'); const report = el('div'); body.append(zoneField.wrap, btn('Diagnose local time', () => { report.replaceChildren(); const result = resolveWallTime(parsed.civil, parsed.time, zoneField.field.value.trim()); if (result.status === 'invalid-zone') return showError(report, 'Invalid IANA time zone.'); if (result.status === 'gap') return showError(report, 'NONEXISTENT / GAP: this local wall time has no corresponding instant in that zone.'); const label = result.status === 'fold' ? 'AMBIGUOUS / FOLD: two instants match this local wall time.' : 'UNIQUE: exactly one instant matches this local wall time.'; report.append(el('p', label)); for (const ms of result.instants) card(report, new Date(ms).toISOString(), `${formatOffset(offsetAt(ms, zoneField.field.value.trim()))}`); }, true), report); }
      for (const zone of zoneMatrix(instant, settings.zones)) cards.append(el('div', `${zone.zone}: ${zone.error || `${zone.date} ${zone.time} ${zone.offset}`}`, 'cl-listitem'));
      body.append(el('h3', parsed.status === 'instant' ? 'Converted instant' : 'Current instant preview'), cards);
      const zone = input('Inspect transitions for zone', 'text', 'America/New_York'); const year = input('Year (1970–2100)', 'number', String(new Date(instant).getUTCFullYear())); const out = el('div'); const tr = el('div', undefined, 'cl-row'); tr.append(zone.wrap, year.wrap, btn('Find transitions', () => { out.replaceChildren(); try { const transitions = findTransitions(zone.field.value.trim(), Number(year.field.value)); if (!transitions.length) return out.append(el('p', 'No UTC offset transitions detected for this year.')); for (const t of transitions) out.append(el('div', `${new Date(t.instant).toISOString()} · ${formatOffset(t.oldOffsetMinutes)} → ${formatOffset(t.newOffsetMinutes)} · ${t.classification.toUpperCase()}`, 'cl-listitem')); } catch (e) { showError(out, e.message); } })); body.append(el('h3', 'Yearly offset transitions'), tr, out);
    }
    function renderCalendar(body) {
      const parsed = parseInput(currentInput); const base = parsed.civil || { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() }; currentCalendar ||= { year: base.year, month: base.month };
      const title = new Intl.DateTimeFormat(settings.locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcDate(currentCalendar.year, currentCalendar.month, 1));
      h2(body, title, 'The selected date and today use separate highlights.'); const controls = el('div', undefined, 'cl-row'); controls.append(btn('Previous month', () => { currentCalendar = addMonths({ ...currentCalendar, day: 1 }, -1); render(); }), btn('Today', () => { const d = new Date(); currentCalendar = { year: d.getFullYear(), month: d.getMonth() + 1 }; render(); }), btn('Next month', () => { currentCalendar = addMonths({ ...currentCalendar, day: 1 }, 1); render(); })); body.append(controls);
      const cal = el('div', undefined, 'cl-calendar'); cal.setAttribute('role', 'grid'); const startMonday = settings.weekStart === 'monday'; const names = startMonday ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; for (const n of names) cal.append(el('b', n, 'cl-day'));
      const firstDay = weekday(currentCalendar.year, currentCalendar.month, 1); const offset = startMonday ? (firstDay + 6) % 7 : firstDay; const first = addDays({ year: currentCalendar.year, month: currentCalendar.month, day: 1 }, -offset); const today = new Date(); const selected = parsed.civil;
      if (startMonday && settings.showIsoWeeks) { cal.style.gridTemplateColumns = '34px repeat(7,minmax(28px,1fr))'; cal.append(el('b', 'Wk', 'cl-day')); }
      for (let week = 0; week < 6; week++) { const weekStart = addDays(first, week * 7); if (startMonday && settings.showIsoWeeks) cal.append(el('span', String(isoWeek(weekStart.year, weekStart.month, weekStart.day).week), 'cl-day muted')); for (let day = 0; day < 7; day++) { const d = addDays(weekStart, day); const b = el('button', String(d.day), 'cl-day'); b.type = 'button'; b.setAttribute('aria-label', toIsoDate(d)); if (d.month !== currentCalendar.month) b.classList.add('out'); if (d.year === today.getFullYear() && d.month === today.getMonth() + 1 && d.day === today.getDate()) b.classList.add('today'); if (selected && toIsoDate(d) === toIsoDate(selected)) b.classList.add('selected'); b.addEventListener('click', () => { currentInput = toIsoDate(d); currentCalendar = { year: d.year, month: d.month }; render(); }); cal.append(b); } }
      body.append(cal);
    }
    function renderIcs(body) {
      h2(body, 'Generate an iCalendar event', 'Generated locally in your browser. Timed events are exported as UTC instants; all-day events use exclusive DTEND date semantics.');
      const parsed = parseInput(currentInput); const defaultCivil = parsed.civil || { year: new Date().getFullYear(), month: new Date().getMonth() + 1, day: new Date().getDate() }; const summary = input('Event title', 'text', 'ChronoLens event'); const dateOnly = input('All-day event date', 'text', toIsoDate(defaultCivil)); const instantInput = input('Timed event start (RFC 3339)', 'text', parsed.status === 'instant' ? new Date(parsed.instant).toISOString() : new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')); const description = input('Description (optional)', 'textarea', ''); const location = input('Location (optional)', 'text', ''); const allDay = el('input'); allDay.type = 'checkbox'; allDay.checked = true; allDay.setAttribute('aria-label', 'All-day event'); const checkbox = el('label', undefined, 'cl-row'); checkbox.append(allDay, el('span', 'All-day event')); const preview = el('div'); const actions = el('div', undefined, 'cl-row');
      actions.append(btn('Preview ICS', () => { preview.replaceChildren(); try { const event = allDay.checked ? { allDay: true, civil: parseInput(dateOnly.field.value).civil, summary: summary.field.value, description: description.field.value, location: location.field.value } : { allDay: false, instant: parseInput(instantInput.field.value).instant, durationMinutes: settings.icsDurationMinutes, summary: summary.field.value, description: description.field.value, location: location.field.value }; if (event.allDay && !event.civil) throw new Error('Enter a valid all-day date.'); if (!event.allDay && !Number.isFinite(event.instant)) throw new Error('Enter a valid RFC 3339 instant.'); currentIcs = makeIcsEvent(event); const pre = el('pre', currentIcs); preview.append(pre); const buttons = el('div', undefined, 'cl-row'); addCopy(buttons, currentIcs, 'Copy ICS'); buttons.append(btn('Download .ics', () => { const blob = new Blob([currentIcs], { type: 'text/calendar;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = doc.createElement('a'); a.href = url; a.download = 'chronolens-event.ics'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })); preview.append(buttons); } catch (e) { showError(preview, e.message); } }, true));
      body.append(summary.wrap, checkbox, dateOnly.wrap, instantInput.wrap, description.wrap, location.wrap, actions, preview);
    }
    function renderPageDates(body) {
      h2(body, 'Find dates on this page', 'This scan runs only when you press the button. It reads visible text nodes locally, skips hidden and form content, and stops after 250,000 characters or 100 candidates.');
      body.append(btn('Find dates on this page', () => { scanResults = scanPage(doc.body); render(); }, true));
      if (!scanResults.length) { body.append(el('p', 'No dates scanned yet, or no likely dates were found.', 'cl-hint')); return; }
      const list = el('div', undefined, 'cl-list'); for (const item of scanResults) { const row = el('div', undefined, 'cl-listitem'); const parsedLabel = item.parsed.status === 'ambiguous' ? `AMBIGUOUS (${item.parsed.candidates.map(c => toIsoDate(c.civil)).join(' or ')})` : item.parsed.civil ? toIsoDate(item.parsed.civil) : item.parsed.status; row.append(el('b', `${item.text} → ${parsedLabel}`), el('div', item.snippet, 'cl-hint'), btn('Inspect this', () => { currentInput = item.text; activeTab = 'Inspect'; render(); })); list.append(row); } body.append(list);
    }
    function renderSettings(body) {
      h2(body, 'Settings', 'Preferences are stored using your userscript manager. No settings are synchronized remotely.');
      const week = doc.createElement('select'); week.className = 'cl-select'; week.setAttribute('aria-label', 'Week starts on'); for (const [value, text] of [['monday', 'Monday'], ['sunday', 'Sunday']]) { const o = el('option', text); o.value = value; week.append(o); } week.value = settings.weekStart;
      const order = doc.createElement('select'); order.className = 'cl-select'; order.setAttribute('aria-label', 'Preferred numeric date order'); for (const [value, text] of [['ask', 'Ask / keep ambiguity visible'], ['DMY', 'DMY preference'], ['MDY', 'MDY preference']]) { const o = el('option', text); o.value = value; order.append(o); } order.value = settings.dateOrder;
      const theme = doc.createElement('select'); theme.className = 'cl-select'; theme.setAttribute('aria-label', 'Theme'); for (const v of ['system', 'light', 'dark']) { const o = el('option', v); o.value = v; theme.append(o); } theme.value = settings.theme;
      const locale = input('Display locale (Intl locale tag)', 'text', settings.locale);
      const hour = doc.createElement('select'); hour.className = 'cl-select'; hour.setAttribute('aria-label', 'Clock format'); for (const [value, labelText] of [['24', '24-hour'], ['12', '12-hour']]) { const o = el('option', labelText); o.value = value; hour.append(o); } hour.value = settings.hourCycle;
      const isoCheck = doc.createElement('input'); isoCheck.type = 'checkbox'; isoCheck.checked = settings.showIsoWeeks; isoCheck.setAttribute('aria-label', 'Show ISO week numbers'); const isoLabel = el('label', undefined, 'cl-row'); isoLabel.append(isoCheck, el('span', 'Show ISO week numbers on Monday-start calendars'));
      const duration = input('Default timed-event duration (minutes)', 'number', String(settings.icsDurationMinutes));
      const zones = input('Time zones (one IANA identifier per line)', 'textarea', settings.zones.join('\n'));
      const bubbleCheck = doc.createElement('input'); bubbleCheck.type = 'checkbox'; bubbleCheck.checked = settings.selectionBubble; bubbleCheck.setAttribute('aria-label', 'Enable selection bubble'); const bLabel = el('label', undefined, 'cl-row'); bLabel.append(bubbleCheck, el('span', 'Enable selection bubble (off by default)'));
      const controls = el('div', undefined, 'cl-row'); controls.append(el('label', 'Week start'), week, el('label', 'Numeric date order'), order, el('label', 'Theme'), theme, el('label', 'Clock'), hour); body.append(controls, locale.wrap, isoLabel, duration.wrap, zones.wrap, bLabel, btn('Save settings', async () => { const newZones = zones.field.value.split(/\n|,/).map(x => x.trim()).filter(Boolean).slice(0, 16); const invalid = newZones.filter(z => !validateZone(z)); if (invalid.length) return showError(body, `Invalid time zone identifier(s): ${invalid.join(', ')}`); const localeValue = locale.field.value.trim() || 'en-US'; try { new Intl.DateTimeFormat(localeValue); } catch { return showError(body, 'Enter a valid Intl locale tag.'); } const durationValue = Number(duration.field.value); if (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > 10080) return showError(body, 'Duration must be a whole number from 1 to 10080 minutes.'); settings = { ...settings, weekStart: week.value, dateOrder: order.value, theme: theme.value, selectionBubble: bubbleCheck.checked, showIsoWeeks: isoCheck.checked, hourCycle: hour.value, locale: localeValue, icsDurationMinutes: durationValue, zones: [...new Set(newZones)] }; await store.set(settings); applyTheme(); render(); }, true));
    }
    function renderAbout(body) {
      h2(body, 'About ChronoLens', 'A local-first date and calendar toolkit for everyday work and date/time debugging.');
      body.append(el('p', 'ChronoLens runs its calculations in this browser. It does not send selected text or page content to a server. It does not load third-party code, analytics, advertisements, or remote APIs.'), el('p', 'Month and year arithmetic uses CLAMP semantics. Ambiguous numeric dates stay marked as ambiguous even when a preference is saved. DST diagnostics rely on the browser’s Intl time-zone database and are most reliable for 1970–2100.'), el('p', 'Maintained as part of calendar-engineering tooling around JW Calendar.'));
      const home = el('a', 'Project homepage: JW Calendar'); home.href = 'https://jwcalendar.com/'; home.target = '_blank'; home.rel = 'noopener noreferrer'; const source = el('a', 'Source code and issue tracker'); source.href = 'https://github.com/karencohenjw/chronolens-userscript'; source.target = '_blank'; source.rel = 'noopener noreferrer'; body.append(el('p')); body.lastChild.append(home, doc.createTextNode(' · '), source);
    }
    function render() { applyTheme(); shell.replaceChildren(); shell.append(style); renderHeader(); const body = el('main', undefined, 'cl-body'); body.setAttribute('role', 'tabpanel'); shell.append(body); const renders = { Inspect: renderInspect, Calculate: renderCalculate, 'Time Zones': renderTimeZones, Calendar: renderCalendar, ICS: renderIcs, 'Page Dates': renderPageDates, Settings: renderSettings, About: renderAbout }; renders[activeTab](body); }
    function getSelectionText() { try { return String(scope.getSelection && scope.getSelection()).trim(); } catch { return ''; } }
    async function setup() { settings = await store.get(); applyTheme(); const modernMenu = typeof GM === 'object' && GM && typeof GM.registerMenuCommand === 'function' ? GM.registerMenuCommand.bind(GM) : null; const menu = typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : modernMenu; if (menu) menu('Open ChronoLens', () => openPanel(getSelectionText())); }
    doc.addEventListener('keydown', event => { if (event.altKey && event.shiftKey && event.key.toLowerCase() === 'd') { event.preventDefault(); openPanel(getSelectionText()); } else if (event.key === 'Escape' && shell.classList.contains('open')) closePanel(); }, true);
    doc.addEventListener('mouseup', event => {
      if (!settings.selectionBubble || shell.classList.contains('open')) return;
      const text = getSelectionText(); if (!text || parseInput(text).status === 'invalid') { bubble.classList.remove('visible'); return; }
      bubble.replaceChildren(); const action = doc.createElement('button'); action.type = 'button'; action.textContent = 'Open in ChronoLens'; action.addEventListener('click', () => openPanel(text)); bubble.append(action); bubble.style.left = `${Math.min(event.clientX + 8, scope.innerWidth - 180)}px`; bubble.style.top = `${Math.min(event.clientY + 8, scope.innerHeight - 42)}px`; bubble.classList.add('visible');
    });
    doc.addEventListener('mousedown', event => { if (!host.contains(event.target) && shell.classList.contains('open')) { /* Keep panel open; clicks on the page do not dismiss user work. */ } });
    setup();
  }
  if (typeof window !== 'undefined' && window.document) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startBrowserUI, { once: true }); else startBrowserUI();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
