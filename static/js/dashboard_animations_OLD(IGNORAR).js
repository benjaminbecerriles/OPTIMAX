// =============================================
// DASHBOARD ANIMATIONS - VERSIÓN OPTIMIZADA
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Función para formatear números grandes
    function formatLargeNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 100000) {
            return (num / 1000).toFixed(0) + 'K';
        } else {
            return num.toLocaleString('es-MX');
        }
    }
    
    // Inicializar AOS (si está disponible)
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 600,
            once: true,
            offset: 30,
            easing: 'ease-out-cubic'
        });
    }

    // =============================================
    // ANIMATED NUMBER COUNTERS OPTIMIZADO
    // =============================================
    
    function animateNumbers() {
        const statNumbers = document.querySelectorAll('.stat-number[data-value], .stat-number span[data-value]');
        
        statNumbers.forEach(element => {
            const endValue = parseInt(element.getAttribute('data-value')) || 0;
            const isCurrency = element.getAttribute('data-format') === 'currency';
            
            if (isNaN(endValue)) return;
            
            const duration = 1500; // Optimizado
            const startTime = performance.now();
            
            const updateNumber = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function suave
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const currentValue = Math.floor(endValue * easeOutQuart);
                
                let formattedValue;
                if (isCurrency && currentValue >= 100000) {
                    formattedValue = formatLargeNumber(currentValue);
                } else {
                    formattedValue = currentValue.toLocaleString('es-MX');
                }
                
                element.textContent = formattedValue;
                
                if (progress < 1) {
                    requestAnimationFrame(updateNumber);
                }
            };
            
            requestAnimationFrame(updateNumber);
        });
    }

    // Iniciar contadores con delay corto
    setTimeout(animateNumbers, 200);

    // =============================================
    // GSAP ANIMATIONS (optimizadas)
    // =============================================
    
    if (typeof gsap !== 'undefined') {
        // Timeline para mejor control
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        
        tl.from('.hero-title', {
            y: 30,
            opacity: 0,
            duration: 0.8
        })
        .from('.hero-description', {
            y: 20,
            opacity: 0,
            duration: 0.8
        }, '-=0.4')
        .from('.title-line', {
            width: 0,
            duration: 0.6,
            stagger: 0.2
        }, '-=0.2');
    }

    // =============================================
    // HOVER EFFECTS CON THROTTLING
    // =============================================
    
    let isHovering = false;
    
    // Tool cards hover effect
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        card.addEventListener('mouseenter', function(e) {
            if (!isHovering) {
                isHovering = true;
                const icon = this.querySelector('.tool-icon');
                if (icon) {
                    gsap.to(icon, {
                        scale: 1.1,
                        rotation: 10,
                        duration: 0.3,
                        ease: 'power2.out'
                    });
                }
                gsap.to(this, {
                    y: -5,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            }
        });
        
        card.addEventListener('mouseleave', function() {
            isHovering = false;
            const icon = this.querySelector('.tool-icon');
            if (icon) {
                gsap.to(icon, {
                    scale: 1,
                    rotation: 0,
                    duration: 0.3,
                    ease: 'power2.out'
                });
            }
            gsap.to(this, {
                y: 0,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });

    // Stat cards hover effect
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            gsap.to(this, {
                y: -5,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
        
        card.addEventListener('mouseleave', function() {
            gsap.to(this, {
                y: 0,
                duration: 0.3,
                ease: 'power2.out'
            });
        });
    });

    // =============================================
    // SMOOTH SCROLL OPTIMIZADO
    // =============================================
    
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href !== '#') {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });

    // =============================================
    // RIPPLE EFFECT (optimizado)
    // =============================================
    
    document.querySelectorAll('.quick-link-item, .promo-btn, .view-all-btn').forEach(element => {
        element.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.cssText = `
                position: absolute;
                width: ${size}px;
                height: ${size}px;
                left: ${x}px;
                top: ${y}px;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                transform: scale(0);
                animation: ripple-effect 0.6s ease-out;
                pointer-events: none;
            `;
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => ripple.remove(), 600);
        });
    });

    // =============================================
    // TABLE ROW HOVER
    // =============================================
    
    const tableRows = document.querySelectorAll('.products-table tbody tr');
    tableRows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
        });
        
        row.addEventListener('mouseleave', function() {
            this.style.backgroundColor = 'transparent';
        });
    });

    // =============================================
    // KEYBOARD SHORTCUTS
    // =============================================
    
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + N para nuevo producto
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            window.location.href = '/nuevo-producto';
        }
    });

    // =============================================
    // PERFORMANCE OPTIMIZATION
    // =============================================
    
    // Reducir animaciones si hay lag
    let fps = 60;
    let lastTime = performance.now();
    let frameCount = 0;
    
    function checkPerformance() {
        frameCount++;
        const currentTime = performance.now();
        
        if (currentTime >= lastTime + 1000) {
            fps = frameCount;
            frameCount = 0;
            lastTime = currentTime;
            
            // Si FPS es bajo, reducir efectos
            if (fps < 30) {
                document.body.classList.add('reduce-motion');
            }
        }
        
        requestAnimationFrame(checkPerformance);
    }
    
    // Iniciar monitoreo de performance
    requestAnimationFrame(checkPerformance);

    console.log('Dashboard animations initialized!');
});

// =============================================
// CSS PARA RIPPLE EFFECT
// =============================================

const style = document.createElement('style');
style.textContent = `
    @keyframes ripple-effect {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
    
    .reduce-motion * {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
    
    .stat-card {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    
    .tool-card {
        transition: transform 0.3s ease;
    }
    
    .tool-icon {
        transition: transform 0.3s ease;
    }
`;

document.head.appendChild(style);