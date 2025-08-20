import {
	jest,
	describe,
	it,
	expect,
	beforeEach,
	afterEach,
} from "@jest/globals";
import type {
	ChatCompletionMessageParam,
	ChatCompletionAssistantMessageParam,
	ChatCompletionFunctionTool,
} from "openai/resources/chat/completions";
import { BaseAtlaTest, realInMemorySpanExporter } from "./setup";
import { AtlaSpan, startAsCurrentSpan } from "../src/span";
import {
	SemanticConventions,
	OpenInferenceSpanKind,
	MimeType,
	MESSAGE_ROLE,
	MESSAGE_CONTENT,
	MESSAGE_TOOL_CALLS,
	TOOL_CALL_FUNCTION_NAME,
	TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
	TOOL_JSON_SCHEMA,
} from "@arizeai/openinference-semantic-conventions";

describe("AtlaSpan", () => {
	let baseTest: BaseAtlaTest;
	let atlaSpan: AtlaSpan;

	beforeEach(() => {
		baseTest = new BaseAtlaTest();
		baseTest.beforeEach();
		atlaSpan = new AtlaSpan(baseTest.getMockSpan());
	});

	afterEach(() => {
		baseTest.afterEach();
	});

	describe("recordGeneration", () => {
		it("should record basic input and output messages", () => {
			const inputMessages: ChatCompletionMessageParam[] = [
				{ role: "system", content: "You are a helpful assistant." },
				{ role: "user", content: "What is the capital of France?" },
			];

			const outputMessages: ChatCompletionAssistantMessageParam[] = [
				{ role: "assistant", content: "The capital of France is Paris." },
			];

			atlaSpan.recordGeneration({ inputMessages, outputMessages });

			const mockSpan = baseTest.getMockSpan();

			// Check span kind is set to LLM
			expect(
				mockSpan.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND],
			).toBe(OpenInferenceSpanKind.LLM);

			// Check input attributes
			expect(mockSpan.attributes[SemanticConventions.INPUT_VALUE]).toBe(
				JSON.stringify(inputMessages),
			);
			expect(mockSpan.attributes[SemanticConventions.INPUT_MIME_TYPE]).toBe(
				MimeType.JSON,
			);

			// Check output attributes
			expect(mockSpan.attributes[SemanticConventions.OUTPUT_VALUE]).toBe(
				JSON.stringify(outputMessages),
			);
			expect(mockSpan.attributes[SemanticConventions.OUTPUT_MIME_TYPE]).toBe(
				MimeType.JSON,
			);

			// Check input message attributes
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_INPUT_MESSAGES}.0.${MESSAGE_ROLE}`
				],
			).toBe("system");
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_INPUT_MESSAGES}.0.${MESSAGE_CONTENT}`
				],
			).toBe("You are a helpful assistant.");
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_INPUT_MESSAGES}.1.${MESSAGE_ROLE}`
				],
			).toBe("user");
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_INPUT_MESSAGES}.1.${MESSAGE_CONTENT}`
				],
			).toBe("What is the capital of France?");

			// Check output message attributes
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_OUTPUT_MESSAGES}.0.${MESSAGE_ROLE}`
				],
			).toBe("assistant");
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_OUTPUT_MESSAGES}.0.${MESSAGE_CONTENT}`
				],
			).toBe("The capital of France is Paris.");
		});

		it("should handle array content in messages", () => {
			const inputMessages: ChatCompletionMessageParam[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "First part" },
						{ type: "text", text: "Second part" },
						{
							type: "image_url",
							image_url: { url: "http://example.com/image.jpg" },
						},
					],
				},
			];

			const outputMessages: ChatCompletionAssistantMessageParam[] = [
				{ role: "assistant", content: "Response" },
			];

			atlaSpan.recordGeneration({ inputMessages, outputMessages });

			const mockSpan = baseTest.getMockSpan();

			// Should extract and join text content
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_INPUT_MESSAGES}.0.${MESSAGE_CONTENT}`
				],
			).toBe("First part\nSecond part");
		});

		it("should record tool calls in output messages", () => {
			const inputMessages: ChatCompletionMessageParam[] = [
				{
					role: "user",
					content: "What are the capitals of France and Germany?",
				},
			];

			const outputMessages: ChatCompletionAssistantMessageParam[] = [
				{
					role: "assistant",
					content: null,
					tool_calls: [
						{
							id: "1",
							type: "function",
							function: {
								name: "get_capital",
								arguments: '{"country": "France"}',
							},
						},
						{
							id: "2",
							type: "function",
							function: {
								name: "get_capital",
								arguments: '{"country": "Germany"}',
							},
						},
					],
				},
			];

			atlaSpan.recordGeneration({ inputMessages, outputMessages });

			const mockSpan = baseTest.getMockSpan();

			// Check first tool call
			const toolCall0Prefix = `${SemanticConventions.LLM_OUTPUT_MESSAGES}.0.${MESSAGE_TOOL_CALLS}.0`;
			expect(
				mockSpan.attributes[`${toolCall0Prefix}.${TOOL_CALL_FUNCTION_NAME}`],
			).toBe("get_capital");
			expect(
				mockSpan.attributes[
					`${toolCall0Prefix}.${TOOL_CALL_FUNCTION_ARGUMENTS_JSON}`
				],
			).toBe('{"country": "France"}');

			// Check second tool call
			const toolCall1Prefix = `${SemanticConventions.LLM_OUTPUT_MESSAGES}.0.${MESSAGE_TOOL_CALLS}.1`;
			expect(
				mockSpan.attributes[`${toolCall1Prefix}.${TOOL_CALL_FUNCTION_NAME}`],
			).toBe("get_capital");
			expect(
				mockSpan.attributes[
					`${toolCall1Prefix}.${TOOL_CALL_FUNCTION_ARGUMENTS_JSON}`
				],
			).toBe('{"country": "Germany"}');
		});

		it("should record tools schema when provided", () => {
			const inputMessages: ChatCompletionMessageParam[] = [
				{ role: "user", content: "Test message" },
			];

			const outputMessages: ChatCompletionAssistantMessageParam[] = [
				{ role: "assistant", content: "Test response" },
			];

			const tools: ChatCompletionFunctionTool[] = [
				{
					type: "function",
					function: {
						name: "get_capital",
						description: "Get the capital of a country.",
						parameters: {
							type: "object",
							properties: {
								country: { type: "string" },
							},
						},
					},
				},
			];

			atlaSpan.recordGeneration({ inputMessages, outputMessages, tools });

			const mockSpan = baseTest.getMockSpan();

			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_TOOLS}.0.${TOOL_JSON_SCHEMA}`
				],
			).toBe(JSON.stringify(tools[0]));
		});

		it("should handle multiple tools", () => {
			const tools: ChatCompletionFunctionTool[] = [
				{
					type: "function",
					function: {
						name: "get_capital",
						description: "Get the capital of a country.",
						parameters: {
							type: "object",
							properties: { country: { type: "string" } },
						},
					},
				},
				{
					type: "function",
					function: {
						name: "get_weather",
						description: "Get weather information.",
						parameters: {
							type: "object",
							properties: { city: { type: "string" } },
						},
					},
				},
			];

			atlaSpan.recordGeneration({
				inputMessages: [{ role: "user", content: "test" }],
				outputMessages: [{ role: "assistant", content: "test" }],
				tools,
			});

			const mockSpan = baseTest.getMockSpan();

			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_TOOLS}.0.${TOOL_JSON_SCHEMA}`
				],
			).toBe(JSON.stringify(tools[0]));
			expect(
				mockSpan.attributes[
					`${SemanticConventions.LLM_TOOLS}.1.${TOOL_JSON_SCHEMA}`
				],
			).toBe(JSON.stringify(tools[1]));
		});
	});

	describe("setAttribute", () => {
		it("should set attributes and return this for chaining", () => {
			const result = atlaSpan.setAttribute("test.key", "test.value");

			expect(result).toBe(atlaSpan);
			expect(baseTest.getMockSpan().setAttribute).toHaveBeenCalledWith(
				"test.key",
				"test.value",
			);
		});
	});

	describe("setStatus", () => {
		it("should set status and return this for chaining", () => {
			const status = { code: 1 };
			const result = atlaSpan.setStatus(status);

			expect(result).toBe(atlaSpan);
			expect(baseTest.getMockSpan().setStatus).toHaveBeenCalledWith(status);
		});
	});

	describe("recordException", () => {
		it("should record exceptions", () => {
			const error = new Error("Test error");
			atlaSpan.recordException(error);

			expect(baseTest.getMockSpan().recordException).toHaveBeenCalledWith(
				error,
			);
		});
	});

	describe("end", () => {
		it("should end the span", () => {
			atlaSpan.end();
			expect(baseTest.getMockSpan().end).toHaveBeenCalled();
		});

		it("should end the span with endTime", () => {
			const endTime = Date.now();
			atlaSpan.end(endTime);
			expect(baseTest.getMockSpan().end).toHaveBeenCalledWith(endTime);
		});
	});
});

describe("startAsCurrentSpan", () => {
	let baseTest: BaseAtlaTest;

	beforeEach(() => {
		baseTest = new BaseAtlaTest();
		baseTest.beforeEach();
		realInMemorySpanExporter.reset();
	});

	afterEach(() => {
		baseTest.afterEach();
		realInMemorySpanExporter.reset();
	});

	it("should create span and run function", async () => {
		const testFunction = jest.fn((span: AtlaSpan) => {
			span.setAttribute("test", "value");
			return "result";
		});

		const result = await startAsCurrentSpan("test-span", testFunction);

		expect(result).toBe("result");
		expect(testFunction).toHaveBeenCalledWith(expect.any(AtlaSpan));

		const spans = realInMemorySpanExporter.getFinishedSpans();
		expect(spans.length).toBe(1);
		expect(spans[0].name).toBe("test-span");
		expect(spans[0].attributes.test).toBe("value");
		expect(spans[0].endTime).toBeDefined();
	});

	it("should handle async functions", async () => {
		const testFunction = jest.fn(async (span: AtlaSpan) => {
			span.setAttribute("async", "test");
			await new Promise((resolve) => setTimeout(resolve, 10));
			return "async-result";
		});

		const result = await startAsCurrentSpan("async-span", testFunction);

		expect(result).toBe("async-result");
		expect(testFunction).toHaveBeenCalledWith(expect.any(AtlaSpan));

		const spans = realInMemorySpanExporter.getFinishedSpans();
		expect(spans.length).toBe(1);
		expect(spans[0].name).toBe("async-span");
		expect(spans[0].attributes.async).toBe("test");
		expect(spans[0].endTime).toBeDefined();
	});

	it("should handle exceptions and still end span", async () => {
		const testFunction = jest.fn((_span: AtlaSpan) => {
			throw new Error("Test error");
		});

		await expect(
			startAsCurrentSpan("error-span", testFunction),
		).rejects.toThrow("Test error");

		const spans = realInMemorySpanExporter.getFinishedSpans();
		expect(spans.length).toBe(1);
		expect(spans[0].name).toBe("error-span");
		// The implementation only ensures the span ends, it doesn't set error status
		expect(spans[0].endTime).toBeDefined();
		// Verify the function was called even though it threw
		expect(testFunction).toHaveBeenCalled();
	});

	it("should handle async exceptions and still end span", async () => {
		const testFunction = jest.fn(async (_span: AtlaSpan) => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			throw new Error("Async error");
		});

		await expect(
			startAsCurrentSpan("async-error-span", testFunction),
		).rejects.toThrow("Async error");

		const spans = realInMemorySpanExporter.getFinishedSpans();
		expect(spans.length).toBe(1);
		expect(spans[0].name).toBe("async-error-span");
		// The implementation only ensures the span ends, it doesn't set error status
		expect(spans[0].endTime).toBeDefined();
		// Verify the async function was called even though it threw
		expect(testFunction).toHaveBeenCalled();
	});
});
