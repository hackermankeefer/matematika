const assert = require('node:assert/strict');
const test = require('node:test');
const assistantApi = require('../api/assistant');

function createResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; }
    };
}

function withEnvironment(values, callback) {
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    for (const [key, value] of Object.entries(values)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
    return Promise.resolve().then(callback).finally(() => {
        for (const [key, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
    });
}

test('Gemini proxy rejects non-POST requests', async () => {
    const response = createResponse();
    await assistantApi({ method: 'GET', headers: {} }, response);
    assert.equal(response.statusCode, 405);
    assert.equal(response.headers.allow, 'POST');
});

test('Gemini proxy reports missing server-side credentials without calling Google', async () => {
    await withEnvironment({ GEMINI_API_KEY: undefined }, async () => {
        const response = createResponse();
        await assistantApi({ method: 'POST', headers: {}, body: { messages: [] } }, response);
        assert.equal(response.statusCode, 400, 'request shape is checked before provider configuration');

        const validResponse = createResponse();
        await assistantApi({
            method: 'POST',
            headers: {},
            body: { messages: [{ role: 'system', content: 'Tutor.' }, { role: 'user', content: 'Hi?' }] }
        }, validResponse);
        assert.equal(validResponse.statusCode, 503);
        assert.match(validResponse.body.error, /not configured/i);
    });
});

test('Gemini proxy translates chat messages and structured output while keeping the key server-side', async () => {
    const previousFetch = globalThis.fetch;
    let upstreamUrl;
    let upstreamOptions;
    globalThis.fetch = async (url, options) => {
        upstreamUrl = String(url);
        upstreamOptions = options;
        return {
            ok: true,
            async json() {
                return { candidates: [{ content: { parts: [{ text: '{"answer":"9"}' }] } }] };
            }
        };
    };

    try {
        await withEnvironment({ GEMINI_API_KEY: 'server-only-test-key', GEMINI_MODEL: 'gemini-3.5-flash-lite' }, async () => {
            const response = createResponse();
            await assistantApi({
                method: 'POST',
                headers: { host: 'math.test', origin: 'https://math.test', 'x-forwarded-for': '203.0.113.10' },
                body: {
                    messages: [
                        { role: 'system', content: 'Use the course notes.' },
                        { role: 'user', content: 'Given f(x)=2x+1, find f(4).' },
                        { role: 'assistant', content: 'Substitute 4.' },
                        { role: 'user', content: 'What is 2(4)+1?' }
                    ],
                    format: {
                        type: 'object',
                        properties: {
                            answer: { type: 'string' },
                            working: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['answer'],
                        additionalProperties: false
                    }
                }
            }, response);

            assert.equal(response.statusCode, 200);
            assert.deepEqual(response.body, { message: { content: '{"answer":"9"}' } });
            assert.equal(upstreamUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
            assert.equal(upstreamOptions.headers['x-goog-api-key'], 'server-only-test-key');
            assert.equal(upstreamUrl.includes('server-only-test-key'), false);
            const payload = JSON.parse(upstreamOptions.body);
            assert.equal(payload.systemInstruction.parts[0].text, 'Use the course notes.');
            assert.deepEqual(payload.contents.map(message => message.role), ['user', 'model', 'user']);
            assert.equal(payload.generationConfig.responseMimeType, 'application/json');
            assert.equal(payload.generationConfig.responseSchema.type, 'OBJECT');
            assert.equal(payload.generationConfig.responseSchema.properties.working.items.type, 'STRING');
            assert.equal(payload.generationConfig.maxOutputTokens, 768);
            assert.equal(response.headers['cache-control'], 'no-store');
        });
    } finally {
        globalThis.fetch = previousFetch;
    }
});
