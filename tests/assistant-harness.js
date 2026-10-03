const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const knowledgeDirectory = path.join(root, 'data', 'knowledge');

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const knowledgeManifest = readJson(path.join(knowledgeDirectory, 'manifest.json'));
const curriculumNames = knowledgeManifest.topics.map(entry => entry.id);

function readTopic(id) {
    return readJson(path.join(knowledgeDirectory, 'topics', `${id}.json`));
}

function readExamples(id) {
    return readJson(path.join(knowledgeDirectory, 'examples', `${id}.json`));
}

function loadKnowledgeModules() {
    return knowledgeManifest.topics.map(entry => ({
        id: entry.id,
        topic: readTopic(entry.id),
        examples: readExamples(entry.id)
    }));
}

function loadCalculator() {
    const window = {};
    const source = fs.readFileSync(path.join(root, 'assets', 'js', 'math-calculator.js'), 'utf8');
    vm.runInNewContext(source, { window, console }, { filename: 'math-calculator.js' });
    return window.Grade11MathCalculator;
}

function normalizeTruthValues(text) {
    return String(text)
        .replace(/\bTRUE\b/gi, 'true')
        .replace(/\bFALSE\b/gi, 'false')
        .replace(/\bT\b/gi, 'true')
        .replace(/\bF\b/gi, 'false');
}

function createElement(tagName) {
    return {
        tagName: tagName.toUpperCase(),
        attributes: {},
        children: [],
        listeners: {},
        classList: { toggle() {}, contains() { return false; } },
        append(...children) { this.children.push(...children); },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener(name, callback) { this.listeners[name] = callback; },
        setAttribute(name, value) { this.attributes[name] = value; },
        querySelector(selector) {
            this.queriedElements ||= new Map();
            if (!this.queriedElements.has(selector)) this.queriedElements.set(selector, createElement('div'));
            return this.queriedElements.get(selector);
        },
        focus() {},
        scrollHeight: 0,
        textContent: '',
        innerHTML: ''
    };
}

function createAssistantHarness(modelResponse, options = {}) {
    const elements = [];
    const mathRenders = [];
    const requests = [];
    const rawResponses = [];
    const assets = [];
    const storageValues = new Map();
    const localStorage = options.localStorage || {
        getItem(key) { return storageValues.get(key) ?? null; },
        setItem(key, value) { storageValues.set(key, value); }
    };
    const document = {
        baseURI: 'http://archive.test/index.html',
        body: { append(...items) { elements.push(...items); } },
        head: {
            appendChild(element) {
                const source = element.href || element.src;
                assets.push(source);
                const localKatexUnavailable = options.failLocalKatexAssets && source?.includes('/node_modules/katex/');
                if (localKatexUnavailable && element.onerror) queueMicrotask(() => element.onerror());
                else if (element.onload) queueMicrotask(() => element.onload());
                return element;
            }
        },
        querySelector() { return null; },
        createElement(tagName) { return createElement(tagName); }
    };
    const modules = loadKnowledgeModules();
    const curriculum = modules.map(module => module.topic);
    const examples = modules.map(module => module.examples);
    const window = {
        Grade11MathCalculator: loadCalculator(),
        GRADE_11_MATH_KNOWLEDGE: curriculum,
        GRADE_11_MATH_EXAMPLES: examples,
        GRADE_11_MATH_KNOWLEDGE_READY: Promise.resolve(curriculum),
        GRADE_11_MATH_EXAMPLES_READY: Promise.resolve(examples),
        MATHEMATICS_AI_PROVIDER: options.provider || 'ollama',
        MATHEMATICS_AI_ENDPOINT: options.endpoint || 'http://ollama.test/api/chat',
        MATHEMATICS_AI_MODEL: options.model || 'test-model',
        localStorage,
        renderMathInElement(element, renderOptions) { mathRenders.push({ text: element.textContent, options: renderOptions }); }
    };
    const fetch = async (url, requestOptions) => {
        requests.push({ url, options: JSON.parse(requestOptions.body) });
        if (options.fetch) {
            const response = await options.fetch(url, requestOptions);
            if (requestOptions.method === 'POST' && response.clone) {
                try {
                    const payload = await response.clone().json();
                    rawResponses.push(payload.message?.content ?? '');
                } catch {
                    rawResponses.push('');
                }
            }
            return response;
        }

        const content = JSON.stringify(modelResponse);
        rawResponses.push(content);
        return { ok: true, json: async () => ({ message: { content } }) };
    };
    const context = { window, document, fetch, console, NodeFilter: { SHOW_TEXT: 4 }, URL, queueMicrotask };
    vm.runInNewContext(fs.readFileSync(path.join(root, 'assets', 'js', 'assistant.js'), 'utf8'), context, { filename: 'assistant.js' });

    const panel = elements.find(element => element.className === 'assistant-panel');
    const form = panel.querySelector('.assistant-form');
    const input = panel.querySelector('.assistant-input');
    const messages = panel.querySelector('.assistant-messages');
    const greeting = createElement('div');
    greeting.className = 'assistant-message bot';
    greeting.textContent = 'Hi! Ask me about a formula, concept, or problem you are exploring.';
    messages.appendChild(greeting);

    return {
        requests,
        rawResponses,
        mathRenders,
        assets,
        form,
        input,
        messages,
        async submit(question) {
            input.value = question;
            await form.listeners.submit({ preventDefault() {} });
            return messages.children.at(-1);
        }
    };
}

module.exports = {
    createAssistantHarness,
    curriculumNames,
    knowledgeDirectory,
    loadCalculator,
    loadKnowledgeModules,
    normalizeTruthValues,
    readExamples,
    readJson,
    readTopic,
    root
};
