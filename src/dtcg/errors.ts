/** Typed errors thrown by the DTCG reference resolver. */

/** A `{a.b.c}` reference points at a path that does not exist in the source tree. */
export class DtcgUnresolvedReferenceError extends Error {
  readonly reference: string;
  /** The dot-path being resolved when the miss occurred. */
  readonly fromPath?: string;
  constructor(reference: string, fromPath?: string) {
    super(
      `Unresolved DTCG reference "${reference}"` +
        (fromPath ? ` (from "${fromPath}")` : "")
    );
    this.name = "DtcgUnresolvedReferenceError";
    this.reference = reference;
    this.fromPath = fromPath;
  }
}

/** A reference chain loops back on itself (e.g. a → b → a). */
export class DtcgReferenceCycleError extends Error {
  /** The path chain up to and including the repeat. */
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`DTCG reference cycle: ${cycle.join(" → ")}`);
    this.name = "DtcgReferenceCycleError";
    this.cycle = cycle;
  }
}
