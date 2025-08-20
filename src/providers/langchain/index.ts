import type { InstrumentationBase } from "@opentelemetry/instrumentation";
import { ATLA_INSIGHTS } from "../../main";
import { getAtlaContext } from "../../context";
import { LangChainInstrumentation } from "@arizeai/openinference-instrumentation-langchain";
import { diag } from "@opentelemetry/api";

const SERVICE_NAME = "langchain";

let lcInstrumentation: LangChainInstrumentation | null = null;

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
			// eslint-disable-next-line @typescript-eslint/no-var-requires
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

export function uninstrumentLangChain(): void {
	const context = getAtlaContext();
	if (context?.suppressInstrumentation) return;
	ATLA_INSIGHTS.unregisterInstrumentations(SERVICE_NAME);
	lcInstrumentation = null;
}

export function withInstrumentedLangChain(): Disposable {
	instrumentLangChain();
	return {
		[Symbol.dispose]() {
			uninstrumentLangChain();
		},
	};
}
