import { CLIBaseOptions } from "#src/cli.js";
import { AppCommand } from "#src/utils/command.js";
import { SerialPort } from "serialport";
import { getUSBDeviceName } from "@sie-js/serial";
import { sprintf } from "sprintf-js";

export const cliListSerialPorts: AppCommand<CLIBaseOptions> = async (options) => {
	for (let p of await SerialPort.list()) {
		if (p.productId != null) {
			const vid = parseInt(p.vendorId!, 16);
			const pid = parseInt(p.productId!, 16);
			const usbName = getUSBDeviceName(vid, pid);
			const isDefault = p.path === options.port;
			console.log(sprintf("%s %04x:%04x %s%s", p.path, vid, pid, usbName ?? p.manufacturer, (isDefault ? " <-- selected" : "")));
		}
	}
}
