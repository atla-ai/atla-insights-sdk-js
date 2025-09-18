export const OTEL_TRACES_ENDPOINT = "https://logfire-eu.pydantic.dev/v1/traces";
export const OTEL_MODULE_NAME = "atla_insights";

export const DEFAULT_OTEL_ATTRIBUTE_COUNT_LIMIT = 4096;
export const DEFAULT_SERVICE_NAME = "atla-insights-js";

export const METADATA_MARK = "atla.metadata";
export const SUCCESS_MARK = "atla.mark.success";

export const GIT_BRANCH_MARK = "atla.git.branch";
export const GIT_COMMIT_HASH_MARK = "atla.git.commit.hash";
export const GIT_COMMIT_MESSAGE_MARK = "atla.git.commit.message";
export const GIT_COMMIT_TIMESTAMP_MARK = "atla.git.commit.timestamp";
export const GIT_REPO_MARK = "atla.git.repo";
export const GIT_SEMVER_MARK = "atla.git.semver";
export const GIT_TRACKING_DISABLED_ENV_VAR = "ATLA_DISABLE_GIT_TRACKING";

// Metadata validation limits
export const MAX_METADATA_FIELDS = 25;
export const MAX_METADATA_KEY_CHARS = 40;
export const MAX_METADATA_VALUE_CHARS = 100;
