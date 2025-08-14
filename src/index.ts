// Core configuration
export { configure, type ConfigurationOptions } from "./main";

// Instrumentation
export { instrument } from "./instrumentation";

// Manual span creation
export { startAsCurrentSpan, AtlaSpan } from "./span";

// Metadata management
export { setMetadata, getMetadata, withMetadata, clearMetadata } from "./metadata";

// Marking functionality
export { markSuccess, markFailure } from "./marking";

// LLM provider instrumentation
export {
    instrumentOpenAI,
    uninstrumentOpenAI,
    withInstrumentedOpenAI,
} from "./providers/openai/index";
