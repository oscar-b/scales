import { HEADER1, HEADER2 } from './constants';
import { isPacketHeader } from './packet';

describe('isPacketHeader', () => {
	test('finds packet first in queue', () => {
		const queue = new Uint8Array([HEADER1, HEADER2, 0, 1, 2, 3]);

		expect(queue.findIndex(isPacketHeader)).toEqual(0);
	});

	test('finds first packet', () => {
		const queue = new Uint8Array([0, 1, 2, HEADER1, HEADER2, 4, HEADER1]);

		expect(queue.findIndex(isPacketHeader)).toEqual(3);
	});

	test('finds first packet and ignore incomplete header', () => {
		const queue = new Uint8Array([0, 1, 2, HEADER1, 4, HEADER1, HEADER2]);

		expect(queue.findIndex(isPacketHeader)).toEqual(5);
	});
});
