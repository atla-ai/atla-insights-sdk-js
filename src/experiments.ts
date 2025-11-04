/**
 * @fileoverview Experiment tracking for organizing and analyzing AI agent runs.
 *
 * This module provides functionality to group related traces into experiments
 * for comparative analysis in the Atla Insights workbench. Experiments are
 * automatically marked with a "dev" environment and include custom metadata.
 */

import { humanId } from "human-id";
import { randomUUID } from "node:crypto";
import { runWithContext } from "./context";

export interface Experiment {
	name: string;
	description?: string;
}

export interface RunExperimentOptions {
	experimentName?: string;
	description?: string;
}

/**
 * Generate a human-readable experiment ID.
 * Format: "word1-word2-word3-shortUUID"
 * Example: "clever-bright-fox-a3b4c5d6"
 */
function generateExperimentId(): string {
	const humanReadableId = humanId({
		separator: "-",
		capitalize: false,
		adjectiveCount: 2,
		addAdverb: false,
	});
	const shortUuid = randomUUID().replace(/-/g, "").substring(0, 8);
	return `${humanReadableId}-${shortUuid}`;
}

/**
 * Run code within an experiment context.
 *
 * All traces generated within the experiment will be tagged with experiment
 * metadata and grouped together in the Atla Insights workbench.
 *
 * @param options - Experiment configuration
 * @param options.experimentName - Custom experiment name (auto-generated if not provided)
 * @param options.description - Optional description of the experiment
 * @param fn - The function to execute within the experiment context
 * @returns The result of the function execution
 *
 * @example
 * ```typescript
 * import { runExperiment } from '@atla-ai/insights-sdk-js';
 *
 * // Define experiment to run
 * const result = await runExperiment({
 *   experimentName: "my-experiment",
 *   description: "Testing out some experiment changes"
 * }, async () => {
 *		// Generate traces within this experiment
 *		const runMyExperimentTrace = instrument("my-trace")(async () => {
 *			const completion = await client.chat.completions.create({
 *				model: "gpt-4o",
 *				messages: [
 *					{
 *						role: "user",
 *						content: "Hello world!",
 *					},
 *				],
 *			});
 *		});
 *		await runMyExperimentTrace();
 *	});
 *   return response;
 * });
 * ```
 */
export function runExperiment<T>(
	options: RunExperimentOptions,
	fn: () => T | Promise<T>,
): T | Promise<T> {
	const experimentName = options.experimentName || generateExperimentId();

	const experiment: Experiment = {
		name: experimentName,
		...(options.description && { description: options.description }),
	};

	console.log(`🧪 Starting experiment: ${experimentName}`);

	try {
		const result = runWithContext({ experiment }, fn);

		// Handle both sync and async results
		if (result instanceof Promise) {
			return result
				.then((res) => {
					console.log(`✓ Experiment completed: ${experimentName}`);
					return res;
				})
				.catch((error) => {
					console.error(`✗ Experiment failed: ${experimentName}`, error);
					throw error;
				}) as T | Promise<T>;
		}

		console.log(`✓ Experiment completed: ${experimentName}`);
		return result;
	} catch (error) {
		console.error(`✗ Experiment failed: ${experimentName}`, error);
		throw error;
	}
}
