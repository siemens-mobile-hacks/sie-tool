import { AsyncSerialPort, BFC, type BfcDisplayBufferData, type IoReadWriteOptions } from "@sie-js/serial";
import { SerialPort } from "serialport";
import type { Screenshotter } from "./Screenshotter.js";

export class BfcScreenshotter implements Screenshotter {
	private constructor(private readonly bfc: BFC) { }

	static async connect(path: string, limitBaudrate: number): Promise<BfcScreenshotter> {
		console.info(`Connecting to the phone using port ${path} (BFC)...`);
		const port = new AsyncSerialPort(new SerialPort({ path, baudRate: 112500, autoOpen: false }));
		await port.open();
		const bfc = new BFC(port);
		try {
			await bfc.connect();
			await bfc.setBestBaudrate(limitBaudrate);
			return new BfcScreenshotter(bfc);
		} catch (error) {
			await port.close();
			throw error;
		}
	}

	getDisplayBuffer(displayId: number, options?: IoReadWriteOptions): Promise<BfcDisplayBufferData> {
		return this.bfc.getDisplayBuffer(displayId, options);
	}

	async disconnect(): Promise<void> {
		const port = this.bfc.getSerialPort();
		if (port?.isOpen) {
			await this.bfc.disconnect();
			await port.close();
		}
	}
}
