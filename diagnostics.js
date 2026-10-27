(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NasShellDiagnostics = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_REPORT_BYTES = 65536;
  const HARDWARE_FIELDS = [
    ["cpu", "Процессор"],
    ["ram", "Оперативная память"],
    ["nic", "Сетевой адаптер"],
    ["storage", "Накопители"],
  ];

  class DiagnosticError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "DiagnosticError";
      this.code = code;
    }
  }

  function utf8Length(value) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(value, "utf8");
    return new Blob([value]).size;
  }

  function validateReport(report) {
    if (!report || typeof report !== "object" || Array.isArray(report) ||
        report.schemaVersion !== 1 || report.kind !== "nas-shell-hardware" ||
        !report.hardware || typeof report.hardware !== "object" || Array.isArray(report.hardware)) {
      throw new DiagnosticError("invalid-format", "Отчёт не соответствует формату NAS Shell v1.");
    }
    for (const [key] of HARDWARE_FIELDS) {
      const value = report.hardware[key];
      if (typeof value !== "string" || value.length > 200) {
        throw new DiagnosticError("invalid-format", "В отчёте отсутствует корректное поле оборудования.");
      }
    }
    if (report.details !== undefined && (!report.details || typeof report.details !== "object" ||
        Array.isArray(report.details) ||
        (report.details.network !== undefined && !Array.isArray(report.details.network)) ||
        (report.details.disks !== undefined && !Array.isArray(report.details.disks)))) {
      throw new DiagnosticError("invalid-format", "Некорректная структура подробностей отчёта.");
    }
    return report;
  }

  function parseReport(raw) {
    if (typeof raw !== "string") {
      throw new DiagnosticError("invalid-format", "Диагностика вернула данные неверного типа.");
    }
    if (utf8Length(raw) > MAX_REPORT_BYTES) {
      throw new DiagnosticError("too-large", "Отчёт превышает допустимый размер 64 КиБ.");
    }
    let report;
    try {
      report = JSON.parse(raw);
    } catch (_) {
      throw new DiagnosticError("invalid-format", "Не удалось прочитать JSON-отчёт диагностики.");
    }
    return validateReport(report);
  }

  const DEMO_REPORT = {
    schemaVersion: 1,
    kind: "nas-shell-hardware",
    source: "demo-sample-not-scanned",
    hardware: {
      cpu: "DEMO · Тестовый x86_64",
      ram: "DEMO · 16 ГБ",
      nic: "DEMO · test0 (виртуальный адаптер)",
      storage: "DEMO · 1 тестовый накопитель, 100 ГБ",
    },
    details: {
      network: [{ interface: "test0", state: "up" }],
      disks: [{ name: "demo0", capacityGb: 100.0 }],
    },
    compatibility: "unverified",
    writesEnabled: false,
  };

  class DemoDiagnosticsAdapter {
    constructor(options) {
      const config = options || {};
      this.delayMs = Number.isFinite(config.delayMs) ? Math.max(0, config.delayMs) : 700;
      this.response = config.response !== undefined ? config.response : JSON.stringify(DEMO_REPORT);
    }

    async scan() {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
      return this.response;
    }
  }

  async function runScan(adapter, onState) {
    if (!adapter || typeof adapter.scan !== "function") {
      throw new DiagnosticError("unavailable", "Источник диагностики недоступен.");
    }
    const publish = typeof onState === "function" ? onState : function () {};
    publish({ phase: "starting", progress: 0, title: "Подготовка сканирования", text: "DEMO · Подготовка тестового сценария." });
    try {
      publish({ phase: "collecting", progress: 1, title: "Сбор сведений", text: "DEMO · Получение тестового JSON без обращения к NAS." });
      const raw = await adapter.scan();
      publish({ phase: "validating", progress: 2, title: "Проверка отчёта", text: "Проверяем размер и структуру данных." });
      const report = parseReport(raw);
      publish({ phase: "applying", progress: 3, title: "Подготовка карточек", text: "DEMO · Заполняем карточки тестовыми сведениями." });
      publish({ phase: "complete", progress: 4, title: "Сканирование завершено", text: "✓ DEMO · Тестовый отчёт проверен и показан." });
      return report;
    } catch (error) {
      if (error instanceof DiagnosticError) throw error;
      throw new DiagnosticError("unavailable", "Демонстрационная диагностика временно недоступна.");
    }
  }

  function renderHardwareReport(document, report, list) {
    validateReport(report);
    const target = list || document.getElementById("hardwareImportedList");
    const nodes = [];
    for (const [key, label] of HARDWARE_FIELDS) {
      const term = document.createElement("dt");
      term.textContent = label;
      const value = document.createElement("dd");
      value.textContent = report.hardware[key] || "Не определено";
      nodes.push(term, value);
    }
    target.replaceChildren(...nodes);
  }

  function connectDemoUI(document, adapterOverride) {
    const button = document.getElementById("scanHardware");
    if (!button) return;
    const box = document.getElementById("scanProgress");
    const title = document.getElementById("scanProgressTitle");
    const text = document.getElementById("scanProgressText");
    const bar = document.getElementById("scanProgressBar");
    const status = document.getElementById("hardwareImportStatus");
    const imported = document.getElementById("hardwareImported");
    const sample = document.getElementById("hardwareSample");
    const adapter = adapterOverride || new DemoDiagnosticsAdapter();
    let running = false;

    button.addEventListener("click", async function () {
      if (running) return;
      running = true;
      button.disabled = true;
      button.setAttribute("aria-busy", "true");
      box.classList.remove("hidden", "scan-error", "scan-success");
      try {
        const report = await runScan(adapter, state => {
          title.textContent = state.title;
          text.textContent = state.text;
          bar.value = state.progress;
        });
        renderHardwareReport(document, report);
        sample.classList.add("hidden");
        imported.classList.remove("hidden");
        box.classList.add("scan-success");
        status.textContent = "✓ DEMO · Тестовый отчёт загружен локально. Реальное оборудование не сканировалось.";
      } catch (error) {
        const messages = {
          "invalid-format": ["Неверный формат данных", "Ошибка DEMO: JSON-отчёт имеет неверный формат."],
          "too-large": ["Превышен размер отчёта", "Ошибка DEMO: размер JSON превышает 64 КиБ."],
          unavailable: ["Диагностика недоступна", "Ошибка DEMO: источник тестовых данных недоступен."],
        };
        const message = messages[error.code] || messages.unavailable;
        title.textContent = message[0];
        text.textContent = message[1];
        box.classList.add("scan-error");
        status.textContent = message[1];
      } finally {
        button.disabled = false;
        button.removeAttribute("aria-busy");
        running = false;
      }
    });
  }

  return { MAX_REPORT_BYTES, DiagnosticError, DEMO_REPORT, DemoDiagnosticsAdapter,
    parseReport, validateReport, runScan, renderHardwareReport, connectDemoUI };
});

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { NasShellDiagnostics.connectDemoUI(document); });
  } else {
    NasShellDiagnostics.connectDemoUI(document);
  }
}
