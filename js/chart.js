import { chargeInElementaryUnits } from "./physics.js";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const PADDING = { top: 18, right: 22, bottom: 36, left: 30 };
const ROW_HEIGHT = 22;
const MIN_ROWS = 6;
const CHART_WIDTH = 640;
const MIN_AXIS_UNITS = 5;
const DOT_RADIUS = 5;

function createSvgElement(tag, attributes, parent) {
  const element = document.createElementNS(SVG_NAMESPACE, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  parent.appendChild(element);
  return element;
}

function axisUnits(measurements) {
  const highest = measurements.reduce((maximum, measurement) => Math.max(maximum, chargeInElementaryUnits(measurement.charge)), 0);
  return Math.max(MIN_AXIS_UNITS, Math.ceil(highest + 0.5));
}

export function createChargeChart(svg, tooltip, formatTooltip) {
  function showTooltip(measurement, x, y) {
    tooltip.textContent = formatTooltip(measurement);
    tooltip.hidden = false;
    const bounds = svg.getBoundingClientRect();
    const scale = bounds.width / CHART_WIDTH;
    tooltip.style.insetInlineStart = `${x * scale}px`;
    tooltip.style.top = `${y * scale}px`;
  }

  function hideTooltip() {
    tooltip.hidden = true;
  }

  function render(measurements) {
    hideTooltip();
    svg.replaceChildren();
    const rows = Math.max(MIN_ROWS, measurements.length);
    const height = PADDING.top + rows * ROW_HEIGHT + PADDING.bottom;
    svg.setAttribute("viewBox", `0 0 ${CHART_WIDTH} ${height}`);

    const units = axisUnits(measurements);
    const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
    const positionOf = (chargeUnits) => PADDING.left + (chargeUnits / units) * plotWidth;
    const baseline = height - PADDING.bottom;

    for (let unit = 1; unit <= units; unit += 1) {
      const x = positionOf(unit);
      createSvgElement("line", { class: "chart-reference", x1: x, x2: x, y1: PADDING.top - 6, y2: baseline }, svg);
      const label = createSvgElement("text", { class: "chart-tick", x, y: baseline + 20, "text-anchor": "middle" }, svg);
      label.textContent = `${unit}e`;
    }

    createSvgElement("line", { class: "chart-axis", x1: PADDING.left, x2: CHART_WIDTH - PADDING.right, y1: baseline, y2: baseline }, svg);

    measurements.forEach((measurement, row) => {
      const x = positionOf(chargeInElementaryUnits(measurement.charge));
      const y = PADDING.top + row * ROW_HEIGHT + ROW_HEIGHT / 2;
      const dot = createSvgElement("circle", { class: "chart-dot", cx: x, cy: y, r: DOT_RADIUS, tabindex: "0" }, svg);
      const hitArea = createSvgElement("circle", { class: "chart-hit-area", cx: x, cy: y, r: 14 }, svg);
      for (const element of [dot, hitArea]) {
        element.addEventListener("pointerenter", () => showTooltip(measurement, x, y));
        element.addEventListener("pointerleave", hideTooltip);
      }
      dot.addEventListener("focus", () => showTooltip(measurement, x, y));
      dot.addEventListener("blur", hideTooltip);
    });
  }

  return { render };
}
