(() => {
    const operations = [
        'arithmetic',
        'percentage_of',
        'percentage_change',
        'percentage_of_total',
        'power',
        'root',
        'logarithm',
        'fraction',
        'statistics',
        'sequence',
        'compound_interest',
        'repeated_percentage',
        'interest_comparison',
        'probability',
        'earnings',
        'percentage_application',
        'pattern',
        'cylinder_volume',
        'function_evaluation',
        'trigonometry',
        'annuity',
        'loan',
        'z_score',
        'expected_value',
        'diameter_to_radius',
        'normal_probability',
        'hypothesis_test'
    ];

    const decisionFormat = {
        type: 'object',
        properties: {
            operation: {
                type: 'string',
                enum: ['none', ...operations]
            },
            arguments: {
                type: 'object',
                additionalProperties: true
            }
        },
        required: ['operation', 'arguments'],
        additionalProperties: false
    };

    function requireNumber(args, key) {
        const value = args[key];
        if (value === undefined || value === null || value === '') {
            throw new Error(`A numeric value for ${key} is required.`);
        }
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error(`${key} must be a finite number.`);
        return number;
    }

    function requireInteger(args, key, minimum = Number.MIN_SAFE_INTEGER) {
        const value = requireNumber(args, key);
        if (!Number.isSafeInteger(value) || value < minimum) {
            throw new Error(`${key} must be an integer greater than or equal to ${minimum}.`);
        }
        return value;
    }

    function normalize(value) {
        if (!Number.isFinite(value)) throw new Error('The calculation is outside the finite-number range.');
        if (Math.abs(value) < 1e-12) return 0;
        return Number(value.toPrecision(12));
    }

    function evaluateExpression(expression) {
        if (typeof expression !== 'string' || !expression.trim() || expression.length > 256) {
            throw new Error('Provide an arithmetic expression of at most 256 characters.');
        }

        const tokens = [];
        let index = 0;
        while (index < expression.length) {
            if (/\s/.test(expression[index])) {
                index += 1;
                continue;
            }
            const remaining = expression.slice(index);
            const numberMatch = remaining.match(/^(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i);
            if (numberMatch) {
                tokens.push(Number(numberMatch[0]));
                index += numberMatch[0].length;
            } else if ('()+-*/^'.includes(expression[index])) {
                tokens.push(expression[index]);
                index += 1;
            } else {
                throw new Error(`Unsupported character in arithmetic expression: ${expression[index]}`);
            }
            if (tokens.length > 256) throw new Error('The arithmetic expression is too long.');
        }

        let position = 0;
        const peek = () => tokens[position];
        const take = () => tokens[position++];
        const checked = value => normalize(value);

        function parsePrimary() {
            const token = take();
            if (typeof token === 'number') return token;
            if (token === '(') {
                const value = parseAdditive();
                if (take() !== ')') throw new Error('An opening parenthesis is missing its closing parenthesis.');
                return value;
            }
            throw new Error('Expected a number or a parenthesized expression.');
        }

        function parsePower() {
            const base = parsePrimary();
            if (peek() !== '^') return base;
            take();
            return checked(Math.pow(base, parseUnary()));
        }

        function parseUnary() {
            if (peek() === '+') {
                take();
                return parseUnary();
            }
            if (peek() === '-') {
                take();
                return -parseUnary();
            }
            return parsePower();
        }

        function parseMultiplicative() {
            let value = parseUnary();
            while (peek() === '*' || peek() === '/') {
                const operator = take();
                const right = parseUnary();
                if (operator === '/' && right === 0) throw new Error('Division by zero is undefined.');
                value = checked(operator === '*' ? value * right : value / right);
            }
            return value;
        }

        function parseAdditive() {
            let value = parseMultiplicative();
            while (peek() === '+' || peek() === '-') {
                const operator = take();
                const right = parseMultiplicative();
                value = checked(operator === '+' ? value + right : value - right);
            }
            return value;
        }

        const result = parseAdditive();
        if (position !== tokens.length) throw new Error('The arithmetic expression contains an unexpected token.');
        return normalize(result);
    }

    function greatestCommonDivisor(left, right) {
        let a = Math.abs(left);
        let b = Math.abs(right);
        while (b) [a, b] = [b, a % b];
        return a || 1;
    }

    function checkedProbability(value, label) {
        if (!Number.isFinite(value) || value < 0 || value > 1) {
            throw new Error(`${label} must be between 0 and 1.`);
        }
        return value;
    }

    function numberIsClose(left, right) {
        if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
        const tolerance = 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));
        return Math.abs(left - right) <= tolerance;
    }

    function stripAnswerUnits(source) {
        return source
            .replace(/\\text\s*\{\s*(?:mm|cm|km|m|inches|inch|in|feet|foot|ft)\s*\}\s*(?:\^\{?[23]\}?)?/gi, '')
            .replace(/(?:mm|cm|km|m|inches|inch|in|feet|foot|ft)\s*(?:\^?\s*[23]|[²³])?\s*$/i, '');
    }

    function numberMatchesDisplayedPrecision(source, candidate, expected) {
        if (numberIsClose(candidate, expected)) return true;
        const numericSource = stripAnswerUnits(source);
        const numbers = numericSource.match(/-?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)/g) || [];
        const displayedValue = numbers.at(-1);
        if (!displayedValue) return false;

        const decimalPlaces = displayedValue.split('.')[1]?.length || 0;
        const roundingTolerance = 0.5 * Math.pow(10, -decimalPlaces)
            + Number.EPSILON * Math.max(1, Math.abs(expected)) * 4;
        return Math.abs(candidate - expected) <= roundingTolerance;
    }

    function parseNumericAnswer(source) {
        if (typeof source === 'number') return source;
        if (typeof source !== 'string') return null;
        const numericSource = stripAnswerUnits(source);
        const matches = numericSource.match(/-?(?:\d+\.\d+|\d+|\.\d+)/g) || [];
        if (!matches.length) return null;
        const last = matches[matches.length - 1];
        const value = Number(last);
        return Number.isFinite(value) ? value : null;
    }

    function evaluateSubstitutionExpression(expression, variableValue) {
        if (!expression || typeof expression !== 'string') return null;
        const normalized = expression
            .replace(/\s+/g, '')
            .replace(/²/g, '^2')
            .replace(/³/g, '^3')
            .replace(/(\d)(?=[A-Za-z])/g, '$1*')
            .replace(/([A-Za-z0-9)])\(/g, '$1*(')
            .replace(/x/gi, `(${variableValue})`)
            .replace(/\^/g, '^')
            .replace(/\*\*/g, '^')
            .replace(/(\d|\))\(/g, '$1*(');
        try {
            return evaluateExpression(normalized);
        } catch (error) {
            return null;
        }
    }

    function verifyEquationSubstitution(question, answerText) {
        const equationMatch = question.match(/([A-Za-z0-9\s\+\-\*\/\(\)\.\^]+?)\s*=\s*([-+]?\d+(?:\.\d+)?)/i);
        if (!equationMatch) return null;

        const candidate = parseNumericAnswer(answerText);
        if (candidate === null) return null;

        const leftExpression = equationMatch[1]
            .replace(/^(?:solve|find\s+x|equation)\s*:?\s*/i, '')
            .replace(/\s+/g, '');
        const rightValue = Number(equationMatch[2]);
        const actual = evaluateSubstitutionExpression(leftExpression, candidate);
        if (actual === null) return null;

        return {
            kind: 'equation',
            passed: numberIsClose(actual, rightValue),
            expected: rightValue,
            actual
        };
    }

    function verifyFunctionEvaluation(question, answerText) {
        const functionMatch = question.match(/f\s*\(\s*x\s*\)\s*=\s*([^;\n]+)/i) || question.match(/([A-Za-z])\s*\(\s*x\s*\)\s*=\s*([^;\n]+)/i);
        if (!functionMatch || !functionMatch[2]) return null;

        const candidate = parseNumericAnswer(answerText);
        if (candidate === null) return null;

        const functionExpression = functionMatch[2].replace(/\s+/g, '').replace(/\^/g, '^');
        const actual = evaluateSubstitutionExpression(functionExpression, candidate);
        if (actual === null) return null;

        const requestedValueMatch = question.match(/f\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/i) || question.match(/([A-Za-z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/i);
        const expected = requestedValueMatch ? Number(requestedValueMatch[requestedValueMatch.length - 1]) : candidate;
        return {
            kind: 'function',
            passed: numberIsClose(actual, expected),
            expected,
            actual
        };
    }

    function expectedUnitDimension(decision) {
        if (decision.operation === 'cylinder_volume') return { dimension: 3, unit: decision.arguments.unit };
        if (decision.operation === 'diameter_to_radius') return { dimension: 1, unit: decision.arguments.unit };
        if (decision.operation === 'trigonometry') {
            const { kind, unit } = decision.arguments;
            return { dimension: ['sine_area', 'heron_area'].includes(kind) ? 2 : kind === 'side' ? 1 : 0, unit };
        }
        return null;
    }

    function compareAnswerUnits(decision, answerText, target) {
        const expected = expectedUnitDimension(decision);
        if (!expected?.dimension || !expected.unit) return { passed: true, expected: target };
        const tokens = [...String(answerText || '').matchAll(/\\text\s*\{\s*(mm|cm|km|m|in|ft)\s*\}|\b(mm|cm|km|m|in|ft)\b/gi)];
        const unitMatch = tokens.at(-1);
        if (!unitMatch) return { passed: true, expected: target };
        const unit = (unitMatch[1] || unitMatch[2]).toLowerCase();
        const afterUnit = String(answerText).slice(unitMatch.index + unitMatch[0].length);
        const powerMatch = afterUnit.match(/^\s*(?:\^\s*\{?([23])\}?|([²³]))/);
        const dimension = powerMatch ? Number(powerMatch[1] || (powerMatch[2] === '²' ? 2 : 3)) : 1;
        if (dimension !== expected.dimension) return { passed: false, expected: target };
        const scales = { mm: 0.001, cm: 0.01, m: 1, km: 1000, in: 0.0254, ft: 0.3048 };
        const converted = target * Math.pow(scales[expected.unit] / scales[unit], dimension);
        return { passed: true, expected: converted };
    }

    function verifyDecision(question, answerText) {
        const decision = detectDecision(question);
        if (!decision || decision.operation === 'none') return null;

        const calculation = calculate(decision);
        const numericCandidate = parseNumericAnswer(answerText);
        if (numericCandidate === null) return null;

        const results = Array.isArray(calculation.result) ? calculation.result : [calculation.result];
        const normalizedCandidate = numberIsClose(typeof numericCandidate === 'number' ? numericCandidate : Number(numericCandidate), Number(results[0]));

        const target = typeof calculation.result === 'number'
            ? calculation.result
            : Array.isArray(calculation.result)
                ? calculation.result[0]
                : calculation.result && typeof calculation.result.amount === 'number'
                    ? calculation.result.amount
                    : null;

        if (target === null) return null;

        const unitCheck = compareAnswerUnits(decision, answerText, target);
        return {
            kind: decision.operation,
            passed: unitCheck.passed && numberMatchesDisplayedPrecision(answerText, numericCandidate, unitCheck.expected),
            expected: unitCheck.expected,
            actual: numericCandidate
        };
    }

    function normalizeDecision(value) {
        if (!value || typeof value !== 'string') return '';
        return value.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').trim();
    }

    function detectFunctionEvaluationDecision(text) {
        const inputMatches = [...text.matchAll(/\b([a-z])\s*\(\s*(-?\d+(?:\.\d+)?)\s*\)/gi)];
        for (const inputMatch of inputMatches) {
            const functionName = inputMatch[1];
            const definitionPattern = new RegExp(`\\b${functionName}\\s*\\(\\s*x\\s*\\)\\s*=\\s*([^,;]+?)(?=\\s*(?:,|;|\\b(?:find|evaluate|calculate|determine|what|when|if)\\b)|$)`, 'i');
            const definitionMatch = text.match(definitionPattern);
            if (!definitionMatch) continue;

            const expression = definitionMatch[1].trim().replace(/[.!?]+$/, '');
            if (!expression || !/^[\da-z+\-*/^().\s]+$/i.test(expression)) continue;
            return {
                operation: 'function_evaluation',
                arguments: {
                    functionName,
                    expression,
                    input: Number(inputMatch[2])
                }
            };
        }
        return null;
    }

    function detectTriangleDecision(text) {
        const amount = '(-?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?|\\.\\d+)';
        const clean = text.replace(/,/g, '');
        const unitMatch = clean.match(/\b(mm|cm|m|km|inches?|feet|ft)\b/i);
        const unit = unitMatch?.[1]?.toLowerCase().replace(/inches?/, 'in').replace('feet', 'ft') || '';
        const findNamed = (...names) => {
            for (const name of names) {
                const match = clean.match(new RegExp(`\\b${name}\\s*(?:side)?\\s*(?:is|of|=|:)?\\s*${amount}`, 'i'));
                if (match) return Number(match[1]);
            }
            return undefined;
        };
        const asksArea = /\b(area|square units?)\b/i.test(clean);
        if (asksArea && /\bheron'?s?\b/i.test(clean)) {
            const sides = [...clean.matchAll(new RegExp(`\\b(?:sides?\\s*)?${amount}`, 'gi'))]
                .map(match => Number(match[1])).slice(-3);
            if (sides.length === 3) return { operation: 'trigonometry', arguments: { kind: 'heron_area', sides, unit } };
        }
        if (asksArea && /\b(sin|sine|included angle)\b/i.test(clean)) {
            const sideA = findNamed('a', 'side a', 'first side');
            const sideB = findNamed('b', 'side b', 'second side');
            const angle = findNamed('angle', 'included angle', 'c', 'theta');
            const numbers = [...clean.matchAll(new RegExp(amount, 'g'))].map(match => Number(match[1]));
            if (sideA === undefined && numbers.length >= 3) return { operation: 'trigonometry', arguments: { kind: 'sine_area', sideA: numbers[0], sideB: numbers[1], angleDeg: numbers[2], unit } };
            if (sideA !== undefined && sideB !== undefined && angle !== undefined) return { operation: 'trigonometry', arguments: { kind: 'sine_area', sideA, sideB, angleDeg: angle, unit } };
        }

        const ratioName = clean.match(/\b(sin|sine|cos|cosine|tan|tangent)\b/i)?.[1]?.toLowerCase()
            || (asksArea && /\bincluded angle\b/i.test(clean) ? 'sin' : null);
        if (!ratioName) return null;
        const ratio = ({ sine: 'sin', cosine: 'cos', tangent: 'tan' })[ratioName] || ratioName;
        const opposite = findNamed('opposite', 'vertical side', 'height');
        const adjacent = findNamed('adjacent', 'horizontal distance');
        const hypotenuse = findNamed('hypotenuse');
        const angle = findNamed('angle of elevation', 'angle of depression', 'elevation angle', 'depression angle', 'angle', 'theta');
        const asksAngle = /\b(find|calculate|determine|what is)\b[^.!?]*\b(angle|theta|bearing)\b/i.test(clean)
            || /\b(angle|theta)\b[^.!?]*\b(find|calculate|determine)\b/i.test(clean);
        if (asksAngle) {
            const pair = ratio === 'sin' ? [opposite, hypotenuse]
                : ratio === 'cos' ? [adjacent, hypotenuse]
                    : [opposite, adjacent];
            if (pair.every(value => value !== undefined)) {
                return { operation: 'trigonometry', arguments: { kind: 'angle', ratio, numerator: pair[0], denominator: pair[1], angleUnit: /radians?/i.test(clean) ? 'radians' : 'degrees' } };
            }
        }
        const targetRole = /\bopposite|height|vertical change\b/i.test(clean) ? 'opposite'
            : /\badjacent|horizontal distance\b/i.test(clean) ? 'adjacent'
                : /\bhypotenuse|line of sight\b/i.test(clean) ? 'hypotenuse' : null;
        if (angle !== undefined && targetRole) {
            const knownSideRole = targetRole === 'opposite' ? (ratio === 'sin' ? 'hypotenuse' : 'adjacent')
                : targetRole === 'adjacent' ? (ratio === 'cos' ? 'hypotenuse' : 'opposite')
                    : (ratio === 'sin' ? 'opposite' : 'adjacent');
            const roleAliases = knownSideRole === 'opposite' ? ['opposite', 'vertical side', 'height']
                : knownSideRole === 'adjacent' ? ['adjacent', 'horizontal distance'] : ['hypotenuse', 'line of sight'];
            const knownSide = findNamed(...roleAliases);
            if (knownSide !== undefined) return { operation: 'trigonometry', arguments: { kind: 'side', ratio, angleDeg: /radians?/i.test(clean) ? angle * 180 / Math.PI : angle, targetRole, knownSideRole, knownSide, unit } };
        }
        if (opposite !== undefined && adjacent !== undefined && /\b(find|calculate|determine)\b/i.test(clean)) {
            return { operation: 'trigonometry', arguments: { kind: 'angle', ratio: 'tan', numerator: opposite, denominator: adjacent, angleUnit: 'degrees' } };
        }
        return null;
    }

    function detectAnnuityOrLoanDecision(text) {
        const amount = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
        const principal = text.match(new RegExp(`(?:principal|loan(?:\\s+amount)?|mortgage|present value|PV)\\s*(?:of|is|=|:)?\\s*[$₱]?\\s*(${amount})`, 'i'));
        const payment = text.match(new RegExp(`(?:payment|deposit|installment)\\s*(?:of|is|=|:)?\\s*[$₱]?\\s*(${amount})`, 'i'))
            || text.match(new RegExp(`[$₱]\\s*(${amount})\\s+(?:monthly\\s+|weekly\\s+|annual\\s+|yearly\\s+)?(?:payment|deposit|installment)`, 'i'));
        const rate = text.match(new RegExp(`(${amount})\\s*%\\s*(?:annual|yearly|per year)?\\s*(?:interest|rate)?|(?:interest|rate)\\s*(?:of|is|=|:)?\\s*(${amount})\\s*%`, 'i'));
        const periods = text.match(new RegExp(`(?:over|for|after|in)\\s+(\\d+)\\s+(years?|months?|quarters?|payments?|periods?)`, 'i'));
        if (!rate || !periods || !/\b(annuit|loan|mortgage|amortiz|periodic payment)\w*\b/i.test(text)) return null;
        const ratePercent = Number(rate[1] || rate[2]);
        const periodWord = periods[2].toLowerCase();
        const paymentIsMonthly = /monthly|each month|per month/i.test(text);
        const paymentIsQuarterly = /quarterly|each quarter|per quarter/i.test(text);
        const periodsPerYear = paymentIsMonthly ? 12 : paymentIsQuarterly ? 4 : 1;
        const n = /year/.test(periodWord) ? Number(periods[1]) * periodsPerYear : Number(periods[1]);
        const rateText = rate[0].toLowerCase();
        const rateIsMonthly = /per month|monthly (?:interest|rate)/i.test(rateText);
        const rateIsQuarterly = /per quarter|quarterly (?:interest|rate)/i.test(rateText);
        const rateIsAnnual = /annual|annually|per year|yearly/i.test(rateText);
        const ratePerPeriod = ratePercent / 100 * (rateIsMonthly ? (paymentIsMonthly ? 1 : 12) : rateIsQuarterly ? (paymentIsQuarterly ? 1 : 3) : rateIsAnnual ? 1 / periodsPerYear : 1);
        const timing = /beginning of each|at the beginning|annuity due/i.test(text) ? 'due' : 'ordinary';
        const isLoan = /\b(loan|mortgage|amortiz)\w*\b/i.test(text);
        if (isLoan && principal && /remaining balance|balance after/i.test(text)) {
            const paid = text.match(/(?:after|following)\s+(\d+)\s+payments?/i);
            if (!paid) return null;
            const paymentAmount = payment ? Number(payment[1].replace(/,/g, '')) : undefined;
            return { operation: 'loan', arguments: { kind: 'balance', principal: Number(principal[1].replace(/,/g, '')), ratePerPeriod, periodsPaid: Number(paid[1]), payment: paymentAmount } };
        }
        if (isLoan && principal && /payment|installment/i.test(text)) return { operation: 'loan', arguments: { kind: 'payment', principal: Number(principal[1].replace(/,/g, '')), ratePerPeriod, periods: n } };
        if (payment) {
            const future = /future|accumulated|fair market|cash.flow/i.test(text);
            return { operation: 'annuity', arguments: { kind: future ? 'future_value' : 'present_value', payment: Number(payment[1].replace(/,/g, '')), ratePerPeriod, periods: n, timing } };
        }
        return null;
    }

    function classifyQuestion(question) {
        const text = String(question || '').toLowerCase();
        const detected = detectDecision(question);
        if (detected.operation !== 'none') return { status: 'SOLVABLE', operation: detected.operation };
        if (/\b(cylinder|cylindrical)\b/.test(text) && /\b(volume|surface area)\b/.test(text)) {
            const needs = [];
            if (!/\bradius\b|\bdiameter\b/.test(text)) needs.push('radius or diameter');
            if (!/\bheight\b/.test(text)) needs.push('height');
            if (needs.length) return { status: 'NEEDS_CLARIFICATION', message: `What is the cylinder's ${needs.join(' and ')}?` };
            const units = [...text.matchAll(/\b(mm|cm|km|m|inches?|feet|ft)\b/g)].map(match => match[1].replace(/inches?/, 'in').replace('feet', 'ft'));
            if (new Set(units).size > 1) return { status: 'NEEDS_CLARIFICATION', message: 'What common unit should I use for the cylinder dimensions?' };
        }
        if (/\b(find|calculate|determine)\s+(?:the\s+)?area\b/.test(text) && !/\b(triangle|rectangle|square|circle|parallelogram|trapezoid|cylinder)\b/.test(text)) {
            return { status: 'INSUFFICIENT_INFORMATION', message: 'Which shape is it, and what measurements are given?' };
        }
        return { status: 'SOLVABLE', operation: 'none' };
    }

    function readNumberList(text) {
        return (text.match(/-?(?:\d+\.\d+|\d+|\.\d+)/g) || []).map(Number);
    }

    function detectPatternDecision(text) {
        if (!/\b(pattern|sequence|fibonacci|rule|classify|what comes next)\b|\bnext\b[^.!?]*\bterm\b|\bmissing\b[^.!?]*\bterm\b/i.test(text)) return null;

        const termToken = '(?:-?\\d+(?:\\.\\d+)?|\\?|_)';
        const sequenceMatch = text.match(new RegExp(`${termToken}(?:\\s*,\\s*${termToken}){2,}`));
        const requestedTerm = text.match(/\b(\d+)(?:st|nd|rd|th)\s+(?:term|fibonacci number)\b/i)?.[1];
        const fibonacci = /\bfibonacci\b/i.test(text);
        if (!sequenceMatch) {
            if (!fibonacci || !requestedTerm) return null;
            return {
                operation: 'pattern',
                arguments: {
                    values: [1, 1],
                    fibonacci: true,
                    termNumber: Number(requestedTerm),
                    requestKind: 'term',
                    indexing: /F_?0\s*=\s*0/i.test(text) ? 'zero-based' : 'one-based'
                }
            };
        }

        const tokens = sequenceMatch[0].split(',').map(token => token.trim());
        const missingIndices = tokens.flatMap((token, index) => ['?', '_'].includes(token) ? [index] : []);
        if (missingIndices.length > 1 || tokens.length < 3) return null;
        const values = tokens.map(token => ['?', '_'].includes(token) ? null : Number(token));
        const requestKind = missingIndices.length
            ? 'missing'
            : requestedTerm
                ? 'term'
                : /\bnext\b[^.!?]*\bterm\b|\bwhat comes next\b|\bcontinue\b/i.test(text)
                    ? 'next'
                    : 'rule';

        return {
            operation: 'pattern',
            arguments: {
                values,
                missingIndex: missingIndices[0],
                fibonacci,
                termNumber: requestedTerm ? Number(requestedTerm) : undefined,
                requestKind
            }
        };
    }

    function isSequenceSumRequest(text) {
        if (/\b(?:find|calculate|determine|what is|what's)\s+(?:the\s+)?(?:\d+(?:st|nd|rd|th)|nth|n-th)?\s*term\b/i.test(text)) return false;
        return /\b(sum|summation|altogether)\b/i.test(text)
            || /\btotal\b[^.!?]*\b(?:first|initial)\s+\d+\s+(?:terms?|rows?|stages?)\b/i.test(text);
    }

    function detectArithmeticWordProblem(text) {
        if (isSequenceSumRequest(text)) return null;
        const amount = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
        const unit = '(?:row|figure|day|week|stage|month|step)';
        const find = (...patterns) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) return Number(match[1].replace(/,/g, ''));
            }
            return undefined;
        };
        const firstTerm = find(
            new RegExp(`(?:first|initial|starting)\\s+${unit}\\s+(?:has|contains|is|=)\\s*(${amount})`, 'i'),
            new RegExp(`(${amount})\\s+[a-z]+\\s+in\\s+(?:the\\s+)?(?:first|initial)\\s+${unit}`, 'i'),
            new RegExp(`(?:first|initial|starting)\\s+term(?:\\s+(?:is|=))?\\s*(${amount})`, 'i')
        );
        const commonDifference = find(
            new RegExp(`adds?\\s+(${amount})(?:\\s+[a-z]+){0,3}\\s+(?:to\\s+)?(?:each|every)\\s+(?:new\\s+|next\\s+)?${unit}`, 'i'),
            new RegExp(`increases?\\s+(?:by\\s+)?(${amount})\\s+(?:each|every|per)\\s+${unit}`, 'i'),
            new RegExp(`common\\s+difference(?:\\s+(?:of|is|=))?\\s*(${amount})`, 'i')
        );
        const termNumber = find(
            new RegExp(`(?:${unit})\\s+(?:number\\s+)?(${amount})\\b`, 'i'),
            new RegExp(`(${amount})(?:st|nd|rd|th)\\s+${unit}`, 'i')
        );
        if (firstTerm === undefined || commonDifference === undefined || termNumber === undefined || termNumber < 1 || !/\b(arithmetic|adds?|increases?|common difference)\b/i.test(text)) {
            return null;
        }
        return {
            operation: 'sequence',
            arguments: {
                sequenceType: 'arithmetic_term',
                firstTerm,
                termNumber,
                commonDifference
            }
        };
    }

    function detectGeometricWordProblem(text) {
        if (isSequenceSumRequest(text)) return null;
        if (!/\b(geometric|common ratio|multipl(?:y|ied|ies)|doubles?|triples?|halves|growth factor|grows?|increases?|decreases?|shrinks?)\b/i.test(text)) return null;

        const amount = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
        const find = (...patterns) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) return Number(match[1].replace(/,/g, ''));
            }
            return undefined;
        };
        const firstTerm = find(
            new RegExp(`(?:first|initial|starting)\\s+(?:term|amount|value|population|height|size)?(?:\\s+(?:is|of|at|=))?\\s*\\$?(${amount})`, 'i'),
            new RegExp(`(?:starts?|begins?)\\s+(?:with|at)\\s+\\$?(${amount})`, 'i')
        );
        let commonRatio = find(
            new RegExp(`common\\s+ratio(?:\\s+(?:of|is|=))?\\s*(${amount})`, 'i'),
            new RegExp(`(?:multiplied|multiplies)\\s+by\\s+(${amount})`, 'i'),
            new RegExp(`growth\\s+factor(?:\\s+of|\\s+is|\\s*=)?\\s*(${amount})`, 'i')
        );
        if (commonRatio === undefined && /\bdoubles?\b/i.test(text)) commonRatio = 2;
        if (commonRatio === undefined && /\btriples?\b/i.test(text)) commonRatio = 3;
        if (commonRatio === undefined && /\bhalves\b|\bis halved\b/i.test(text)) commonRatio = 0.5;
        if (commonRatio === undefined) {
            const percentMatch = text.match(new RegExp(`(?:grows?|increases?|rises?|decreases?|shrinks?|loses?)\\s+(?:by\\s+)?(${amount})\\s*%`, 'i'));
            if (percentMatch) {
                const rate = Number(percentMatch[1].replace(/,/g, '')) / 100;
                commonRatio = /\b(decreases?|shrinks?|loses?)\b/i.test(text) ? 1 - rate : 1 + rate;
            }
        }

        const ordinalTerm = find(new RegExp(`(${amount})(?:st|nd|rd|th)\\s+(?:term|${'(?:year|month|week|day|step|stage)'})`, 'i'));
        const indexedTerm = find(new RegExp(`(?:term|year|month|week|day|step|stage)\\s+(${amount})\\b`, 'i'));
        const elapsedPeriods = find(new RegExp(`(?:after|in)\\s+(${amount})\\s+(?:years?|months?|weeks?|days?|steps?|periods?)`, 'i'));
        const termNumber = elapsedPeriods !== undefined
            ? elapsedPeriods + 1
            : ordinalTerm ?? indexedTerm;
        if (firstTerm === undefined || commonRatio === undefined || termNumber === undefined || termNumber < 1) return null;
        return {
            operation: 'sequence',
            arguments: { sequenceType: 'geometric_term', firstTerm, termNumber, commonRatio }
        };
    }

    function detectFinancialSequenceDecision(text) {
        if (!/\b(payment|payments|installment|installments|mortgage|loan|deposit|deposits|contribution|contributions|investment|investments|savings|accumulated value|future value)\b/i.test(text)) return null;

        const amount = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
        const find = (...patterns) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) return Number(match[1].replace(/,/g, ''));
            }
            return undefined;
        };
        const paymentAmount = find(
            new RegExp(`(?:first|initial|starting)\\s+(?:monthly\\s+|weekly\\s+|annual\\s+|yearly\\s+)?(?:payment|deposit|contribution)(?:\\s+(?:of|is|=))?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`(?:payment|deposit|contribution)(?:s)?(?:\\s+(?:of|is|=))?\\s*\\$\\s*(${amount})`, 'i'),
            new RegExp(`\\$\\s*(${amount})\\s+(?:monthly\\s+|weekly\\s+)?(?:payment|deposit|contribution)`, 'i')
        );
        const initialBalance = find(
            new RegExp(`(?:initial|starting)\\s+(?:investment|deposit|balance|principal|amount)(?:\\s+(?:of|is|=))?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`investment(?:\\s+(?:of|is|=))?\\s*\\$\\s*(${amount})`, 'i'),
            new RegExp(`invest(?:s|ed|ment)?\\s+\\$\\s*(${amount})`, 'i'),
            new RegExp(`\\$\\s*(${amount})\\s+(?:investment|principal)`, 'i')
        );
        const periodMatch = text.match(new RegExp(`(?:first|over|for|during|after|in)\\s+(${amount})\\s+(years?|months?|weeks?|days?|payments?|installments?|periods?)`, 'i'));
        if (!periodMatch) return null;
        const periodValue = Number(periodMatch[1].replace(/,/g, ''));
        const periodUnit = periodMatch[2].toLowerCase();
        const periodCount = /year/.test(periodUnit) && /monthly/i.test(text)
            ? periodValue * 12
            : /year/.test(periodUnit) && /weekly/i.test(text)
                ? periodValue * 52
                : periodValue;
        const asksForSinglePayment = /\b(?:\d+(?:st|nd|rd|th)|nth)\s+(?:payment|installment)\b/i.test(text);
        const asksAccumulatedValue = /\b(accumulated|future|ending|final)\s+(?:investment\s+)?(?:value|balance)\b|\bvalue\s+after\b/i.test(text);
        const fixedIncrease = find(
            new RegExp(`(?:increases?|rises?|grows?)\\s+(?:by\\s+)?\\$\\s*(${amount})\\s+(?:each|every|per)\\s+(?:payment|installment|period|month|week|year)`, 'i'),
            new RegExp(`adds?\\s+\\$\\s*(${amount})\\s+(?:to\\s+)?each\\s+(?:payment|installment)`, 'i')
        );
        const paymentGrowthPercent = find(
            new RegExp(`(?:payments?|deposits?|contributions?)[^.!?]*?(?:increase|rise|grow)\\s+(?:by\\s+)?(${amount})\\s*%`, 'i'),
            new RegExp(`(?:increase|rise|growth)\\s+(?:of|by)\\s+(${amount})\\s*%\\s+(?:per|each)\\s+(?:payment|period)`, 'i')
        );
        const ratePercent = find(
            new RegExp(`(?:earns?|earns? interest|interest rate|rate of return|grows?|appreciates?)\\s+(?:at|of|by|is)?\\s*(${amount})\\s*%`, 'i'),
            new RegExp(`(${amount})\\s*%\\s*(?:per|each)\\s+(?:month|year|week|period)`, 'i')
        );

        if (paymentAmount !== undefined && Number.isInteger(periodCount) && periodCount > 0) {
            const isInvestment = /\b(investment|deposit|deposits|contribution|contributions|savings|accumulated value|future value)\b/i.test(text);
            if (fixedIncrease !== undefined) {
                const type = asksForSinglePayment ? 'arithmetic_term' : 'arithmetic_sum';
                return { operation: 'sequence', arguments: { sequenceType: type, firstTerm: paymentAmount, termNumber: asksForSinglePayment ? find(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:payment|installment)`, 'i')) : periodCount, commonDifference: fixedIncrease, financialApplication: 'stepped_payments' } };
            }
            if (paymentGrowthPercent !== undefined) {
                const commonRatio = 1 + paymentGrowthPercent / 100;
                const type = asksForSinglePayment ? 'geometric_term' : 'geometric_sum';
                return { operation: 'sequence', arguments: { sequenceType: type, firstTerm: paymentAmount, termNumber: asksForSinglePayment ? find(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:payment|installment)`, 'i')) : periodCount, commonRatio, financialApplication: 'growing_payments' } };
            }
            if (isInvestment && asksAccumulatedValue && ratePercent !== undefined) {
                return {
                    operation: 'sequence',
                    arguments: { sequenceType: 'geometric_sum', firstTerm: paymentAmount, termNumber: periodCount, commonRatio: 1 + ratePercent / 100, financialApplication: 'periodic_deposits' }
                };
            }
            if (!asksForSinglePayment) {
                return { operation: 'sequence', arguments: { sequenceType: 'arithmetic_sum', firstTerm: paymentAmount, termNumber: periodCount, commonDifference: 0, financialApplication: 'fixed_payments' } };
            }
            const paymentNumber = find(new RegExp(`(\\d+)(?:st|nd|rd|th)\\s+(?:payment|installment)`, 'i'));
            if (paymentNumber !== undefined) return { operation: 'sequence', arguments: { sequenceType: 'arithmetic_term', firstTerm: paymentAmount, termNumber: paymentNumber, commonDifference: 0, financialApplication: 'fixed_payments' } };
        }

        if (initialBalance !== undefined && asksAccumulatedValue && ratePercent !== undefined && periodCount > 0) {
            const termNumber = /year|month|week|day/.test(periodUnit) ? periodCount + 1 : periodCount;
            const type = /\b(decreases?|shrinks?|loses?)\b/i.test(text) ? 'geometric_term' : 'geometric_term';
            const commonRatio = /\b(decreases?|shrinks?|loses?)\b/i.test(text) ? 1 - ratePercent / 100 : 1 + ratePercent / 100;
            return { operation: 'sequence', arguments: { sequenceType: type, firstTerm: initialBalance, termNumber, commonRatio, financialApplication: 'accumulated_balance' } };
        }
        return null;
    }

    function analyzePattern(values, args) {
        if (!Array.isArray(values) || values.length < 2) throw new Error('Pattern analysis requires at least two listed terms.');
        const terms = values.map(value => value === null ? null : requireNumber({ value }, 'value'));
        const missingIndex = args.missingIndex;
        const isFibonacci = sequence => sequence.length >= 3
            && sequence.slice(2).every((value, index) => numberIsClose(value, sequence[index] + sequence[index + 1]));

        const classifyProgression = sequence => {
            if (sequence.length < 3) return null;
            const differences = sequence.slice(1).map((value, index) => normalize(value - sequence[index]));
            if (differences.every(value => numberIsClose(value, differences[0]))) {
                return { type: 'arithmetic', difference: differences[0], rule: `Add ${differences[0]} to each term.` };
            }
            if (sequence.slice(0, -1).every(value => value !== 0)) {
                const ratios = sequence.slice(1).map((value, index) => normalize(value / sequence[index]));
                if (ratios.every(value => numberIsClose(value, ratios[0]))) {
                    return { type: 'geometric', ratio: ratios[0], rule: `Multiply each term by ${ratios[0]}.` };
                }
            }
            return null;
        };

        const classify = sequence => {
            const progression = classifyProgression(sequence);
            if (progression) return { ...progression, differences: sequence.slice(1).map((value, index) => normalize(value - sequence[index])) };

            if (isFibonacci(sequence)) {
                const canonical = (numberIsClose(sequence[0], 1) && numberIsClose(sequence[1], 1))
                    || (numberIsClose(sequence[0], 0) && numberIsClose(sequence[1], 1));
                return {
                    type: args.fibonacci || canonical ? 'Fibonacci' : 'Fibonacci-like',
                    rule: `Each term after the first two is the sum of the previous two (${sequence[0]}, ${sequence[1]}).`
                };
            }

            if (sequence.every(Number.isInteger) && sequence.every(value => value >= 0 && Number.isInteger(Math.sqrt(value)))) {
                const roots = sequence.map(Math.sqrt);
                if (roots.slice(1).every((root, index) => numberIsClose(root, roots[index] + 1))) {
                    const offset = roots[0] - 1;
                    return { type: 'square numbers', rule: offset === 0 ? 'Square the term index: a_n = n^2.' : `Square consecutive integers starting at ${roots[0]} (a_n = (n + ${offset})^2).` };
                }
            }

            if (sequence.every(Number.isInteger)) {
                const oneBasedTriangular = sequence.every((value, index) => value === (index + 1) * (index + 2) / 2);
                if (oneBasedTriangular) return { type: 'triangular numbers', rule: 'Add the next counting number each time; a_n = n(n + 1)/2.' };
            }

            if (sequence.length >= 5) {
                const oddTerms = sequence.filter((value, index) => index % 2 === 0);
                const evenTerms = sequence.filter((value, index) => index % 2 === 1);
                const oddRule = classifyProgression(oddTerms);
                const evenRule = classifyProgression(evenTerms);
                if (oddRule && evenRule) {
                    return {
                        type: 'alternating pattern',
                        oddRule,
                        evenRule,
                        rule: `Odd-position terms: ${oddRule.rule} Even-position terms: ${evenRule.rule}`
                    };
                }
            }

            const firstDifferences = sequence.slice(1).map((value, index) => normalize(value - sequence[index]));
            const secondDifferences = firstDifferences.slice(1).map((value, index) => normalize(value - firstDifferences[index]));
            if (secondDifferences.length >= 2 && secondDifferences.every(value => numberIsClose(value, secondDifferences[0]))) {
                return {
                    type: 'quadratic pattern',
                    firstDifference: firstDifferences[0],
                    secondDifference: secondDifferences[0],
                    rule: `First differences increase by ${secondDifferences[0]}; a_n = ${sequence[0]} + (n - 1)(${firstDifferences[0]}) + (${secondDifferences[0]})(n - 1)(n - 2)/2.`
                };
            }
            return null;
        };

        if (missingIndex !== undefined) {
            const known = terms.map((value, index) => value === null ? null : { index, value }).filter(Boolean);
            if (known.length < 2) throw new Error('A missing term requires at least two known values.');
            const candidates = [];
            if (args.fibonacci) {
                if (missingIndex >= 2 && terms[missingIndex - 2] !== null && terms[missingIndex - 1] !== null) {
                    candidates.push(terms[missingIndex - 2] + terms[missingIndex - 1]);
                }
                if (missingIndex >= 1 && terms[missingIndex + 1] !== null) candidates.push(terms[missingIndex + 1] - terms[missingIndex - 1]);
                if (missingIndex === 0 && terms[1] !== null && terms[2] !== null) candidates.push(terms[2] - terms[1]);
            }
            for (let first = 0; first < known.length - 1; first += 1) {
                for (let second = first + 1; second < known.length; second += 1) {
                    const left = known[first];
                    const right = known[second];
                    const steps = right.index - left.index;
                    const difference = (right.value - left.value) / steps;
                    candidates.push(left.value + (missingIndex - left.index) * difference);
                    if (left.value !== 0 && right.value / left.value > 0) {
                        const ratio = Math.pow(right.value / left.value, 1 / steps);
                        candidates.push(left.value * Math.pow(ratio, missingIndex - left.index));
                    }
                }
            }
            let completedTerms;
            let classification;
            for (const candidate of candidates) {
                const attempt = [...terms];
                attempt[missingIndex] = normalize(candidate);
                const attemptClassification = classify(attempt);
                if (attemptClassification && (!args.fibonacci || isFibonacci(attempt))) {
                    completedTerms = attempt;
                    classification = attemptClassification;
                    break;
                }
            }
            if (!completedTerms) throw new Error('The missing term is not determined by a recognized simple pattern.');
            const result = {
                patternType: classification.type,
                rule: classification.rule,
                commonDifference: classification.difference,
                commonRatio: classification.ratio,
                terms: completedTerms,
                missingIndex,
                missingTerm: completedTerms[missingIndex],
                verified: true,
                amount: completedTerms[missingIndex]
            };
            return result;
        }

        if (terms.some(value => value === null)) throw new Error('A pattern may contain only one missing term.');
        let classification = classify(terms);
        if (!classification && args.fibonacci && terms.length === 2) {
            classification = { type: 'Fibonacci', rule: `Each term after the first two is the sum of the previous two (${terms[0]}, ${terms[1]}).` };
        }
        if (!classification) throw new Error('The listed terms do not establish a recognized simple pattern; do not assume an arithmetic or geometric rule.');

        const termAt = termNumber => {
            if (!Number.isSafeInteger(termNumber) || termNumber < 1) throw new Error('The requested term number must be a positive integer.');
            if (termNumber <= terms.length) return terms[termNumber - 1];
            if (classification.type === 'arithmetic') return normalize(terms[0] + (termNumber - 1) * classification.difference);
            if (classification.type === 'geometric') return normalize(terms[0] * Math.pow(classification.ratio, termNumber - 1));
            if (classification.type === 'Fibonacci' || classification.type === 'Fibonacci-like') {
                const extended = [...terms];
                while (extended.length < termNumber) extended.push(normalize(extended.at(-1) + extended.at(-2)));
                return extended[termNumber - 1];
            }
            if (classification.type === 'square numbers') {
                const rootStart = Math.sqrt(terms[0]);
                return normalize((rootStart + termNumber - 1) ** 2);
            }
            if (classification.type === 'triangular numbers') return termNumber * (termNumber + 1) / 2;
            if (classification.type === 'quadratic pattern') {
                const offset = termNumber - 1;
                return normalize(terms[0] + offset * classification.firstDifference + classification.secondDifference * offset * (offset - 1) / 2);
            }
            if (classification.type === 'alternating pattern') {
                const isOdd = termNumber % 2 === 1;
                const progression = isOdd ? classification.oddRule : classification.evenRule;
                const groupTerms = isOdd ? terms.filter((value, index) => index % 2 === 0) : terms.filter((value, index) => index % 2 === 1);
                const position = Math.ceil(termNumber / 2);
                if (progression.type === 'arithmetic') return normalize(groupTerms[0] + (position - 1) * progression.difference);
                return normalize(groupTerms[0] * Math.pow(progression.ratio, position - 1));
            }
            return null;
        };

        const nextTerm = termAt(terms.length + 1);
        const requestedTerm = args.termNumber === undefined ? undefined : requireInteger(args, 'termNumber', 1);
        const result = {
            patternType: classification.type,
            rule: classification.rule,
            commonDifference: classification.difference,
            commonRatio: classification.ratio,
            terms,
            nextTerm,
            requestedTerm: requestedTerm || undefined,
            requestedValue: requestedTerm ? termAt(requestedTerm) : undefined,
            verified: true
        };
        if (args.requestKind === 'next') result.amount = nextTerm;
        if (requestedTerm) result.amount = result.requestedValue;
        return result;
    }

    function detectEarningsDecision(text) {
        if (!/\b(salary|wages?|overtime|allowances?|benefits?|commission|piecework|gross (?:earnings|income|pay)|net (?:earnings|income|pay)|take.home pay|payroll|deductions?|tax(?:es)?)\b/i.test(text)) return null;

        const amount = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
        const find = (...patterns) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) return Number(match[1].replace(/,/g, ''));
            }
            return undefined;
        };
        const annualSalary = find(
            new RegExp(`(?:annual|yearly)\\s+(?:salary|pay|income)(?:\\s+(?:of|is|=))?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`\\$?(${amount})\\s+(?:per year|a year|annually)`, 'i')
        );
        const salaryPeriod = /\bweekly\b/i.test(text) ? 'weekly' : /\bmonthly\b/i.test(text) ? 'monthly' : null;
        const hasPayrollExtras = /\b(benefits?|allowances?|overtime|deductions?|tax|payroll|gross|net)\b/i.test(text);
        if (annualSalary !== undefined && salaryPeriod && !hasPayrollExtras) {
            return { operation: 'earnings', arguments: { kind: 'annual_salary', annualSalary, period: salaryPeriod } };
        }
        const convertedAnnualSalary = annualSalary !== undefined && salaryPeriod
            ? annualSalary / (salaryPeriod === 'weekly' ? 52 : 12)
            : undefined;
        const periodicSalary = find(
            new RegExp(`(?:monthly|weekly|daily|biweekly)\\s+(?:base\\s+)?salary(?:\\s+(?:of|is|=))?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`\\$?(${amount})\\s+(?:per month|per week|per day|per pay period)`, 'i')
        );

        const hourlyRate = find(
            new RegExp(`hourly\\s+rate(?:\\s+(?:of|is|=))?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`\\$?(${amount})\\s*(?:per\\s+hour|/\\s*hour|an\\s+hour|hourly)`, 'i')
        );
        const overtimeHours = find(
            new RegExp(`(${amount})\\s+overtime\\s+hours?`, 'i'),
            new RegExp(`(${amount})\\s+hours?\\s+of\\s+overtime`, 'i')
        );
        const regularHours = find(
            new RegExp(`(${amount})\\s+(?:regular|normal)\\s+hours?`, 'i'),
            new RegExp(`(?:work(?:s|ed)?|for)\\s+(${amount})\\s+hours?`, 'i')
        );
        const overtimeMultiplier = /time\s+and\s+a\s+half/i.test(text) ? 1.5 : find(
            new RegExp(`(${amount})\\s*(?:times|x)\\s*(?:the\\s*)?(?:regular\\s+)?(?:hourly\\s+)?rate`, 'i')
        );
        const overtimePayAmount = find(
            new RegExp(`overtime\\s+pay(?:\\s+(?:of|is|was|=|:))?\\s*\\$\\s*(${amount})`, 'i'),
            new RegExp(`\\$\\s*(${amount})\\s+overtime\\s+pay`, 'i')
        );

        const sales = find(
            new RegExp(`(?:sales|revenue)(?:\\s+(?:of|were|was|is|=))?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`\\$?(${amount})\\s+(?:in\\s+)?sales`, 'i')
        );
        const commissionRatePercent = find(new RegExp(`(${amount})\\s*%\\s*(?:sales\\s+)?commission`, 'i'));
        const basePay = find(
            new RegExp(`(?:base\\s+(?:salary|pay))\\s*(?:of|is|=)?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`\\$?(${amount})\\s+base\\s+(?:salary|pay)`, 'i'),
            new RegExp(`(?:monthly|weekly|daily|biweekly)\\s+salary(?:\\s+(?:of|is|=))?\\s*\\$?\\s*(${amount})`, 'i'),
            new RegExp(`\\$?(${amount})\\s+(?:monthly|weekly|daily|biweekly)\\s+salary`, 'i')
        ) ?? periodicSalary ?? convertedAnnualSalary;
        const units = find(new RegExp(`(${amount})\\s+(?:pieces?|items?|units?|articles?)`, 'i'));
        const pieceRate = find(new RegExp(`\\$?(${amount})\\s*(?:per|each)\\s*(?:piece|item|unit|article)`, 'i'));
        const allowances = [...text.matchAll(new RegExp(`allowances?\\s*(?:of|is|=)?\\s*\\$?\\s*(${amount})|\\$\\s*(${amount})\\s+(?:[a-z]+\\s+)?allowance`, 'gi'))]
            .map(match => Number((match[1] || match[2]).replace(/,/g, '')));
        const benefits = [...text.matchAll(new RegExp(`benefits?\\s*(?:of|is|valued\\s+at|=|:)\\s*\\$?\\s*(${amount})|\\$\\s*(${amount})\\s+(?:[a-z]+\\s+)?benefit`, 'gi'))]
            .map(match => Number((match[1] || match[2]).replace(/,/g, '')));
        const taxAmounts = [...text.matchAll(new RegExp(`(?:income\\s+)?tax(?:\\s+(?:withheld|withholding|deduction|amount|deducted))?\\s*(?:of|is|was|=|:)?\\s*\\$\\s*(${amount})|(?:income\\s+)?tax(?:\\s+(?:withheld|withholding|deduction|amount|deducted))?\\s+(?:of|is|was|=|:)\\s*(${amount})(?!\\s*%)|\\$\\s*(${amount})\\s+(?:income\\s+)?tax`, 'gi'))]
            .map(match => Number((match[1] || match[2] || match[3]).replace(/,/g, '')));
        const deductions = [...text.matchAll(new RegExp(`(?:deductions?|deduct)\\s*(?:of|is|=)?\\s*\\$?\\s*(${amount})|\\$\\s*(${amount})(?:\\s+(?:in|of|for|stated|payroll|tax|other))*\\s+deductions?`, 'gi'))]
            .filter(match => !/\btax(?:es)?\b/i.test(text.slice(Math.max(0, match.index - 28), match.index)))
            .map(match => Number((match[1] || match[2]).replace(/,/g, '')));
        const deductionPercent = find(new RegExp(`(${amount})\\s*%\\s*(?:payroll\\s+)?deductions?`, 'i'));
        const taxRatePercent = find(
            new RegExp(`(?:income\\s+)?tax(?:\\s+rate)?\\s+(?:of|is|at|=|:)\\s*(${amount})\\s*%`, 'i'),
            new RegExp(`(${amount})\\s*%\\s+(?:income\\s+)?tax`, 'i')
        );
        let taxThreshold = 0;
        const taxBrackets = [...text.matchAll(new RegExp(`(${amount})\\s*%\\s*(?:tax\\s+)?(?:on|for)\\s+(?:the\\s+)?(first|next)\\s+\\$?(${amount})`, 'gi'))]
            .map(match => {
                taxThreshold += Number(match[3].replace(/,/g, ''));
                return { upTo: taxThreshold, ratePercent: Number(match[1].replace(/,/g, '')) };
            });
        const remainingTaxRate = find(new RegExp(`(${amount})\\s*%\\s*(?:tax\\s+)?(?:on|for)\\s+(?:the\\s+)?(?:remaining|rest of)(?:\\s+the)?\\s+(?:taxable\\s+)?income`, 'i'));
        if (remainingTaxRate !== undefined) taxBrackets.push({ upTo: null, ratePercent: remainingTaxRate });
        const taxableIncome = find(new RegExp(`taxable\\s+income(?:\\s+(?:of|is|=))?\\s*\\$?\\s*(${amount})`, 'i'));
        const taxBase = taxableIncome !== undefined
            ? 'taxable_income'
            : /(?:income\s+)?tax[^.!?]*(?:of|on)\s+(?:the\s+)?gross\s+(?:income|earnings|pay)/i.test(text)
                ? 'gross'
                : undefined;
        const requiresTaxDetails = /\btax(?:es)?\b/i.test(text) && taxAmounts.length === 0 && taxRatePercent === undefined && taxBrackets.length === 0;
        const hasOvertime = /\bovertime\b/i.test(text);
        const hasCommission = /\bcommission\b/i.test(text);
        const hasPiecework = /\bpiecework\b/i.test(text);
        const hasAllowance = /\ballowances?\b/i.test(text);
        const hasBenefits = /\bbenefits?\b/i.test(text);
        const measure = /\bnet (?:earnings|income|pay)\b|take.home/i.test(text) || deductions.length || deductionPercent !== undefined || taxAmounts.length || taxRatePercent !== undefined ? 'net' : 'gross';
        const componentTypes = [
            hasOvertime,
            hasCommission,
            hasPiecework,
            hourlyRate !== undefined && !hasOvertime,
            hasAllowance,
            hasBenefits,
            basePay !== undefined
        ].filter(Boolean).length;
        const combined = componentTypes > 1 || deductions.length > 0 || deductionPercent !== undefined || taxAmounts.length > 0 || taxRatePercent !== undefined || taxBrackets.length > 0;
        const components = {
            hourlyRate, regularHours, overtimeHours, overtimeMultiplier, overtimePayAmount, sales, commissionRatePercent,
            units, pieceRate, basePay, allowances, benefits, deductions, deductionPercent, taxAmounts,
            taxRatePercent, taxBrackets, taxBase, taxableIncome, requiresTaxDetails, measure
        };

        if (hasOvertime && hourlyRate !== undefined && regularHours !== undefined && overtimeHours !== undefined && overtimeMultiplier !== undefined) {
            return { operation: 'earnings', arguments: { kind: combined ? 'combined' : 'overtime', ...components } };
        }
        if (hasOvertime && overtimePayAmount !== undefined && basePay !== undefined) {
            return { operation: 'earnings', arguments: { kind: 'combined', ...components } };
        }
        if (hasOvertime) return null;
        if (hasPiecework && units !== undefined && pieceRate !== undefined) {
            return { operation: 'earnings', arguments: { kind: combined ? 'combined' : 'piecework', ...components } };
        }
        if (hasCommission && sales !== undefined && commissionRatePercent !== undefined) {
            return { operation: 'earnings', arguments: { kind: combined ? 'combined' : 'commission', ...components } };
        }
        if (hourlyRate !== undefined && regularHours !== undefined) {
            return { operation: 'earnings', arguments: { kind: combined ? 'combined' : 'hourly_wage', ...components } };
        }
        if (hasAllowance && basePay !== undefined) {
            return { operation: 'earnings', arguments: { kind: combined ? 'combined' : 'allowance', ...components } };
        }
        if (basePay !== undefined) {
            return { operation: 'earnings', arguments: { kind: combined ? 'combined' : 'salary_pay', ...components } };
        }
        return null;
    }

    function detectPercentageDecision(text) {
        if (!/\b(inflation|markup|mark-up|discount|VAT|value-added tax|profit|loss|increases?|decreases?|reduction|tax)\b/i.test(text)) return null;

        const amountPattern = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?';
        const find = (...patterns) => {
            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) return Number(match[1].replace(/,/g, ''));
            }
            return undefined;
        };
        const orderedStages = [];
        const ratePattern = new RegExp(`(${amountPattern})\\s*(?:%|percent\\b)`, 'gi');
        const adjustmentPattern = /\b(sales\s+tax|value-added\s+tax|VAT|tax|discount(?:ed|ing)?s?|off|mark-?up|increases?|decreases?|reduction|rise|rises|fall|falls)\b/i;
        for (const rateMatch of text.matchAll(ratePattern)) {
            const previousPercent = Math.max(text.lastIndexOf('%', rateMatch.index), text.toLowerCase().lastIndexOf('percent', rateMatch.index));
            const before = text.slice(Math.max(previousPercent + 1, rateMatch.index - 48), rateMatch.index);
            const after = text.slice(rateMatch.index + rateMatch[0].length, rateMatch.index + rateMatch[0].length + 32);
            if (/\b(?:not|rather than|instead of)\b[^.!?]*\b(?:single|combined|equivalent)\s*$/i.test(before)) continue;
            const adjustment = after.match(/^\s*(sales\s+tax|value-added\s+tax|VAT|tax|discount(?:ed|ing)?s?|off|mark-?up|increases?|decreases?|reduction|rise|rises|fall|falls)\b/i)?.[1]
                || before.match(adjustmentPattern)?.[1]
                || (/\banother\b/i.test(before) ? orderedStages.at(-1)?.type : undefined);
            if (!adjustment) continue;

            const normalizedAdjustment = adjustment.toLowerCase();
            const type = /discount|\boff\b/.test(normalizedAdjustment)
                ? 'discount'
                : /vat|value-added/.test(normalizedAdjustment)
                    ? 'vat'
                    : /tax/.test(normalizedAdjustment)
                        ? 'tax'
                        : /mark-?up/.test(normalizedAdjustment)
                            ? 'markup'
                        : /decrease|reduction|fall/.test(normalizedAdjustment)
                                ? 'decrease'
                                : 'increase';
            orderedStages.push({ type, ratePercent: Number(rateMatch[1].replace(/,/g, '')) });
        }
        const repeatedDiscount = text.match(new RegExp(`\\b(one|two|three|four|five|six|seven|eight|nine|ten|\\d+)\\s+successive\\s+(${amountPattern})\\s*(?:%|percent)\\s+discounts?\\b`, 'i'));
        if (repeatedDiscount) {
            const writtenCounts = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
            const repeatedCount = Number(repeatedDiscount[1]) || writtenCounts[repeatedDiscount[1].toLowerCase()];
            const repeatedRate = Number(repeatedDiscount[2].replace(/,/g, ''));
            const matchingDiscounts = orderedStages.filter(stage => stage.type === 'discount' && stage.ratePercent === repeatedRate).length;
            const firstMatchingDiscount = orderedStages.findIndex(stage => stage.type === 'discount' && stage.ratePercent === repeatedRate);
            for (let index = matchingDiscounts; index < repeatedCount; index += 1) {
                orderedStages.splice(firstMatchingDiscount + index, 0, { type: 'discount', ratePercent: repeatedRate });
            }
        }
        const costPrice = find(
            new RegExp(`(?:cost(?:\\s+price)?|costs?|buy(?:s|ing)?\\s+for)(?:\\s+(?:of|is|was|=))?\\s*\\$?\\s*(${amountPattern})`, 'i'),
            new RegExp(`\\$?(${amountPattern})\\s+cost(?:\\s+price)?`, 'i')
        );
        const sellingPrice = find(
            new RegExp(`(?:selling\\s+price|sell(?:s|ing)?\\s+for|sold\\s+for)(?:\\s+(?:of|is|was|=))?\\s*\\$?\\s*(${amountPattern})`, 'i'),
            new RegExp(`\\$?(${amountPattern})\\s+selling\\s+price`, 'i')
        );
        const listedPrice = find(
            new RegExp(`(?:listed|list|original|starting|base)\\s+price(?:\\s+(?:of|is|was|=))?\\s*\\$?\\s*(${amountPattern})`, 'i'),
            new RegExp(`price(?:\\s+(?:of|is|was|=))?\\s*\\$?\\s*(${amountPattern})`, 'i'),
            new RegExp(`\\$?(${amountPattern})\\s+(?:original|list|listed)\\s+price`, 'i')
        );
        const markupRatePercent = find(
            new RegExp(`(${amountPattern})\\s*%\\s*(?:mark-?up)`, 'i'),
            new RegExp(`mark-?up(?:\\s+rate)?(?:\\s+of|\\s+is|\\s*=)?\\s*(${amountPattern})\\s*%`, 'i')
        );
        const discountRatePercent = find(
            new RegExp(`(${amountPattern})\\s*%\\s*(?:discount|off)`, 'i'),
            new RegExp(`discount(?:\\s+rate)?(?:\\s+of|\\s+is|\\s*=)?\\s*(${amountPattern})\\s*%`, 'i')
        );
        const vatRatePercent = find(
            new RegExp(`(${amountPattern})\\s*%\\s*(?:VAT|value-added\\s+tax)`, 'i'),
            new RegExp(`(?:VAT|value-added\\s+tax)(?:\\s+rate)?(?:\\s+of|\\s+is|\\s*=)?\\s*(${amountPattern})\\s*%`, 'i')
        );
        const inflationRatePercent = find(
            new RegExp(`inflation(?:\\s+rate)?(?:\\s+of|\\s+is|\\s*=)?\\s*(${amountPattern})\\s*%`, 'i'),
            new RegExp(`(${amountPattern})\\s*%\\s+inflation`, 'i')
        );
        const changeRatePercent = find(
            new RegExp(`(?:increase|decrease|reduce|raise|rise|fall|drop)(?:d)?[^.!?]*?by\\s+(${amountPattern})\\s*%`, 'i'),
            new RegExp(`(${amountPattern})\\s*%\\s+(?:increase|decrease|reduction)`, 'i')
        );

        const isInflation = /\binflation\b/i.test(text);
        const hasMarkup = /\bmark-?up\b/i.test(text);
        const hasDiscount = /\bdiscount\b|\boff\b/i.test(text);
        const hasVat = /\bVAT\b|\bvalue-added tax\b/i.test(text);
        const hasProfitLoss = /\bprofit\b|\bloss\b/i.test(text);
        const inflationRate = inflationRatePercent;
        const discountRate = discountRatePercent;
        const markupRate = markupRatePercent;
        const vatRate = vatRatePercent;

        if (costPrice !== undefined && orderedStages.length >= 2) {
            return { operation: 'percentage_application', arguments: { kind: 'price_chain', baseAmount: costPrice, currency: text.includes('₱') ? '₱' : text.includes('$') ? '$' : '', stages: orderedStages } };
        }

        if (hasProfitLoss && costPrice !== undefined && sellingPrice !== undefined) {
            return {
                operation: 'percentage_application',
                arguments: { kind: 'profit_loss', costPrice, sellingPrice, measure: /\b(percent(?:age)?|rate)\b/i.test(text) ? 'percentage' : 'amount' }
            };
        }

        const baseAmount = find(
            new RegExp(`[$₱]\\s*(${amountPattern})`, 'i'),
            new RegExp(`(?:price|amount|value)(?:\\s+(?:of|is|was|=))?\\s*\\$?\\s*(${amountPattern})`, 'i'),
            new RegExp(`(?:increase|decrease|reduce|raise|rise|fall|drop)[^.!?]*?(?:from|by|to|of)?\\s*\\$\\s*(${amountPattern})`, 'i'),
            new RegExp(`\\b(?:from|on|of|to)\\s+\\$?(${amountPattern})`, 'i'),
            new RegExp(`[$₱]\\s*(${amountPattern})`, 'i')
        ) ?? listedPrice;

        if (baseAmount !== undefined && (orderedStages.length >= 2 || orderedStages[0]?.type === 'tax')) {
            return { operation: 'percentage_application', arguments: { kind: 'price_chain', baseAmount, currency: text.includes('₱') ? '₱' : text.includes('$') ? '$' : '', stages: orderedStages } };
        }

        if (hasMarkup && costPrice !== undefined && markupRate !== undefined) {
            return { operation: 'percentage_application', arguments: { kind: 'markup', baseAmount: costPrice, ratePercent: markupRate, measure: /\bmarkup amount\b/i.test(text) ? 'change' : 'final' } };
        }
        if (hasDiscount && baseAmount !== undefined && discountRate !== undefined) {
            return { operation: 'percentage_application', arguments: { kind: 'discount', baseAmount: listedPrice ?? baseAmount, ratePercent: discountRate, measure: /\bdiscount amount\b|\bhow much.*discount/i.test(text) ? 'change' : 'final' } };
        }
        if (hasVat && baseAmount !== undefined && vatRate !== undefined) {
            const inclusive = /(?:price|total|amount)(?:\s+of)?\s+\$?\d[\d,]*(?:\.\d+)?\s+includes?\b|VAT-inclusive|includes?\s+(?:the\s+)?VAT/i.test(text);
            const measure = /\bprice before VAT\b|\bexcluding VAT\b/i.test(text)
                ? 'base'
                : /\bVAT amount\b|\bhow much.*VAT/i.test(text)
                    ? 'change'
                    : 'final';
            return { operation: 'percentage_application', arguments: { kind: 'vat', baseAmount: listedPrice ?? baseAmount, ratePercent: vatRate, measure, inclusive } };
        }
        if (isInflation && baseAmount !== undefined && inflationRate !== undefined) {
            const periodMatch = text.match(new RegExp(`(${amountPattern})\\s+(?:years?|months?|weeks?)`, 'i'));
            return { operation: 'percentage_application', arguments: { kind: 'inflation', baseAmount, ratePercent: inflationRate, periods: periodMatch ? Number(periodMatch[1]) : 1 } };
        }
        if (changeRatePercent !== undefined && baseAmount !== undefined && /\b(increase|decrease|reduce|raise|rise|fall|drop)\b/i.test(text)) {
            const isDecrease = /\b(decrease|reduce|fall|drop)\b/i.test(text);
            const asksChange = /\b(change amount|increase amount|decrease amount|how much.*(?:increase|decrease))\b/i.test(text);
            return { operation: 'percentage_application', arguments: { kind: isDecrease ? 'decrease' : 'increase', baseAmount, ratePercent: changeRatePercent, measure: asksChange ? 'change' : 'final' } };
        }
        return null;
    }

    function detectDecision(question) {
        if (typeof question !== 'string') return { operation: 'none', arguments: {} };
        const trimmed = question.trim();
        if (!trimmed) return { operation: 'none', arguments: {} };

        const normalized = normalizeDecision(trimmed);

        if (/\bcylinder\b/i.test(normalized) && /\bvolume\b/i.test(normalized)) {
            const numberPattern = '-?(?:\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?|\\d+(?:\\.\\d+)?|\\.\\d+)';
            const measurementPattern = `(${numberPattern})\\s*(mm|cm|km|m|inches|inch|in|feet|foot|ft)?(?=\\s|[,.;!?]|$)`;
            const radiusMatch = normalized.match(new RegExp(`\\bradius\\s*(?:of|is|=|:)?\\s*${measurementPattern}`, 'i'));
            const diameterMatch = normalized.match(new RegExp(`\\bdiameter\\s*(?:of|is|=|:)?\\s*${measurementPattern}`, 'i'));
            const heightMatch = normalized.match(new RegExp(`\\bheight\\s*(?:of|is|=|:)?\\s*${measurementPattern}`, 'i'));
            const radiusOrDiameterMatch = radiusMatch || diameterMatch;
            if (radiusOrDiameterMatch && heightMatch) {
                const normalizeUnit = unit => ({ inches: 'in', inch: 'in', feet: 'ft', foot: 'ft' })[unit] || unit;
                const radiusUnit = normalizeUnit(radiusOrDiameterMatch[2]?.toLowerCase() || '');
                const heightUnit = normalizeUnit(heightMatch[2]?.toLowerCase() || '');
                if (radiusUnit && heightUnit && radiusUnit !== heightUnit) return { operation: 'none', arguments: {} };

                const piMatch = normalized.match(new RegExp(`(?:\\bpi\\b|π)\\s*(?:=|is)?\\s*(${numberPattern})`, 'i'));
                const pi = piMatch ? Number(piMatch[1].replace(/,/g, '')) : Math.PI;
                return {
                    operation: 'cylinder_volume',
                    arguments: {
                        radius: Number(radiusOrDiameterMatch[1].replace(/,/g, '')) / (diameterMatch ? 2 : 1),
                        height: Number(heightMatch[1].replace(/,/g, '')),
                        pi,
                        unit: radiusUnit || heightUnit
                    }
                };
            }
        }

        const diameterMatch = normalized.match(/\bdiameter\s*(?:of|is|=|:)?\s*(-?(?:\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?|\.\d+))\s*(mm|cm|m|km|inches?|feet|ft)?/i);
        if (diameterMatch && /\bradius\b/i.test(normalized) && /\b(find|calculate|determine|what is)\b/i.test(normalized)) {
            return { operation: 'diameter_to_radius', arguments: { diameter: Number(diameterMatch[1].replace(/,/g, '')), unit: diameterMatch[2] || '' } };
        }

        const triangleDecision = detectTriangleDecision(normalized);
        if (triangleDecision) return triangleDecision;
        const financialDecision = detectAnnuityOrLoanDecision(normalized);
        if (financialDecision) return financialDecision;

        const outcomeList = normalized.match(/(?:outcomes?|values?)\s*[:=]\s*([\d.,\s-]+)/i)?.[1];
        const probabilityList = normalized.match(/(?:probabilities|probs?)\s*[:=]\s*([\d.,\s-]+)/i)?.[1];
        if (outcomeList && probabilityList && /expected value|expected payoff|expected winnings/i.test(normalized)) {
            const values = outcomeList.split(/[\s,]+/).filter(Boolean).map(Number);
            const probabilities = probabilityList.split(/[\s,]+/).filter(Boolean).map(Number);
            if (values.length && values.length === probabilities.length) return { operation: 'expected_value', arguments: { values, probabilities } };
        }

        const pValue = normalized.match(/(?:p[- ]?value|\bp\s*=)\s*(?:of\s*)?(0?\.\d+)/i)?.[1];
        const alpha = normalized.match(/(?:alpha|significance level)\s*(?:of|is|=|:)\s*(0?\.\d+|\d+(?:\.\d+)?\s*%?)/i)?.[1];
        if (pValue !== undefined && alpha !== undefined) {
            const alphaValue = alpha.includes('%') ? Number(alpha.replace('%', '')) / 100 : Number(alpha);
            return { operation: 'hypothesis_test', arguments: { kind: 'p_value', pValue: Number(pValue), alpha: alphaValue } };
        }

        const normalMatch = normalized.match(/(?:p\s*\(\s*z\s*([<>])\s*(-?\d+(?:\.\d+)?)\s*\)|probability that z is (?:less than|below)\s*(-?\d+(?:\.\d+)?))/i);
        if (normalMatch) return normalMatch[1] === '>'
            ? { operation: 'normal_probability', arguments: { lower: Number(normalMatch[2]), upper: Infinity } }
            : { operation: 'normal_probability', arguments: { lower: -Infinity, upper: Number(normalMatch[2] || normalMatch[3]) } };
        const normalBetween = normalized.match(/(?:between|from)\s+z\s*=\s*(-?\d+(?:\.\d+)?)\s+(?:and|to)\s+z\s*=\s*(-?\d+(?:\.\d+)?)/i);
        if (normalBetween) return { operation: 'normal_probability', arguments: { lower: Number(normalBetween[1]), upper: Number(normalBetween[2]) } };

        const zNumber = '-?(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?|\\.\\d+)';
        const zScoreMatch = normalized.match(new RegExp(`(?:z[- ]score\\s+(?:of|for)?\\s*${zNumber}.*?(?:mean|average)\\s*(?:of|is|=)?\\s*${zNumber}.*?(?:standard deviation|SD)\\s*(?:of|is|=)?\\s*${zNumber}|(?:x|score)\\s*=\\s*${zNumber}.*?(?:mean|mu)\\s*=\\s*${zNumber}.*?(?:standard deviation|SD|sigma)\\s*=\\s*${zNumber})`, 'i'));
        if (zScoreMatch) {
            const values = [...zScoreMatch[0].matchAll(new RegExp(zNumber, 'g'))].map(match => Number(match[0].replace(/,/g, '')));
            const tailValues = values.slice(-3);
            if (tailValues.length === 3) return { operation: 'z_score', arguments: { value: tailValues[0], mean: tailValues[1], standardDeviation: tailValues[2] } };
        }

        const arithmeticMatch = normalized.match(/^(?:[-+]?\d+(?:\.\d+)?|[-+]?\.\d+)(?:\s*[+\-*/^]\s*(?:[-+]?\d+(?:\.\d+)?|[-+]?\.\d+))*$/);
        if (arithmeticMatch && /[+\-*/^]/.test(normalized)) {
            return { operation: 'arithmetic', arguments: { expression: normalized } };
        }

        const functionEvaluation = detectFunctionEvaluationDecision(normalized);
        if (functionEvaluation) return functionEvaluation;

        const earningsDecision = detectEarningsDecision(normalized);
        if (earningsDecision) return earningsDecision;

        const percentageDecision = detectPercentageDecision(normalized);
        if (percentageDecision) return percentageDecision;

        const patternDecision = detectPatternDecision(normalized);
        if (patternDecision) return patternDecision;

        const arithmeticWordProblem = detectArithmeticWordProblem(normalized);
        if (arithmeticWordProblem) return arithmeticWordProblem;

        const geometricWordProblem = detectGeometricWordProblem(normalized);
        if (geometricWordProblem) return geometricWordProblem;

        const financialSequence = detectFinancialSequenceDecision(normalized);
        if (financialSequence) return financialSequence;

        const percentageOfMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:of|of\s+the)\s*(-?\d+(?:\.\d+)?)/i);
        if (percentageOfMatch) {
            return { operation: 'percentage_of', arguments: { percent: Number(percentageOfMatch[1]), value: Number(percentageOfMatch[2]) } };
        }

        const percentageChangeMatch = normalized.match(/(?:increase|decrease|change)\s*(?:from)?\s*(-?\d+(?:\.\d+)?)\s*(?:to|\-\>?|into)\s*(-?\d+(?:\.\d+)?)/i);
        if (percentageChangeMatch) {
            return { operation: 'percentage_change', arguments: { original: Number(percentageChangeMatch[1]), newValue: Number(percentageChangeMatch[2]) } };
        }

        const percentageOfTotalMatch = normalized.match(/(?:what\s+)?percent(?:age)?\s+is\s+(-?\d+(?:\.\d+)?)\s+(?:of|out\s+of)\s+(-?\d+(?:\.\d+)?)/i)
            || normalized.match(/(-?\d+(?:\.\d+)?)\s+is\s+what\s+percent(?:age)?\s+of\s+(-?\d+(?:\.\d+)?)/i);
        if (percentageOfTotalMatch) {
            return { operation: 'percentage_of_total', arguments: { part: Number(percentageOfTotalMatch[1]), total: Number(percentageOfTotalMatch[2]) } };
        }

        const repeatedChangeMatch = normalized.match(/\b(?:worth|valued at|value of)\s+\$?((?:\d{1,3}(?:,\d{3})+)|\d+(?:\.\d+)?).*?\b(loses?|depreciates?|decreases?|drops?|falls?|increases?|grows?|gains?)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%.*?\b(?:after|for)\s*(\d+(?:\.\d+)?)\s*(years?|months?|weeks?|days?)/i);
        if (repeatedChangeMatch) {
            const direction = /^(?:loses?|depreciates?|decreases?|drops?|falls?)$/i.test(repeatedChangeMatch[2]) ? -1 : 1;
            return {
                operation: 'repeated_percentage',
                arguments: {
                    initialValue: Number(repeatedChangeMatch[1].replace(/,/g, '')),
                    ratePercent: Number(repeatedChangeMatch[3]),
                    periods: Number(repeatedChangeMatch[4]),
                    direction,
                    periodUnit: repeatedChangeMatch[5].toLowerCase()
                }
            };
        }

        const powerMatch = normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:\^|to\s+the\s+power\s+of)\s*(-?\d+(?:\.\d+)?)/i);
        if (powerMatch) {
            return { operation: 'power', arguments: { base: Number(powerMatch[1]), exponent: Number(powerMatch[2]) } };
        }

        const rootMatch = normalized.match(/(?:square\s*root|sqrt|cube\s*root|fourth\s*root)\s*(?:of)?\s*(-?\d+(?:\.\d+)?)/i);
        if (rootMatch) {
            const radicand = Number(rootMatch[1]);
            const index = /cube/.test(normalized) ? 3 : /fourth/.test(normalized) ? 4 : 2;
            return { operation: 'root', arguments: { radicand, index } };
        }

        const logMatch = normalized.match(/log(?:arithm)?\s*(?:base\s*(-?\d+(?:\.\d+)?)\s*)?(?:of\s*)?(-?\d+(?:\.\d+)?)/i);
        if (logMatch) {
            return { operation: 'logarithm', arguments: { base: logMatch[1] === undefined ? 10 : Number(logMatch[1]), argument: Number(logMatch[2]) } };
        }

        const fractionOperationMatch = normalized.match(/\b(simplify|reduce|add|subtract|multiply|divide)\b/i);
        if (fractionOperationMatch && /\d+\s*\/\s*\d+/.test(normalized)) {
            const fractionTokens = normalized.match(/-?\d+\s*\/\s*-?\d+/g) || [];
            const mode = /^(simplify|reduce)$/i.test(fractionOperationMatch[1])
                ? 'simplify'
                : fractionOperationMatch[1].toLowerCase();
            if (fractionTokens.length >= (mode === 'simplify' ? 1 : 2)) {
                const first = fractionTokens[0].split('/').map(Number);
                const second = fractionTokens[1]?.split('/').map(Number) || [];
                return {
                    operation: 'fraction',
                    arguments: {
                        numerator: first[0],
                        denominator: first[1],
                        mode,
                        ...(mode === 'simplify' ? {} : { otherNumerator: second[0], otherDenominator: second[1] })
                    }
                };
            }
        }

        const asksFunctionRange = /\brange\b/i.test(normalized) && /\b(function|domain|graph)\b|[a-z]\s*\(\s*x\s*\)/i.test(normalized);
        const statsMatch = !asksFunctionRange && /\b(mean|average|median|mode|range|variance|standard deviation)\b/i.test(normalized) && /\d/.test(normalized);
        if (statsMatch) {
            const values = readNumberList(normalized);
            if (values.length) {
                const requestedStatistics = [];
                if (/\b(mean|average)\b/i.test(normalized)) requestedStatistics.push('mean');
                if (/\bmedian\b/i.test(normalized)) requestedStatistics.push('median');
                if (/\bmode\b/i.test(normalized)) requestedStatistics.push('mode');
                if (/\brange\b/i.test(normalized)) requestedStatistics.push('range');
                if (/\bvariance\b/i.test(normalized)) requestedStatistics.push('variance');
                if (/\bstandard deviation\b/i.test(normalized)) requestedStatistics.push('standard_deviation');
                const statistic = requestedStatistics.length > 1
                    ? 'summary'
                    : requestedStatistics[0] || 'mean';
                if (statistic === 'summary') {
                    return { operation: 'statistics', arguments: { statistic, statistics: requestedStatistics, values } };
                }
                return { operation: 'statistics', arguments: { statistic, values } };
            }
        }

        const sequenceMatch = /(arithmetic|geometric)\s+(?:sequence|progression|series)/i.test(normalized) && /\d/.test(normalized);
        if (sequenceMatch) {
            const listedTerms = normalized.match(/(?:sequence|progression|series)\s*[:=]?\s*((?:-?\d+(?:\.\d+)?\s*,\s*)+-?\d+(?:\.\d+)?)/i)?.[1];
            const values = listedTerms ? readNumberList(listedTerms) : [];
            const isArithmetic = /arithmetic/i.test(normalized);
            const isSum = isSequenceSumRequest(normalized);
            const requestedTerm = normalized.match(/\b(\d+)(?:st|nd|rd|th)\s+term\b/i)?.[1];
            const requestedCount = normalized.match(/\b(?:first|initial)\s+(\d+)\s+terms?\b/i)?.[1]
                || normalized.match(/\b(\d+)\s+terms?\b/i)?.[1];
            const firstTerm = normalized.match(/\b(?:first|initial)\s+term\s*(?:is|of|=|:)?\s*(-?\d+(?:\.\d+)?)/i)?.[1]
                ?? normalized.match(/\ba\s*_?\s*1\s*=\s*(-?\d+(?:\.\d+)?)/i)?.[1]
                ?? values[0];
            const commonDifference = normalized.match(/\bcommon\s+difference\s*(?:is|of|=|:)?\s*(-?\d+(?:\.\d+)?)/i)?.[1]
                ?? (values.length >= 2 ? values[1] - values[0] : undefined);
            const commonRatio = normalized.match(/\bcommon\s+ratio\s*(?:is|of|=|:)?\s*(-?\d+(?:\.\d+)?)/i)?.[1]
                ?? (values.length >= 2 && values[0] !== 0 ? values[1] / values[0] : undefined);
            const nextTermCount = /\bnext\s+term\b/i.test(normalized) && values.length ? values.length + 1 : undefined;
            const termNumber = Number(requestedTerm || requestedCount || nextTermCount);

            if (firstTerm !== undefined && Number.isFinite(termNumber) && termNumber > 0) {
                if (isArithmetic && Number.isFinite(Number(commonDifference))) {
                    const sequenceType = isSum ? 'arithmetic_sum' : 'arithmetic_term';
                    return { operation: 'sequence', arguments: { sequenceType, firstTerm: Number(firstTerm), termNumber, commonDifference: Number(commonDifference) } };
                }
                if (!isArithmetic && Number.isFinite(Number(commonRatio))) {
                    const sequenceType = isSum ? 'geometric_sum' : 'geometric_term';
                    return { operation: 'sequence', arguments: { sequenceType, firstTerm: Number(firstTerm), termNumber, commonRatio: Number(commonRatio) } };
                }
            }
        }

        const comparesInterestModels = /\bcompare\b|\bwhich\s+(?:balance|amount|option)\b/i.test(normalized)
            && /\bsimple\s+interest\b/i.test(normalized)
            && /\b(?:compound(?:ed)?\s+interest|compounded)\b/i.test(normalized);
        if (comparesInterestModels) {
            const principal = normalized.match(/\$\s*((?:\d{1,3}(?:,\d{3})+)|\d+(?:\.\d+)?)/)?.[1];
            const simpleRatePercent = normalized.match(/(-?\d+(?:\.\d+)?)\s*%\s*simple\s+interest/i)?.[1];
            const compoundRatePercent = normalized.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:compounded|compound(?:ed)?\s+interest)/i)?.[1];
            const simpleYears = normalized.match(/simple\s+interest\s+for\s*(-?\d+(?:\.\d+)?)\s*years?/i)?.[1];
            const compoundYears = normalized.match(/(?:compounded|compound(?:ed)?\s+interest).*?for\s*(-?\d+(?:\.\d+)?)\s*years?/i)?.[1];
            const periodMap = { annually: 1, yearly: 1, quarterly: 4, monthly: 12, daily: 365 };
            const periodKey = /(annually|yearly|quarterly|monthly|daily)/i.exec(normalized)?.[1]?.toLowerCase() || 'annually';
            if (principal !== undefined && simpleRatePercent !== undefined && compoundRatePercent !== undefined && simpleYears !== undefined && compoundYears !== undefined) {
                return {
                    operation: 'interest_comparison',
                    arguments: {
                        principal: Number(principal.replace(/,/g, '')),
                        simpleRatePercent: Number(simpleRatePercent),
                        simpleYears: Number(simpleYears),
                        compoundRatePercent: Number(compoundRatePercent),
                        compoundYears: Number(compoundYears),
                        compoundsPerYear: periodMap[periodKey]
                    }
                };
            }
        }

        const compoundInterestMatch = !comparesInterestModels && /\b(?:compound(?:ed)?\s+interest|compounded)\b/i.test(normalized)
            ? normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:invested|loan|principal|amount)?\s*(?:at|for)?\s*(-?\d+(?:\.\d+)?)\s*%\s*(?:compounded|compound(?:ed)?\s+interest)?\s*(?:annually|quarterly|monthly|daily)?\s*(?:for\s*(-?\d+(?:\.\d+)?)\s*years?)?/i)
            : null;
        if (compoundInterestMatch) {
            const principal = Number(compoundInterestMatch[1]);
            const ratePercent = Number(compoundInterestMatch[2]);
            const years = Number(compoundInterestMatch[3] || 1);
            const periodMap = { annually: 1, yearly: 1, quarterly: 4, monthly: 12, daily: 365 };
            const periodKey = /(annually|yearly|quarterly|monthly|daily)/i.exec(normalized)?.[1]?.toLowerCase() || 'annually';
            return { operation: 'compound_interest', arguments: { principal, ratePercent, years, compoundsPerYear: periodMap[periodKey] || 1 } };
        }

        const probabilityMatch = normalized.match(/probab(?:ility|ly)\s*(?:of\s*)?(?:getting|drawing|rolling|choosing|selecting)?\s*(?:a\s+)?(-?\d+(?:\.\d+)?)\s*(?:out\s*of|\/|from)\s*(-?\d+(?:\.\d+)?)/i);
        if (probabilityMatch) {
            return { operation: 'probability', arguments: { probabilityType: 'classical', favorableOutcomes: Number(probabilityMatch[1] || 1), totalOutcomes: Number(probabilityMatch[2]) } };
        }

        if (/(probability|chance|likely|odds)/i.test(normalized) && /\d/.test(normalized)) {
            const values = readNumberList(normalized);
            if (values.length >= 2) {
                return { operation: 'probability', arguments: { probabilityType: 'classical', favorableOutcomes: values[0], totalOutcomes: values[1] } };
            }
        }

        return { operation: 'none', arguments: {} };
    }

    function calculate(request) {
        if (!request || typeof request !== 'object') throw new Error('A calculation request is required.');
        const args = request.arguments && typeof request.arguments === 'object'
            ? request.arguments
            : request;
        const operation = request.operation;
        let result;
        let formula;

        switch (operation) {
            case 'function_evaluation': {
                const functionName = args.functionName || 'f';
                const expression = args.expression;
                const input = requireNumber(args, 'input');
                result = evaluateSubstitutionExpression(expression, input);
                if (result === null) throw new Error('The function rule contains unsupported or invalid arithmetic.');
                formula = `${functionName}(${input}) = ${expression} = ${result}`;
                break;
            }
            case 'trigonometry': {
                const kind = args.kind;
                const validUnit = value => !value || /^(mm|cm|m|km|in|ft)$/.test(value);
                if (!validUnit(args.unit)) throw new Error('Use one consistent supported length unit for triangle sides.');
                if (kind === 'angle') {
                    const numerator = requireNumber(args, 'numerator');
                    const denominator = requireNumber(args, 'denominator');
                    if (denominator <= 0 || numerator < 0 || numerator > denominator && args.ratio !== 'tan') {
                        throw new Error('The supplied side lengths do not form a valid ratio for this angle.');
                    }
                    const ratioValue = numerator / denominator;
                    const radians = args.ratio === 'sin' ? Math.asin(ratioValue)
                        : args.ratio === 'cos' ? Math.acos(ratioValue)
                            : Math.atan(ratioValue);
                    result = normalize(args.angleUnit === 'radians' ? radians : radians * 180 / Math.PI);
                    formula = `${args.ratio}^{-1}(${numerator}/${denominator}) = ${result} ${args.angleUnit || 'degrees'}`;
                } else if (kind === 'side') {
                    const angleDeg = requireNumber(args, 'angleDeg');
                    const knownSide = requireNumber(args, 'knownSide');
                    if (!(angleDeg > 0 && angleDeg < 90) || knownSide <= 0) throw new Error('Right-triangle side calculations require an acute angle and positive known side.');
                    const angleRad = angleDeg * Math.PI / 180;
                    const factor = args.ratio === 'sin' ? Math.sin(angleRad) : args.ratio === 'cos' ? Math.cos(angleRad) : Math.tan(angleRad);
                    const targetFactor = args.targetRole === 'opposite' ? Math.sin(angleRad)
                        : args.targetRole === 'adjacent' ? Math.cos(angleRad) : 1;
                    const knownFactor = args.knownSideRole === 'opposite' ? Math.sin(angleRad)
                        : args.knownSideRole === 'adjacent' ? Math.cos(angleRad) : 1;
                    if (![factor, targetFactor, knownFactor].every(Number.isFinite) || knownFactor === 0) throw new Error('The trigonometric ratio is undefined for the supplied angle.');
                    result = normalize(knownSide * targetFactor / knownFactor);
                    formula = `${args.targetRole} = ${knownSide}(${targetFactor}/${knownFactor}) = ${result}${args.unit ? ` ${args.unit}` : ''}`;
                } else if (kind === 'sine_area') {
                    const sideA = requireNumber(args, 'sideA');
                    const sideB = requireNumber(args, 'sideB');
                    const angleDeg = requireNumber(args, 'angleDeg');
                    if (sideA <= 0 || sideB <= 0 || angleDeg <= 0 || angleDeg >= 180) throw new Error('Triangle area requires positive sides and an included angle between 0 and 180 degrees.');
                    result = normalize(0.5 * sideA * sideB * Math.sin(angleDeg * Math.PI / 180));
                    formula = `A = 1/2(${sideA})(${sideB})sin(${angleDeg} degrees) = ${result}${args.unit ? ` ${args.unit}^2` : ''}`;
                } else if (kind === 'heron_area') {
                    if (!Array.isArray(args.sides) || args.sides.length !== 3) throw new Error('Heron area requires exactly three side lengths.');
                    const [a, b, c] = args.sides.map((value, index) => requireNumber({ value }, 'value'));
                    if (Math.min(a, b, c) <= 0 || a + b <= c || a + c <= b || b + c <= a) throw new Error('The three positive sides must satisfy the triangle inequality.');
                    const semiperimeter = (a + b + c) / 2;
                    result = normalize(Math.sqrt(semiperimeter * (semiperimeter - a) * (semiperimeter - b) * (semiperimeter - c)));
                    formula = `s = (${a} + ${b} + ${c})/2 = ${semiperimeter}; A = sqrt(s(s-a)(s-b)(s-c)) = ${result}${args.unit ? ` ${args.unit}^2` : ''}`;
                } else {
                    throw new Error('Trigonometry kind must be angle, side, sine_area, or heron_area.');
                }
                break;
            }
            case 'annuity': {
                const payment = requireNumber(args, 'payment');
                const rate = requireNumber(args, 'ratePerPeriod');
                const periods = requireInteger(args, 'periods', 1);
                if (payment < 0 || rate <= -1) throw new Error('Payment must be nonnegative and the per-period rate must exceed -100%.');
                const ordinary = rate === 0
                    ? payment * periods
                    : args.kind === 'future_value'
                        ? payment * (Math.pow(1 + rate, periods) - 1) / rate
                        : payment * (1 - Math.pow(1 + rate, -periods)) / rate;
                const timingFactor = args.timing === 'due' ? 1 + rate : 1;
                const deferralPeriods = requireInteger({ value: args.deferralPeriods ?? 0 }, 'value', 0);
                result = normalize(ordinary * timingFactor / Math.pow(1 + rate, deferralPeriods));
                formula = `${args.kind === 'future_value' ? 'FV' : 'PV'} of ${args.timing || 'ordinary'} annuity = ${payment} per period at ${(rate * 100)}% for ${periods} periods${deferralPeriods ? ` deferred ${deferralPeriods} periods` : ''} = ${result}`;
                break;
            }
            case 'loan': {
                const principal = requireNumber(args, 'principal');
                const rate = requireNumber(args, 'ratePerPeriod');
                if (principal < 0 || rate < 0) throw new Error('Loan principal and per-period interest rate must be nonnegative.');
                if (args.kind === 'payment') {
                    const periods = requireInteger(args, 'periods', 1);
                    result = normalize(rate === 0 ? principal / periods : principal * rate / (1 - Math.pow(1 + rate, -periods)));
                    formula = `Payment = PV*r/(1-(1+r)^(-n)) = ${result}`;
                } else if (args.kind === 'balance') {
                    const periodsPaid = requireInteger(args, 'periodsPaid', 0);
                    const payment = requireNumber(args, 'payment');
                    const grown = principal * Math.pow(1 + rate, periodsPaid);
                    const paidDown = rate === 0 ? payment * periodsPaid : payment * (Math.pow(1 + rate, periodsPaid) - 1) / rate;
                    result = normalize(Math.max(0, grown - paidDown));
                    formula = `Balance after ${periodsPaid} payments = PV(1+r)^k - payment((1+r)^k-1)/r = ${result}`;
                } else {
                    throw new Error('Loan kind must be payment or balance.');
                }
                break;
            }
            case 'z_score': {
                const value = requireNumber(args, 'value');
                const mean = requireNumber(args, 'mean');
                const standardDeviation = requireNumber(args, 'standardDeviation');
                if (standardDeviation <= 0) throw new Error('A z-score requires a positive standard deviation.');
                result = normalize((value - mean) / standardDeviation);
                formula = `z = (${value} - ${mean})/${standardDeviation} = ${result}`;
                break;
            }
            case 'diameter_to_radius': {
                const diameter = requireNumber(args, 'diameter');
                if (diameter < 0) throw new Error('A diameter cannot be negative.');
                result = normalize(diameter / 2);
                formula = `r = d/2 = ${diameter}/2 = ${result}${args.unit ? ` ${args.unit}` : ''}`;
                break;
            }
            case 'normal_probability': {
                const lower = args.lower ?? -Infinity;
                const upper = args.upper ?? Infinity;
                if (lower >= upper) throw new Error('The lower z-score must be less than the upper z-score.');
                const erf = value => {
                    const sign = value < 0 ? -1 : 1;
                    const x = Math.abs(value);
                    const t = 1 / (1 + 0.3275911 * x);
                    const polynomial = (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
                    return sign * (1 - polynomial * Math.exp(-x * x));
                };
                const cdf = value => value === Infinity ? 1 : value === -Infinity ? 0 : (1 + erf(value / Math.sqrt(2))) / 2;
                result = normalize(cdf(upper) - cdf(lower));
                formula = `P(${lower} < Z < ${upper}) = Phi(${upper}) - Phi(${lower}) = ${result}`;
                break;
            }
            case 'hypothesis_test': {
                if (args.kind !== 'p_value') throw new Error('Only a supplied p-value and significance level can be decided deterministically.');
                const p = requireNumber(args, 'pValue');
                const alpha = requireNumber(args, 'alpha');
                if (p < 0 || p > 1 || alpha <= 0 || alpha >= 1) throw new Error('A p-value must be from 0 to 1 and alpha must be between 0 and 1.');
                const reject = p <= alpha;
                result = { decision: reject ? 'reject H0' : 'fail to reject H0', pValue: p, alpha, significant: reject };
                formula = `${p} ${reject ? '<=' : '>'} ${alpha}; ${reject ? 'reject H0' : 'fail to reject H0'}`;
                break;
            }
            case 'expected_value': {
                if (!Array.isArray(args.values) || !Array.isArray(args.probabilities) || args.values.length === 0 || args.values.length !== args.probabilities.length) throw new Error('Expected value requires matching nonempty outcome and probability lists.');
                const outcomes = args.values.map(value => requireNumber({ value }, 'value'));
                const probabilities = args.probabilities.map(value => checkedProbability(requireNumber({ value }, 'value'), 'Probability'));
                if (!numberIsClose(probabilities.reduce((sum, value) => sum + value, 0), 1)) throw new Error('Outcome probabilities must sum to 1.');
                result = normalize(outcomes.reduce((sum, value, index) => sum + value * probabilities[index], 0));
                formula = `E(X) = ${outcomes.map((value, index) => `${value}(${probabilities[index]})`).join(' + ')} = ${result}`;
                break;
            }
            case 'cylinder_volume': {
                const radius = requireNumber(args, 'radius');
                const height = requireNumber(args, 'height');
                const pi = args.pi === undefined ? Math.PI : requireNumber(args, 'pi');
                if (radius < 0 || height < 0) throw new Error('Cylinder radius and height cannot be negative.');
                if (pi <= 0) throw new Error('The value of pi must be positive.');
                result = normalize(pi * radius ** 2 * height);
                formula = `V = pi x ${radius}^2 x ${height} = ${result}`;
                break;
            }
            case 'arithmetic': {
                const expression = args.expression;
                result = evaluateExpression(expression);
                formula = `${expression} = ${result}`;
                break;
            }
            case 'percentage_of': {
                const percent = requireNumber(args, 'percent');
                const value = requireNumber(args, 'value');
                result = normalize(percent * value / 100);
                formula = `${percent}% of ${value} = ${result}`;
                break;
            }
            case 'percentage_change': {
                const original = requireNumber(args, 'original');
                const newValue = requireNumber(args, 'newValue');
                if (original === 0) throw new Error('Percentage change is undefined when the original value is zero.');
                const change = normalize(newValue - original);
                result = {
                    change,
                    percent: normalize(change / Math.abs(original) * 100)
                };
                formula = `Change = ${newValue} - ${original}; percentage change = change / |${original}| x 100`;
                break;
            }
            case 'percentage_of_total': {
                const part = requireNumber(args, 'part');
                const total = requireNumber(args, 'total');
                if (total === 0) throw new Error('A percentage of a total is undefined when the total is zero.');
                result = normalize(part / total * 100);
                formula = `${part} / ${total} x 100% = ${result}%`;
                break;
            }
            case 'percentage_application': {
                const kind = args.kind;
                if (kind === 'profit_loss') {
                    const costPrice = requireNumber(args, 'costPrice');
                    const sellingPrice = requireNumber(args, 'sellingPrice');
                    if (costPrice < 0 || sellingPrice < 0) throw new Error('Cost price and selling price cannot be negative.');
                    const difference = normalize(sellingPrice - costPrice);
                    const amount = normalize(Math.abs(difference));
                    if (costPrice === 0 && amount !== 0) throw new Error('Percentage profit or loss is undefined when cost price is zero.');
                    const percent = costPrice === 0 ? 0 : normalize(amount / costPrice * 100);
                    const outcome = difference > 0 ? 'profit' : difference < 0 ? 'loss' : 'break-even';
                    result = { kind, outcome, costPrice, sellingPrice, amount: args.measure === 'percentage' ? percent : amount, absoluteAmount: amount, percentage: percent };
                    formula = `${outcome}: |${sellingPrice} - ${costPrice}| = ${amount}; percentage = ${amount} / ${costPrice} x 100 = ${percent}%`;
                    break;
                }

                const baseAmount = requireNumber(args, 'baseAmount');
                if (baseAmount < 0) throw new Error('The original or base amount cannot be negative.');
                if (kind === 'price_chain') {
                    if (!Array.isArray(args.stages) || args.stages.length < 1) throw new Error('A price calculation requires at least one percentage stage.');
                    let currentAmount = baseAmount;
                    const stages = args.stages.map(stage => {
                        const ratePercent = requireNumber(stage, 'ratePercent');
                        if (ratePercent < 0) throw new Error('Percentage rates cannot be negative.');
                        let nextAmount;
                        if (stage.type === 'markup' || stage.type === 'vat' || stage.type === 'tax' || stage.type === 'increase') {
                            nextAmount = normalize(currentAmount * (1 + ratePercent / 100));
                        } else if (stage.type === 'discount' || stage.type === 'decrease') {
                            nextAmount = normalize(currentAmount * (1 - ratePercent / 100));
                        } else {
                            throw new Error('Price stages must be markup, discount, tax, VAT, increase, or decrease.');
                        }
                        const stageResult = { type: stage.type, startingAmount: currentAmount, ratePercent, changeAmount: normalize(Math.abs(nextAmount - currentAmount)), endingAmount: nextAmount };
                        currentAmount = nextAmount;
                        return stageResult;
                    });
                    result = { kind, baseAmount, stages, finalPrice: currentAmount, amount: currentAmount };
                    formula = `Apply each percentage to the preceding stage value. ${stages.map(stage => `${stage.type}: ${stage.startingAmount} -> ${stage.endingAmount}`).join('; ')}. Final price = ${currentAmount}`;
                    break;
                }

                const ratePercent = requireNumber(args, 'ratePercent');
                if (ratePercent < 0) throw new Error('Percentage rates cannot be negative.');
                const percentageAmount = normalize(baseAmount * ratePercent / 100);
                if (kind === 'inflation') {
                    const periods = requireInteger(args, 'periods', 0);
                    const finalValue = normalize(baseAmount * Math.pow(1 + ratePercent / 100, periods));
                    result = { kind, baseAmount, ratePercent, periods, increaseAmount: normalize(finalValue - baseAmount), finalValue, amount: finalValue };
                    formula = `Inflation-adjusted value = ${baseAmount}(1 + ${ratePercent}/100)^${periods} = ${finalValue}`;
                } else if (kind === 'markup') {
                    const sellingPrice = normalize(baseAmount + percentageAmount);
                    result = { kind, costPrice: baseAmount, ratePercent, markupAmount: percentageAmount, sellingPrice, amount: args.measure === 'change' ? percentageAmount : sellingPrice };
                    formula = `Markup = ${baseAmount} x ${ratePercent}/100 = ${percentageAmount}; selling price = ${baseAmount} + ${percentageAmount} = ${sellingPrice}`;
                } else if (kind === 'discount') {
                    const finalPrice = normalize(baseAmount - percentageAmount);
                    result = { kind, originalPrice: baseAmount, ratePercent, discountAmount: percentageAmount, finalPrice, amount: args.measure === 'change' ? percentageAmount : finalPrice };
                    formula = `Discount = ${baseAmount} x ${ratePercent}/100 = ${percentageAmount}; price after discount = ${baseAmount} - ${percentageAmount} = ${finalPrice}`;
                } else if (kind === 'vat') {
                    const priceBeforeVat = args.inclusive ? normalize(baseAmount / (1 + ratePercent / 100)) : baseAmount;
                    const priceIncludingVat = args.inclusive ? baseAmount : normalize(baseAmount + percentageAmount);
                    const vatAmount = args.inclusive ? normalize(priceIncludingVat - priceBeforeVat) : percentageAmount;
                    const selectedAmount = args.measure === 'change' ? vatAmount : args.measure === 'base' ? priceBeforeVat : priceIncludingVat;
                    result = { kind, priceBeforeVat, ratePercent, vatAmount, priceIncludingVat, amount: selectedAmount };
                    formula = args.inclusive
                        ? `Price before VAT = ${priceIncludingVat} / (1 + ${ratePercent}/100) = ${priceBeforeVat}; VAT amount = ${priceIncludingVat} - ${priceBeforeVat} = ${vatAmount}`
                        : `VAT = ${baseAmount} x ${ratePercent}/100 = ${vatAmount}; price including VAT = ${baseAmount} + ${vatAmount} = ${priceIncludingVat}`;
                } else if (kind === 'increase' || kind === 'decrease') {
                    const finalValue = normalize(kind === 'increase' ? baseAmount + percentageAmount : baseAmount - percentageAmount);
                    result = { kind, baseAmount, ratePercent, changeAmount: percentageAmount, finalValue, amount: args.measure === 'change' ? percentageAmount : finalValue };
                    formula = `${kind === 'increase' ? 'Increase' : 'Decrease'} = ${baseAmount} x ${ratePercent}/100 = ${percentageAmount}; new value = ${finalValue}`;
                } else {
                    throw new Error('Percentage application must be inflation, markup, discount, VAT, increase, decrease, or profit_loss.');
                }
                break;
            }
            case 'power': {
                const base = requireNumber(args, 'base');
                const exponent = requireNumber(args, 'exponent');
                result = normalize(Math.pow(base, exponent));
                formula = `${base}^${exponent} = ${result}`;
                break;
            }
            case 'root': {
                const radicand = requireNumber(args, 'radicand');
                const index = requireInteger(args, 'index', 1);
                if (radicand < 0 && index % 2 === 0) throw new Error('An even root of a negative number is not real.');
                result = normalize(radicand < 0 ? -Math.pow(-radicand, 1 / index) : Math.pow(radicand, 1 / index));
                formula = `The ${index}${index === 2 ? 'nd' : 'th'} root of ${radicand} is ${result}`;
                break;
            }
            case 'logarithm': {
                const argument = requireNumber(args, 'argument');
                const base = args.base === undefined ? 10 : requireNumber(args, 'base');
                if (argument <= 0) throw new Error('A logarithm argument must be positive.');
                if (base <= 0 || base === 1) throw new Error('A logarithm base must be positive and different from 1.');
                result = normalize(Math.log(argument) / Math.log(base));
                formula = `log base ${base} of ${argument} = ${result}`;
                break;
            }
            case 'fraction': {
                const numerator = requireInteger(args, 'numerator');
                const denominator = requireInteger(args, 'denominator');
                if (denominator === 0) throw new Error('A fraction denominator cannot be zero.');
                const mode = args.mode || 'simplify';
                let top = numerator;
                let bottom = denominator;
                if (mode !== 'simplify') {
                    const otherNumerator = requireInteger(args, 'otherNumerator');
                    const otherDenominator = requireInteger(args, 'otherDenominator');
                    if (otherDenominator === 0) throw new Error('A fraction denominator cannot be zero.');
                    if (mode === 'add' || mode === 'subtract') {
                        const sign = mode === 'add' ? 1 : -1;
                        top = numerator * otherDenominator + sign * otherNumerator * denominator;
                        bottom = denominator * otherDenominator;
                    } else if (mode === 'multiply') {
                        top = numerator * otherNumerator;
                        bottom = denominator * otherDenominator;
                    } else if (mode === 'divide') {
                        if (otherNumerator === 0) throw new Error('Division by a zero fraction is undefined.');
                        top = numerator * otherDenominator;
                        bottom = denominator * otherNumerator;
                    } else {
                        throw new Error('Fraction mode must be simplify, add, subtract, multiply, or divide.');
                    }
                }
                if (!Number.isSafeInteger(top) || !Number.isSafeInteger(bottom)) throw new Error('The fraction calculation exceeds the safe integer range.');
                if (bottom < 0) {
                    top = -top;
                    bottom = -bottom;
                }
                const divisor = greatestCommonDivisor(top, bottom);
                const simplifiedNumerator = top / divisor;
                const simplifiedDenominator = bottom / divisor;
                result = {
                    numerator: simplifiedNumerator,
                    denominator: simplifiedDenominator,
                    decimal: normalize(simplifiedNumerator / simplifiedDenominator)
                };
                formula = `${simplifiedNumerator}/${simplifiedDenominator}`;
                break;
            }
            case 'statistics': {
                const values = args.values;
                if (!Array.isArray(values) || values.length === 0 || values.length > 10000) {
                    throw new Error('Statistics require between 1 and 10,000 data values.');
                }
                const data = values.map((value, index) => requireNumber({ value }, 'value'));
                const sorted = [...data].sort((a, b) => a - b);
                const statistic = args.statistic || 'mean';
                const mean = data.reduce((sum, value) => sum + value, 0) / data.length;
                if (statistic === 'summary') {
                    if (!Array.isArray(args.statistics) || args.statistics.length < 2) {
                        throw new Error('A summary requires at least two requested statistics.');
                    }
                    result = Object.fromEntries(args.statistics.map(item => [
                        item,
                        calculate({ operation: 'statistics', arguments: { statistic: item, values: data, sample: args.sample } }).result
                    ]));
                } else if (statistic === 'mean') result = normalize(mean);
                else if (statistic === 'median') result = normalize(data.length % 2
                    ? sorted[(data.length - 1) / 2]
                    : (sorted[data.length / 2 - 1] + sorted[data.length / 2]) / 2);
                else if (statistic === 'range') result = normalize(sorted[sorted.length - 1] - sorted[0]);
                else if (statistic === 'mode') {
                    const counts = new Map();
                    data.forEach(value => counts.set(value, (counts.get(value) || 0) + 1));
                    const maximum = Math.max(...counts.values());
                    result = maximum === 1 ? [] : [...counts].filter(([, count]) => count === maximum).map(([value]) => value);
                } else if (statistic === 'variance' || statistic === 'standard_deviation') {
                    const sample = Boolean(args.sample);
                    if (sample && data.length < 2) throw new Error('Sample variance requires at least two data values.');
                    const divisor = sample ? data.length - 1 : data.length;
                    const variance = data.reduce((sum, value) => sum + (value - mean) ** 2, 0) / divisor;
                    result = normalize(statistic === 'variance' ? variance : Math.sqrt(variance));
                } else {
                    throw new Error('Statistic must be mean, median, mode, range, variance, or standard_deviation.');
                }
                formula = `${statistic} of ${data.join(', ')} = ${Array.isArray(result) ? result.join(', ') || 'no mode' : result}`;
                break;
            }
            case 'pattern': {
                result = analyzePattern(args.values, args);
                formula = `${result.patternType}: ${result.rule}${result.nextTerm === undefined ? '' : ` Next term = ${result.nextTerm}`}`;
                break;
            }
            case 'sequence': {
                const sequenceType = args.sequenceType;
                const firstTerm = requireNumber(args, 'firstTerm');
                const termNumber = requireInteger(args, 'termNumber', 1);
                if (sequenceType === 'arithmetic_term') {
                    const difference = requireNumber(args, 'commonDifference');
                    result = normalize(firstTerm + (termNumber - 1) * difference);
                    formula = `a_${termNumber} = ${firstTerm} + (${termNumber} - 1)(${difference})`;
                } else if (sequenceType === 'arithmetic_sum') {
                    const difference = requireNumber(args, 'commonDifference');
                    result = normalize(termNumber / 2 * (2 * firstTerm + (termNumber - 1) * difference));
                    formula = `S_${termNumber} = ${termNumber}/2 (2(${firstTerm}) + (${termNumber} - 1)(${difference}))`;
                } else if (sequenceType === 'geometric_term') {
                    const ratio = requireNumber(args, 'commonRatio');
                    result = normalize(firstTerm * Math.pow(ratio, termNumber - 1));
                    formula = `a_${termNumber} = ${firstTerm}(${ratio})^(${termNumber} - 1)`;
                } else if (sequenceType === 'geometric_sum') {
                    const ratio = requireNumber(args, 'commonRatio');
                    result = normalize(ratio === 1
                        ? firstTerm * termNumber
                        : firstTerm * (Math.pow(ratio, termNumber) - 1) / (ratio - 1));
                    formula = `Geometric sum of ${termNumber} terms with first term ${firstTerm} and ratio ${ratio}`;
                } else {
                    throw new Error('Sequence type must be arithmetic_term, arithmetic_sum, geometric_term, or geometric_sum.');
                }
                break;
            }
            case 'earnings': {
                const kind = args.kind;
                if (kind === 'annual_salary') {
                    const annualSalary = requireNumber(args, 'annualSalary');
                    if (annualSalary < 0) throw new Error('Annual salary cannot be negative.');
                    const period = args.period;
                    const periodsPerYear = period === 'monthly' ? 12 : period === 'weekly' ? 52 : 0;
                    if (!periodsPerYear) throw new Error('Salary period must be monthly or weekly.');
                    const periodEarnings = normalize(annualSalary / periodsPerYear);
                    result = { kind, annualSalary, period, periodEarnings, amount: periodEarnings };
                    formula = `${annualSalary} / ${periodsPerYear} = ${periodEarnings} per ${period.replace('ly', '')}`;
                    break;
                }

                const optionalNumber = key => args[key] === undefined ? 0 : requireNumber(args, key);
                const hourlyRate = optionalNumber('hourlyRate');
                const regularHours = optionalNumber('regularHours');
                const overtimeHours = optionalNumber('overtimeHours');
                const overtimeMultiplier = optionalNumber('overtimeMultiplier');
                const overtimePayAmount = optionalNumber('overtimePayAmount');
                const sales = optionalNumber('sales');
                const commissionRatePercent = optionalNumber('commissionRatePercent');
                const units = optionalNumber('units');
                const pieceRate = optionalNumber('pieceRate');
                const basePay = optionalNumber('basePay');
                const allowances = args.allowances || [];
                const benefits = args.benefits || [];
                const deductions = args.deductions || [];
                const taxAmounts = args.taxAmounts || [];
                if (!Array.isArray(allowances) || !Array.isArray(benefits) || !Array.isArray(deductions) || !Array.isArray(taxAmounts)) {
                    throw new Error('Allowances, benefits, taxes, and deductions must be lists of amounts.');
                }
                const allowanceTotal = allowances.reduce((total, value) => total + requireNumber({ value }, 'value'), 0);
                const benefitTotal = benefits.reduce((total, value) => total + requireNumber({ value }, 'value'), 0);
                const fixedDeductions = deductions.reduce((total, value) => total + requireNumber({ value }, 'value'), 0);
                const fixedTax = taxAmounts.reduce((total, value) => total + requireNumber({ value }, 'value'), 0);
                if (args.requiresTaxDetails) throw new Error('Tax cannot be computed without the applicable tax amount, rate and base, or supplied table.');
                if ([hourlyRate, regularHours, overtimeHours, overtimeMultiplier, overtimePayAmount, sales, commissionRatePercent, units, pieceRate, basePay, allowanceTotal, benefitTotal, fixedDeductions, fixedTax].some(value => value < 0)) {
                    throw new Error('Earnings, hours, rates, benefits, allowances, taxes, and deductions cannot be negative.');
                }
                if (kind === 'hourly_wage' && (hourlyRate === 0 || regularHours === 0)) throw new Error('Hourly wage requires a positive hourly rate and hours worked.');
                if (kind === 'overtime' && (hourlyRate === 0 || regularHours === 0 || overtimeHours === 0 || overtimeMultiplier === 0)) throw new Error('Overtime pay requires the hourly rate, regular hours, overtime hours, and stated overtime multiplier.');
                if (kind === 'commission' && (sales === 0 || commissionRatePercent === 0)) throw new Error('Commission requires sales and a commission rate.');
                if (kind === 'piecework' && (units === 0 || pieceRate === 0)) throw new Error('Piecework pay requires the number of units and pay per unit.');
                if (kind === 'allowance' && basePay === 0) throw new Error('Allowance earnings require the stated base pay.');
                if (kind === 'combined' && ![hourlyRate * regularHours, hourlyRate * overtimeHours, sales * commissionRatePercent / 100, units * pieceRate, basePay, allowanceTotal].some(value => value > 0)) {
                    throw new Error('Combined earnings require at least one stated earning component.');
                }
                const regularPay = normalize(hourlyRate * regularHours);
                const overtimePay = normalize(hourlyRate * overtimeHours * overtimeMultiplier + overtimePayAmount);
                const commission = normalize(sales * commissionRatePercent / 100);
                const pieceworkPay = normalize(units * pieceRate);
                const grossEarnings = normalize(basePay + regularPay + overtimePay + commission + pieceworkPay + allowanceTotal + benefitTotal);
                const deductionPercent = args.deductionPercent === undefined ? 0 : requireNumber(args, 'deductionPercent');
                if (deductionPercent < 0 || deductionPercent > 100) throw new Error('Deduction percentage must be between 0 and 100.');
                const percentageDeduction = normalize(grossEarnings * deductionPercent / 100);
                const taxRatePercent = args.taxRatePercent === undefined ? 0 : requireNumber(args, 'taxRatePercent');
                if (taxRatePercent < 0 || taxRatePercent > 100) throw new Error('Tax rate must be between 0 and 100 percent.');
                let calculatedTax = 0;
                const taxBrackets = args.taxBrackets || [];
                if (!Array.isArray(taxBrackets)) throw new Error('Supplied tax brackets must be a list.');
                if (taxRatePercent > 0 || taxBrackets.length > 0) {
                    const taxBase = args.taxBase;
                    const taxableAmount = taxBase === 'gross'
                        ? grossEarnings
                        : taxBase === 'taxable_income'
                            ? requireNumber(args, 'taxableIncome')
                            : null;
                    if (taxableAmount === null) throw new Error('A supplied tax rate also requires its stated taxable base.');
                    if (taxableAmount < 0) throw new Error('Taxable income cannot be negative.');
                    if (taxBrackets.length) {
                        let lowerBound = 0;
                        for (const bracket of taxBrackets) {
                            const bracketRate = requireNumber(bracket, 'ratePercent');
                            if (bracketRate < 0 || bracketRate > 100) throw new Error('Tax bracket rates must be between 0 and 100 percent.');
                            const upperBound = bracket.upTo === null ? taxableAmount : requireNumber(bracket, 'upTo');
                            if (upperBound < lowerBound) throw new Error('Tax bracket thresholds must be in increasing order.');
                            const taxableInBracket = Math.max(0, Math.min(taxableAmount, upperBound) - lowerBound);
                            calculatedTax += taxableInBracket * bracketRate / 100;
                            lowerBound = upperBound;
                            if (bracket.upTo === null || lowerBound >= taxableAmount) break;
                        }
                        if (lowerBound < taxableAmount) throw new Error('The supplied tax table does not cover all taxable income.');
                        calculatedTax = normalize(calculatedTax);
                    } else {
                        calculatedTax = normalize(taxableAmount * taxRatePercent / 100);
                    }
                }
                const totalTax = normalize(fixedTax + calculatedTax);
                const totalDeductions = normalize(fixedDeductions + percentageDeduction + totalTax);
                const netEarnings = normalize(grossEarnings - totalDeductions);
                result = {
                    kind,
                    hourlyRate: hourlyRate || undefined,
                    regularHours: regularHours || undefined,
                    regularPay: regularPay || undefined,
                    overtimeHours: overtimeHours || undefined,
                    overtimePay: overtimePay || undefined,
                    statedOvertimePay: overtimePayAmount || undefined,
                    overtimeMultiplier: overtimeMultiplier || undefined,
                    sales: sales || undefined,
                    commission,
                    units: units || undefined,
                    pieceRate: pieceRate || undefined,
                    pieceworkPay: pieceworkPay || undefined,
                    basePay: basePay || undefined,
                    allowances: allowanceTotal || undefined,
                    benefits: benefitTotal || undefined,
                    grossEarnings,
                    grossIncome: grossEarnings,
                    fixedDeductions: fixedDeductions || undefined,
                    deductionPercent: deductionPercent || undefined,
                    percentageDeduction: percentageDeduction || undefined,
                    taxRatePercent: taxRatePercent || undefined,
                    calculatedTax: calculatedTax || undefined,
                    fixedTax: fixedTax || undefined,
                    totalTax: totalTax || undefined,
                    totalDeductions: totalDeductions || undefined,
                    netEarnings,
                    netIncome: netEarnings,
                    amount: args.measure === 'net' ? netEarnings : grossEarnings
                };
                formula = `Gross income = base salary or wages + overtime + benefits + allowances + commission + piecework = ${grossEarnings}; deductions = tax ${totalTax} + other deductions ${normalize(fixedDeductions + percentageDeduction)} = ${totalDeductions}; net income = gross income - deductions = ${netEarnings}`;
                break;
            }
            case 'compound_interest': {
                const principal = requireNumber(args, 'principal');
                const ratePercent = requireNumber(args, 'ratePercent');
                const years = requireNumber(args, 'years');
                const periods = requireInteger(args, 'compoundsPerYear', 1);
                if (principal < 0 || years < 0) throw new Error('Principal and years cannot be negative.');
                if (ratePercent <= -100 * periods) throw new Error('The interest rate makes the compounding factor invalid.');
                const amount = normalize(principal * Math.pow(1 + ratePercent / 100 / periods, periods * years));
                result = { amount, interest: normalize(amount - principal) };
                formula = `A = ${principal}(1 + (${ratePercent}/100)/${periods})^(${periods} x ${years})`;
                break;
            }
            case 'repeated_percentage': {
                const initialValue = requireNumber(args, 'initialValue');
                const ratePercent = requireNumber(args, 'ratePercent');
                const periods = requireInteger(args, 'periods', 0);
                const direction = requireNumber(args, 'direction');
                if (initialValue < 0 || ratePercent < 0 || ![-1, 1].includes(direction)) {
                    throw new Error('Repeated percentage change requires a nonnegative initial value and rate, and a direction of -1 or 1.');
                }
                const multiplier = 1 + direction * ratePercent / 100;
                if (multiplier < 0) throw new Error('A repeated decrease cannot exceed 100% per period.');
                result = normalize(initialValue * Math.pow(multiplier, periods));
                formula = `Value = ${initialValue}(${multiplier})^${periods}`;
                break;
            }
            case 'interest_comparison': {
                const principal = requireNumber(args, 'principal');
                const simpleRatePercent = requireNumber(args, 'simpleRatePercent');
                const simpleYears = requireNumber(args, 'simpleYears');
                const compoundRatePercent = requireNumber(args, 'compoundRatePercent');
                const compoundYears = requireNumber(args, 'compoundYears');
                const periods = requireInteger(args, 'compoundsPerYear', 1);
                if (principal < 0 || simpleYears < 0 || compoundYears < 0) {
                    throw new Error('Principal and time cannot be negative.');
                }
                if (compoundRatePercent <= -100 * periods) {
                    throw new Error('The compound interest rate makes the growth factor invalid.');
                }
                const simpleAmount = normalize(principal * (1 + simpleRatePercent / 100 * simpleYears));
                const compoundAmount = normalize(principal * Math.pow(1 + compoundRatePercent / 100 / periods, periods * compoundYears));
                const difference = normalize(Math.abs(compoundAmount - simpleAmount));
                result = {
                    simpleAmount,
                    compoundAmount,
                    greater: simpleAmount > compoundAmount ? 'simple interest' : compoundAmount > simpleAmount ? 'compound interest' : 'equal',
                    difference
                };
                formula = `Simple amount = ${principal}(1 + (${simpleRatePercent}/100)(${simpleYears})); compound amount = ${principal}(1 + (${compoundRatePercent}/100)/${periods})^(${periods} x ${compoundYears})`;
                break;
            }
            case 'probability': {
                const probabilityType = args.probabilityType || 'classical';
                if (probabilityType === 'classical') {
                    const favorable = requireNumber(args, 'favorableOutcomes');
                    const total = requireNumber(args, 'totalOutcomes');
                    if (total <= 0 || favorable < 0 || favorable > total) throw new Error('Require 0 <= favorable outcomes <= total outcomes, with a positive total.');
                    result = normalize(favorable / total);
                    formula = `P = ${favorable}/${total} = ${result}`;
                } else if (probabilityType === 'complement') {
                    const probability = checkedProbability(requireNumber(args, 'probabilityA'), 'Probability');
                    result = normalize(1 - probability);
                    formula = `P(not A) = 1 - ${probability} = ${result}`;
                } else if (probabilityType === 'independent') {
                    const first = checkedProbability(requireNumber(args, 'probabilityA'), 'P(A)');
                    const second = checkedProbability(requireNumber(args, 'probabilityB'), 'P(B)');
                    result = normalize(first * second);
                    formula = `P(A and B) = ${first} x ${second} = ${result}`;
                } else if (probabilityType === 'conditional') {
                    const intersection = checkedProbability(requireNumber(args, 'intersectionProbability'), 'P(A and B)');
                    const given = checkedProbability(requireNumber(args, 'probabilityB'), 'P(B)');
                    if (given === 0) throw new Error('Conditional probability is undefined when P(B) is zero.');
                    result = normalize(intersection / given);
                    if (result > 1) throw new Error('The supplied probabilities are inconsistent.');
                    formula = `P(A | B) = P(A and B)/P(B) = ${intersection}/${given} = ${result}`;
                } else if (probabilityType === 'union') {
                    const first = checkedProbability(requireNumber(args, 'probabilityA'), 'P(A)');
                    const second = checkedProbability(requireNumber(args, 'probabilityB'), 'P(B)');
                    const intersection = checkedProbability(requireNumber(args, 'intersectionProbability'), 'P(A and B)');
                    result = normalize(first + second - intersection);
                    if (result < 0 || result > 1) throw new Error('The supplied probabilities are inconsistent.');
                    formula = `P(A or B) = ${first} + ${second} - ${intersection} = ${result}`;
                } else {
                    throw new Error('Probability type must be classical, complement, independent, conditional, or union.');
                }
                break;
            }
            default:
                throw new Error(`Unsupported calculator operation: ${operation}`);
        }

        return { operation, result, formula };
    }

    function verifyAnswer(question, answerText) {
        const checks = [];

        const equationCheck = verifyEquationSubstitution(question, answerText);
        const functionCheck = verifyFunctionEvaluation(question, answerText);
        const decisionCheck = verifyDecision(question, answerText);
        const hypothesisCheck = verifyHypothesisDecision(question, answerText);

        if (equationCheck) checks.push(equationCheck);
        if (functionCheck) checks.push(functionCheck);
        if (decisionCheck) checks.push(decisionCheck);
        if (hypothesisCheck) checks.push(hypothesisCheck);

        const passed = checks.length ? checks.every(check => check.passed) : false;

        return {
            needed: checks.length > 0,
            passed,
            checks,
            summary: checks.length
                ? `Verified by JavaScript: ${checks.map(check => `${check.kind} ${check.passed ? 'matches' : 'mismatches'} the deterministic calculation`).join('; ')}`
                : 'No practical numeric verification was available for this prompt.'
        };
    }

    function verifyHypothesisDecision(question, answerText) {
        const decision = detectDecision(question);
        if (decision.operation !== 'hypothesis_test') return null;
        const expected = calculate(decision).result.decision;
        const text = String(answerText || '').toLowerCase().replace(/₀/g, '0');
        const saysReject = /\breject\b/.test(text) && !/\bfail to reject\b|\bdo not reject\b/.test(text);
        const passed = expected === 'reject H0' ? saysReject : /\bfail to reject\b|\bdo not reject\b/.test(text);
        return { kind: 'hypothesis_test', passed, expected, actual: saysReject ? 'reject H0' : /\bfail to reject\b/.test(text) ? 'fail to reject H0' : 'no decision stated' };
    }

    window.Grade11MathCalculator = Object.freeze({
        operations: Object.freeze([...operations]),
        decisionFormat,
        detectDecision,
        classifyQuestion,
        calculate,
        verifyAnswer,
        verifyHypothesisDecision
    });
})();
