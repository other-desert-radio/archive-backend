import { Writable } from "node:stream";

const gray = "\u001b[90m";
const reset = "\u001b[0m";

/** Formats one Pino JSON log line with its message above gray metadata. */
export const formatLogLine = (line: string): string => {
	try {
		const entry = JSON.parse(line) as { msg?: unknown } & Record<
			string,
			unknown
		>;
		const message = typeof entry.msg === "string" ? entry.msg : "Log event";
		const { msg: _message, ...details } = entry;
		const grayDetails = JSON.stringify(details, null, 2)
			.split("\n")
			.map((detailLine) => `${gray}${detailLine}${reset}`)
			.join("\n");
		return `${message}\n${grayDetails}\n`;
	} catch {
		return `${line}\n`;
	}
};

/** Writes Pino logs as readable messages followed by gray structured details. */
export class PrettyLogStream extends Writable {
	public override _write(
		chunk: Uint8Array,
		_encoding: BufferEncoding,
		callback: (error?: Error) => void,
	): void {
		process.stdout.write(formatLogLine(Buffer.from(chunk).toString("utf8")));
		callback();
	}
}
