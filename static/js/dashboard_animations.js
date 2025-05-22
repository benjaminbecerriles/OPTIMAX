// =============================================
// DASHBOARD ANIMATIONS - JAVASCRIPT SIMPLIFICADO
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    
    // Función para formatear números grandes (definida al inicio)
    function formatLargeNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 100000) {
            return (num / 1000).toFixed(0) + 'K';
        } else {
            return num.toLocaleString('es-MX');
        }
    }
    
    // Inicializar AOS (Animate On Scroll)
    AOS.init({
        duration: 800,
        once: true,
        offset: 50,
        easing: 'ease-out-cubic'
    });

    // =============================================
    // PARTICLES.JS CONFIGURATION
    // =============================================
    if (document.getElementById('particles-js')) {
        particlesJS('particles-js', {
            particles: {
                number: {
                    value: 50,
                    density: {
                        enable: true,
                        value_area: 800
                    }
                },
                color: {
                    value: '#6366f1'
                },
                shape: {
                    type: 'circle'
                },
                opacity: {
                    value: 0.5,
                    random: true,
                    anim: {
                        enable: true,
                        speed: 1,
                        opacity_min: 0.1,
                        sync: false
                    }
                },
                size: {
                    value: 3,
                    random: true,
                    anim: {
                        enable: true,
                        speed: 2,
                        size_min: 0.1,
                        sync: false
                    }
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#6366f1',
                    opacity: 0.2,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 1,
                    direction: 'none',
                    random: false,
                    straight: false,
                    out_mode: 'out',
                    bounce: false
                }
            },
            interactivity: {
                detect_on: 'canvas',
                events: {
                    onhover: {
                        enable: true,
                        mode: 'grab'
                    },
                    onclick: {
                        enable: true,
                        mode: 'push'
                    },
                    resize: true
                },
                modes: {
                    grab: {
                        distance: 140,
                        line_linked: {
                            opacity: 0.5
                        }
                    },
                    push: {
                        particles_nb: 4
                    }
                }
            },
            retina_detect: true
        });
    }

    // =============================================
    // ANIMATED NUMBER COUNTERS
    // =============================================
    
    function animateNumbers() {
        // Buscar todos los elementos con data-value
        const statNumbers = document.querySelectorAll('.stat-number[data-value], .stat-number span[data-value]');
        
        statNumbers.forEach(element => {
            const endValue = parseInt(element.getAttribute('data-value')) || 0;
            const isCurrency = element.getAttribute('data-format') === 'currency';
            
            // Si no hay valor, continuar
            if (isNaN(endValue)) return;
            
            const duration = 2000;
            const startTime = performance.now();
            
            const updateNumber = (currentTime) => {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Easing function
                const easeOutQuart = 1 - Math.pow(1 - progress, 4);
                const currentValue = Math.floor(endValue * easeOutQuart);
                
                // Format number based on size and type
                let formattedValue;
                if (isCurrency && currentValue >= 100000) {
                    formattedValue = formatLargeNumber(currentValue);
                } else {
                    formattedValue = currentValue.toLocaleString('es-MX');
                }
                
                // Update the number
                element.textContent = formattedValue;
                
                if (progress < 1) {
                    requestAnimationFrame(updateNumber);
                }
            };
            
            requestAnimationFrame(updateNumber);
        });
        
        // Log para debug
        console.log('Animating numbers:', {
            totalProductos: window.dashboardData?.totalProductos,
            totalUnidades: window.dashboardData?.totalUnidades,
            valorInventario: window.dashboardData?.valorInventario,
            productosAgotarse: window.dashboardData?.productosAgotarse
        });
    }

    // Iniciar contadores cuando sean visibles
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateNumbers();
                observer.disconnect();
            }
        });
    }, { threshold: 0.5 });

    const statsSection = document.querySelector('.stats-section');
    if (statsSection) {
        observer.observe(statsSection);
    } else {
        // Si no hay observer, ejecutar directamente
        setTimeout(animateNumbers, 100);
    }
    
    // Fallback: Si después de 3 segundos no se han animado los números, mostrarlos directamente
    setTimeout(() => {
        const statNumbers = document.querySelectorAll('.stat-number[data-value], .stat-number span[data-value]');
        statNumbers.forEach(element => {
            const value = parseInt(element.getAttribute('data-value')) || 0;
            const isCurrency = element.getAttribute('data-format') === 'currency';
            
            if (element.textContent === '0' || element.textContent === '') {
                if (isCurrency && value >= 100000) {
                    element.textContent = formatLargeNumber(value);
                } else {
                    element.textContent = value.toLocaleString('es-MX');
                }
            }
        });
    }, 3000);

    // =============================================
    // SIMPLE HOVER ANIMATIONS WITH GSAP
    // =============================================
    
    // Hero title animation
    if (typeof gsap !== 'undefined') {
        gsap.from('.hero-title', {
            y: 30,
            opacity: 0,
            duration: 1,
            ease: 'power3.out'
        });
        
        gsap.from('.hero-description', {
            y: 20,
            opacity: 0,
            duration: 1,
            delay: 0.2,
            ease: 'power3.out'
        });
        
        // Animate title lines
        gsap.from('.title-line', {
            width: 0,
            duration: 0.8,
            delay: 0.5,
            ease: 'power2.out',
            stagger: 0.2
        });
    }

    // =============================================
    // SMOOTH HOVER EFFECTS
    // =============================================
    
    // Tool cards hover effect
    const toolCards = document.querySelectorAll('.tool-card');
    toolCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            const icon = this.querySelector('.tool-icon');
            if (icon) {
                icon.style.transform = 'scale(1.1) rotate(10deg)';
            }
        });
        
        card.addEventListener('mouseleave', function() {
            const icon = this.querySelector('.tool-icon');
            if (icon) {
                icon.style.transform = 'scale(1) rotate(0deg)';
            }
        });
    });

    // Stat cards hover effect (sin iconos)
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-5px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
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
    // RESPONSIVE ADJUSTMENTS
    // =============================================
    function handleResize() {
        const width = window.innerWidth;
        
        // Ajustar tamaño de partículas en móvil
        if (width < 768 && window.pJSDom && window.pJSDom[0]) {
            window.pJSDom[0].pJS.particles.number.value = 30;
            window.pJSDom[0].pJS.fn.particlesRefresh();
        }
    }

    window.addEventListener('resize', handleResize);
    handleResize();

    console.log('Dashboard animations initialized!');
    
    // Debug: Verificar valores del dashboard
    if (window.dashboardData) {
        console.log('Dashboard Data:', window.dashboardData);
        
        // Verificar que los valores en HTML coincidan
        document.querySelectorAll('.stat-number[data-value], .stat-number span[data-value]').forEach(el => {
            console.log('Element data-value:', el.getAttribute('data-value'));
        });
    }
});