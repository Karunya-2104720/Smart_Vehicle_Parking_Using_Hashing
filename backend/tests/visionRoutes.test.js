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
        assert.strictEqual(detectorHealth.status, 503);
        assert.strictEqual((await detectorHealth.json()).ready, false);

        const unavailableDetector = await fetch(`${baseUrl}/api/vision/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: Buffer.from([0xff, 0xd8, 0xff])
        });
        assert.strictEqual(unavailableDetector.status, 503);
        const unavailableResult = await unavailableDetector.json();
        assert.strictEqual(unavailableResult.success, false);
        console.log('PASS YOLO routes validate input and report unavailable service clearly');
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
