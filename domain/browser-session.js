(function (root, factory) {
  const catalogs = typeof module === "object" && module.exports
    ? require("./catalogs.js") : root.NasShellCatalogs;
  const diagnostic = typeof module === "object" && module.exports
    ? require("./diagnostic.js") : root.NasShellDiagnostic;
  const setup = typeof module === "object" && module.exports
    ? require("./setup-project.js") : root.NasShellSetupProject;
  const api = factory(catalogs, diagnostic, setup);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NasShellBrowserSession = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (catalogs, diagnostic, setup) {
  "use strict";

  const STORAGE_KEY = "nas-shell-0.6-session";
  const DEFAULT_MESSAGE = "Подготовка конфигурации завершена. Проект не применён к загрузчику";

  function restore(raw) {
    const state = setup.createState(null);
    if (typeof raw !== "string" || !raw) return state;
    try {
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return state;
      let report = null;
      if (saved.report !== null && saved.report !== undefined) {
        report = diagnostic.parseReport(JSON.stringify(saved.report));
      }
      let restored = setup.createState(report);
      if (catalogs.includesModel(saved.model)) restored = setup.selectModel(restored, saved.model);
      if (catalogs.includesVersion(saved.dsm)) restored = setup.selectVersion(restored, saved.dsm);
      if (Number.isInteger(saved.step) && saved.step >= 1 && saved.step <= setup.LAST_STEP) {
        restored = { ...restored, step: saved.step };
      }
      return { ...restored, completed: saved.completed === true };
    } catch (_) {
      return state;
    }
  }

  function serialize(state, report) {
    let safeReport = null;
    if (report !== null && report !== undefined) {
      safeReport = diagnostic.parseReport(JSON.stringify(report));
    }
    return JSON.stringify({
      model: catalogs.includesModel(state.model) ? state.model : "",
      dsm: catalogs.includesVersion(state.dsm) ? state.dsm : "",
      report: safeReport,
      step: Number.isInteger(state.step) && state.step >= 1 && state.step <= setup.LAST_STEP ? state.step : 1,
      completed: state.completed === true,
    });
  }

  function save(storage, state, report) {
    try {
      storage.setItem(STORAGE_KEY, serialize(state, report));
      return true;
    } catch (_) {
      return false;
    }
  }

  function load(storage) {
    try {
      return restore(storage.getItem(STORAGE_KEY));
    } catch (_) {
      return setup.createState(null);
    }
  }

  return { STORAGE_KEY, DEFAULT_MESSAGE, restore, serialize, save, load };
});
