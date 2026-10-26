import assert from "node:assert/strict";
import test from "node:test";
import { parseBcvNumber, parseBcvUsdRate } from "../src/lib/bcv-parser.ts";

test("interprets the official BCV USD value and fecha valor", () => {
  const html = `<div class="dolar"><span>USD</span><strong>887,30200000</strong></div><div>Fecha Valor: Martes, 27 Octubre 2026</div>`;
  assert.deepEqual(parseBcvUsdRate(html), { rate: 887.302, date: "2026-10-27" });
});

test("normalizes decimal separators without accepting invalid values", () => {
  assert.equal(parseBcvNumber("1.234,56789000"), 1234.56789);
  assert.equal(parseBcvNumber("887.30200000"), 887.302);
  assert.throws(() => parseBcvNumber("sin tasa"));
});
