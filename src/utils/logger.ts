type LogMethod = (...messages: unknown[]) => void;

export type Logger = {
	debug: LogMethod;
	info: LogMethod;
	warn: LogMethod;
	verbose: LogMethod;
};

/**
 * Shared application logger.
 *
 * `verbose` uses the debug console channel because the standard console API
 * does not provide a verbose method of its own.
 */
export const logger: Logger = {
	debug: (...messages) => console.debug(...messages),
	info: (...messages) => console.info(...messages),
	warn: (...messages) => console.warn(...messages),
	verbose: (...messages) => console.debug(...messages),
};
