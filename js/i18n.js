const translations = {
  en: {
    "page.title": "Millikan Oil Drop Simulation",
    "language.switch": "العربية",
    "apparatus.heading": "Apparatus",
    "apparatus.description": "An oil drop between two charged parallel plates, with timing lines A and B and a voltage supply",
    "controls.heading": "Controls",
    "field.on": "Electric field on",
    "voltage.label": "Plate voltage",
    "readout.fallTime": "Fall time (A to B)",
    "readout.fallSpeed": "Fall speed",
    "readout.radius": "Drop radius",
    "readout.drift": "Drift speed",
    "readout.charge": "Charge q",
    "button.newDrop": "New Drop",
    "button.record": "Record Measurement",
    "button.clear": "Clear Results",
    "speed.label": "Simulation speed",
    "results.heading": "Recorded charges",
    "results.estimate": "estimate of e from {count} drops",
    "results.caption": "Recorded measurements",
    "table.drop": "Drop",
    "table.fallSpeed": "Fall speed",
    "table.radius": "Radius",
    "table.voltage": "Voltage",
    "table.charge": "q (× 10⁻¹⁹ C)",
    "chart.description": "Each recorded charge plotted against multiples of the elementary charge",
    "chart.tooltip": "Drop {index}: {charge} × 10⁻¹⁹ C = {units} e at {voltage} V",
    "status.start": "Press New Drop to begin.",
    "status.falling": "Watch the drop fall from line A to line B with the field off.",
    "status.timing": "Timing the drop between the lines.",
    "status.measured": "Fall speed measured. Switch the field on and adjust the voltage until the drop stops moving.",
    "status.balanced": "The drop is balanced. Record the measurement.",
    "status.recorded": "Recorded {units} e. Get a new drop to repeat the measurement.",
    "status.settled": "The drop has settled on the lower plate. Raise the voltage to lift it back up.",
    "unit.seconds": "{value} s",
    "unit.micrometresPerSecond": "{value} µm/s",
    "unit.micrometres": "{value} µm",
    "unit.volts": "{value} V",
    "unit.coulombs": "{value} × 10⁻¹⁹ C",
  },
  ar: {
    "page.title": "محاكاة تجربة قطرة الزيت لميليكان",
    "language.switch": "English",
    "apparatus.heading": "الجهاز",
    "apparatus.description": "قطرة زيت بين لوحين متوازيين مشحونين، مع خطي التوقيت A وB ومصدر الجهد",
    "controls.heading": "عناصر التحكم",
    "field.on": "تشغيل المجال الكهربائي",
    "voltage.label": "الجهد بين اللوحين",
    "readout.fallTime": "زمن السقوط (من A إلى B)",
    "readout.fallSpeed": "سرعة السقوط",
    "readout.radius": "نصف قطر القطرة",
    "readout.drift": "سرعة الانجراف",
    "readout.charge": "الشحنة q",
    "button.newDrop": "قطرة جديدة",
    "button.record": "تسجيل القياس",
    "button.clear": "مسح النتائج",
    "speed.label": "سرعة المحاكاة",
    "results.heading": "الشحنات المسجلة",
    "results.estimate": "تقدير قيمة e — عدد القطرات: {count}",
    "results.caption": "القياسات المسجلة",
    "table.drop": "القطرة",
    "table.fallSpeed": "سرعة السقوط",
    "table.radius": "نصف القطر",
    "table.voltage": "الجهد",
    "table.charge": "q (× 10⁻¹⁹ كولوم)",
    "chart.description": "كل شحنة مسجلة مقابل مضاعفات الشحنة الأولية",
    "chart.tooltip": "القطرة {index}: {charge} × 10⁻¹⁹ كولوم = {units} e عند {voltage} فولت",
    "status.start": "للبدء: زر «قطرة جديدة».",
    "status.falling": "القطرة تسقط والمجال مغلق. يُقاس زمن السقوط بين الخطين A وB.",
    "status.timing": "جارٍ قياس زمن السقوط بين الخطين.",
    "status.measured": "تم قياس سرعة السقوط. الخطوة التالية: تشغيل المجال وضبط الجهد حتى تتوقف القطرة.",
    "status.balanced": "القطرة متزنة. يمكن تسجيل القياس.",
    "status.recorded": "تم تسجيل {units} e. للحصول على قطرة أخرى: زر «قطرة جديدة».",
    "status.settled": "استقرت القطرة على اللوح السفلي. زيادة الجهد ترفعها من جديد.",
    "unit.seconds": "{value} ث",
    "unit.micrometresPerSecond": "{value} ميكرومتر/ث",
    "unit.micrometres": "{value} ميكرومتر",
    "unit.volts": "{value} فولت",
    "unit.coulombs": "{value} × 10⁻¹⁹ كولوم",
  },
};

const STORAGE_KEY = "language";
const TEXT_DIRECTIONS = { en: "ltr", ar: "rtl" };

let currentLanguage = "en";
const languageChangeListeners = [];

export function translate(key, params = {}) {
  const template = translations[currentLanguage][key] ?? translations.en[key];
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => params[name] ?? placeholder);
}

export function onLanguageChange(listener) {
  languageChangeListeners.push(listener);
}

function applyTranslations() {
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = TEXT_DIRECTIONS[currentLanguage];
  document.title = translate("page.title");
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = translate(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", translate(element.dataset.i18nAriaLabel));
  }
  for (const listener of languageChangeListeners) listener(currentLanguage);
}

function readSavedLanguage() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveLanguage(language) {
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {}
}

export function setLanguage(language) {
  currentLanguage = language in translations ? language : "en";
  saveLanguage(currentLanguage);
  applyTranslations();
}

export function toggleLanguage() {
  setLanguage(currentLanguage === "en" ? "ar" : "en");
}

export function initializeLanguage() {
  const savedLanguage = readSavedLanguage();
  currentLanguage = savedLanguage in translations ? savedLanguage : "en";
  applyTranslations();
}
