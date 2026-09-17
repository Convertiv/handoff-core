/**
 * The reference-preserving, multi-axis DTCG stage (P1).
 *
 * Public surface consumed by handoff-app (storage/resolve/serve) and the Figma
 * plugin (P3/P4). Everything here is pure and source-agnostic.
 */

export * from "./axis-key";
export * from "./resolve";
export * from "./ingest-figma";
export * from "./diff";
export * from "./serialize";
export * from "./format";
export * from "./errors";
