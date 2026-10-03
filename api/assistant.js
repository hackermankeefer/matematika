const MAX_BODY_BYTES = 48_000;
const MAX_MESSAGES = 8;
const MAX_MESSAGE_CHARACTERS = 16_000;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_RATE_BUCKETS = 5_000;
const RATE_WINDOW_MS = 60_000;
// Best-effort protection only: serverless instances do not share this in-memory map.
const rateBuckets = new Map();

function sendJson(response, status, body) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    return response.status(status).json(body);
}

function parseBody(body) {
    if (typeof body === 'string') return JSON.parse(body);
    if (Buffer.isBuffer(body)) return JSON.parse(body.toString('utf8'));
    return body;
}

function validateRequest(body) {
    if (!body || !Array.isArray(body.messages) || body.messages.length < 2 || body.messages.length > MAX_MESSAGES) {
        return 'A request must contain 2 to 8 conversation messages.';
    }

    let characterCount = 0;
    for (const message of body.messages) {
        if (!message || !['system', 'user', 'assistant'].includes(message.role)
            || typeof message.content !== 'string' || !message.content.trim()) {
            return 'Each conversation message needs a supported role and non-empty text.';
        }
        characterCount += message.content.length;
    }
    if (characterCount > MAX_MESSAGE_CHARACTERS) return 'The conversation is too large.';
    return '';
}

function mapSchema(schema, depth = 0) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema) || depth > 8) return undefined;
    const mapped = {};
    if (typeof schema.type === 'string') mapped.type = schema.type.toUpperCase();
    if (Array.isArray(schema.required)) mapped.required = schema.required.filter(item => typeof item === 'string').slice(0, 64);
    if (Array.isArray(schema.enum)) mapped.enum = schema.enum.slice(0, 100);
    if (typeof schema.description === 'string') mapped.description = schema.description;
    if (schema.properties && typeof schema.properties === 'object') {
        mapped.properties = Object.fromEntries(
            Object.entries(schema.properties).slice(0, 64).map(([key, value]) => [key, mapSchema(value, depth + 1)])
        );
    }
    if (schema.items) mapped.items = mapSchema(schema.items, depth + 1);
    return mapped;
}

function allowRequest(ip, now = Date.now()) {
    if (!ip) return true;
    for (const [key, bucket] of rateBuckets) {
        if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
    if (rateBuckets.size >= MAX_RATE_BUCKETS && !rateBuckets.has(ip)) {
        const oldestKey = rateBuckets.keys().next().value;
        if (oldestKey) rateBuckets.delete(oldestKey);
    }

    const bucket = rateBuckets.get(ip);
    if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
        rateBuckets.set(ip, { startedAt: now, count: 1 });
        return true;
    }
    if (bucket.count >= MAX_REQUESTS_PER_MINUTE) return false;
    bucket.count += 1;
    return true;
}

async function assistant(request, response) {
    if (request.method !== 'POST') {
        response.setHeader('Allow', 'POST');
        return sendJson(response, 405, { error: 'Use POST to send an assistant question.' });
    }

    const requestHost = String(request.headers?.['x-forwarded-host'] || request.headers?.host || '')
        .split(',')[0].trim().toLowerCase();
    const origin = request.headers?.origin;
    if (origin && requestHost) {
        try {
            if (new URL(origin).host.toLowerCase() !== requestHost) {
                return sendJson(response, 403, { error: 'Cross-origin assistant requests are not allowed.' });
            }
        } catch {
            return sendJson(response, 403, { error: 'Invalid request origin.' });
        }
    }

    let body;
    try {
        body = parseBody(request.body);
    } catch {
        return sendJson(response, 400, { error: 'Request body must be valid JSON.' });
    }
    let bodySize;
    try {
        bodySize = Buffer.byteLength(JSON.stringify(body ?? null), 'utf8');
    } catch {
        return sendJson(response, 400, { error: 'Request body must be JSON data.' });
    }
    if (bodySize > MAX_BODY_BYTES) return sendJson(response, 413, { error: 'The request is too large.' });

    const validationError = validateRequest(body);
    if (validationError) return sendJson(response, 400, { error: validationError });

    const forwardedFor = request.headers?.['x-forwarded-for'];
    const clientIp = String(forwardedFor || request.socket?.remoteAddress || '').split(',')[0].trim();
    if (!allowRequest(clientIp)) {
        return sendJson(response, 429, { error: 'Too many questions. Please wait a minute and try again.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return sendJson(response, 503, { error: 'Gemini is not configured for this deployment.' });

    const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
    if (!/^[a-zA-Z0-9._-]+$/.test(model)) return sendJson(response, 500, { error: 'The configured Gemini model name is invalid.' });

    const systemMessage = body.messages.find(message => message.role === 'system');
    const contents = body.messages
        .filter(message => message.role !== 'system')
        .map(message => ({
            role: message.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: message.content }]
        }));
    if (!contents.length || contents[contents.length - 1].role !== 'user') {
        return sendJson(response, 400, { error: 'The final conversation message must be a user question.' });
    }

    const generationConfig = {
        temperature: 0.2,
        maxOutputTokens: 768
    };
    const responseSchema = mapSchema(body.format);
    if (responseSchema) {
        generationConfig.responseMimeType = 'application/json';
        generationConfig.responseSchema = responseSchema;
    }

    try {
        const upstream = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify({
                    systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined,
                    contents,
                    generationConfig
                }),
                signal: AbortSignal.timeout(45_000)
            }
        );

        if (!upstream.ok) {
            return sendJson(response, upstream.status === 429 ? 429 : 502, {
                error: upstream.status === 429
                    ? 'Gemini rate limit reached. Please wait and try again.'
                    : 'Gemini could not complete the request. Please try again later.'
            });
        }

        const result = await upstream.json();
        const content = (result.candidates?.[0]?.content?.parts || [])
            .map(part => part.text || '')
            .join('')
            .trim();
        if (!content) return sendJson(response, 502, { error: 'Gemini returned an empty response.' });

        // Keep the Ollama response shape so the existing tutor formatter remains provider-independent.
        return sendJson(response, 200, { message: { content } });
    } catch {
        return sendJson(response, 502, { error: 'The Gemini service could not be reached. Please try again.' });
    }
}

module.exports = assistant;
module.exports.mapSchema = mapSchema;
module.exports.validateRequest = validateRequest;
