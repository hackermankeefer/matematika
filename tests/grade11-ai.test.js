const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { createAssistantHarness, curriculumNames, loadCalculator, loadKnowledgeModules, normalizeTruthValues, readExamples, readJson, readTopic, root } = require('./assistant-harness');

const calculator = loadCalculator();

test('truth-value normalization accepts T/F labels without matching longer words', () => {
    assert.equal(normalizeTruthValues('T'), 'true');
    assert.equal(normalizeTruthValues('TRUE'), 'true');
    assert.equal(normalizeTruthValues('F'), 'false');
    assert.equal(normalizeTruthValues('FALSE'), 'false');
    assert.equal(normalizeTruthValues('The value is 10.'), 'The value is 10.');
    assert.equal(normalizeTruthValues('T').trim(), normalizeTruthValues('True').toLowerCase());
    assert.equal(normalizeTruthValues('F').trim(), normalizeTruthValues('False').toLowerCase());
    assert.notEqual(normalizeTruthValues('T').trim(), normalizeTruthValues('False').toLowerCase());
});

test('all seven curriculum and example modules are structurally complete', () => {
    assert.ok(curriculumNames.length > 0);
    const ids = new Set();
    const questions = new Set();

    for (const name of curriculumNames) {
        const curriculum = readTopic(name);
        const exampleModule = readExamples(name);
        assert.ok(curriculum.topicName && Array.isArray(curriculum.subtopics), `${name} curriculum shape`);
        assert.ok(exampleModule.topicName && Array.isArray(exampleModule.examples), `${name} examples shape`);
        assert.ok(curriculum.subtopics.length > 0, `${name} has subtopics`);
        assert.ok(exampleModule.examples.length > 0, `${name} has practice examples`);

        for (const example of exampleModule.examples) {
            assert.ok(example.id && example.difficulty && example.question, `${name} example identity`);
            assert.ok(example.given && example.expectedMethod && example.workedSolution && example.finalAnswer && example.commonMistake, `${example.id} includes solution rubric fields`);
            assert.ok(!ids.has(example.id), `duplicate example id: ${example.id}`);
            assert.ok(!questions.has(example.question.trim().toLowerCase()), `duplicate example question: ${example.question}`);
            ids.add(example.id);
            questions.add(example.question.trim().toLowerCase());
        }
    }

});

const calculationCases = [
    ['arithmetic precedence', { operation: 'arithmetic', arguments: { expression: '2 + 3 * 4' } }, 14],
    ['percentage of', { operation: 'percentage_of', arguments: { percent: 17.5, value: 240 } }, 42],
    ['percentage change', { operation: 'percentage_change', arguments: { original: 80, newValue: 92 } }, { change: 12, percent: 15 }],
    ['percentage of total', { operation: 'percentage_of_total', arguments: { part: 18, total: 60 } }, 30],
    ['negative-base even power', { operation: 'power', arguments: { base: -2, exponent: 4 } }, 16],
    ['negative odd root', { operation: 'root', arguments: { radicand: -27, index: 3 } }, -3],
    ['logarithm with non-default base', { operation: 'logarithm', arguments: { base: 2, argument: 32 } }, 5],
    ['fraction addition', { operation: 'fraction', arguments: { numerator: 1, denominator: 2, mode: 'add', otherNumerator: 1, otherDenominator: 3 } }, { numerator: 5, denominator: 6, decimal: 0.833333333333 }],
    ['fraction simplification', { operation: 'fraction', arguments: { numerator: 6, denominator: 8 } }, { numerator: 3, denominator: 4, decimal: 0.75 }],
    ['median with even sample size', { operation: 'statistics', arguments: { statistic: 'median', values: [9, 1, 7, 3] } }, 5],
    ['population variance', { operation: 'statistics', arguments: { statistic: 'variance', values: [2, 4, 6] } }, 8 / 3],
    ['arithmetic nth term', { operation: 'sequence', arguments: { sequenceType: 'arithmetic_term', firstTerm: 3, termNumber: 10, commonDifference: 2 } }, 21],
    ['arithmetic series sum', { operation: 'sequence', arguments: { sequenceType: 'arithmetic_sum', firstTerm: 3, termNumber: 8, commonDifference: 2 } }, 80],
    ['geometric nth term', { operation: 'sequence', arguments: { sequenceType: 'geometric_term', firstTerm: 5, termNumber: 6, commonRatio: 3 } }, 1215],
    ['geometric series sum', { operation: 'sequence', arguments: { sequenceType: 'geometric_sum', firstTerm: 3, termNumber: 5, commonRatio: 2 } }, 93],
    ['compound interest', { operation: 'compound_interest', arguments: { principal: 2000, ratePercent: 4, years: 3, compoundsPerYear: 1 } }, { amount: 2249.728, interest: 249.728 }],
    ['repeated depreciation', { operation: 'repeated_percentage', arguments: { initialValue: 12000, ratePercent: 10, periods: 3, direction: -1 } }, 8748],
    ['simple-versus-compound comparison', { operation: 'interest_comparison', arguments: { principal: 1000, simpleRatePercent: 10, simpleYears: 2, compoundRatePercent: 10, compoundYears: 2, compoundsPerYear: 1 } }, { simpleAmount: 1200, compoundAmount: 1210, greater: 'compound interest', difference: 10 }],
    ['mean and median together', { operation: 'statistics', arguments: { statistic: 'summary', statistics: ['mean', 'median'], values: [1, 2, 2, 3, 42] } }, { mean: 10, median: 2 }],
    ['classical probability', { operation: 'probability', arguments: { probabilityType: 'classical', favorableOutcomes: 3, totalOutcomes: 8 } }, 0.375],
    ['conditional probability', { operation: 'probability', arguments: { probabilityType: 'conditional', intersectionProbability: 0.2, probabilityB: 0.5 } }, 0.4]
];

for (const [name, request, expected] of calculationCases) {
    test(`calculator computes ${name}`, () => {
        const result = calculator.calculate(request).result;
        if (typeof expected === 'number') {
            assert.ok(Math.abs(result - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${result} is close to ${expected}`);
        } else {
            assert.deepEqual(JSON.parse(JSON.stringify(result)), expected);
        }
    });
}

const detectionCases = [
    ['What is 15% of 240?', 'percentage_of', 36],
    ['Increase from 80 to 92', 'percentage_change', { change: 12, percent: 15 }],
    ['What percentage is 18 of 60?', 'percentage_of_total', 30],
    ['2 to the power of 5', 'power', 32],
    ['square root of 144', 'root', 12],
    ['log base 2 of 32', 'logarithm', 5],
    ['Simplify 6/8', 'fraction', { numerator: 3, denominator: 4, decimal: 0.75 }],
    ['Find the mean of 2, 4, 6, 8', 'statistics', 5],
    ['Find the 10th term of the arithmetic sequence with first term 3 and common difference 2', 'sequence', 21],
    ['Find the sum of the first 8 terms of an arithmetic sequence with first term 3 and common difference 2', 'sequence', 80],
    ['Find the 6th term of a geometric sequence with first term 5 and common ratio 3', 'sequence', 1215],
    ['Find the 6th term of a geometric series with first term 5 and common ratio 3', 'sequence', 1215],
    ['Find the sum of the first 5 terms of a geometric sequence with first term 3 and common ratio 2', 'sequence', 93],
    ['Invest 2000 at 4% compounded annually for 3 years', 'compound_interest', { amount: 2249.728, interest: 249.728 }],
    ['A machine is worth $12000 and loses 10% of its current value each year. Find its value after 3 years.', 'repeated_percentage', 8748],
    ['Compare the final balance on $1000 at 10% simple interest for 2 years with the balance at 10% compounded annually for 2 years. Which is greater?', 'interest_comparison', { simpleAmount: 1200, compoundAmount: 1210, greater: 'compound interest', difference: 10 }],
    ['For the data 1, 2, 2, 3, 42, find the mean and median.', 'statistics', { mean: 10, median: 2 }],
    ['Find the probability of getting 3 out of 8', 'probability', 0.375]
];

for (const [question, expectedOperation, expectedResult] of detectionCases) {
    test(`calculator selects the right method for: ${question}`, () => {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, expectedOperation);
        const result = calculator.calculate(decision).result;
        assert.deepEqual(JSON.parse(JSON.stringify(result)), expectedResult);
    });
}

test('calculator detects and evaluates common function notation', () => {
    const cases = [
        ['Given f(x)=3x-2, find f(5)', 13],
        ['If f(x)=2x+1, find f(4)', 9],
        ['Evaluate f(10) when f(x)=x²+3', 103],
        ['Given g(x)=5x-7, find g(2)', 3]
    ];

    for (const [question, expected] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'function_evaluation', question);
        assert.equal(calculator.calculate(decision).result, expected, question);
        assert.equal(calculator.verifyAnswer(question, String(expected)).passed, true, question);
        assert.equal(calculator.verifyAnswer(question, 'Heavy').passed, false, question);
    }
});

test('calculator distinguishes a supplied hypothesis-test p-value from a data statistic', () => {
    const question = 'A two-sided test reports p = 0.03 at significance level alpha = 0.05. State the decision and what it means.';
    const decision = calculator.detectDecision(question);
    assert.equal(decision.operation, 'hypothesis_test');
    assert.equal(calculator.calculate(decision).result.decision, 'reject H0');
    assert.equal(calculator.verifyAnswer(question, 'Reject H0; the result is statistically significant.').passed, true);
    assert.equal(calculator.verifyAnswer(question, 'Fail to reject H0.').passed, false);
});

test('deterministic trigonometry solves sides, angles, and triangle areas', () => {
    const cases = [
        ['Find the angle using tan, opposite side is 6 cm and adjacent side is 8 cm.', 36.8698976458, 'angle'],
        ['In a right triangle with angle 30 degrees and hypotenuse 10 cm, find the opposite side using sine.', 5, 'side'],
        ['Find the area of a triangle with sides 8 cm and 10 cm and included angle 30 degrees using sine.', 20, 'sine_area'],
        ['Find the area using Herons formula for sides 13, 14, and 15 cm.', 84, 'heron_area']
    ];
    for (const [question, expected, kind] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'trigonometry', question);
        assert.equal(decision.arguments.kind, kind, question);
        const actual = calculator.calculate(decision).result;
        assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} should be close to ${expected}`);
        assert.equal(calculator.verifyAnswer(question, String(expected)).passed, true, question);
    }
    assert.throws(() => calculator.calculate({ operation: 'trigonometry', arguments: { kind: 'heron_area', sides: [1, 2, 8] } }), /triangle inequality/);
});

test('annuity and loan calculations use rates and periods matching payment timing', () => {
    const annuityQuestion = 'A $200 deposit at the end of each month earns 6% annual interest for 5 years. Find future value of ordinary annuity.';
    const annuity = calculator.detectDecision(annuityQuestion);
    assert.equal(annuity.operation, 'annuity');
    assert.equal(annuity.arguments.periods, 60);
    assert.ok(Math.abs(annuity.arguments.ratePerPeriod - 0.005) < 1e-12);
    const futureValue = calculator.calculate(annuity).result;
    assert.ok(Math.abs(futureValue - 13954.006102) < 1e-6);
    assert.equal(calculator.verifyAnswer(annuityQuestion, '13954.006102').passed, true);

    const loanQuestion = 'A loan of $8000 at 12% annual interest over 36 months. Find the monthly payment.';
    const loan = calculator.detectDecision(loanQuestion);
    assert.equal(loan.operation, 'loan');
    assert.ok(Math.abs(calculator.calculate(loan).result - 265.7144785) < 1e-6);

    const due = calculator.calculate({ operation: 'annuity', arguments: { kind: 'future_value', payment: 100, ratePerPeriod: 0.01, periods: 6, timing: 'due' } }).result;
    const ordinary = calculator.calculate({ operation: 'annuity', arguments: { kind: 'future_value', payment: 100, ratePerPeriod: 0.01, periods: 6, timing: 'ordinary' } }).result;
    assert.ok(Math.abs(due - ordinary * 1.01) < 1e-9, 'annuity due shifts each payment one period earlier');
});

test('deterministic statistics cover z-scores, normal probabilities, and expected value', () => {
    const zQuestion = 'Find the z-score for 80 with mean 70 and standard deviation 5.';
    assert.equal(calculator.calculate(calculator.detectDecision(zQuestion)).result, 2);
    const normal = calculator.calculate({ operation: 'normal_probability', arguments: { lower: -1, upper: 1 } }).result;
    assert.ok(Math.abs(normal - 0.682689) < 0.00001);
    assert.equal(calculator.calculate({ operation: 'expected_value', arguments: { values: [10, 0], probabilities: [0.2, 0.8] } }).result, 2);
    assert.throws(() => calculator.calculate({ operation: 'expected_value', arguments: { values: [10, 0], probabilities: [0.2, 0.7] } }), /sum to 1/);
});

test('diameter conversion is deterministic and missing dimensions request clarification', async () => {
    const diameterQuestion = 'An object has diameter 10 cm. Find its radius.';
    assert.equal(calculator.calculate(calculator.detectDecision(diameterQuestion)).result, 5);
    assert.equal(calculator.classifyQuestion('Find the volume of the cylinder.').status, 'NEEDS_CLARIFICATION');
    assert.equal(calculator.classifyQuestion('Find the area.').status, 'INSUFFICIENT_INFORMATION');
    const harness = createAssistantHarness({ answer: 'the model should not be called' });
    const reply = await harness.submit('Find the volume of the cylinder.');
    assert.equal(harness.requests.length, 0);
    assert.match(reply.textContent, /radius or diameter and height/i);
});

test('calculator models periodic payments and investments as sequences or series', () => {
    const cases = [
        ['A mortgage is repaid by fixed monthly payments of $1,250 for 240 payments. Find total paid.', 'arithmetic_sum', 300000],
        ['A loan schedule has first monthly payment of $300 and increases by $25 each month for 12 payments. Find total paid.', 'arithmetic_sum', 5250],
        ['A savings plan makes deposits of $100 at the end of each month. It earns 1% per month for 6 payments. Find accumulated value.', 'geometric_sum', 615.20150601],
        ['An investment of $1,000 grows by 5% a year for 4 years. Find its accumulated value.', 'geometric_term', 1215.50625]
    ];

    for (const [question, expectedType, expectedValue] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'sequence', question);
        assert.equal(decision.arguments.sequenceType, expectedType, question);
        const result = calculator.calculate(decision).result;
        assert.ok(Math.abs(result - expectedValue) <= 1e-8 * Math.max(1, Math.abs(expectedValue)), `${question}: ${result} is close to ${expectedValue}`);
        assert.equal(calculator.verifyAnswer(question, String(expectedValue)).passed, true, question);
        if (/savings plan/i.test(question)) {
            assert.equal(calculator.verifyAnswer(question, '615.201506').passed, true, 'a correctly rounded annuity result within one millionth must verify');
            assert.equal(calculator.verifyAnswer(question, '615.201507').passed, false, 'a one-millionth error beyond displayed rounding must fail');
            assert.equal(calculator.verifyAnswer(question, String(expectedValue + 1e-3)).passed, false, 'materially incorrect annuity values must fail verification');
        }
    }
});

test('calculator applies percentage price adjustments in the stated order', () => {
    const cases = [
        ['An item listed at $100 has a 10% discount.', 90, ['discount']],
        ['A $100 item has 8% sales tax added.', 108, ['tax']],
        ['$80 item after a 20% discount and 8% sales tax.', 69.12, ['discount', 'tax']],
        ['$100 item with 10% tax then a 20% discount.', 88, ['tax', 'discount']],
        ['$100 increases 10% then decreases 20%.', 88, ['increase', 'decrease']],
        ['$100 has a 10% markup then a 10% discount.', 99, ['markup', 'discount']],
        ['$100 with a 10% discount followed by another 10% discount.', 81, ['discount', 'discount']],
        ['An item costs $100 before two successive 10% discounts. Find the final price and explain why they are not a single 20% discount.', 81, ['discount', 'discount']],
        ['$100, 20% discount, then 10% tax, then 5% markup.', 92.4, ['discount', 'tax', 'markup']],
        ['An item costs ₱1,000, discounted by 20%, then another 10%, then subjected to 12% VAT.', 806.4, ['discount', 'discount', 'vat']],
        ['Start with $80, take 20 percent off, then add 8 percent sales tax.', 69.12, ['discount', 'tax']]
    ];

    for (const [question, expected, expectedStages] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'percentage_application', question);
        const calculation = calculator.calculate(decision).result;
        const actualStages = decision.arguments.kind === 'price_chain'
            ? decision.arguments.stages.map(stage => stage.type)
            : [decision.arguments.kind];
        assert.equal(actualStages.join(','), expectedStages.join(','), question);
        const result = calculation.finalPrice ?? calculation.priceIncludingVat ?? calculation.amount;
        assert.ok(Math.abs(result - expected) <= 1e-10 * Math.max(1, Math.abs(expected)), `${question}: ${result} should equal ${expected}`);
    }
});

test('calculator computes and verifies cylinder volume with default or supplied pi', () => {
    const cases = [
        ['What is the volume of a cylinder with a radius of 5.6 cm and height of 13 cm?', Math.PI],
        ['What is the volume of a cylinder with radius=5.6 cm and height is 13 cm? Use pi=3.14.', 3.14]
    ];

    for (const [question, pi] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'cylinder_volume', question);
        assert.equal(decision.arguments.pi, pi);

        const expectedVolume = 5.6 ** 2 * 13 * pi;
        const result = calculator.calculate(decision).result;
        assert.ok(Math.abs(result - expectedVolume) < 1e-8, `${result} is close to ${expectedVolume}`);
        assert.equal(calculator.verifyAnswer(question, `${expectedVolume} cm^3`).passed, true, question);
        assert.equal(calculator.verifyAnswer(question, `${Number(expectedVolume.toFixed(2))} cm^3`).passed, true, 'correctly rounded cylinder volumes must verify');
        assert.equal(calculator.verifyAnswer(question, `$V \\approx ${Number(expectedVolume.toFixed(2))}\\,\\text{cm}^3$`).passed, true, 'KaTeX cubic units must not hide the final number from verification');
        assert.equal(calculator.verifyAnswer(question, '1279 cm^3').passed, false, question);
    }
});

test('calculator detects and verifies Grade 11 earnings problems', () => {
    const cases = [
        ['An annual salary of $62,400: find monthly earnings.', 'annual_salary', 5200],
        ['An annual salary of $62,400: find weekly earnings.', 'annual_salary', 1200],
        ['A worker earns $18 per hour and works 35 hours. Find gross wages.', 'hourly_wage', 630],
        ['An employee earns $20 per hour for 40 regular hours and 5 overtime hours at 1.5 times the regular rate. Find gross pay.', 'overtime', 950],
        ['Find 6% commission on sales of $4,000.', 'commission', 240],
        ['A worker earns $4 per piece for 120 pieces of piecework. Find earnings.', 'piecework', 480],
        ['An employee earns $15 per hour for 20 hours and 5% commission on sales of $2,000. Find gross earnings.', 'combined', 400],
        ['A salesperson earns $500 base pay and 4% commission on $3,000 in sales. Find gross earnings.', 'combined', 620],
        ['A worker earns $18 per hour for 40 regular hours and 5 overtime hours at 1.5 times the regular rate, receives a $75 allowance, and has $125 in deductions. Find net earnings.', 'combined', 805],
        ['A monthly salary is $4,000, overtime pay is $250, and a $150 transport benefit is included. Income tax is $320 and an insurance deduction is $300. Find net income.', 'combined', 3780],
        ['Monthly salary is $4,000. Tax at 10% of gross income and a $300 other deduction apply. Find net income.', 'combined', 3300],
        ['Monthly salary is $4,000 and taxable income is $4,000. Use this table: 0% on the first $1,000, 10% on the next $2,000, and 20% on the remaining income. Subtract a $100 other deduction and find net income.', 'combined', 3500]
    ];

    for (const [question, expectedKind, expectedAmount] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'earnings', question);
        assert.equal(decision.arguments.kind, expectedKind, question);
        assert.equal(calculator.calculate(decision).result.amount, expectedAmount, question);
        assert.equal(calculator.verifyAnswer(question, String(expectedAmount)).passed, true, question);
    }

    assert.equal(calculator.detectDecision('A worker earns $20 per hour for 40 regular hours and 5 overtime hours. Find gross pay.').operation, 'none');
    const taxWithoutBase = calculator.detectDecision('Monthly salary is $4,000 and tax at 10%. Find net income.');
    assert.equal(taxWithoutBase.operation, 'earnings');
    assert.throws(() => calculator.calculate(taxWithoutBase), /taxable base/);
});

test('calculator classifies patterns and solves next, missing, and Fibonacci terms', () => {
    const cases = [
        ['Find the next term: 3, 7, 11, 15.', 'arithmetic', 19],
        ['What comes next in the pattern 2, 6, 18, 54?', 'geometric', 162],
        ['Find the missing term in 2, 4, ?, 8, 10.', 'arithmetic', 6],
        ['Find the missing geometric term in 3, 6, ?, 24.', 'geometric', 12],
        ['Find the next Fibonacci term: 1, 1, 2, 3, 5, 8.', 'Fibonacci', 13],
        ['Find the missing term in the Fibonacci pattern 1, 1, 2, ?, 5, 8.', 'Fibonacci', 3],
        ['Find the 8th term of the Fibonacci sequence 1, 1, 2, 3, 5.', 'Fibonacci', 21]
    ];

    for (const [question, expectedType, expectedAmount] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'pattern', question);
        const result = calculator.calculate(decision).result;
        assert.equal(result.patternType, expectedType, question);
        assert.equal(result.amount, expectedAmount, question);
        assert.equal(calculator.verifyAnswer(question, String(expectedAmount)).passed, true, question);
    }

    const squares = calculator.calculate(calculator.detectDecision('Identify the rule in the pattern 1, 4, 9, 16.')).result;
    assert.equal(squares.patternType, 'square numbers');
    assert.match(squares.rule, /n\^2/);
    assert.equal(squares.nextTerm, 25);

    const arithmeticClassification = calculator.calculate(calculator.detectDecision('Classify the pattern 5, 9, 13, 17.')).result;
    assert.equal(arithmeticClassification.patternType, 'arithmetic');
    assert.match(arithmeticClassification.rule, /Add 4/);
    assert.equal(arithmeticClassification.commonDifference, 4);

    const geometricClassification = calculator.calculate(calculator.detectDecision('Classify the pattern 3, 6, 12, 24.')).result;
    assert.equal(geometricClassification.patternType, 'geometric');
    assert.equal(geometricClassification.commonRatio, 2);

    const ambiguousPattern = calculator.detectDecision('Find the next term in this pattern: 1, 2, 4, 7, 13.');
    assert.equal(ambiguousPattern.operation, 'pattern');
    assert.throws(() => calculator.calculate(ambiguousPattern), /do not establish a recognized simple pattern/);

    const wordProblem = 'A hall has 20 seats in the first row and adds 3 seats in each next row. How many seats are in row 10?';
    const wordDecision = calculator.detectDecision(wordProblem);
    assert.equal(wordDecision.operation, 'sequence');
    assert.equal(wordDecision.arguments.sequenceType, 'arithmetic_term');
    assert.equal(calculator.calculate(wordDecision).result, 47);
    assert.equal(calculator.verifyAnswer(wordProblem, '47 seats').passed, true);
});

test('calculator detects geometric growth in a real-world term problem', () => {
    const question = 'A plant starts at 80 cm and grows by 25% each month. What will its height be after 3 months?';
    const decision = calculator.detectDecision(question);

    assert.equal(decision.operation, 'sequence');
    assert.equal(decision.arguments.sequenceType, 'geometric_term');
    assert.equal(decision.arguments.firstTerm, 80);
    assert.equal(decision.arguments.commonRatio, 1.25);
    assert.equal(decision.arguments.termNumber, 4);
    assert.equal(calculator.calculate(decision).result, 156.25);
    assert.equal(calculator.verifyAnswer(question, '156.25 cm').passed, true);
});

test('calculator detects and verifies Grade 11 percentage applications', () => {
    const cases = [
        ['Increase $80 by 15%. Find the new value.', 'increase', 92],
        ['Decrease $250 by 12%. Find the reduced value.', 'decrease', 220],
        ['A $1,000 item rises with 3% inflation for 2 years. Find the new price.', 'inflation', 1060.9],
        ['An item costs $100 and has a 25% markup. Find its selling price.', 'markup', 125],
        ['A $200 listed price has a 10% discount. Find the sale price.', 'discount', 180],
        ['A product price is $100 before 12% VAT. Find the price including VAT.', 'vat', 112],
        ['A price of $112 includes 12% VAT. Find the VAT amount.', 'vat', 12],
        ['A $112 VAT-inclusive price has a 12% VAT rate. Find the price before VAT.', 'vat', 100],
        ['An item has cost price $50 and selling price $65. Find the profit amount.', 'profit_loss', 15],
        ['An item has cost price $80 and selling price $68. Find the loss amount.', 'profit_loss', 12],
        ['An item costs $50 and sells for $65. Find the profit percentage.', 'profit_loss', 30],
        ['An item costs $80 and sells for $68. Find the loss percentage.', 'profit_loss', 15],
        ['An item costs $100. Apply a 25% markup, then a 10% discount, then 12% VAT. Find the final price.', 'price_chain', 126]
    ];

    for (const [question, expectedKind, expectedAmount] of cases) {
        const decision = calculator.detectDecision(question);
        assert.equal(decision.operation, 'percentage_application', question);
        assert.equal(decision.arguments.kind, expectedKind, question);
        assert.ok(Math.abs(calculator.calculate(decision).result.amount - expectedAmount) < 1e-9, question);
        assert.equal(calculator.verifyAnswer(question, String(expectedAmount)).passed, true, question);
    }

    const chain = calculator.calculate(calculator.detectDecision(cases.at(-1)[0])).result;
    assert.deepEqual(JSON.parse(JSON.stringify(chain.stages.map(stage => stage.type))), ['markup', 'discount', 'vat']);
    assert.deepEqual(JSON.parse(JSON.stringify(chain.stages.map(stage => stage.endingAmount))), [125, 112.5, 126]);

    const reverseChain = calculator.calculate(calculator.detectDecision('An item costs $100. Apply 12% VAT, then a 10% discount, then a 25% markup. Find the final price.')).result;
    assert.deepEqual(JSON.parse(JSON.stringify(reverseChain.stages.map(stage => stage.type))), ['vat', 'discount', 'markup']);
    assert.deepEqual(JSON.parse(JSON.stringify(reverseChain.stages.map(stage => stage.endingAmount))), [112, 100.8, 126]);
});

test('calculator does not mistake depreciation for compound interest', () => {
    assert.equal(calculator.detectDecision('An appliance worth 2400 depreciates by 18% each year').operation, 'none');
});

test('calculator detects and compares simple versus compound interest', () => {
    const question = 'Compare the balance on $1000 at 10% simple interest for 2 years with 10% compounded annually for 2 years.';
    const decision = calculator.detectDecision(question);
    assert.equal(decision.operation, 'interest_comparison');
    assert.deepEqual(JSON.parse(JSON.stringify(calculator.calculate(decision).result)), {
        simpleAmount: 1200,
        compoundAmount: 1210,
        greater: 'compound interest',
        difference: 10
    });
});

test('calculator rejects undefined or invalid edge cases', () => {
    assert.throws(() => calculator.calculate({ operation: 'arithmetic', arguments: { expression: '1 / 0' } }), /Division by zero/);
    assert.throws(() => calculator.calculate({ operation: 'root', arguments: { radicand: -16, index: 2 } }), /even root/);
    assert.throws(() => calculator.calculate({ operation: 'logarithm', arguments: { base: 1, argument: 10 } }), /base/);
    assert.throws(() => calculator.calculate({ operation: 'percentage_change', arguments: { original: 0, newValue: 5 } }), /zero/);
    assert.throws(() => calculator.calculate({ operation: 'probability', arguments: { probabilityType: 'classical', favorableOutcomes: 9, totalOutcomes: 8 } }), /Require/);
});

test('answer verification accepts correct work and flags an incorrect result', () => {
    assert.equal(calculator.verifyAnswer('Solve 3x + 2 = 14', 'x = 4').passed, true);
    assert.equal(calculator.verifyAnswer('Solve 3x + 2 = 14', 'x = 5').passed, false);
});

const assistantScenarios = [
    { topic: 'Functions', question: 'Find the range of f(x) = sqrt(x + 1).', method: 'Use the restriction on the radicand.', answer: 'y >= 0' },
    { topic: 'Business Mathematics', question: 'What is 15% of 240?', method: 'Convert the percent to a decimal and multiply.', answer: '36' },
    { topic: 'Statistics', question: 'Find the mean of 2, 4, 6, and 8.', method: 'Add the observations and divide by their count.', answer: '5' },
    { topic: 'Sequences and Series', question: 'Find the 10th term of the arithmetic sequence with first term 3 and common difference 2.', method: 'Use the arithmetic nth-term formula.', answer: '21' },
    { topic: 'Logic and Mathematical Reasoning', question: 'What is the contrapositive of: if n is even, then n squared is even?', method: 'Negate both parts and reverse their order.', answer: 'If n squared is odd, then n is odd.' }
];

for (const scenario of assistantScenarios) {
    test(`assistant retrieves ${scenario.topic}, structures, and renders the answer`, async () => {
        const harness = createAssistantHarness({
            topic: scenario.topic,
            given: 'Information stated in the question',
            find: 'The requested result',
            method: scenario.method,
            working: ['Apply the relevant Grade 11 rule.'],
            check: '',
            answer: scenario.answer
        });
        const reply = await harness.submit(scenario.question);
        const request = harness.requests[0].options;
        const systemPrompt = request.messages[0].content;

        assert.ok(systemPrompt.includes(`Topic: ${scenario.topic}`), 'retrieved notes identify the expected curriculum topic');
        assert.equal(request.format.type, 'object', 'assistant requests its structured response schema');
        assert.ok(reply.textContent.includes(scenario.answer), `Expected answer ${scenario.answer}; got ${reply.textContent}`);
        assert.doesNotMatch(reply.textContent, /\*\*(?:Topic|Given|Find|Method|Working|Check):\*\*/);
        assert.ok(harness.assets.some(asset => asset.includes('node_modules/katex/dist/katex.min.css')));
        assert.ok(harness.assets.some(asset => asset.includes('node_modules/katex/dist/katex.min.js')));
        assert.ok(harness.assets.some(asset => asset.includes('node_modules/katex/dist/contrib/auto-render.min.js')));
        assert.ok(harness.assets.filter(asset => asset?.includes('katex')).every(asset => !asset.includes('jsdelivr')));
        assert.ok(harness.mathRenders.length > 0, 'answer passes through the math renderer');
        assert.ok(harness.mathRenders[0].options.delimiters.some(delimiter => delimiter.left === '$'));
    });
}

test('assistant sends Gemini requests through its configured same-origin proxy', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions', given: 'f(x) = 2x + 1', find: 'f(4)',
        method: 'Substitute x = 4.', working: ['2(4) + 1 = 9.'], check: '', answer: '9'
    }, { provider: 'gemini', endpoint: '/api/assistant' });

    await harness.submit('Given f(x) = 2x + 1, find f(4).');
    const request = harness.requests[0];

    assert.equal(request.url, '/api/assistant');
    assert.ok(Array.isArray(request.options.messages));
    assert.equal(request.options.format.type, 'object');
    assert.equal(request.options.model, undefined, 'the server selects the Gemini model from its environment');
    assert.equal(request.options.options, undefined, 'provider-specific Ollama tuning is not sent to Gemini');
});

test('assistant retrieves Fibonacci rules and contextual pattern examples', async () => {
    const fibonacciHarness = createAssistantHarness({
        topic: 'Sequences and Series',
        given: 'Terms = 1, 1, 2, 3, 5, 8',
        find: 'The next Fibonacci term',
        method: 'Add the two previous terms.',
        working: ['5 + 8 = 13.'],
        check: 'The next term is the sum of the previous two.',
        answer: '13'
    });
    const fibonacciReply = await fibonacciHarness.submit('Find the next Fibonacci term: 1, 1, 2, 3, 5, 8.');
    const fibonacciPrompt = fibonacciHarness.requests[0].options.messages[0].content;

    assert.match(fibonacciPrompt, /Subtopic: Fibonacci sequence/);
    assert.match(fibonacciPrompt, /Do not force an arithmetic or geometric assumption/i);
    assert.match(fibonacciReply.textContent, /Fibonacci/);
    assert.match(fibonacciReply.textContent, /Next term = 13/);

    const artHarness = createAssistantHarness({
        topic: 'Sequences and Series',
        given: 'The colors repeat red, blue, blue.',
        find: 'The pattern and next three colors',
        method: 'Identify the repeated block.',
        working: ['The three-color block repeats.'],
        check: '',
        answer: 'The next three colors are red, blue, blue.'
    });
    await artHarness.submit('A tile border in an art project repeats red, blue, blue, red, blue, blue. Describe the pattern and name the next three colors.');
    assert.match(artHarness.requests[0].options.messages[0].content, /Subtopic: Patterns/);
    assert.match(artHarness.requests[0].options.messages[0].content, /three-color repeating cycle/i);
});

test('assistant explains an arithmetic sequence word problem as one term, not a sum', async () => {
    const harness = createAssistantHarness({
        topic: 'Sequences and Series',
        given: 'First row has 20 seats; 3 seats are added in each next row.',
        find: 'Seats in row 10',
        method: 'Use the arithmetic nth-term rule.',
        working: ['a_10 = 20 + (10 - 1)3 = 47.'],
        check: 'The sequence 20, 23, 26, ... has constant difference 3.',
        answer: 'Row 10 has 47 seats.'
    });

    const reply = await harness.submit('A hall has 20 seats in the first row and adds 3 seats in each next row. How many seats are in row 10?');
    const systemPrompt = harness.requests[0].options.messages[0].content;

    assert.match(systemPrompt, /Subtopic: Arithmetic sequences/);
    assert.match(systemPrompt, /identify the first term and common difference/i);
    assert.match(systemPrompt, /do not confuse a term with the sum of terms/i);
    assert.match(reply.textContent, /^\*\*Answer:\*\* Row 10 has 47 seats\./);
    assert.match(reply.textContent, /a_10 = 20 \+ \(10 - 1\)3 = 47/);
    assert.match(reply.textContent, /47 seats/);
});

test('assistant explains geometric terms using the common ratio', async () => {
    const harness = createAssistantHarness({
        topic: 'Sequences and Series',
        given: 'Starting height = 80 cm; monthly growth ratio = 1.25; elapsed months = 3',
        find: 'Height after 3 months',
        method: 'Use a_n = a_1*r^(n-1) with one initial term and three monthly changes.',
        working: ['a_4 = 80*(1.25)^3 = 156.25 cm.'],
        check: 'The common ratio between months is 1.25.',
        answer: 'The model height is 156.25 cm.'
    });

    const reply = await harness.submit('A plant starts at 80 cm and grows by 25% each month. What will its height be after 3 months?');
    const systemPrompt = harness.requests[0].options.messages[0].content;

    assert.match(systemPrompt, /Subtopic: Geometric sequences/);
    assert.match(systemPrompt, /a ratio is multiplicative and is not the common difference/i);
    assert.match(systemPrompt, /a_n = a_1 r\^\(n - 1\)/);
    assert.match(reply.textContent, /a_4 = 80\*\(1\.25\)\^3 = 156\.25 cm/);
});

test('assistant keeps unsupported short patterns tentative', async () => {
    const harness = createAssistantHarness({
        topic: 'Sequences and Series',
        given: 'Terms = 1, 2, 4, 7, 13',
        find: 'A justified next term',
        method: 'Compare simple rules and explain whether the information determines one.',
        working: [],
        check: '',
        answer: 'This short list does not establish a unique simple rule. Please provide another term or the pattern context.'
    });

    const reply = await harness.submit('Find the next term in this pattern: 1, 2, 4, 7, 13.');
    const systemPrompt = harness.requests[0].options.messages[0].content;

    assert.match(systemPrompt, /A finite pattern can fit more than one rule/i);
    assert.match(reply.textContent, /does not establish a unique simple rule/i);
    assert.doesNotMatch(reply.textContent, /arithmetic sequence|geometric sequence/i);
});

test('assistant retrieves and verifies payroll calculations', async () => {
    const harness = createAssistantHarness({
        topic: 'Business Mathematics',
        given: 'Hourly rate = $18, regular hours = 40, overtime hours = 5, overtime multiplier = 1.5, allowance = $75, deductions = $125',
        find: 'Gross and net earnings',
        method: 'Calculate each earning component, add them for gross earnings, then subtract deductions.',
        working: ['Regular pay = 18 * 40 = 720.', 'Overtime pay = 18 * 1.5 * 5 = 135.'],
        check: 'Gross earnings = 930; net earnings = 805.',
        answer: 'Net earnings are 805.'
    });

    const reply = await harness.submit('A worker earns $18 per hour for 40 regular hours and 5 overtime hours at 1.5 times the regular rate, receives a $75 allowance, and has $125 in deductions. Find gross and net earnings.');
    const systemPrompt = harness.requests[0].options.messages[0].content;

    assert.match(systemPrompt, /Subtopic: Wages, Salaries, Overtime, Allowances, Commission and Piecework/);
    assert.match(systemPrompt, /combined earnings problem/i);
    assert.match(systemPrompt, /If a tax rate, taxable base, or table is missing, ask for it/i);
    assert.match(reply.textContent, /gross earnings = 930/i);
    assert.match(reply.textContent, /net earnings = 805/i);
});

test('assistant presents tax payslips in gross-to-net order', async () => {
    const harness = createAssistantHarness({
        topic: 'Business Mathematics',
        given: 'Monthly salary $4,000; overtime pay $250; transport benefit $150; income tax withheld $320; insurance deduction $300',
        find: 'Gross and net income',
        method: 'Add earnings and monetary benefits to find gross income; subtract tax and other deductions to find net income.',
        working: ['Gross income = 4000 + 250 + 150 = 4400.', 'Total deductions = 320 + 300 = 620.'],
        check: 'Net income = 4400 - 620 = 3780.',
        answer: 'Net income is $3,780.'
    });

    const reply = await harness.submit('A monthly salary is $4,000, overtime pay is $250, and a $150 transport benefit is included. Income tax is $320 and an insurance deduction is $300. Find net income.');
    const systemPrompt = harness.requests[0].options.messages[0].content;
    const payslip = reply.textContent;

    assert.match(systemPrompt, /Identify earnings and additions first, determine gross income, then identify and calculate only the stated deductions/i);
    assert.match(systemPrompt, /If a tax rate, taxable base, or table is missing, ask for it/i);
    assert.match(payslip, /benefits = 150/);
    assert.match(payslip, /gross earnings = 4400 \(gross income\)/);
    assert.match(payslip, /tax = 320/);
    assert.match(payslip, /other stated deductions = 300/);
    assert.match(payslip, /deductions = 620/);
    assert.match(payslip, /net earnings = 3780 \(net income\)/);
    assert.ok(payslip.indexOf('gross earnings =') < payslip.indexOf('tax ='));
    assert.ok(payslip.indexOf('tax =') < payslip.indexOf('net earnings ='));
});

test('assistant asks for missing tax rules instead of guessing net income', async () => {
    const harness = createAssistantHarness({
        topic: 'Business Mathematics',
        given: 'Monthly salary = $4,000; tax table/rate and taxable base not supplied',
        find: 'Net income',
        method: 'First identify the missing tax information required to calculate net income.',
        working: [],
        check: '',
        answer: 'I can identify the gross monthly salary as $4,000, but I need the applicable tax rate or table and taxable base before calculating net income.'
    });

    const reply = await harness.submit('My monthly salary is $4,000. What is my net income after tax?');
    const systemPrompt = harness.requests[0].options.messages[0].content;

    assert.match(systemPrompt, /If the rate\/table or base is missing, ask for it rather than supplying jurisdiction-specific rules/);
    assert.match(reply.textContent, /need the applicable tax rate or table and taxable base/i);
    assert.doesNotMatch(reply.textContent, /net income is \$?\d/i);
});

test('assistant retrieves and explains sequential percentage prices', async () => {
    const harness = createAssistantHarness({
        topic: 'Business Mathematics',
        given: 'Cost = $100; markup = 25%; discount = 10%; VAT = 12%',
        find: 'The final price and each stage amount',
        method: 'Apply each percentage to the value produced by the preceding stage.',
        working: ['Markup: $100 * 1.25 = $125.', 'Discount: $125 * 0.90 = $112.50.', 'VAT: $112.50 * 1.12 = $126.'],
        check: 'The final price including VAT is $126.',
        answer: '$126'
    });

    const reply = await harness.submit('An item costs $100. Apply a 25% markup, then a 10% discount, then 12% VAT. Find the final price.');
    const systemPrompt = harness.requests[0].options.messages[0].content;

    assert.match(systemPrompt, /Subtopic: Multi-step percentage price changes/);
    assert.match(systemPrompt, /price chain problem/i);
    assert.match(systemPrompt, /Identify the original\/base amount before calculating/);
    assert.match(systemPrompt, /cost price as the base for markup/);
    assert.match(systemPrompt, /markup: 100 -> 125/i);
    assert.doesNotMatch(systemPrompt, /\[object Object\]/);
    assert.match(reply.textContent, /\*\*Answer:\*\* Final price = \$126\$/);
    assert.match(reply.textContent, /Apply 25% markup: \$100\(1 \+ 25\/100\) = 125/);
    assert.match(reply.textContent, /Apply 10% discount: \$125\(1 - 10\/100\) = 112\.5/);
    assert.match(reply.textContent, /Apply 12% vat: \$112\.5\(1 \+ 12\/100\) = 126/);
});

test('assistant falls back to CDN KaTeX assets when local files are unavailable', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions', given: 'x^2 = 9', find: 'the solutions', method: 'Take the square root of both sides.',
        working: ['x = 3 or x = -3.'], check: 'Both values square to 9.', answer: '$x = -3$ or $x = 3$.'
    }, { failLocalKatexAssets: true });

    const reply = await harness.submit('Explain how to solve x^2 = 9.');

    assert.match(reply.textContent, /x = -3/);
    assert.equal(harness.assets.filter(asset => asset?.includes('cdn.jsdelivr.net/npm/katex@0.16.22/')).length, 3);
    assert.ok(harness.mathRenders.length > 0);
});

test('assistant does not leak the inline-math placeholder text into piecewise function output', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions',
        given: 'The rule is a piecewise function.',
        find: 'The piecewise form',
        method: 'Use two rules on different intervals.',
        working: ['The breakpoint separates the intervals where each rule applies.'],
        check: '',
        answer: 'The piecewise rule is $f(x)=\begin{cases}g(x), & x<a \\ h(x), & x\ge a\end{cases}$. '
    });

    const reply = await harness.submit('What is the piecewise rule?');

    assert.doesNotMatch(reply.textContent, /USD/);
    assert.match(reply.textContent, /piecewise rule/i);
    assert.match(reply.textContent, /f\(x\)/);
});

test('assistant formats plain piecewise examples with KaTeX cases', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions', given: 'Different rules apply on different intervals.',
        find: 'a piecewise function example', method: 'Show each rule with its condition.',
        working: [], check: '',
        answer: 'For example, f(x) = {x+1 if x < 0, 2x-3 if x >= 0}.'
    });

    const reply = await harness.submit('What is a piecewise function?');

    assert.match(reply.textContent, /\$f\(x\) = \\begin\{cases\}/);
    assert.match(reply.textContent, /2x-3, & x \\ge 0/);
    assert.match(harness.mathRenders.at(-1).text, /\\begin\{cases\}/);
});

test('assistant adds a KaTeX piecewise example when the model omits one', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions', given: '', find: '', method: '', working: [], check: '',
        answer: 'A piecewise function uses different rules on different parts of its domain.'
    });

    const reply = await harness.submit('What is a piecewise function?');

    assert.match(reply.textContent, /\$\$f\(x\)=\\begin\{cases\}/);
    assert.match(harness.mathRenders.at(-1).text, /\\begin\{cases\}/);
});

test('assistant accepts basic percentage-equivalence questions', async () => {
    const harness = createAssistantHarness({
        topic: 'Business Mathematics', given: '0.25 and 25%', find: 'why they are equivalent',
        method: 'Convert the decimal to a fraction out of 100.', working: ['0.25 = 25/100 = 25%.'],
        check: '', answer: '0.25 equals 25% because percent means per 100.'
    });

    const reply = await harness.submit('Why is 0.25 equal to 25%?');

    assert.equal(harness.requests.length, 1, 'the question reaches the existing AI instead of the scope refusal');
    assert.match(reply.textContent, /per 100/i);
});

test('assistant includes the explanation for why questions', async () => {
    const harness = createAssistantHarness({
        topic: 'Business Mathematics', given: '0.25 = 25/100', find: 'why the decimal is 25%',
        method: 'Convert the decimal to an equivalent fraction with denominator 100.',
        working: ['0.25 = 25/100.', 'Percent means per 100, so 25/100 = 25%.'],
        check: '', answer: '25%'
    });

    const reply = await harness.submit('Why is 0.25 equal to 25%?');

    assert.match(reply.textContent, /25%/);
    assert.match(reply.textContent, /per 100/i);
});

test('assistant accepts basic measurement questions', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions', given: 'radius = 5 cm', find: 'area', method: 'Use A = pi*r^2.',
        working: ['A = pi*(5)^2 = 78.54 cm^2.'], check: '', answer: 'The area is 78.54 cm^2.'
    });

    const reply = await harness.submit('What is the area of a circle with radius 5 cm?');

    assert.equal(harness.requests.length, 1, 'the question reaches the existing AI instead of the scope refusal');
    assert.match(reply.textContent, /78\.54/);
});

test('assistant retrieves measurement and conversion knowledge', async () => {
    const harness = createAssistantHarness({
        topic: 'Measurement and Conversion', given: '2.4 m', find: 'centimetres',
        method: 'Multiply by 100 centimetres per metre.', working: ['2.4 × 100 = 240.'],
        check: '', answer: '2.4 m = 240 cm.'
    });

    await harness.submit('Convert 2.4 m to centimetres.');
    const prompt = harness.requests[0].options.messages[0].content;

    assert.match(prompt, /Topic: Measurement and Conversion/);
    assert.match(prompt, /Subtopic: Unit conversion and scale/);
});

test('assistant retrieves trigonometry knowledge', async () => {
    const harness = createAssistantHarness({
        topic: 'Trigonometry', given: 'opposite = 3; hypotenuse = 5', find: 'sin(theta)',
        method: 'Use sine = opposite/hypotenuse.', working: ['sin(theta) = 3/5 = 0.6.'],
        check: '', answer: 'sin(theta) = 0.6.'
    });

    await harness.submit('In a right triangle, the opposite side is 3 and the hypotenuse is 5. Find sine of theta.');
    const prompt = harness.requests[0].options.messages[0].content;

    assert.match(prompt, /Topic: Trigonometry/);
    assert.match(prompt, /Subtopic: Trigonometric ratios in right triangles/);
    assert.match(prompt, /sin\\theta/);
});

test('assistant ranks tangent-angle knowledge and returns the verified degree result', async () => {
    const harness = createAssistantHarness({
        topic: 'Statistics', given: '', find: '', method: 'Use an unrelated rule.',
        working: ['The answer is 90 degrees.'], check: '', answer: '90 degrees'
    });
    const reply = await harness.submit('Find the angle using tan, opposite side is 6 cm and adjacent side is 8 cm.');
    const prompt = harness.requests[0].options.messages[0].content;
    assert.match(prompt, /Topic: Trigonometry/);
    assert.match(prompt, /Subtopic: Trigonometric ratios in right triangles/);
    assert.match(prompt, /Right-triangle ratios:.*tan/i);
    assert.doesNotMatch(prompt, /Topic: Business Mathematics/);
    assert.match(reply.textContent, /36\.8698976458/);
    assert.doesNotMatch(reply.textContent, /90/);
});

test('assistant retrieves random-variable expected-value grounding', async () => {
    const harness = createAssistantHarness({
        topic: 'Statistics', given: 'values and probabilities', find: 'expected value',
        method: 'Weight each outcome by its probability.', working: ['10(0.2)+0(0.8)=2'], check: '', answer: '2'
    });
    await harness.submit('Outcomes: 10, 0; probabilities: 0.2, 0.8. Find the expected value.');
    const prompt = harness.requests[0].options.messages[0].content;
    assert.match(prompt, /Subtopic: Random variables and expected value/);
    assert.match(prompt, /E\(X\)=.*x_i p_i/);
});

test('assistant prioritizes exact subtopics for paraphrased statistics, sequences, and logic questions', async () => {
    const cases = [
        ['Find the mean and median of 1, 2, 2, 3, 42.', ['Mean', 'Median']],
        ['An arithmetic sequence has first term 7 and common difference -3. Find its ninth term.', ['Nth term of an arithmetic sequence']],
        ['If p is false and q is true, evaluate (p OR q) AND NOT p.', ['Truth tables and equivalent statements']]
    ];
    for (const [question, expectedSubtopics] of cases) {
        const harness = createAssistantHarness({ topic: 'Statistics', given: question, find: 'result', method: 'calculate', working: [], check: '', answer: 'result' });
        await harness.submit(question);
        const prompt = harness.requests[0].options.messages[0].content;
        const retrieved = [...prompt.matchAll(/^Subtopic: (.+)$/gm)].map(match => match[1]);
        assert.ok(expectedSubtopics.some(name => retrieved.includes(name)), `${question}: expected a relevant subtopic near the top, got ${retrieved.join(', ')}`);
        assert.ok(retrieved.length <= 2, 'retrieval remains focused');
    }
});

test('assistant accepts and retrieves hypothesis-testing questions', async () => {
    const harness = createAssistantHarness({
        topic: 'Statistics', given: 'p = 0.03; alpha = 0.05', find: 'test conclusion',
        method: 'Compare the p-value with alpha.', working: ['0.03 < 0.05, so reject H0.'],
        check: '', answer: 'Reject H0; the evidence is statistically significant at the 5% level.'
    });

    const reply = await harness.submit('In a statistical hypothesis test, p = 0.03 and the significance level is 0.05. What is the conclusion?');
    const prompt = harness.requests[0].options.messages[0].content;

    assert.equal(harness.requests.length, 1, 'the hypothesis-test question reaches the existing AI');
    assert.match(prompt, /Topic: Statistics/);
    assert.match(prompt, /Subtopic: Statistical hypothesis testing/);
    assert.match(reply.textContent, /reject H0/);
});

test('assistant retrieves valid converse counterexamples and algebraic proof guidance', async () => {
    const converseHarness = createAssistantHarness({
        topic: 'Logic and Mathematical Reasoning', given: 'If square, then rectangle.',
        find: 'whether the converse is true', method: 'Test a rectangle that is not a square.',
        working: ['A 2-by-1 rectangle is a rectangle but not a square.'], check: '',
        answer: 'The converse is false; a 2-by-1 rectangle is a counterexample.'
    });
    await converseHarness.submit('The conditional says: if a shape is a square, then it is a rectangle. Is its converse always true? Explain with a counterexample.');
    const conversePrompt = converseHarness.requests[0].options.messages[0].content;

    assert.match(conversePrompt, /Subtopic: Conditional statements and contrapositives/);
    assert.match(conversePrompt, /Subtopic: Counterexamples and conjectures/);
    assert.match(conversePrompt, /2-by-1 rectangle/);

    const proofHarness = createAssistantHarness({
        topic: 'Logic and Mathematical Reasoning', given: 'Let odd integers be 2a+1 and 2b+1.',
        find: 'show their sum is even', method: 'Factor the sum as twice an integer.',
        working: ['(2a+1)+(2b+1)=2(a+b+1).'], check: '', answer: 'The sum is even.'
    });
    await proofHarness.submit('Prove that the sum of any two odd integers is even, using algebra rather than checking examples.');
    const proofPrompt = proofHarness.requests[0].options.messages[0].content;

    assert.match(proofPrompt, /Subtopic: Proof and mathematical reasoning/);
    assert.match(proofPrompt, /odd integers/);
});

test('assistant restores chat history and context after page navigation', async () => {
    const storageValues = new Map();
    const localStorage = {
        getItem(key) { return storageValues.get(key) ?? null; },
        setItem(key, value) { storageValues.set(key, value); }
    };
    const firstPage = createAssistantHarness({
        topic: 'Functions', given: '', find: '', method: '', working: [], check: '', answer: 'Use $a^2 + b^2 = c^2$.'
    }, { localStorage });

    const firstReply = await firstPage.submit('What is the Pythagorean theorem?');
    assert.match(firstReply.textContent, /a\^2 \+ b\^2 = c\^2/);

    const secondPage = createAssistantHarness({
        topic: 'Functions', given: 'The legs are 3 and 4.', find: 'the hypotenuse',
        method: 'Use the Pythagorean theorem.', working: ['$3^2 + 4^2 = 25$', '$c = 5$'],
        check: 'The hypotenuse is 5.', answer: 'The hypotenuse is 5.'
    }, { localStorage });
    const secondReply = await secondPage.submit('Explain how the Pythagorean theorem applies when the legs are 3 and 4.');
    const requestMessages = secondPage.requests[0].options.messages;
    const displayedHistory = secondPage.messages.children.map(message => message.textContent).join('\n');

    assert.match(displayedHistory, /What is the Pythagorean theorem\?/);
    assert.match(displayedHistory, /Pythagorean theorem for a right triangle is \$a\^2 \+ b\^2 = c\^2\$/);
    assert.ok(requestMessages.some(message => message.role === 'user' && message.content === 'What is the Pythagorean theorem?'));
    assert.match(secondReply.textContent, /hypotenuse is 5/);
});

test('assistant enforces the verified function value in its final answer', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions', given: 'f(x) = 3x - 2; x = 5', find: 'f(5)',
        method: 'Substitute 5 into the function rule.',
        working: ['f(5) = 3(5) - 2 = 15.'], check: 'The value is 15.', answer: 'Heavy'
    });

    const reply = await harness.submit('Given f(x)=3x-2, find f(5)');

    assert.match(reply.textContent, /\$f\(5\) = 13\$/);
    assert.doesNotMatch(reply.textContent, /Heavy/);
    assert.match(reply.textContent, /3\(5\)-2 = 13/);
    assert.doesNotMatch(reply.textContent, /15/);
});

test('assistant accepts function notation without a supplied rule and asks for clarification', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions', given: 'No rule for f(x) was supplied.', find: 'f(10)',
        method: 'Ask for the function rule.', working: [], check: '',
        answer: 'What is the rule for f(x)?'
    });

    const reply = await harness.submit('What is f(10)?');

    assert.equal(harness.requests.length, 1, 'function notation reaches the assistant instead of the scope refusal');
    assert.match(reply.textContent, /What is the rule for f\(x\)/i);
});

test('assistant enforces verified totals for discount and tax chains', async () => {
    const taxHarness = createAssistantHarness({
        topic: 'Business Mathematics', given: '$80; discount = 20%; sales tax = 8%',
        find: 'final total', method: 'Apply the discount, then sales tax.',
        working: ['$80 * 0.80 = $64'], check: '', answer: '$64'
    });
    const taxReply = await taxHarness.submit('$80 item after a 20% discount and 8% sales tax.');

    assert.match(taxReply.textContent, /\*\*Answer:\*\* Final price = \$69\.12\$/);
    assert.match(taxReply.textContent, /Step 1:\*\* Apply 20% discount: \$80\(1 - 20\/100\) = 64\$/);
    assert.match(taxReply.textContent, /Step 2:\*\* Apply 8% tax: \$64\(1 \+ 8\/100\) = 69\.12\$/);
    assert.doesNotMatch(taxReply.textContent, /\$80 \* 0\.80/);

    const successiveHarness = createAssistantHarness({
        topic: 'Business Mathematics', given: 'Original price = $100', find: 'final price',
        method: 'Apply each discount to the price remaining.',
        working: ['$100 * 0.80 = $80'], check: '', answer: '$80'
    });
    const successiveReply = await successiveHarness.submit('$100 with a 10% discount followed by another 10% discount.');

    assert.match(successiveReply.textContent, /\*\*Answer:\*\* Final price = \$81\$/);
    assert.match(successiveReply.textContent, /Step 1:\*\* Apply 10% discount: \$100\(1 - 10\/100\) = 90\$/);
    assert.match(successiveReply.textContent, /Step 2:\*\* Apply 10% discount: \$90\(1 - 10\/100\) = 81\$/);
    assert.doesNotMatch(successiveReply.textContent, /\$100 \* 0\.80|\*\*Answer:\*\* \$80/);
});

test('assistant replaces incorrect cylinder arithmetic with the verified calculation', async () => {
    const harness = createAssistantHarness({
        topic: 'Measurement and Conversion', given: 'r = 5.6 cm; h = 13 cm; pi = 3.14',
        find: 'cylinder volume', method: 'Use V = pi*r^2*h.',
        working: ['5.6^2 = 31.36.', '31.36 * 3.14 = 98.2464.', '98.2464 * 13 = 1277.1992.'],
        check: 'The cylinder volume is 1277.1992 cm^3.', answer: '1279 cm^3'
    });

    const reply = await harness.submit('What is the volume of a cylinder with radius=5.6 cm and height is 13 cm? Use pi=3.14.');

    assert.match(harness.requests[0].options.messages[0].content, /Use this result as the numerical answer: 1280\.1152/i);
    assert.match(reply.textContent, /\*\*Answer:\*\* \$V \\approx 1280\.12\\,\\text\{cm\}\^3\$/);
    assert.doesNotMatch(reply.textContent, /1279|98\.2464|1277\.1992/);
    assert.ok(harness.mathRenders.length > 0, 'the verified result still passes through KaTeX rendering');
});

test('assistant puts the direct answer before clearly numbered solution steps', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions',
        given: '3x + 4 = 19',
        find: 'x',
        method: 'Isolate x using inverse operations.',
        working: ['Step 1: Subtract 4 from both sides: 3x = 15.', 'Step 2: Divide both sides by 3: x = 5.'],
        check: 'Substituting x = 5 gives 3(5) + 4 = 19.',
        answer: 'x = 5'
    });

    const reply = await harness.submit('Explain how to solve 3x + 4 = 19 step by step.');
    const answerPosition = reply.textContent.indexOf('**Answer:** $x = 5$');
    const firstStepPosition = reply.textContent.indexOf('**Step 1:** Subtract 4');
    const secondStepPosition = reply.textContent.indexOf('**Step 2:** Divide both sides');
    const systemPrompt = harness.requests[0].options.messages[0].content;

    assert.ok(answerPosition >= 0 && answerPosition < firstStepPosition, 'answer appears before the working');
    assert.ok(firstStepPosition < secondStepPosition, 'steps appear in logical order');
    assert.match(reply.textContent, /\$3x = 15\$/);
    assert.match(harness.mathRenders.at(-1).text, /\$x = 5\$/);
    assert.match(systemPrompt, /Start with the answer, then give a clear step-by-step explanation/);
    assert.doesNotMatch(reply.textContent, /\*\*(?:Topic|Given|Find|Method|Check):\*\*/);
});

test('assistant preserves concise answer and hint formatting instructions', async () => {
    const answerHarness = createAssistantHarness({ topic: '', given: '', find: '', method: '', working: ['$2 + 2 = 4$'], check: '', answer: '$4$' });
    const answerReply = await answerHarness.submit("What's the answer? 2 + 2");
    assert.match(answerHarness.requests[0].options.messages[0].content, /at most two short calculation steps/);
    assert.match(answerReply.textContent, /^\*\*Answer:\*\*/);
    assert.doesNotMatch(answerReply.textContent, /\*\*(?:Topic|Given|Find|Method|Working|Check):\*\*|Verification|Calculator check/);

    const hintHarness = createAssistantHarness({ topic: '', given: '', find: '', method: '', working: ['The full solution must not be shown.'], check: '', answer: 'Try isolating the squared expression first.' });
    const hintReply = await hintHarness.submit('Hint: solve x^2 = 25');
    assert.match(hintHarness.requests[0].options.messages[0].content, /Do not give the final answer or reveal the complete solution/);
    assert.match(hintReply.textContent, /Try isolating/);
    assert.doesNotMatch(hintReply.textContent, /full solution|\*\*(?:Topic|Given|Find|Method|Working|Check|Hint):\*\*/i);
});

test('assistant adapts explain, why, work-check, and clarification requests', async () => {
    const explanationHarness = createAssistantHarness({
        topic: 'Functions', given: 'x^2 = 9', find: 'the solutions', method: 'Take the square root of both sides.',
        working: ['x = 3 or x = -3.'], check: 'Both values square to 9.', answer: 'x = -3 or x = 3.'
    });
    const explanationReply = await explanationHarness.submit('Explain how to solve the quadratic equation x^2 = 9 step by step.');
    assert.match(explanationHarness.requests[0].options.messages[0].content, /step-by-step explanation/i);
    assert.match(explanationReply.textContent, /x = 3 or x = -3/);

    const whyHarness = createAssistantHarness({
        topic: '', given: '', find: '', method: '', working: [], check: '', answer: 'A square has two inputs because both 3 and -3 square to 9.'
    });
    const whyReply = await whyHarness.submit('Why does x^2 = 9 have two solutions?');
    assert.match(whyHarness.requests[0].options.messages[0].content, /underlying mathematical idea/i);
    assert.match(whyReply.textContent, /A square has two inputs/);

    const checkHarness = createAssistantHarness({
        topic: '', given: '', find: '', method: '', working: [], check: 'Substituting x = 4 gives 2(4) + 1 = 9.', answer: 'Your answer is correct.'
    });
    const checkReply = await checkHarness.submit('My answer is x = 4. Is this right?');
    assert.match(checkHarness.requests[0].options.messages[0].content, /check the learner.s shown work in order/i);
    assert.match(checkReply.textContent, /Substituting x = 4/);

    const clarifyHarness = createAssistantHarness({
        topic: '', given: '', find: '', method: '', working: [], check: '', answer: 'What equation or graph should I use to find x?'
    });
    const clarifyReply = await clarifyHarness.submit('Find x.');
    assert.match(clarifyHarness.requests[0].options.messages[0].content, /ask a concise clarifying question/i);
    assert.match(clarifyReply.textContent, /What equation or graph/);
});

test('assistant preserves essential rejected-solution checks in the student response', async () => {
    const harness = createAssistantHarness({
        topic: 'Functions',
        given: 'sqrt(x + 5) = x - 1',
        find: 'valid solution',
        method: 'Square and check candidates in the original equation.',
        working: ['Square and solve: (x - 4)(x + 1) = 0', 'Candidates: x = 4, x = -1'],
        check: 'For x = -1, the original equation gives 2 != -2, so it is invalid. Only x = 4 is valid.',
        answer: 'x = 4'
    });
    const reply = await harness.submit('Solve sqrt(x + 5) = x - 1 and reject any solution that fails the original equation.');
    assert.match(reply.textContent, /x = 4/);
    assert.match(reply.textContent, /x = -1.*invalid|invalid.*x = -1/i);
});

test('assistant replaces malformed numeric answers with trusted calculator results', async () => {
    const meanHarness = createAssistantHarness({
        topic: 'Statistics', given: '5, 7, and 9', find: 'mean', method: 'Add and divide by the count.',
        working: ['5 + 7 + 9 = 21', '21 / 3 = 7'], check: 'The values average to 7.', answer: 'Heat'
    });
    const meanReply = await meanHarness.submit('Find the mean of 5, 7, and 9.');
    assert.match(meanReply.textContent, /7/);
    assert.doesNotMatch(meanReply.textContent, /Heat|\*\*(?:Topic|Given|Find|Method|Working|Check):\*\*/);

    const incorrectMeanHarness = createAssistantHarness({
        topic: 'Statistics', given: '5, 7, and 9', find: 'mean', method: 'Add and divide by the count.',
        working: ['5 + 7 + 9 = 21', '21 / 3 = 7'], check: 'The values average to 7.', answer: 'The mean is 8.'
    });
    const incorrectMeanReply = await incorrectMeanHarness.submit('Find the mean of 5, 7, and 9.');
    assert.match(incorrectMeanReply.textContent, /\*\*Answer:\*\* 7/);
    assert.doesNotMatch(incorrectMeanReply.textContent, /mean is 8/);

    const comparisonHarness = createAssistantHarness({
        topic: 'Business Mathematics', given: '', find: '', method: 'Calculate the balances separately.',
        working: ['Simple interest and compound interest are calculated.'], check: 'Compare both balances.', answer: ''
    });
    const comparisonReply = await comparisonHarness.submit('Compare the final balance on $1000 at 10% simple interest for 2 years with the balance at 10% compounded annually for 2 years. Which is greater?');
    assert.match(comparisonReply.textContent, /simple-interest balance: \$1200/i);
    assert.match(comparisonReply.textContent, /compound-interest balance: \$1210/i);
    assert.match(comparisonReply.textContent, /compound interest is greater by \$10/i);

    const depreciationHarness = createAssistantHarness({
        topic: 'Business Mathematics', given: '', find: '', method: 'Use the repeated percentage multiplier.',
        working: ['The value decreases by a factor of 0.9 each year.'], check: 'The result is below the starting value.', answer: ''
    });
    const depreciationReply = await depreciationHarness.submit('A machine is worth $12000 and loses 10% of its current value each year. Find its value after 3 years.');
    assert.match(depreciationReply.textContent, /8748/);
});

test('live AI cases cover every topic and all six evaluation criteria', () => {
    const liveCases = readJson(path.join(__dirname, 'grade11-ai-cases.json'));
    assert.equal(liveCases.length, 21);
    const topics = new Set();
    const curriculumModules = loadKnowledgeModules();

    for (const evaluation of liveCases) {
        const moduleName = curriculumModules.find(module => module.topic.topicName === evaluation.topic)?.id;
        assert.ok(moduleName, `${evaluation.id}: topic exists`);
        const module = readTopic(moduleName);
        assert.ok(module.subtopics.some(subtopic => subtopic.name === evaluation.subtopic), `${evaluation.id}: subtopic exists`);
        assert.ok(evaluation.methodPattern && evaluation.reasoningPattern && evaluation.answerPattern, `${evaluation.id}: method, reasoning, and answer checks exist`);
        assert.ok(Array.isArray(evaluation.expectedNumbers) || evaluation.expectedCalculationPattern, `${evaluation.id}: calculation check exists`);
        assert.ok(evaluation.category, `${evaluation.id}: test category is specified`);
        topics.add(evaluation.topic);
    }

    assert.equal(topics.size, curriculumNames.length, 'live cases cover every curriculum area');
    for (const topic of topics) {
        assert.ok(liveCases.filter(evaluation => evaluation.topic === topic).length >= 2, `${topic} has more than one evaluation form`);
    }
});

test('calculator does not treat function range as a statistical range', () => {
    assert.equal(calculator.detectDecision('Find the range of f(x) = sqrt(x + 1).').operation, 'none');
});
