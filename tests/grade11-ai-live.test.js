const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createAssistantHarness, curriculumNames, knowledgeDirectory, loadCalculator, normalizeTruthValues, readJson } = require('./assistant-harness');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'grade11-ai-cases.json'), 'utf8'));
const selectedCaseId = process.env.MATHEMATICS_AI_CASE;
const selectedCases = selectedCaseId ? cases.filter(item => item.id === selectedCaseId) : cases;
const model = process.env.MATHEMATICS_AI_MODEL || 'qwen3:4b';
const endpoint = process.env.MATHEMATICS_AI_ENDPOINT || 'http://127.0.0.1:11434/api/chat';
const tagsEndpoint = endpoint.replace(/\/api\/chat\/?$/, '');

const calculator = loadCalculator();

function findNumbers(text) {
    return (text.match(/-?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)/g) || [])
        .map(value => Number(value.replaceAll(',', '')))
        .filter(Number.isFinite);
}

function extractFinalAnswer(text) {
    const match = text.match(/^\*\*Answer:\*\*\s*([\s\S]*?)(?=\n\n|$)/);
    return (match?.[1] || text).trim();
}

function checkEvaluation(evaluation, solution) {
    const normalize = text => evaluation.normalizeTruthValues ? normalizeTruthValues(text) : String(text || '');
    const working = normalize(Array.isArray(solution.working) ? solution.working.join('\n') : '');
    const answer = normalize(solution.answer);
    const check = normalize(solution.check);
    const explanation = [solution.method, working, check, answer].filter(Boolean).join('\n');
    const responseDetails = `Response JSON: ${JSON.stringify(solution)}`;

    assert.match(solution.topic, new RegExp(evaluation.rawTopicPattern || evaluation.topic.split(' ')[0], 'i'), `1. topic identified correctly. ${responseDetails}`);
    assert.match(solution.method, new RegExp(evaluation.methodPattern, 'i'), `2. appropriate method selected. ${responseDetails}`);
    if (evaluation.expectedNumbers) {
        const actualNumbers = findNumbers(`${working}\n${answer}`);
        for (const expected of evaluation.expectedNumbers) {
            const tolerance = evaluation.numberTolerance ?? 1e-8 * Math.max(1, Math.abs(expected));
            assert.ok(actualNumbers.some(actual => Math.abs(actual - expected) <= tolerance), `3. expected calculation ${expected} appears in working or answer; got ${actualNumbers.join(', ')}. ${responseDetails}`);
        }
    } else {
        assert.match(`${working}\n${answer}`, new RegExp(evaluation.expectedCalculationPattern, 'i'), `3. calculation or logical evaluation is correct. ${responseDetails}`);
    }
    assert.match(explanation, new RegExp(evaluation.reasoningPattern, 'i'), `4. mathematical reasoning is valid. ${responseDetails}`);
    assert.match(answer, new RegExp(evaluation.answerPattern, 'i'), `5. final answer is correct. ${responseDetails}`);

    const wordCount = explanation.trim().split(/\s+/).filter(Boolean).length;
    assert.ok(wordCount >= 8 && wordCount <= 220, `6. explanation is concise and Grade 11 appropriate (${wordCount} words). ${responseDetails}`);
    assert.doesNotMatch(explanation, /\b(derivative|integral|differential equation)\b/i, `6. explanation stays within Grade 11 scope. ${responseDetails}`);
}

function checkApplicationOutput(evaluation, finalText) {
    const final = evaluation.normalizeTruthValues ? normalizeTruthValues(finalText) : finalText;
    const responseDetails = `Final application output: ${final}`;
    if (evaluation.expectedNumbers) {
        const actualNumbers = findNumbers(final);
        for (const expected of evaluation.expectedNumbers) {
            const tolerance = evaluation.numberTolerance ?? 1e-8 * Math.max(1, Math.abs(expected));
            assert.ok(actualNumbers.some(actual => Math.abs(actual - expected) <= tolerance), `expected ${expected}; found ${actualNumbers.join(', ')}. ${responseDetails}`);
        }
    } else {
        assert.match(final, new RegExp(evaluation.expectedCalculationPattern, 'i'), responseDetails);
    }
    assert.match(final, new RegExp(evaluation.answerPattern, 'i'), `Final answer does not match the expected answer pattern. ${responseDetails}`);
    assert.match(final, new RegExp(evaluation.reasoningPattern, 'i'), `Explanation reasoning does not match the expected pattern. ${responseDetails}`);
}

function classifyFailure(stage, message, evaluation, solution) {
    const text = `${message}\n${JSON.stringify(solution || {})}`.toLowerCase();
    const categories = new Set();
    if (/1\. topic identified|wrong topic/.test(text)) categories.add('WRONG_TOPIC');
    if (/subtopic|retrieval includes|retrieved curriculum|retrieval/.test(text)) categories.add('WRONG_SUBTOPIC');
    if (/retrieval includes|retrieved curriculum|application retrieval/.test(text)) categories.add('RETRIEVAL_FAILURE');
    if (/clarif|missing information|insufficient information/.test(text)) categories.add('MISSING_INFORMATION_HANDLING');
    if (/intent|operation|classification/.test(text)) categories.add('INTENT_FAILURE');
    if (/not structured json|invalid json|json parse/.test(text)) categories.add('FORMAT_FAILURE');
    if (/katex|latex|math delimiter/.test(text)) categories.add('KATEX_FAILURE');
    if (/method selected|formula|calculation|expected calculation|expected .* appears|verification failed/.test(text)) categories.add(stage === 'raw' ? 'MODEL_MATH_ERROR' : 'APP_CALCULATION_ERROR');
    if (/final answer|answer is correct|expected .*found|expected .*; got|numeric contradiction/.test(text)) categories.add(stage === 'raw' ? 'MODEL_MATH_ERROR' : 'FINAL_ANSWER_CONSISTENCY_ERROR');
    if (/reasoning|explanation|word count|grade 11/.test(text)) categories.add('EXPLANATION_FAILURE');
    if (/out of scope|derivative|integral|differential equation/.test(text)) categories.add('OUT_OF_SCOPE_FAILURE');
    if (categories.size === 0) categories.add(stage === 'raw' ? 'MODEL_MATH_ERROR' : 'FORMAT_FAILURE');
    return [...categories];
}

test('live Grade 11 AI evaluation against local Ollama', { timeout: 600000 }, async t => {
    let tagsResponse;
    try {
        tagsResponse = await fetch(`${tagsEndpoint}/api/tags`);
    } catch (error) {
        assert.fail(`Ollama is unavailable at ${endpoint}. Start the local Ollama service to run live AI evaluations. ${error.message}`);
    }
    assert.ok(tagsResponse.ok, `Ollama tags request failed with HTTP ${tagsResponse.status}`);
    const tags = await tagsResponse.json();
    assert.ok(tags.models?.some(item => item.name === model || item.name.startsWith(`${model}:`)), `Model ${model} is not available in local Ollama`);

    let rawPasses = 0;
    let rawFailures = 0;
    let applicationPasses = 0;
    let applicationFailures = 0;

    assert.ok(selectedCases.length, selectedCaseId ? `No live evaluation case found with id ${selectedCaseId}` : 'live evaluation cases are available');
    for (const evaluation of selectedCases) {
        await t.test(`${evaluation.id}: ${evaluation.topic} (${evaluation.category})`, { timeout: 120000 }, async () => {
            const harness = createAssistantHarness(null, { endpoint, model, fetch: globalThis.fetch });
            const finalMessage = await harness.submit(evaluation.question);
            const rawModelOutput = harness.rawResponses[0] || '';
            const finalApplicationOutput = finalMessage.textContent;
            const decision = calculator.detectDecision(evaluation.question);
            const expected = JSON.stringify(evaluation.expectedNumbers ?? evaluation.expectedCalculationPattern);
            const verification = decision.operation === 'none'
                ? { needed: false, passed: false }
                : calculator.verifyAnswer(evaluation.question, extractFinalAnswer(finalApplicationOutput));
            const verificationStatus = verification.needed
                ? verification.passed ? 'passed' : 'failed'
                : 'not available for this operation';

            let rawSolution;
            let rawFailure = '';
            try {
                rawSolution = JSON.parse(rawModelOutput);
            } catch (error) {
                rawFailure = `Raw model output was not structured JSON: ${error.message}`;
            }
            if (!rawFailure) {
                try {
                    checkEvaluation(evaluation, rawSolution);
                } catch (error) {
                    rawFailure = error.message;
                }
            }
            if (rawFailure) {
                rawFailures += 1;
                t.diagnostic(`${evaluation.id} RAW MODEL FAILURE [${classifyFailure('raw', rawFailure, evaluation, rawSolution).join(', ')}]\nRaw model output: ${rawModelOutput}\nApplication final output: ${finalApplicationOutput}\nExpected: ${expected}\nVerification: ${verificationStatus}\nCause: ${rawFailure}`);
            } else {
                rawPasses += 1;
            }

            try {
                const request = harness.requests[0]?.options;
                assert.ok(request, 'the application sent the question to the model');
                const systemPrompt = request.messages[0]?.content || '';
                const retrievalTopics = evaluation.retrievalTopics || [evaluation.topic];
                const retrievedModules = curriculumNames
                    .map(name => readJson(path.join(knowledgeDirectory, `${name}.json`)))
                    .filter(module => retrievalTopics.includes(module.topicName) && systemPrompt.includes(`Topic: ${module.topicName}`));
                assert.ok(retrievedModules.length, `application retrieval includes one of ${retrievalTopics.join(', ')}`);
                const expectedSubtopics = evaluation.retrievalSubtopics || (evaluation.subtopic ? [evaluation.subtopic] : []);
                assert.ok(retrievedModules.some(module => module.subtopics.some(subtopic => systemPrompt.includes(`Subtopic: ${subtopic.name}`) && (!expectedSubtopics.length || expectedSubtopics.includes(subtopic.name)))), `application retrieval includes a relevant subtopic${expectedSubtopics.length ? `: ${expectedSubtopics.join(' or ')}` : ''}`);
                checkApplicationOutput(evaluation, finalApplicationOutput);
                if (verification.needed) assert.equal(verification.passed, true, `deterministic verification failed: ${verification.summary}`);
                applicationPasses += 1;
            } catch (error) {
                applicationFailures += 1;
                assert.fail(`APPLICATION FINAL FAILURE [${classifyFailure('application', error.message, evaluation).join(', ')}]\nRaw model output: ${rawModelOutput}\nApplication final output: ${finalApplicationOutput}\nExpected: ${expected}\nVerification: ${verificationStatus}\nCause: ${error.message}`);
            }
        });
    }

    t.diagnostic(`Raw model output: ${rawPasses}/${selectedCases.length} cases passed; ${rawFailures} raw-model mismatches. Application final output: ${applicationPasses}/${selectedCases.length} cases passed; ${applicationFailures} application mismatches.`);
});
