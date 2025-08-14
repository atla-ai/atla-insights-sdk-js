/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import { BaseAtlaTest } from "./setup";

// Mock dependencies
const mockTracer = {
	startActiveSpan: jest.fn(),
};

const mockSpan = {
	end: jest.fn(),
	recordException: jest.fn(),
};

jest.mock("../src/main", () => ({
	ATLA_INSIGHTS: {
		getTracer: () => mockTracer,
	},
}));

jest.mock("../src/context", () => ({
	getAtlaContext: jest.fn(),
	runWithContext: jest.fn((_context, fn: () => any) => fn()),
}));

import { getAtlaContext } from "../src/context";
// Import after mocking
import { instrument } from "../src/instrumentation";

const mockGetAtlaContext = getAtlaContext as jest.MockedFunction<
	typeof getAtlaContext
>;

describe("instrumentation", () => {
	let baseTest: BaseAtlaTest;

	beforeEach(() => {
		baseTest = new BaseAtlaTest();
		baseTest.beforeEach();

		jest.clearAllMocks();

		// Default: no suppression
		mockGetAtlaContext.mockReturnValue({});

		// Mock tracer to call function with span for sync functions
		mockTracer.startActiveSpan.mockImplementation(((
			_name: string,
			fn: (span: any) => any,
		) => {
			try {
				return fn(mockSpan);
			} catch (error) {
				mockSpan.recordException(error);
				throw error;
			} finally {
				mockSpan.end();
			}
		}) as any);
	});

	afterEach(() => {
		baseTest.afterEach();
	});

	describe("sync functions", () => {
		it("should instrument function with default name", () => {
			// Use a real function to get proper name
			function testFunction() {
				return "result";
			}
			const instrumented = instrument(testFunction);

			const result = instrumented();

			expect(result).toBe("result");
			expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
				"testFunction",
				expect.any(Function),
			);
		});

		it("should instrument function with custom name", () => {
			const testFunction = () => "result";
			const instrumented = instrument("CustomName")(testFunction);

			const result = instrumented();

			expect(result).toBe("result");
			expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
				"CustomName",
				expect.any(Function),
			);
		});

		it("should handle exceptions and end span", () => {
			const testFunction = () => {
				throw new Error("Test error");
			};
			const instrumented = instrument(testFunction);

			expect(() => instrumented()).toThrow("Test error");
			expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
		});
	});

	describe("async functions", () => {
		beforeEach(() => {
			// Mock tracer for async functions - needs to handle async spans
			mockTracer.startActiveSpan.mockImplementation((async (
				_name: string,
				fn: (span: any) => Promise<any>,
			) => {
				try {
					return await fn(mockSpan);
				} catch (error) {
					mockSpan.recordException(error);
					throw error;
				} finally {
					mockSpan.end();
				}
			}) as any);
		});

		it("should instrument async function", async () => {
			async function testFunction() {
				await new Promise((resolve) => setTimeout(resolve, 1));
				return "async-result";
			}
			const instrumented = instrument(testFunction);

			const result = await instrumented();

			expect(result).toBe("async-result");
			expect(mockTracer.startActiveSpan).toHaveBeenCalled();
		});

		it("should handle async exceptions", async () => {
			async function testFunction() {
				throw new Error("Async error");
			}
			const instrumented = instrument(testFunction);

			await expect(instrumented()).rejects.toThrow("Async error");
			expect(mockSpan.recordException).toHaveBeenCalledWith(expect.any(Error));
		});
	});

	describe("suppression", () => {
		it("should not instrument when suppressed", () => {
			mockGetAtlaContext.mockReturnValue({ suppressInstrumentation: true });

			const testFunction = () => "result";
			const instrumented = instrument(testFunction);

			const result = instrumented();

			expect(result).toBe("result");
			expect(mockTracer.startActiveSpan).not.toHaveBeenCalled();
		});
	});
});
