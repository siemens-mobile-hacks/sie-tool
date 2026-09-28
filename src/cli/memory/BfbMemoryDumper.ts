import { AsyncSerialPort, BFB, type IoReadResult, type IoReadWriteOptions } from "@sie-js/serial";
import { SerialPort } from "serialport";
import type { MemoryDumper, PhoneInfo } from "./MemoryDumper.js";

export class BfbMemoryDumper implements MemoryDumper {
	private constructor(private readonly bfb: BFB) { }

	static async connect(path: string, limitBaudrate: number): Promise<BfbMemoryDumper> {
		console.info(`Connecting to the phone using port ${path} (BFB)...`);
		const port = new AsyncSerialPort(new SerialPort({ path, baudRate: 115200, autoOpen: false }));
		await port.open();
		const bfb = new BFB(port);
		try {
			await bfb.connect();
			if (!await bfb.setBestBaudrate(limitBaudrate))
				throw new Error("Error while setting baudrate!");
			return new BfbMemoryDumper(bfb);
		} catch (error) {
			await port.close();
			throw error;
		}
	}

	readMemory(addr: number, size: number, options?: IoReadWriteOptions): Promise<IoReadResult> {
		return this.bfb.readMemory(addr, size, options);
	}

	async getPhoneInfo(): Promise<PhoneInfo> {
		const model = await this.bfb.getPhoneModel();
		const version = (await this.bfb.getFirmwareVersion()).toString(16).padStart(2, "0").toUpperCase();
		console.log(`Detected phone: SIEMENS ${model}v${version}`);
		return {
			name: `${model}v${version}`,
			regions: await this.bfb.getMemoryRegions(),
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
