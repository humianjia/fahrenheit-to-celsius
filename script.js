const page = document.body.dataset.page || "";
const themeColorTag = document.querySelector('meta[name="theme-color"]');

const units = {
  f: { symbol: "\u00B0F", name: "Fahrenheit" },
  c: { symbol: "\u00B0C", name: "Celsius" },
  k: { symbol: "K", name: "Kelvin" },
  r: { symbol: "\u00B0R", name: "Rankine" }
};

const themeBands = [
  { max: 32, band: "freeze", themeColor: "#6aaeff", label: "Freeze range", note: "At or below the freezing point of water." },
  { max: 60, band: "cool", themeColor: "#4eb9d7", label: "Cool range", note: "Cool outdoor temperatures in weather terms." },
  { max: 85, band: "neutral", themeColor: "#ef8d56", label: "Comfort range", note: "Mild temperatures for indoor comfort and daily weather." },
  { max: 110, band: "warm", themeColor: "#f0834d", label: "Warm range", note: "Hot enough to feel intense in direct weather exposure." },
  { max: 212, band: "hot", themeColor: "#e86a42", label: "Heat alert", note: "Serious heat conditions or very hot surfaces." },
  { max: Number.POSITIVE_INFINITY, band: "extreme", themeColor: "#d95234", label: "Oven heat", note: "Cooking or industrial temperatures, not climate." }
];

const contextMarkers = [
  { value: -40, threshold: 8, label: "Equal point", note: "-40 is the only temperature where Fahrenheit and Celsius match exactly." },
  { value: 32, threshold: 8, label: "Freezing point", note: "32 degrees Fahrenheit is the freezing point of water." },
  { value: 72, threshold: 12, label: "Comfort room", note: "72 degrees Fahrenheit is a classic comfortable room temperature." },
  { value: 98.6, threshold: 2.2, label: "Body temperature", note: "98.6 degrees Fahrenheit maps to the familiar 37 degrees Celsius benchmark." },
  { value: 100, threshold: 6, label: "Hot weather", note: "100 degrees Fahrenheit signals a very hot outdoor day." },
  { value: 212, threshold: 16, label: "Boiling point", note: "212 degrees Fahrenheit is the boiling point of water at sea level." },
  { value: 350, threshold: 28, label: "Oven setting", note: "350 degrees Fahrenheit is one of the most common baking temperatures." }
];

const formatter1 = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1
});

function sanitizeNumber(rawValue) {
  const trimmed = rawValue.trim().replace(/\s+/g, "");

  if (!trimmed) {
    return "";
  }

  if (trimmed.includes(",") && trimmed.includes(".")) {
    return trimmed.replace(/,/g, "");
  }

  if (trimmed.includes(",")) {
    return trimmed.replace(",", ".");
  }

  return trimmed;
}

function parseNumber(rawValue) {
  const sanitized = sanitizeNumber(rawValue);

  if (!sanitized) {
    return null;
  }

  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(sanitized)) {
    return Number.NaN;
  }

  return Number(sanitized);
}

function formatTemp(value) {
  return formatter1.format(value);
}

function convertTemperature(value, unit) {
  const key = unit.toLowerCase();

  if (key === "f") {
    const c = ((value - 32) * 5) / 9;
    return { f: value, c, k: c + 273.15, r: value + 459.67 };
  }

  if (key === "c") {
    const f = (value * 9) / 5 + 32;
    return { c: value, f, k: value + 273.15, r: (value + 273.15) * 9 / 5 };
  }

  if (key === "k") {
    const c = value - 273.15;
    const f = (c * 9) / 5 + 32;
    return { k: value, c, f, r: value * 9 / 5 };
  }

  const k = (value * 5) / 9;
  const c = k - 273.15;
  const f = value - 459.67;
  return { r: value, k, c, f };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setThemeByFahrenheit(fahrenheitValue) {
  if (!Number.isFinite(fahrenheitValue)) {
    document.body.dataset.tempBand = "neutral";
    document.body.style.setProperty("--progress", "52%");

    if (themeColorTag) {
      themeColorTag.setAttribute("content", "#ef8d56");
    }

    return themeBands[2];
  }

  const band = themeBands.find(({ max }) => fahrenheitValue <= max) ?? themeBands[2];
  const progress = ((clamp(fahrenheitValue, -40, 350) + 40) / 390) * 100;

  document.body.dataset.tempBand = band.band;
  document.body.style.setProperty("--progress", `${progress}%`);

  if (themeColorTag) {
    themeColorTag.setAttribute("content", band.themeColor);
  }

  return band;
}

function resolveContext(fahrenheitValue) {
  const band = setThemeByFahrenheit(fahrenheitValue);
  let match = null;

  contextMarkers.forEach((marker) => {
    const distance = Math.abs(fahrenheitValue - marker.value);

    if (distance <= marker.threshold) {
      if (!match || distance < match.distance) {
        match = { ...marker, distance };
      }
    }
  });

  return match
    ? { label: match.label, note: match.note }
    : { label: band.label, note: band.note };
}

function updateSearchParams(entries) {
  const url = new URL(window.location.href);

  Object.entries(entries).forEach(([key, value]) => {
    if (value === null || value === "") {
      url.searchParams.delete(key);
    } else {
      url.searchParams.set(key, value);
    }
  });

  window.history.replaceState({}, "", url);
}

function getParams() {
  return new URLSearchParams(window.location.search);
}

function createUnitSwitch(containerId, initialUnit) {
  const container = document.getElementById(containerId);
  const buttons = Array.from(container.querySelectorAll("[data-unit]"));
  let currentUnit = initialUnit;

  function apply(unit) {
    currentUnit = unit;
    buttons.forEach((button) => {
      const active = button.dataset.unit === unit;
      button.dataset.active = active ? "true" : "false";
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.tabIndex = active ? 0 : -1;
    });
  }

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      apply(button.dataset.unit);
      container.dispatchEvent(new CustomEvent("unitchange", { detail: { unit: button.dataset.unit } }));
    });

    button.addEventListener("keydown", (event) => {
      if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const index = buttons.indexOf(button);
      const direction = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      const next = buttons[(index + direction + buttons.length) % buttons.length];
      apply(next.dataset.unit);
      next.focus();
      container.dispatchEvent(new CustomEvent("unitchange", { detail: { unit: next.dataset.unit } }));
    });
  });

  apply(initialUnit);

  return {
    get value() {
      return currentUnit;
    },
    setValue(unit) {
      apply(unit);
    },
    onChange(callback) {
      container.addEventListener("unitchange", (event) => callback(event.detail.unit));
    }
  };
}

function renderHome() {
  const valueInput = document.getElementById("converter-value");
  const unitSwitch = createUnitSwitch("converter-unit-switch", "f");
  const clearButton = document.getElementById("converter-clear");
  const message = document.getElementById("converter-message");
  const summary = document.getElementById("converter-summary");
  const sourceValue = document.getElementById("source-value");
  const sourceUnit = document.getElementById("source-unit");
  const outputGrid = document.getElementById("home-output-grid");
  const contextLabel = document.getElementById("home-context-label");
  const contextNote = document.getElementById("home-context-note");
  const quickButtons = document.querySelectorAll("[data-quick-value]");
  const titleBase = "Convert Fahrenheit to Celsius in Real Time | Multi-Unit Temperature Converter";
  const outputDescriptions = {
    f: "The familiar U.S. weather and recipe scale.",
    c: "The global day-to-day temperature scale.",
    k: "Absolute temperature used in science and engineering.",
    r: "Absolute Fahrenheit-based scale used in technical work."
  };

  function renderOutputs(selectedUnit, values) {
    const keys = Object.keys(units).filter((key) => key !== selectedUnit);
    outputGrid.innerHTML = keys
      .map((key, index) => {
        const exact = values[key];
        const leadClass = index === 0 ? " output-card--lead" : "";
        return `
          <article class="output-card${leadClass}" data-unit="${key}">
            <span class="output-unit">${units[key].name}</span>
            <span class="output-value">${formatTemp(exact)}${units[key].symbol}</span>
            <p class="output-note">${outputDescriptions[key]}</p>
          </article>
        `;
      })
      .join("");
  }

  function resetHome() {
    sourceValue.textContent = "--";
    sourceUnit.textContent = units[unitSwitch.value].symbol;
    summary.textContent = "Enter a temperature and the other three scales update in real time.";
    contextLabel.textContent = "Ready for conversion";
    contextNote.textContent = "Switch between Fahrenheit, Celsius, Kelvin, and Rankine from one input.";
    message.textContent = "";
    renderOutputs(unitSwitch.value, { f: 32, c: 0, k: 273.15, r: 491.67 });
    setThemeByFahrenheit(72);
    document.title = titleBase;
  }

  function render() {
    const parsed = parseNumber(valueInput.value);
    const selectedUnit = unitSwitch.value;

    if (valueInput.value.trim() === "") {
      resetHome();
      updateSearchParams({ value: "", unit: selectedUnit });
      return;
    }

    if (Number.isNaN(parsed)) {
      sourceValue.textContent = "--";
      sourceUnit.textContent = units[selectedUnit].symbol;
      summary.textContent = "Use a valid number like 72, 98.6, 300, or -40.";
      contextLabel.textContent = "Input needed";
      contextNote.textContent = "The converter accepts negatives and decimals, including comma decimals.";
      message.textContent = "Enter a valid numeric temperature.";
      outputGrid.innerHTML = "";
      setThemeByFahrenheit(null);
      document.title = titleBase;
      return;
    }

    const values = convertTemperature(parsed, selectedUnit);
    const source = values[selectedUnit];
    const context = resolveContext(values.f);
    const outputText = Object.keys(units)
      .filter((key) => key !== selectedUnit)
      .map((key) => `${formatTemp(values[key])}${units[key].symbol}`)
      .join(", ");

    sourceValue.textContent = formatTemp(source);
    sourceUnit.textContent = units[selectedUnit].symbol;
    summary.textContent = `${formatTemp(source)}${units[selectedUnit].symbol} equals ${outputText}.`;
    contextLabel.textContent = context.label;
    contextNote.textContent = context.note;
    message.textContent = "";
    renderOutputs(selectedUnit, values);
    updateSearchParams({ value: sanitizeNumber(valueInput.value), unit: selectedUnit });

    if (selectedUnit === "f") {
      document.title = `${sanitizeNumber(valueInput.value)} Fahrenheit to Celsius = ${formatTemp(values.c)}\u00B0C`;
    } else {
      document.title = titleBase;
    }
  }

  quickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      valueInput.value = button.dataset.quickValue;
      unitSwitch.setValue(button.dataset.quickUnit);
      render();
      valueInput.focus();
    });
  });

  clearButton.addEventListener("click", () => {
    valueInput.value = "";
    render();
    valueInput.focus();
  });

  valueInput.addEventListener("input", render);
  unitSwitch.onChange(render);

  const params = getParams();
  const initialValue = params.get("value") || "72";
  const initialUnit = params.get("unit");

  if (initialUnit && units[initialUnit]) {
    unitSwitch.setValue(initialUnit);
  }

  valueInput.value = initialValue;
  render();
}

function renderFeverChecker() {
  const valueInput = document.getElementById("fever-value");
  const unitSwitch = createUnitSwitch("fever-unit-switch", "f");
  const clearButton = document.getElementById("fever-clear");
  const quickButtons = document.querySelectorAll("[data-fever-value]");
  const board = document.getElementById("fever-board");
  const chip = document.getElementById("fever-chip");
  const label = document.getElementById("fever-label");
  const note = document.getElementById("fever-note");
  const cOut = document.getElementById("fever-c");
  const fOut = document.getElementById("fever-f");
  const message = document.getElementById("fever-message");

  function classify(celsiusValue) {
    if (celsiusValue >= 39) {
      return { level: "high", chip: "High fever", label: "High fever range", note: "39\u00B0C and above is a high fever band." };
    }

    if (celsiusValue >= 38) {
      return { level: "fever", chip: "Fever", label: "Fever range", note: "38\u00B0C and above is treated as a fever." };
    }

    if (celsiusValue >= 37.5) {
      return { level: "low", chip: "Low fever", label: "Low fever range", note: "37.5\u00B0C is the lower fever threshold in this tool." };
    }

    return { level: "normal", chip: "Normal", label: "Normal range", note: "Below 37.5\u00B0C is classified as normal by this checker." };
  }

  function reset() {
    board.dataset.level = "normal";
    chip.textContent = "Waiting";
    label.textContent = "Body temperature check";
    note.textContent = "Enter a body temperature and the tool will classify it instantly.";
    cOut.textContent = "--";
    fOut.textContent = "--";
    message.textContent = "";
    setThemeByFahrenheit(98.6);
  }

  function render() {
    const parsed = parseNumber(valueInput.value);

    if (valueInput.value.trim() === "") {
      reset();
      updateSearchParams({ temp: "", unit: unitSwitch.value });
      return;
    }

    if (Number.isNaN(parsed)) {
      reset();
      message.textContent = "Enter a valid body temperature like 99.5 or 37.5.";
      return;
    }

    const converted = convertTemperature(parsed, unitSwitch.value);
    const status = classify(converted.c);

    board.dataset.level = status.level;
    chip.textContent = status.chip;
    label.textContent = status.label;
    note.textContent = status.note;
    cOut.textContent = formatTemp(converted.c);
    fOut.textContent = formatTemp(converted.f);
    message.textContent = "";
    setThemeByFahrenheit(converted.f);
    updateSearchParams({ temp: sanitizeNumber(valueInput.value), unit: unitSwitch.value });
  }

  quickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      valueInput.value = button.dataset.feverValue;
      unitSwitch.setValue(button.dataset.feverUnit);
      render();
    });
  });

  clearButton.addEventListener("click", () => {
    valueInput.value = "";
    render();
    valueInput.focus();
  });

  valueInput.addEventListener("input", render);

  const params = getParams();
  const initialValue = params.get("temp") || "99.5";
  const initialUnit = params.get("unit");

  if (initialUnit === "f" || initialUnit === "c") {
    unitSwitch.setValue(initialUnit);
  }

  valueInput.value = initialValue;
  unitSwitch.onChange(render);
  render();
}

function renderOvenTable() {
  const tbody = document.getElementById("oven-table-body");

  if (!tbody) {
    return;
  }

  const rows = [
    { f: 250, note: "Low and slow roasting" },
    { f: 275, note: "Gentle baking" },
    { f: 300, note: "Slow baking and drying" },
    { f: 325, note: "Moderate low oven" },
    { f: 350, note: "Classic baking setting" },
    { f: 375, note: "Moderate high oven" },
    { f: 400, note: "Roasting and crisping" },
    { f: 425, note: "Fast roasting" },
    { f: 450, note: "High heat baking" },
    { f: 475, note: "Pizza and aggressive roasting" },
    { f: 500, note: "Maximum oven heat" }
  ];

  tbody.innerHTML = rows
    .map(({ f, note }) => {
      const c = convertTemperature(f, "f").c;
      const rounded = Math.round(c / 5) * 5;
      return `
        <tr>
          <td>${f}\u00B0F</td>
          <td>${formatTemp(c)}\u00B0C</td>
          <td>${rounded}\u00B0C</td>
          <td>${note}</td>
        </tr>
      `;
    })
    .join("");

  setThemeByFahrenheit(350);
}

function renderWindChill() {
  const tempInput = document.getElementById("wind-temp");
  const speedInput = document.getElementById("wind-speed");
  const clearButton = document.getElementById("wind-clear");
  const quickButtons = document.querySelectorAll("[data-wind-temp]");
  const resultF = document.getElementById("wind-result-f");
  const resultC = document.getElementById("wind-result-c");
  const label = document.getElementById("wind-label");
  const note = document.getElementById("wind-note");
  const message = document.getElementById("wind-message");

  function reset() {
    resultF.textContent = "--";
    resultC.textContent = "--";
    label.textContent = "Wind chill output";
    note.textContent = "Add air temperature and wind speed to estimate how cold it feels.";
    message.textContent = "";
    setThemeByFahrenheit(30);
  }

  function render() {
    const temp = parseNumber(tempInput.value);
    const speed = parseNumber(speedInput.value);

    if (tempInput.value.trim() === "" && speedInput.value.trim() === "") {
      reset();
      updateSearchParams({ temp: "", wind: "" });
      return;
    }

    if (Number.isNaN(temp) || Number.isNaN(speed) || temp === null || speed === null || speed < 0) {
      reset();
      message.textContent = "Enter a valid Fahrenheit temperature and a non-negative wind speed.";
      return;
    }

    const factor = Math.pow(speed, 0.16);
    const windChillF = 35.74 + 0.6215 * temp - 35.75 * factor + 0.4275 * temp * factor;
    const windChillC = convertTemperature(windChillF, "f").c;
    const inRange = temp <= 50 && speed > 3;

    resultF.textContent = formatTemp(windChillF);
    resultC.textContent = formatTemp(windChillC);
    label.textContent = inRange ? "NOAA range" : "Estimated outside standard range";
    note.textContent = inRange
      ? "This result sits within the standard NOAA guidance range for wind chill."
      : "The formula is intended for temperatures at or below 50\u00B0F with winds above 3 mph.";
    message.textContent = "";
    setThemeByFahrenheit(windChillF);
    updateSearchParams({ temp: sanitizeNumber(tempInput.value), wind: sanitizeNumber(speedInput.value) });
  }

  quickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tempInput.value = button.dataset.windTemp;
      speedInput.value = button.dataset.windSpeed;
      render();
    });
  });

  clearButton.addEventListener("click", () => {
    tempInput.value = "";
    speedInput.value = "";
    render();
    tempInput.focus();
  });

  tempInput.addEventListener("input", render);
  speedInput.addEventListener("input", render);

  const params = getParams();
  tempInput.value = params.get("temp") || "30";
  speedInput.value = params.get("wind") || "20";
  render();
}

function renderHeatIndex() {
  const tempInput = document.getElementById("heat-temp");
  const humidityInput = document.getElementById("heat-humidity");
  const clearButton = document.getElementById("heat-clear");
  const quickButtons = document.querySelectorAll("[data-heat-temp]");
  const resultF = document.getElementById("heat-result-f");
  const resultC = document.getElementById("heat-result-c");
  const risk = document.getElementById("heat-risk");
  const note = document.getElementById("heat-note");
  const message = document.getElementById("heat-message");

  function classifyHeatIndex(value) {
    if (value >= 125) {
      return { label: "Extreme danger", note: "Heat stroke becomes highly likely with prolonged exposure." };
    }

    if (value >= 103) {
      return { label: "Danger", note: "Heat cramps and heat exhaustion become likely." };
    }

    if (value >= 90) {
      return { label: "Extreme caution", note: "Heat cramps and heat exhaustion become possible." };
    }

    if (value >= 80) {
      return { label: "Caution", note: "Fatigue is possible with prolonged exposure and activity." };
    }

    return { label: "Comfortable", note: "Heat index is below the usual caution threshold." };
  }

  function calculateHeatIndex(temp, humidity) {
    const simple = 0.5 * (temp + 61 + (temp - 68) * 1.2 + humidity * 0.094);
    let index = (simple + temp) / 2;

    if (index >= 80) {
      index =
        -42.379 +
        2.04901523 * temp +
        10.14333127 * humidity -
        0.22475541 * temp * humidity -
        0.00683783 * temp * temp -
        0.05481717 * humidity * humidity +
        0.00122874 * temp * temp * humidity +
        0.00085282 * temp * humidity * humidity -
        0.00000199 * temp * temp * humidity * humidity;

      if (humidity < 13 && temp >= 80 && temp <= 112) {
        index -= ((13 - humidity) / 4) * Math.sqrt((17 - Math.abs(temp - 95)) / 17);
      } else if (humidity > 85 && temp >= 80 && temp <= 87) {
        index += ((humidity - 85) / 10) * ((87 - temp) / 5);
      }
    }

    return index;
  }

  function reset() {
    resultF.textContent = "--";
    resultC.textContent = "--";
    risk.textContent = "Waiting";
    note.textContent = "Add air temperature and humidity to estimate how hot it feels.";
    message.textContent = "";
    setThemeByFahrenheit(88);
  }

  function render() {
    const temp = parseNumber(tempInput.value);
    const humidity = parseNumber(humidityInput.value);

    if (tempInput.value.trim() === "" && humidityInput.value.trim() === "") {
      reset();
      updateSearchParams({ temp: "", humidity: "" });
      return;
    }

    if (
      Number.isNaN(temp) ||
      Number.isNaN(humidity) ||
      temp === null ||
      humidity === null ||
      humidity < 0 ||
      humidity > 100
    ) {
      reset();
      message.textContent = "Use a valid Fahrenheit temperature and a humidity between 0 and 100.";
      return;
    }

    const heatIndexF = calculateHeatIndex(temp, humidity);
    const heatIndexC = convertTemperature(heatIndexF, "f").c;
    const status = classifyHeatIndex(heatIndexF);

    resultF.textContent = formatTemp(heatIndexF);
    resultC.textContent = formatTemp(heatIndexC);
    risk.textContent = status.label;
    note.textContent = status.note;
    message.textContent = "";
    setThemeByFahrenheit(heatIndexF);
    updateSearchParams({ temp: sanitizeNumber(tempInput.value), humidity: sanitizeNumber(humidityInput.value) });
  }

  quickButtons.forEach((button) => {
    button.addEventListener("click", () => {
      tempInput.value = button.dataset.heatTemp;
      humidityInput.value = button.dataset.heatHumidity;
      render();
    });
  });

  clearButton.addEventListener("click", () => {
    tempInput.value = "";
    humidityInput.value = "";
    render();
    tempInput.focus();
  });

  tempInput.addEventListener("input", render);
  humidityInput.addEventListener("input", render);

  const params = getParams();
  tempInput.value = params.get("temp") || "95";
  humidityInput.value = params.get("humidity") || "60";
  render();
}

function renderComparison() {
  const slider = document.getElementById("compare-range");
  const fOutput = document.getElementById("compare-f");
  const cOutput = document.getElementById("compare-c");
  const label = document.getElementById("compare-label");
  const note = document.getElementById("compare-note");

  function render() {
    const fahrenheit = Number(slider.value);
    const converted = convertTemperature(fahrenheit, "f");
    const context = resolveContext(fahrenheit);
    const progress = (fahrenheit / 212) * 100;

    fOutput.textContent = formatTemp(fahrenheit);
    cOutput.textContent = formatTemp(converted.c);
    label.textContent = context.label;
    note.textContent = context.note;
    setThemeByFahrenheit(fahrenheit);
    document.body.style.setProperty("--progress", `${progress}%`);
    updateSearchParams({ f: slider.value });
  }

  slider.addEventListener("input", render);

  const params = getParams();
  const initial = params.get("f");

  if (initial && !Number.isNaN(Number(initial))) {
    slider.value = clamp(Number(initial), 0, 212);
  }

  render();
}

function renderEqualPoint() {
  setThemeByFahrenheit(-40);
}

function parseBatchLine(line) {
  const cleaned = line.trim();

  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^(-?(?:\d+\.?\d*|\.\d+))\s*(?:\u00B0)?\s*([a-zA-Z]+)$/);

  if (!match) {
    return { error: "Could not read the number and unit." };
  }

  const value = Number(match[1]);
  const unitToken = match[2].toLowerCase();
  const map = {
    f: "f",
    fahrenheit: "f",
    c: "c",
    celsius: "c",
    k: "k",
    kelvin: "k",
    r: "r",
    rankine: "r"
  };
  const unit = map[unitToken];

  if (!unit) {
    return { error: "Supported units are F, C, K, and R." };
  }

  return { value, unit };
}

function renderBatchConverter() {
  const input = document.getElementById("batch-input");
  const clearButton = document.getElementById("batch-clear");
  const sampleButton = document.getElementById("batch-sample");
  const count = document.getElementById("batch-count");
  const errorCount = document.getElementById("batch-errors");
  const rows = document.getElementById("batch-results");

  function render() {
    const lines = input.value.split(/\r?\n/);
    const valid = [];
    const invalid = [];

    lines.forEach((line, index) => {
      const parsed = parseBatchLine(line);

      if (!parsed) {
        return;
      }

      if (parsed.error) {
        invalid.push({ line, index: index + 1, error: parsed.error });
        return;
      }

      const converted = convertTemperature(parsed.value, parsed.unit);
      valid.push({
        line: line.trim(),
        index: index + 1,
        unit: parsed.unit,
        converted
      });
    });

    count.textContent = String(valid.length);
    errorCount.textContent = String(invalid.length);

    if (!valid.length && !invalid.length) {
      rows.innerHTML = `
        <div class="empty-state">
          <strong>Paste one temperature per line</strong>
          <p>Examples: <code>72F</code>, <code>100C</code>, <code>300K</code>, <code>500R</code>.</p>
        </div>
      `;
      setThemeByFahrenheit(72);
      return;
    }

    const validMarkup = valid
      .map(({ line, index, converted }) => {
        const output = Object.keys(units)
          .map((key) => `${formatTemp(converted[key])}${units[key].symbol}`)
          .join(" | ");

        return `
          <article class="result-entry">
            <div class="entry-top">
              <strong class="entry-source">${line}</strong>
              <span class="entry-meta">line ${index}</span>
            </div>
            <p class="entry-conversions">${output}</p>
          </article>
        `;
      })
      .join("");

    const invalidMarkup = invalid
      .map(
        ({ line, index, error }) => `
          <article class="result-entry">
            <div class="entry-top">
              <strong class="entry-source">${line || "(empty)"}</strong>
              <span class="entry-meta">line ${index}</span>
            </div>
            <p class="entry-conversions">${error}</p>
          </article>
        `
      )
      .join("");

    rows.innerHTML = validMarkup + invalidMarkup;

    if (valid[0]) {
      setThemeByFahrenheit(valid[0].converted.f);
    }
  }

  clearButton.addEventListener("click", () => {
    input.value = "";
    render();
    input.focus();
  });

  sampleButton.addEventListener("click", () => {
    input.value = ["72F", "100C", "300K", "520R"].join("\n");
    render();
    input.focus();
  });

  input.addEventListener("input", render);
  render();
}

const initializers = {
  home: renderHome,
  fever: renderFeverChecker,
  oven: renderOvenTable,
  wind: renderWindChill,
  heat: renderHeatIndex,
  comparison: renderComparison,
  equal: renderEqualPoint,
  batch: renderBatchConverter
};

if (initializers[page]) {
  initializers[page]();
} else {
  setThemeByFahrenheit(72);
}

