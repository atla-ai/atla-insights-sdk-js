import { execSync } from "node:child_process";

/**
 * Get the current Git remote repository URL
 */
export function getGitRepo(): string | null {
	try {
		const remoteUrl = execSync("git remote get-url origin", {
			encoding: "utf8",
			stdio: "pipe",
		}).trim().replace(/\.git$/, "");
		return remoteUrl;
	} catch {
		return null;
	}
}
export const currentGitRepo = getGitRepo();

/**
 * Get the current Git branch name
 */
export function getGitBranch(): string | null {
	try {
		const headRef = execSync("git symbolic-ref HEAD", {
			encoding: "utf8",
			stdio: "pipe",
		}).trim();

		return headRef.replace("refs/heads/", "");
	} catch {
		return null;
	}
}
export const currentGitBranch = getGitBranch();

/**
 * Get the current Git commit hash
 */
export function getGitCommitHash(): string | null {
	try {
		const commitHash = execSync("git rev-parse HEAD", {
			encoding: "utf8",
			stdio: "pipe",
		}).trim();

		return commitHash;
	} catch {
		return null;
	}
}
export const currentGitCommitHash = getGitCommitHash();

/**
 * Get the current Git commit message
 */
export function getGitCommitMessage(): string | null {
	try {
		const commitMessage = execSync("git log -1 --pretty=%B", {
			encoding: "utf8",
			stdio: "pipe",
		}).trim();

		return commitMessage;
	} catch {
		return null;
	}
}
export const currentGitCommitMessage = getGitCommitMessage();

/**
 * Get the current Git commit timestamp
 */
export function getGitCommitTimestamp(): string | null {
	try {
		const commitMessage = execSync("git show -s --format=%cI HEAD", {
			encoding: "utf8",
			stdio: "pipe",
		}).trim();

		return commitMessage;
	} catch {
		return null;
	}
}
export const currentGitCommitTimestamp = getGitCommitTimestamp();

/**
 * Get the current Git semver
 */
export function getGitSemver(): string | null {
	try {
		const commitMessage = execSync("git describe --tags --abbrev=0", {
			encoding: "utf8",
			stdio: "pipe",
		}).trim();

		return commitMessage;
	} catch {
		return null;
	}
}
export const currentGitSemver = getGitSemver();
