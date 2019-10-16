import Scale from './scale';

const acaia = new Scale();

process.on('SIGINT', async () => {
	console.log('SIGINT');
	// Do some cleanup such as close db
	if (acaia.connected) {
		console.log('Scale connected...');
		await acaia.disconnect();
		console.log('Disconnected!', acaia.peripheral);
	}
	process.exit(0);
});
