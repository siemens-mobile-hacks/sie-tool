import type { BfbDisplayBufferData, BfcDisplayBufferData, IoReadWriteOptions } from "@sie-js/serial";
import type { CLIBaseOptions } from "#src/cli.js";

export type DisplayBufferData = BfcDisplayBufferData | (BfbDisplayBufferData & {
	displayWidth: number;
	displayHeight: number;
});

export interface DecodedDisplayBuffer {
	width: number;
	height: number;
	data: Buffer;
}

export interface Screenshotter {
	getDisplayBuffer(displayId: number, options?: IoReadWriteOptions): Promise<DisplayBufferData>;
	disconnect(): Promise<void>;
}

export interface CLIMakeScreenshotOptions extends CLIBaseOptions {
	protocol: string;
	display?: string;
	output?: string;
}
