/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	jest,
} from "@jest/globals";
import OpenAI from "openai";
import { BaseAtlaTest, realInMemorySpanExporter, mockAtlaInsightsWithRealOtel as mockAtlaInsights } from "../setup";
import { 
	OpenInferenceSpanKind, 
	SemanticConventions 
} from "@arizeai/openinference-semantic-conventions";

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

	// Import the mock helpers
	const { OpenAI: MockOpenAI, setOpenAIMockResponse, resetOpenAIMock } = require("../__mocks__/openai");

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
		});

		jest.clearAllMocks();
		realInMemorySpanExporter.reset();
	});

	afterEach(() => {
		baseTest.afterEach();
		resetOpenAIMock();
		uninstrumentOpenAI();
		realInMemorySpanExporter.reset();
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
			// Import fresh OpenAI to test manual instrumentation
			const OpenAI = require("openai");

			instrumentOpenAI(OpenAI);

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
		it("should trace basic OpenAI chat completion", async () => {
			instrumentOpenAI();

			await openaiClient.chat.completions.create({
				model: "gpt-4",
				messages: [{ role: "user", content: "Hello!" }],
			});

			// Verify span was created
			const spans = realInMemorySpanExporter.getFinishedSpans();
			expect(spans.length).toBeGreaterThan(0);
			
			const llmSpan = spans.find(s => 
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] === OpenInferenceSpanKind.LLM
			);
			expect(llmSpan).toBeDefined();
			expect(llmSpan?.name).toBe("OpenAI Chat Completions");
			expect(llmSpan?.attributes).toEqual(
				expect.objectContaining({
					[SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.LLM,
					"llm.input_messages.0.message.role": "user",
					"llm.input_messages.0.message.content": "Hello!",
					"llm.output_messages.0.message.role": "assistant",
					"llm.output_messages.0.message.content": "This is a test.",
					[SemanticConventions.LLM_MODEL_NAME]: "gpt-4",
					"llm.provider": "openai",
					"llm.system": "openai",
				})
			);
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

			const spans = realInMemorySpanExporter.getFinishedSpans();
			expect(spans.length).toBeGreaterThanOrEqual(2); // root span + openai span
			
			const rootSpan = spans.find(s => s.name === "root_span");
			expect(rootSpan).toBeDefined();
			
			const llmSpan = spans.find(s => 
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] === OpenInferenceSpanKind.LLM
			);
			expect(llmSpan).toBeDefined();
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
			
			const spans = realInMemorySpanExporter.getFinishedSpans();
			const rootSpan = spans.find(s => s.name === "root_span");
			expect(rootSpan).toBeDefined();
			expect(rootSpan?.attributes["atla.mark.success"]).toBe(1);
		});

		it.skip("should handle failing OpenAI requests", async () => {
			// Set mock to throw error
			setOpenAIMockResponse(() => {
				throw new Error("Internal server error");
			});

			instrumentOpenAI();

			await expect(
				openaiClient.chat.completions.create({
					model: "gpt-4",
					messages: [{ role: "user", content: "Hello!" }],
				}),
			).rejects.toThrow("Internal server error");

			const spans = realInMemorySpanExporter.getFinishedSpans();
			const llmSpan = spans.find(s => 
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] === OpenInferenceSpanKind.LLM
			);
			expect(llmSpan).toBeDefined();
			// Check that the span recorded the error
			expect(llmSpan?.status?.code).toBe(2); // SpanStatusCode.ERROR
		});

		it.skip("should handle failing instrumentation with marking", async () => {
			// Set mock to throw error
			setOpenAIMockResponse(() => {
				throw new Error("Bad request");
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

			await expect(testFunction()).rejects.toThrow("Bad request");
			
			const spans = realInMemorySpanExporter.getFinishedSpans();
			const rootSpan = spans.find(s => s.name === "root_span");
			expect(rootSpan).toBeDefined();
			// Root span should be marked as successful even though it threw
			expect(rootSpan?.attributes["marking.success"]).toBe(true);
			// But it should still have error status due to the exception
			expect(rootSpan?.status?.code).toBe(2); // SpanStatusCode.ERROR
		});

		it("should handle completions API", async () => {
			instrumentOpenAI();

			await openaiClient.completions.create({
				model: "gpt-3.5-turbo-instruct",
				prompt: "Hello",
				max_tokens: 10,
			});

			const spans = realInMemorySpanExporter.getFinishedSpans();
			const llmSpan = spans.find(s => 
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] === OpenInferenceSpanKind.LLM
			);
			expect(llmSpan).toBeDefined();
			expect(llmSpan?.attributes).toEqual(
				expect.objectContaining({
					[SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.LLM,
					[SemanticConventions.LLM_MODEL_NAME]: "gpt-3.5-turbo-instruct",
					"input.value": "Hello",
					"output.value": "Hello, world!",
				})
			);
		});

		it("should handle embeddings API", async () => {
			instrumentOpenAI();

			await openaiClient.embeddings.create({
				model: "text-embedding-ada-002",
				input: "Hello world",
			});

			const spans = realInMemorySpanExporter.getFinishedSpans();
			const embeddingSpan = spans.find(s => 
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] === OpenInferenceSpanKind.EMBEDDING
			);
			expect(embeddingSpan).toBeDefined();
			expect(embeddingSpan?.attributes).toEqual(
				expect.objectContaining({
					[SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.EMBEDDING,
					[SemanticConventions.EMBEDDING_MODEL_NAME]: "text-embedding-ada-002",
					"embedding.embeddings.0.embedding.text": "Hello world",
				})
			);
		});

		it("should handle streaming responses", async () => {
			instrumentOpenAI();

			const stream = await openaiClient.chat.completions.create({
				model: "gpt-4",
				messages: [{ role: "user", content: "Hello!" }],
				stream: true,
			});

			// Consume the stream
			const chunks: any[] = [];
			for await (const chunk of stream) {
				// Process chunk
				expect(chunk).toBeDefined();
				chunks.push(chunk);
			}

			expect(chunks.length).toBeGreaterThan(0);

			// Wait a bit for spans to be exported
			await new Promise(resolve => setTimeout(resolve, 100));

			const spans = realInMemorySpanExporter.getFinishedSpans();
			const llmSpan = spans.find(s => 
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] === OpenInferenceSpanKind.LLM
			);
			expect(llmSpan).toBeDefined();
			expect(llmSpan?.attributes).toEqual(
				expect.objectContaining({
					[SemanticConventions.OPENINFERENCE_SPAN_KIND]: OpenInferenceSpanKind.LLM,
					"llm.input_messages.0.message.role": "user",
					"llm.input_messages.0.message.content": "Hello!",
				})
			);
		});
	});
});
