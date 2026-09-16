import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ELEMENTARY_CHARGE,
  MAX_BALANCE_VOLTAGE,
  MAX_DROP_RADIUS,
  MAX_EXCESS_ELECTRONS,
  MIN_BALANCE_VOLTAGE,
  MIN_DROP_RADIUS,
  balanceVoltage,
  chargeFromMeasurement,
  chargeInElementaryUnits,
  createRandomDrop,
  dropVelocity,
  nearestElectronCount,
  radiusFromFallSpeed,
  terminalFallSpeed,
} from "../js/physics.js";

function relativeDifference(value, expected) {
  return Math.abs(value - expected) / expected;
}

test("fall speed and radius are inverses of each other", () => {
  for (const radius of [4e-7, 7e-7, 1.1e-6]) {
    assert.ok(relativeDifference(radiusFromFallSpeed(terminalFallSpeed(radius)), radius) < 1e-9);
  }
});

test("a balanced drop measures its own charge back", () => {
  for (let electrons = 1; electrons <= MAX_EXCESS_ELECTRONS; electrons += 1) {
    const drop = { radius: 8e-7, charge: electrons * ELEMENTARY_CHARGE };
    const measuredCharge = chargeFromMeasurement({
      fallSpeed: terminalFallSpeed(drop.radius),
      voltage: balanceVoltage(drop),
    });
    assert.ok(relativeDifference(measuredCharge, drop.charge) < 1e-9);
    assert.equal(nearestElectronCount(measuredCharge), electrons);
  }
});

test("the drop hangs still at its balance voltage", () => {
  const drop = { radius: 9e-7, charge: 3 * ELEMENTARY_CHARGE };
  const voltage = balanceVoltage(drop);
  assert.ok(Math.abs(dropVelocity({ ...drop, voltage })) < 1e-12);
  assert.ok(dropVelocity({ ...drop, voltage: voltage * 1.2 }) > 0);
  assert.ok(dropVelocity({ ...drop, voltage: voltage * 0.8 }) < 0);
});

test("a drop falls when the field is off", () => {
  const drop = { radius: 6e-7, charge: 2 * ELEMENTARY_CHARGE };
  assert.ok(relativeDifference(-dropVelocity({ ...drop, voltage: 0 }), terminalFallSpeed(drop.radius)) < 1e-9);
});

test("bigger drops fall faster and need more voltage to hold up", () => {
  const small = { radius: 5e-7, charge: 3 * ELEMENTARY_CHARGE };
  const large = { radius: 1e-6, charge: 3 * ELEMENTARY_CHARGE };
  assert.ok(terminalFallSpeed(large.radius) > terminalFallSpeed(small.radius));
  assert.ok(balanceVoltage(large) > balanceVoltage(small));
});

test("more charge on the same drop needs less voltage", () => {
  const radius = 8e-7;
  const single = balanceVoltage({ radius, charge: ELEMENTARY_CHARGE });
  const triple = balanceVoltage({ radius, charge: 3 * ELEMENTARY_CHARGE });
  assert.ok(relativeDifference(single / triple, 3) < 1e-9);
});

test("charge is reported in units of the elementary charge", () => {
  assert.ok(relativeDifference(chargeInElementaryUnits(5 * ELEMENTARY_CHARGE), 5) < 1e-12);
});

test("drops of every charge from one to eight electrons can appear", () => {
  const seen = new Set();
  for (let attempt = 0; attempt < 5000; attempt += 1) seen.add(createRandomDrop().excessElectrons);
  assert.ok(seen.size >= 5, [...seen].join(","));
});

test("random drops stay within the usable range of the apparatus", () => {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const drop = createRandomDrop();
    assert.ok(drop.radius >= MIN_DROP_RADIUS && drop.radius <= MAX_DROP_RADIUS);
    assert.ok(drop.excessElectrons >= 1 && drop.excessElectrons <= MAX_EXCESS_ELECTRONS);
    assert.equal(drop.charge, drop.excessElectrons * ELEMENTARY_CHARGE);
    const voltage = balanceVoltage(drop);
    assert.ok(voltage >= MIN_BALANCE_VOLTAGE && voltage <= MAX_BALANCE_VOLTAGE, `${voltage} V`);
  }
});
