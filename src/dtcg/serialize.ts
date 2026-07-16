/**
 * Structured DTCG output stage (kickoff §5, first bullet).
 *
 * Serializes a {@link DtcgSource} with references **preserved** — this is the
 * source-of-truth artifact the workspace persists (the reference tree the app
 * stores in its new source-tree column and queries/visualizes over). Unlike the
 * legacy string formatters, nothing here is flattened or resolved.
 */

import { DtcgSource } from "../types/dtcg";

export interface SerializeOptions {
  /** Pretty-print indent (spaces). `0`/omitted → minified. */
  indent?: number;
}

/**
 * Serialize the source tree to canonical JSON. Object keys are emitted in a
 * stable (insertion) order so repeated serializations of an unchanged source are
 * byte-identical — important for content-hashing and diffing at the app layer.
 */
export function serializeDtcgSource(
  source: DtcgSource,
  options: SerializeOptions = {}
): string {
  return JSON.stringify(source, null, options.indent ?? 0);
}
