import type { InstrumentationBase } from "@opentelemetry/instrumentation";
import { ATLA_INSIGHTS } from "../../main";
import { getAtlaContext } from "../../context";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import { diag } from "@opentelemetry/api";

const SERVICE_NAME = "langchain";

let lcInstrumentation: LangChainInstrumentation | null = null;

/**
 * Instrument the LangChain provider.
 *
 * This function enables tracing for all LangChain API calls made through
 * the official LangChain JavaScript/TypeScript client.
 *
 * @example
 * ```typescript
 * import { configure, instrumentLangChain } from "@atla-ai/insights-sdk-js";
 * import { LangChain } from "langchain";
 *
 * // Configure Atla Insights first
 * configure({ token: process.env.ATLA_API_KEY! });
 *
 * // Enable LangChain instrumentation
 * instrumentLangChain();
 *
 * // Use LangChain as normal - it will be automatically traced
 * const langchain = new LangChain();
 * const completion = await langchain.run("Hello!");
 * ```
 * @param callbackManagerModule - The callback manager module to instrument. If not provided, the default LangChain callback manager will be instrumented.
 *
 * @example
 * ```typescript
 * import { configure, instrumentLangChain } from "@atla-ai/insights-sdk-js";
 * import { LangChain } from "langchain";
 *
 * // Configure Atla Insights first
 * configure({ token: process.env.ATLA_API_KEY! });
 *
 * // Enable LangChain instrumentation
 * instrumentLangChain(LangChain);
 *
 * // Use LangChain as normal - it will be automatically traced
 * const langchain = new LangChain();
 * const completion = await langchain.run("Hello!");
 * ```
 *
 * @returns void
 */
// biome-ignore lint/suspicious/noExplicitAny: allow external module types
export function instrumentLangChain(callbackManagerModule?: any): void {
	const context = getAtlaContext();
	if (context?.suppressInstrumentation) return;
	if (!ATLA_INSIGHTS.configured) {
		throw new Error(
			"Atla Insights must be configured before instrumenting LangChain. Please call configure first.",
		);
	}

	lcInstrumentation = new LangChainInstrumentation({
		tracerProvider: ATLA_INSIGHTS.getTracerProvider(),
	});

	// Prefer explicit module from caller
	if (callbackManagerModule) {
		try {
			lcInstrumentation.manuallyInstrument(callbackManagerModule);
		} catch (e) {
			diag.warn(
				"Failed to manually instrument LangChain callback manager",
				e as Error,
			);
		}
	} else {
		// Best-effort auto-detection
		try {
			const autoModule = require("@langchain/core/callbacks/manager");
			lcInstrumentation.manuallyInstrument(autoModule);
		} catch {
			diag.debug(
				"@langchain/core not found; LangChain will still run, but callbacks won't be auto-instrumented.",
			);
		}
	}

	ATLA_INSIGHTS.registerInstrumentations(SERVICE_NAME, [
		lcInstrumentation as unknown as InstrumentationBase,
	]);
}

/**
 * Uninstrument the LangChain provider.
 *
 * This function disables tracing for all LangChain API calls made through
 * the official LangChain JavaScript/TypeScript client.
 *
 * @example
 * ```typescript
 * import { uninstrumentLangChain } from "@atla-ai/insights-sdk-js";
 *
 * // Disable LangChain instrumentation
 * uninstrumentLangChain();
 * ```
 *
 * @returns void
 */
export function uninstrumentLangChain(): void {
	const context = getAtlaContext();
	if (context?.suppressInstrumentation) return;
	ATLA_INSIGHTS.unregisterInstrumentations(SERVICE_NAME);
	lcInstrumentation = null;
}

/**
 * Create a disposable LangChain instrumentation resource.
 *
 * This function enables LangChain instrumentation and returns a disposable resource
 * that automatically disables instrumentation when disposed. This is particularly
 * useful with TypeScript's `using` statement for automatic resource management.
 *
 * @example
 * ```typescript
 * import { withInstrumentedLangChain } from "@atla-ai/insights-sdk-js";
 * import { LangChain } from "langchain";
 *
 * // Use with using statement (requires TypeScript 5.2+)
 * {
 *   using instrumented = withInstrumentedLangChain();
 *   const langchain = new LangChain();
 *   // LangChain calls here will be traced
 * }
 * // LangChain instrumentation automatically disabled here
 *
 * // Or manually manage lifecycle
 * const instrumented = withInstrumentedLangChain();
 * try {
 *   const langchain = new LangChain();
 *   // LangChain calls here will be traced
 * } finally {
 *   instrumented[Symbol.dispose]();
 * }
 * ```
 *
 * @returns A disposable resource that cleans up LangChain instrumentation when disposed
 */
export function withInstrumentedLangChain(): { dispose(): void } {
	instrumentLangChain();
	const d = {
		dispose() {
			uninstrumentLangChain();
		},
	};
	// If TS 5.2+ Symbol.dispose exists at runtime, add it for ergonomics
	try {
		const sym = (Symbol as unknown as { dispose?: symbol }).dispose;
		if (sym) {
			// biome-ignore lint/suspicious/noExplicitAny: allow external module types
			(d as any)[sym] = d.dispose.bind(d);
		}
	} catch {
		// no-op
	}
	return d;
}
