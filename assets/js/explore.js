// Explore Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    initCanvasAnimation();
    initScrollAnimations();
    initCategoryCards();
    initExplorationCards();
    initFormulaExplorer();
});

// Canvas particle animation for hero section
function initCanvasAnimation() {
    const canvas = document.getElementById('explore-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];
    let animationId;

    // Resize canvas
    function resize() {
        width = canvas.parentElement.offsetWidth;
        height = canvas.parentElement.offsetHeight;
        canvas.width = width;
        canvas.height = height;
    }

    // Particle class
    class Particle {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.vx = (Math.random() - 0.5) * 1;
            this.vy = (Math.random() - 0.5) * 1;
            this.size = Math.random() * 2 + 1;
            this.color = `rgba(124, 58, 237, ${Math.random() * 0.5 + 0.1})`;
            this.alpha = Math.random() * 0.3 + 0.1;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Bounce off edges
            if (this.x < 0 || this.x > width) this.vx *= -1;
            if (this.y < 0 || this.y > height) this.vy *= -1;

            // Soft bounce with margin
            const margin = 50;
            if (this.x < margin || this.x > width - margin) this.vx *= -1;
            if (this.y < margin || this.y > height - margin) this.vy *= -1;
        }

        draw() {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Connect particles with lines
    function connectParticles() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    const opacity = 1 - distance / 150;
                    ctx.strokeStyle = `rgba(124, 58, 237, ${opacity * 0.2})`;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, width, height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        connectParticles();
        animationId = requestAnimationFrame(animate);
    }

    // Initialize particles
    function initParticles() {
        resize();
        const particleCount = Math.floor((width * height) / 10000);
        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
        animate();
    }

    // Event listeners
    window.addEventListener('resize', () => {
        resize();
        particles = [];
        for (let i = 0; i < particles.length; i++) {
            particles.push(new Particle());
        }
    });

    initParticles();

    // Stop animation on page hide for performance
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            cancelAnimationFrame(animationId);
        } else {
            animate();
        }
    });
}

// Scroll animations with Intersection Observer
function initScrollAnimations() {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.classList.add('visible');
                    entry.target.classList.add(`stagger-${(index % 6) + 1}`);
                }, index * 50);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe category cards
    document.querySelectorAll('.category-card').forEach(card => {
        card.classList.add('animate-in');
        observer.observe(card);
    });

    // Observe exploration cards
    document.querySelectorAll('.exploration-card').forEach(card => {
        card.classList.add('animate-in');
        observer.observe(card);
    });

    // Observe section titles
    document.querySelectorAll('.section-title, .section-subtitle').forEach(element => {
        element.classList.add('animate-in');
        observer.observe(element);
    });
}

// Category card hover effects
function initCategoryCards() {
    const cards = document.querySelectorAll('.category-card');

    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.category-icon svg');
            if (icon) {
                icon.style.transform = 'scale(1.2) rotate(10deg)';
                icon.style.transition = 'transform 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
            }
        });

        card.addEventListener('mouseleave', function() {
            const icon = this.querySelector('.category-icon svg');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
                icon.style.transition = 'transform 0.5s ease';
            }
        });
    });
}

// Exploration card interactions
function initExplorationCards() {
    const cards = document.querySelectorAll('.exploration-card');

    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const placeholder = this.querySelector('.card-placeholder');
            if (placeholder) {
                placeholder.style.transform = 'scale(1.15) rotate(5deg)';
                placeholder.style.transition = 'transform 0.3s ease';
            }
        });

        card.addEventListener('mouseleave', function() {
            const placeholder = this.querySelector('.card-placeholder');
            if (placeholder) {
                placeholder.style.transform = 'scale(1) rotate(0deg)';
                placeholder.style.transition = 'transform 0.5s ease';
            }
        });
    });
}

const FORMULA_LIBRARY = [
    {
        id: 'circle-area',
        name: 'Area of a Circle',
        category: 'Geometry',
        formula: 'A = πr²',
        purpose: 'Use this formula to find the total area enclosed by a circle.',
        variables: [
            { label: 'A', detail: 'Area' },
            { label: 'π', detail: 'Pi ≈ 3.1416' },
            { label: 'r', detail: 'Radius' }
        ],
        generateExample: () => {
            const r = randomInt(3, 12);
            const area = Math.PI * r * r;
            return {
                question: `A circle has a radius of ${r} cm. What is its area?`,
                formula: 'A = πr²',
                given: [`r = ${r} cm`],
                steps: [
                    `A = π(${r})²`,
                    `A = π × ${r * r}`,
                    `A ≈ ${area.toFixed(2)} cm²`
                ],
                answer: Number(area.toFixed(2)),
                tolerance: 0.2,
                units: 'cm²'
            };
        }
    },
    {
        id: 'pythagorean',
        name: 'Pythagorean Theorem',
        category: 'Geometry',
        formula: 'a² + b² = c²',
        purpose: 'This finds the missing side of a right triangle when two sides are known.',
        variables: [
            { label: 'a', detail: 'One leg' },
            { label: 'b', detail: 'Other leg' },
            { label: 'c', detail: 'Hypotenuse' }
        ],
        generateExample: () => {
            const a = randomInt(3, 9);
            const b = randomInt(4, 12);
            const c = Math.sqrt(a * a + b * b);
            return {
                question: `A right triangle has legs measuring ${a} cm and ${b} cm. Find the length of the hypotenuse.`,
                formula: 'c = √(a² + b²)',
                given: [`a = ${a} cm`, `b = ${b} cm`],
                steps: [
                    `c² = ${a}² + ${b}²`,
                    `c² = ${a * a} + ${b * b} = ${a * a + b * b}`,
                    `c = √(${a * a + b * b}) ≈ ${c.toFixed(2)} cm`
                ],
                answer: Number(c.toFixed(2)),
                tolerance: 0.2,
                units: 'cm'
            };
        }
    },
    {
        id: 'quadratic-formula',
        name: 'Quadratic Formula',
        category: 'Algebra',
        formula: 'x = (-b ± √(b² - 4ac)) / (2a)',
        purpose: 'Solve quadratic equations that may not factor neatly.',
        variables: [
            { label: 'a', detail: 'Coefficient of x²' },
            { label: 'b', detail: 'Coefficient of x' },
            { label: 'c', detail: 'Constant term' }
        ],
        generateExample: () => {
            const root1 = randomInt(1, 6);
            const root2 = randomInt(1, 6);
            const b = -(root1 + root2);
            const c = root1 * root2;
            const a = 1;
            const equation = `x² ${b < 0 ? '-' : '+'} ${Math.abs(b)}x ${c > 0 ? '+' : '-'} ${Math.abs(c)} = 0`;
            const discriminant = b * b - 4 * a * c;
            const x = (-b + Math.sqrt(discriminant)) / (2 * a);
            return {
                question: `Solve the equation ${equation}.`,
                formula: 'x = (-b ± √(b² - 4ac)) / 2a',
                given: [`a = ${a}`, `b = ${b}`, `c = ${c}`],
                steps: [
                    `x = (-(${b}) ± √(${b}² - 4(${a})(${c}))) / 2(${a})`,
                    `x = (${Math.abs(b)} ± √(${discriminant})) / 2`,
                    `x = ${x.toFixed(2)} or ${(-b - Math.sqrt(discriminant)) / (2 * a)}`
                ],
                answer: Number(x.toFixed(2)),
                tolerance: 0.3,
                units: ''
            };
        }
    },
    {
        id: 'slope-formula',
        name: 'Slope Formula',
        category: 'Functions',
        formula: 'm = (y₂ - y₁) / (x₂ - x₁)',
        purpose: 'Measure how steep a line is between two points.',
        variables: [
            { label: 'm', detail: 'Slope' },
            { label: 'x₁, y₁', detail: 'First point' },
            { label: 'x₂, y₂', detail: 'Second point' }
        ],
        generateExample: () => {
            const x1 = randomInt(-4, 3);
            const y1 = randomInt(-3, 6);
            const x2 = x1 + randomInt(2, 8);
            const y2 = y1 + randomInt(-5, 6);
            const slope = (y2 - y1) / (x2 - x1);
            return {
                question: `Find the slope of the line through points (${x1}, ${y1}) and (${x2}, ${y2}).`,
                formula: 'm = (y₂ - y₁) / (x₂ - x₁)',
                given: [`(${x1}, ${y1})`, `(${x2}, ${y2})`],
                steps: [
                    `m = (${y2} - ${y1}) / (${x2} - ${x1})`,
                    `m = ${y2 - y1} / ${x2 - x1}`,
                    `m ≈ ${slope.toFixed(2)}`
                ],
                answer: Number(slope.toFixed(2)),
                tolerance: 0.05,
                units: ''
            };
        }
    },
    {
        id: 'piecewise-function',
        name: 'Piecewise Function',
        category: 'Functions',
        formula: 'f(x) = { x + 2, x < 0; 2x - 1, x ≥ 0 }',
        purpose: 'Define a function with different rules for different input intervals.',
        variables: [
            { label: 'f(x)', detail: 'Output value' },
            { label: 'x', detail: 'Input value' },
            { label: 'condition', detail: 'Rule that selects a piece' }
        ],
        generateExample: () => {
            const x = randomInt(-6, 6);
            const usesFirstRule = x < 0;
            const rule = usesFirstRule ? 'x + 2' : '2x - 1';
            const answer = usesFirstRule ? x + 2 : 2 * x - 1;
            return {
                question: `Evaluate f(${x}) for the piecewise function.`,
                formula: 'f(x) = { x + 2, x < 0; 2x - 1, x ≥ 0 }',
                given: [`x = ${x}`, `Selected condition: ${x} ${usesFirstRule ? '<' : '≥'} 0`],
                steps: [
                    `Since ${x} ${usesFirstRule ? '<' : '≥'} 0, use the rule ${rule}.`,
                    `f(${x}) = ${usesFirstRule ? `${x} + 2` : `2(${x}) - 1`}`,
                    `f(${x}) = ${answer}`
                ],
                answer,
                tolerance: 0.05,
                units: ''
            };
        }
    },
    {
        id: 'sine-ratio',
        name: 'Sine Ratio',
        category: 'Trigonometry',
        formula: 'sin(θ) = opposite / hypotenuse',
        purpose: 'Find a missing side or angle in a right triangle using the sine function.',
        variables: [
            { label: 'θ', detail: 'Angle' },
            { label: 'opposite', detail: 'Side opposite the angle' },
            { label: 'hypotenuse', detail: 'Longest side' }
        ],
        generateExample: () => {
            const angle = randomInt(20, 60);
            const hypotenuse = randomInt(8, 18);
            const opposite = Math.sin((angle * Math.PI) / 180) * hypotenuse;
            return {
                question: `In a right triangle, the hypotenuse is ${hypotenuse} cm and the angle is ${angle}°. Find the opposite side.`,
                formula: 'sin(θ) = opposite / hypotenuse',
                given: [`θ = ${angle}°`, `hypotenuse = ${hypotenuse} cm`],
                steps: [
                    `opposite = sin(${angle}°) × ${hypotenuse}`,
                    `opposite ≈ ${Math.sin((angle * Math.PI) / 180).toFixed(3)} × ${hypotenuse}`,
                    `opposite ≈ ${opposite.toFixed(2)} cm`
                ],
                answer: Number(opposite.toFixed(2)),
                tolerance: 0.3,
                units: 'cm'
            };
        }
    },
    {
        id: 'mean-formula',
        name: 'Mean',
        category: 'Statistics',
        formula: 'x̄ = (x₁ + x₂ + ... + xₙ) / n',
        purpose: 'This calculates the average value of a data set by dividing the sum of all values by the number of values.',
        variables: [
            { label: 'x̄', detail: 'Mean (average)' },
            { label: 'xᵢ', detail: 'Data values' },
            { label: 'n', detail: 'Number of values' }
        ],
        generateExample: () => {
            const values = Array.from({ length: 5 }, () => randomInt(4, 18));
            const total = values.reduce((sum, value) => sum + value, 0);
            const mean = total / values.length;
            return {
                question: `Find the mean of the data set: ${values.join(', ')}.`,
                formula: 'x̄ = (x₁ + x₂ + ... + xₙ) / n',
                given: [`Values: ${values.join(', ')}`, `n = ${values.length}`, `Sum = ${total}`],
                steps: [
                    `x̄ = (${values.join(' + ')}) / ${values.length}`,
                    `x̄ = ${total} / ${values.length}`,
                    `x̄ = ${mean.toFixed(2)}`
                ],
                answer: Number(mean.toFixed(2)),
                tolerance: 0.05,
                units: ''
            };
        }
    }
];

const state = {
    selectedId: FORMULA_LIBRARY[0].id,
    activeCategory: 'all',
    searchTerm: '',
    currentExample: null,
    practiceProblem: null
};

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatFormula(formula) {
    if (formula.startsWith('f(x) = {')) {
        return '<span class="piecewise-formula"><span class="formula-left">f(x) =</span><span class="piecewise-brace">{</span><span class="piecewise-rules"><span>x + 2, <em>x &lt; 0</em></span><span>2x - 1, <em>x &ge; 0</em></span></span></span>';
    }

    const [leftSide, rightSide] = formula.split(' = ');
    if (!rightSide || !rightSide.includes(' / ')) {
        return formula.replace(/\n/g, '<br>');
    }

    const [numerator, denominator] = rightSide.split(' / ');
    return `<span class="formula-equation"><span class="formula-left">${leftSide} =</span><span class="formula-fraction"><span class="formula-numerator">${numerator}</span><span class="formula-denominator">${denominator}</span></span></span>`;
}

function getVisibleFormulas() {
    return FORMULA_LIBRARY.filter((formula) => {
        const matchesCategory = state.activeCategory === 'all' || formula.category === state.activeCategory;
        const haystack = `${formula.name} ${formula.category} ${formula.purpose} ${formula.formula}`.toLowerCase();
        const matchesSearch = haystack.includes(state.searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
    });
}

function renderFormulaCards() {
    const list = document.getElementById('formula-card-list');
    if (!list) return;

    const formulas = getVisibleFormulas();
    if (formulas.length === 0) {
        list.innerHTML = '<div class="empty-state">No formulas match your search.</div>';
        return;
    }

    if (!formulas.some((formula) => formula.id === state.selectedId)) {
        state.selectedId = formulas[0].id;
    }

    list.innerHTML = formulas.map((formula) => `
        <button class="formula-card ${formula.id === state.selectedId ? 'is-selected' : ''}" type="button" data-formula-id="${formula.id}">
            <span class="formula-card-tag">${formula.category}</span>
            <h4>${formula.name}</h4>
            <p class="mini-formula">${formatFormula(formula.formula)}</p>
        </button>
    `).join('');

    list.querySelectorAll('.formula-card').forEach((button) => {
        button.addEventListener('click', () => {
            state.selectedId = button.dataset.formulaId;
            renderFormulaCards();
            renderActiveFormula();
        });
    });
}

function renderActiveFormula() {
    const selected = FORMULA_LIBRARY.find((formula) => formula.id === state.selectedId);
    if (!selected) return;

    const categoryEl = document.getElementById('active-formula-category');
    const nameEl = document.getElementById('active-formula-name');
    const expressionEl = document.getElementById('active-formula-expression');
    const purposeEl = document.getElementById('active-formula-purpose');
    const variablesEl = document.getElementById('active-formula-variables');

    if (!categoryEl || !nameEl || !expressionEl || !purposeEl || !variablesEl) return;

    categoryEl.textContent = selected.category;
    nameEl.textContent = selected.name;
    expressionEl.innerHTML = formatFormula(selected.formula);
    purposeEl.textContent = selected.purpose;
    variablesEl.innerHTML = selected.variables.map((variable) => `
        <div class="variable-pill">
            <strong>${variable.label}</strong>
            <span>${variable.detail}</span>
        </div>
    `).join('');

    state.currentExample = null;
    state.practiceProblem = null;
    document.getElementById('formula-solution').classList.add('hidden');
    document.getElementById('practice-form').classList.add('hidden');
    document.getElementById('practice-feedback').textContent = '';
    document.getElementById('student-answer').value = '';
    document.getElementById('practice-question').textContent = 'Select a problem to begin practicing.';
}

function generateExample() {
    const formula = FORMULA_LIBRARY.find((item) => item.id === state.selectedId);
    if (!formula) return;

    const example = formula.generateExample();
    state.currentExample = example;
    state.practiceProblem = null;

    const questionEl = document.getElementById('practice-question');
    const solutionEl = document.getElementById('formula-solution');
    const practiceForm = document.getElementById('practice-form');
    const feedbackEl = document.getElementById('practice-feedback');

    if (!questionEl || !solutionEl || !practiceForm || !feedbackEl) return;

    questionEl.textContent = example.question;
    solutionEl.classList.add('hidden');
    solutionEl.innerHTML = '';
    practiceForm.classList.add('hidden');
    feedbackEl.textContent = '';
    feedbackEl.className = 'practice-feedback';
    document.getElementById('student-answer').value = '';
}

function showSolution() {
    const example = state.currentExample;
    const solutionEl = document.getElementById('formula-solution');
    if (!example || !solutionEl) return;

    const steps = example.steps.map((step) => `<li>${step}</li>`).join('');
    solutionEl.innerHTML = `
        <strong>Solution</strong>
        <ol>${steps}</ol>
    `;
    solutionEl.classList.remove('hidden');
}

function startPracticeMode() {
    const formula = FORMULA_LIBRARY.find((item) => item.id === state.selectedId);
    if (!formula) return;

    const practice = state.currentExample || formula.generateExample();
    state.practiceProblem = practice;
    state.currentExample = practice;

    const questionEl = document.getElementById('practice-question');
    const practiceForm = document.getElementById('practice-form');
    const feedbackEl = document.getElementById('practice-feedback');
    const solutionEl = document.getElementById('formula-solution');

    if (!questionEl || !practiceForm || !feedbackEl || !solutionEl) return;

    questionEl.textContent = practice.question;
    practiceForm.classList.remove('hidden');
    feedbackEl.textContent = ''; 
    feedbackEl.className = 'practice-feedback';
    solutionEl.classList.add('hidden');
    solutionEl.innerHTML = '';
    document.getElementById('student-answer').value = '';
    document.getElementById('student-answer').focus();
}

function checkPracticeAnswer() {
    const problem = state.practiceProblem || state.currentExample;
    const answerInput = document.getElementById('student-answer');
    const feedbackEl = document.getElementById('practice-feedback');
    const solutionEl = document.getElementById('formula-solution');

    if (!problem || !answerInput || !feedbackEl || !solutionEl) return;

    const userValue = Number(answerInput.value);
    if (Number.isNaN(userValue)) {
        feedbackEl.textContent = 'Please enter a valid number before submitting.';
        feedbackEl.className = 'practice-feedback error';
        return;
    }

    const difference = Math.abs(userValue - problem.answer);
    const isCorrect = difference <= problem.tolerance;

    if (isCorrect) {
        feedbackEl.textContent = 'Correct! Great work.';
        feedbackEl.className = 'practice-feedback success';
    } else {
        feedbackEl.textContent = 'Not quite. Try again and review the steps below.';
        feedbackEl.className = 'practice-feedback error';
        const steps = problem.steps.map((step) => `<li>${step}</li>`).join('');
        solutionEl.innerHTML = `
            <strong>Correct solution</strong>
            <ol>${steps}</ol>
        `;
        solutionEl.classList.remove('hidden');
    }

    setTimeout(() => {
        const formula = FORMULA_LIBRARY.find((item) => item.id === state.selectedId);
        if (formula) {
            const nextProblem = formula.generateExample();
            state.currentExample = nextProblem;
            state.practiceProblem = null;
            document.getElementById('practice-question').textContent = nextProblem.question;
            answerInput.value = '';
            feedbackEl.textContent = isCorrect ? 'New problem ready.' : 'A new problem is ready.';
            feedbackEl.className = isCorrect ? 'practice-feedback success' : 'practice-feedback error';
            solutionEl.classList.add('hidden');
            solutionEl.innerHTML = '';
        }
    }, 1400);
}

function setupFormulaExplorer() {
    const searchInput = document.getElementById('formula-search');
    const filterButtons = document.querySelectorAll('.formula-filter');
    const surpriseBtn = document.getElementById('surprise-formula-btn');
    const generateExampleBtn = document.getElementById('generate-example-btn');
    const showSolutionBtn = document.getElementById('show-solution-btn');
    const tryItBtn = document.getElementById('try-it-yourself-btn');
    const submitAnswerBtn = document.getElementById('submit-answer-btn');

    if (!searchInput || !filterButtons.length) return;

    searchInput.addEventListener('input', (event) => {
        state.searchTerm = event.target.value.trim();
        renderFormulaCards();
    });

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            state.activeCategory = button.dataset.category;
            filterButtons.forEach((item) => item.classList.toggle('is-active', item === button));
            renderFormulaCards();
            renderActiveFormula();
        });
    });

    surpriseBtn.addEventListener('click', () => {
        const formulas = getVisibleFormulas();
        if (!formulas.length) return;
        const randomEntry = formulas[Math.floor(Math.random() * formulas.length)];
        state.selectedId = randomEntry.id;
        renderFormulaCards();
        renderActiveFormula();
        generateExample();
    });

    generateExampleBtn.addEventListener('click', generateExample);
    showSolutionBtn.addEventListener('click', showSolution);
    tryItBtn.addEventListener('click', startPracticeMode);
    submitAnswerBtn.addEventListener('click', checkPracticeAnswer);

    renderFormulaCards();
    renderActiveFormula();
    generateExample();
}

function initFormulaExplorer() {
    const formulaSection = document.querySelector('.formula-explorer-section');
    if (!formulaSection) return;
    setupFormulaExplorer();
}

// Parallax effect for hero section
function initParallax() {
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        const hero = document.querySelector('.page-hero');
        if (hero) {
            const offset = scrolled * 0.5;
            hero.style.backgroundPositionY = `${offset}px`;
        }
    });
}

// Initialize all interactive features
document.addEventListener('DOMContentLoaded', () => {
    initParallax();
});
