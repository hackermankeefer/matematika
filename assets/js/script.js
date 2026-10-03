// ============================================
// NAVIGATION
// ============================================

const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        menuToggle.classList.toggle('active');
    });
}

// Close mobile menu when clicking a link
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('active');
        menuToggle.classList.remove('active');
    });
});

// ============================================
// HERO CANVAS ANIMATION
// ============================================

const canvas = document.getElementById('hero-canvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;

    // Set canvas size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Particle class
    class Particle {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.vx = (Math.random() - 0.5) * 0.5;
            this.vy = (Math.random() - 0.5) * 0.5;
            this.radius = Math.random() * 2 + 1;
            this.opacity = Math.random() * 0.5 + 0.2;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;

            // Wrap around edges
            if (this.x < 0) this.x = canvas.width;
            if (this.x > canvas.width) this.x = 0;
            if (this.y < 0) this.y = canvas.height;
            if (this.y > canvas.height) this.y = 0;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(74, 158, 255, ${this.opacity})`;
            ctx.fill();
        }
    }

    // Initialize particles
    function initParticles() {
        particles = [];
        const particleCount = Math.min(100, Math.floor((canvas.width * canvas.height) / 10000));
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    // Draw connections between nearby particles
    function drawConnections() {
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 150) {
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    const opacity = (1 - distance / 150) * 0.2;
                    ctx.strokeStyle = `rgba(74, 158, 255, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }
        }
    }

    // Animation loop
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.update();
            particle.draw();
        });

        drawConnections();

        animationFrameId = requestAnimationFrame(animate);
    }

    // Initialize and start animation
    initParticles();
    animate();

    // Cleanup when navigating away
    window.addEventListener('beforeunload', () => {
        cancelAnimationFrame(animationFrameId);
    });
}

// ============================================
// SMOOTH SCROLLING
// ============================================

function scrollToSections() {
    const sectionsElement = document.getElementById('sections');
    if (sectionsElement) {
        sectionsElement.scrollIntoView({ behavior: 'smooth' });
    }
}

// ============================================
// SCROLL ANIMATIONS
// ============================================

function observeElements() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe section cards
    document.querySelectorAll('.section-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Observe approach items
    document.querySelectorAll('.approach-item').forEach(item => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(30px)';
        item.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(item);
    });
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observeElements);
} else {
    observeElements();
}

// ============================================
// NAVBAR SCROLL EFFECT
// ============================================

let lastScroll = window.pageYOffset;
let scrollTicking = false;
const nav = document.querySelector('.main-nav');

function updateNavbar() {
    const currentScroll = window.pageYOffset;

    if (!nav) {
        scrollTicking = false;
        return;
    }

    // Add shadow when scrolled
    if (currentScroll > 50) {
        nav.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.5)';
    } else {
        nav.style.boxShadow = 'none';
    }

    // Keep the navigation visible at the top of every page.
    if (currentScroll <= 0) {
        nav.classList.remove('nav-hidden');
    } else if (currentScroll < lastScroll - 2) {
        nav.classList.remove('nav-hidden');
    } else if (currentScroll > lastScroll + 2) {
        nav.classList.add('nav-hidden');
        if (navLinks && navLinks.classList.contains('active')) {
            navLinks.classList.remove('active');
            if (menuToggle) menuToggle.classList.remove('active');
        }
    }

    lastScroll = currentScroll;
    scrollTicking = false;
}

window.addEventListener('scroll', () => {
    if (!scrollTicking) {
        window.requestAnimationFrame(updateNavbar);
        scrollTicking = true;
    }
}, { passive: true });

// ============================================
// MATHEMATICAL CONSTANTS ANIMATION (Optional Enhancement)
// ============================================

// Add floating mathematical symbols in the background
function createMathSymbols() {
    const symbols = ['π', 'Σ', '∫', '∞', 'θ', 'α', 'β', 'γ', '√', '∆'];
    const hero = document.querySelector('.hero');

    if (!hero) return;

    symbols.forEach((symbol, index) => {
        const span = document.createElement('span');
        span.textContent = symbol;
        span.style.position = 'absolute';
        span.style.fontSize = `${Math.random() * 40 + 20}px`;
        span.style.color = 'rgba(74, 158, 255, 0.1)';
        span.style.left = `${Math.random() * 100}%`;
        span.style.top = `${Math.random() * 100}%`;
        span.style.pointerEvents = 'none';
        span.style.animation = `float ${10 + Math.random() * 10}s ease-in-out infinite`;
        span.style.animationDelay = `${index * 0.5}s`;

        hero.appendChild(span);
    });
}

// Add CSS for float animation
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.05;
        }
        50% {
            transform: translateY(-30px) rotate(180deg);
            opacity: 0.15;
        }
    }
`;
document.head.appendChild(style);

// Initialize math symbols
if (document.querySelector('.hero')) {
    createMathSymbols();
}