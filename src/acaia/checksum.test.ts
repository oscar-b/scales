import { validateChecksum } from './checksum';

describe('validateChecksum', () => {
	test('validates packets successfully', () => {
		const packet1 = new Uint8Array([
			239,
			221,
			12,
			8,
			5,
			4,
			0,
			0,
			0,
			2,
			2,
			14,
			7,
		]);
		const packet2 = new Uint8Array([
			239,
			221,
			8,
			9,
			47,
			2,
			2,
			3,
			0,
			0,
			0,
			1,
			15,
			49,
		]);
		const packet3 = new Uint8Array([239, 221, 0, 2, 254, 2, 254]);
		expect(validateChecksum(packet1)).toBeTruthy();
		expect(validateChecksum(packet2)).toBeTruthy();
		expect(validateChecksum(packet3)).toBeTruthy();
	});

	test('fails checksum check for damaged packets', () => {
		const packet1 = new Uint8Array([
			239,
			221,
			12,
			8,
			5,
			4,
			0,
			0,
			0,
			2,
			2,
			14,
		]);
		const packet2 = new Uint8Array([
			239,
			221,
			12,
			4,
			5,
			4,
			0,
			0,
			0,
			2,
			2,
			14,
			7,
		]);
		expect(validateChecksum(packet1)).toBeFalsy();
		expect(validateChecksum(packet2)).toBeFalsy();
	});
});
