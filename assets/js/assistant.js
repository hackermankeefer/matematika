(() => {
    if (document.querySelector('.assistant-launcher')) return;

    const provider = window.MATHEMATICS_AI_PROVIDER
        || (window.MATHEMATICS_AI_ENDPOINT ? 'ollama' : 'gemini');
    const endpoint = window.MATHEMATICS_AI_ENDPOINT
        || (provider === 'gemini' ? '/api/assistant' : 'http://127.0.0.1:11434/api/chat');
    const model = window.MATHEMATICS_AI_MODEL
        || (provider === 'gemini' ? 'gemini-3.5-flash-lite' : 'qwen3:4b');
    const mathResponseFormat = {
        type: 'object',
        properties: {
            topic: { type: 'string' },
            given: { type: 'string' },
            find: { type: 'string' },
            method: { type: 'string' },
            working: { type: 'array', items: { type: 'string' } },
            check: { type: 'string' },
            answer: { type: 'string' }
        },
        required: ['topic', 'given', 'find', 'method', 'working', 'check', 'answer'],
        additionalProperties: false
    };
    const curriculumScopePrompt = [
        'You are a specialized Grade 11 General Mathematics educational AI following the Philippine K-12 curriculum.',
        'Your curriculum covers three terms: Term 1 (Business Mathematics; measurement and unit conversion; surface area and volume; scale; currency, time, and temperature conversion; patterns; Fibonacci, arithmetic and geometric sequences and series; financial applications; functions and graphs); Term 2 (piecewise functions; statistics including central tendency, variability, sampling, normal distributions and z-scores, and hypothesis testing; right-triangle trigonometry, Heron\'s formula, triangle area using sine, bearings, and elevation/depression); Term 3 (compound interest, annuities, loans, amortization, scatter plots, line of best fit, Pearson correlation, and logic including propositions, truth tables, tautologies, and contradictions).',
        'Treat the knowledge base as the curriculum boundary. Basic arithmetic, algebraic manipulation, fractions, equations, exponents, and prerequisite mathematics may be used when necessary. Do not present advanced mathematics outside this scope such as calculus, differential equations, linear algebra, abstract algebra, or advanced analysis unless a small prerequisite concept is genuinely necessary to explain a Grade 11 topic.',
        'When explaining piecewise functions, include a brief example rule using a KaTeX cases expression when it is relevant.',
        'If a student asks about something outside the curriculum, clearly state that it is outside the current Grade 11 General Mathematics coverage and redirect toward relevant Grade 11 topics.',
        'Always follow this internal reasoning structure: identify the curriculum topic, determine what the student is being asked to find, identify the given information, select the relevant formula or method, perform calculations accurately using proper order of operations, verify the result by checking against the original problem or using an alternative method, and explain it at a Grade 11 level.',
        'Error prevention rules: Use parentheses properly in all calculations. Follow correct order of operations (PEMDAS/BODMAS). Do not divide by zero. Check whether denominators could be zero before division. Use the correct formula for the identified problem type. Distinguish between similar concepts (e.g., markup vs profit, discount vs VAT, arithmetic vs geometric sequences). For percentage problems, identify the base amount correctly (cost price for markup and profit/loss, original price for discounts, price before VAT for VAT). Express final percentage values with the percent symbol. For sequences, distinguish between finding one term versus finding a sum of terms. For functions, state domain restrictions when denominators or roots are involved. For statistics, distinguish between population and sample statistics.',
        'Calculation policy: Use deterministic arithmetic for all numerical calculations. For business math, earnings, sequences, series, basic statistics, geometry, and trigonometry problems with specific numeric values, perform exact arithmetic and present the numeric result. For approximate values like pi, use the value specified in the problem or pi = 3.14159 if unspecified. Round final answers appropriately for the context (usually 2-4 decimal places unless otherwise specified). Show the substitution step before calculating. Never write “approximately equals” followed by an exact symbolic expression.',
        'Tutoring modes: If the user asks for only an answer, be concise with at most 2-3 brief calculation steps. If they ask for an explanation, start with the answer then give a clear step-by-step explanation. If they ask why, explain the underlying mathematical idea behind the method. If they ask for a hint, give one useful next step or guiding question without revealing the complete solution. If they ask to check work, compare the learner’s work with the correct procedure in order and identify the first meaningful error.',
        'Writing style: Write like a clear, patient Grade 11 tutor. Start with the direct answer, then explain only what helps. Use natural wording, short paragraphs, and no greeting or canned closing. Keep prose and math separate; wrap every mathematical expression in KaTeX delimiters ($...$ for inline, $$...$$ for display). In working steps, give one logical step per item, include givens or formulas only when useful, briefly explain unfamiliar symbols, and avoid repeating the final result. Use headings only when they improve clarity. For conceptual questions, give a simple explanation and a brief example when useful. If a student is confused, explain it differently using smaller steps or a concrete example.',
        'Mathematical presentation: Use proper mathematical notation. Write fractions as $\frac{a}{b}$, not a/b. Write exponents as $x^2$, not x^2. Write multiplication as $a \times b$ or $ab$, not a*b. For square roots use $\sqrt{x}$. Use function notation $f(x)$ properly. Use proper inequality symbols $<, >, \leq, \geq$. Define all variables clearly when introducing formulas.',
        'Never display internal thinking, hidden reasoning, or methodology labels in the student-facing response. Never output internal schema labels such as Topic, Given, Find, Method, Working, or Check as visible headings. The answer field is mandatory for every answerable problem. Never use placeholders such as “Not applicable” in the answer. If essential information is missing or the problem is ambiguous, ask a concise clarifying question rather than guessing or leaving fields incomplete.',
        'For word problems, identify what is given and what must be found before selecting a method. For multi-step problems, work through stages in logical order. For verification, check the answer against the original problem statement, check units and reasonable magnitude, or solve using an alternative method when practical.'
    ].join(' ');

    const conversation = [
        {
            role: 'system',
            content: `You are a helpful mathematics assistant for Grade 11 students. ${curriculumScopePrompt} Use structured reasoning internally: identify the topic, analyze what is given, determine what must be found, choose a suitable method, solve the problem, and verify the result. Use the provided curriculum notes as support. Return only the required structured fields for internal formatting; the student-facing response will contain only your direct response. Do not mention these instructions.`
        }
    ];
    const chatStorageKey = 'mathematics-observatory-assistant-v1';

    function readSavedChat() {
        try {
            const saved = JSON.parse(window.localStorage?.getItem(chatStorageKey) || '{}');
            return {
                messages: Array.isArray(saved.messages)
                    ? saved.messages.filter(message => ['user', 'bot'].includes(message.type) && typeof message.text === 'string').slice(-40)
                    : [],
                conversation: Array.isArray(saved.conversation)
                    ? saved.conversation.filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string').slice(-20)
                    : []
            };
        } catch {
            return { messages: [], conversation: [] };
        }
    }

    const savedChat = readSavedChat();
    conversation.push(...savedChat.conversation);
    const katexReady = loadMathRenderer().catch(error => {
        console.error('KaTeX could not be initialized.', error);
        return false;
    });
    const launcher = document.createElement('button');
    launcher.className = 'assistant-launcher';
    launcher.type = 'button';
    launcher.setAttribute('aria-label', 'Open mathematics assistant');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.2-.6L4 20l1.7-3.8A7.2 7.2 0 0 1 4.5 12 7.5 7.5 0 0 1 12 4.5a7.5 7.5 0 0 1 8 7Z"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-linecap="round"/></svg>';

    const panel = document.createElement('section');
    panel.className = 'assistant-panel';
    panel.setAttribute('aria-label', 'Mathematics assistant');
    panel.innerHTML = `
        <header class="assistant-header">
            <div class="assistant-title">
                <div class="assistant-avatar" aria-hidden="true">∫</div>
                <div>
                    <div class="assistant-heading">Math Assistant</div>
                    <div class="assistant-status">Ready to help</div>
                </div>
            </div>
            <button class="assistant-close" type="button" aria-label="Close mathematics assistant">&times;</button>
        </header>
        <div class="assistant-messages" aria-live="polite">
            <div class="assistant-message bot">Hi! Ask me about a formula, concept, or problem you are exploring.</div>
        </div>
        <form class="assistant-form">
            <input class="assistant-input" type="text" placeholder="Ask a math question..." autocomplete="off" aria-label="Ask a math question">
            <button class="assistant-send" type="submit" aria-label="Send question">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
        </form>
    `;

    document.body.append(launcher, panel);

    const closeButton = panel.querySelector('.assistant-close');
    const form = panel.querySelector('.assistant-form');
    const input = panel.querySelector('.assistant-input');
    const messages = panel.querySelector('.assistant-messages');
    const rawMessageText = new WeakMap();

    function loadMathRenderer() {
        const loadStylesheet = href => new Promise((resolve, reject) => {
            const stylesheet = document.createElement('link');
            stylesheet.rel = 'stylesheet';
            stylesheet.href = href;
            stylesheet.onload = resolve;
            stylesheet.onerror = () => reject(new Error(`KaTeX stylesheet failed to load: ${href}`));
            document.head.appendChild(stylesheet);
        });
        const loadScript = source => new Promise((resolve, reject) => {
            const katexScript = document.createElement('script');
            katexScript.src = source;
            katexScript.onload = resolve;
            katexScript.onerror = () => reject(new Error(`KaTeX script failed to load: ${source}`));
            document.head.appendChild(katexScript);
        });

        const asset = relativePath => new URL(relativePath, document.baseURI).href;
        const katexCdn = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/';
        const loadWithFallback = (load, localSource, fallbackSource) => load(localSource).catch(() => load(fallbackSource));
        const markdownScripts = [
            'https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js',
            'https://cdn.jsdelivr.net/npm/dompurify@3.2.6/dist/purify.min.js'
        ];

        return Promise.all([
            loadWithFallback(loadStylesheet, asset('node_modules/katex/dist/katex.min.css'), `${katexCdn}katex.min.css`),
            loadWithFallback(loadScript, asset('node_modules/katex/dist/katex.min.js'), `${katexCdn}katex.min.js`)
        ]).then(() => loadWithFallback(
            loadScript,
            asset('node_modules/katex/dist/contrib/auto-render.min.js'),
            `${katexCdn}contrib/auto-render.min.js`
        ))
            .then(async () => {
                for (const source of markdownScripts) {
                    try {
                        await loadScript(source);
                    } catch {
                        return true;
                    }
                }
                return true;
            });
    }

    async function renderMath(element) {
        const rendererReady = await katexReady;
        if (!rendererReady || typeof window.renderMathInElement !== 'function') {
            throw new Error('KaTeX auto-render is unavailable.');
        }

        window.renderMathInElement(element, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '\\[', right: '\\]', display: true },
                { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false }
            ],
            throwOnError: false,
            strict: 'ignore'
        });
    }

    async function renderMessage(element, text) {
        rawMessageText.set(element, text);
        await katexReady;
        const normalizedText = text.replace(/\\\$/g, '$');

        if (window.marked && window.DOMPurify) {
            const mathSegments = [];
            const markdownText = normalizedText.replace(/(\$\$[\s\S]*?\$\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|(?<!\\)\$(?!\$)[^\n$]+?\$)/g, math => {
                const inlineMath = math.startsWith('$') && !math.startsWith('$$');
                const content = inlineMath ? math.slice(1, -1) : '';
                const contentWithoutCommands = content.replace(/\\[A-Za-z]+/g, '');
                const proseInsideMath = inlineMath
                    && /\b[A-Za-z]{4,}\b/.test(contentWithoutCommands)
                    && !/\\(?:text|mathrm|operatorname)\s*\{/.test(content);
                const placeholder = `MATHSEGMENT${mathSegments.length}TOKEN`;
                if (proseInsideMath) {
                    mathSegments.push(math);
                    return placeholder;
                }

                mathSegments.push(math);
                return placeholder;
            });

            element.innerHTML = window.DOMPurify.sanitize(window.marked.parse(markdownText, {
                breaks: true,
                gfm: true
            }));
            restoreMathSegments(element, mathSegments);
        } else {
            element.textContent = normalizedText;
        }

        await renderMath(element);
    }

    function restoreMathSegments(element, segments) {
        if (!segments.length) return;

        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const placeholderPattern = /MATHSEGMENT(\d+)TOKEN/g;
            let match;
            let lastIndex = 0;
            const fragment = document.createDocumentFragment();

            while ((match = placeholderPattern.exec(node.textContent))) {
                fragment.appendChild(document.createTextNode(node.textContent.slice(lastIndex, match.index)));
                fragment.appendChild(document.createTextNode(segments[Number(match[1])]));
                lastIndex = match.index + match[0].length;
            }

            if (lastIndex === 0) return;
            fragment.appendChild(document.createTextNode(node.textContent.slice(lastIndex)));
            node.parentNode.replaceChild(fragment, node);
        });
    }

    function setOpen(isOpen) {
        panel.classList.toggle('is-open', isOpen);
        launcher.setAttribute('aria-expanded', String(isOpen));
        if (isOpen) input.focus();
    }

    function addMessage(text, type) {
        const message = document.createElement('div');
        message.className = `assistant-message ${type}`;
        message.textContent = text;
        rawMessageText.set(message, text);
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
        return message;
    }

    function saveChatState() {
        try {
            const savedMessages = Array.from(messages.children)
                .slice(1)
                .map(message => ({
                    type: message.className.split(/\s+/).includes('user') ? 'user' : 'bot',
                    text: rawMessageText.get(message) ?? message.textContent
                }))
                .filter(message => message.text && message.text !== 'Thinking...')
                .slice(-40);
            const savedConversation = conversation.slice(1)
                .filter(message => ['user', 'assistant'].includes(message.role) && typeof message.content === 'string')
                .slice(-20);
            window.localStorage?.setItem(chatStorageKey, JSON.stringify({
                messages: savedMessages,
                conversation: savedConversation
            }));
        } catch {
            return;
        }
    }

    const restoredMessages = Promise.all(savedChat.messages.map(async savedMessage => {
        const message = addMessage(savedMessage.text, savedMessage.type);
        if (savedMessage.type === 'bot') {
            try {
                await renderMessage(message, savedMessage.text);
            } catch {
                message.textContent = savedMessage.text;
            }
        }
    }));

    function fallbackReply(question) {
        const normalizedQuestion = question.toLowerCase();
        if (normalizedQuestion.includes('pythag')) {
            return 'For a right triangle, $a^2 + b^2 = c^2$. The legs are $a$ and $b$; $c$ is the hypotenuse, opposite the right angle.';
        }
        if (normalizedQuestion.includes('quadratic')) {
            return 'The quadratic formula is:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nIt applies to equations in the form $ax^2 + bx + c = 0$.';
        }
        if (normalizedQuestion.includes('help') || normalizedQuestion.includes('what can')) {
            return 'I can explain Grade 11 topics, unpack formulas step by step, or help you check your reasoning. Try asking about functions, trigonometry, or probability.';
        }
        return 'I can help unpack that. Try including the formula, values, or the exact step that feels unclear.';
    }

    function calculateBasicArithmetic(question) {
        const match = question.match(/^(?:what is |calculate |compute )?(-?(?:\d+(?:\.\d+)?|\.\d+))\s*([+\-*/×÷])\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\??$/i);
        if (!match) return null;

        const left = Number(match[1]);
        const right = Number(match[3]);
        const operator = match[2];
        let result;

        switch (operator) {
            case '+': result = left + right; break;
            case '-': result = left - right; break;
            case '*':
            case '×': result = left * right; break;
            case '/':
            case '÷':
                if (right === 0) return null;
                result = left / right;
                break;
            default: return null;
        }

        const normalizedResult = Number(result.toPrecision(10)).toString();
        const normalizedOperator = operator === '*' ? '\\times' : operator === '/' ? '\\div' : operator;
        return `$${match[1]} ${normalizedOperator} ${match[3]} = ${normalizedResult}$`;
    }

    function answerKnownFormula(question) {
        const normalizedQuestion = question.toLowerCase();
        const requestedFormulas = [];

        if (normalizedQuestion.includes('pythagorean') || normalizedQuestion.includes('pythagoras')) {
            requestedFormulas.push('The Pythagorean theorem for a right triangle is $a^2 + b^2 = c^2$, where $c$ is the hypotenuse.');
        }
        if (normalizedQuestion.includes('slope')) {
            requestedFormulas.push('The slope between $(x_1, y_1)$ and $(x_2, y_2)$ is:\n\n$$m = \\frac{y_2 - y_1}{x_2 - x_1}$$\n\nA vertical line has undefined slope.');
        }
        if (normalizedQuestion.includes('conditional probability')) {
            requestedFormulas.push('Conditional probability is the chance of $A$ given that $B$ occurred:\n\n$$P(A \\mid B) = \\frac{P(A \\cap B)}{P(B)}, \\quad P(B) > 0.$$\n\nIf $A$ and $B$ are independent, $P(A \\mid B) = P(A)$.');
        }
        if (requestedFormulas.length) return requestedFormulas.join('\n\n');

        if (!normalizedQuestion.includes('quadratic') || !normalizedQuestion.includes('formula')) return null;

        return 'The quadratic formula solves $ax^2 + bx + c = 0$, where $a \\ne 0$:\n\n$$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$\n\nThe discriminant is $D = b^2 - 4ac$. If $D > 0$, there are two distinct real roots; if $D = 0$, one repeated real root; if $D < 0$, two complex roots.';
    }

    function getVisibleAnswer(text) {
        const closingThinkTag = '</think>';
        const lastThoughtEnd = text.lastIndexOf(closingThinkTag);
        const answer = lastThoughtEnd >= 0
            ? text.slice(lastThoughtEnd + closingThinkTag.length)
            : text.replace(/<think>[\s\S]*?<\/think>/gi, '');
        return answer.replace(/<\/?think>/gi, '').trim();
    }

    function getTutoringRequestMode(question) {
        const normalizedQuestion = question.toLowerCase();
        if (/\b(hint|nudge|clue)\b/.test(normalizedQuestion)) return 'hint';
        if (/\b(my work|my solution|my attempt|my answer|i tried|i got|i think|i calculated|i worked out|check|review my|is this correct|is this right|does this look right|did i do this right)\b/.test(normalizedQuestion) || /\bworking:/.test(normalizedQuestion)) return 'check-work';
        if (/^\s*why\b|\bexplain why\b/.test(normalizedQuestion)) return 'why';
        if (/\b(explain|step[- ]by[- ]step|show (?:me )?the steps)\b/.test(normalizedQuestion)) return 'explain';
        if (/\b(what(?:'s| is) the answer|just (?:give|tell) me the answer|answer only|final answer only)\b/.test(normalizedQuestion)) return 'answer';
        return 'standard';
    }

    function getTutoringModeInstruction(mode) {
        const instructions = {
            standard: 'Start with the direct answer. Then give a concise explanation with only the essential steps; use one logical step per working item and keep the final result easy to find. For a routine calculator-backed calculation, use no more than three working items, skip restating given values, and combine formula substitution and arithmetic when clear.',
            answer: 'Start with the concise answer, followed by at most two short calculation steps. Do not add a topic introduction, extra explanation, or redundant check.',
            explain: 'Start with the answer, then give a clear step-by-step explanation. Put one logical step in each working item and show how each follows from the previous one.',
            why: 'Explain the underlying mathematical idea that makes the result or method valid. Answer the why-question directly in simple language; include a short KaTeX example when it helps.',
            'check-work': 'Carefully check the learner’s shown work in order. Start by saying whether the work is correct. If it is not, identify the first meaningful error, explain why it is wrong, and continue with the corrected steps. Do not overlook or silently repair earlier errors.',
            hint: 'Give one useful next step or guiding question. Do not give the final answer or reveal the complete solution. Keep all response fields limited to the hint.'
        };
        return instructions[mode] || instructions.standard;
    }

    function wrapPlainPiecewiseFunction(text) {
        return text.replace(/([A-Za-z]\s*\(\s*[A-Za-z]\s*\)\s*=\s*)\{([^{}]+)\}/g, (whole, functionDefinition, branchText) => {
            const branches = branchText.split(/,\s*(?=[^,]+?\s+if\s+)/i).map(branch => {
                const match = branch.match(/^\s*(.+?)\s+if\s+(.+?)\s*$/i);
                if (!match) return null;

                const condition = match[2]
                    .replace(/>=/g, '\\ge ')
                    .replace(/<=/g, '\\le ')
                    .replace(/!=/g, '\\ne ')
                    .replace(/≥/g, '\\ge ')
                    .replace(/≤/g, '\\le ')
                    .replace(/≠/g, '\\ne ')
                    .replace(/\s+/g, ' ');
                return `${match[1].trim()}, & ${condition.trim()}`;
            });

            if (branches.length < 2 || branches.some(branch => !branch)) return whole;
            return `$${functionDefinition.trim()} \\begin{cases} ${branches.join(' \\\\ ')} \\end{cases}$`;
        });
    }

    function wrapPlainEquation(text) {
        if (/\$[^$]+\$|\\\(|\\\[/.test(text)) return text;

        const piecewiseText = wrapPlainPiecewiseFunction(text);
        if (piecewiseText !== text) return piecewiseText;

        const colonIndex = text.lastIndexOf(':');
        const prefix = colonIndex >= 0 ? `${text.slice(0, colonIndex + 1)} ` : '';
        const candidate = (colonIndex >= 0 ? text.slice(colonIndex + 1) : text).trim();
        const punctuation = candidate.match(/[.,;!?]+$/)?.[0] || '';
        const equation = candidate.slice(0, candidate.length - punctuation.length).trim();
        const mathToken = '[+-]?[A-Za-z0-9_π∞().{}]+';
        const equationPattern = new RegExp(`^${mathToken}(?:\\s*[+\\-*/×÷^=<>≤≥≠]\\s*${mathToken})*$`);

        if (!/[=<>≤≥≠]/.test(equation) || !equationPattern.test(equation)) return text;
        return `${prefix}$${equation}$${punctuation}`;
    }

    function ensurePiecewiseExample(question, response, mode) {
        if (mode === 'hint' || !/\bpiecewise\b/i.test(question) || response.includes('\\begin{cases}')) return response;

        const example = '$$f(x)=\\begin{cases} x+1, & x<0 \\\\ 2x-3, & x\\ge 0 \\end{cases}$$';
        return `${response}\n\nFor example:\n\n${example}`;
    }

    function formatWorkingSteps(steps) {
        const cleanSteps = steps
            .map(step => wrapPlainEquation(step.replace(/^\s*step\s+\d+\s*:\s*/i, '').trim()))
            .filter(Boolean);
        if (cleanSteps.length < 2) return cleanSteps.join('\n\n');
        return cleanSteps.map((step, index) => `**Step ${index + 1}:** ${step}`).join('\n\n');
    }

    function formatMathResponse(content, mode = 'standard') {
        let solution;
        try {
            solution = JSON.parse(content);
        } catch {
            return '';
        }

        const value = field => typeof solution[field] === 'string'
            ? getVisibleAnswer(solution[field]).replace(/^\s*[:=]\s*/, '')
            : '';
        const sections = [];
        const working = Array.isArray(solution.working)
            ? solution.working.map(step => getVisibleAnswer(String(step))).filter(Boolean)
            : [];
        const check = value('check');
        const rawAnswer = value('answer');
        const answerIsPlaceholder = !rawAnswer || /^(?:heat|not applicable|n\/?a|none|unknown|not provided|undefined|null)[.!]?$/i.test(rawAnswer);
        const answer = answerIsPlaceholder ? check || working.at(-1) || '' : rawAnswer;
        const formattedAnswer = wrapPlainEquation(answer);
        const answerBlock = formattedAnswer && /^\s*(?:\*\*)?(?:final\s+)?answer\s*:/i.test(formattedAnswer)
            ? formattedAnswer
            : formattedAnswer ? `**Answer:** ${formattedAnswer}` : '';
        const usefulWorking = working.filter(step => step !== answer && step !== check);

        if (mode === 'hint') {
            return formattedAnswer;
        }
        if (mode === 'answer') {
            const essentialCalculation = formatWorkingSteps(usefulWorking.slice(0, 2));
            return [answerBlock, essentialCalculation].filter(Boolean).join('\n\n');
        }
        if (mode === 'why') {
            return [answerBlock, formatWorkingSteps(usefulWorking), check]
                .filter((section, index, sections) => section && sections.indexOf(section) === index)
                .join('\n\n');
        }

        const usefulSteps = formatWorkingSteps(usefulWorking);
        if (mode === 'check-work') {
            return [answerBlock, usefulSteps, check].filter((section, index, sections) => section && sections.indexOf(section) === index).join('\n\n');
        }
        if (answerBlock) sections.push(answerBlock);
        if (usefulSteps) sections.push(usefulSteps);
        if (/extraneous|\binvalid\b|fails? (?:the )?(?:original equation|domain)|does not satisfy|only valid solution/i.test(check)) sections.push(check);

        return sections.join('\n\n');
    }

    function formatCalculatorResult(result) {
        if (result === null || result === undefined) return 'No numerical result available.';
        if (typeof result === 'number') return String(Number.isFinite(result) ? result : 'undefined');
        if (typeof result === 'string') return result;
        if (Array.isArray(result)) return result.join(', ');
        if (typeof result === 'object') {
            const parts = [];
            Object.entries(result).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    parts.push(`${key}: ${formatCalculatorResult(value)}`);
                }
            });
            return parts.join(', ');
        }
        return String(result);
    }

    function getCalculatorAnswer(calculatorTask) {
        const { decision, calculation } = calculatorTask;
        const result = calculation.result;
        if (decision.operation === 'function_evaluation') {
            const { functionName, input } = decision.arguments;
            return `$${functionName}(${input}) = ${result}$`;
        }
        if (decision.operation === 'cylinder_volume') {
            const { radius, height, pi, unit } = decision.arguments;
            const piDisplay = pi === Math.PI ? '\\pi' : String(pi);
            const unitDisplay = unit ? `\\,\\text{${unit}}^3` : '';
            return `Cylinder volume: $V = ${piDisplay}(${radius})^2(${height}) \\approx ${result}${unitDisplay}$.`;
        }
        if (decision.operation === 'trigonometry') {
            const args = decision.arguments;
            if (args.kind === 'angle') return `$\\theta \\approx ${result}${args.angleUnit === 'radians' ? '\\text{ rad}' : '^\\circ'}$`;
            if (args.kind === 'side') return `$${args.targetRole} \\approx ${result}${args.unit ? `\\,\\text{${args.unit}}` : ''}$`;
            return `$A \\approx ${result}${args.unit ? `\\,\\text{${args.unit}}^2` : ''}$`;
        }
        if (decision.operation === 'annuity') return `$${decision.arguments.kind === 'future_value' ? 'FV' : 'PV'} = ${result}${decision.arguments.currency || ''}$`;
        if (decision.operation === 'loan') return `$${decision.arguments.kind === 'payment' ? 'Payment' : 'Balance'} = ${result}${decision.arguments.currency || ''}$`;
        if (decision.operation === 'z_score') return `$z = ${result}$`;
        if (decision.operation === 'diameter_to_radius') return `$r = ${result}${decision.arguments.unit ? `\\,\\text{${decision.arguments.unit}}` : ''}$`;
        if (decision.operation === 'normal_probability') return `$P = ${result}$`;
        if (decision.operation === 'hypothesis_test') return result.decision === 'reject H0'
            ? `Reject $H_0$ because $p=${result.pValue} \\leq ${result.alpha}$. The result is statistically significant at this level.`
            : `Fail to reject $H_0$ because $p=${result.pValue} > ${result.alpha}$. The result is not statistically significant at this level.`;
        if (decision.operation === 'sequence') {
            const args = decision.arguments;
            if (args.sequenceType === 'arithmetic_term') {
                return `Arithmetic sequence term: a_${args.termNumber} = ${args.firstTerm} + (${args.termNumber} - 1)(${args.commonDifference}) = ${result}. First term = ${args.firstTerm}; common difference = ${args.commonDifference}.`;
            }
            if (args.sequenceType === 'arithmetic_sum') {
                return `Arithmetic series: the sum of the first ${args.termNumber} terms is ${result}.`;
            }
            if (args.sequenceType === 'geometric_term') {
                return `Geometric sequence term: first term = ${args.firstTerm}; common ratio = ${args.commonRatio}; a_${args.termNumber} = ${args.firstTerm}(${args.commonRatio})^(${args.termNumber} - 1) = ${result}.`;
            }
            if (args.sequenceType === 'geometric_sum') {
                return `Geometric series: the sum of the first ${args.termNumber} terms is ${result}.`;
            }
        }
        if (decision.operation === 'pattern') {
            const parts = [`Pattern: ${result.patternType}.`, `Rule: ${result.rule}`];
            if (result.commonDifference !== undefined) parts.push(`Common difference = ${result.commonDifference}.`);
            if (result.commonRatio !== undefined) parts.push(`Common ratio = ${result.commonRatio}.`);
            if (result.missingTerm !== undefined) parts.push(`Missing term = ${result.missingTerm}.`);
            if (decision.arguments.requestKind === 'next') parts.push(`Next term = ${result.nextTerm}.`);
            if (result.requestedTerm !== undefined) parts.push(`Term ${result.requestedTerm} = ${result.requestedValue}.`);
            parts.push('The rule was checked against the listed terms.');
            return parts.join(' ');
        }
        if (decision.operation === 'percentage_application') {
            if (result.kind === 'profit_loss') {
                return `${result.outcome}: absolute amount = ${result.absoluteAmount}; percentage of cost price = ${result.percentage}%. Cost price = ${result.costPrice}; selling price = ${result.sellingPrice}.`;
            }
            if (result.kind === 'price_chain') {
                const stages = result.stages.map(stage => `${stage.type === 'vat' ? 'VAT' : `${stage.type[0].toUpperCase()}${stage.type.slice(1)}`}: ${stage.startingAmount} -> ${stage.endingAmount} (${stage.ratePercent}%)`).join('; ');
                return `Starting cost price = ${result.baseAmount}; ${stages}; final price = ${result.finalPrice}.`;
            }
            if (result.kind === 'markup') {
                return `Cost price = ${result.costPrice}; markup amount = ${result.markupAmount}; selling price after markup = ${result.sellingPrice}.`;
            }
            if (result.kind === 'discount') {
                return `Original price = ${result.originalPrice}; discount amount = ${result.discountAmount}; price after discount = ${result.finalPrice}.`;
            }
            if (result.kind === 'vat') {
                return `Price before VAT = ${result.priceBeforeVat}; VAT amount = ${result.vatAmount}; price including VAT = ${result.priceIncludingVat}.`;
            }
            if (result.kind === 'inflation') {
                return `Starting price = ${result.baseAmount}; inflation-adjusted value after ${result.periods} period(s) = ${result.finalValue}; total increase = ${result.increaseAmount}.`;
            }
            return `${result.kind === 'increase' ? 'Increase' : 'Decrease'} amount = ${result.changeAmount}; starting value = ${result.baseAmount}; new value = ${result.finalValue}.`;
        }
        if (decision.operation === 'earnings') {
            const formatAmount = value => String(value);
            if (result.kind === 'annual_salary') {
                return `${result.period} earnings = ${formatAmount(result.annualSalary)} / ${result.period === 'weekly' ? 52 : 12} = ${formatAmount(result.amount)} per ${result.period === 'weekly' ? 'week' : 'month'}.`;
            }
            const components = [];
            if (result.basePay !== undefined) components.push(`base salary/pay = ${formatAmount(result.basePay)}`);
            if (result.regularPay !== undefined) components.push(`regular pay = ${formatAmount(result.regularPay)}`);
            if (result.overtimePay !== undefined) components.push(`overtime pay = ${formatAmount(result.overtimePay)}`);
            if (result.commission !== undefined && decision.arguments.commissionRatePercent !== undefined) components.push(`commission = ${formatAmount(result.commission)}`);
            if (result.pieceworkPay !== undefined) components.push(`piecework pay = ${formatAmount(result.pieceworkPay)}`);
            if (result.allowances !== undefined) components.push(`allowances = ${formatAmount(result.allowances)}`);
            if (result.benefits !== undefined) components.push(`benefits = ${formatAmount(result.benefits)}`);
            if (components.length) components.push(`gross earnings = ${formatAmount(result.grossEarnings)} (gross income)`);
            if (result.totalTax !== undefined) components.push(`tax = ${formatAmount(result.totalTax)}`);
            if (result.fixedDeductions !== undefined) components.push(`other stated deductions = ${formatAmount(result.fixedDeductions)}`);
            if (result.percentageDeduction !== undefined) components.push(`percentage deductions = ${formatAmount(result.percentageDeduction)}`);
            if (result.totalDeductions !== undefined) components.push(`deductions = ${formatAmount(result.totalDeductions)}`);
            if (result.netEarnings !== undefined && (result.totalDeductions !== undefined || decision.arguments.measure === 'net')) {
                components.push(`net earnings = ${formatAmount(result.netEarnings)} (net income)`);
            }
            return components.join('; ');
        }
        if (decision.operation === 'interest_comparison') {
            return `Simple-interest balance: $${result.simpleAmount}; compound-interest balance: $${result.compoundAmount}. ${result.greater} is greater by $${result.difference}.`;
        }
        if (decision.operation === 'statistics' && decision.arguments.statistic === 'summary') {
            return Object.entries(result).map(([statistic, value]) => `${statistic.replaceAll('_', ' ')}: ${formatCalculatorResult(value)}`).join('; ');
        }
        return formatCalculatorResult(result);
    }

    function answerHasTrustedResult(answer, calculatorTask) {
        const result = calculatorTask.calculation.result;
        if (typeof result !== 'number' || !Number.isFinite(result)) return false;

        const numericAnswer = answer.replace(/\s*(?:mm|cm|km|m|inches|inch|in|feet|foot|ft)\s*(?:\^?\s*[23]|[²³])?\s*$/i, '');
        const numbers = numericAnswer.match(/-?(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|\.\d+)/g) || [];
        const candidate = Number(numbers.at(-1)?.replaceAll(',', ''));
        return Number.isFinite(candidate) && Math.abs(candidate - result) <= 1e-8 * Math.max(1, Math.abs(result));
    }

    function formatCylinderVolumeResponse(calculatorTask) {
        const { radius, height, pi, unit } = calculatorTask.decision.arguments;
        const result = calculatorTask.calculation.result;
        const piDisplay = pi === Math.PI ? '\\pi' : String(pi);
        const unitDisplay = unit ? `\\,\\text{${unit}}^3` : '';
        const roundedResult = Number(result.toFixed(2)).toString();
        return [
            `**Answer:** $V \\approx ${roundedResult}${unitDisplay}$`,
            '**Step 1:** Use the cylinder volume formula: $V = \\pi r^2h$.',
            `**Step 2:** Substitute the measurements: $V = ${piDisplay}(${radius})^2(${height})$.`,
            `**Step 3:** Evaluate: $V \\approx ${roundedResult}${unitDisplay}$.`
        ].join('\n\n');
    }

    function formatPercentagePriceChain(calculatorTask) {
        const { baseAmount, stages } = calculatorTask.calculation.result;
        const finalPrice = calculatorTask.calculation.result.finalPrice;
        const currency = calculatorTask.decision.arguments.currency || '';
        const currencyPrefix = currency === '₱' ? '₱' : '';
        const working = stages.map((stage, index) => {
            const decreasesPrice = stage.type === 'discount' || stage.type === 'decrease';
            const label = stage.type === 'vat' ? 'VAT' : `${stage.type[0].toUpperCase()}${stage.type.slice(1)}`;
            const factor = decreasesPrice ? `1 - ${stage.ratePercent}/100` : `1 + ${stage.ratePercent}/100`;
            return `**Step ${index + 1}:** Apply ${stage.ratePercent}% ${label.toLowerCase()}: ${currencyPrefix}$${stage.startingAmount}(${factor}) = ${stage.endingAmount}$.`;
        });
        const explanations = [];
        const discountIndex = stages.findIndex(stage => stage.type === 'discount');
        const taxIndex = stages.findIndex(stage => stage.type === 'tax' || stage.type === 'vat');
        if (discountIndex >= 0 && taxIndex > discountIndex) explanations.push('Sales tax is applied to the discounted price.');
        if (stages.filter(stage => stage.type === 'discount').length > 1) {
            explanations.push('Each successive discount is applied to the reduced price, so the rates are not added.');
        }
        return [`**Answer:** Final price = ${currencyPrefix}$${finalPrice}$`, ...working, ...explanations].join('\n\n');
    }

    function enforceCalculatorAnswer(response, calculatorTask) {
        if (calculatorTask.decision.operation === 'percentage_application'
            && calculatorTask.decision.arguments.kind === 'price_chain') {
            return formatPercentagePriceChain(calculatorTask);
        }
        if (calculatorTask.decision.operation === 'cylinder_volume') {
            return formatCylinderVolumeResponse(calculatorTask);
        }
        const answerSection = /\*\*Answer:\*\*[\s\S]*?(?=\n\n|$)/;
        const trustedAnswer = getCalculatorAnswer(calculatorTask);
        const answerMatch = response.match(answerSection);
        if (calculatorTask.decision.operation === 'function_evaluation') {
            const { functionName = 'f', expression, input } = calculatorTask.decision.arguments;
            const result = calculatorTask.calculation.result;
            const substitutedExpression = expression
                .replace(/x/gi, `(${input})`)
                .replace(/\^/g, '^');
            return [
                `**Answer:** ${trustedAnswer}`,
                `**Step 1:** Given $${functionName}(x) = ${expression}$, substitute $x = ${input}$: $${functionName}(${input}) = ${substitutedExpression} = ${result}$.`
            ].join('\n\n');
        }
        if (['trigonometry', 'annuity', 'loan', 'z_score', 'diameter_to_radius', 'normal_probability', 'hypothesis_test'].includes(calculatorTask.decision.operation)) {
            const verifiedAnswer = getCalculatorAnswer(calculatorTask);
            return [`**Answer:** ${verifiedAnswer}`, `**Step 1:** ${calculatorTask.calculation.formula}.`].join('\n\n');
        }
        if (!answerMatch) return [response, trustedAnswer].filter(Boolean).join('\n\n');

        const answer = answerMatch[0].replace(/^\*\*Answer:\*\*\s*/, '');
        if (answerHasTrustedResult(answer, calculatorTask)) return response;
        return response.replace(answerSection, `**Answer:** ${trustedAnswer}`);
    }

    function getCalculatorDecision(question) {
        if (!window.Grade11MathCalculator || typeof window.Grade11MathCalculator.detectDecision !== 'function') {
            return null;
        }

        const decision = window.Grade11MathCalculator.detectDecision(question);
        if (!decision || decision.operation === 'none') return null;

        try {
            const calculation = window.Grade11MathCalculator.calculate(decision);
            return { decision, calculation };
        } catch (error) {
            return null;
        }
    }

    function getCalculatorCurriculumHint(calculatorTask, question = '') {
        const decision = calculatorTask?.decision;
        const questionText = question;
        if (/\btruth table\b/i.test(questionText)
            || (/\b(?:true|false)\b/i.test(questionText) && /\b(?:and|or|not)\b/i.test(questionText))) {
            return { topicName: 'Logic and Mathematical Reasoning', subtopicName: 'Truth tables and equivalent statements' };
        }
        if (/\barithmetic sequence\b/i.test(questionText) && /\b(?:nth|\d+(?:st|nd|rd|th)|term)\b/i.test(questionText)) {
            return { topicName: 'Sequences and Series', subtopicName: 'Nth term of an arithmetic sequence' };
        }
        if (/\bmean\b/i.test(questionText) && /\bmedian\b/i.test(questionText)) {
            return { topicName: 'Statistics', subtopicName: 'Mean' };
        }
        if (!decision) return null;

        if (decision.operation === 'function_evaluation') {
            return { topicName: 'Functions', subtopicName: 'Evaluating functions' };
        }
        if (decision.operation === 'trigonometry') {
            const subtopicName = ['sine_area', 'heron_area'].includes(decision.arguments.kind)
                ? 'Triangle area and Heron\'s formula'
                : 'Trigonometric ratios in right triangles';
            return { topicName: 'Trigonometry', subtopicName };
        }
        if (['annuity', 'loan'].includes(decision.operation)) {
            return { topicName: 'Sequences and Series', subtopicName: 'Financial applications of sequences and series' };
        }
        if (decision.operation === 'z_score') {
            return { topicName: 'Statistics', subtopicName: 'Normal distributions and z-scores' };
        }
        if (decision.operation === 'expected_value') {
            return { topicName: 'Statistics', subtopicName: 'Random variables and expected value' };
        }
        if (decision.operation === 'diameter_to_radius') {
            return { topicName: 'Measurement and Conversion', subtopicName: 'Surface area and volume' };
        }
        if (decision.operation === 'percentage_application') {
            const subtopics = {
                inflation: 'Percentage increase and decrease',
                increase: 'Percentage increase and decrease',
                decrease: 'Percentage increase and decrease',
                markup: 'Markup',
                discount: 'Discounts',
                vat: 'VAT',
                profit_loss: 'Profit and loss',
                price_chain: 'Multi-step percentage price changes'
            };
            return { topicName: 'Business Mathematics', subtopicName: subtopics[decision.arguments.kind] || 'Percentage increase and decrease' };
        }
        if (decision.operation === 'earnings') {
            return { topicName: 'Business Mathematics', subtopicName: 'Wages, Salaries, Overtime, Allowances, Commission and Piecework' };
        }
        if (decision.operation === 'pattern') {
            const patternType = calculatorTask.calculation.result.patternType;
            const subtopicName = patternType === 'Fibonacci'
                ? 'Fibonacci sequence'
                : patternType === 'arithmetic'
                    ? 'Arithmetic sequences'
                    : patternType === 'geometric'
                        ? 'Geometric sequences'
                        : 'Patterns';
            return { topicName: 'Sequences and Series', subtopicName };
        }
        if (['percentage_of', 'percentage_of_total'].includes(decision.operation)) {
            return { topicName: 'Business Mathematics', subtopicName: 'Percentages' };
        }
        if (decision.operation === 'percentage_change') {
            return { topicName: 'Business Mathematics', subtopicName: 'Percentage increase and decrease' };
        }
        if (decision.operation === 'compound_interest') {
            return { topicName: 'Business Mathematics', subtopicName: 'Compound interest' };
        }
        if (decision.operation === 'interest_comparison') {
            return { topicName: 'Business Mathematics', subtopicName: 'Simple interest' };
        }
        if (decision.operation === 'repeated_percentage') {
            return { topicName: 'Business Mathematics', subtopicName: 'Depreciation and inflation' };
        }
        if (decision.operation === 'statistics') {
            if (decision.arguments.statistic === 'summary') {
                if (/\bmedian\b/i.test(questionText) && !/\bmean\b/i.test(questionText)) return { topicName: 'Statistics', subtopicName: 'Median' };
                if (/\bmean\b/i.test(questionText) && !/\bmedian\b/i.test(questionText)) return { topicName: 'Statistics', subtopicName: 'Mean' };
                return null;
            }
            const names = {
                mean: 'Mean',
                median: 'Median',
                mode: 'Mode',
                range: 'Range',
                variance: 'Variance',
                standard_deviation: 'Standard deviation',
            };
            const subtopicName = names[decision.arguments.statistic];
            return subtopicName ? { topicName: 'Statistics', subtopicName } : null;
        }
        if (decision.operation === 'sequence') {
            const isArithmetic = decision.arguments.sequenceType.startsWith('arithmetic');
            const isSum = decision.arguments.sequenceType.endsWith('_sum');
            const asksForTerm = /\b(?:term|nth|n\s*th)\b/i.test(questionText);
            const subtopicName = isSum
                ? `${isArithmetic ? 'Arithmetic' : 'Geometric'} series`
                : isArithmetic && asksForTerm
                    ? 'Nth term of an arithmetic sequence'
                    : `${isArithmetic ? 'Arithmetic' : 'Geometric'} sequences`;
            return {
                topicName: 'Sequences and Series',
                subtopicName
            };
        }
        if (decision.operation === 'probability') {
            return { topicName: 'Statistics', subtopicName: 'Probability' };
        }
        if (decision.operation === 'logarithm') {
            return { topicName: 'Functions', subtopicName: 'Logarithmic functions' };
        }
        if (decision.operation === 'power') {
            return { topicName: 'Functions', subtopicName: 'Exponential functions' };
        }
        if (decision.operation === 'root') {
            return { topicName: 'Functions', subtopicName: 'Domain and range' };
        }
        return null;
    }

    function getCurriculumContext(question, calculatorTask) {
        const units = window.GRADE_11_MATH_KNOWLEDGE || [];
        const exampleBank = window.GRADE_11_MATH_EXAMPLES || [];
        if (!units.length && !exampleBank.length) return '';

        const normalizedQuestion = question.toLowerCase();
        const calculatorHint = getCalculatorCurriculumHint(calculatorTask, question);
        const retrievalQuestion = calculatorHint
            ? `${normalizedQuestion} ${calculatorHint.topicName} ${calculatorHint.subtopicName}`.toLowerCase()
            : normalizedQuestion;
        const ignoredRetrievalTerms = new Set(['and', 'the', 'for', 'from', 'with', 'find', 'what', 'which', 'when', 'where', 'given', 'using', 'value', 'values', 'problem', 'question']);
        const retrievalTokens = new Set(retrievalQuestion.match(/[a-z]+/g) || []);
        const keywordScore = keyword => {
            const normalizedKeyword = keyword.toLowerCase().trim();
            if (normalizedKeyword.length <= 3 || ignoredRetrievalTerms.has(normalizedKeyword)) return 0;
            if (normalizedKeyword.includes(' ') && retrievalQuestion.includes(normalizedKeyword)) return 4;
            return retrievalTokens.has(normalizedKeyword) ? 2 : 0;
        };
        const isBroadQuestion = /\b(all|overview|curriculum|syllabus|topics)\b/.test(normalizedQuestion);
        if (isBroadQuestion) {
            return units.map(topic => [
                `${topic.topicName}: ${topic.topicOverview}`,
                `Subtopics: ${topic.subtopics.map(subtopic => subtopic.name).join(', ')}`,
                `Prerequisites: ${topic.prerequisites.join('; ')}`
            ].join('\n')).join('\n\n');
        }

        const matches = units.flatMap(topic => {
            const topicScore = topic.keywords.reduce((score, keyword) => score + keywordScore(keyword), 0);
            return topic.subtopics.map(subtopic => {
                const nameTerms = subtopic.name.toLowerCase().match(/[a-z]+/g) || [];
                const directNameScore = nameTerms.filter(term => term.length > 3 && !ignoredRetrievalTerms.has(term) && retrievalTokens.has(term)).length * 3;
                const subtopicScore = subtopic.keywords.reduce((score, keyword) => score + keywordScore(keyword), directNameScore);
                const isCalculatorHint = calculatorHint?.topicName === topic.topicName && calculatorHint.subtopicName === subtopic.name;
                return { topic, subtopic, score: subtopicScore, topicScore, isCalculatorHint };
            });
        }).filter(match => match.score > 0 || match.isCalculatorHint)
            .sort((left, right) => Number(right.isCalculatorHint) - Number(left.isCalculatorHint) || right.score - left.score || right.topicScore - left.topicScore)
            .slice(0, 2);

        const exampleMatches = exampleBank.flatMap(topic => {
            const topicName = topic.topicName || '';
            return (topic.examples || []).map(example => {
                const exampleText = `${example.question} ${example.given || ''} ${example.expectedMethod || ''} ${example.finalAnswer || ''}`.toLowerCase();
                const score = [example.question, example.given, example.finalAnswer, example.expectedMethod].reduce((total, field) => {
                    if (!field) return total;
                    const words = field.toLowerCase();
                    return total + (normalizedQuestion.includes(words) ? 3 : 0) + (words.split(/\s+/).filter(word => word.length > 3 && normalizedQuestion.includes(word)).length * 2);
                }, 0) + (normalizedQuestion.includes(topicName.toLowerCase()) ? 2 : 0);
                return { topicName, example, score };
            });
        }).filter(item => item.score > 0).sort((left, right) => right.score - left.score).slice(0, 3);

        const curriculumNotes = matches.length
            ? matches.map(({ topic, subtopic }) => {
                const definitions = subtopic.definitions.map(item => `${item.term}: ${item.meaning}`).join('\n');
                const formulas = subtopic.formulas.length
                    ? subtopic.formulas.map(formula => `${formula.name}: $${formula.latex}$\nVariables: ${formula.variables.map(variable => `${variable.symbol} = ${variable.meaning}`).join('; ') || 'None'}`).join('\n')
                    : 'No formula required.';
                const conditions = subtopic.conditions?.join('; ') || 'No special conditions listed.';
                const derivations = subtopic.derivations?.join('\n') || 'No derivation notes listed.';
                const workedExamples = subtopic.workedExamples?.join('\n') || 'No worked examples listed.';
                return [
                    `Topic: ${topic.topicName}`,
                    `Subtopic: ${subtopic.name}`,
                    `Definitions:\n${definitions}`,
                    `Formulas:\n${formulas}`,
                    `Conditions: ${conditions}`,
                    `Important properties: ${subtopic.importantProperties.join('; ')}`,
                    `Derivations and intuition:\n${derivations}`,
                    `Worked examples:\n${workedExamples}`,
                    `Common mistakes: ${subtopic.commonMistakes.join('; ')}`,
                    `Prerequisites: ${subtopic.prerequisites.join('; ')}`,
                    `Example problem types: ${subtopic.exampleProblemTypes.join('; ')}`
                ].join('\n');
            }).join('\n\n')
            : '';

        const trainingExamples = exampleMatches.length
            ? `Training examples:\n${exampleMatches.map(({ topicName, example }) => `Topic: ${topicName}\nDifficulty: ${example.difficulty}\nQuestion: ${example.question}\nGiven: ${example.given || 'Not specified'}\nMethod: ${example.expectedMethod}\nWorked solution: ${example.workedSolution}\nFinal answer: ${example.finalAnswer}\nCommon mistake: ${example.commonMistake}`).join('\n\n')}`
            : '';

        if (!matches.length && !exampleMatches.length) {
            return `No directly matching curriculum note was found. Use Grade 11 mathematics knowledge for this question; do not refuse solely because no note matched. Available reference topics: ${units.map(topic => topic.topicName).join(', ')}.`;
        }

        return [curriculumNotes, trainingExamples].filter(Boolean).join('\n\n');
    }

    function isGrade11Question(question) {
        const normalizedQuestion = question.toLowerCase();
        const outsideScope = /\b(calculus|derivative|differential equations?|integrals?|linear algebra|abstract algebra|matrix|determinant|vector space|complex analysis|partial derivative|probability density function|machine learning|deep learning|coding|programming|python|javascript|chemistry|biology|physics|weather|politics|history|geography|sports|recipe|poem|song|story|email|essay)\b/;
        const nonMathRequest = /\b(joke|poem|song|story|email|essay|code|script)\b/;
        if (outsideScope.test(normalizedQuestion) || nonMathRequest.test(normalizedQuestion)) return false;
        if (/\b[a-z]\s*\(\s*(?:x|-?\d+(?:\.\d+)?)\s*\)/i.test(question)) return true;
        if (/^\s*(?:what(?:'s| is) the answer|explain|why|hint)[.!?\s]*$/i.test(question)) return true;
        if (getTutoringRequestMode(question) === 'check-work' || /^\s*(?:find|solve for)\s+(?:the value of\s+)?x\b/i.test(question)) return true;

        const genericKeywords = new Set(['function', 'notation', 'domain', 'range', 'system', 'data', 'event', 'factor', 'sample', 'angle', 'mean', 'mode', 'roots', 'transformation', 'inverse', 'composite', 'equation', 'solve', 'evaluate', 'period']);
        const units = window.GRADE_11_MATH_KNOWLEDGE || [];
        const curriculumKeywords = units
            .flatMap(unit => unit.keywords)
            .map(keyword => keyword.toLowerCase())
            .filter(keyword => !genericKeywords.has(keyword));
        const subtopicKeywords = units.flatMap(unit => unit.subtopics.flatMap(subtopic => [
            subtopic.name,
            ...subtopic.keywords
        ])).map(keyword => keyword.toLowerCase());
        const topicKeywords = [...curriculumKeywords, 'math', 'mathematics', 'business and finance', 'patterns', 'sequences', 'series', 'piecewise', 'trigonometry', 'normal distribution', 'sampling', 'compound interest', 'annuity', 'loan', 'mortgage', 'logic', 'proposition', 'syllogism', 'fallacy', 'function', 'domain', 'range', 'equation', 'solve', 'simplify', 'factor', 'evaluate', 'graph', 'slope', 'pythagorean', 'pythagoras', 'right triangle', 'geometry', 'area', 'perimeter', 'circumference', 'volume', 'arithmetic mean', 'average', 'profit', 'loss', 'markup', 'discount', 'vat', 'wage', 'salary', 'interest', 'depreciation', 'inflation', 'dividend', 'stock', 'bond', 'future value', 'present value', 'amortization', 'annuity', 'term', 'common difference', 'common ratio', 'arithmetic', 'geometric', 'exponential', 'logarithmic', 'rational', 'piecewise', 'inverse', 'composite', 'sine', 'cosine', 'tangent', 'csc', 'sec', 'cot', 'standard form', 'general form', 'normal curve', 'percentile', 'quartile', 'decile', 'z-score', 'correlation', 'regression', 'proposition', 'conjunction', 'disjunction', 'conditional', 'biconditional', 'negation', 'tautology', 'contradiction', 'valid', 'invalid', 'premise', 'conclusion', 'modus ponens', 'modus tollens', 'hypothesis', 'p-value', 'significance level'];

        const asksForUnitConversion = /\b(?:convert|conversion)\b/.test(normalizedQuestion)
            && /\b(?:mm|cm|m|km|millimet(?:er|re)s?|centimet(?:er|re)s?|met(?:er|re)s?|kilomet(?:er|re)s?|inches?|feet|celsius|fahrenheit|minutes?|hours?|currency|exchange rate)\b/.test(normalizedQuestion);
        if (asksForUnitConversion) return true;
        if (topicKeywords.some(keyword => normalizedQuestion.includes(keyword)) || subtopicKeywords.some(keyword => normalizedQuestion.includes(keyword))) return true;
        if (/\d+(?:\.\d+)?\s*%/.test(normalizedQuestion) && /\b(?:equal(?:s)?|equivalent|convert|mean|of|percent(?:age)?)\b/.test(normalizedQuestion)) return true;
        if (getCalculatorDecision(question)) return true;
        if (calculateBasicArithmetic(question)) return true;
        return /\d\s*(?:[+\-*/=<>×÷]|plus\b|minus\b|times\b|divided by\b)\s*(?:\d|[a-z])/i.test(question);
    }

    async function getReply(question, replyElement) {
        if (!isGrade11Question(question)) {
            const refusal = 'I can only help with Grade 11 mathematics. Ask me about algebra, functions, trigonometry, geometry, statistics, or probability.';
            await renderMessage(replyElement, refusal);
            return refusal;
        }

        const questionStatus = window.Grade11MathCalculator?.classifyQuestion?.(question);
        if (questionStatus && ['NEEDS_CLARIFICATION', 'INSUFFICIENT_INFORMATION'].includes(questionStatus.status)) {
            await renderMessage(replyElement, questionStatus.message);
            conversation.push({ role: 'user', content: question });
            conversation.push({ role: 'assistant', content: questionStatus.message });
            return questionStatus.message;
        }

        const requestMode = getTutoringRequestMode(question);
        const calculatorTask = requestMode === 'hint' ? null : getCalculatorDecision(question);
        const earningsTask = calculatorTask?.decision.operation === 'earnings';
        const percentageTask = calculatorTask?.decision.operation === 'percentage_application';
        const patternTask = calculatorTask?.decision.operation === 'pattern';
        const sequenceTask = calculatorTask?.decision.operation === 'sequence';
        const calculatorSummary = calculatorTask
            ? [
                percentageTask
                    ? `Classify this as a ${calculatorTask.decision.arguments.kind.replaceAll('_', ' ')} problem. Identify the original/base amount before calculating. Use cost price as the base for markup and percentage profit/loss, the listed/current price for a discount, and the price before VAT for VAT. Distinguish percentage amounts from resulting prices or values and explain every stage in the order stated. The deterministic calculation is: ${calculatorTask.calculation.formula}. Do not conflate markup with profit, discounts with VAT, or absolute amounts with percentages.`
                    : '',
                earningsTask
                    ? `Classify this as a ${calculatorTask.decision.arguments.kind.replaceAll('_', ' ')} earnings problem. Identify earnings and additions first, determine gross income, then identify and calculate only the stated deductions before finding net income. The calculator extracted the stated values and verified these results: ${formatCalculatorResult(calculatorTask.calculation.result)}. Explain the payslip at Grade 11 level and interpret the result in context. Use only rates, multipliers, benefit values, deduction rules, and tax tables supplied in the question. If a tax rate, taxable base, or table is missing, ask for it; do not assume or invent tax rules.`
                    : '',
                patternTask
                    ? `Inspect the terms in order. Compare consecutive differences and ratios, then test a Fibonacci recurrence or another simple rule. Classify a pattern as arithmetic, geometric, Fibonacci, or another type only when the rule fits all listed terms. Explain why the relationship works; do not force an arithmetic or geometric assumption when the terms do not support it. The calculator checked this pattern: ${getCalculatorAnswer(calculatorTask)}`
                    : '',
                sequenceTask
                    ? calculatorTask.decision.arguments.sequenceType.startsWith('arithmetic')
                        ? `This is an arithmetic ${calculatorTask.decision.arguments.sequenceType.endsWith('_sum') ? 'series' : 'sequence'}. Identify the first term and common difference. For one requested term use a_n = a_1 + (n - 1)d and explain the n - 1 steps; do not confuse a term with the sum of terms. Verify the substitution and constant difference. The calculator result is: ${getCalculatorAnswer(calculatorTask)}`
                        : calculatorTask.decision.arguments.sequenceType.startsWith('geometric')
                            ? `This is a geometric ${calculatorTask.decision.arguments.sequenceType.endsWith('_sum') ? 'series' : 'sequence'}. Identify the first term and common ratio by dividing consecutive nonzero terms; a ratio is multiplicative and is not the common difference. For one requested term use a_n = a_1 r^(n - 1). Keep one term distinct from a series sum, verify the ratio, and explain the result. The calculator result is: ${getCalculatorAnswer(calculatorTask)}`
                            : `Identify the sequence rule and use the requested term or series method. Keep one term distinct from the sum of terms and verify the calculation. The calculator result is: ${getCalculatorAnswer(calculatorTask)}`
                    : '',
                requestMode === 'check-work'
                    ? `A deterministic calculator independently checked the numerical work. Its result is ${formatCalculatorResult(calculatorTask.calculation.result)}. Compare this with the learner's work, identify the first mistake if any, and explain the correction.`
                    : percentageTask
                        ? `A deterministic calculator has verified this result: ${getCalculatorAnswer(calculatorTask)} Do not replace it with a different value; explain the method and reasoning around it.`
                        : patternTask
                            ? `Use this verified pattern result: ${getCalculatorAnswer(calculatorTask)} Explain the rule and requested term in Grade 11 language.`
                            : sequenceTask
                                ? `Use this verified sequence result: ${getCalculatorAnswer(calculatorTask)} Explain how the first term and ${calculatorTask.decision.arguments.sequenceType.startsWith('geometric') ? 'common ratio' : 'common difference'} generate the requested result.`
                                : `A deterministic calculator has been used for the numeric part. Use this result as the numerical answer: ${formatCalculatorResult(calculatorTask.calculation.result)}. Do not replace it with a different value; explain the method and reasoning around it.`
            ].filter(Boolean).join(' ')
            : '';

        const allowsQuickAnswer = requestMode === 'standard' || requestMode === 'answer';
        const quickAnswer = allowsQuickAnswer && !calculatorTask && (answerKnownFormula(question) || calculateBasicArithmetic(question));
        if (quickAnswer) {
            conversation.push({ role: 'user', content: question });
            conversation.push({ role: 'assistant', content: quickAnswer });
            await renderMessage(replyElement, quickAnswer);
            return quickAnswer;
        }

        conversation.push({ role: 'user', content: question });
        const curriculumContext = getCurriculumContext(question, calculatorTask);
        const recentConversation = conversation.slice(1).slice(/\b(all|overview|curriculum|syllabus|topics)\b/i.test(question) ? -2 : -6);
        if (recentConversation[0]?.role === 'assistant') recentConversation.shift();
        const requestMessages = [
            {
                role: 'system',
                content: `${conversation[0].content}\n\nCurrent response mode: ${requestMode}. ${getTutoringModeInstruction(requestMode)} Use these Grade 11 curriculum notes when relevant. Treat them as reference material, not an exhaustive syllabus. If the problem is ambiguous or essential information is missing, ask a concise clarifying question rather than guessing.\n\n${calculatorSummary}\n\n${curriculumContext}`
            },
            ...recentConversation
        ];

        const requestPayload = provider === 'gemini'
            ? { messages: requestMessages, format: mathResponseFormat }
            : {
                model,
                messages: requestMessages,
                think: false,
                format: mathResponseFormat,
                options: {
                    num_ctx: 2048,
                    num_predict: 768,
                    temperature: 0.2
                },
                stream: false
            };
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload)
        });
        if (!response.ok) {
            if (provider === 'gemini') {
                const failure = await response.json().catch(() => ({}));
                throw new Error(`Gemini: ${failure.error || 'The request could not be completed.'}`);
            }
            throw new Error('Assistant request failed');
        }
        const result = await response.json();
        const modelReply = formatMathResponse(result.message?.content || '', requestMode) || 'I could not produce a complete solution. Please try a shorter question or split the problem into smaller parts.';
        const baseReply = calculatorTask && requestMode !== 'hint'
            ? enforceCalculatorAnswer(modelReply, calculatorTask)
            : modelReply;

        const reply = ensurePiecewiseExample(question, baseReply, requestMode);
        await renderMessage(replyElement, reply);
        conversation.push({ role: 'assistant', content: reply });
        return reply;
    }

    launcher.addEventListener('click', () => setOpen(!panel.classList.contains('is-open')));
    closeButton.addEventListener('click', () => setOpen(false));

    form.addEventListener('submit', async event => {
        event.preventDefault();
        await restoredMessages;
        const question = input.value.trim();
        if (!question) return;

        addMessage(question, 'user');
        input.value = '';
        input.disabled = true;
        const reply = addMessage('Thinking...', 'bot');

        try {
            await Promise.all([
                window.GRADE_11_MATH_KNOWLEDGE_READY,
                window.GRADE_11_MATH_EXAMPLES_READY
            ]);
            await getReply(question, reply);
        } catch (error) {
            if (conversation.at(-1)?.role === 'user') conversation.pop();
            if (error.message?.includes('KaTeX')) {
                reply.textContent = 'The answer is ready, but KaTeX could not load its local assets. Check the KaTeX files and refresh the page.';
            } else if (error.message?.startsWith('Gemini: ')) {
                reply.textContent = error.message.slice('Gemini: '.length);
            } else {
                reply.textContent = 'I could not reach the AI service. Check the selected provider and try again.';
            }
        } finally {
            saveChatState();
            input.disabled = false;
            input.focus();
        }
    });
})();
