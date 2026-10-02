const test = require('node:test');
const assert = require('node:assert/strict');
const c = require('../src/chronolens.user.js');

test('civil calendar rules', async t => {
  for (const [year, expected] of [[1900, false], [2000, true], [2100, false], [2400, true], [2028, true], [2027, false]]) {
    await t.test(`leap-year rule ${year}`, () => assert.equal(c.isLeapYear(year), expected));
  }
  for (const [input, valid] of [
    [{ year: 2027, month: 1, day: 1 }, true], [{ year: 2027, month: 2, day: 29 }, false],
    [{ year: 2028, month: 2, day: 29 }, true], [{ year: 2027, month: 4, day: 31 }, false],
    [{ year: 1, month: 1, day: 1 }, true], [{ year: 10000, month: 1, day: 1 }, false]
  ]) await t.test(`civil validation ${JSON.stringify(input)}`, () => assert.equal(c.isCivilDate(input.year, input.month, input.day), valid));
  assert.equal(c.daysInMonth(2028, 2), 29);
  assert.equal(c.daysInMonth(2027, 2), 28);
  assert.equal(c.daysInMonth(2027, 13), 0);
  assert.equal(c.toIsoDate({ year: 7, month: 2, day: 3 }), '0007-02-03');
  assert.equal(c.ordinalDay(2028, 3, 1), 61);
  assert.deepEqual(c.inspectCivil({ year: 2027, month: 1, day: 1 }).previousDate, '2026-12-31');
  assert.deepEqual(c.inspectCivil({ year: 2027, month: 12, day: 31 }).nextDate, '2028-01-01');
});

test('ISO 8601 week boundaries', async t => {
  const cases = [
    [{ year: 2016, month: 1, day: 1 }, '2015-W53-5'],
    [{ year: 2017, month: 1, day: 1 }, '2016-W52-7'],
    [{ year: 2021, month: 1, day: 4 }, '2021-W01-1'],
    [{ year: 2020, month: 12, day: 31 }, '2020-W53-4'],
    [{ year: 2021, month: 12, day: 31 }, '2021-W52-5'],
    [{ year: 2027, month: 1, day: 1 }, '2026-W53-5'],
    [{ year: 2024, month: 1, day: 1 }, '2024-W01-1']
  ];
  for (const [date, expected] of cases) await t.test(`${c.toIsoDate(date)} is ${expected}`, () => assert.equal(c.isoWeek(date.year, date.month, date.day).text, expected));
});

test('parser handles supported formats without guessing', async t => {
  for (const [input, expected] of [
    ['2027-01-01', 'civil-date'], ['2027/01/01', 'civil-date'], ['January 1, 2027', 'civil-date'],
    ['1 January 2027', 'civil-date'], ['2027-01-01T14:30:00Z', 'instant'],
    ['2027-01-01T14:30:00+03:00', 'instant'], ['2027-01-01T14:30', 'wall-time'],
    ['@1700000000', 'instant'], ['1700000000000', 'instant'], ['  2027-01-01  ', 'civil-date']
  ]) await t.test(`parse ${input}`, () => assert.equal(c.parseInput(input).status, expected));
  assert.equal(c.parseInput('2027-01-01T14:30:00+03:00').instant, Date.UTC(2027, 0, 1, 11, 30));
  assert.equal(c.parseInput('03/04/2027').status, 'ambiguous');
  assert.deepEqual(c.parseInput('03/04/2027').candidates.map(x => c.toIsoDate(x.civil)).sort(), ['2027-03-04', '2027-04-03']);
  assert.equal(c.parseInput('03/04/2027', { dateOrder: 'DMY' }).selected.order, 'DMY');
  assert.equal(c.parseInput('13/04/2027').civil.month, 4);
  assert.equal(c.parseInput('2027-02-29').status, 'invalid');
  assert.equal(c.parseInput('2028-02-29').status, 'civil-date');
  assert.equal(c.parseInput('1900-02-29').status, 'invalid');
  assert.equal(c.parseInput('<img src=x onerror=alert(1)>').status, 'invalid');
  assert.equal(c.parseInput('2027-01-01T25:00:00Z').status, 'invalid');
  assert.equal(c.parseInput('').status, 'invalid');
});

test('calendar arithmetic clamps and differences are deterministic', async t => {
  const cases = [
    [{ year: 2027, month: 1, day: 31 }, 1, '2027-02-28'],
    [{ year: 2028, month: 1, day: 31 }, 1, '2028-02-29'],
    [{ year: 2028, month: 2, day: 29 }, 12, '2029-02-28'],
    [{ year: 2027, month: 1, day: 1 }, -1, '2026-12-01'],
    [{ year: 2027, month: 12, day: 31 }, 1, '2028-01-31']
  ];
  for (const [date, months, expected] of cases) await t.test(`${c.toIsoDate(date)} + ${months} months`, () => assert.equal(c.toIsoDate(c.addMonths(date, months)), expected));
  assert.equal(c.toIsoDate(c.addDays({ year: 2027, month: 12, day: 31 }, 1)), '2028-01-01');
  assert.equal(c.toIsoDate(c.addDays({ year: 2028, month: 2, day: 28 }, 1)), '2028-02-29');
  assert.equal(c.toIsoDate(c.addDays({ year: 2027, month: 1, day: 1 }, -1)), '2026-12-31');
  assert.equal(c.daysBetween({ year: 2027, month: 1, day: 1 }, { year: 2028, month: 1, day: 1 }), 365);
  assert.deepEqual(c.calendarDifference({ year: 2027, month: 1, day: 1 }, { year: 2028, month: 3, day: 1 }), { years: 1, months: 2, days: 0 });
  assert.deepEqual(c.calendarDifference({ year: 2028, month: 3, day: 1 }, { year: 2027, month: 1, day: 1 }), { years: -1, months: -2, days: 0 });
  assert.equal(c.toIsoDate(c.addDays({ year: 2000, month: 1, day: 1 }, 36525)), '2100-01-01');
  assert.throws(() => c.addMonths({ year: 2027, month: 1, day: 1 }, 200000), RangeError);
});

test('time-zone conversions and DST diagnostics use Intl data', async t => {
  for (const zone of ['UTC', 'Europe/Istanbul', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney']) await t.test(`valid time zone ${zone}`, () => assert.equal(c.validateZone(zone), true));
  assert.equal(c.validateZone('Mars/Olympus'), false);
  assert.equal(c.offsetAt(Date.UTC(2027, 0, 1), 'UTC'), 0);
  assert.equal(c.offsetAt(Date.UTC(2027, 0, 1), 'Europe/Istanbul'), 180);
  assert.equal(c.zoneParts(Date.UTC(2027, 0, 1, 12), 'Asia/Tokyo').hour, 21);
  assert.equal(c.zoneMatrix(Date.UTC(2027, 0, 1), ['Bad/Zone'])[0].error, 'Invalid IANA time zone.');
  const gap = c.resolveWallTime({ year: 2027, month: 3, day: 14 }, { hour: 2, minute: 30, second: 0 }, 'America/New_York');
  assert.equal(gap.status, 'gap');
  const fold = c.resolveWallTime({ year: 2027, month: 11, day: 7 }, { hour: 1, minute: 30, second: 0 }, 'America/New_York');
  assert.equal(fold.status, 'fold');
  assert.equal(fold.instants.length, 2);
  assert.equal((fold.instants[1] - fold.instants[0]) / 3600000, 1);
  assert.equal(c.resolveWallTime({ year: 2027, month: 4, day: 5 }, { hour: 12, minute: 0, second: 0 }, 'America/New_York').status, 'unique');
  assert.equal(c.resolveWallTime({ year: 2027, month: 4, day: 5 }, { hour: 12, minute: 0, second: 0 }, 'Bad/Zone').status, 'invalid-zone');
  const transitions = c.findTransitions('America/New_York', 2027);
  assert.equal(transitions.length, 2);
  assert.deepEqual(transitions.map(x => x.classification), ['gap', 'fold']);
  assert.throws(() => c.findTransitions('UTC', 1969), RangeError);
});

test('ICS output is escaped, folded, and uses exclusive all-day end', async t => {
  const allDay = c.makeIcsEvent({ allDay: true, civil: { year: 2027, month: 1, day: 1 }, summary: 'One day' });
  assert.match(allDay, /DTSTART;VALUE=DATE:20270101\r\n/);
  assert.match(allDay, /DTEND;VALUE=DATE:20270102\r\n/);
  assert.match(allDay, /UID:.+\r\n/);
  assert.match(allDay, /DTSTAMP:\d{8}T\d{6}Z\r\n/);
  assert.ok(!allDay.includes('\n') || allDay.includes('\r\n'));
  const timed = c.makeIcsEvent({ allDay: false, instant: Date.UTC(2027, 0, 1, 12, 30), durationMinutes: 60, summary: 'UTC meeting' });
  assert.match(timed, /DTSTART:20270101T123000Z/);
  assert.match(timed, /DTEND:20270101T133000Z/);
  assert.equal(c.escapeIcsText('a,b;c\\d\ne'), 'a\\,b\\;c\\\\d\\ne');
  const longLine = c.foldIcsLine(`SUMMARY:${'é'.repeat(60)}`);
  assert.ok(longLine.split('\r\n').every((line, i) => new TextEncoder().encode(line).length <= 75 || (i > 0 && new TextEncoder().encode(line).length <= 75)));
  assert.ok(allDay.endsWith('\r\n'));
});

test('page scanner is on-demand and bounded', async t => {
  function fixture(texts) {
    const nodes = texts.map(text => ({ nodeValue: text, parentElement: { closest: selector => selector.includes('script') ? null : null } }));
    const doc = { defaultView: { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) }, createTreeWalker: () => { let i = 0; return { nextNode: () => nodes[i++] || null }; } };
    const root = { ownerDocument: doc }; for (const node of nodes) node.parentElement.ownerDocument = doc; return root;
  }
  const found = c.scanPage(fixture(['Release: 2027-01-01. Next milestone 03/04/2027.']), { maxCandidates: 10 });
  assert.equal(found.length, 2);
  assert.equal(found[1].parsed.status, 'ambiguous');
  assert.equal(c.scanPage(fixture(['2027-01-01 '.repeat(500)]), { maxCandidates: 3 }).length, 3);
  assert.deepEqual(c.scanPage(null), []);
  await t.test('RFC 3339 instants are candidates', () => assert.equal(c.scanPage(fixture(['Started 2027-01-01T12:30:00Z.']))[0].parsed.status, 'instant'));
  await t.test('named dates retain their parsed civil date', () => assert.equal(c.toIsoDate(c.scanPage(fixture(['January 1, 2027']))[0].parsed.civil), '2027-01-01'));
  await t.test('script/style/form nodes are skipped', () => {
    const node = { nodeValue: '2027-01-01', parentElement: { closest: () => ({}) } };
    const doc = { defaultView: { getComputedStyle: () => ({ display: 'block', visibility: 'visible' }) }, createTreeWalker: () => ({ nextNode: (() => { let once = false; return () => once ? null : (once = true, node); })() }) };
    assert.deepEqual(c.scanPage({ ownerDocument: doc }), []);
  });
  await t.test('hidden ancestors are skipped', () => {
    const hidden = { parentElement: null }; const parent = { parentElement: hidden, closest: () => null };
    const node = { nodeValue: '2027-01-01', parentElement: parent }; const root = { ownerDocument: null };
    const doc = { defaultView: { getComputedStyle: element => element === hidden ? { display: 'none', visibility: 'visible' } : { display: 'block', visibility: 'visible' } }, createTreeWalker: () => ({ nextNode: (() => { let once = false; return () => once ? null : (once = true, node); })() }) }; root.ownerDocument = doc;
    assert.deepEqual(c.scanPage(root), []);
  });
});

test('additional civil arithmetic edge cases', async t => {
  const cases = [
    [{ year: 2027, month: 3, day: 31 }, -1, '2027-02-28'],
    [{ year: 2028, month: 3, day: 31 }, -1, '2028-02-29'],
    [{ year: 2027, month: 1, day: 30 }, 1, '2027-02-28'],
    [{ year: 2027, month: 1, day: 1 }, 12, '2028-01-01'],
    [{ year: 2027, month: 1, day: 1 }, -12, '2026-01-01'],
    [{ year: 2027, month: 1, day: 1 }, 0, '2027-01-01']
  ];
  for (const [date, months, expected] of cases) await t.test(`${c.toIsoDate(date)} plus ${months}`, () => assert.equal(c.toIsoDate(c.addMonths(date, months)), expected));
  assert.equal(c.toIsoDate(c.addYears({ year: 2028, month: 2, day: 29 }, 1)), '2029-02-28');
  assert.equal(c.daysBetween({ year: 2027, month: 3, day: 1 }, { year: 2027, month: 2, day: 1 }), -28);
  assert.equal(c.inspectCivil({ year: 2027, month: 4, day: 1 }).quarter, 2);
  assert.equal(c.inspectCivil({ year: 2027, month: 12, day: 31 }).daysRemainingInYear, 0);
});

test('additional parsing and timezone offset cases', async t => {
  for (const [input, iso] of [
    ['2027-04-03', '2027-04-03'], ['2027/04/03', '2027-04-03'],
    ['April 3, 2027', '2027-04-03'], ['3 April 2027', '2027-04-03'],
    ['13/04/2027', '2027-04-13'], ['04/13/2027', '2027-04-13']
  ]) await t.test(`normalized parse ${input}`, () => assert.equal(c.toIsoDate(c.parseInput(input).civil), iso));
  assert.equal(c.parseInput('04/13/2027').inferredOrder, 'MDY');
  assert.equal(c.parseInput('2027-04-03T10:00:00-04:00').instant, Date.UTC(2027, 3, 3, 14));
  assert.equal(c.formatOffset(-300), 'UTC-05:00');
  assert.equal(c.formatOffset(345), 'UTC+05:45');
  assert.equal(c.zoneParts(Date.UTC(2027, 0, 1, 0), 'America/Los_Angeles').day, 31);
  assert.equal(c.zoneMatrix(Date.UTC(2027, 0, 1), ['UTC'], { year: 2026, month: 12, day: 31 })[0].dateRollover, 1);
});
