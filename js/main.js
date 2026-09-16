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
  statusMessage: { key: "status.start" },
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
  const { key, params } = state.statusMessage;
  elements.status.textContent = translate(key, params);
}

function setStatus(key, params) {
  state.statusMessage = { key, params };
  renderStatus();
}

function renderReadouts() {
  const { timing, measuredFallSpeed } = state;
  elements.fallTime.textContent = timing.fallTime === null ? "—" : formatUnit("seconds", timing.fallTime.toFixed(2));
  elements.fallSpeed.textContent = measuredFallSpeed === null ? "—" : formatMicrometresPerSecond(measuredFallSpeed);
  elements.dropRadius.textContent = measuredFallSpeed === null
    ? "—"
    : formatUnit("micrometres", (radiusFromFallSpeed(measuredFallSpeed) * 1e6).toFixed(2));
  elements.driftSpeed.textContent = state.drop === null ? "—" : formatMicrometresPerSecond(Math.abs(state.velocity));

  const balanced = isBalanced();
  const charge = balanced ? chargeFromMeasurement({ fallSpeed: measuredFallSpeed, voltage: appliedVoltage() }) : null;
  elements.charge.textContent = charge === null ? "—" : formatUnit("coulombs", (charge * 1e19).toFixed(2));
  elements.chargeUnits.textContent = charge === null ? "—" : chargeInElementaryUnits(charge).toFixed(2);
  elements.record.disabled = !balanced;
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

function newDrop() {
  state.drop = createRandomDrop();
  state.positionMetres = START_POSITION;
  state.velocity = 0;
  state.timing = { startedAt: null, fallTime: null };
  state.measuredFallSpeed = null;
  elements.fieldOn.checked = false;
  setStatus("status.falling");
  renderApparatus();
  renderReadouts();
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
  setStatus("status.recorded", { units: chargeInElementaryUnits(charge).toFixed(2) });
  renderResults();
}

function updateTiming(previousPosition, position) {
  if (elements.fieldOn.checked) return;
  const timing = state.timing;
  if (timing.startedAt === null && previousPosition < GATE_START && position >= GATE_START) {
    timing.startedAt = state.simulationSeconds;
    setStatus("status.timing");
    return;
  }
  if (timing.startedAt !== null && timing.fallTime === null && previousPosition < GATE_END && position >= GATE_END) {
    timing.fallTime = state.simulationSeconds - timing.startedAt;
    state.measuredFallSpeed = GATE_SEPARATION / timing.fallTime;
    setStatus("status.measured");
  }
}

function moveDrop(elapsedSeconds) {
  const drop = state.drop;
  const noiseFactor = 1 + (Math.random() * 2 - 1) * VELOCITY_NOISE;
  state.velocity = dropVelocity({ radius: drop.radius, charge: drop.charge, voltage: appliedVoltage() }) * noiseFactor;
  const previousPosition = state.positionMetres;
  const position = previousPosition - state.velocity * elapsedSeconds;
  const lowest = PLATE_SEPARATION - drop.radius;
  state.positionMetres = Math.min(lowest, Math.max(0, position));
  updateTiming(previousPosition, state.positionMetres);
  if (state.positionMetres === lowest && state.velocity < 0) {
    setStatus("status.settled");
  }
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
    const balanced = isBalanced();
    if (balanced) setStatus("status.balanced");
    elements.status.classList.toggle("status--balanced", balanced);
  }
  requestAnimationFrame(animationFrame);
}

function changeVoltage(step) {
  elements.voltage.value = String(Math.min(600, Math.max(0, Number(elements.voltage.value) + step)));
  elements.voltage.dispatchEvent(new Event("input"));
}

function renderVoltageDisplay() {
  elements.voltageDisplay.textContent = formatUnit("volts", elements.voltage.value);
}

function renderLanguage(language) {
  elements.toggleLanguage.lang = language === "en" ? "ar" : "en";
  renderVoltageDisplay();
  renderStatus();
  renderReadouts();
  renderResults();
}

elements.voltage.addEventListener("input", () => {
  renderVoltageDisplay();
  renderApparatus();
});
elements.fieldOn.addEventListener("change", renderApparatus);
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
