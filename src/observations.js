(function initJangsaObservations(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JangsaObservations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createObservationApi() {
  "use strict";

  const SOURCES = new Set(["collector", "owner", "calculated"]);
  const CONFIDENCES = new Set(["high", "medium", "low"]);
  const STATUSES = new Set(["confirmed", "inferred", "unknown", "unavailable"]);
  const sourcePriority = { collector: 1, calculated: 2, owner: 3 };
  const statusPriority = { unavailable: 0, unknown: 0, inferred: 1, confirmed: 2 };

  function createObservation(input) {
    if (!input || !String(input.key || "").trim()) {
      throw new TypeError("Observation key is required.");
    }
    if (!SOURCES.has(input.source)) {
      throw new TypeError("Unsupported observation source.");
    }
    if (!CONFIDENCES.has(input.confidence)) {
      throw new TypeError("Unsupported observation confidence.");
    }
    if (!STATUSES.has(input.status)) {
      throw new TypeError("Unsupported observation status.");
    }
    return Object.freeze({
      key: String(input.key),
      value: input.value,
      source: input.source,
      confidence: input.confidence,
      observedAt: String(input.observedAt),
      status: input.status,
      evidence: String(input.evidence || ""),
    });
  }

  function resolveObservations(observations) {
    return observations.reduce((resolved, observation) => {
      const current = resolved[observation.key];
      const currentPriority = current ? sourcePriority[current.source] : 0;
      const nextPriority = sourcePriority[observation.source];
      const currentStatus = current ? statusPriority[current.status] : -1;
      const nextStatus = statusPriority[observation.status];
      if (
        !current ||
        nextStatus > currentStatus ||
        (nextStatus === currentStatus &&
          (nextPriority > currentPriority ||
            (nextPriority === currentPriority && observation.observedAt >= current.observedAt)))
      ) {
        resolved[observation.key] = observation;
      }
      return resolved;
    }, {});
  }

  function summarizeObservationCoverage(observationMap, keys) {
    const known = keys.filter((key) => {
      const item = observationMap[key];
      return item && (item.status === "confirmed" || item.status === "inferred");
    }).length;
    return { known, total: keys.length, ratio: keys.length ? known / keys.length : 0 };
  }

  return { createObservation, resolveObservations, summarizeObservationCoverage };
});
