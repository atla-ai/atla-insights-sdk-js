/**
 * This example shows how to instrument a custom service with Atla Insights.
 */
import { diag, DiagConsoleLogger, DiagLogLevel, Span } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

import { configure, instrument, startAsCurrentSpan } from "@atla-ai/insights-sdk-js";

async function main(): Promise<void> {
    configure({
		token: process.env.ATLA_INSIGHTS_TOKEN as string,
		metadata: {
			project: "my-project",
			environment: "development",
			version: "1.0.0",
			user: "john_doe",
		},
	});

    const myInstrumentedFunction = instrument("My instrumented function")(
		async (): Promise<void> => {
			await startAsCurrentSpan("my-llm-generation", async (span: Span) => {
                span.recordGeneration({
                    inputMessages: [
                        { role: "system", content: "You are a helpful assistant." },
                        { role: "user", content: "What is the capital of France?" },
                    ],
                    outputMessages: [
                        { role: "assistant", content: "The capital of France is Paris." },
                    ],
                    tools: [
                        {
                            type: "function",
                            function: {
                                name: "get_capital",
                                parameters: {
                                    type: "object",
                                    properties: { country: { type: "string" } },
                                    required: ["country"],
                                },
                            },
                        },
                    ],
                });
            });
		},
	);

    await myInstrumentedFunction();
}

main().catch(console.error);
