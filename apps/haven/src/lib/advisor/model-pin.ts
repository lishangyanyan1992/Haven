/**
 * The one place the advisor's model version is written down.
 *
 * Pinned to a dated snapshot, not the floating `gpt-5-mini` alias. The alias
 * moves when the provider ships a new build, which changes what the advisor says
 * with nothing in our record moving. Every eval run stamps this value, so a
 * floating alias makes the stamp a lie: two runs both reading "gpt-5-mini" can
 * be two different models. The pin is what makes a past run reproducible and a
 * bad upgrade rollback-able.
 *
 * It lives in its own module because both the answering path and the intent
 * router need it, and importing the router's default from the service would
 * close an import cycle.
 *
 * Upgrading is deliberate: change the date here, re-run the eval suite, and
 * compare against the previous run before shipping.
 */
export const ADVISOR_DEFAULT_MODEL = "gpt-5-mini-2025-08-07";

/**
 * Embeddings have no dated snapshot to pin to — OpenAI publishes
 * `text-embedding-3-small` with no versioned alias. Recorded here so the gap is
 * visible rather than looking like an oversight: if the provider ever changes
 * the model behind that name, our stored vectors and a fresh query vector stop
 * matching, and no stamp we keep would catch it.
 */
export const ADVISOR_DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
