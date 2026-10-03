(() => {
    const knowledgeDirectory = new URL('../../data/knowledge/', document.currentScript.src);

    window.GRADE_11_MATH_KNOWLEDGE = [];
    window.GRADE_11_MATH_EXAMPLES = [];

    async function fetchJson(relativePath) {
        const response = await fetch(new URL(relativePath, knowledgeDirectory));
        if (!response.ok) throw new Error(`Could not load knowledge-base file: ${relativePath}`);
        return response.json();
    }

    function validateManifest(manifest) {
        if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.topics) || !manifest.topics.length) {
            throw new Error('The knowledge-base manifest must have schemaVersion 1 and a non-empty topics array.');
        }

        const ids = new Set();
        manifest.topics.forEach(entry => {
            if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id || '') || ids.has(entry.id)) {
                throw new Error(`Invalid or duplicate knowledge topic id: ${entry.id}`);
            }
            if (entry.topic !== `topics/${entry.id}.json` || entry.examples !== `examples/${entry.id}.json`) {
                throw new Error(`Knowledge topic ${entry.id} must pair its topic and example files by slug.`);
            }
            ids.add(entry.id);
        });

        return manifest.topics;
    }

    async function loadKnowledgeBase() {
        const manifest = await fetchJson('manifest.json');
        const entries = validateManifest(manifest);
        const modules = await Promise.all(entries.map(async entry => {
            const [topic, exampleBank] = await Promise.all([
                fetchJson(entry.topic),
                fetchJson(entry.examples)
            ]);

            if (!topic.topicName || !Array.isArray(topic.subtopics) || !Array.isArray(topic.keywords)) {
                throw new Error(`Invalid curriculum module: ${entry.topic}`);
            }
            if (exampleBank.topicName !== topic.topicName || !Array.isArray(exampleBank.examples)) {
                throw new Error(`Invalid or mismatched example module: ${entry.examples}`);
            }

            return { id: entry.id, topic, exampleBank };
        }));

        return {
            topics: modules.map(module => module.topic),
            examples: modules.map(module => module.exampleBank),
            modules
        };
    }

    const dataReady = loadKnowledgeBase().then(data => {
        window.Grade11MathKnowledgeBase = {
            ...data,
            ready: Promise.resolve(data),
            getTopic(idOrName) {
                const query = String(idOrName || '').toLowerCase();
                return data.modules.find(module => module.id === query || module.topic.topicName.toLowerCase() === query)?.topic;
            },
            getExamples(idOrName) {
                const query = String(idOrName || '').toLowerCase();
                return data.modules.find(module => module.id === query || module.topic.topicName.toLowerCase() === query)?.exampleBank;
            }
        };
        window.GRADE_11_MATH_KNOWLEDGE = data.topics;
        window.GRADE_11_MATH_EXAMPLES = data.examples;
        return data;
    }).catch(error => {
        console.error('Grade 11 mathematics knowledge base failed to load.', error);
        const emptyData = { topics: [], examples: [], modules: [] };
        window.GRADE_11_MATH_KNOWLEDGE = emptyData.topics;
        window.GRADE_11_MATH_EXAMPLES = emptyData.examples;
        window.Grade11MathKnowledgeBase = {
            ...emptyData,
            ready: Promise.resolve(emptyData),
            getTopic() { return undefined; },
            getExamples() { return undefined; }
        };
        return emptyData;
    });

    window.GRADE_11_MATH_DATA_READY = dataReady;
    window.GRADE_11_MATH_KNOWLEDGE_READY = dataReady.then(data => data.topics);
    window.GRADE_11_MATH_EXAMPLES_READY = dataReady.then(data => data.examples);
})();
