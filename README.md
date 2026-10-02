# ChronoLens

**Inspect, convert and understand dates without leaving the page.**

ChronoLens is a local-first userscript for inspecting dates and instants, comparing calendar dates, checking time zones and daylight-saving transitions, and generating iCalendar events. It works from a text selection or manually entered value and is available on ordinary HTTP and HTTPS pages through a keyboard shortcut or userscript-manager menu.

## Features

- Civil-date inspection, including ordinal day, ISO week-year, quarter, leap-year state, and adjacent dates.
- Explicit ambiguous-date results for values such as `03/04/2027`; the saved DMY/MDY preference does not hide the ambiguity.
- Calendar addition/subtraction with documented CLAMP semantics and exact day/calendar differences.
- Month view with configurable Monday or Sunday week start and distinct today/selected-date styling.
- Local time-zone matrix powered by `Intl.DateTimeFormat`, plus DST gap/fold checks and yearly offset-transition inspection.
- User-triggered page date scanning with size and candidate limits; hidden text and form controls are skipped.
- Local ICS generation with an editable preview, escaping, CRLF line endings, line folding, and exclusive all-day `DTEND`.
- Copyable ISO, ISO week, RFC 3339, Unix timestamp, JSON, and ICS values where applicable.

## Installation and use

Install [ChronoLens from Greasy Fork](https://greasyfork.org/en/scripts/598402-chronolens-date-calendar-intelligence-toolkit). In a supported userscript manager, open ChronoLens from its menu or press **Alt + Shift + D**. Select the optional selection bubble in Settings to enable it; it is off by default. Manual input is always available.

## Date semantics

`YYYY-MM-DD` is a civil date and is never shifted through the computer's local time zone. RFC 3339 values with an explicit offset represent instants. A time without an offset is a local wall time and does not identify a unique instant until paired with a time zone. Ambiguous numeric dates remain visible as ambiguous. Month/year arithmetic clamps to the last valid day of the destination month (for example, January 31 + one month is February 28 or 29).

Time-zone calculations use the browser's built-in IANA time-zone data. The DST inspector supports an operational range of 1970–2100; historical results can differ across browser versions.

## Privacy and security

All calculations happen locally. The script makes no network requests, has no analytics or telemetry, loads no remote executable code, and sends no selected text or page content to any server. The page scanner runs only after the user asks it to scan. It skips scripts, styles, templates, hidden text, and form fields, and stops after 250,000 characters or 100 results.

The open Shadow DOM keeps the UI inspectable. Page text is rendered with text nodes and is never treated as markup.

## Compatibility

The source targets modern browsers with userscript-manager support, `Intl.DateTimeFormat` time-zone parts, `TextEncoder`, and Blob URLs. Compatibility labels will be added to Greasy Fork only after browser/manager testing is completed.

## Development

Requires Node.js 24 or a compatible recent Node release. No runtime package dependencies are used.

```sh
npm test
npm run build
npm run check
```

`src/chronolens.user.js` is the readable source. `dist/chronolens.user.js` is reproducibly copied from it with a generated-file header. The test fixtures are in `tests/fixtures/`.

## Project

ChronoLens is maintained as part of the calendar-engineering tools around [JW Calendar](https://jwcalendar.com/). The project source and issue tracker are linked in the userscript's About panel and Greasy Fork metadata.

## License

Released under the MIT License. See [LICENSE](LICENSE).
