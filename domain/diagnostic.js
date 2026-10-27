(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NasShellDiagnostic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_REPORT_BYTES = 65536;
  const FIELD_KEYS = ["cpu", "ram", "nic", "storage"];
  class DiagnosticError extends Error {
    constructor(code, message) { super(message); this.name = "DiagnosticError"; this.code = code; }
  }
  const DEMO_REPORT = Object.freeze({
    schemaVersion: 1,
    kind: "nas-shell-hardware",
    source: "DEMO · Локальный тестовый адаптер",
    hardware: Object.freeze({
      cpu: "DEMO · Тестовый x86_64",
      ram: "DEMO · 16 ГБ",
      nic: "DEMO · demo-net0",
      storage: "DEMO · demo-disk0, 64 ГБ",
    }),
    details: Object.freeze({
      network: Object.freeze([Object.freeze({ interface: "DEMO · demo-net0", state: "up" })]),
      disks: Object.freeze([Object.freeze({ name: "DEMO · demo-disk0", capacityGb: 64 })]),
    }),
    compatibility: "unverified",
    writesEnabled: false,
  });

  function byteLength(value) {
    if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).length;
    if (typeof Buffer !== "undefined") return Buffer.byteLength(value, "utf8");
    return new Blob([value]).size;
  }

  function parseReport(raw) {
    if (typeof raw !== "string") throw new DiagnosticError("invalid-format", "Отчёт должен быть текстом JSON.");
    if (byteLength(raw) > MAX_REPORT_BYTES) throw new DiagnosticError("too-large", "Размер отчёта превышает 64 КиБ.");
    let report;
    try { report = JSON.parse(raw); } catch (_) { throw new DiagnosticError("invalid-format", "Файл содержит некорректный JSON."); }
    if (!report || typeof report !== "object" || Array.isArray(report) ||
        report.schemaVersion !== 1 || report.kind !== "nas-shell-hardware" ||
        !report.hardware || typeof report.hardware !== "object" || Array.isArray(report.hardware)) {
      throw new DiagnosticError("invalid-format", "Ожидается диагностический отчёт NAS Shell v1.");
    }
    for (const key of FIELD_KEYS) {
      const value = report.hardware[key];
      if (value !== undefined && (typeof value !== "string" || value.length > 200)) {
        throw new DiagnosticError("invalid-format", "В отчёте есть некорректное поле оборудования.");
      }
    }
    if (report.details !== undefined && (!report.details || typeof report.details !== "object" ||
        Array.isArray(report.details) ||
        (report.details.network !== undefined && !Array.isArray(report.details.network)) ||
        (report.details.disks !== undefined && !Array.isArray(report.details.disks)) ||
        (report.details.drivers !== undefined && !Array.isArray(report.details.drivers)))) {
      throw new DiagnosticError("invalid-format", "В отчёте некорректен раздел подробных данных.");
    }
    return report;
  }

  function valueOrUnknown(value) {
    return typeof value === "string" && value.trim() ? value : "Не определено";
  }

  function normalize(report) {
    const data = parseReport(JSON.stringify(report));
    const hardware = {};
    for (const key of FIELD_KEYS) hardware[key] = valueOrUnknown(data.hardware[key]);
    const details = data.details || {};
    const drivers = Array.isArray(details.drivers) ? details.drivers.slice() : [];
    for (const item of [].concat(details.network || [], details.disks || [])) {
      if (item && typeof item.driver === "string" && item.driver.trim()) drivers.push(item.driver);
      if (item && Array.isArray(item.drivers)) drivers.push(...item.drivers.filter(x => typeof x === "string"));
    }
    return {
      schemaVersion: data.schemaVersion,
      kind: data.kind,
      source: valueOrUnknown(data.source),
      hardware,
      details: { network: details.network || [], disks: details.disks || [], drivers },
      compatibility: valueOrUnknown(data.compatibility),
      writesEnabled: data.writesEnabled === true,
    };
  }

  function formatNetwork(items) {
    if (!items.length) return "Не определено";
    return items.map(item => {
      if (!item || typeof item !== "object") return "Не определено";
      const name = valueOrUnknown(item.interface || item.name);
      const state = valueOrUnknown(item.state);
      return `${name} · ${state}`;
    }).join("; ");
  }

  function formatDisks(items) {
    if (!items.length) return "Не определено";
    return items.map(item => {
      if (!item || typeof item !== "object") return "Не определено";
      const name = valueOrUnknown(item.name);
      const capacity = typeof item.capacityGb === "number" && Number.isFinite(item.capacityGb)
        ? `${item.capacityGb} ГБ` : "Не определено";
      return `${name} · ${capacity}`;
    }).join("; ");
  }

  function detailsRows(report, compatibilityApi) {
    const data = normalize(report);
    // Imported JSON is data, not proof. This version has no trusted evidence
    // registry, so its status claim cannot be promoted to a confirmed result.
    const compat = compatibilityApi.evaluate(null, null, null);
    const drivers = data.details.drivers.filter(x => typeof x === "string" && x.trim());
    return [
      ["Процессор", data.hardware.cpu],
      ["Оперативная память", data.hardware.ram],
      ["Сетевые интерфейсы", formatNetwork(data.details.network)],
      ["Накопители", formatDisks(data.details.disks)],
      ["Обнаруженные драйверы", drivers.length ? drivers.join("; ") : "Не определено"],
      ["Источник данных", data.source],
      ["Проверка совместимости", compat.label],
    ];
  }

  async function runDemoScan(onStep, waitFunction, adapter) {
    const wait = waitFunction || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    const phases = [
      "DEMO · Сбор тестового сценария",
      "DEMO · Получение локального тестового JSON",
      "DEMO · Проверка структуры отчёта",
      "DEMO · Подготовка карточек оборудования",
    ];
    for (let i = 0; i < phases.length; i++) {
      if (typeof onStep === "function") onStep({ step: i + 1, message: phases[i] });
      await wait(180);
    }
    try {
      const raw = adapter ? await adapter.scan() : JSON.stringify(DEMO_REPORT);
      return parseReport(raw);
    } catch (error) {
      if (error instanceof DiagnosticError) throw error;
      throw new DiagnosticError("unavailable", "Демонстрационная диагностика недоступна.");
    }
  }

  function createSession() {
    let report = null;
    let lastScanAt = null;
    return {
      getReport() { return report; },
      getLastScanAt() { return lastScanAt; },
      recordScan(value, date) {
        report = parseReport(JSON.stringify(value));
        lastScanAt = (date || new Date()).toISOString();
        return report;
      },
      importReport(value) {
        report = parseReport(JSON.stringify(value));
        return report;
      },
      clear() { report = null; },
    };
  }

  return { MAX_REPORT_BYTES, FIELD_KEYS, DEMO_REPORT, DiagnosticError, parseReport, normalize, detailsRows, runDemoScan, createSession };
});
