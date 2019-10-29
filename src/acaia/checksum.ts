import { HEADER_LENGTH, CHECKSUM_LENGTH } from './constants';

const validateChecksum = (packet: Uint8Array): boolean => {
	const calculatedChecksum = checksum(
		packet.slice(HEADER_LENGTH, packet.length - CHECKSUM_LENGTH),
	);

	const packetChecksum = checksum(packet.slice(CHECKSUM_LENGTH * -1));

	return calculatedChecksum === packetChecksum;
};

const checksum = (data: Uint8Array): number =>
	data.reduce((prev, curr) => prev + curr, 0) & 0xff;

export { validateChecksum };
