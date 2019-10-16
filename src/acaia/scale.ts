import { EventEmitter } from 'events';
import Sblendid, { Service } from '@sblendid/sblendid';

import {
	CHECKSUM_LENGTH,
	EVENT_TYPE,
	HEADER_LENGTH,
	HEADER1,
	HEADER2,
	MESSAGE_TYPE,
	SCALE_CHARACTERISTIC_UUID,
	SCALE_SERVICE_UUID,
} from './constants';

interface ScaleInterface {
	readonly connected: boolean;
	readonly name: string;
	readonly device: any;
	readonly service?: Service;
	readonly characteristic: any;
	readonly weight: number;
	readonly unit: string;
	readonly stable: boolean;
	readonly battery: number;
	readonly timer: Timer;
	tare(): void;
}

interface Timer {
	minutes: number;
	seconds: number;
	millis: number;
}

class Scale implements ScaleInterface {
	public connected = false;
	public name = '';
	public peripheral: any;
	public device: any;
	public service?: Service;
	public characteristic: any;
	public weight = 0;
	public unit = '';
	public stable = false;
	public battery = 0;
	public timer: Timer = { minutes: 0, seconds: 0, millis: 0 };

	private queue: Uint8Array = new Uint8Array();
	private eventEmitter = new EventEmitter();
	private checksumErrors: number = 0;

	constructor() {
		// super();

		//this.device = device;
		//this.name = this.device.name;

		this.eventEmitter.on('packet', this.handlePacket);
		this.connect();
	}

	public toString = (): string => {
		const { minutes, seconds, millis } = this.timer;

		return `${this.name} ${this.weight.toString().padStart(7)}${
			this.unit
		} ${
			this.stable ? '###' : '...'
		}   Battery: ${this.battery
			.toString()
			.padStart(3)}%   Timer: ${minutes
			.toString()
			.padStart(2, '0')}:${seconds
			.toString()
			.padStart(2, '0')}.${millis.toString().padStart(3, '0')}\r`;
	};

	tare(): null {
		throw new Error('Method not implemented.');
	}

	disconnect(): Promise<void> {
		return this.peripheral.disconnect();
	}

	async connect(): Promise<void> {
		console.log('connecting...');

		try {
			this.peripheral = await Sblendid.connect(peripheral =>
				peripheral.name.startsWith('ACAIA'),
			);

			this.service = await this.peripheral.getService(SCALE_SERVICE_UUID);
			if (this.service) {
				this.connected = true;
				this.name = this.service.peripheral.name;
				// console.log(
				// 	`Connected to ${this.service.peripheral.name}`,
				// 	this.service,
				// );

				await this.service.on(
					SCALE_CHARACTERISTIC_UUID,
					this.handleData,
				);

				await this.service.on(SCALE_CHARACTERISTIC_UUID, () =>
					process.stdout.write(this.toString() + '\r'),
				);

				setInterval(this.heartbeat.bind(this), 5000);
			} else {
				console.error('Failed connecting!');
			}
		} catch (err) {
			console.error(err);
		}
	}

	handleData = async (data: Uint8Array) => {
		const queue = new Uint8Array(this.queue.length + data.length);
		queue.set(this.queue);
		queue.set(data, this.queue.length);
		this.queue = queue;

		// Fetch and emit the next complete packet
		this.emitNextPacket();
	};

	handlePacket = async (packet: Uint8Array) => {
		const messageType = packet[2];

		// Packet payload, without header and checksum tail
		const payload = new Uint8Array(
			packet.slice(4, packet.byteLength - CHECKSUM_LENGTH),
		);

		switch (messageType) {
			case MESSAGE_TYPE.SYSTEM:
				console.log('MESSAGE_TYPE.SYSTEM', payload);
				break;

			case MESSAGE_TYPE.TARE:
				console.log('MESSAGE_TYPE.TARE', payload);
				break;

			case MESSAGE_TYPE.INFO:
				// Scale says hellooo
				console.log('MESSAGE_TYPE.INFO', payload);
				await this.service!.write(
					SCALE_CHARACTERISTIC_UUID,
					encodeId(),
				);
				break;

			case MESSAGE_TYPE.STATUS:
				// Scale communication is up
				this.battery = payload[0];
				console.log('MESSAGE_TYPE.STATUS', payload);
				//todo only if not initialised already?
				await this.service!.write(
					SCALE_CHARACTERISTIC_UUID,
					encodeNotificationRequest(),
				);
				break;

			case MESSAGE_TYPE.IDENTIFY:
				console.log('MESSAGE_TYPE.IDENTIFY', payload);
				break;

			case MESSAGE_TYPE.EVENT:
				this.handleEvent(payload);
				break;

			case MESSAGE_TYPE.TIMER:
				console.log('MESSAGE_TYPE.TIMER', payload);
				break;

			default:
				console.log('UNKNOWN MESSAGE TYPE', messageType, payload);
				break;
		}

		// Check if there are more packets to handle
		this.emitNextPacket();
	};

	emitNextPacket = (): void => {
		const packetStart = this.queue.findIndex(packetHeader);

		// The payload length is defined by the 4th byte in each packet
		const payloadLength = this.queue[packetStart + 3];

		// Total length includes 3 byte header and 2 byte checksum
		const length = payloadLength + HEADER_LENGTH + CHECKSUM_LENGTH;

		const packetEnd = packetStart + length;

		if (packetEnd <= this.queue.length) {
			// Copy packet from queue
			let packet: Uint8Array = new Uint8Array(length);
			packet = this.queue.slice(packetStart, packetEnd);

			// Remove packet from queue
			// TODO resize queue?
			this.queue = this.queue.slice(packetEnd);

			if (validateChecksum(packet)) {
				// Emit packet for further processing
				this.eventEmitter.emit('packet', packet);
			} else {
				this.checksumErrors++;
			}
		}
	};

	async heartbeat(): Promise<boolean> {
		if (this.connected) {
			try {
				await this.service!.write(
					SCALE_CHARACTERISTIC_UUID,
					encodeHeartbeat(),
					true,
				);
				return true;
			} catch (err) {
				console.error(err);
				return false;
			}
		} else {
			return false;
		}
	}

	// doesn't seem to work, and battery status is in events anyway
	async getBattery(): Promise<boolean> {
		console.log('sending battery request');
		if (!this.connected) {
			return false;
		} else {
			try {
				await this.service!.write(
					SCALE_CHARACTERISTIC_UUID,
					encodeGetBattery(),
					true,
				);
				return true;
			} catch (err) {
				console.error(err);
				return false;
			}
		}
	}

	handleEvent(data: Uint8Array) {
		const eventType = data[0];
		const eventLength = getEventLength(eventType);
		const event = data.slice(1, eventLength + 1);

		switch (eventType) {
			case EVENT_TYPE.WEIGHT:
				let value =
					((event[2] & 0xff) << 16) +
					((event[1] & 0xff) << 8) +
					(event[0] & 0xff);
				const divisor = event[4] & 0xff;
				const negative = (event[5] & 0x02) === 2;
				this.stable = (event[5] & 0x01) === 0;
				this.unit = divisor === 2 ? 'g' : divisor === 4 ? 'oz' : '';

				value /= Math.pow(10, divisor);
				value *= negative ? -1 : 1;

				this.weight = value;
				break;

			case EVENT_TYPE.BATTERY:
				this.battery = event[0] & 0xff;
				// console.log('BATTERY EVENT', this.battery);
				break;

			case EVENT_TYPE.TIMER:
				this.timer.minutes = event[0];
				this.timer.seconds = event[1];
				this.timer.millis = event[2];
				// console.log(
				// 	'TIMER EVENT',
				// 	`${this.timer.minutes}:${this.timer.seconds}.${this.timer.millis}`,
				// );
				break;

			case EVENT_TYPE.KEY:
				//console.log('KEY EVENT', event);
				break;

			case EVENT_TYPE.ACK:
				// Ack is received as a reply to the heartbeat. The reply
				// "0, 224" is the same even before identing, and doesn't seem
				// to change.
				break;

			default:
				console.log(
					'================= Unhandled event type',
					eventType,
				);
				break;
		}

		// Recursively handle multiple events in same packet
		const rest = data.slice(eventLength + 1);
		if (rest.length > 0) {
			this.handleEvent(rest);
		}
	}
}

const packetHeader = (element: number, index: number, array: Uint8Array) =>
	element === HEADER1 && array[index + 1] === HEADER2;

const validateChecksum = (packet: Uint8Array): boolean => {
	const cs = calculateChecksum(
		packet.slice(HEADER_LENGTH, packet.length - CHECKSUM_LENGTH),
	);
	const packetChecksum =
		(packet[packet.length - 1] + packet[packet.length - 2]) & 0xff;

	return cs === packetChecksum;
};

// TODO test
function calculateChecksum(data: Uint8Array): number {
	let sum = 0;

	for (let i = 0; i < data.length; i++) sum += data[i];

	return sum & 0xff;
}

function encode(msgType: any, payload: Uint8Array): Buffer {
	var buf = new ArrayBuffer(5 + payload.length);
	var bytes = new Uint8Array(buf);
	bytes[0] = HEADER1;
	bytes[1] = HEADER2;
	bytes[2] = msgType;
	var cksum1 = 0;
	var cksum2 = 0;

	for (var i = 0; i < payload.length; i++) {
		var val = payload[i] & 0xff;
		bytes[3 + i] = val;
		if (i % 2 == 0) {
			cksum1 += val;
		} else {
			cksum2 += val;
		}
	}

	bytes[payload.length + 3] = cksum1 & 0xff;
	bytes[payload.length + 4] = cksum2 & 0xff;

	return Buffer.from(buf);
}

function encodeHeartbeat() {
	const payload = new Uint8Array([2, 0]);
	return encode(MESSAGE_TYPE.SYSTEM, payload);
}

function encodeNotificationRequest() {
	const payload = new Uint8Array([
		0, // weight
		1, // weight argument (speed of notifications in 1/10 sec)
		1, // battery
		2, // battery argument (0: fast, 1: slow ?)
		2, // timer
		5, // timer argument
		3, // key
		4, // setting
	]);

	return encodeEventData(payload);
}

//todo
function encodeId() {
	const payload = new Uint8Array([
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
		0x0b,
	]);
	return encode(MESSAGE_TYPE.IDENTIFY, payload);
}

function encodeEventData(payload: Uint8Array) {
	var buf = new ArrayBuffer(payload.length + 1);
	var bytes = new Uint8Array(buf);
	bytes[0] = payload.length + 1;

	for (var i = 0; i < payload.length; i++) {
		bytes[i + 1] = payload[i] & 0xff;
	}

	return encode(MESSAGE_TYPE.EVENT, bytes);
}

function encodeGetBattery(): Buffer {
	const payload = new Uint8Array();
	return encode(EVENT_TYPE.BATTERY, payload);
}

const getEventLength = (eventType: EVENT_TYPE) => {
	switch (eventType) {
		case EVENT_TYPE.WEIGHT:
			return 6;

		case EVENT_TYPE.BATTERY:
			return 1;
		case EVENT_TYPE.TIMER:
			return 3;

		case EVENT_TYPE.KEY:
			return 1;

		case EVENT_TYPE.ACK:
			return 2;

		default:
			return -1;
	}
};

export default Scale;
