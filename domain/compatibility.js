(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NasShellCompatibility = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const statuses = Object.freeze({
    confirmed: "Совместимость подтверждена",
    "not-confirmed": "Совместимость не подтверждена",
    limitations: "Обнаружены ограничения",
    unsupported: "Конфигурация не поддерживается",
  });

  function displayResult(status, reason) {
    const key = Object.prototype.hasOwnProperty.call(statuses, status) ? status : "not-confirmed";
    return { status: key, label: statuses[key], reason: reason || "Подтверждённые данные отсутствуют." };
  }

  // No compatibility evidence is shipped in this version. Model/version names
  // alone can never produce a confirmed or unsupported result.
  function evaluate(model, version, evidence) {
    if (!model || !version || !Array.isArray(evidence) || evidence.length === 0) {
      return displayResult("not-confirmed", "Для выбранной модели и версии нет проверенных правил.");
    }
    // Evidence is intentionally not interpreted until its provenance and
    // validation format are defined in a later, separately reviewed stage.
    return displayResult("not-confirmed", "Проверенные правила совместимости пока не подключены.");
  }

  return { statuses, displayResult, evaluate };
});
