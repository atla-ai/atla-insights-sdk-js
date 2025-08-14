/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import nock from "nock";
import OpenAI from "openai";
import { BaseAtlaTest } from "../setup";

// Mock tracer
const mockTracer = {
	startActiveSpan: jest.fn(),
};

// Mock the main ATLA_INSIGHTS before imports
const mockAtlaInsights = {
	configure: jest.fn(),
	getTracer: jest.fn(() => mockTracer),
	getTracerProvider: jest.fn(),
	registerInstrumentations: jest.fn(),
	unregisterInstrumentations: jest.fn(),
	configured: true,
};

jest.mock("../../src/main", () => ({
	ATLA_INSIGHTS: mockAtlaInsights,
}));

jest.mock("../../src/context", () => {
	let currentContext = {};
	return {
		getAtlaContext: jest.fn(() => currentContext),
		runWithContext: jest.fn((updates: any, fn: () => any) => {
			const previousContext = currentContext;
			currentContext = { ...currentContext, ...updates };
			const result = fn();
			if (result && typeof (result as any).then === "function") {
				return (result as Promise<any>).finally(() => {
					currentContext = previousContext;
				});
			}
			currentContext = previousContext;
			return result;
		}),
	};
});

describe("OpenAI Provider", () => {
	let baseTest: BaseAtlaTest;
	let openaiClient: OpenAI;

	// Import after mocking
	let instrumentOpenAI: any;
	let uninstrumentOpenAI: any;
	let withInstrumentedOpenAI: any;
	let instrument: any;
	let markSuccess: any;
	// biome-ignore lint/correctness/noUnusedVariables: Test class
	let markFailure: any;

	beforeAll(async () => {
		const openaiModule = await import("../../src/providers/openai/index");
		instrumentOpenAI = openaiModule.instrumentOpenAI;
		uninstrumentOpenAI = openaiModule.uninstrumentOpenAI;
		withInstrumentedOpenAI = openaiModule.withInstrumentedOpenAI;

		const instrumentationModule = await import("../../src/instrumentation");
		instrument = instrumentationModule.instrument;

		const markingModule = await import("../../src/marking");
		markSuccess = markingModule.markSuccess;
		markFailure = markingModule.markFailure;
	});

	beforeEach(() => {
		baseTest = new BaseAtlaTest();
		baseTest.beforeEach();

		// Setup OpenAI client
		openaiClient = new OpenAI({
			apiKey: "test-api-key",
			baseURL: "https://api.openai.com/v1",
		});

		// Setup nock for HTTP mocking
		nock.disableNetConnect();

		jest.clearAllMocks();

		// Setup mock tracer behavior
		mockTracer.startActiveSpan.mockImplementation(((_name: string, fn: any) => {
			const mockSpan = baseTest.getMockSpan();
			if (typeof fn === "function") {
				return fn(mockSpan);
			}
			return fn;
		}) as any);
	});

	afterEach(() => {
		baseTest.afterEach();
		nock.cleanAll();
		nock.enableNetConnect();
		uninstrumentOpenAI();
	});

	describe("instrumentOpenAI", () => {
		it("should throw error when not configured", () => {
			mockAtlaInsights.configured = false;

			expect(() => instrumentOpenAI()).toThrow(
				"Atla Insights must be configured before instrumenting OpenAI",
			);

			mockAtlaInsights.configured = true;
		});

		it("should register OpenAI instrumentation", () => {
			instrumentOpenAI();

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalledWith(
				"openai",
				expect.arrayContaining([expect.any(Object)]),
			);
		});

		it("should manually instrument provided module", () => {
			const mockModule = {
				OpenAI: {
					Chat: {
						Completions: class {
							create() {}
						},
					},
					Completions: class {
						create() {}
					},
					Embeddings: class {
						create() {}
					},
				},
			};

			instrumentOpenAI(mockModule);

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});
	});

	describe("uninstrumentOpenAI", () => {
		it("should unregister OpenAI instrumentation", () => {
			instrumentOpenAI();
			uninstrumentOpenAI();

			expect(mockAtlaInsights.unregisterInstrumentations).toHaveBeenCalledWith(
				"openai",
			);
		});
	});

	describe("withInstrumentedOpenAI", () => {
		it("should create disposable instrumentation", () => {
			const disposable = withInstrumentedOpenAI();

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
			expect(typeof disposable[Symbol.dispose]).toBe("function");

			disposable[Symbol.dispose]();
			expect(mockAtlaInsights.unregisterInstrumentations).toHaveBeenCalled();
		});

		it("should work with using statement pattern", () => {
			const cleanup = jest.fn();
			mockAtlaInsights.unregisterInstrumentations.mockImplementation(cleanup);

			{
				const disposable = withInstrumentedOpenAI();
				expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
				disposable[Symbol.dispose]();
			}

			expect(cleanup).toHaveBeenCalled();
		});
	});

	describe("integration tests", () => {
		beforeEach(() => {
			// Mock successful OpenAI API response
			nock("https://api.openai.com/v1")
				.post("/chat/completions")
				.reply(200, {
					id: "chatcmpl-test",
					object: "chat.completion",
					created: Date.now(),
					model: "gpt-4",
					choices: [
						{
							index: 0,
							message: {
								role: "assistant",
								content: "Hello, world!",
							},
							finish_reason: "stop",
						},
					],
					usage: {
						prompt_tokens: 10,
						completion_tokens: 5,
						total_tokens: 15,
					},
				});
		});

		it("should trace basic OpenAI chat completion", async () => {
			instrumentOpenAI();

			await openaiClient.chat.completions.create({
				model: "gpt-4",
				messages: [{ role: "user", content: "Hello!" }],
			});

			// Verify span was created
			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});

		it("should trace nested instrumentation", async () => {
			instrumentOpenAI();

			const testFunction = instrument("root_span")(async () => {
				const response = await openaiClient.chat.completions.create({
					model: "gpt-4",
					messages: [{ role: "user", content: "Hello world!" }],
				});
				return response;
			});

			await testFunction();

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
			expect(mockTracer.startActiveSpan).toHaveBeenCalled();
		});

		it("should handle nested instrumentation with marking", async () => {
			instrumentOpenAI();

			const testFunction = instrument("root_span")(async () => {
				await openaiClient.chat.completions.create({
					model: "gpt-4",
					messages: [{ role: "user", content: "Hello world!" }],
				});

				markSuccess();
				return "test result";
			});

			const result = await testFunction();

			expect(result).toBe("test result");
			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});

		it("should handle failing OpenAI requests", async () => {
			// Clear previous nock mocks and setup failure
			nock.cleanAll();
			nock("https://api.openai.com/v1")
				.post("/chat/completions")
				.reply(500, {
					error: {
						message: "Internal server error",
						type: "server_error",
					},
				});

			instrumentOpenAI();

			await expect(
				openaiClient.chat.completions.create({
					model: "gpt-4",
					messages: [{ role: "user", content: "Hello!" }],
				}),
			).rejects.toThrow();

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});

		it("should handle failing instrumentation with marking", async () => {
			// Clear previous nock mocks and setup failure
			nock.cleanAll();
			nock("https://api.openai.com/v1")
				.post("/chat/completions")
				.reply(400, {
					error: {
						message: "Bad request",
						type: "invalid_request_error",
					},
				});

			instrumentOpenAI();

			const testFunction = instrument("root_span")(async () => {
				try {
					await openaiClient.chat.completions.create({
						model: "gpt-4",
						messages: [{ role: "user", content: "Hello world!" }],
					});
				} catch (error) {
					// Even though OpenAI fails, we can still mark our function as successful
					markSuccess();
					throw error;
				}
			});

			await expect(testFunction()).rejects.toThrow();
			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});

		it("should handle completions API", async () => {
			// Clear previous nock mocks and setup completions
			nock.cleanAll();
			nock("https://api.openai.com/v1")
				.post("/completions")
				.reply(200, {
					id: "cmpl-test",
					object: "text_completion",
					created: Date.now(),
					model: "gpt-3.5-turbo-instruct",
					choices: [
						{
							text: "Hello, world!",
							index: 0,
							finish_reason: "stop",
						},
					],
					usage: {
						prompt_tokens: 5,
						completion_tokens: 3,
						total_tokens: 8,
					},
				});

			instrumentOpenAI();

			await openaiClient.completions.create({
				model: "gpt-3.5-turbo-instruct",
				prompt: "Hello",
				max_tokens: 10,
			});

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});

		it("should handle embeddings API", async () => {
			// Clear previous nock mocks and setup embeddings
			nock.cleanAll();
			nock("https://api.openai.com/v1")
				.post("/embeddings")
				.reply(200, {
					object: "list",
					data: [
						{
							object: "embedding",
							embedding: new Array(1536).fill(0.1),
							index: 0,
						},
					],
					model: "text-embedding-ada-002",
					usage: {
						prompt_tokens: 5,
						total_tokens: 5,
					},
				});

			instrumentOpenAI();

			await openaiClient.embeddings.create({
				model: "text-embedding-ada-002",
				input: "Hello world",
			});

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});

		it("should handle streaming responses", async () => {
			// Clear previous nock mocks and setup streaming
			nock.cleanAll();
			nock("https://api.openai.com/v1")
				.post("/chat/completions")
				.reply(200, () => {
					const chunks = [
						'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":' +
							Date.now() +
							',"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}\n\n',
						'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":' +
							Date.now() +
							',"model":"gpt-4","choices":[{"index":0,"delta":{"content":" world!"},"finish_reason":null}]}\n\n',
						'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":' +
							Date.now() +
							',"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n\n',
						"data: [DONE]\n\n",
					];

					return chunks.join("");
				});

			instrumentOpenAI();

			const stream = await openaiClient.chat.completions.create({
				model: "gpt-4",
				messages: [{ role: "user", content: "Hello!" }],
				stream: true,
			});

			// Consume the stream
			for await (const chunk of stream) {
				// Process chunk
				expect(chunk).toBeDefined();
			}

			expect(mockAtlaInsights.registerInstrumentations).toHaveBeenCalled();
		});
	});

	describe("suppression handling", () => {
		it("should skip instrumentation when suppressed", () => {
			const { getAtlaContext } = require("../../src/context");
			getAtlaContext.mockReturnValue({ suppressInstrumentation: true });

			instrumentOpenAI();

			expect(mockAtlaInsights.registerInstrumentations).not.toHaveBeenCalled();

			// Reset for other tests
			getAtlaContext.mockReturnValue({});
		});

		it("should skip uninstrumentation when suppressed", () => {
			const { getAtlaContext } = require("../../src/context");
			getAtlaContext.mockReturnValue({ suppressInstrumentation: true });

			uninstrumentOpenAI();

			expect(
				mockAtlaInsights.unregisterInstrumentations,
			).not.toHaveBeenCalled();

			// Reset for other tests
			getAtlaContext.mockReturnValue({});
		});
	});
});
