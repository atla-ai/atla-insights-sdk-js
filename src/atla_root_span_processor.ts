import type {
	ReadableSpan,
	Span,
	SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { Context } from "@opentelemetry/api";
import { METADATA_MARK, SUCCESS_MARK } from "./internal/constants";

const INSTRUMENTATION_SCOPE_MAPPINGS: Record<string, string> = {
	"@arizeai/openinference-instrumentation-openai":
		"openinference.instrumentation.openai",
	"@arizeai/openinference-instrumentation-langchain":
		"openinference.instrumentation.langchain",
};

export class AtlaRootSpanProcessor implements SpanProcessor {
	constructor(private metadata?: Record<string, string>) {}

	onStart(span: Span, _: Context): void {
		this.renameInstrumentationScopeToOpenInferenceStandard(span);

		if (span.parentSpanId) {
			return;
		}

		// This is a root span
		span.setAttribute(SUCCESS_MARK, -1);

		if (this.metadata && Object.keys(this.metadata).length > 0) {
			span.setAttribute(METADATA_MARK, JSON.stringify(this.metadata));
		}
	}

	onEnd(_: ReadableSpan): void {
		// No processing needed on end
	}

	shutdown(): Promise<void> {
		return Promise.resolve();
	}

	forceFlush(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Rename the instrumentation scope to the OpenInference standard.
	 * @param span - The span to rename.
	 */
	private renameInstrumentationScopeToOpenInferenceStandard(span: Span) {
		const { name: instrumentationScope } = span.instrumentationLibrary;
		const newScope = INSTRUMENTATION_SCOPE_MAPPINGS[instrumentationScope];

		if (newScope) {
			Object.defineProperty(span.instrumentationLibrary, "name", {
				value: newScope,
				writable: false,
				configurable: true,
			});
		}
	}
}
