import { AsyncSerialPort, BFB, type IoReadWriteOptions } from "@sie-js/serial";
import { SerialPort } from "serialport";
import type { DisplayBufferData, Screenshotter } from "./Screenshotter.js";

export class BfbScreenshotter implements Screenshotter {
	private constructor(private readonly bfb: BFB) { }

	static async connect(path: string, limitBaudrate: number): Promise<BfbScreenshotter> {
		console.info(`Connecting to the phone using port ${path} (BFB)...`);
		const port = new AsyncSerialPort(new SerialPort({ path, baudRate: 115200, autoOpen: false }));
		await port.open();
		const bfb = new BFB(port);
		try {
			await bfb.connect();
			if (!await bfb.setBestBaudrate(limitBaudrate))
				throw new Error("Error while setting baudrate!");
			return new BfbScreenshotter(bfb);
		} catch (error) {
			await port.close();
			throw error;
		}
	}

	async getDisplayBuffer(_displayId: number, options?: IoReadWriteOptions): Promise<DisplayBufferData> {
		const response = await this.bfb.getDisplayBuffer(options);
		return {
			...response,
			displayWidth: response.width,
			displayHeight: response.height,
		};
	}

	async disconnect(): Promise<void> {
		const port = this.bfb.getSerialPort();
		if (port?.isOpen) {
			await this.bfb.disconnect();
			await port.close();
		}
	}
}
