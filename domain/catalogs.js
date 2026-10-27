(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NasShellCatalogs = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Catalog data is independent from page markup and can be updated separately.
  const models = Object.freeze([
    Object.freeze({ id: "DS925+", label: "DS925+", compatibility: "not-confirmed" }),
    Object.freeze({ id: "DS923+", label: "DS923+", compatibility: "not-confirmed" }),
    Object.freeze({ id: "DS3622xs+", label: "DS3622xs+", compatibility: "not-confirmed" }),
  ]);
  const dsmVersions = Object.freeze([
    Object.freeze({ id: "7.2", label: "DSM 7.2", compatibility: "not-confirmed" }),
    Object.freeze({ id: "7.3", label: "DSM 7.3", compatibility: "not-confirmed" }),
    Object.freeze({ id: "7.4", label: "DSM 7.4", compatibility: "not-confirmed" }),
  ]);

  function includesModel(id) { return models.some(item => item.id === id); }
  function includesVersion(id) { return dsmVersions.some(item => item.id === id); }
  function labelForModel(id) { return (models.find(item => item.id === id) || {}).label || "Не определено"; }
  function labelForVersion(id) { return (dsmVersions.find(item => item.id === id) || {}).label || "Не определено"; }

  return { models, dsmVersions, includesModel, includesVersion, labelForModel, labelForVersion };
});
