import { AppCommand, onCleanup } from "#src/utils/command.js";
import { CLIBaseOptions } from "#src/cli.js";
import { connectBFC, disconnectBFC } from "#src/utils/serial.js";
import cliProgress from "cli-progress";
import { getBitmapDecoder } from "#src/utils/bitmap.js";
import fs from "node:fs";
import { BfcDisplayBufferData } from "@sie-js/serial";
import { DateTime } from "luxon";
import { Jimp } from "jimp";

interface BfcDisplayDecodedBuffer {
	width: number;
	height: number;
	data: Buffer;
}

export interface CLIMakeScreenshotOptions extends CLIBaseOptions {
	display?: string;
	output?: string;
}

export const cliMakeScreenshot: AppCommand<CLIMakeScreenshotOptions> = async (options) => {
	const bus = await connectBFC(options.port, +options.baudrate);
	onCleanup(() => disconnectBFC(bus));

	const displayIndex = Number(options.display ?? 0);
	const displayId = displayIndex + 1;

	const pb = new cliProgress.SingleBar({
		format: ' [{bar}] {percentage}% | ETA: {eta}s | {speed} kB/s'
	}, cliProgress.Presets.legacy);

	const response = await bus.getDisplayBuffer(displayId, {
		onProgress: (e) => {
			if (e.cursor == 0) {
				pb.start(e.total, 0, {
					speed: "N/A"
				});
			} else {
				pb.update(e.cursor, {
					speed: e.elapsed ? +((e.cursor / (e.elapsed / 1000)) / 1024).toFixed(2) : 'N/A',
				});
			}
		}
	});
	pb.stop();

	const defaultFilename = `Screenshot_${DateTime.now().toFormat('yyyyLLdd_HHmmss')}.png`;
	const outputFilename = options.output && isDir(options.output) ?
		`${options.output}/${defaultFilename}` : options.output ?? defaultFilename;

	const decodedImage = decodeBfcDisplayBuffer(response);
	const image = new Jimp({
		width: decodedImage.width,
		height: decodedImage.height,
	});
	image.bitmap.data.set(decodedImage.data);
	console.log(`Saving screenshot to ${outputFilename}`);
	await image.write(outputFilename as `${string}.${string}`);
}

function isDir(path: string) {
	if (path.endsWith('/') || path.endsWith('\\'))
		return true;
	if (fs.existsSync(path))
		return fs.statSync(path).isDirectory();
	return false;
}

export function decodeBfcDisplayBuffer(response: BfcDisplayBufferData): BfcDisplayDecodedBuffer {
	let type = response.type;
	let isYuvMask = false;
	if (type == 'argb8888+yuv') {
		type = 'argb8888';
		isYuvMask = true;
	}

	const clamp8 = (v: number): number => {
		return v < 0 ? 0 : v > 255 ? 255 : v;
	};

	const decodeYUV = (y: number, u: number, v: number): number => {
		const d = u - 128;
		const e = v - 128;
		const r = clamp8((298 * y + 409 * e + 128) >> 8);
		const g = clamp8((298 * y - 100 * d - 208 * e + 128) >> 8);
		const b = clamp8((298 * y + 516 * d + 128) >> 8);
		return 0xFF000000 | (b << 16) | (g << 8) | r;
	};

	const image: BfcDisplayDecodedBuffer = {
		width: response.displayWidth,
		height: response.displayHeight,
		data: Buffer.alloc(response.displayWidth * response.displayHeight * 4),
	};
	const getBitmapPixel = getBitmapDecoder(type);
	for (let y = 0; y < response.height; y++) {
		for (let x = 0; x < response.width; x++) {
			let color = getBitmapPixel(x, y, response.width, response.height, response.buffer);
			if (isYuvMask) { // EL71 in camera
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

	const cropImage = (x: number, y: number, w: number, h: number): BfcDisplayDecodedBuffer => {
		const out: BfcDisplayDecodedBuffer = {
			width: w,
			height: h,
			data: Buffer.alloc(w * h * 4),
		};

		const src = image.data;
		const dst = out.data;

		const stride = image.width * 4;
		const bytesPerRow = w * 4;

		for (let row = 0; row < h; row++) {
			const offsetSrc = (y + row) * stride + x * 4;
			const offsetDst = row * bytesPerRow;
			src.copy(dst, offsetDst, offsetSrc, offsetSrc + bytesPerRow);
		}

		return out;
	};

	// C72 shit
	if (response.displayWidth < response.width || response.displayHeight < response.height) {
		const x = Math.round((response.width - response.displayWidth) / 2);
		const y = Math.round((response.height - response.displayHeight) / 2);
		return cropImage(x, y, response.displayWidth, response.displayHeight);
	}

	return image;
}
