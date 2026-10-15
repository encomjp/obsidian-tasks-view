import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  addYears,
  daysBetween,
  isValidDate,
  localToday,
  mondayOf,
  normalizeTime,
  weekday,
} from "../src/dates.ts";

test("isValidDate accepts real calendar dates and rejects impossible ones", () => {
  assert.equal(isValidDate("2026-09-09"), true);
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-02-29"), false);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-13-01"), false);
  assert.equal(isValidDate("2026-00-10"), false);
  assert.equal(isValidDate("0000-01-01"), false);
  assert.equal(isValidDate("2026-9-9"), false);
  assert.equal(isValidDate("2026-09-09 "), false);
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2026-09-09", 0), "2026-09-09");
});

test("addDays returns null outside the 1..9999 year range", () => {
  assert.equal(addDays("9999-12-31", 1), null);
});

test("addMonths clamps the day to the end of a shorter month", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonths("2026-03-31", -1), "2026-02-28");
  assert.equal(addMonths("2026-01-31", -2), "2025-11-30");
});

test("addMonths rolls the year over in both directions", () => {
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonths("2026-01-15", -1), "2025-12-15");
  assert.equal(addMonths("2026-09-09", 12), "2027-09-09");
});

test("addMonths returns null when the year leaves 1..9999", () => {
  assert.equal(addMonths("9999-12-31", 1), null);
  assert.equal(addMonths("0001-01-01", -1), null);
});

test("addYears clamps Feb 29 in non-leap years", () => {
  assert.equal(addYears("2024-02-29", 1), "2025-02-28");
  assert.equal(addYears("2024-02-29", 4), "2028-02-29");
});

test("weekday uses 0 = Sunday ... 6 = Saturday", () => {
  assert.equal(weekday("2026-10-04"), 0);
  assert.equal(weekday("2026-10-05"), 1);
  assert.equal(weekday("2026-10-10"), 6);
});

test("mondayOf returns the Monday of the containing week", () => {
  assert.equal(mondayOf("2026-10-05"), "2026-10-05");
  assert.equal(mondayOf("2026-10-07"), "2026-10-05");
  assert.equal(mondayOf("2026-10-04"), "2026-09-28");
  assert.equal(mondayOf("2026-01-01"), "2025-12-29");
});

test("normalizeTime pads single-digit hours and rejects invalid times", () => {
  assert.equal(normalizeTime("9:30"), "09:30");
  assert.equal(normalizeTime("09:30"), "09:30");
  assert.equal(normalizeTime("23:59"), "23:59");
  assert.equal(normalizeTime(" 14:00 "), "14:00");
  assert.equal(normalizeTime("24:00"), null);
  assert.equal(normalizeTime("12:60"), null);
  assert.equal(normalizeTime("25:99"), null);
  assert.equal(normalizeTime("noon"), null);
});

test("daysBetween counts whole days, signed", () => {
  assert.equal(daysBetween("2026-09-09", "2026-09-16"), 7);
  assert.equal(daysBetween("2026-09-16", "2026-09-09"), -7);
  assert.equal(daysBetween("2026-02-28", "2026-03-01"), 1);
  assert.equal(daysBetween("2026-09-09", "2026-09-09"), 0);
});

test("localToday formats the local calendar date", () => {
  assert.equal(localToday(new Date(2026, 0, 5, 23, 59)), "2026-01-05");
  assert.equal(localToday(new Date(2026, 8, 9, 0, 30)), "2026-09-09");
});
