(function (root, factory) {
  const catalogs = typeof module === "object" && module.exports
    ? require("./catalogs.js") : root.NasShellCatalogs;
  const compatibility = typeof module === "object" && module.exports
    ? require("./compatibility.js") : root.NasShellCompatibility;
  const diagnostic = typeof module === "object" && module.exports
    ? require("./diagnostic.js") : root.NasShellDiagnostic;
  const api = factory(catalogs, compatibility, diagnostic);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NasShellSetupProject = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (catalogs, compatibility, diagnostic) {
  "use strict";

  const LAST_STEP = 5;

  function createState(report) {
    return { step: 1, model: "", dsm: "", report: report || null, error: "" };
  }

  function selectModel(state, model) {
    if (!catalogs.includesModel(model)) return { ...state, error: "Выберите модель из каталога." };
    return { ...state, model, error: "" };
  }

  function selectVersion(state, dsm) {
    if (!catalogs.includesVersion(dsm)) return { ...state, error: "Выберите версию DSM из каталога." };
    return { ...state, dsm, error: "" };
  }

  function next(state) {
    if (state.step === 2 && !catalogs.includesModel(state.model)) {
      return { ...state, error: "Сначала выберите модель Synology." };
    }
    if (state.step === 3 && !catalogs.includesVersion(state.dsm)) {
      return { ...state, error: "Сначала выберите версию DSM." };
    }
    return { ...state, step: Math.min(LAST_STEP, state.step + 1), error: "" };
  }

  function back(state) {
    return { ...state, step: Math.max(1, state.step - 1), error: "" };
  }

  function compatibilityFor(state) {
    return compatibility.evaluate(state.model, state.dsm, null);
  }

  function buildProject(state) {
    const report = diagnostic.normalize(state.report || diagnostic.DEMO_REPORT);
    const check = compatibilityFor(state);
    return {
      schemaVersion: 1,
      kind: "nas-shell-setup-project",
      mode: "DEMO",
      createdAt: new Date().toISOString(),
      selection: {
        model: state.model ? catalogs.labelForModel(state.model) : "Не определено",
        dsmVersion: state.dsm ? catalogs.labelForVersion(state.dsm) : "Не определено",
      },
      hardware: {
        ...report.hardware,
        details: report.details,
        source: report.source,
      },
      compatibility: { status: check.status, label: check.label, reason: check.reason },
      warnings: [
        "Совместимость не подтверждена проверенными данными.",
        "Настоящий загрузочный образ не создаётся; ARC Loader и DSM не изменяются.",
      ],
      arcAdapter: { status: "not-configured" },
      writesEnabled: false,
    };
  }

  function summaryRows(state, report) {
    const data = diagnostic.normalize(report || state.report || diagnostic.DEMO_REPORT);
    return [
      ["Модель Synology", state.model ? catalogs.labelForModel(state.model) : "Не определено"],
      ["Версия DSM", state.dsm ? catalogs.labelForVersion(state.dsm) : "Не определено"],
      ["Процессор", data.hardware.cpu],
      ["Оперативная память", data.hardware.ram],
      ["Сетевой адаптер", data.hardware.nic],
      ["Накопители", data.hardware.storage],
      ["Источник диагностики", data.source],
      ["Совместимость", compatibilityFor(state).label],
    ];
  }

  return { LAST_STEP, createState, selectModel, selectVersion, next, back,
    compatibilityFor, buildProject, summaryRows };
});
