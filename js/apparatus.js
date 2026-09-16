import { PLATE_SEPARATION } from "./physics.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const LAYOUT = {
  chamberLeft: 34,
  chamberRight: 266,
  chamberTop: 60,
  chamberBottom: 360,
  plateThickness: 12,
  supplyX: 276,
  supplyY: 186,
  supplyWidth: 56,
  supplyHeight: 48,
};

const CHAMBER_HEIGHT = LAYOUT.chamberBottom - LAYOUT.chamberTop;
const RETICLE_SPACING_METRES = 5e-4;
const MIN_DROP_PIXEL_RADIUS = 2.5;
const MAX_DROP_PIXEL_RADIUS = 5;

export function metresToPixels(metresFromTopPlate) {
  return LAYOUT.chamberTop + (metresFromTopPlate / PLATE_SEPARATION) * CHAMBER_HEIGHT;
}

function createSvgElement(tag, attributes, parent) {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  parent.appendChild(element);
  return element;
}

function drawChamber(svg) {
  createSvgElement("rect", {
    class: "chamber",
    x: LAYOUT.chamberLeft,
    y: LAYOUT.chamberTop,
    width: LAYOUT.chamberRight - LAYOUT.chamberLeft,
    height: CHAMBER_HEIGHT,
  }, svg);
}

function drawReticle(svg) {
  const reticle = createSvgElement("g", { class: "reticle" }, svg);
  for (let metres = RETICLE_SPACING_METRES; metres < PLATE_SEPARATION; metres += RETICLE_SPACING_METRES) {
    createSvgElement("line", {
      x1: LAYOUT.chamberLeft + 40,
      x2: LAYOUT.chamberRight - 40,
      y1: metresToPixels(metres),
      y2: metresToPixels(metres),
    }, reticle);
  }
}

function drawGate(svg, name) {
  const gate = createSvgElement("g", { class: `gate gate--${name}` }, svg);
  const line = createSvgElement("line", { x1: LAYOUT.chamberLeft, x2: LAYOUT.chamberRight, y1: 0, y2: 0 }, gate);
  const label = createSvgElement("text", { class: "gate-label", x: LAYOUT.chamberLeft + 6, y: 0 }, gate);
  label.textContent = name === "start" ? "A" : "B";
  return { line, label };
}

function drawPlate(svg, name) {
  const plate = createSvgElement("g", { class: `plate plate--${name}` }, svg);
  const isTop = name === "top";
  const y = isTop ? LAYOUT.chamberTop - LAYOUT.plateThickness : LAYOUT.chamberBottom;
  const holeHalfWidth = 9;
  const middle = (LAYOUT.chamberLeft + LAYOUT.chamberRight) / 2;
  if (isTop) {
    createSvgElement("rect", { class: "plate-bar", x: LAYOUT.chamberLeft - 12, y, width: middle - holeHalfWidth - LAYOUT.chamberLeft + 12, height: LAYOUT.plateThickness, rx: 2 }, plate);
    createSvgElement("rect", { class: "plate-bar", x: middle + holeHalfWidth, y, width: LAYOUT.chamberRight + 12 - middle - holeHalfWidth, height: LAYOUT.plateThickness, rx: 2 }, plate);
  } else {
    createSvgElement("rect", { class: "plate-bar", x: LAYOUT.chamberLeft - 12, y, width: LAYOUT.chamberRight - LAYOUT.chamberLeft + 24, height: LAYOUT.plateThickness, rx: 2 }, plate);
  }
  const sign = createSvgElement("text", {
    class: "plate-sign",
    x: LAYOUT.chamberLeft - 20,
    y: isTop ? y + 10 : y + 11,
    "text-anchor": "end",
  }, plate);
  sign.textContent = "";
  return sign;
}

function drawFieldArrows(svg) {
  const arrows = createSvgElement("g", { class: "field-arrows" }, svg);
  for (const x of [LAYOUT.chamberLeft + 18, LAYOUT.chamberRight - 18]) {
    for (let step = 0; step < 4; step += 1) {
      const top = LAYOUT.chamberTop + 30 + step * 70;
      createSvgElement("path", { d: `M ${x} ${top + 44} L ${x} ${top} M ${x - 5} ${top + 8} L ${x} ${top} L ${x + 5} ${top + 8}` }, arrows);
    }
  }
  return arrows;
}

function drawSupply(svg) {
  const supply = createSvgElement("g", { class: "supply" }, svg);
  createSvgElement("path", {
    class: "wire",
    d: `M ${LAYOUT.chamberRight + 12} ${LAYOUT.chamberTop - 6} H ${LAYOUT.supplyX + LAYOUT.supplyWidth / 2} V ${LAYOUT.supplyY}`,
  }, supply);
  createSvgElement("path", {
    class: "wire",
    d: `M ${LAYOUT.chamberRight + 12} ${LAYOUT.chamberBottom + 6} H ${LAYOUT.supplyX + LAYOUT.supplyWidth / 2} V ${LAYOUT.supplyY + LAYOUT.supplyHeight}`,
  }, supply);
  createSvgElement("rect", { class: "supply-body", x: LAYOUT.supplyX, y: LAYOUT.supplyY, width: LAYOUT.supplyWidth, height: LAYOUT.supplyHeight, rx: 5 }, supply);
  const reading = createSvgElement("text", {
    class: "supply-reading",
    x: LAYOUT.supplyX + LAYOUT.supplyWidth / 2,
    y: LAYOUT.supplyY + LAYOUT.supplyHeight / 2 + 6,
    "text-anchor": "middle",
  }, supply);
  reading.textContent = "0 V";
  return reading;
}

export function createApparatus(svg) {
  drawChamber(svg);
  drawReticle(svg);
  const fieldArrows = drawFieldArrows(svg);
  const startGate = drawGate(svg, "start");
  const endGate = drawGate(svg, "end");
  const drop = createSvgElement("circle", { class: "drop", cx: (LAYOUT.chamberLeft + LAYOUT.chamberRight) / 2, cy: metresToPixels(0), r: MIN_DROP_PIXEL_RADIUS }, svg);
  const topSign = drawPlate(svg, "top");
  const bottomSign = drawPlate(svg, "bottom");
  const supplyReading = drawSupply(svg);

  function setGatePositions(startMetres, endMetres) {
    for (const [gate, metres] of [[startGate, startMetres], [endGate, endMetres]]) {
      const y = metresToPixels(metres);
      gate.line.setAttribute("y1", y);
      gate.line.setAttribute("y2", y);
      gate.label.setAttribute("y", y - 5);
    }
  }

  function setDrop({ positionMetres, radius, radiusRange, visible }) {
    drop.setAttribute("cy", metresToPixels(positionMetres));
    const sizeFraction = (radius - radiusRange.min) / (radiusRange.max - radiusRange.min);
    drop.setAttribute("r", MIN_DROP_PIXEL_RADIUS + sizeFraction * (MAX_DROP_PIXEL_RADIUS - MIN_DROP_PIXEL_RADIUS));
    drop.style.display = visible ? "" : "none";
  }

  function setField(voltage) {
    const fieldOn = voltage > 0;
    fieldArrows.style.opacity = fieldOn ? String(Math.min(1, 0.25 + voltage / 600)) : "0";
    topSign.textContent = fieldOn ? "+" : "";
    bottomSign.textContent = fieldOn ? "−" : "";
    supplyReading.textContent = `${Math.round(voltage)} V`;
  }

  function setTimingActive(gateName, active) {
    const gate = gateName === "start" ? startGate : endGate;
    gate.line.parentElement.classList.toggle("gate--active", active);
  }

  return { setGatePositions, setDrop, setField, setTimingActive };
}
