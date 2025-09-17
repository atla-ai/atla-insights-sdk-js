import type {
	ReadableSpan,
	Span,
	SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { Context } from "@opentelemetry/api";
import {
	GIT_TRACKING_DISABLED_ENV_VAR,
	GIT_REPO_MARK,
	GIT_BRANCH_MARK,
	GIT_COMMIT_HASH_MARK,
	METADATA_MARK,
	SUCCESS_MARK,
} from "./internal/constants";
import {
	currentGitRepo,
	currentGitBranch,
	currentGitCommitHash,
} from "./utils";

const INSTRUMENTATION_SCOPE_MAPPINGS: Record<string, string> = {
	"@arizeai/openinference-instrumentation-openai":
		"openinference.instrumentation.openai",
	"@arizeai/openinference-instrumentation-langchain":
		"openinference.instrumentation.langchain",
};

export class AtlaRootSpanProcessor implements SpanProcessor {
	constructor(private metadata?: Record<string, string>) {}

	onStart(span: Span, _parentContext: Context): void {
		this.renameInstrumentationScopeToOpenInferenceStandard(span);

		if (!process.env[GIT_TRACKING_DISABLED_ENV_VAR]) {
			if (currentGitRepo) {
				span.setAttribute(GIT_REPO_MARK, currentGitRepo);
			}
			if (currentGitBranch) {
				span.setAttribute(GIT_BRANCH_MARK, currentGitBranch);
			}
			if (currentGitCommitHash) {
				span.setAttribute(GIT_COMMIT_HASH_MARK, currentGitCommitHash);
			}
		}

		if (span.parentSpanId) {
			return;
		}

		// This is a root span
		span.setAttribute(SUCCESS_MARK, -1);

		if (this.metadata && Object.keys(this.metadata).length > 0) {
			span.setAttribute(METADATA_MARK, JSON.stringify(this.metadata));
		}
	}

	onEnd(_span: ReadableSpan): void {
		// No processing needed on end
	}

	shutdown(): Promise<void> {
		return Promise.resolve();
	}

	forceFlush(): Promise<void> {
		return Promise.resolve();
	}

	/**
	 * Rename the instrumentation scope to the OpenInference standard.
	 * @param span - The span to rename.
	 */
	private renameInstrumentationScopeToOpenInferenceStandard(span: Span) {
		const { name: instrumentationScope } = span.instrumentationLibrary;
		const newScope = INSTRUMENTATION_SCOPE_MAPPINGS[instrumentationScope];

		if (newScope) {
			Object.defineProperty(span.instrumentationLibrary, "name", {
				value: newScope,
				writable: false,
				configurable: true,
			});
		}
	}
}
