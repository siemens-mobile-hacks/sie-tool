import fs from "node:fs";
import cliProgress from "cli-progress";
import { sprintf } from "sprintf-js";
import { table as asciiTable } from "table";
import { AppCommandValidateError, onCleanup, type AppCommand } from "#src/utils/command.js";
import { formatSize, parseAddr, parseSize } from "#src/utils/string.js";
import { probePhonePlatform } from "#src/utils/serial.js";
import { BfbMemoryDumper } from "./BfbMemoryDumper.js";
import { CgsnMemoryDumper } from "./CgsnMemoryDumper.js";
import type { CLIMemoryOptions, CLIReadAllMemoryOptions, CLIReadMemoryOptions, MemoryDumper } from "./MemoryDumper.js";

const MEMORY_REGION_DESCR: Record<string, string> = {
	BROM: 'Built-in 1st stage bootloader firmware.',
	TCM: 'Built-in memory in the CPU, used for IRQ handlers.',
	SRAM: 'Built-in memory in the CPU.',
	RAM: 'External RAM.',
	FLASH: 'NOR flash.',
};

export const cliReadMemory: AppCommand<CLIReadMemoryOptions> = async (options) => {
	let addr = options.addr != null ? parseAddr(options.addr) : 0;
	let size = options.size != null ? parseSize(options.size) : 0;
	let name: string | undefined;

	if (options.name && options.addr)
		throw new AppCommandValidateError("Can't use both --name and --addr options!");
	if (options.addr && !options.size)
		throw new AppCommandValidateError("Can't use --addr option without --size!");
	if (!options.addr && !options.name)
		throw new AppCommandValidateError("Need to specify --addr or --name!");

	const dumper = await connectMemoryDumper(options);
	onCleanup(() => dumper.disconnect());
	const info = await dumper.getPhoneInfo();
	if (options.name) {
		const region = info.regions.find((region) => region.name.toLowerCase() == options.name!.toLowerCase());
		if (!region)
			throw new Error(`Memory region "${options.name}" not found!`);
		addr = region.addr;
		size = region.size;
		name = region.name;
	} else {
		name = info.regions.find((region) => region.addr == addr && region.size == size)?.name;
	}

	const genericName = `${info.name}${name ? '-' + name : ''}-${sprintf("%08X_%08X", addr, size)}.bin`;
	let outputFile = options.output ?? `./${genericName}`;
	if (options.output && fs.existsSync(options.output) && fs.lstatSync(options.output).isDirectory())
		outputFile = `${options.output}/${genericName}`;
	fs.writeFileSync(outputFile, "");
	console.log(sprintf("Reading memory %08X ... %08X (%s)", addr, addr + size - 1, formatSize(size)));
	console.log();

	const pb = new cliProgress.SingleBar({
		format: ' [{bar}] {percentage}% | ETA: {eta}s | {speed} kB/s'
	}, cliProgress.Presets.legacy);
	pb.start(size, 0);
	const result = await dumper.readMemory(addr, size, {
		onProgress: (e) => pb.update(e.cursor, {
			speed: e.elapsed ? +((e.cursor / (e.elapsed / 1000)) / 1024).toFixed(2) : 'N/A',
		}),
	});
	pb.stop();
	fs.writeFileSync(outputFile, result.buffer);
	console.log();
	console.log(`File saved to: ${outputFile}`);
}

export const cliListMemory: AppCommand<CLIMemoryOptions> = async (options) => {
	const dumper = await connectMemoryDumper(options);
	onCleanup(() => dumper.disconnect());
	const info = await dumper.getPhoneInfo();
	const rows = info.regions.map((region) => [
		region.name,
		sprintf("0x%08X", region.addr),
		sprintf("0x%08X (%s)", region.size, formatSize(region.size)),
		MEMORY_REGION_DESCR[region.name] ?? "Unknown memory region.",
	]);
	console.log(asciiTable([['Name', 'Address', 'Size', 'Description'], ...rows]).trim());
}

export const cliReadAllMemory: AppCommand<CLIReadAllMemoryOptions> = async (options) => {
	const outputDir = options.output || ".";
	if (!fs.existsSync(outputDir))
		fs.mkdirSync(outputDir, { recursive: true });

	const dumper = await connectMemoryDumper(options);
	onCleanup(() => dumper.disconnect());
	const info = await dumper.getPhoneInfo();
	const regions = info.regions
		.filter((region) => !options.include?.length || options.include.includes(region.name))
		.filter((region) => !options.exclude?.length || !options.exclude.includes(region.name))
		.sort((a, b) => a.size - b.size);
	const totalSize = regions.reduce((sum, region) => sum + region.size, 0);
	const pb = new cliProgress.SingleBar({
		format: ' [{bar}] {percentage}% | ETA: {totalEta}s | {speed} kB/s'
	}, cliProgress.Presets.legacy);
	console.log();

	let totalRead = 0;
	for (const [index, region] of regions.entries()) {
		console.log(sprintf("[%d/%d] Reading %s %08X ... %08X (%s)",
			index + 1, regions.length, region.name, region.addr, region.addr + region.size - 1, formatSize(region.size)));
		pb.start(region.size, 0);
		const response = await dumper.readMemory(region.addr, region.size, {
			onProgress: (e) => {
				const speed = e.elapsed ? e.cursor / (e.elapsed / 1000) : 0;
				pb.update(e.cursor, {
					speed: speed ? +(speed / 1024).toFixed(2) : 'N/A',
					totalEta: speed ? Math.round((totalSize - totalRead - e.cursor) / speed) : 0,
				});
			},
		});
		totalRead += region.size;
		const outputFile = `${outputDir}/${info.name}-${region.name}-${sprintf("%08X_%08X", region.addr, region.size)}.bin`;
		fs.writeFileSync(outputFile, response.buffer);
		pb.stop();
		console.log(`File saved to: ${outputFile}`);
		console.log();
	}
}

async function connectMemoryDumper(options: CLIMemoryOptions): Promise<MemoryDumper> {
	switch (options.protocol.toLowerCase()) {
		case "auto": {
			console.info(`Probing phone platform using port ${options.port}...`);
			const platform = await probePhonePlatform(options.port);
			console.info(`Detected phone platform: ${platform.toUpperCase()}`);
			const protocolByPlatform = {
				egold: "bfb",
				sgold: "cgsn",
			} as const;
			return connectMemoryDumper({
				...options,
				protocol: protocolByPlatform[platform],
			});
		}
		case "bfb":
			return BfbMemoryDumper.connect(options.port, +options.baudrate);
		case "cgsn":
			return CgsnMemoryDumper.connect(options.port, +options.baudrate);
		default:
			throw new AppCommandValidateError(`Unsupported memory protocol "${options.protocol}". Use auto, cgsn, or bfb.`);
	}
}
