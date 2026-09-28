import { AsyncSerialPort, AtChannel } from "@sie-js/serial";
import { SerialPort } from "serialport";

const USB_DEVICES = [
	"067B:2303",	// PL2303
	"1A86:7523",	// CH340
	"0403:6001",	// FT232
	"10C4:EA60",	// СР2102
	"11F5:*",		// Siemens
];

export type PhonePlatform = "egold" | "sgold";

function parseSqwePlatform(lines: string[]): PhonePlatform | undefined {
	for (const line of lines) {
		if (/^\s*\^SBFB\s*:/i.test(line))
			return "egold";

		if (/^\s*\^SQWE\s*:/i.test(line))
			return /\b5\b/.test(line) ? "sgold" : "egold";
	}
	return undefined;
}

export async function probePhonePlatform(path: string): Promise<PhonePlatform> {
	const port = new AsyncSerialPort(new SerialPort({
		path,
		baudRate: 115200,
		autoOpen: false
	}));
	await port.open();

	const atc = new AtChannel(port);
	try {
		atc.start();
		if (!await atc.handshake())
			throw new Error("AT handshake failed.");

		const attempts: string[] = [];
		for (const command of ["AT^SQWE=?", "AT^SBFB=?"]) {
			const response = await atc.sendCommandNoPrefixAll(command, 2000);
			if (!response.success) {
				attempts.push(`${command}: ${response.status}`);
				continue;
			}

			const platform = parseSqwePlatform(response.lines);
			if (platform)
				return platform;
			attempts.push(`${command}: ${response.lines.join(" | ") || "empty response"}`);
		}

		throw new Error(`No known platform response (${attempts.join("; ")}).`);
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		throw new Error(`Automatic platform detection failed: ${message} Specify --protocol explicitly.`);
	} finally {
		atc.stop();
		if (port.isOpen)
			await port.close();
	}
}

export async function getDefaultPort() {
	const availablePorts = (await SerialPort.list()).filter((d) => {
		return USB_DEVICES.includes(`${d.vendorId}:${d.productId}`.toUpperCase());
	});
	let defaultPort = availablePorts.length > 0 ? availablePorts[0].path : null;
	if (!defaultPort)
		defaultPort = (process.platform === "win32" ? "COM4" : "/dev/ttyUSB0");
	return defaultPort;
}
