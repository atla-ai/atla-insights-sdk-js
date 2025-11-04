/**
 * Experiments example.
 *
 * This example demonstrates how to use experiments to group related traces
 * for comparative analysis in the Atla Insights workbench.
 */
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

import {
	configure,
	instrument,
	instrumentOpenAI,
	runExperiment,
} from "@atla-ai/insights-sdk-js";

async function main(): Promise<void> {
	configure({ token: process.env.ATLA_INSIGHTS_TOKEN as string });

	// Instrument the OpenAI client
	const { default: OpenAI } = await import("openai");
	instrumentOpenAI(OpenAI);

	const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY as string });

	// Define experiment to run
	await runExperiment(
		{
			experimentName: "my-experiment",
			description: "Testing out some experiment changes",
		},
		async () => {
			// Generate traces within this experiment
			const runMyExperimentTrace = instrument("my-trace")(async () => {
				const completion = await client.chat.completions.create({
					model: "gpt-4o",
					messages: [
						{
							role: "user",
							content: "Hello world!",
						},
					],
				});

				console.log("Response:", completion.choices[0].message.content);
			});

			await runMyExperimentTrace();
		},
	);
}

main().catch(console.error);
