const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const knowledgeRoot = path.join(root, 'data', 'knowledge');
const topicsDirectory = path.join(knowledgeRoot, 'topics');
const examplesDirectory = path.join(knowledgeRoot, 'examples');
const manifestPath = path.join(knowledgeRoot, 'manifest.json');
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const subtopicArrayFields = [
    'keywords',
    'definitions',
    'formulas',
    'importantProperties',
    'commonMistakes',
    'prerequisites',
    'exampleProblemTypes'
];
const exampleRequiredFields = [
    'id',
    'difficulty',
    'question',
    'given',
    'expectedMethod',
    'workedSolution',
    'finalAnswer',
    'commonMistake'
];
const supportedDifficulties = new Set(['beginner', 'intermediate', 'advanced', 'application', 'challenge', 'analysis']);

function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        throw new Error(`${path.relative(root, filePath)} is not valid JSON: ${error.message}`);
    }
}

function getJsonSlugs(directory) {
    return fs.readdirSync(directory, { withFileTypes: true })
        .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
        .map(entry => path.basename(entry.name, '.json'))
        .sort((left, right) => left.localeCompare(right, 'en'));
}

function validateTopic(topic, slug) {
    if (!topic.topicName || typeof topic.topicOverview !== 'string'
        || !Array.isArray(topic.keywords) || !Array.isArray(topic.prerequisites)
        || !Array.isArray(topic.subtopics) || topic.subtopics.length === 0) {
        throw new Error(`topics/${slug}.json needs topicName, topicOverview, keywords, prerequisites, and at least one subtopic.`);
    }

    for (const [index, subtopic] of topic.subtopics.entries()) {
        const location = `topics/${slug}.json subtopics[${index}]`;
        if (!subtopic.name || !subtopicArrayFields.every(field => Array.isArray(subtopic[field]))) {
            throw new Error(`${location} needs a name and array values for ${subtopicArrayFields.join(', ')}.`);
        }
        if (subtopic.derivations !== undefined && !Array.isArray(subtopic.derivations)) {
            throw new Error(`${location}.derivations must be an array when provided.`);
        }
        if (subtopic.workedExamples !== undefined && !Array.isArray(subtopic.workedExamples)) {
            throw new Error(`${location}.workedExamples must be an array when provided.`);
        }
    }
}

function validateExamples(exampleBank, topicName, slug, allExampleIds, allQuestions) {
    if (exampleBank.topicName !== topicName || typeof exampleBank.topicOverview !== 'string'
        || !Array.isArray(exampleBank.examples) || exampleBank.examples.length === 0) {
        throw new Error(`examples/${slug}.json must match topicName "${topicName}" and contain a non-empty examples array.`);
    }

    for (const [index, example] of exampleBank.examples.entries()) {
        const location = `examples/${slug}.json examples[${index}]`;
        for (const field of exampleRequiredFields) {
            if (typeof example[field] !== 'string' || !example[field].trim()) {
                throw new Error(`${location} is missing a non-empty ${field}.`);
            }
        }
        if (!supportedDifficulties.has(example.difficulty)) {
            throw new Error(`${location}.difficulty must be one of: ${[...supportedDifficulties].join(', ')}.`);
        }
        if (allExampleIds.has(example.id)) throw new Error(`Duplicate example id: ${example.id}`);
        const normalizedQuestion = example.question.trim().toLocaleLowerCase('en');
        if (allQuestions.has(normalizedQuestion)) throw new Error(`Duplicate example question: ${example.question}`);
        allExampleIds.add(example.id);
        allQuestions.add(normalizedQuestion);
    }
}

function buildManifest() {
    const topicSlugs = getJsonSlugs(topicsDirectory);
    const exampleSlugs = getJsonSlugs(examplesDirectory);
    if (topicSlugs.length === 0) throw new Error('No topic JSON files found in data/knowledge/topics/.');

    for (const slug of [...topicSlugs, ...exampleSlugs]) {
        if (!slugPattern.test(slug)) throw new Error(`Use a lowercase kebab-case filename, not "${slug}".`);
    }

    const topicSet = new Set(topicSlugs);
    const exampleSet = new Set(exampleSlugs);
    const missingExamples = topicSlugs.filter(slug => !exampleSet.has(slug));
    const missingTopics = exampleSlugs.filter(slug => !topicSet.has(slug));
    if (missingExamples.length || missingTopics.length) {
        throw new Error([
            missingExamples.length ? `Missing example files for: ${missingExamples.join(', ')}` : '',
            missingTopics.length ? `Missing topic files for: ${missingTopics.join(', ')}` : ''
        ].filter(Boolean).join('. '));
    }

    const ids = new Set();
    const questions = new Set();
    const topicNames = new Set();
    const topics = topicSlugs.map(id => {
        const topic = readJson(path.join(topicsDirectory, `${id}.json`));
        const examples = readJson(path.join(examplesDirectory, `${id}.json`));
        validateTopic(topic, id);
        const normalizedTopicName = topic.topicName.trim().toLocaleLowerCase('en');
        if (topicNames.has(normalizedTopicName)) throw new Error(`Duplicate topic name: ${topic.topicName}`);
        topicNames.add(normalizedTopicName);
        validateExamples(examples, topic.topicName, id, ids, questions);
        return {
            id,
            topic: `topics/${id}.json`,
            examples: `examples/${id}.json`
        };
    });

    return { schemaVersion: 1, topics };
}

function main() {
    const manifest = buildManifest();
    const generated = `${JSON.stringify(manifest, null, 2)}\n`;

    if (process.argv.includes('--check')) {
        if (!fs.existsSync(manifestPath) || fs.readFileSync(manifestPath, 'utf8') !== generated) {
            throw new Error('manifest.json is stale. Run "npm run knowledge:build" and commit the generated manifest.');
        }
        console.log(`Knowledge index is current (${manifest.topics.length} topics).`);
        return;
    }

    fs.writeFileSync(manifestPath, generated);
    console.log(`Built data/knowledge/manifest.json (${manifest.topics.length} topics).`);
}

module.exports = { buildManifest };

if (require.main === module) {
    try {
        main();
    } catch (error) {
        console.error(`Knowledge index error: ${error.message}`);
        process.exitCode = 1;
    }
}
