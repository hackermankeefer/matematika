// Learn Page JavaScript

document.addEventListener('DOMContentLoaded', function() {

    // Initialize animations
    initHeroAnimations();
    initScrollAnimations();
    initTopicCardAnimations();
    initPathTimeline();

});

// Hero Section Animations
function initHeroAnimations() {
    const heroDecoration = document.querySelector('.hero-decoration');

    if (!heroDecoration) return;

    // Mathematical formulas to display
    const formulas = [
        'f(x) = ax² + bx + c',
        'sin²θ + cos²θ = 1',
        'y = mx + b',
        'a² + b² = c²',
        '∫ f(x)dx',
        'lim(x→∞)',
        'Σ (n=1 to ∞)',
        'dy/dx',
        '√(a² + b²)',
        'log₂(x)',
        'tan(θ) = sin(θ)/cos(θ)',
        'P(A ∪ B) = P(A) + P(B)',
        'μ = Σx/n',
        '(a + b)² = a² + 2ab + b²',
        'e^(iπ) + 1 = 0'
    ];

    // Create floating formulas
    for (let i = 0; i < 8; i++) {
        const formula = document.createElement('div');
        formula.className = 'floating-formula';
        if (i % 3 === 1) formula.classList.add('delay-1');
        if (i % 3 === 2) formula.classList.add('delay-2');

        formula.textContent = formulas[Math.floor(Math.random() * formulas.length)];
        formula.style.top = Math.random() * 100 + '%';
        formula.style.left = Math.random() * 100 + '%';
        formula.style.animationDuration = (15 + Math.random() * 10) + 's';

        heroDecoration.appendChild(formula);
    }
}

// Scroll Animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all topic cards
    document.querySelectorAll('.topic-card').forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(50px)';
        card.style.transition = `all 0.6s ease ${index * 0.1}s`;
        observer.observe(card);
    });

    // Observe path items
    document.querySelectorAll('.path-item').forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-30px)';
        item.style.transition = `all 0.6s ease ${index * 0.15}s`;
        observer.observe(item);
    });

    // Observe resource cards
    document.querySelectorAll('.resource-card').forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.9)';
        card.style.transition = `all 0.5s ease ${index * 0.1}s`;
        observer.observe(card);
    });
}

// Topic Card Interactive Animations
function initTopicCardAnimations() {
    const topicCards = document.querySelectorAll('.topic-card');

    topicCards.forEach(card => {
        const icon = card.querySelector('.topic-icon');

        card.addEventListener('mouseenter', function() {
            if (icon) {
                icon.style.transform = 'rotate(10deg) scale(1.1)';
                icon.style.transition = 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            }
        });

        card.addEventListener('mouseleave', function() {
            if (icon) {
                icon.style.transform = 'rotate(0deg) scale(1)';
            }
        });

        // Add ripple effect to start button
        const startBtn = card.querySelector('.topic-start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', function(e) {
                const ripple = document.createElement('span');
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height);
                const x = e.clientX - rect.left - size / 2;
                const y = e.clientY - rect.top - size / 2;

                ripple.style.cssText = `
                    position: absolute;
                    width: ${size}px;
                    height: ${size}px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.3);
                    left: ${x}px;
                    top: ${y}px;
                    transform: scale(0);
                    animation: ripple 0.6s ease-out;
                    pointer-events: none;
                `;

                this.style.position = 'relative';
                this.style.overflow = 'hidden';
                this.appendChild(ripple);

                setTimeout(() => ripple.remove(), 600);
            });
        }
    });

    // Add ripple animation
    if (!document.querySelector('#ripple-animation')) {
        const style = document.createElement('style');
        style.id = 'ripple-animation';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(2);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Learning Path Timeline Animations
function initPathTimeline() {
    const pathItems = document.querySelectorAll('.path-item');

    const observerOptions = {
        threshold: 0.5
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const number = entry.target.querySelector('.path-number');
                const connector = entry.target.querySelector('.path-connector');

                if (number) {
                    number.style.animation = 'pulse 0.6s ease-out';
                    setTimeout(() => {
                        number.style.animation = '';
                    }, 600);
                }

                if (connector) {
                    connector.style.animation = 'drawLine 0.8s ease-out forwards';
                }
            }
        });
    }, observerOptions);

    pathItems.forEach(item => {
        observer.observe(item);
    });

    // Add animations
    if (!document.querySelector('#path-animations')) {
        const style = document.createElement('style');
        style.id = 'path-animations';
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.15); box-shadow: 0 0 20px rgba(74, 158, 255, 0.5); }
                100% { transform: scale(1); }
            }

            @keyframes drawLine {
                from {
                    height: 0;
                    opacity: 0;
                }
                to {
                    height: 100%;
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Topic Progress Tracking (placeholder for future implementation)
function trackProgress(topicId) {
    // This would integrate with a backend or localStorage
    // to track user progress through topics
    console.log('Starting topic:', topicId);
}

// Smooth Scroll for Internal Links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Add parallax effect to hero on scroll
window.addEventListener('scroll', function() {
    const heroContent = document.querySelector('.hero-content');
    const heroDecoration = document.querySelector('.hero-decoration');
    const scrolled = window.pageYOffset;

    if (heroContent) {
        heroContent.style.transform = `translateY(${scrolled * 0.3}px)`;
        heroContent.style.opacity = 1 - (scrolled / 500);
    }

    if (heroDecoration) {
        heroDecoration.style.transform = `translateY(${scrolled * 0.2}px)`;
    }
});

// Progress indicator animation
function updateProgressIndicator() {
    const sections = document.querySelectorAll('.curriculum-overview, .learning-path, .study-resources');
    const windowHeight = window.innerHeight;
    const scrollTop = window.pageYOffset;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;

        if (scrollTop > sectionTop - windowHeight + 100 && scrollTop < sectionTop + sectionHeight) {
            section.style.opacity = '1';
        }
    });
}

window.addEventListener('scroll', updateProgressIndicator);
