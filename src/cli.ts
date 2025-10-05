#!/usr/bin/env node
import { program } from "commander";
import { cliListMemory, cliReadAllMemory, cliReadMemory } from "./cli/memory.js";
import { createAppCommand } from "./utils/command.js";
import debug from "debug";
import { getDefaultPort } from "#src/utils/serial.js";
import { cliListSerialPorts } from "#src/cli/misc.js";
import { getVersion } from "#src/utils/version.js";
import { cliMakeScreenshot } from "#src/cli/screenshotter.js";

export interface CLIBaseOptions {
	port: string;
	baudrate: string;
}

const DEFAULT_PORT = await getDefaultPort();

const GROUP_MISC = "Commands:";
const GROUP_MEMORY_DUMPER = "Memory dumper (CGSN):";
const GROUP_SCREENSHOTTER = "Screenshotter (BFC):";

program
	.name("sie-tool")
	.version(getVersion(), '-v, --version')
	.description('CLI tool for Siemens phones.')
	.option('-p, --port <port>', 'serial port name', DEFAULT_PORT)
	.option('-b, --baudrate <baudrate>', 'limit maximum baudrate (0 - use maximum)', '0')
	.option('-V, --verbose', 'Increase verbosity', (_, prev) => prev + 1, 0)
	.hook('preAction', (thisCommand) => {
		const opts = thisCommand.opts() as { verbose?: number };
		if (opts.verbose) {
			const filters = ["atc", "bfc", "bsl", "chaos"];
			if (opts.verbose >= 2)
				filters.push("atc:*", "bfc:*", "bsl:*", "chaos:*");
			if (opts.verbose >= 3)
				filters.push("*");
			debug.enable(filters.join(","));
			console.log(`Verbosity level: ${opts.verbose} [${filters.join(", ")}]`);
		}
	})
	.optionsGroup("Options:");

/**
 * Memory dumper
 */
program
	.command('memory-read')
	.description('Read and save phone memory')
	.option('-n, --name <blockName>', 'Read by block name')
	.option('-a, --addr <address>', 'Read from address (dec or hex)')
	.option('-s, --size <bytes>', 'Size in bytes (dec, hex, k/m/g allowed)')
	.option('-o, --output [file]', 'Write output to file or directory')
	.action(createAppCommand(cliReadMemory))
	.helpGroup(GROUP_MEMORY_DUMPER);

program
	.command('memory-read-all')
	.description('Read and save all available phone memory blocks')
	.option('-i, --include <blocks>', 'Include blocks (comma separated)', (v) => v.split(','), [])
	.option('-e, --exclude <blocks>', 'Exclude blocks (comma separated)', (v) => v.split(','), [])
	.option('-o, --output [dir]', 'Write output to directory')
	.action(createAppCommand(cliReadAllMemory))
	.helpGroup(GROUP_MEMORY_DUMPER);

program
	.command('memory-list')
	.description('List available memory blocks')
	.action(createAppCommand(cliListMemory))
	.helpGroup(GROUP_MEMORY_DUMPER);

/**
 * Screenshotter
 */
program
	.command('screenshot')
	.description('Make screenshot of phone screen')
	.option('-d, --display <index>', 'Display number (0-based)', '0')
	.option('-o, --output [file]', 'Write output to file or directory')
	.action(createAppCommand(cliMakeScreenshot))
	.helpGroup(GROUP_SCREENSHOTTER);

/**
 * MISC
 */
program.command('list-ports')
	.description('List available serial ports.')
	.action(createAppCommand(cliListSerialPorts))
	.helpGroup(GROUP_MISC);

program.showSuggestionAfterError(true);
program.showHelpAfterError();
program.parse();
