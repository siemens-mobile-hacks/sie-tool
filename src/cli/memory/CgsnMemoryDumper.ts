import { AsyncSerialPort, CGSN, type IoReadResult, type IoReadWriteOptions } from "@sie-js/serial";
import { SerialPort } from "serialport";
import type { MemoryDumper, PhoneInfo } from "./MemoryDumper.js";

export class CgsnMemoryDumper implements MemoryDumper {
	private constructor(private readonly cgsn: CGSN) { }

	static async connect(path: string, limitBaudrate: number): Promise<CgsnMemoryDumper> {
		console.info(`Connecting to the phone using port ${path} (CGSN)...`);
		const port = new AsyncSerialPort(new SerialPort({ path, baudRate: 112500, autoOpen: false }));
		await port.open();
		const cgsn = new CGSN(port);
		if (!await cgsn.connect() || !await cgsn.setBestBaudRate(limitBaudrate)) {
			await port.close();
			throw new Error("Error while connecting to the phone!");
		}
		return new CgsnMemoryDumper(cgsn);
	}

	async readMemory(addr: number, size: number, options?: IoReadWriteOptions): Promise<IoReadResult> {
		const result = await this.cgsn.readMemory(addr, size, options);
		if (!result.success)
			throw new Error(result.error);
		return result;
	}

	async getPhoneInfo(): Promise<PhoneInfo> {
		const atc = this.cgsn.getAtChannel();
		const getInfo = async (command: string): Promise<string> => {
			const response = await atc.sendCommand(command);
			if (!response.success)
				throw new Error(`${command} failed!`);
			return response.lines[0];
		};

		const vendor = await getInfo("AT+CGMI");
		const model = await getInfo("AT+CGMM");
		const version = (await getInfo("AT+CGMR")).match(/^\s*(\d+)/)?.[0] ?? "UNKNOWN";
		console.log(`Detected phone: ${vendor} ${model}v${version}`);

		const regions = await this.cgsn.getMemoryRegions();
		if (!regions.success)
			throw new Error("Failed to get memory regions!");
		return { name: `${model}v${version}`, regions: regions.regions };
	}

	async disconnect(): Promise<void> {
		const port = this.cgsn.getSerialPort();
		if (port?.isOpen) {
			await this.cgsn.disconnect();
			await port.close();
		}
	}
}
