import {
	addTraceProcessor,
	getGlobalTraceProvider,
	setTracingDisabled,
} from "@openai/agents";
import type { Span, Trace, TracingProcessor } from "@openai/agents";
import type { Responses } from "openai/resources/responses";
import type { ResponseInputItem } from "openai/resources/responses/responses";
import type {
	Span as OtelSpan,
	Context,
	SpanStatus,
	AttributeValue,
} from "@opentelemetry/api";
import { trace, context, SpanStatusCode } from "@opentelemetry/api";
import {
	LLMSystem,
	OpenInferenceSpanKind,
	SemanticAttributePrefixes,
	OUTPUT_MIME_TYPE,
	MimeType,
	SemanticConventions,
	OUTPUT_VALUE,
	INPUT_VALUE,
	GRAPH_NODE_ID,
	GRAPH_NODE_PARENT_ID,
	MESSAGE_ROLE,
	MESSAGE_CONTENT,
	MESSAGE_CONTENT_TYPE,
	MESSAGE_CONTENT_TEXT,
	TOOL_CALL_ID,
	TOOL_CALL_FUNCTION_NAME,
	TOOL_CALL_FUNCTION_ARGUMENTS_JSON,
	TOOL_DESCRIPTION,
	TOOL_PARAMETERS,
	MESSAGE_CONTENTS,
	MESSAGE_TOOL_CALL_ID,
	LLM_MODEL_NAME,
	LLM_INVOCATION_PARAMETERS,
	LLM_PROVIDER,
	LLMProvider,
	INPUT_MIME_TYPE,
	LLM_INPUT_MESSAGES,
	LLM_OUTPUT_MESSAGES,
	MESSAGE_TOOL_CALLS,
	LLM_TOKEN_COUNT_PROMPT,
	LLM_TOKEN_COUNT_COMPLETION,
	LLM_TOKEN_COUNT_TOTAL,
	LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ,
	LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING,
	LLMAttributePostfixes,
	TOOL_NAME,
	LLM_TOOLS,
	TOOL_JSON_SCHEMA,
} from "@arizeai/openinference-semantic-conventions";
import { safeSerialize } from "./utils";
import { getAtlaContext } from "../../context";
import { ATLA_INSIGHTS } from "../../main";

/**
 * Instrument the OpenAI Agents SDK.
 *
 * This function enables tracing for all OpenAI Agents SDK API calls made through
 * the official OpenAI Agents SDK client.
 *
 * @example
 * ```typescript
 * import { configure, instrumentOpenAIAgents } from "@atla-ai/insights-sdk-js";
 *
 * // Configure Atla Insights first
 * configure({ token: process.env.ATLA_API_KEY! });
 *
 * // Enable OpenAI Agents instrumentation
 * instrumentOpenAIAgents();
 *
 * // Use OpenAI Agents as normal - it will be automatically traced
 * ```
 *
 * @returns void
 */
export function instrumentOpenAIAgents(): void {
	const ctx = getAtlaContext();
	if (ctx?.suppressInstrumentation) {
		return;
	}

	if (!ATLA_INSIGHTS.configured) {
		throw new Error(
			"Atla Insights must be configured before instrumenting OpenAI Agents. Please call configure first.",
		);
	}

	setTracingDisabled(false);

	const processor = new OpenAIAgentsProcessor();

	try {
		addTraceProcessor(processor);
	} catch {
		const provider = getGlobalTraceProvider();
		if (typeof provider.registerProcessor === "function") {
			provider.registerProcessor(processor);
		} else {
			throw new Error(
				"Could not register trace processor with OpenAI Agents SDK",
			);
		}
	}
}

export class OpenAIAgentsProcessor implements TracingProcessor {
	private tracer = trace.getTracer("openinference.instrumentation.openai");
	private rootSpans = new Map<string, OtelSpan>();
	private spanMap = new Map<string, OtelSpan>();
	private tokens = new Map<string, Context>();
	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	private toolCache = new Map<string, Record<string, any>>();

	private MAX_HANDOFFS_IN_FLIGHT = 1000;

	/**
	 * This captures the in flight handoff. Once a handoff is complete the entry is removed.
	 * If the handoff is not complete, the entry stays in the map.
	 * Use a Map top keep the order and MAX_HANDOFFS_IN_FLIGHT to cap the size,
	 * in the case there are large numbers or orphaned handoffs.
	 */
	private reverseHandoffsMap = new Map<string, string>();

	/**
	 * Type guard for variants that carry tool results as
	 * { type: 'function_call_result', callId?: string, output?: any }.
	 */
	private isFunctionCallResult(
		item: unknown,
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
	): item is { type: string; callId?: string; output?: any } {
		return (
			!!item &&
			typeof item === "object" &&
			// biome-ignore lint/suspicious/noExplicitAny: Allow any
			(item as any).type === "function_call_result"
		);
	}

	/**
	 * Called when a trace is started.
	 *
	 * @param trace - The trace that has started.
	 */
	async onTraceStart(trace: Trace): Promise<void> {
		const span = this.tracer.startSpan(trace.name, {
			attributes: {
				[SemanticConventions.OPENINFERENCE_SPAN_KIND]:
					OpenInferenceSpanKind.AGENT,
			},
		});
		this.rootSpans.set(trace.traceId, span);
	}

	/**
	 * Called when a trace is ended.
	 *
	 * @param trace - The trace that has ended.
	 */
	async onTraceEnd(trace: Trace): Promise<void> {
		if (this.rootSpans.has(trace.traceId)) {
			const span = this.rootSpans.get(trace.traceId) as OtelSpan;
			span.setStatus({ code: SpanStatusCode.OK });
			span.end();
		}

		// Clean up the tool cache
		this.toolCache.delete(trace.traceId);
	}

	/**
	 * Called when a span is started.
	 *
	 * @param span - The span that has started.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	async onSpanStart(span: Span<any>): Promise<void> {
		if (span.startedAt === null) {
			return;
		}

		const startTime = new Date(span.startedAt);
		const parentSpan = span.parentId
			? this.spanMap.get(span.parentId)
			: this.rootSpans.get(span.traceId);

		const _context = parentSpan
			? trace.setSpan(context.active(), parentSpan)
			: context.active();

		const spanName = this.getSpanName(span);

		const otelSpan = this.tracer.startSpan(
			spanName,
			{
				attributes: {
					[SemanticConventions.OPENINFERENCE_SPAN_KIND]: this.getSpanKind(span),
					[SemanticConventions.LLM_SYSTEM]: LLMSystem.OPENAI,
				},
				startTime: startTime.getTime(),
			},
			_context,
		);

		this.spanMap.set(span.spanId, otelSpan);

		const spanContext = trace.setSpan(_context, otelSpan);
		this.tokens.set(span.spanId, spanContext);
	}

	/**
	 * Called when a span is ended.
	 * Should not block or raise exceptions.
	 *
	 * @param span - The span that has ended.
	 */
	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	async onSpanEnd(span: Span<any>): Promise<void> {
		if (this.tokens.has(span.spanId)) {
			trace.deleteSpan(this.tokens.get(span.spanId) as Context);
		}
		if (!this.spanMap.has(span.spanId)) {
			return;
		}

		const otelSpan = this.spanMap.get(span.spanId) as OtelSpan;
		otelSpan.updateName(this.getSpanName(span));
		const data = span.spanData;
		const traceId = span.traceId;

		if (data.type === "response") {
			if ("_response" in data) {
				otelSpan.setAttribute(OUTPUT_MIME_TYPE, MimeType.JSON);
				otelSpan.setAttribute(OUTPUT_VALUE, JSON.stringify(data._response));
				const responseAttributes = this.getAttributesFromResponse(
					data._response,
					traceId,
				);
				for (const [key, value] of responseAttributes) {
					otelSpan.setAttribute(key, value);
				}
			}
			if ("_input" in data) {
				const input = data._input;
				if (typeof input === "string") {
					otelSpan.setAttribute(INPUT_VALUE, input);
				}
				if (Array.isArray(input)) {
					otelSpan.setAttribute(INPUT_VALUE, MimeType.JSON);
					otelSpan.setAttribute(INPUT_VALUE, JSON.stringify(input));
					const inputAttributes = this.getAttributesFromInput(input, traceId);
					for (const [key, value] of inputAttributes) {
						otelSpan.setAttribute(key, value);
					}
				}
			}
		} else if (data.type === "generation") {
			const generationAttributes =
				this.getAttributesFromGenerationSpanData(data);
			for (const [key, value] of generationAttributes) {
				otelSpan.setAttribute(key, value);
			}
		} else if (data.type === "function") {
			const functionAttributes = this.getAttributesFromFunctionSpanData(
				data,
				traceId,
			);
			for (const [key, value] of functionAttributes) {
				otelSpan.setAttribute(key, value);
			}
		} else if (data.type === "mcp_tools") {
			const mcpToolsAttributes =
				this.getAttributesFromMCPListToolSpanData(data);
			for (const [key, value] of mcpToolsAttributes) {
				otelSpan.setAttribute(key, value);
			}
		} else if (data.type === "handoff") {
			if ("to_agent" in data && "from_agent" in data) {
				const key = `${data.to_agent}:${span.traceId}`;
				this.reverseHandoffsMap.set(key, data.from_agent);
				// Cap the size of the map
				while (this.reverseHandoffsMap.size > this.MAX_HANDOFFS_IN_FLIGHT) {
					const firstKey = this.reverseHandoffsMap.keys().next().value;
					if (firstKey !== undefined) {
						this.reverseHandoffsMap.delete(firstKey);
					} else {
						break;
					}
				}
			}
		} else if (data.type === "agent") {
			otelSpan.setAttribute(GRAPH_NODE_ID, data.name);
			// Lookup the parent node if exists
			const key = `${data.name}:${span.traceId}`;
			const parentNode = this.reverseHandoffsMap.get(key);
			if (parentNode) {
				otelSpan.setAttribute(GRAPH_NODE_PARENT_ID, parentNode);
			}
		}

		let endTime: number | undefined;
		if (span.endedAt) {
			try {
				endTime = new Date(span.endedAt).getTime();
			} catch {
				// pass
			}
		}

		otelSpan.setStatus(this.getSpanStatus(span));
		otelSpan.end(endTime);
	}

	/**
	 * Forces an immediate flush of all queued spans/traces.
	 */
	async forceFlush(): Promise<void> {
		// pass
	}

	/**
	 * Called when the application stops.
	 */
	async shutdown(): Promise<void> {
		// pass
	}

	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	private getSpanName(span: Span<any>): string {
		if ("name" in span.spanData && typeof span.spanData.name === "string") {
			return span.spanData.name;
		}
		if (span.spanData.type === "handoff" && "to_agent" in span.spanData) {
			return `Handoff to ${span.spanData.to_agent}`;
		}
		return span.spanData.type;
	}

	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	private getSpanKind(span: Span<any>): string {
		switch (span.spanData.type) {
			case "agent":
				return OpenInferenceSpanKind.AGENT;
			case "function":
				return OpenInferenceSpanKind.TOOL;
			case "generation":
				return OpenInferenceSpanKind.LLM;
			case "response":
				return OpenInferenceSpanKind.LLM;
			case "handoff":
				return OpenInferenceSpanKind.TOOL;
			case "custom":
				return OpenInferenceSpanKind.CHAIN;
			case "guardrail":
				return OpenInferenceSpanKind.CHAIN;
			default:
				return OpenInferenceSpanKind.CHAIN;
		}
	}

	// biome-ignore lint/suspicious/noExplicitAny: Allow any
	private getSpanStatus(span: Span<any>): SpanStatus {
		if (span.error !== null) {
			return {
				code: SpanStatusCode.ERROR,
				message: `${span.error.message}: ${span.error.data ? JSON.stringify(span.error.data) : ""}`,
			};
		}
		return {
			code: SpanStatusCode.OK,
		};
	}

	public *getAttributesFromInput(
		obj: Array<ResponseInputItem>,
		traceId?: string,
		message_index: number = 1,
	): Generator<[string, AttributeValue]> {
		let i = message_index;
		for (const item of obj) {
			const prefix = `${LLM_INPUT_MESSAGES}.${i}.`;
			if (!("type" in item)) {
				if ("role" in item && "content" in item) {
					yield* this.getAttributesFromMessageParam(
						{
							type: "message",
							role: item.role,
							content: item.content,
						},
						prefix,
					);
				}
			} else if (item.type === "message") {
				yield* this.getAttributesFromMessageParam(item, prefix);
			} else if (item.type === "file_search_call") {
				// TODO
			} else if (item.type === "computer_call") {
				// TODO
			} else if (item.type === "computer_call_output") {
				// TODO
			} else if (item.type === "web_search_call") {
				// TODO
			} else if (item.type === "function_call") {
				yield [`${prefix}${MESSAGE_ROLE}`, "assistant"];
				yield* this.getAttributesFromFunctionToolCall(
					item,
					traceId,
					`${prefix}${MESSAGE_TOOL_CALLS}.0.`,
				);
			} else if (item.type === "function_call_output") {
				yield* this.getAttributesFromFunctionCallOutput(item, prefix);
			} else if (this.isFunctionCallResult(item)) {
				// Normalize function_call_result (with nested output object) into a tool message
				yield [`${prefix}${MESSAGE_ROLE}`, SemanticAttributePrefixes.tool];
				if (item.callId && typeof item.callId === "string") {
					yield [
						`${prefix}${MESSAGE_TOOL_CALL_ID}`,
						item.callId as AttributeValue,
					];
				}
				// biome-ignore lint/suspicious/noExplicitAny: Allow any
				const output: any = item.output;
				if (typeof output === "string") {
					yield [`${prefix}${MESSAGE_CONTENT}`, output];
				} else if (output && typeof output === "object") {
					// biome-ignore lint/suspicious/noExplicitAny: Allow any
					if (typeof (output as any).text === "string") {
						// biome-ignore lint/suspicious/noExplicitAny: Allow any
						yield [`${prefix}${MESSAGE_CONTENT}`, (output as any).text];
					} else {
						yield [`${prefix}${MESSAGE_CONTENT}`, safeSerialize(output)];
					}
				}
			} else if (item.type === "custom_tool_call") {
				yield [`${prefix}${MESSAGE_ROLE}`, "assistant"];
				yield* this.getAttributesFromResponseCustomToolCall(
					item,
					`${prefix}${MESSAGE_TOOL_CALLS}.0.`,
				);
			} else if (item.type === "custom_tool_call_output") {
				yield* this.getAttributesFromResponseCustomToolCallOutputParam(
					item,
					prefix,
				);
			} else if (item.type === "item_reference") {
				// TODO
			} else if (item.type === "reasoning") {
				// TODO
			} else if (item.type === "image_generation_call") {
				// TODO
			} else if (item.type === "local_shell_call") {
				// TODO
			} else if (item.type === "local_shell_call_output") {
				// TODO
			} else if (item.type === "mcp_call") {
				// TODO
			} else if (item.type === "mcp_list_tools") {
				// TODO
			} else if (item.type === "mcp_approval_request") {
				// TODO
			} else if (item.type === "mcp_approval_response") {
				// TODO
			}
			i++;
		}
	}

	public *getAttributesFromMessageParam(
		obj:
			| Responses.EasyInputMessage
			| ResponseInputItem.Message
			| Responses.ResponseOutputMessage,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		yield [`${prefix}${MESSAGE_ROLE}`, obj.role as AttributeValue];
		if ("content" in obj) {
			if (typeof obj.content === "string") {
				yield [`${prefix}${MESSAGE_CONTENT}`, obj.content];
			} else if (Array.isArray(obj.content)) {
				yield* this.getAttributesFromMessageContentList(obj.content, prefix);
			}
		}
	}

	public *getAttributesFromFunctionToolCall(
		obj: Responses.ResponseFunctionToolCall,
		traceId?: string,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		yield [`${prefix}${TOOL_CALL_ID}`, obj.call_id];
		yield [`${prefix}${TOOL_CALL_FUNCTION_NAME}`, obj.name];
		if (obj.arguments !== "{}") {
			yield [`${prefix}${TOOL_CALL_FUNCTION_ARGUMENTS_JSON}`, obj.arguments];
		}
		if (traceId && this.toolCache.has(traceId)) {
			const tool: Responses.FunctionTool | Responses.CustomTool =
				this.toolCache.get(traceId)?.[obj.name];
			if (tool) {
				yield [`${prefix}${TOOL_DESCRIPTION}`, tool.description ?? ""];
				if ("parameters" in tool && tool.parameters !== undefined) {
					yield [`${prefix}${TOOL_PARAMETERS}`, safeSerialize(tool.parameters)];
				}
			}
		}
	}

	public *getAttributesFromFunctionSpanData(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Record<string, any>,
		traceId?: string,
	): Generator<[string, AttributeValue]> {
		if (traceId && this.toolCache.has(traceId)) {
			const tool: Responses.FunctionTool | Responses.CustomTool =
				this.toolCache.get(traceId)?.[obj.name];
			if (tool) {
				yield [TOOL_NAME, tool.name];
				yield [TOOL_DESCRIPTION, tool.description ?? ""];
				if ("parameters" in tool && tool.parameters !== undefined) {
					yield [TOOL_PARAMETERS, safeSerialize(tool.parameters)];
				}
			}
		}
		yield [TOOL_NAME, obj.name];
		if (obj.input) {
			yield [INPUT_VALUE, obj.input];
			yield [INPUT_MIME_TYPE, MimeType.JSON];
		}
		if (obj.output !== null && obj.output !== undefined) {
			const outputValue = this.convertToPrimitive(obj.output);
			yield [
				OUTPUT_VALUE,
				outputValue instanceof Uint8Array
					? outputValue.toString()
					: outputValue,
			];
			if (
				typeof obj.output === "string" &&
				obj.output.length > 1 &&
				obj.output.startsWith("{") &&
				obj.output.endsWith("}")
			) {
				yield [OUTPUT_MIME_TYPE, MimeType.JSON];
			}
		}
	}

	public *getAttributesFromResponse(
		obj: Responses.Response,
		traceId?: string,
	): Generator<[string, AttributeValue]> {
		yield* this.getAttributesFromTools(obj.tools);

		// Cache the tools for the trace
		if (traceId) {
			const existing = this.toolCache.get(traceId) ?? {};
			for (const tool of obj.tools) {
				if ("name" in tool) {
					existing[tool.name] = tool;
				}
			}
			this.toolCache.set(traceId, existing);
		}

		yield* this.getAttributesFromUsage(obj.usage ?? null);
		yield* this.getAttributesFromResponseOutput(obj.output, traceId);

		if (typeof obj.instructions === "string") {
			yield* this.getAttributesFromResponseInstruction(obj.instructions);
		}

		yield [LLM_MODEL_NAME, obj.model];
		// biome-ignore lint/correctness/noUnusedVariables: Allow unused variables
		const { object, tools, usage, output, error, status, ...parameters } = obj;
		const filteredParameters = Object.fromEntries(
			Object.entries(parameters).filter(([_, v]) => {
				if (v === null || v === undefined) return false;
				if (typeof v === "string" && v.trim() === "") return false;
				if (
					typeof v === "object" &&
					!Array.isArray(v) &&
					Object.keys(v).length === 0
				)
					return false;
				return true;
			}),
		);
		if (Object.keys(filteredParameters).length > 0) {
			yield [LLM_INVOCATION_PARAMETERS, safeSerialize(filteredParameters)];
		}
	}

	public *getAttributesFromResponseOutput(
		obj: Array<Responses.ResponseOutputItem>,
		traceId?: string,
		message_index: number = 0,
	): Generator<[string, AttributeValue]> {
		let toolCallIndex = 0;
		for (const [_, item] of obj.entries()) {
			if (item.type === "message") {
				const prefix = `${LLM_OUTPUT_MESSAGES}.${message_index}.`;
				yield* this.getAttributesFromMessage(item, prefix);
				message_index++;
			} else if (item.type === "function_call") {
				yield [
					`${LLM_OUTPUT_MESSAGES}.${message_index}.${MESSAGE_ROLE}`,
					"assistant",
				];
				const prefix = `${LLM_OUTPUT_MESSAGES}.${message_index}.${MESSAGE_TOOL_CALLS}.${toolCallIndex}.`;
				yield* this.getAttributesFromFunctionToolCall(item, traceId, prefix);
				toolCallIndex++;
			} else if (item.type === "custom_tool_call") {
				const prefix = `${LLM_OUTPUT_MESSAGES}.${message_index}.`;
				yield [`${prefix}${MESSAGE_ROLE}`, "assistant"];
				yield* this.getAttributesFromResponseCustomToolCall(
					item,
					`${prefix}${MESSAGE_TOOL_CALLS}.0.`,
				);
			} else if (item.type === "file_search_call") {
				// TODO
			} else if (item.type === "web_search_call") {
				// TODO
			} else if (item.type === "code_interpreter_call") {
				// TODO
			} else if (item.type === "image_generation_call") {
				// TODO
			} else if (item.type === "local_shell_call") {
				// TODO
			} else if (item.type === "mcp_call") {
				// TODO
			} else if (item.type === "mcp_list_tools") {
				// TODO
			} else if (item.type === "mcp_approval_request") {
				// TODO
			} else if (item.type === "reasoning") {
				// TODO
			} else if (item.type === "computer_call") {
				// TODO
			}
		}
	}

	public *getAttributesFromTools(
		tools: Array<Responses.Tool> | null,
	): Generator<[string, AttributeValue]> {
		if (tools === null || tools.length === 0) {
			return;
		}
		for (const [index, tool] of tools.entries()) {
			if (tool.type === "function") {
				yield [
					`${LLM_TOOLS}.${index}.${TOOL_JSON_SCHEMA}`,
					safeSerialize({
						type: "function",
						function: {
							name: tool.name,
							...(tool.description ? { description: tool.description } : {}),
							parameters: tool.parameters,
							strict: tool.strict,
						},
					}),
				];
			}
		}
	}

	public *getAttributesFromResponseInstruction(
		instructions: string | null,
	): Generator<[string, AttributeValue]> {
		if (instructions === null || instructions === "") {
			return;
		}
		yield [
			`${LLM_INPUT_MESSAGES}.0.${MESSAGE_ROLE}`,
			LLMAttributePostfixes.system,
		];
		yield [`${LLM_INPUT_MESSAGES}.0.${MESSAGE_CONTENT}`, instructions];
	}

	public *getAttributesFromResponseCustomToolCall(
		obj: Responses.ResponseCustomToolCall,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		if (obj.call_id) {
			yield [`${prefix}${TOOL_CALL_ID}`, obj.call_id];
		}
		if (obj.name) {
			yield [`${prefix}${TOOL_CALL_FUNCTION_NAME}`, obj.name];
		}
		if (obj.input) {
			yield [
				`${prefix}${TOOL_CALL_FUNCTION_ARGUMENTS_JSON}`,
				safeSerialize({
					input: obj.input,
				}),
			];
		}
	}

	public *getAttributesFromMCPListToolSpanData(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Record<string, any>,
	): Generator<[string, AttributeValue]> {
		yield [OUTPUT_VALUE, safeSerialize(obj.result)];
		yield [OUTPUT_MIME_TYPE, MimeType.JSON];
	}

	public *getAttributesFromResponseCustomToolCallOutputParam(
		obj: Responses.ResponseCustomToolCallOutput,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		yield [`${prefix}${MESSAGE_ROLE}`, SemanticAttributePrefixes.tool];
		if (obj.call_id) {
			yield [`${prefix}${MESSAGE_TOOL_CALL_ID}`, obj.call_id];
		}
		if (obj.output) {
			yield [`${prefix}${MESSAGE_CONTENT}`, obj.output];
		}
	}

	public *getAttributesFromFunctionCallOutput(
		obj: ResponseInputItem.FunctionCallOutput,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		yield [`${prefix}${MESSAGE_ROLE}`, SemanticAttributePrefixes.tool];
		yield [`${prefix}${MESSAGE_TOOL_CALL_ID}`, obj.call_id];
		yield [`${prefix}${MESSAGE_CONTENT}`, obj.output];
	}

	public *getAttributesFromGenerationSpanData(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Record<string, any>,
	): Generator<[string, AttributeValue]> {
		if ("model" in obj && typeof obj.model === "string") {
			yield [LLM_MODEL_NAME, obj.model];
		}
		if (
			"model_config" in obj &&
			typeof obj.model_config === "object" &&
			obj.model_config !== null
		) {
			const params = Object.fromEntries(
				Object.entries(obj.model_config).filter(
					([_, v]) => v !== null && v !== undefined,
				),
			);
			if (Object.keys(params).length > 0) {
				yield [LLM_INVOCATION_PARAMETERS, safeSerialize(params)];
				if ("base_url" in params) {
					if (typeof params.base_url === "string") {
						if (params.base_url.includes("api.openai.com")) {
							yield [LLM_PROVIDER, LLMProvider.OPENAI];
						}
					}
				}
			}
		}

		yield* this.getAttributesFromChatCompletionsInput(obj.input ?? null);
		yield* this.getAttributesFromChatCompletionsOutput(obj.output ?? null);
		yield* this.getAttributesFromChatCompletionsUsage(obj.usage ?? null);
	}

	public *getAttributesFromChatCompletionsInput(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Array<Record<string, any>> | null,
	): Generator<[string, AttributeValue]> {
		if (obj === null || obj.length === 0) {
			return;
		}
		try {
			yield [INPUT_VALUE, safeSerialize(obj)];
			yield [INPUT_MIME_TYPE, MimeType.JSON];
		} catch {
			// Pass
		}

		yield* this.getAttributesFromChatCompletionsMessageDicts(
			obj,
			`${LLM_INPUT_MESSAGES}.`,
		);
	}

	public *getAttributesFromChatCompletionsOutput(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Array<Record<string, any>> | null,
	): Generator<[string, AttributeValue]> {
		if (obj === null || obj.length === 0) {
			return;
		}
		try {
			yield [OUTPUT_VALUE, safeSerialize(obj)];
			yield [OUTPUT_MIME_TYPE, MimeType.JSON];
		} catch {
			// Pass
		}

		yield* this.getAttributesFromChatCompletionsMessageDicts(
			obj,
			`${LLM_OUTPUT_MESSAGES}.`,
		);
	}

	public *getAttributesFromChatCompletionsMessageDicts(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Array<Record<string, any>>,
		prefix: string = "",
		message_index: number = 0,
		tool_call_index: number = 0,
	): Generator<[string, AttributeValue]> {
		for (const message of obj) {
			if ("role" in message && typeof message.role === "string") {
				yield [`${prefix}${message_index}.${MESSAGE_ROLE}`, message.role];
			}
			if ("content" in message && typeof message.content === "string") {
				yield* this.getAttributesFromChatCompletionsMessageContent(
					message.content,
					`${prefix}${message_index}.`,
				);
			}
			if (
				"tool_call_id" in message &&
				typeof message.tool_call_id === "string"
			) {
				yield [
					`${prefix}${message_index}.${MESSAGE_TOOL_CALL_ID}`,
					message.tool_call_id,
				];
			}
			if ("tool_calls" in message && Array.isArray(message.tool_calls)) {
				for (const tool_call of message.tool_calls) {
					yield* this.getAttributesFromChatCompletionsToolCallDict(
						tool_call,
						`${prefix}${message_index}.${MESSAGE_TOOL_CALLS}.${tool_call_index}.`,
					);
					tool_call_index++;
				}
			}

			message_index++;
		}
	}

	public *getAttributesFromChatCompletionsMessageContent(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: string | Array<Record<string, any>> | null,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		if (obj === null) {
			return;
		}
		if (typeof obj === "string") {
			yield [`${prefix}${MESSAGE_CONTENT}`, obj];
		} else if (Array.isArray(obj)) {
			for (const [index, item] of obj.entries()) {
				if (typeof item !== "object") {
					continue;
				}
				yield* this.getAttributesFromChatCompletionsMessageContentItem(
					item,
					`${prefix}${MESSAGE_CONTENTS}.${index}.`,
				);
			}
		}
	}

	public *getAttributesFromChatCompletionsMessageContentItem(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Record<string, any>,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		if (obj.type && obj.text !== null && obj.text !== undefined) {
			yield [`${prefix}message_content.type`, obj.type];
			yield [`${prefix}message_content.text`, obj.text];
		}
	}

	public *getAttributesFromChatCompletionsToolCallDict(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Record<string, any>,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		if ("id" in obj) {
			yield [`${prefix}${TOOL_CALL_ID}`, obj.id];
		}
		if ("function" in obj) {
			if ("name" in obj.function) {
				yield [`${prefix}${TOOL_CALL_FUNCTION_NAME}`, obj.function.name];
			}
			if ("arguments" in obj.function) {
				if (obj.function.arguments !== "{}") {
					yield [
						`${prefix}${TOOL_CALL_FUNCTION_ARGUMENTS_JSON}`,
						obj.function.arguments,
					];
				}
			}
		}
	}

	public *getAttributesFromUsage(
		obj: Responses.ResponseUsage | null,
	): Generator<[string, AttributeValue]> {
		if (obj === null) {
			return;
		}
		yield [LLM_TOKEN_COUNT_COMPLETION, obj.output_tokens];
		yield [LLM_TOKEN_COUNT_PROMPT, obj.input_tokens];
		yield [LLM_TOKEN_COUNT_TOTAL, obj.total_tokens];
		yield [
			LLM_TOKEN_COUNT_PROMPT_DETAILS_CACHE_READ,
			obj.input_tokens_details.cached_tokens,
		];
		yield [
			LLM_TOKEN_COUNT_COMPLETION_DETAILS_REASONING,
			obj.output_tokens_details.reasoning_tokens,
		];
	}

	public *getAttributesFromMessage(
		obj: Responses.ResponseOutputMessage,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		yield [`${prefix}${MESSAGE_ROLE}`, obj.role];
		for (const [index, item] of obj.content.entries()) {
			if (item.type === "output_text") {
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TYPE}`,
					"text",
				];
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TEXT}`,
					item.text,
				];
			} else if (item.type === "refusal") {
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TYPE}`,
					"text",
				];
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TEXT}`,
					item.refusal,
				];
			}
		}
	}

	public *getAttributesFromChatCompletionsUsage(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		obj: Record<string, any> | null,
	): Generator<[string, AttributeValue]> {
		if (obj === null) {
			return;
		}
		if ("input_tokens" in obj && obj.input_tokens > 0) {
			yield [LLM_TOKEN_COUNT_PROMPT, obj.input_tokens];
		}
		if ("output_tokens" in obj && obj.output_tokens > 0) {
			yield [LLM_TOKEN_COUNT_COMPLETION, obj.output_tokens];
		}
	}

	public *getAttributesFromMessageContentList(
		obj: Iterable<Responses.ResponseInputContent | Responses.ResponseContent>,
		prefix: string = "",
	): Generator<[string, AttributeValue]> {
		let index = 0;
		for (const item of obj) {
			if (item.type === "input_text" || item.type === "output_text") {
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TYPE}`,
					"text",
				];
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TEXT}`,
					item.text,
				];
			} else if (item.type === "input_image") {
				// Pass
			} else if (item.type === "input_file") {
				// Pass
			} else if (item.type === "refusal") {
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TYPE}`,
					"refusal",
				];
				yield [
					`${prefix}${MESSAGE_CONTENTS}.${index}.${MESSAGE_CONTENT_TEXT}`,
					item.refusal,
				];
			}
			index++;
		}
	}

	/**
	 * Convert object, tuple, etc to a primitive value.
	 *
	 * @param value - The value to convert.
	 * @returns The converted value.
	 */
	private convertToPrimitive(
		// biome-ignore lint/suspicious/noExplicitAny: Allow any
		value: any,
	): boolean | string | number | Uint8Array {
		if (
			typeof value === "boolean" ||
			typeof value === "string" ||
			typeof value === "number"
		) {
			return value;
		}

		if (value instanceof Uint8Array || value instanceof Buffer) {
			return value;
		}

		if (
			Array.isArray(value) ||
			(typeof value === "object" &&
				value !== null &&
				value.constructor === Object)
		) {
			return safeSerialize(value);
		}

		return String(value);
	}
}
