import fs from "node:fs";
import cliProgress from "cli-progress";
import { DateTime } from "luxon";
import { Jimp } from "jimp";
import { AppCommandValidateError, onCleanup, type AppCommand } from "#src/utils/command.js";
import { getBitmapDecoder } from "#src/utils/bitmap.js";
import { probePhonePlatform } from "#src/utils/serial.js";
import { BfbScreenshotter } from "./BfbScreenshotter.js";
import { BfcScreenshotter } from "./BfcScreenshotter.js";
import type { CLIMakeScreenshotOptions, DecodedDisplayBuffer, DisplayBufferData, Screenshotter } from "./Screenshotter.js";

export const cliMakeScreenshot: AppCommand<CLIMakeScreenshotOptions> = async (options) => {
	const displayIndex = Number(options.display ?? 0);
	const screenshotter = await connectScreenshotter(options, displayIndex);
	onCleanup(() => screenshotter.disconnect());

	const pb = new cliProgress.SingleBar({
		format: ' [{bar}] {percentage}% | ETA: {eta}s | {speed} kB/s'
	}, cliProgress.Presets.legacy);
	const response = await screenshotter.getDisplayBuffer(displayIndex + 1, {
		onProgress: (e) => {
			if (e.cursor == 0) {
				pb.start(e.total, 0, { speed: "N/A" });
			} else {
				pb.update(e.cursor, {
					speed: e.elapsed ? +((e.cursor / (e.elapsed / 1000)) / 1024).toFixed(2) : 'N/A',
				});
			}
		},
	});
	pb.stop();

	const defaultFilename = `Screenshot_${DateTime.now().toFormat('yyyyLLdd_HHmmss')}.png`;
	let outputFilename = options.output ?? defaultFilename;
	if (options.output && isDir(options.output))
		outputFilename = `${options.output}/${defaultFilename}`;
	const decoded = decodeDisplayBuffer(response);
	const image = new Jimp({ width: decoded.width, height: decoded.height });
	image.bitmap.data.set(decoded.data);
	console.log(`Saving screenshot to ${outputFilename}`);
	await image.write(outputFilename as `${string}.${string}`);
}

function isDir(path: string): boolean {
	return path.endsWith('/') || path.endsWith('\\') || fs.existsSync(path) && fs.statSync(path).isDirectory();
}

async function connectScreenshotter(options: CLIMakeScreenshotOptions, displayIndex: number): Promise<Screenshotter> {
	switch (options.protocol.toLowerCase()) {
		case "auto": {
			console.info(`Probing phone platform using port ${options.port}...`);
			const platform = await probePhonePlatform(options.port);
			console.info(`Detected phone platform: ${platform.toUpperCase()}`);
			const protocolByPlatform = {
				egold: "bfb",
				sgold: "bfc",
			} as const;
			return connectScreenshotter({
				...options,
				protocol: protocolByPlatform[platform],
			}, displayIndex);
		}
		case "bfb":
			if (displayIndex != 0)
				throw new AppCommandValidateError("BFB supports only display 0.");
			return BfbScreenshotter.connect(options.port, +options.baudrate);
		case "bfc":
			return BfcScreenshotter.connect(options.port, +options.baudrate);
		default:
			throw new AppCommandValidateError(`Unsupported screenshot protocol "${options.protocol}". Use auto, bfc, or bfb.`);
	}
}

function decodeDisplayBuffer(response: DisplayBufferData): DecodedDisplayBuffer {
	let type = response.type;
	let isYuvMask = false;
	if (type == 'argb8888+yuv') {
		type = 'argb8888';
		isYuvMask = true;
	}

	const clamp8 = (v: number): number => Math.max(0, Math.min(255, v));
	const decodeYUV = (y: number, u: number, v: number): number => {
		const d = u - 128;
		const e = v - 128;
		const r = clamp8((298 * y + 409 * e + 128) >> 8);
		const g = clamp8((298 * y - 100 * d - 208 * e + 128) >> 8);
		const b = clamp8((298 * y + 516 * d + 128) >> 8);
		return 0xFF000000 | (b << 16) | (g << 8) | r;
	};

	const image: DecodedDisplayBuffer = {
		width: response.displayWidth,
		height: response.displayHeight,
		data: Buffer.alloc(response.displayWidth * response.displayHeight * 4),
	};
	const getPixel = getBitmapDecoder(type);
	for (let y = 0; y < response.height; y++) {
		for (let x = 0; x < response.width; x++) {
			let color = getPixel(x, y, response.width, response.height, response.buffer);
			if (isYuvMask) {
				const mask = (color & 0xFF000000) >>> 24;
				if (mask == 0x8D) {
					color = decodeYUV(color & 0xFF, (color >>> 8) & 0xFF, (color >>> 16) & 0xFF) >>> 0;
				} else {
					color = (color | 0xFF000000) >>> 0;
				}
			}
			image.data.writeUInt32LE(color, (y * image.width + x) * 4);
		}
	}

	if (response.displayWidth >= response.width && response.displayHeight >= response.height)
		return image;
	const x = Math.round((response.width - response.displayWidth) / 2);
	const y = Math.round((response.height - response.displayHeight) / 2);
	return cropImage(image, x, y, response.displayWidth, response.displayHeight);
}

function cropImage(image: DecodedDisplayBuffer, x: number, y: number, width: number, height: number): DecodedDisplayBuffer {
	const result: DecodedDisplayBuffer = {
		width,
		height,
		data: Buffer.alloc(width * height * 4),
	};
	for (let row = 0; row < height; row++) {
		const sourceOffset = ((y + row) * image.width + x) * 4;
		image.data.copy(result.data, row * width * 4, sourceOffset, sourceOffset + width * 4);
	}
	return result;
}
