import { execSync } from "node:child_process";
import { existsSync } from "node:fs";

/**
 * Get the current Git repository name
 */
export function getGitRepo(): string | null {
	try {
		if (!existsSync(".git")) {
			return null;
		}

		try {
			const remoteUrl = execSync("git remote get-url origin", {
				encoding: "utf8",
				stdio: "pipe",
			}).trim();

			const match = remoteUrl.match(/\/([^/]+?)(?:\.git)?$/);
			return match ? match[1] : null;
		} catch {
			return null;
		}
	} catch {
		return null;
	}
}

/**
 * Get the current Git branch name
 */
export function getGitBranch(): string | null {
	try {
		if (!existsSync(".git")) {
			return null;
		}

		try {
			const headRef = execSync("git symbolic-ref HEAD", {
				encoding: "utf8",
				stdio: "pipe",
			}).trim();

			return headRef.replace("refs/heads/", "");
		} catch {
			return null;
		}
	} catch {
		return null;
	}
}

/**
 * Get the current Git commit hash
 */
export function getGitCommitHash(): string | null {
	try {
		if (!existsSync(".git")) {
			return null;
		}

		try {
			const commitHash = execSync("git rev-parse HEAD", {
				encoding: "utf8",
				stdio: "pipe",
			}).trim();

			return commitHash;
		} catch {
			return null;
		}
	} catch {
		return null;
	}
}
