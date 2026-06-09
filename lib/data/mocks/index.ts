/**
 * Typed mock fixtures for the demo store "Northbound" (PRD §5 shapes).
 * Consumed ONLY by the stub data-access seams in `lib/data/*.ts` — screens never
 * import mocks directly, so Part B can replace the seams with real queries without
 * touching any component.
 */
export * from "./store";
export * from "./products";
export * from "./orders";
export * from "./stats";
export * from "./theme";
