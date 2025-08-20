import { describe, it, expect } from "@jest/globals";
import { instrumentLangChain } from "../../src/providers/langchain";
import { StateGraph, Annotation, END } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { tool } from "@langchain/core/tools";
import {
	OpenInferenceSpanKind,
	SemanticConventions,
} from "@arizeai/openinference-semantic-conventions";
import { realInMemorySpanExporter } from "../setup";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";

describe("langgraph", () => {
	// Import the mock helpers
	const {
		setOpenAIMockResponse,
		resetOpenAIMock,
	} = require("../__mocks__/openai");

	afterEach(() => {
		resetOpenAIMock();
	});

	it("instruments a simple LangGraph workflow", async () => {
		instrumentLangChain();

		const State = Annotation.Root({
			messages: Annotation<string[]>(),
		});

		const generate_message = async (state: { messages: string[] }) => {
			const chat = new ChatOpenAI({
				apiKey: "unit-test",
				model: "gpt-4o-mini",
			});

			const result = await chat.invoke([
				{ role: "user", content: "Hello, world!" },
			]);

			return {
				messages: [...state.messages, result.content as string],
			};
		};

		const graph = new StateGraph(State)
			.addNode("generate", generate_message)
			.addEdge("__start__", "generate")
			.addEdge("generate", END)
			.compile();

		await graph.invoke({ messages: [] });
		const finishedSpans = realInMemorySpanExporter.getFinishedSpans();

		const llmSpans = finishedSpans.filter(
			(span) =>
				span.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] ===
				OpenInferenceSpanKind.LLM,
		);
		expect(llmSpans.length).toBe(1);

		const span = llmSpans[0];
		expect(span.name).toBe("ChatOpenAI");
		expect(span.attributes).toEqual(
			expect.objectContaining({
				[SemanticConventions.OPENINFERENCE_SPAN_KIND]:
					OpenInferenceSpanKind.LLM,
				"llm.input_messages.0.message.role": "user",
				"llm.input_messages.0.message.content": "Hello, world!",
				"llm.output_messages.0.message.role": "assistant",
				"llm.output_messages.0.message.content": "This is a test.",
				[SemanticConventions.LLM_MODEL_NAME]: "gpt-4o-mini",
			}),
		);
	});

	it("instruments a react agent with a tool", async () => {
		// Set up mock to return tool calls when it sees weather queries
		setOpenAIMockResponse((args: any) => {
			if (
				args?.tools &&
				args.messages?.some(
					(m: any) =>
						m.content?.toLowerCase().includes("weather") ||
						m.content?.toLowerCase().includes("sf"),
				)
			) {
				return {
					id: "chatcmpl_test",
					object: "chat.completion",
					created: Date.now(),
					model: "gpt-4o-mini",
					choices: [
						{
							index: 0,
							message: {
								role: "assistant",
								content: null,
								tool_calls: [
									{
										id: "call_test123",
										type: "function",
										function: {
											name: "search",
											arguments: JSON.stringify({ query: "weather in sf" }),
										},
									},
								],
							},
							finish_reason: "tool_calls",
						},
					],
					usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
				};
			}

			// Default response for non-tool calls
			return {
				id: "chatcmpl_test",
				object: "chat.completion",
				created: Date.now(),
				model: "gpt-4o-mini",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "This is a test." },
						finish_reason: "stop",
					},
				],
				usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
			};
		});

		instrumentLangChain();

		const search = tool(
			async (input) => {
				const { query } = input as { query: string };
				if (
					query.toLowerCase().includes("sf") ||
					query.toLowerCase().includes("san francisco")
				) {
					return "It's 60 degrees and foggy.";
				}
				return "It's 90 degrees and sunny.";
			},
			{
				name: "search",
				description: "Call to surf the web.",
				schema: z.object({
					query: z.string().describe("The query to use in your search."),
				}),
			},
		);

		const model = new ChatOpenAI({ apiKey: "unit-test", model: "gpt-4o-mini" });
		const agent = createReactAgent({ llm: model, tools: [search] });

		await agent.invoke({
			messages: [{ role: "user", content: "what is the weather in sf" }],
		});

		const spans = realInMemorySpanExporter.getFinishedSpans();
		expect(spans).toBeDefined();

		const llm = spans.find(
			(s) =>
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] ===
					OpenInferenceSpanKind.LLM && s.name === "ChatOpenAI",
		);
		expect(llm?.attributes).toEqual(
			expect.objectContaining({
				[SemanticConventions.OPENINFERENCE_SPAN_KIND]:
					OpenInferenceSpanKind.LLM,
				"llm.input_messages.0.message.role": "user",
				[SemanticConventions.LLM_MODEL_NAME]: "gpt-4o-mini",
			}),
		);

		const toolSpans = spans.filter(
			(s) =>
				s.attributes[SemanticConventions.OPENINFERENCE_SPAN_KIND] ===
				OpenInferenceSpanKind.TOOL,
		);
		expect(toolSpans.length).toBe(1);

		const toolSpan = toolSpans[0];
		expect(toolSpan.name).toBe("search");
		expect(toolSpan.attributes).toEqual(
			expect.objectContaining({
				[SemanticConventions.OPENINFERENCE_SPAN_KIND]:
					OpenInferenceSpanKind.TOOL,
				[SemanticConventions.TOOL_NAME]: "search",
			}),
		);
	});
});
