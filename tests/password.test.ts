import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/password.ts";
test("hashes salted and verifies only the correct password", async () => {
  const password = "Una contraseña de prueba 123";
  const first = await hashPassword(password),
    second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("incorrecta", first), false);
  assert.equal(await verifyPassword(password, "invalid"), false);
  assert.equal(await verifyPassword(password, `scrypt:${"0".repeat(32)}:${"z".repeat(128)}`), false);
});
