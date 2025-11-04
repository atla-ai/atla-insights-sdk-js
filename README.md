# Atla Insights SDK for JavaScript

Atla Insights is a platform for monitoring and improving AI agents.

<p align="center">
  <a href="https://www.npmjs.com/package/@atla-ai/insights-sdk-js"><img src="https://img.shields.io/npm/v/%40atla-ai%2Finsights-sdk-js" alt="NPM version"></a>
  <a href="https://github.com/atla-ai/atla-insights-sdk/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="license" /></a>
  <a href="https://app.atla-ai.com/auth/signup"><img src="https://img.shields.io/badge/Atla_Insights_platform-white?logo=data:image/svg%2bxml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pgo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDIwMDEwOTA0Ly9FTiIKICJodHRwOi8vd3d3LnczLm9yZy9UUi8yMDAxL1JFQy1TVkctMjAwMTA5MDQvRFREL3N2ZzEwLmR0ZCI+CjxzdmcgdmVyc2lvbj0iMS4wIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciCiB3aWR0aD0iMjAwLjAwMDAwMHB0IiBoZWlnaHQ9IjIwMC4wMDAwMDBwdCIgdmlld0JveD0iMCAwIDIwMC4wMDAwMDAgMjAwLjAwMDAwMCIKIHByZXNlcnZlQXNwZWN0UmF0aW89InhNaWRZTWlkIG1lZXQiPgoKPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMC4wMDAwMDAsMjAwLjAwMDAwMCkgc2NhbGUoMC4xMDAwMDAsLTAuMTAwMDAwKSIKZmlsbD0iIzAwMDAwMCIgc3Ryb2tlPSJub25lIj4KPHBhdGggZD0iTTEyODUgMTQ1MCBjLTM2IC0zNyAtNDcgLTU0IC00MCAtNjMgNDAgLTU0IDc4IC0xMTkgOTYgLTE2NyAxNyAtNDYKMjAgLTcyIDE3IC0xNTUgLTMgLTg3IC04IC0xMDkgLTM1IC0xNjggLTQwIC04NCAtMTI1IC0xNzEgLTIwNSAtMjA5IC0xNTIgLTc0Ci0zMjcgLTU2IC00NjIgNDcgbC00OSAzNyAtNDggLTQ4IGMtMjcgLTI3IC00OSAtNTMgLTQ5IC01OSAwIC0xNyA5MCAtODIgMTYyCi0xMTUgMjM1IC0xMTAgNTA0IC01OSA2ODMgMTMxIDE1MCAxNjAgMjAyIDM4NyAxMzQgNTkzIC0yNCA3MyAtMTE1IDIxOSAtMTM5CjIyNCAtOSAxIC0zOCAtMjAgLTY1IC00OHoiLz4KPHBhdGggZD0iTTgxNSAxNDE5IGMtMjYwIC04NCAtMzMwIC00MTQgLTEyOCAtNTk5IDc2IC02OSAxNDQgLTkzIDI1MyAtODggMTQyCjcgMjQxIDcxIDMwMiAxOTYgMzAgNjEgMzMgNzUgMzMgMTU3IC0xIDc3IC01IDk4IC0yOCAxNDUgLTQ2IDk1IC0xMjEgMTYxCi0yMTggMTkxIC03NiAyNCAtMTM3IDIzIC0yMTQgLTJ6Ii8+CjwvZz4KPC9zdmc+Cg==" alt="Atla Insights platform"></a>
  <a href="https://arxiv.org/abs/2501.17195"><img src="https://img.shields.io/badge/ArXiv-Selene_Mini-darkred?logo=arxiv" alt="ArXiv Selene Mini"></a>
  <a href="https://discord.com/invite/qFCMgkGwUK"><img src="https://img.shields.io/badge/Discord-Join_Chat-7289DA.svg?logo=discord" alt="Discord"></a>
  <a href="https://x.com/Atla_AI"><img src="https://img.shields.io/twitter/follow/Atla_AI?style=social" alt="Twitter Follow"></a>
</p>

<p align="center">
    <a href="https://www.producthunt.com/products/atla?embed=true&utm_source=badge-top-post-badge&utm_medium=badge&utm_source=badge-atla&#0045;2" target="_blank"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=1018748&theme=light&period=daily&t=1758823519480" alt="Atla - Automatically&#0032;detect&#0032;errors&#0032;in&#0032;your&#0032;AI&#0032;agents | Product Hunt" style="width: 250px; height: 54px;" width="250" height="54" /></a>
</p>

## Getting started

To get started with Atla Insights, you can either follow the instructions below, or let an agent instrument your code for you.

## Installation

```bash
npm install @atla-ai/insights-sdk-js
```

Or with pnpm:

```bash
pnpm add @atla-ai/insights-sdk-js
```

Or with yarn:

```bash
yarn add @atla-ai/insights-sdk-js
```

## Usage

### Configuration

Before using Atla Insights, you need to configure it with your authentication token:

```typescript
import { configure } from "@atla-ai/insights-sdk-js";

// Run this command at the start of your application.
configure({ 
  token: "<MY_ATLA_INSIGHTS_TOKEN>" 
});
```

You can retrieve your authentication token from the [Atla Insights platform](https://app.atla-ai.com).

### Instrumentation

In order for spans/traces to become available in your Atla Insights dashboard, you will need to add some form of instrumentation.

As a starting point, you will want to instrument your GenAI library of choice.

See the section below to find out which frameworks & providers we currently support.

All instrumentation methods share a common interface, which allows you to do the following:

-   **Session-wide (un)instrumentation**:
    You can manually enable/disable instrumentation throughout your application.

```typescript
import { configure, instrumentOpenAI, uninstrumentOpenAI } from "@atla-ai/insights-sdk-js";
import OpenAI from "openai";

configure({ token: "..." });
instrumentOpenAI();

// All OpenAI calls from this point onwards will be instrumented

uninstrumentOpenAI();

// All OpenAI calls from this point onwards will **no longer** be instrumented
```

-   **Instrumented with disposable resources**:
    All instrumentation methods also provide a disposable resource pattern that automatically handles (un)instrumentation.

```typescript
import { configure, withInstrumentedOpenAI } from "@atla-ai/insights-sdk-js";
import OpenAI from "openai";

configure({ token: "..." });

// Using TypeScript 5.2+ using statement
{
  using instrumented = withInstrumentedOpenAI();
  // All OpenAI calls inside this block will be instrumented
}
// OpenAI instrumentation automatically disabled here

// Or manually manage lifecycle
const instrumented = withInstrumentedOpenAI();
try {
  // All OpenAI calls here will be instrumented
} finally {
  instrumented[Symbol.dispose]();
}
```

### Instrumentation Support

#### Providers

We currently support the following LLM providers:

| Provider     | Instrumentation Function  | Notes                        |
| ------------ | ------------------------- | ---------------------------- |
| **OpenAI**   | `instrumentOpenAI`        | Includes Azure OpenAI        |


#### Frameworks

We currently support the following frameworks:

| Framework    | Instrumentation Function  | Notes                        |
| ------------ | ------------------------- | ---------------------------- |
| **LangChain**   | `instrumentLangChain`        | Includes LangChain and LangGraph        |
| **OpenAI Agents**   | `instrumentOpenAIAgents`        | |


⚠️ Note that, by default, instrumented LLM calls will be treated independently from one another. In order to logically group LLM calls into a trace, you will need to group them as follows:

```typescript
import { configure, instrument, instrumentOpenAI } from "@atla-ai/insights-sdk-js";
import OpenAI from "openai";

configure({ token: "..." });
instrumentOpenAI();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// The OpenAI calls below will belong to **separate traces**
const result1 = await client.chat.completions.create({ ... });
const result2 = await client.chat.completions.create({ ... });

const runMyAgent = instrument("My agent doing its thing")(
  async function(): Promise<void> {
    // The OpenAI calls within this function will belong to the **same trace**
    const result1 = await client.chat.completions.create({ ... });
    const result2 = await client.chat.completions.create({ ... });
    // ...
  }
);
```

#### Manual instrumentation

It is also possible to manually record LLM generations using the lower-level span SDK.

```typescript
import { startAsCurrentSpan } from "@atla-ai/insights-sdk-js";

const { span, endSpan } = startAsCurrentSpan("my-llm-generation");
try {
  // Run my LLM generation via an unsupported framework.
  const inputMessages = [{ role: "user", content: "What is the capital of France?" }];
  const tools = [
    {
      type: "function",
      function: {
        name: "get_capital",
        parameters: { type: "object", properties: { country: { type: "string" } } },
      },
    },
  ];
  const result = await myClient.chat.completions.create({ messages: inputMessages, tools });

  // Manually record LLM generation.
  span.recordGeneration({
    inputMessages,
    outputMessages: result.choices.map(choice => choice.message),
    tools,
  });
} finally {
  endSpan();
}
```

Note that the expected data format are OpenAI Chat Completions compatible messages / tools.

### Adding metadata

You can attach metadata to a run that provides additional information about the specs of that specific workflow. This can include various system settings, prompt versions, etc.

```typescript
import { configure } from "@atla-ai/insights-sdk-js";

// We can define some system settings, prompt versions, etc. we'd like to keep track of.
const metadata = {
  environment: "dev",
  "prompt-version": "v1.4",
  model: "gpt-4o-2024-08-06",
  "run-id": "my-test",
};

// Any subsequent generated traces will inherit the metadata specified here.
configure({
  token: "<MY_ATLA_INSIGHTS_TOKEN>",
  metadata,
});
```

You can also set metadata dynamically within instrumented functions:

```typescript
import { instrument, setMetadata } from "@atla-ai/insights-sdk-js";

const myFunction = instrument("My Function")(
  function(): void {
    // Add metadata specific to this execution
    setMetadata({ function: "function1", timestamp: new Date().toISOString() });
    // Your function logic here
  }
);
```

### Marking trace success / failure

The logical notion of _success_ or _failure_ plays a prominent role in the observability of (agentic) GenAI applications.

Therefore, the `@atla-ai/insights-sdk-js` package offers the functionality to mark a trace as a success or a failure like follows:

```typescript
import {
  configure,
  instrument,
  instrumentOpenAI,
  markFailure,
  markSuccess,
} from "@atla-ai/insights-sdk-js";
import OpenAI from "openai";

configure({ token: "..." });
instrumentOpenAI();

const client = new OpenAI();

const runMyAgent = instrument("My agent doing its thing")(
  async function(): Promise<void> {
    const result = await client.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: "What is 1 + 2? Reply with only the answer, nothing else.",
        }
      ]
    });
    const response = result.choices[0].message.content;

    // Note that you could have any arbitrary success condition, including LLMJ-based evaluations
    if (response === "3") {
      markSuccess();
    } else {
      markFailure();
    }
  }
);
```

⚠️ Note that you should use this marking functionality within an instrumented function.

### Experiments

You can group related traces into experiments for comparative analysis in the Atla Insights workbench. This is particularly useful when testing different prompts, models, or configurations.

```typescript
import {
  configure,
  instrument,
  instrumentOpenAI,
  runExperiment,
} from "@atla-ai/insights-sdk-js";
import OpenAI from "openai";

configure({ token: "..." });
instrumentOpenAI();

const client = new OpenAI();

// Run code within an experiment context
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
```

If you don't provide an experiment name, one will be auto-generated for you:

```typescript
// Auto-generated name like "clever-fox-a3b4c5d6"
await runExperiment({}, async () => {
  // Your experiment code
});
```

All traces generated within an experiment will:
- Be tagged with the experiment name and description
- Appear in the "dev" environment in your dashboard
- Be grouped together in the Atla Insights workbench for easy comparison

### Compatibility with existing observability

As `@atla-ai/insights-sdk-js` provides its own instrumentation, we should note potential interactions with our instrumentation / observability providers.

`@atla-ai/insights-sdk-js` instrumentation is generally compatible with most popular observability platforms.

#### OpenTelemetry compatibility

The Atla Insights SDK is built on the OpenTelemetry standard and fully compatible with other OpenTelemetry services.

If you have an existing OpenTelemetry setup (e.g., by setting the relevant otel environment variables), Atla Insights will be _additive_ to this setup. I.e., it will add additional logging on top of what is already getting logged.

If you do not have an existing OpenTelemetry setup, Atla Insights will initialize a new (global) tracer provider.

### More examples

More specific examples can be found in the `examples/` folder.

## TypeScript Support

This SDK is written in TypeScript and provides full type definitions out of the box. No additional `@types` packages are required.

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
