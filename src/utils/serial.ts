import { AsyncSerialPort, BFC, CGSN } from "@sie-js/serial";
import { SerialPort } from "serialport";

const USB_DEVICES = [
	"067B:2303",	// PL2303
	"1A86:7523",	// CH340
	"0403:6001",	// FT232
	"10C4:EA60",	// СР2102
	"11F5:*",		// Siemens
];

export async function connectCGSN(path: string, limitBaudrate: number): Promise<CGSN> {
	console.info(`Connecting to the phone using port ${path} (CGSN)...`);

	const port = new AsyncSerialPort(new SerialPort({
		path,
		baudRate: 112500,
		autoOpen: false
	}));
	await port.open();

	const cgsn = new CGSN(port);
	if (!await cgsn.connect()) {
		await port.close();
		console.error(`Error while connecting to the phone!`);
		throw new Error("Error while connecting to the phone!");
	}

	if (!await cgsn.setBestBaudRate(limitBaudrate)) {
		await port.close();
		console.error(`Error while setting baudrate!`);
		throw new Error("Error while setting baudrate!");
	}

	return cgsn;
}

export async function disconnectCGSN(cgsn: CGSN): Promise<void> {
	const port = cgsn.getSerialPort();
	if (port?.isOpen) {
		await cgsn.disconnect();
		await port.close();
	}
}

export async function connectBFC(path: string, limitBaudrate: number): Promise<BFC> {
	console.info(`Connecting to the phone using port ${path} (BFC)...`);

	const port = new AsyncSerialPort(new SerialPort({
		path,
		baudRate: 112500,
		autoOpen: false
	}));
	await port.open();

	const bfc = new BFC(port);
	try {
		await bfc.connect();
		await bfc.setBestBaudrate(limitBaudrate);
	} catch (e) {
		await port.close();
		console.error(`Error while connecting to the phone!`);
		throw e;
	}

	return bfc;
}

export async function disconnectBFC(bfc: BFC): Promise<void> {
	const port = bfc.getSerialPort();
	if (port?.isOpen) {
		await bfc.disconnect();
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
