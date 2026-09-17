import {
  MAX_DROP_RADIUS,
  MIN_DROP_RADIUS,
  PLATE_SEPARATION,
  chargeFromMeasurement,
  chargeInElementaryUnits,
  createRandomDrop,
  nearestElectronCount,
  dropVelocity,
  radiusFromFallSpeed,
} from "./physics.js";
import { createApparatus } from "./apparatus.js";
import { createChargeChart } from "./chart.js";
import { initializeLanguage, onLanguageChange, toggleLanguage, translate } from "./i18n.js";

const START_POSITION = 1e-3;
const GATE_START = 1.5e-3;
const GATE_END = 2e-3;
const GATE_SEPARATION = GATE_END - GATE_START;
const BALANCE_SPEED_FRACTION = 0.02;
const VELOCITY_NOISE = 0.05;
const MAX_FRAME_SECONDS = 0.1;

const RADIUS_RANGE = { min: MIN_DROP_RADIUS, max: MAX_DROP_RADIUS };

const elements = {
  fieldOn: document.getElementById("field-on"),
  voltage: document.getElementById("voltage"),
  voltageDisplay: document.getElementById("voltage-display"),
  voltageDown: document.getElementById("voltage-down"),
  voltageUp: document.getElementById("voltage-up"),
  simulationSpeed: document.getElementById("simulation-speed"),
  newDrop: document.getElementById("new-drop"),
  record: document.getElementById("record"),
  status: document.getElementById("status"),
  fallTime: document.getElementById("fall-time"),
  fallSpeed: document.getElementById("fall-speed"),
  dropRadius: document.getElementById("drop-radius"),
  driftSpeed: document.getElementById("drift-speed"),
  charge: document.getElementById("charge"),
  chargeUnits: document.getElementById("charge-units"),
  estimatedCharge: document.getElementById("estimated-charge"),
  estimateLabel: document.getElementById("estimate-label"),
  toggleLanguage: document.getElementById("toggle-language"),
  resultsBody: document.getElementById("results-body"),
  clearResults: document.getElementById("clear-results"),
};

const apparatus = createApparatus(document.getElementById("apparatus"));
const chart = createChargeChart(document.getElementById("chart"), document.getElementById("chart-tooltip"), formatTooltip);

const state = {
  drop: null,
  positionMetres: START_POSITION,
  velocity: 0,
  timing: { startedAt: null, fallTime: null },
  measuredFallSpeed: null,
  simulationSeconds: 0,
  recordedUnits: null,
  restingOn: null,
  lastFrameAt: performance.now(),
  measurements: [],
};

function appliedVoltage() {
  return elements.fieldOn.checked ? Number(elements.voltage.value) : 0;
}

function isBalanced() {
  return state.measuredFallSpeed !== null
    && elements.fieldOn.checked
    && Math.abs(state.velocity) < BALANCE_SPEED_FRACTION * state.measuredFallSpeed;
}

function canRecord() {
  return isBalanced() && state.recordedUnits === null;
}

function statusMessage() {
  if (state.drop === null) return { key: "status.start" };
  if (state.recordedUnits !== null) return { key: "status.recorded", params: { units: state.recordedUnits } };
  if (state.measuredFallSpeed === null) {
    if (elements.fieldOn.checked) return { key: "status.fieldOnTooEarly" };
    if (state.timing.startedAt !== null) return { key: "status.timing" };
    if (state.restingOn !== null || state.positionMetres >= GATE_START) return { key: "status.liftDrop" };
    return { key: "status.falling" };
  }
  if (!elements.fieldOn.checked) return { key: "status.measured" };
  if (isBalanced()) return { key: "status.balanced" };
  if (state.restingOn === "top") return { key: "status.settledTop" };
  return state.velocity < 0 ? { key: "status.increaseVoltage" } : { key: "status.decreaseVoltage" };
}

function formatUnit(key, value) {
  return translate(`unit.${key}`, { value });
}

function formatMicrometresPerSecond(speed) {
  return formatUnit("micrometresPerSecond", (speed * 1e6).toFixed(1));
}

function formatTooltip(measurement) {
  return translate("chart.tooltip", {
    index: measurement.index,
    charge: (measurement.charge * 1e19).toFixed(2),
    units: chargeInElementaryUnits(measurement.charge).toFixed(2),
    voltage: Math.round(measurement.voltage),
  });
}

function renderStatus() {
  const { key, params } = statusMessage();
  elements.status.textContent = translate(key, params);
  elements.status.classList.toggle("status--balanced", key === "status.balanced");
}

function renderReadouts() {
  const { timing, measuredFallSpeed } = state;
  elements.fallTime.textContent = timing.fallTime === null ? "—" : formatUnit("seconds", timing.fallTime.toFixed(2));
  elements.fallSpeed.textContent = measuredFallSpeed === null ? "—" : formatMicrometresPerSecond(measuredFallSpeed);
  elements.dropRadius.textContent = measuredFallSpeed === null
    ? "—"
    : formatUnit("micrometres", (radiusFromFallSpeed(measuredFallSpeed) * 1e6).toFixed(2));
  elements.driftSpeed.textContent = state.drop === null
    ? "—"
    : `${driftArrow()} ${formatMicrometresPerSecond(Math.abs(state.velocity))}`;

  const balanced = isBalanced();
  const charge = balanced ? chargeFromMeasurement({ fallSpeed: measuredFallSpeed, voltage: appliedVoltage() }) : null;
  elements.charge.textContent = charge === null ? "—" : formatUnit("coulombs", (charge * 1e19).toFixed(2));
  elements.chargeUnits.textContent = charge === null ? "—" : chargeInElementaryUnits(charge).toFixed(2);
  elements.record.disabled = !canRecord();
}

function driftArrow() {
  if (isBalanced()) return "=";
  return state.velocity < 0 ? "↓" : "↑";
}

function renderApparatus() {
  apparatus.setField(appliedVoltage());
  apparatus.setDrop({
    positionMetres: state.positionMetres,
    radius: state.drop?.radius ?? MIN_DROP_RADIUS,
    radiusRange: RADIUS_RANGE,
    visible: state.drop !== null,
  });
  apparatus.setTimingActive("start", state.timing.startedAt !== null);
  apparatus.setTimingActive("end", state.timing.fallTime !== null);
}

function resetTiming() {
  state.timing = { startedAt: null, fallTime: null };
  state.measuredFallSpeed = null;
}

function newDrop() {
  state.drop = createRandomDrop();
  state.positionMetres = START_POSITION;
  state.velocity = 0;
  state.restingOn = null;
  state.recordedUnits = null;
  resetTiming();
  elements.fieldOn.checked = false;
  renderApparatus();
  renderReadouts();
  renderStatus();
}

function estimateElementaryCharge(measurements) {
  const total = measurements.reduce((sum, measurement) => sum + measurement.charge / nearestElectronCount(measurement.charge), 0);
  return total / measurements.length;
}

function renderResults() {
  const measurements = state.measurements;
  elements.estimateLabel.textContent = translate("results.estimate", { count: measurements.length });
  elements.estimatedCharge.textContent = measurements.length === 0
    ? "—"
    : formatUnit("coulombs", (estimateElementaryCharge(measurements) * 1e19).toFixed(3));
  elements.resultsBody.replaceChildren(...measurements.map((measurement) => {
    const row = document.createElement("tr");
    const cells = [
      measurement.index,
      formatMicrometresPerSecond(measurement.fallSpeed),
      formatUnit("micrometres", (measurement.radius * 1e6).toFixed(2)),
      formatUnit("volts", Math.round(measurement.voltage)),
      (measurement.charge * 1e19).toFixed(2),
      chargeInElementaryUnits(measurement.charge).toFixed(2),
    ];
    for (const value of cells) {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    }
    return row;
  }));
  chart.render(measurements);
}

function recordMeasurement() {
  const voltage = appliedVoltage();
  const charge = chargeFromMeasurement({ fallSpeed: state.measuredFallSpeed, voltage });
  state.measurements.push({
    index: state.measurements.length + 1,
    fallSpeed: state.measuredFallSpeed,
    radius: radiusFromFallSpeed(state.measuredFallSpeed),
    voltage,
    charge,
  });
  state.recordedUnits = chargeInElementaryUnits(charge).toFixed(2);
  renderResults();
  renderReadouts();
  renderStatus();
}

function crossedDownwards(gate, previousPosition, position) {
  return previousPosition < gate && position >= gate;
}

function updateTiming(previousPosition, position) {
  if (elements.fieldOn.checked) return;
  const timing = state.timing;
  if (crossedDownwards(GATE_START, previousPosition, position)) {
    resetTiming();
    state.timing.startedAt = state.simulationSeconds;
    return;
  }
  if (timing.startedAt !== null && timing.fallTime === null && crossedDownwards(GATE_END, previousPosition, position)) {
    timing.fallTime = state.simulationSeconds - timing.startedAt;
    state.measuredFallSpeed = GATE_SEPARATION / timing.fallTime;
  }
}

function moveDrop(elapsedSeconds) {
  const drop = state.drop;
  const noiseFactor = 1 + (Math.random() * 2 - 1) * VELOCITY_NOISE;
  state.velocity = dropVelocity({ radius: drop.radius, charge: drop.charge, voltage: appliedVoltage() }) * noiseFactor;
  const previousPosition = state.positionMetres;
  const position = previousPosition - state.velocity * elapsedSeconds;
  const lowest = PLATE_SEPARATION - drop.radius;
  const highest = drop.radius;
  state.positionMetres = Math.min(lowest, Math.max(highest, position));
  updateTiming(previousPosition, state.positionMetres);
  if (state.positionMetres === lowest && state.velocity < 0) state.restingOn = "bottom";
  else if (state.positionMetres === highest && state.velocity > 0) state.restingOn = "top";
  else state.restingOn = null;
}

function animationFrame(now) {
  const frameSeconds = Math.min((now - state.lastFrameAt) / 1000, MAX_FRAME_SECONDS);
  state.lastFrameAt = now;
  const elapsedSeconds = frameSeconds * Number(elements.simulationSpeed.value);
  state.simulationSeconds += elapsedSeconds;
  if (state.drop) {
    moveDrop(elapsedSeconds);
    renderApparatus();
    renderReadouts();
    renderStatus();
  }
  requestAnimationFrame(animationFrame);
}

function changeVoltage(step) {
  const highest = Number(elements.voltage.max);
  elements.voltage.value = String(Math.min(highest, Math.max(0, Number(elements.voltage.value) + step)));
  elements.voltage.dispatchEvent(new Event("input"));
}

function renderVoltageDisplay() {
  elements.voltageDisplay.textContent = formatUnit("volts", elements.voltage.value);
}

function renderLanguage(language) {
  elements.toggleLanguage.lang = language === "en" ? "ar" : "en";
  renderVoltageDisplay();
  renderStatus();
  renderResults();
  renderReadouts();
  renderResults();
}

elements.voltage.addEventListener("input", () => {
  renderVoltageDisplay();
  renderApparatus();
});
elements.fieldOn.addEventListener("change", () => {
  if (state.measuredFallSpeed === null) resetTiming();
  renderApparatus();
  renderReadouts();
  renderStatus();
});
elements.voltageDown.addEventListener("click", () => changeVoltage(-1));
elements.voltageUp.addEventListener("click", () => changeVoltage(1));
elements.newDrop.addEventListener("click", newDrop);
elements.record.addEventListener("click", recordMeasurement);
elements.toggleLanguage.addEventListener("click", toggleLanguage);
elements.clearResults.addEventListener("click", () => {
  state.measurements = [];
  renderResults();
});

apparatus.setGatePositions(GATE_START, GATE_END);
onLanguageChange(renderLanguage);
initializeLanguage();
renderApparatus();
requestAnimationFrame(animationFrame);
