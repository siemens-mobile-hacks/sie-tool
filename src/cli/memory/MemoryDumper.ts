import type { IoReadResult, IoReadWriteOptions } from "@sie-js/serial";
import type { CLIBaseOptions } from "#src/cli.js";

export interface MemoryRegion {
	name: string;
	addr: number;
	size: number;
}

export interface PhoneInfo {
	name: string;
	regions: MemoryRegion[];
}

export interface MemoryDumper {
	readMemory(addr: number, size: number, options?: IoReadWriteOptions): Promise<IoReadResult>;
	getPhoneInfo(): Promise<PhoneInfo>;
	disconnect(): Promise<void>;
}

export interface CLIMemoryOptions extends CLIBaseOptions {
	protocol: string;
}

export interface CLIReadMemoryOptions extends CLIMemoryOptions {
	addr?: string;
	size?: string;
	name?: string;
	output?: string;
}

export interface CLIReadAllMemoryOptions extends CLIMemoryOptions {
	output?: string;
	include?: string[];
	exclude?: string[];
}
