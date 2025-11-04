/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import { runExperiment, type Experiment } from "../src/experiments";
import { getAtlaContext } from "../src/context";
import { context as otelContext } from "@opentelemetry/api";

describe("experiments", () => {
	let consoleLogSpy: jest.SpiedFunction<typeof console.log>;
	let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

	beforeEach(() => {
		consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
		jest.clearAllMocks();
	});

	describe("runExperiment", () => {
		it("should execute sync function within experiment context", () => {
			const testFn = jest.fn(() => "result");

			const result = runExperiment(
				{ experimentName: "test-experiment" },
				testFn,
			);

			expect(result).toBe("result");
			expect(testFn).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"🧪 Starting experiment: test-experiment",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"✓ Experiment completed: test-experiment",
			);
		});

		it("should execute async function within experiment context", async () => {
			const asyncFn = jest.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				return "async-result";
			});

			const result = await runExperiment(
				{ experimentName: "async-test" },
				asyncFn,
			);

			expect(result).toBe("async-result");
			expect(asyncFn).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"🧪 Starting experiment: async-test",
			);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"✓ Experiment completed: async-test",
			);
		});

		it("should auto-generate experiment name if not provided", () => {
			const testFn = jest.fn(() => "result");

			runExperiment({}, testFn);

			expect(testFn).toHaveBeenCalled();

			// Check that console.log was called with auto-generated name
			const logCalls = consoleLogSpy.mock.calls;
			const startCall = logCalls.find((call) =>
				call[0]?.toString().includes("Starting experiment:"),
			);
			expect(startCall).toBeDefined();

			// Extract the experiment name from the log
			const experimentName = startCall?.[0]
				.toString()
				.replace("🧪 Starting experiment: ", "");

			// Should match pattern: adjective-adjective-noun-verb-uuid (human-id format)
			expect(experimentName).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-[a-f0-9]{8}$/);
		});

		it("should include description in experiment context", () => {
			let capturedExperiment: Experiment | undefined;

			runExperiment(
				{
					experimentName: "desc-test",
					description: "Testing description feature",
				},
				() => {
					const atlaContext = getAtlaContext(otelContext.active());
					capturedExperiment = atlaContext?.experiment;
				},
			);

			expect(capturedExperiment).toBeDefined();
			expect(capturedExperiment?.name).toBe("desc-test");
			expect(capturedExperiment?.description).toBe(
				"Testing description feature",
			);
		});

		it("should not include description if not provided", () => {
			let capturedExperiment: Experiment | undefined;

			runExperiment({ experimentName: "no-desc-test" }, () => {
				const atlaContext = getAtlaContext(otelContext.active());
				capturedExperiment = atlaContext?.experiment;
			});

			expect(capturedExperiment).toBeDefined();
			expect(capturedExperiment?.name).toBe("no-desc-test");
			expect(capturedExperiment?.description).toBeUndefined();
		});

		it("should store experiment in atla context", () => {
			let capturedContext: any;

			runExperiment({ experimentName: "context-test" }, () => {
				capturedContext = getAtlaContext(otelContext.active());
			});

			expect(capturedContext).toBeDefined();
			expect(capturedContext?.experiment).toBeDefined();
			expect(capturedContext?.experiment?.name).toBe("context-test");
		});

		it("should handle errors and log failure", () => {
			const error = new Error("Test error");
			const failingFn = jest.fn(() => {
				throw error;
			});

			expect(() => {
				runExperiment({ experimentName: "failing-test" }, failingFn);
			}).toThrow("Test error");

			expect(failingFn).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"🧪 Starting experiment: failing-test",
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"✗ Experiment failed: failing-test",
				error,
			);
		});

		it("should handle async errors and log failure", async () => {
			const error = new Error("Async test error");
			const failingAsyncFn = jest.fn(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				throw error;
			});

			await expect(
				runExperiment({ experimentName: "failing-async-test" }, failingAsyncFn),
			).rejects.toThrow("Async test error");

			expect(failingAsyncFn).toHaveBeenCalled();
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"🧪 Starting experiment: failing-async-test",
			);
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"✗ Experiment failed: failing-async-test",
				error,
			);
		});

		it("should isolate experiment contexts between calls", () => {
			const experiments: Experiment[] = [];

			runExperiment({ experimentName: "experiment-1" }, () => {
				const context = getAtlaContext(otelContext.active());
				if (context?.experiment) {
					experiments.push(context.experiment);
				}
			});

			runExperiment({ experimentName: "experiment-2" }, () => {
				const context = getAtlaContext(otelContext.active());
				if (context?.experiment) {
					experiments.push(context.experiment);
				}
			});

			expect(experiments).toHaveLength(2);
			expect(experiments[0].name).toBe("experiment-1");
			expect(experiments[1].name).toBe("experiment-2");
		});

		it("should handle nested experiments", () => {
			const experimentNames: string[] = [];

			runExperiment({ experimentName: "outer-experiment" }, () => {
				const outerContext = getAtlaContext(otelContext.active());
				if (outerContext?.experiment) {
					experimentNames.push(outerContext.experiment.name);
				}

				runExperiment({ experimentName: "inner-experiment" }, () => {
					const innerContext = getAtlaContext(otelContext.active());
					if (innerContext?.experiment) {
						experimentNames.push(innerContext.experiment.name);
					}
				});
			});

			expect(experimentNames).toHaveLength(2);
			expect(experimentNames[0]).toBe("outer-experiment");
			expect(experimentNames[1]).toBe("inner-experiment");
		});

		it("should return function result for sync functions", () => {
			const result = runExperiment({ experimentName: "return-test" }, () => {
				return { value: 42 };
			});

			expect(result).toEqual({ value: 42 });
		});

		it("should return promise result for async functions", async () => {
			const result = await runExperiment(
				{ experimentName: "async-return-test" },
				async () => {
					return { value: 42 };
				},
			);

			expect(result).toEqual({ value: 42 });
		});
	});

	describe("experiment name generation", () => {
		it("should generate unique experiment names", () => {
			const names = new Set<string>();

			// Generate multiple names and check uniqueness
			for (let i = 0; i < 10; i++) {
				runExperiment({}, () => {
					const context = getAtlaContext(otelContext.active());
					if (context?.experiment) {
						names.add(context.experiment.name);
					}
				});
			}

			// All names should be unique
			expect(names.size).toBe(10);
		});

		it("should generate names with correct format", () => {
			let experimentName: string | undefined;

			runExperiment({}, () => {
				const context = getAtlaContext(otelContext.active());
				experimentName = context?.experiment?.name;
			});

			expect(experimentName).toBeDefined();
			// Format: adjective-adjective-noun-verb-8hexchars (human-id format)
			expect(experimentName).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-[a-f0-9]{8}$/);
		});
	});
});
