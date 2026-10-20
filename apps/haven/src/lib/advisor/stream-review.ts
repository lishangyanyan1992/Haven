/**
 * The streaming safety boundary.
 *
 * The Advisor streams the model's answer as it is written, but some corrections
 * only exist after the fact: `normalizeHighRiskAnswer` rewrites sentences such as
 * "you have 45 days left in your grace period" or "a temporary unpaid position"
 * that are wrong for the person asking. Streaming raw tokens meant the uncorrected
 * sentence was on screen for up to thirty seconds before the final message
 * replaced it — long enough to be read, screenshotted, and acted on.
 *
 * Two pieces fix that with as little delay as possible.
 *
 * `ReviewedStream` holds back model text only when a correction could apply
 * (`enabled`), and releases it one reviewed unit at a time. A unit ends at a line
 * break that follows a full stop. Every correction pattern ends at a full stop or
 * a line break, so a correction can never straddle that boundary: the reviewed
 * prefix is exactly what the full-answer review will produce for that region.
 * When review is not needed, text passes straight through.
 *
 * `StreamView` tracks what the client is showing. Once the answer is final it
 * sends only the missing tail as a `delta`, or a `replace` with the whole text
 * when anything already shown changed. That makes the final saved message and
 * the on-screen text identical by construction.
 */

export type StreamViewEvent = { type: "delta"; text: string } | { type: "replace"; text: string };

/**
 * Where the reviewed prefix may end: just before the last line break that
 * follows a full stop (and optional closing marks).
 *
 * The line break itself stays unreleased, because one correction pattern starts
 * with a line break and consumes it.
 */
export function lastSafeBoundary(text: string): number {
  const pattern = /\.[ \t*_)"'\]]*\n/g;
  let end = 0;
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    end = match.index + match[0].length - 1;
  }
  return end;
}

export class ReviewedStream {
  private raw = "";
  private released = "";
  private stalled = false;

  constructor(
    private readonly review: (text: string) => string,
    private readonly enabled: boolean
  ) {}

  /** Add model text; returns the reviewed text that is now safe to show. */
  push(delta: string): string {
    this.raw += delta;
    if (!this.enabled) {
      this.released += delta;
      return delta;
    }
    if (this.stalled) return "";

    const boundary = lastSafeBoundary(this.raw);
    if (boundary === 0) return "";

    const reviewed = this.review(this.raw.slice(0, boundary));
    if (!reviewed.startsWith(this.released)) {
      // A correction reached back into text already shown. Not expected given
      // the boundary rule, but if it happens stop releasing: the final pass will
      // send a `replace` with the reviewed answer.
      this.stalled = true;
      return "";
    }
    const out = reviewed.slice(this.released.length);
    this.released = reviewed;
    return out;
  }

  /** Everything the model wrote, unreviewed. */
  get rawText(): string {
    return this.raw;
  }
}

export class StreamView {
  private shown = "";

  /** Text shown so far. */
  get text(): string {
    return this.shown;
  }

  append(text: string): StreamViewEvent | null {
    if (!text) return null;
    this.shown += text;
    return { type: "delta", text };
  }

  /** Make the client show exactly `full`. */
  syncTo(full: string): StreamViewEvent | null {
    if (full === this.shown) return null;
    if (full.startsWith(this.shown)) {
      const tail = full.slice(this.shown.length);
      this.shown = full;
      return { type: "delta", text: tail };
    }
    this.shown = full;
    return { type: "replace", text: full };
  }
}
