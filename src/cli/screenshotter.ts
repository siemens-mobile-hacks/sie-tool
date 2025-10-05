import { AppCommand, onCleanup } from "#src/utils/command.js";
import { CLIBaseOptions } from "#src/cli.js";
import { connectBFC, disconnectBFC } from "#src/utils/serial.js";
import cliProgress from "cli-progress";
import { getBitmapDecoder } from "#src/utils/bitmap.js";
import fs from "node:fs";
import { BfcDisplayBufferData } from "@sie-js/serial";
import { DateTime } from "luxon";
import { JimpInstance, Jimp } from "jimp";

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

	const image = createImageFromBuffer(response);
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

function createImageFromBuffer(response: BfcDisplayBufferData): JimpInstance {
	let type = response.type;
	let isMask = false;
	if (type == 'bgra8888mask') {
		type = 'bgra8888';
		isMask = true;
	}

	const image = new Jimp({
		width: response.width,
		height: response.height,
	});

	const getBitmapPixel = getBitmapDecoder(type);
	for (let y = 0; y < response.height; y++) {
		for (let x = 0; x < response.width; x++) {
			let color = getBitmapPixel(x, y, response.width, response.height, response.buffer);
			if (isMask) { // EL71 in camera
				const mask = (color & 0xFF000000) >>> 24;
				color = mask == 0x8D ? 0xFF00FF00 : (color | 0xFF000000) >>> 0;
			}
			const offset = (y * image.bitmap.width + x) * 4;
			image.bitmap.data.writeUInt32LE(color, offset);
		}
	}

	// C72 shit
	if (response.displayWidth < response.width || response.displayHeight < response.height) {
		const x = Math.round((response.width - response.displayWidth) / 2);
		const y = Math.round((response.height - response.displayHeight) / 2);
		return image.crop({ x, y, w: response.displayWidth, h: response.displayHeight }) as JimpInstance;
	}

	return image;
}
