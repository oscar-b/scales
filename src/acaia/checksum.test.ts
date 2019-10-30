import { validateChecksum } from './checksum';

describe('validateChecksum', () => {
	test('validates packets successfully', () => {
		const packets = [
			new Uint8Array([239, 221, 12, 8, 5, 4, 0, 0, 0, 2, 2, 14, 7]),
			new Uint8Array([239, 221, 8, 9, 47, 2, 2, 3, 0, 0, 0, 1, 15, 49]),
			new Uint8Array([239, 221, 7, 7, 2, 20, 2, 60, 5, 0, 87, 9]),
		];
		packets.forEach(packet => expect(validateChecksum(packet)).toBeTruthy);
	});

	test('fails checksum check for damaged packets', () => {
		const packets = [
			new Uint8Array([239, 221, 12, 8, 4, 5, 0, 0, 0, 2, 2, 14, 7]),
			new Uint8Array([239, 221, 12, 8, 4, 5, 0, 0, 0, 2, 2, 14]),
			new Uint8Array([239, 221, 8, 9, 47, 2, 2, 3, 0, 0, 0, 0, 15, 49]),
			new Uint8Array([239, 221, 8, 9, 47, 2, 2, 3, 0, 0, 0, 0, 0, 49]),
		];
		packets.forEach(packet => expect(validateChecksum(packet)).toBeFalsy);
	});
});
