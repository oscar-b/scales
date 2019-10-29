import { HEADER1, HEADER2 } from './constants';

const isPacketHeader = (element: number, index: number, array: Uint8Array) =>
	element === HEADER1 && array[index + 1] === HEADER2;

export { isPacketHeader };
