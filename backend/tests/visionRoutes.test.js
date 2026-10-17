const assert = require('assert');

process.env.NODE_ENV = 'test';
const app = require('../server');

async function run() {
    const server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
        const malformedImage = await fetch(`${baseUrl}/api/vision/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: Buffer.from('not-an-image')
        });
        assert.strictEqual(malformedImage.status, 400);

        const detectorHealth = await fetch(`${baseUrl}/api/vision/health`);
        assert.ok([200, 503].includes(detectorHealth.status));
        const healthData = await detectorHealth.json();
        assert.strictEqual(typeof healthData.ready, 'boolean');

        const testImageResponse = await fetch(`${baseUrl}/api/vision/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
        });
        assert.ok([200, 400, 503].includes(testImageResponse.status));
        console.log('PASS YOLO routes validate input and handle service status cleanly');
    } finally {
        await new Promise((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
