import { HEADER_LENGTH, CHECKSUM_LENGTH } from './constants';

const validateChecksum = (packet: Uint8Array): boolean => {
	const payload = packet.slice(
		HEADER_LENGTH,
		packet.length - CHECKSUM_LENGTH,
	);
	const evenChecksum = checksum(payload.filter(isEven));
	const oddChecksum = checksum(payload.filter(isOdd));

	return (
		evenChecksum === packet[packet.length - 2] &&
		oddChecksum === packet[packet.length - 1]
	);
};

const checksum = (data: Uint8Array): number =>
	data.reduce((prev, curr) => prev + curr, 0) & 0xff;

const isOdd = (v: number, index: number) => index % 2;
const isEven = (v: number, index: number) => !(index % 2);

export { validateChecksum };
