/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import { jest } from "@jest/globals";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// Real in-memory exporter + provider for tests
export const realInMemorySpanExporter = new InMemorySpanExporter();
const realTracerProvider = new NodeTracerProvider({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: "test-service",
	}),
	spanProcessors: [new SimpleSpanProcessor(realInMemorySpanExporter)],
});
realTracerProvider.register();

// Mock ATLA_INSIGHTS to use the real tracer/provider
export const mockAtlaInsightsWithRealOtel = {
	configure: jest.fn(),
	getTracer: jest.fn(() => realTracerProvider.getTracer("test-tracer")),
	getTracerProvider: jest.fn(() => realTracerProvider),
	registerInstrumentations: jest.fn(),
	unregisterInstrumentations: jest.fn(),
	configured: true,
};

jest.mock("../src/main", () => ({
	ATLA_INSIGHTS: mockAtlaInsightsWithRealOtel,
}));

// Test utilities
export class BaseAtlaTest {
	protected mockSpan: any;

	beforeEach() {
		realInMemorySpanExporter.reset();

		this.mockSpan = {
			attributes: {} as Record<string, any>,
			events: [] as any[],
			status: {} as any,
			setAttribute: jest.fn((key: string, value: any) => {
				this.mockSpan.attributes[key] = value;
			}),
			setStatus: jest.fn((status: any) => {
				this.mockSpan.status = status;
			}),
			recordException: jest.fn((exception: Error) => {
				this.mockSpan.events.push({
					name: "exception",
					attributes: {
						"exception.type": exception.constructor.name,
						"exception.message": exception.message,
					},
				});
			}),
			end: jest.fn(),
		};
	}

	afterEach() {
		jest.clearAllMocks();
		realInMemorySpanExporter.reset();
	}

	public getFinishedSpans(): ReadableSpan[] {
		return realInMemorySpanExporter.getFinishedSpans();
	}

	public getMockSpan() {
		return this.mockSpan;
	}
}
