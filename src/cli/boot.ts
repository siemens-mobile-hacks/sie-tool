import { CLIBaseOptions } from "#src/cli.js";
import { AppCommand } from "#src/utils/command.js";
import fs from "node:fs";
import { AsyncSerialPort, loadBootCode } from "@sie-js/serial";
import { SerialPort } from "serialport";
import { sprintf } from "sprintf-js";

const SPECIAL_BOOTS: Record<string, Buffer> = {
	BurninMode: Buffer.from(
		"F104A0E3201090E5FF10C1E3A51081E3" +
		"201080E51EFF2FE10401080000000000" +
		"00000000000000005349454D454E535F" +
		"424F4F54434F44450100070000000000" +
		"00000000000000000000000000000000" +
		"01040580830003",
		"hex"
	),
	ServiceMode: Buffer.from(
		"F104A0E3201090E5FF10C1E3A51081E3" +
		"201080E51EFF2FE10401080000000000" +
		"00000000000000005349454D454E535F" +
		"424F4F54434F44450100070000000000" +
		"00000000000000000000000000000000" +
		"010405008B008B",
		"hex"
	),
	NormalMode: Buffer.from(
		"F104A0E3201090E5FF10C1E3A51081E3" +
		"201080E51EFF2FE10401080000000000" +
		"00000000000000005349454D454E535F" +
		"424F4F54434F44450100070000000000" +
		"00000000000000000000000000000000" +
		"01040500890089",
		"hex"
	),
};

export interface CLIBootCodeOptions extends CLIBaseOptions {
	input: string;
	ignition: string;
	follow: boolean;
	hex: boolean;
}

export const cliBootCode: AppCommand<CLIBootCodeOptions> = async (options) => {
	let bootCode: Buffer;

	if ((options.input in SPECIAL_BOOTS)) {
		console.log(`Using built-in boot ${options.input}`);
		bootCode = SPECIAL_BOOTS[options.input];
	} else if (options.input.match(/^[a-f0-9]+$/i)) {
		console.log(`Using HEX boot from cmdline.`);
		bootCode = Buffer.from(options.input, "hex");
	} else {
		console.log(`Using boot from file ${options.input}.`);
		bootCode = fs.readFileSync(options.input);
	}

	const port = new AsyncSerialPort(new SerialPort({
		path: options.port,
		baudRate: 112500,
		autoOpen: false
	}));
	await port.open();

	console.log(`Sending boot code... Please press RED button!!!`);
	const result = await loadBootCode(port, bootCode, {
		autoIgnition: options.ignition !== "off" && options.ignition !== "false",
		autoIgnitionInvertPolarity: options.ignition === "invert"
	});

	if (result.success) {
		console.log(`Boot code successfully loaded!`);

		if (options.hex) {
			process.stdout.write("RESPONSE:");
			while (true) {
				const byte = await port.readByte(10);
				if (byte == -1)
					continue;
				process.stdout.write(sprintf(" %02X", byte));
			}
		} else if (options.follow) {
			while (true) {
				const byte = await port.readByte(10);
				if (byte == -1)
					continue;
				if (byte == 0)
					break;
				process.stdout.write(Buffer.from([byte]));
			}
		}
	} else {
		console.error(result.error);
	}

	await port.close();
}
