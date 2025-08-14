import type {
	ReadableSpan,
	Span,
	SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { Context } from "@opentelemetry/api";
import { METADATA_MARK, SUCCESS_MARK } from "./internal/constants";

export class AtlaRootSpanProcessor implements SpanProcessor {
	constructor(private metadata?: Record<string, string>) {}

	onStart(span: Span, _: Context): void {
		const instrumentationScope = span.instrumentationLibrary.name;
		if (
			instrumentationScope === "@arizeai/openinference-instrumentation-openai"
		) {
			Object.defineProperty(span.instrumentationLibrary, "name", {
				value: "openinference.instrumentation.openai",
				writable: false,
				configurable: true,
			});
		}

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
}
