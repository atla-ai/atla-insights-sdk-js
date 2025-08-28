import { OpenAIAgentsProcessor } from "../../../src/frameworks/openai-agents";
import { describe, expect, test } from "@jest/globals";
import { Responses } from "openai/resources/responses";
import { ResponseInputItem } from "openai/resources/responses/responses";

describe("OpenAIAgentsProcessor", () => {
	it("should be defined", () => {
		expect(OpenAIAgentsProcessor).toBeDefined();
	});
});

describe("getAttributesFromMessageParam", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"simple_message_with_string_content",
			{
				role: "user",
				content: "Hello",
				type: "message",
			} as Responses.EasyInputMessage,
			"",
			{
				"message.role": "user",
				"message.content": "Hello",
			},
		],
		[
			"message_with_content_list",
			{
				role: "assistant",
				content: [
					{
						type: "input_text",
						text: "Hi",
					},
				],
				type: "message",
			} as Responses.EasyInputMessage,
			"",
			{
				"message.role": "assistant",
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hi",
			},
		],
		[
			"developer_message",
			{
				role: "developer",
				content: "Debug info",
				type: "message",
			} as Responses.EasyInputMessage,
			"",
			{
				"message.role": "developer",
				"message.content": "Debug info",
			},
		],
		[
			"system_message",
			{
				role: "system",
				content: "System message",
				type: "message",
			} as Responses.EasyInputMessage,
			"",
			{
				"message.role": "system",
				"message.content": "System message",
			},
		],
		[
			"empty_content_list",
			{
				role: "user",
				content: [],
				type: "message",
			} as Responses.EasyInputMessage,
			"",
			{
				"message.role": "user",
			},
		],
		[
			"multiple_content_items",
			{
				role: "user",
				content: [
					{
						type: "input_text",
						text: "Hello",
					},
					{
						type: "input_text",
						text: "World",
					},
				],
				type: "message",
			} as Responses.EasyInputMessage,
			"",
			{
				"message.role": "user",
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hello",
				"message.contents.1.message_content.type": "text",
				"message.contents.1.message_content.text": "World",
			},
		],
		[
			"response_output_message",
			{
				id: "msg-123",
				status: "completed",
				role: "assistant",
				content: [
					{
						type: "output_text",
						text: "Response text",
						annotations: [],
					},
				],
				type: "message",
			} as Responses.ResponseOutputMessage,
			"",
			{
				"message.role": "assistant",
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Response text",
			},
		],
		[
			"message_without_content",
			{
				role: "assistant",
				type: "message",
			} as any,
			"",
			{
				"message.role": "assistant",
			},
		],
		[
			"message_with_refusal_content",
			{
				role: "assistant",
				content: [
					{
						type: "refusal",
						refusal: "I cannot help with that",
					},
				],
				type: "message",
			} as any,
			"",
			{
				"message.role": "assistant",
				"message.contents.0.message_content.type": "refusal",
				"message.contents.0.message_content.text": "I cannot help with that",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			messageParam:
				| Responses.EasyInputMessage
				| ResponseInputItem.Message
				| Responses.ResponseOutputMessage,
			prefix: string,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromMessageParam(
				messageParam,
				prefix,
			);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromFunctionToolCall", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"empty_arguments",
			{
				call_id: "123",
				name: "test_func",
				arguments: "{}",
			} as Responses.ResponseFunctionToolCall,
			"",
			{
				"tool_call.id": "123",
				"tool_call.function.name": "test_func",
			},
		],
		[
			"with_arguments",
			{
				call_id: "123",
				name: "test_func",
				arguments: '{"arg": "value"}',
			} as Responses.ResponseFunctionToolCall,
			"",
			{
				"tool_call.id": "123",
				"tool_call.function.name": "test_func",
				"tool_call.function.arguments": '{"arg": "value"}',
			},
		],
	])(
		"%s",
		(
			_testName: string,
			toolCallParam: Responses.ResponseFunctionToolCall,
			prefix: string,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromFunctionToolCall(
				toolCallParam,
				prefix,
			);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromMessageContentList", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"input_text",
			[{ type: "input_text", text: "Hello" } as Responses.ResponseInputText],
			"",
			{
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hello",
			},
		],
		[
			"output_text",
			[
				{
					type: "output_text",
					text: "Hi",
					annotations: [],
				} as Responses.ResponseOutputText,
			],
			"",
			{
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hi",
			},
		],
		["empty_content_list", [], "", {}],
		[
			"multiple_content_items",
			[
				{ type: "input_text", text: "Hello" } as Responses.ResponseInputText,
				{
					type: "output_text",
					text: "Hi",
					annotations: [],
				} as Responses.ResponseOutputText,
			],
			"",
			{
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hello",
				"message.contents.1.message_content.type": "text",
				"message.contents.1.message_content.text": "Hi",
			},
		],
		[
			"refusal_content",
			[
				{
					type: "refusal",
					refusal: "I cannot help with that",
				} as Responses.ResponseOutputRefusal,
			],
			"",
			{
				"message.contents.0.message_content.type": "refusal",
				"message.contents.0.message_content.text": "I cannot help with that",
			},
		],
		[
			"mixed_content_types",
			[
				{ type: "input_text", text: "Hello" } as Responses.ResponseInputText,
				{
					type: "refusal",
					refusal: "I cannot help with that",
				} as Responses.ResponseOutputRefusal,
			],
			"",
			{
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hello",
				"message.contents.1.message_content.type": "refusal",
				"message.contents.1.message_content.text": "I cannot help with that",
			},
		],
		[
			"unsupported_types_skipped",
			[
				{ type: "input_text", text: "Hello" } as Responses.ResponseInputText,
				{ type: "input_image" } as any,
				{ type: "input_file" } as any,
				{
					type: "output_text",
					text: "World",
					annotations: [],
				} as Responses.ResponseOutputText,
			],
			"",
			{
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hello",
				"message.contents.3.message_content.type": "text",
				"message.contents.3.message_content.text": "World",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			contentList: Array<
				Responses.ResponseInputContent | Responses.ResponseContent
			>,
			prefix: string,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromMessageContentList(
				contentList,
				prefix,
			);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromFunctionCallOutput", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"simple_output",
			{
				call_id: "123",
				output: "result",
				type: "function_call_output",
			} as ResponseInputItem.FunctionCallOutput,
			"",
			{
				"message.content": "result",
				"message.role": "tool",
				"message.tool_call_id": "123",
			},
		],
		[
			"empty_output",
			{
				call_id: "123",
				output: "",
				type: "function_call_output",
			} as ResponseInputItem.FunctionCallOutput,
			"",
			{
				"message.content": "",
				"message.role": "tool",
				"message.tool_call_id": "123",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			functionCallOutput: ResponseInputItem.FunctionCallOutput,
			prefix: string,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromFunctionCallOutput(
				functionCallOutput,
				prefix,
			);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromGenerationSpanData", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"complete_generation",
			{
				model: "gpt-4",
				model_config: { temperature: 0.7 },
				input: [{ role: "user", content: "Hello" }],
				output: [{ role: "assistant", content: "Hi" }],
				usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
			},
			{
				"input.mime_type": "application/json",
				"input.value": '[{"role":"user","content":"Hello"}]',
				"llm.input_messages.0.message.content": "Hello",
				"llm.input_messages.0.message.role": "user",
				"llm.invocation_parameters": '{"temperature":0.7}',
				"llm.model_name": "gpt-4",
				"llm.output_messages.0.message.content": "Hi",
				"llm.output_messages.0.message.role": "assistant",
				"llm.token_count.completion": 5,
				"llm.token_count.prompt": 10,
				"output.mime_type": "application/json",
				"output.value": '[{"role":"assistant","content":"Hi"}]',
			},
		],
		[
			"minimal_generation",
			{
				model: "gpt-4",
				model_config: null,
				input: null,
				output: null,
				usage: null,
			},
			{
				"llm.model_name": "gpt-4",
			},
		],
		[
			"generation_with_provider",
			{
				model: "gpt-4",
				model_config: {
					temperature: 0.7,
					base_url: "https://api.openai.com/v1",
				},
				input: [{ role: "user", content: "Hello" }],
				output: [{ role: "assistant", content: "Hi" }],
				usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
			},
			{
				"input.mime_type": "application/json",
				"input.value": '[{"role":"user","content":"Hello"}]',
				"llm.input_messages.0.message.content": "Hello",
				"llm.input_messages.0.message.role": "user",
				"llm.invocation_parameters":
					'{"temperature":0.7,"base_url":"https://api.openai.com/v1"}',
				"llm.model_name": "gpt-4",
				"llm.provider": "openai",
				"llm.output_messages.0.message.content": "Hi",
				"llm.output_messages.0.message.role": "assistant",
				"llm.token_count.completion": 5,
				"llm.token_count.prompt": 10,
				"output.mime_type": "application/json",
				"output.value": '[{"role":"assistant","content":"Hi"}]',
			},
		],
		[
			"generation_with_other_provider",
			{
				model: "gpt-4",
				model_config: { temperature: 0.7, base_url: "https://other-api.com" },
				input: [{ role: "user", content: "Hello" }],
				output: [{ role: "assistant", content: "Hi" }],
				usage: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
			},
			{
				"input.mime_type": "application/json",
				"input.value": '[{"role":"user","content":"Hello"}]',
				"llm.input_messages.0.message.content": "Hello",
				"llm.input_messages.0.message.role": "user",
				"llm.invocation_parameters":
					'{"temperature":0.7,"base_url":"https://other-api.com"}',
				"llm.model_name": "gpt-4",
				"llm.output_messages.0.message.content": "Hi",
				"llm.output_messages.0.message.role": "assistant",
				"llm.token_count.completion": 5,
				"llm.token_count.prompt": 10,
				"output.mime_type": "application/json",
				"output.value": '[{"role":"assistant","content":"Hi"}]',
			},
		],
	])(
		"%s",
		(
			_testName: string,
			generationSpanData: Record<string, any>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromGenerationSpanData(generationSpanData);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromChatCompletionsInput", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"simple_input",
			[{ role: "user", content: "Hello" }],
			{
				"input.value": '[{"role":"user","content":"Hello"}]',
				"input.mime_type": "application/json",
				"llm.input_messages.0.message.role": "user",
				"llm.input_messages.0.message.content": "Hello",
			},
		],
		["empty_input", [], {}],
		["none_input", null, {}],
		[
			"multiple_messages",
			[
				{ role: "user", content: "Hello" },
				{ role: "assistant", content: "Hi" },
			],
			{
				"input.value": JSON.stringify([
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi" },
				]),
				"input.mime_type": "application/json",
				"llm.input_messages.0.message.role": "user",
				"llm.input_messages.0.message.content": "Hello",
				"llm.input_messages.1.message.role": "assistant",
				"llm.input_messages.1.message.content": "Hi",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			chatCompletionsInput: Array<Record<string, any>> | null,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromChatCompletionsInput(chatCompletionsInput);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromChatCompletionsOutput", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"simple_output",
			[{ role: "assistant", content: "Hi" }],
			{
				"output.value": JSON.stringify([{ role: "assistant", content: "Hi" }]),
				"output.mime_type": "application/json",
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.content": "Hi",
			},
		],
		["empty_output", [], {}],
		["none_output", null, {}],
		[
			"multiple_messages",
			[
				{ role: "assistant", content: "Hi" },
				{ role: "user", content: "Thanks" },
			],
			{
				"output.value": JSON.stringify([
					{ role: "assistant", content: "Hi" },
					{ role: "user", content: "Thanks" },
				]),
				"output.mime_type": "application/json",
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.content": "Hi",
				"llm.output_messages.1.message.role": "user",
				"llm.output_messages.1.message.content": "Thanks",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			chatCompletionsOutput: Array<Record<string, any>> | null,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromChatCompletionsOutput(
				chatCompletionsOutput,
			);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromChatCompletionsMessageDicts", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"simple_message",
			[{ role: "user", content: "Hello" }],
			{
				"llm.input_messages.0.message.role": "user",
				"llm.input_messages.0.message.content": "Hello",
			},
		],
		[
			"message_with_tool_calls",
			[
				{
					role: "assistant",
					content: "Hi",
					tool_calls: [{ id: "123", function: { name: "test_func" } }],
				},
			],
			{
				"llm.input_messages.0.message.role": "assistant",
				"llm.input_messages.0.message.content": "Hi",
				"llm.input_messages.0.message.tool_calls.0.tool_call.id": "123",
				"llm.input_messages.0.message.tool_calls.0.tool_call.function.name":
					"test_func",
			},
		],
		[
			"message_with_multiple_tool_calls",
			[
				{
					role: "assistant",
					content: "Hi",
					tool_calls: [
						{ id: "123", function: { name: "test_func1" } },
						{ id: "456", function: { name: "test_func2" } },
					],
				},
			],
			{
				"llm.input_messages.0.message.role": "assistant",
				"llm.input_messages.0.message.content": "Hi",
				"llm.input_messages.0.message.tool_calls.0.tool_call.id": "123",
				"llm.input_messages.0.message.tool_calls.0.tool_call.function.name":
					"test_func1",
				"llm.input_messages.0.message.tool_calls.1.tool_call.id": "456",
				"llm.input_messages.0.message.tool_calls.1.tool_call.function.name":
					"test_func2",
			},
		],
		[
			"multiple_messages_with_tool_calls",
			[
				{ role: "user", content: "Hello" },
				{
					role: "assistant",
					content: "Hi",
					tool_calls: [
						{
							id: "123",
							function: { name: "test_func" },
						},
					],
				},
			],
			{
				"llm.input_messages.0.message.role": "user",
				"llm.input_messages.0.message.content": "Hello",
				"llm.input_messages.1.message.role": "assistant",
				"llm.input_messages.1.message.content": "Hi",
				"llm.input_messages.1.message.tool_calls.0.tool_call.id": "123",
				"llm.input_messages.1.message.tool_calls.0.tool_call.function.name":
					"test_func",
			},
		],
		[
			"message_without_content",
			[{ role: "user" }],
			{
				"llm.input_messages.0.message.role": "user",
			},
		],
		[
			"message_without_role",
			[{ content: "Hello" }],
			{
				"llm.input_messages.0.message.content": "Hello",
			},
		],
		[
			"message_without_content_but_with_tool_calls",
			[
				{
					role: "assistant",
					tool_calls: [{ id: "123", function: { name: "test_func" } }],
				},
			],
			{
				"llm.input_messages.0.message.role": "assistant",
				"llm.input_messages.0.message.tool_calls.0.tool_call.id": "123",
				"llm.input_messages.0.message.tool_calls.0.tool_call.function.name":
					"test_func",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			messageDicts: Array<Record<string, any>>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromChatCompletionsMessageDicts(
				messageDicts,
				"llm.input_messages.",
			);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromChatCompletionsMessageContent", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"simple_text",
			"Hello",
			{
				"llm.input_messages.0.message.content": "Hello",
			},
		],
		[
			"content_list",
			[{ type: "text", text: "Hi" }],
			{
				"llm.input_messages.0.message.contents.0.message_content.type": "text",
				"llm.input_messages.0.message.contents.0.message_content.text": "Hi",
			},
		],
		["none_content", null, {}],
		["empty_content", [], {}],
		[
			"multiple_content_items",
			[
				{ type: "text", text: "Hello" },
				{ type: "text", text: "World" },
			],
			{
				"llm.input_messages.0.message.contents.0.message_content.type": "text",
				"llm.input_messages.0.message.contents.0.message_content.text": "Hello",
				"llm.input_messages.0.message.contents.1.message_content.type": "text",
				"llm.input_messages.0.message.contents.1.message_content.text": "World",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			messageContent: string | Array<Record<string, any>> | null,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromChatCompletionsMessageContent(
					messageContent,
					"llm.input_messages.0.",
				);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromChatCompletionsMessageContentItem", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"text_content",
			{ type: "text", text: "Hello" },
			{
				"message_content.type": "text",
				"message_content.text": "Hello",
			},
		],
		["empty_text", { type: "text", text: null }, {}],
		["no_text", { type: "text" }, {}],
		["other_type", { type: "other" }, {}],
	])(
		"%s",
		(
			_testName: string,
			contentItem: Record<string, any>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromChatCompletionsMessageContentItem(
					contentItem,
					"",
				);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromChatCompletionsToolCallDict", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"complete_tool_call",
			{
				id: "123",
				function: { name: "test_func", arguments: '{"arg": "value"}' },
			},
			{
				"tool_call.id": "123",
				"tool_call.function.name": "test_func",
				"tool_call.function.arguments": '{"arg": "value"}',
			},
		],
		[
			"empty_arguments",
			{
				id: "123",
				function: { name: "test_func", arguments: "{}" },
			},
			{
				"tool_call.id": "123",
				"tool_call.function.name": "test_func",
			},
		],
		[
			"no_arguments",
			{
				id: "123",
				function: { name: "test_func" },
			},
			{
				"tool_call.id": "123",
				"tool_call.function.name": "test_func",
			},
		],
		[
			"no_function",
			{
				id: "123",
			},
			{
				"tool_call.id": "123",
			},
		],
		[
			"no_id",
			{
				function: { name: "test_func" },
			},
			{
				"tool_call.function.name": "test_func",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			toolCallDict: Record<string, any>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromChatCompletionsToolCallDict(
				toolCallDict,
				"",
			);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromChatCompletionsUsage", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"complete_usage",
			{ input_tokens: 10, output_tokens: 5 },
			{
				"llm.token_count.prompt": 10,
				"llm.token_count.completion": 5,
			},
		],
		["none_usage", null, {}],
		["empty_usage", {}, {}],
		[
			"only_input_tokens",
			{ input_tokens: 10 },
			{
				"llm.token_count.prompt": 10,
			},
		],
		[
			"only_output_tokens",
			{ output_tokens: 5 },
			{
				"llm.token_count.completion": 5,
			},
		],
		["zero_tokens", { input_tokens: 0, output_tokens: 0 }, {}],
	])(
		"%s",
		(
			_testName: string,
			usageDict: Record<string, any> | null,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromChatCompletionsUsage(usageDict);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromUsage", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"complete_usage",
			{
				input_tokens: 10,
				output_tokens: 5,
				total_tokens: 15,
				input_tokens_details: {
					cached_tokens: 0,
				},
				output_tokens_details: {
					reasoning_tokens: 0,
				},
			} as Responses.ResponseUsage,
			{
				"llm.token_count.prompt": 10,
				"llm.token_count.completion_details.reasoning": 0,
				"llm.token_count.completion": 5,
				"llm.token_count.prompt_details.cache_read": 0,
				"llm.token_count.total": 15,
			},
		],
		["no_usage", null, {}],
		[
			"zero_tokens",
			{
				input_tokens: 0,
				output_tokens: 0,
				total_tokens: 0,
				input_tokens_details: {
					cached_tokens: 0,
				},
				output_tokens_details: {
					reasoning_tokens: 0,
				},
			} as Responses.ResponseUsage,
			{
				"llm.token_count.prompt": 0,
				"llm.token_count.completion_details.reasoning": 0,
				"llm.token_count.completion": 0,
				"llm.token_count.prompt_details.cache_read": 0,
				"llm.token_count.total": 0,
			},
		],
		[
			"large_token_counts",
			{
				input_tokens: 1000,
				output_tokens: 500,
				total_tokens: 1500,
				input_tokens_details: {
					cached_tokens: 100,
				},
				output_tokens_details: {
					reasoning_tokens: 50,
				},
			} as Responses.ResponseUsage,
			{
				"llm.token_count.completion": 500,
				"llm.token_count.completion_details.reasoning": 50,
				"llm.token_count.prompt": 1000,
				"llm.token_count.prompt_details.cache_read": 100,
				"llm.token_count.total": 1500,
			},
		],
	])(
		"%s",
		(
			_testName: string,
			usage: Responses.ResponseUsage | null,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromUsage(usage);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromMessage", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"text_message",
			{
				id: "msg-123",
				role: "assistant",
				content: [
					{
						text: "Hi",
						type: "output_text",
						annotations: [],
					},
				],
				status: "completed",
				type: "message",
			} as Responses.ResponseOutputMessage,
			{
				"message.role": "assistant",
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hi",
			},
		],
		[
			"refusal_message",
			{
				id: "msg-124",
				role: "assistant",
				content: [
					{
						type: "refusal",
						refusal: "I cannot help with that",
					},
				],
				status: "completed",
				type: "message",
			} as Responses.ResponseOutputMessage,
			{
				"message.role": "assistant",
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "I cannot help with that",
			},
		],
		[
			"mixed_content_message",
			{
				id: "msg-125",
				role: "assistant",
				content: [
					{
						text: "Hi",
						type: "output_text",
						annotations: [],
					},
					{
						type: "refusal",
						refusal: "I cannot help with that",
					},
				],
				status: "in_progress",
				type: "message",
			} as Responses.ResponseOutputMessage,
			{
				"message.role": "assistant",
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hi",
				"message.contents.1.message_content.type": "text",
				"message.contents.1.message_content.text": "I cannot help with that",
			},
		],
		[
			"empty_content_message",
			{
				id: "msg-126",
				role: "assistant",
				content: [],
				status: "incomplete",
				type: "message",
			} as Responses.ResponseOutputMessage,
			{
				"message.role": "assistant",
			},
		],
		[
			"multiple_text_messages",
			{
				id: "msg-130",
				role: "assistant",
				content: [
					{
						text: "Hello",
						type: "output_text",
						annotations: [],
					},
					{
						text: "World",
						type: "output_text",
						annotations: [],
					},
				],
				status: "completed",
				type: "message",
			} as Responses.ResponseOutputMessage,
			{
				"message.role": "assistant",
				"message.contents.0.message_content.type": "text",
				"message.contents.0.message_content.text": "Hello",
				"message.contents.1.message_content.type": "text",
				"message.contents.1.message_content.text": "World",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			message: Responses.ResponseOutputMessage,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromMessage(message);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromResponseInstruction", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"with_instructions",
			"Be helpful",
			{
				"llm.input_messages.0.message.role": "system",
				"llm.input_messages.0.message.content": "Be helpful",
			},
		],
		["no_instructions", null, {}],
		["empty_instructions", "", {}],
		[
			"multiline_instructions",
			"Be helpful\nAnd friendly",
			{
				"llm.input_messages.0.message.role": "system",
				"llm.input_messages.0.message.content": "Be helpful\nAnd friendly",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			instructions: string | null,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromResponseInstruction(instructions);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromMCPListToolSpanData", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"complete_tools_list",
			{ server: "test-server", result: ["tool1", "tool2"] },
			{
				"output.value": '["tool1","tool2"]',
				"output.mime_type": "application/json",
			},
		],
		[
			"empty_tools_list",
			{ server: "test-server", result: [] },
			{
				"output.value": "[]",
				"output.mime_type": "application/json",
			},
		],
		[
			"none_tools_list",
			{ server: "test-server", result: null },
			{
				"output.value": "null",
				"output.mime_type": "application/json",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			mcpListToolSpanData: Record<string, any>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromMCPListToolSpanData(mcpListToolSpanData);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromFunctionSpanData", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"complete_function",
			{
				name: "test_func",
				input: '{"k": "v"}',
				output: '{"result": "success"}',
				mcp_data: { key: "value" },
			},
			{
				"tool.name": "test_func",
				"input.value": '{"k": "v"}',
				"input.mime_type": "application/json",
				"output.value": '{"result": "success"}',
				"output.mime_type": "application/json",
			},
		],
		[
			"minimal_function",
			{
				name: "test_func",
				input: null,
				output: null,
				mcp_data: null,
			},
			{
				"tool.name": "test_func",
			},
		],
		[
			"complex_json_data",
			{
				name: "test_func",
				input: '{"complex": {"nested": "data"}}',
				output: '{"result": "success"}',
				mcp_data: { metadata: "value" },
			},
			{
				"tool.name": "test_func",
				"input.value": '{"complex": {"nested": "data"}}',
				"input.mime_type": "application/json",
				"output.value": '{"result": "success"}',
				"output.mime_type": "application/json",
			},
		],
		[
			"empty_string_output",
			{
				name: "test_func",
				input: '{"k": "v"}',
				output: "",
				mcp_data: null,
			},
			{
				"tool.name": "test_func",
				"input.value": '{"k": "v"}',
				"input.mime_type": "application/json",
				"output.value": "",
			},
		],
	])(
		"%s",
		(
			_testName: string,
			functionSpanData: Record<string, any>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromFunctionSpanData(functionSpanData);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromResponse", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"complete_response",
			{
				id: "test-id",
				created_at: 1234567890.0,
				model: "gpt-4",
				object: "response",
				output: [
					{
						id: "msg-123",
						type: "message",
						status: "completed",
						role: "assistant",
						content: [
							{
								text: "Hi",
								type: "output_text",
								annotations: [],
							},
						],
					},
				],
				parallel_tool_calls: true,
				tool_choice: "auto",
				tools: [
					{
						type: "function",
						name: "test_func",
						description: "test",
						parameters: {},
						strict: true,
					},
				],
				usage: {
					input_tokens: 10,
					output_tokens: 5,
					total_tokens: 15,
					input_tokens_details: {
						cached_tokens: 0,
					},
					output_tokens_details: {
						reasoning_tokens: 0,
					},
				},
				instructions: "Be helpful",
				temperature: 0.7,
				top_p: 0.9,
				max_output_tokens: 100,
				previous_response_id: "prev-id",
				status: "completed",
				truncation: "auto",
				user: "test-user",
				output_text: "",
				incomplete_details: null,
				error: null,
				metadata: {},
			} as Responses.Response,
			{
				"llm.input_messages.0.message.content": "Be helpful",
				"llm.input_messages.0.message.role": "system",
				"llm.invocation_parameters": JSON.stringify({
					id: "test-id",
					created_at: 1234567890.0,
					model: "gpt-4",
					parallel_tool_calls: true,
					tool_choice: "auto",
					instructions: "Be helpful",
					temperature: 0.7,
					top_p: 0.9,
					max_output_tokens: 100,
					previous_response_id: "prev-id",
					truncation: "auto",
					user: "test-user",
				}),
				"llm.model_name": "gpt-4",
				"llm.output_messages.0.message.contents.0.message_content.text": "Hi",
				"llm.output_messages.0.message.contents.0.message_content.type": "text",
				"llm.output_messages.0.message.role": "assistant",
				"llm.token_count.completion": 5,
				"llm.token_count.completion_details.reasoning": 0,
				"llm.token_count.prompt": 10,
				"llm.token_count.prompt_details.cache_read": 0,
				"llm.token_count.total": 15,
				"llm.tools.0.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func",
						description: "test",
						parameters: {},
						strict: true,
					},
				}),
			},
		],
		[
			"incomplete_response",
			{
				id: "incomplete-id",
				created_at: 1234567890.0,
				model: "gpt-4",
				object: "response",
				output: [],
				parallel_tool_calls: true,
				tool_choice: "auto",
				tools: [],
				status: "incomplete",
				incomplete_details: { reason: "content_filter" },
				output_text: "",
				error: null,
				metadata: {},
				instructions: null,
				temperature: null,
				top_p: null,
			} as Responses.Response,
			{
				"llm.invocation_parameters": JSON.stringify({
					id: "incomplete-id",
					created_at: 1234567890.0,
					model: "gpt-4",
					parallel_tool_calls: true,
					tool_choice: "auto",
					incomplete_details: { reason: "content_filter" },
				}),
				"llm.model_name": "gpt-4",
			},
		],
		[
			"minimal_response",
			{
				id: "minimal-id",
				created_at: 1234567890.0,
				model: "gpt-4",
				object: "response",
				output: [],
				parallel_tool_calls: false,
				tool_choice: "none",
				tools: [],
				status: "completed",
				output_text: "",
				incomplete_details: null,
				error: null,
				metadata: {},
				instructions: null,
				temperature: null,
				top_p: null,
			} as Responses.Response,
			{
				"llm.invocation_parameters": JSON.stringify({
					id: "minimal-id",
					created_at: 1234567890.0,
					model: "gpt-4",
					parallel_tool_calls: false,
					tool_choice: "none",
				}),
				"llm.model_name": "gpt-4",
			},
		],
		[
			"error_response",
			{
				id: "error-id",
				created_at: 1234567890.0,
				model: "gpt-4",
				object: "response",
				output: [],
				parallel_tool_calls: false,
				tool_choice: "none",
				tools: [],
				status: "failed",
				error: {
					code: "rate_limit_exceeded",
					message: "Rate limit exceeded",
				},
				output_text: "",
				incomplete_details: null,
				metadata: {},
				instructions: null,
				temperature: null,
				top_p: null,
			} as Responses.Response,
			{
				"llm.invocation_parameters": JSON.stringify({
					id: "error-id",
					created_at: 1234567890.0,
					model: "gpt-4",
					parallel_tool_calls: false,
					tool_choice: "none",
				}),
				"llm.model_name": "gpt-4",
			},
		],
		[
			"complex_response",
			{
				id: "complex-id",
				created_at: 1234567890.0,
				model: "gpt-4",
				object: "response",
				output: [
					{
						id: "msg-123",
						type: "message",
						status: "completed",
						role: "assistant",
						content: [
							{
								text: "Hi",
								type: "output_text",
								annotations: [],
							},
							{
								type: "refusal",
								refusal: "I cannot help with that",
							},
						],
					},
					{
						type: "function_call",
						call_id: "123",
						name: "test_func",
						arguments: '{"arg": "value"}',
					},
				],
				parallel_tool_calls: true,
				tool_choice: "auto",
				tools: [
					{
						type: "function",
						name: "test_func1",
						description: "test1",
						parameters: { type: "object", properties: {} },
						strict: true,
					},
					{
						type: "function",
						name: "test_func2",
						description: "test2",
						parameters: { type: "object", properties: {} },
						strict: true,
					},
				],
				usage: {
					input_tokens: 1000,
					output_tokens: 500,
					total_tokens: 1500,
					input_tokens_details: {
						cached_tokens: 100,
					},
					output_tokens_details: {
						reasoning_tokens: 50,
					},
				},
				instructions: "Be helpful\nAnd friendly",
				temperature: 0.7,
				top_p: 0.9,
				max_output_tokens: 100,
				previous_response_id: "prev-id",
				status: "completed",
				truncation: "auto",
				user: "test-user",
				output_text: "",
				incomplete_details: null,
				error: null,
				metadata: {},
			} as Responses.Response,
			{
				"llm.input_messages.0.message.content": "Be helpful\nAnd friendly",
				"llm.input_messages.0.message.role": "system",
				"llm.invocation_parameters": JSON.stringify({
					id: "complex-id",
					created_at: 1234567890.0,
					model: "gpt-4",
					parallel_tool_calls: true,
					tool_choice: "auto",
					instructions: "Be helpful\nAnd friendly",
					temperature: 0.7,
					top_p: 0.9,
					max_output_tokens: 100,
					previous_response_id: "prev-id",
					truncation: "auto",
					user: "test-user",
				}),
				"llm.model_name": "gpt-4",
				"llm.output_messages.0.message.contents.0.message_content.text": "Hi",
				"llm.output_messages.0.message.contents.0.message_content.type": "text",
				"llm.output_messages.0.message.contents.1.message_content.text":
					"I cannot help with that",
				"llm.output_messages.0.message.contents.1.message_content.type": "text",
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.1.message.role": "assistant",
				"llm.output_messages.1.message.tool_calls.0.tool_call.id": "123",
				"llm.output_messages.1.message.tool_calls.0.tool_call.function.name":
					"test_func",
				"llm.output_messages.1.message.tool_calls.0.tool_call.function.arguments":
					'{"arg": "value"}',
				"llm.token_count.completion": 500,
				"llm.token_count.completion_details.reasoning": 50,
				"llm.token_count.prompt": 1000,
				"llm.token_count.prompt_details.cache_read": 100,
				"llm.token_count.total": 1500,
				"llm.tools.0.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func1",
						description: "test1",
						parameters: { type: "object", properties: {} },
						strict: true,
					},
				}),
				"llm.tools.1.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func2",
						description: "test2",
						parameters: { type: "object", properties: {} },
						strict: true,
					},
				}),
			},
		],
	])(
		"%s",
		(
			_testName: string,
			response: Responses.Response,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromResponse(response);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromTools", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"function_tool",
			[
				{
					name: "test_func",
					description: "test",
					parameters: {},
					strict: true,
					type: "function",
				} as Responses.Tool,
			],
			{
				"llm.tools.0.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func",
						description: "test",
						parameters: {},
						strict: true,
					},
				}),
			},
		],
		[
			"function_tool_no_description",
			[
				{
					name: "test_func",
					parameters: {},
					strict: true,
					type: "function",
				} as Responses.Tool,
			],
			{
				"llm.tools.0.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func",
						description: undefined,
						parameters: {},
						strict: true,
					},
				}),
			},
		],
		["empty_tools", [], {}],
		["none_tools", null, {}],
		[
			"multiple_tools",
			[
				{
					name: "test_func1",
					description: "test1",
					parameters: {
						type: "object",
						properties: {},
					},
					strict: true,
					type: "function",
				} as Responses.Tool,
				{
					name: "test_func2",
					description: "test2",
					parameters: {
						type: "object",
						properties: {},
					},
					strict: true,
					type: "function",
				} as Responses.Tool,
			],
			{
				"llm.tools.0.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func1",
						description: "test1",
						parameters: {
							type: "object",
							properties: {},
						},
						strict: true,
					},
				}),
				"llm.tools.1.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func2",
						description: "test2",
						parameters: {
							type: "object",
							properties: {},
						},
						strict: true,
					},
				}),
			},
		],
		[
			"function_tool_with_complex_parameters",
			[
				{
					name: "test_func",
					description: "test",
					parameters: {
						type: "object",
						properties: {
							arg1: {
								type: "string",
								description: "First argument",
							},
							arg2: {
								type: "number",
								description: "Second argument",
							},
						},
						required: ["arg1"],
					},
					strict: true,
					type: "function",
				} as Responses.Tool,
			],
			{
				"llm.tools.0.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func",
						description: "test",
						parameters: {
							type: "object",
							properties: {
								arg1: {
									type: "string",
									description: "First argument",
								},
								arg2: {
									type: "number",
									description: "Second argument",
								},
							},
							required: ["arg1"],
						},
						strict: true,
					},
				}),
			},
		],
		[
			"function_tool_with_additional_properties",
			[
				{
					name: "test_func",
					description: "test",
					parameters: {
						type: "object",
						properties: {},
						additionalProperties: false,
					},
					strict: false,
					type: "function",
				} as Responses.Tool,
			],
			{
				"llm.tools.0.tool.json_schema": JSON.stringify({
					type: "function",
					function: {
						name: "test_func",
						description: "test",
						parameters: {
							type: "object",
							properties: {},
							additionalProperties: false,
						},
						strict: false,
					},
				}),
			},
		],
	])(
		"%s",
		(
			_testName: string,
			tools: Array<Responses.Tool> | null,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromTools(tools);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromResponseOutput", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"message_output",
			[
				{
					id: "msg-123",
					role: "assistant",
					content: [
						{
							type: "output_text",
							text: "Hi",
							annotations: [],
						},
					],
					status: "completed",
					type: "message",
				} as Responses.ResponseOutputMessage,
			],
			{
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.contents.0.message_content.type": "text",
				"llm.output_messages.0.message.contents.0.message_content.text": "Hi",
			},
		],
		[
			"function_call_output",
			[
				{
					type: "function_call",
					call_id: "123",
					name: "test_func",
					arguments: "{}",
				} as Responses.ResponseFunctionToolCall,
			],
			{
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.tool_calls.0.tool_call.id": "123",
				"llm.output_messages.0.message.tool_calls.0.tool_call.function.name":
					"test_func",
			},
		],
		[
			"multiple_outputs",
			[
				{
					id: "msg-123",
					role: "assistant",
					content: [
						{
							type: "output_text",
							text: "Hi",
							annotations: [],
						},
					],
					status: "completed",
					type: "message",
				} as Responses.ResponseOutputMessage,
				{
					type: "function_call",
					call_id: "123",
					name: "test_func",
					arguments: "{}",
				} as Responses.ResponseFunctionToolCall,
			],
			{
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.contents.0.message_content.type": "text",
				"llm.output_messages.0.message.contents.0.message_content.text": "Hi",
				"llm.output_messages.1.message.role": "assistant",
				"llm.output_messages.1.message.tool_calls.0.tool_call.id": "123",
				"llm.output_messages.1.message.tool_calls.0.tool_call.function.name":
					"test_func",
			},
		],
		[
			"multiple_function_calls",
			[
				{
					type: "function_call",
					call_id: "123",
					name: "test_func1",
					arguments: "{}",
				} as Responses.ResponseFunctionToolCall,
				{
					type: "function_call",
					call_id: "456",
					name: "test_func2",
					arguments: "{}",
				} as Responses.ResponseFunctionToolCall,
			],
			{
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.tool_calls.0.tool_call.id": "123",
				"llm.output_messages.0.message.tool_calls.0.tool_call.function.name":
					"test_func1",
				"llm.output_messages.0.message.tool_calls.1.tool_call.id": "456",
				"llm.output_messages.0.message.tool_calls.1.tool_call.function.name":
					"test_func2",
			},
		],
		[
			"multiple_messages",
			[
				{
					id: "msg-123",
					role: "assistant",
					content: [
						{
							type: "output_text",
							text: "Hi",
							annotations: [],
						},
					],
					status: "completed",
					type: "message",
				} as Responses.ResponseOutputMessage,
				{
					id: "msg-124",
					role: "assistant",
					content: [
						{
							type: "output_text",
							text: "World",
							annotations: [],
						},
					],
					status: "completed",
					type: "message",
				} as Responses.ResponseOutputMessage,
			],
			{
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.contents.0.message_content.type": "text",
				"llm.output_messages.0.message.contents.0.message_content.text": "Hi",
				"llm.output_messages.1.message.role": "assistant",
				"llm.output_messages.1.message.contents.0.message_content.type": "text",
				"llm.output_messages.1.message.contents.0.message_content.text":
					"World",
			},
		],
		["empty_output", [], {}],
	])(
		"%s",
		(
			_testName: string,
			responseOutput: Array<Responses.ResponseOutputItem>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator =
				processor.getAttributesFromResponseOutput(responseOutput);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});

describe("getAttributesFromInput", () => {
	const processor = new OpenAIAgentsProcessor();

	test.each([
		[
			"simple_message",
			[
				{
					role: "user",
					content: [{ type: "input_text", text: "Hello" }],
					type: "message",
				} as ResponseInputItem.Message,
			],
			{
				"llm.input_messages.1.message.contents.0.message_content.text": "Hello",
				"llm.input_messages.1.message.contents.0.message_content.type": "text",
				"llm.input_messages.1.message.role": "user",
			},
		],
		[
			"function_call",
			[
				{
					type: "function_call",
					call_id: "123",
					name: "test_func",
					arguments: "{}",
				} as Responses.ResponseFunctionToolCall,
			],
			{
				"llm.input_messages.1.message.role": "assistant",
				"llm.input_messages.1.message.tool_calls.0.tool_call.id": "123",
				"llm.input_messages.1.message.tool_calls.0.tool_call.function.name":
					"test_func",
			},
		],
		[
			"multiple_messages",
			[
				{
					role: "user",
					content: [
						{
							type: "input_text",
							text: "Hello",
						},
					],
					type: "message",
				} as ResponseInputItem.Message,
				{
					id: "msg-123",
					status: "completed",
					role: "assistant",
					content: [
						{
							type: "output_text",
							text: "Hi",
							annotations: [],
						},
					],
					type: "message",
				} as Responses.ResponseOutputMessage,
				{
					type: "function_call",
					call_id: "123",
					name: "test_func",
					arguments: "{}",
				} as Responses.ResponseFunctionToolCall,
			],
			{
				"llm.input_messages.1.message.contents.0.message_content.text": "Hello",
				"llm.input_messages.1.message.contents.0.message_content.type": "text",
				"llm.input_messages.1.message.role": "user",
				"llm.input_messages.2.message.contents.0.message_content.text": "Hi",
				"llm.input_messages.2.message.contents.0.message_content.type": "text",
				"llm.input_messages.2.message.role": "assistant",
				"llm.input_messages.3.message.tool_calls.0.tool_call.id": "123",
				"llm.input_messages.3.message.tool_calls.0.tool_call.function.name":
					"test_func",
				"llm.input_messages.3.message.role": "assistant",
			},
		],
		[
			"developer_message",
			[
				{
					role: "developer",
					content: [
						{
							type: "input_text",
							text: "Debug info",
						},
					],
					type: "message",
				} as ResponseInputItem.Message,
			],
			{
				"llm.input_messages.1.message.contents.0.message_content.text":
					"Debug info",
				"llm.input_messages.1.message.contents.0.message_content.type": "text",
				"llm.input_messages.1.message.role": "developer",
			},
		],
		// Skipping the TODO test cases as requested:
		// computer_tool_call, file_search_tool_call, web_search_tool_call,
		// reasoning_item, computer_call_output, item_reference
	])(
		"%s",
		(
			_testName: string,
			inputData: Array<ResponseInputItem>,
			expectedAttributes: Record<string, any>,
		) => {
			const generator = processor.getAttributesFromInput(inputData);
			const attributes = Object.fromEntries([...generator]);
			expect(attributes).toEqual(expectedAttributes);
		},
	);
});
