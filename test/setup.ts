/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import { jest } from "@jest/globals";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { InMemorySpanExporter } from "@opentelemetry/sdk-trace-base";

// Global in-memory span exporter for testing
export const inMemorySpanExporter = new InMemorySpanExporter();

// Mock ATLA_INSIGHTS before any imports
const mockTracer = {
	startActiveSpan: jest.fn(),
};

const mockTracerProvider = {
	register: jest.fn(),
	addSpanProcessor: jest.fn(),
};

export const mockAtlaInsights = {
	configure: jest.fn(),
	getTracer: jest.fn(() => mockTracer),
	getTracerProvider: jest.fn(() => mockTracerProvider),
	configured: true,
};

// Mock the main module
jest.mock("../src/main", () => ({
	ATLA_INSIGHTS: mockAtlaInsights,
}));

// Mock context functions
jest.mock("../src/context", () => ({
	getAtlaContext: jest.fn(() => ({})),
	runWithContext: jest.fn((_context, fn: () => any) => fn()),
}));

// Test utilities
export class BaseAtlaTest {
	protected mockSpan: any;

	beforeEach() {
		inMemorySpanExporter.reset();

		// Create a mock span that captures attributes
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

		// Setup the mock tracer to use our mock span
		mockTracer.startActiveSpan.mockImplementation(((
			_name: string,
			options: any,
			fn: (span: any) => any,
		) => {
			if (typeof options === "function") {
				return options(this.mockSpan);
			}
			return fn(this.mockSpan);
		}) as any);
	}

	afterEach() {
		jest.clearAllMocks();
		inMemorySpanExporter.reset();
	}

	protected getFinishedSpans(): ReadableSpan[] {
		return inMemorySpanExporter.getFinishedSpans();
	}

	public getMockSpan() {
		return this.mockSpan;
	}
}
