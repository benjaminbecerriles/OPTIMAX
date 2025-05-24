// =============================================
// DASHBOARD INVENTORY - Lógica Principal
// Sistema Profesional de Inventario con Lluvia
// =============================================

// Estado global de la lluvia
window.rainState = {
    clickCount: 0,
    lastRainType: null,
    isRainEnabled: true
};

document.addEventListener('DOMContentLoaded', function() {
    // Prevenir scroll horizontal
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.maxWidth = '100vw';
    
    console.log('Dashboard Inventory iniciando...');
    
    // Dar tiempo a que las librerías se carguen
    setTimeout(() => {
        console.log('Inicializando componentes...');
        
        // Inicializar cada componente con verificación
        try {
            initTypedTitle();
        } catch (e) {
            console.error('Error en initTypedTitle:', e);
        }
        
        try {
            initCounters();
        } catch (e) {
            console.error('Error en initCounters:', e);
        }
        
        try {
            initKPICharts();
        } catch (e) {
            console.error('Error en initKPICharts:', e);
        }
        
        try {
            initVanillaTilt();
        } catch (e) {
            console.error('Error en initVanillaTilt:', e);
        }
        
        try {
            initTableInteractions();
        } catch (e) {
            console.error('Error en initTableInteractions:', e);
        }
        
        try {
            initFAB();
        } catch (e) {
            console.error('Error en initFAB:', e);
        }
        
        try {
            initKeyboardShortcuts();
        } catch (e) {
            console.error('Error en initKeyboardShortcuts:', e);
        }
        
        try {
            animateToolsOnScroll();
        } catch (e) {
            console.error('Error en animateToolsOnScroll:', e);
        }
        
        try {
            if (typeof gsap !== 'undefined') {
                initGSAPAnimations();
            }
        } catch (e) {
            console.error('Error en initGSAPAnimations:', e);
        }
        
        // Inicializar sistema de lluvia
        initRainSystem();
        
        // Marcar como cargado
        document.body.classList.add('loaded');
        
        // Inicializar mensajería del robot
        setTimeout(initRobotMessaging, 1000);
        
    }, 1000); // Esperar 1 segundo para asegurar que todo esté cargado
});

// ========== Sistema de Lluvia ==========
function initRainSystem() {
    const warehouse3d = document.getElementById('warehouse3d');
    if (warehouse3d) {
        warehouse3d.classList.add('rain-enabled');
        
        warehouse3d.addEventListener('click', function() {
            window.rainState.clickCount++;
            window.rainState.lastRainType = window.rainState.clickCount % 2 === 1 ? 'candy' : 'strawberry';
            
            console.log('Click #' + window.rainState.clickCount + ' - Lluvia de: ' + window.rainState.lastRainType);
        });
    }
}

// ========== Typed.js para el título ==========
function initTypedTitle() {
    const element = document.getElementById('heroTitle');
    if (!element) {
        console.error('No se encontró el elemento heroTitle');
        return;
    }
    
    const phrases = [
        'Control Total de Inventario',
        'Gestión Inteligente de Stock',
        'Optimización de Productos',
        'Análisis en Tiempo Real',
        'Predicciones con IA Avanzada'
    ];
    
    if (typeof Typed === 'undefined') {
        console.error('Typed.js no está cargado');
        element.textContent = phrases[0];
        return;
    }
    
    console.log('Inicializando Typed.js...');
    
    const typed = new Typed(element, {
        strings: phrases,
        typeSpeed: 50,
        backSpeed: 30,
        backDelay: 2000,
        loop: true,
        showCursor: true,
        cursorChar: '|',
        autoInsertCss: true
    });
    
    console.log('Typed.js inicializado');
}

// ========== Contadores Animados ==========
function initCounters() {
    const counters = document.querySelectorAll('.counter');
    
    console.log('Iniciando contadores, encontrados:', counters.length);
    
    counters.forEach((counter, index) => {
        const target = parseInt(counter.getAttribute('data-target')) || 0;
        console.log(`Contador ${index + 1}: target = ${target}`);
        
        if (counter.textContent !== '0') {
            return;
        }
        
        setTimeout(() => {
            animateCounter(counter);
        }, index * 200);
    });
}

function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target')) || 0;
    const format = element.getAttribute('data-format');
    
    if (target === 0) return;
    
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        
        if (format === 'currency') {
            if (current > 1000000) {
                element.textContent = '$' + (current / 1000000).toFixed(1) + 'M';
            } else if (current > 1000) {
                element.textContent = '$' + (current / 1000).toFixed(1) + 'K';
            } else {
                element.textContent = '$' + Math.floor(current).toLocaleString('es-MX');
            }
        } else {
            element.textContent = Math.floor(current).toLocaleString('es-MX');
        }
    }, 30);
}

function formatNumber(num, format) {
    if (format === 'currency') {
        if (num > 1000000) {
            return '$' + (num / 1000000).toFixed(1) + 'M';
        } else if (num > 1000) {
            return '$' + (num / 1000).toFixed(1) + 'K';
        } else {
            return '$' + num.toLocaleString('es-MX');
        }
    }
    return num.toLocaleString('es-MX');
}

// ========== KPI Charts con ApexCharts ==========
function initKPICharts() {
    if (typeof ApexCharts === 'undefined') {
        console.warn('ApexCharts no está disponible');
        return;
    }
    
    console.log('Inicializando gráficos KPI...');
    
    const chartOptions = {
        chart: {
            type: 'area',
            height: 50,
            sparkline: { enabled: true }
        },
        stroke: { curve: 'smooth', width: 2 },
        fill: { opacity: 0.2 },
        tooltip: { enabled: false }
    };
    
    try {
        const chart1El = document.querySelector("#kpiChart1");
        if (chart1El) {
            new ApexCharts(chart1El, {
                ...chartOptions,
                series: [{ data: [31, 40, 28, 51, 42, 55, 62, 69, 75, 81] }],
                colors: ['#3b82f6']
            }).render();
        }
        
        const chart2El = document.querySelector("#kpiChart2");
        if (chart2El) {
            new ApexCharts(chart2El, {
                ...chartOptions,
                series: [{ data: [15, 25, 35, 30, 45, 50, 55, 65, 60, 70] }],
                colors: ['#10b981']
            }).render();
        }
        
        const chart3El = document.querySelector("#kpiChart3");
        if (chart3El) {
            new ApexCharts(chart3El, {
                ...chartOptions,
                series: [{ data: [100, 120, 115, 134, 145, 160, 165, 170, 185, 195] }],
                colors: ['#8b5cf6']
            }).render();
        }
        
        const chart4El = document.querySelector("#kpiChart4");
        if (chart4El) {
            new ApexCharts(chart4El, {
                ...chartOptions,
                series: [{ data: [12, 15, 11, 9, 7, 5, 8, 6, 4, 3] }],
                colors: ['#f59e0b']
            }).render();
        }
        
        console.log('Gráficos KPI inicializados');
    } catch (error) {
        console.error('Error creando gráficos:', error);
    }
}

// ========== Vanilla Tilt para efecto 3D ==========
function initVanillaTilt() {
    if (typeof VanillaTilt === 'undefined') {
        console.warn('VanillaTilt no está disponible');
        return;
    }
    
    const tiltElements = document.querySelectorAll('[data-tilt]');
    if (tiltElements.length > 0) {
        VanillaTilt.init(tiltElements, {
            max: 5,
            speed: 400,
            glare: true,
            "max-glare": 0.2,
            scale: 1.02
        });
        console.log('VanillaTilt inicializado en', tiltElements.length, 'elementos');
    }
}

// ========== Interacciones de la tabla ==========
function initTableInteractions() {
    const rows = document.querySelectorAll('.product-row');
    rows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.transform = 'translateX(4px)';
            this.style.transition = 'transform 0.2s ease';
        });
        
        row.addEventListener('mouseleave', function() {
            this.style.transform = 'translateX(0)';
        });
    });
    console.log('Interacciones de tabla inicializadas');
}

// ========== Floating Action Button ==========
function initFAB() {
    const fabContainer = document.querySelector('.fab-container');
    const fabButton = document.getElementById('fabButton');
    
    if (fabButton && fabContainer) {
        fabButton.addEventListener('click', function() {
            fabContainer.classList.toggle('active');
        });
        
        document.addEventListener('click', function(e) {
            if (!fabContainer.contains(e.target)) {
                fabContainer.classList.remove('active');
            }
        });
        console.log('FAB inicializado');
    }
}

// ========== Atajos de teclado ==========
function initKeyboardShortcuts() {
    console.log('Atajos de teclado disponibles:');
    console.log('Ctrl+Q: Nuevo Producto | Ctrl+E: Ajuste Stock | Ctrl+G: Precios');
    console.log('Ctrl+B: Descuentos | Ctrl+U: Ubicacion | Ctrl+K: Escanear | Ctrl+L: Buscar');
    
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'q':
                    e.preventDefault();
                    window.location.href = '/nuevo-producto';
                    break;
                case 'e':
                    e.preventDefault();
                    window.location.href = '/ajuste-stock';
                    break;
                case 'g':
                    e.preventDefault();
                    window.location.href = '/cambiar-precios';
                    break;
                case 'b':
                    e.preventDefault();
                    window.location.href = '/descuentos';
                    break;
                case 'u':
                    e.preventDefault();
                    window.location.href = '/ubicacion-productos';
                    break;
                case 'k':
                    e.preventDefault();
                    scanBarcode();
                    break;
                case 'l':
                    e.preventDefault();
                    document.getElementById('productSearch')?.focus();
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ========== Animación para herramientas ==========
function animateToolsOnScroll() {
    const tools = document.querySelectorAll('.tool-card');
    console.log('Herramientas encontradas:', tools.length);
    
    tools.forEach(tool => {
        tool.style.opacity = '1';
        tool.style.transform = 'translateY(0)';
        tool.style.visibility = 'visible';
    });
}

// ========== Animaciones con GSAP ==========
function initGSAPAnimations() {
    if (typeof gsap === 'undefined') {
        console.warn('GSAP no está disponible');
        return;
    }
    
    console.log('Iniciando animaciones GSAP...');
    
    gsap.from('.hero-title', {
        y: 30,
        opacity: 0,
        duration: 1,
        delay: 0.2
    });
    
    gsap.from('.hero-subtitle', {
        y: 20,
        opacity: 0,
        duration: 0.8,
        delay: 0.4
    });
    
    gsap.from('.hero-stat', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        delay: 0.6
    });
    
    gsap.from('#warehouse3d', {
        scale: 0.9,
        opacity: 0,
        duration: 1,
        delay: 0.8
    });
    
    gsap.from('.tool-card', {
        y: 30,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1,
        delay: 1
    });
    
    console.log('Animaciones GSAP completadas');
}

// ========== Funciones de utilidad ==========
window.viewProduct = function(id) {
    console.log(`Ver producto ${id}`);
    showNotification('Abriendo detalles del producto...', 'info');
};

window.editProduct = function(id) {
    console.log(`Editar producto ${id}`);
    window.location.href = `/editar-producto/${id}`;
};

window.viewHistory = function(id) {
    console.log(`Ver historial del producto ${id}`);
    showNotification('Cargando historial...', 'info');
};

window.orderProduct = function(id) {
    console.log(`Ordenar producto ${id}`);
    showNotification('Pedido iniciado', 'success');
};

window.scanBarcode = function() {
    console.log('Iniciando escáner de código de barras');
    showNotification('Escáner no disponible en este dispositivo', 'warning');
};

window.quickEntry = function() {
    console.log('Entrada rápida de stock');
    showNotification('Abriendo entrada rápida...', 'info');
};

window.openTransferModal = function() {
    console.log('Abrir modal de transferencias');
    showNotification('Función en desarrollo', 'info');
};

window.viewAllAlerts = function(type) {
    console.log(`Ver todas las alertas de tipo: ${type}`);
    window.location.href = `/alertas?tipo=${type}`;
};

window.viewAllActivity = function() {
    console.log('Ver toda la actividad');
    window.location.href = '/actividad';
};

window.showShortcutsInfo = function() {
    const shortcuts = `
        <div style="font-size: 14px; line-height: 1.8;">
            <strong>Atajos de Teclado Disponibles:</strong><br>
            <span style="color: #10b981;">Ctrl+Q</span> → Nuevo Producto<br>
            <span style="color: #8b5cf6;">Ctrl+E</span> → Ajuste de Stock<br>
            <span style="color: #3b82f6;">Ctrl+G</span> → Cambiar Precios<br>
            <span style="color: #06b6d4;">Ctrl+B</span> → Descuentos<br>
            <span style="color: #ec4899;">Ctrl+U</span> → Ubicación<br>
            <span style="color: #f59e0b;">Ctrl+K</span> → Escanear<br>
            <span style="color: #10b981;">Ctrl+L</span> → Buscar<br>
            <span style="color: #64748b;">ESC</span> → Cerrar ventanas
        </div>
    `;
    
    showNotification(shortcuts, 'info', 5000);
};

// ========== Sistema de notificaciones ==========
function showNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

function getNotificationIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || icons.info;
}

function closeAllModals() {
    document.querySelector('.fab-container')?.classList.remove('active');
}

// ========== Sistema de Frases del Robot ==========
const robotPhrases = {
    morning: [
        "¡Buenos días! Tu inventario está listo para un gran día",
        "¡Arriba! Tienes {total_productos} productos esperando gestión",
        "Buenos días, {stock_critico} productos necesitan tu atención",
        "¡Madrugador! El inventario está al {porcentaje_optimo}% de capacidad"
    ],
    tips: [
        "¿Sabías que los viernes se venden 40% más bebidas?",
        "Tu producto más rentable es {producto_top}",
        "Tip: Coloca {categoria} cerca de la caja para más ventas",
        "Los productos a la altura de los ojos se venden 35% más"
    ],
    tricks: [
        "¡Ta-dá! ¿Te gustó mi lluvia de dulces?",
        "¡Mira cómo llueven los caramelos!",
        "¿Viste eso? ¡Soy todo un mago!",
        "¡Weee! Me encanta hacer esto"
    ]
};

function getRobotPhrase(context = 'general', data = {}) {
    const hour = new Date().getHours();
    let category;
    
    if (context === 'greeting') {
        if (hour >= 5 && hour < 12) category = 'morning';
        else category = 'tips';
    } else {
        category = context;
    }
    
    const phrases = robotPhrases[category] || robotPhrases.tips;
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    let finalPhrase = phrase;
    Object.keys(data).forEach(key => {
        finalPhrase = finalPhrase.replace(`{${key}}`, data[key]);
    });
    
    return finalPhrase;
}

function initRobotMessaging() {
    if (!document.getElementById('robot-message-container')) {
        const container = document.createElement('div');
        container.id = 'robot-message-container';
        container.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 20px;
            z-index: 1000;
            max-width: 350px;
        `;
        document.body.appendChild(container);
    }
    
    window.addEventListener('robot-message', function(e) {
        showRobotBubble(e.detail.message, e.detail.type);
    });
    
    setTimeout(() => {
        const greeting = getRobotPhrase('greeting');
        if (window.OptiBot3D && window.OptiBot3D.loaded()) {
            window.OptiBot3D.showMessage(greeting, 'success');
        }
    }, 3000);
}

function showRobotBubble(message, type = 'info') {
    const container = document.getElementById('robot-message-container');
    
    const bubble = document.createElement('div');
    bubble.className = `robot-bubble ${type}`;
    bubble.innerHTML = `
        <div class="bubble-tail"></div>
        <div class="bubble-content">
            <div class="bubble-text">${message}</div>
            <div class="bubble-time">${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;
    
    bubble.style.cssText = `
        background: white;
        border-radius: 20px;
        padding: 12px 16px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        position: relative;
        animation: bubbleIn 0.3s ease-out;
        border: 2px solid ${type === 'happy' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    `;
    
    container.appendChild(bubble);
    
    setTimeout(() => {
        bubble.style.animation = 'bubbleOut 0.3s ease-in';
        setTimeout(() => bubble.remove(), 300);
    }, 5000);
}

// ========== Estilos para notificaciones ==========
const style = document.createElement('style');
style.textContent = `
.notification {
    position: fixed;
    top: 2rem;
    right: 2rem;
    background: white;
    padding: 1rem 1.5rem;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    transform: translateX(400px);
    transition: transform 0.3s ease;
    z-index: 1000;
    max-width: 400px;
}

.notification.show {
    transform: translateX(0);
}

.notification-success { border-left: 4px solid #10b981; }
.notification-success i { color: #10b981; }
.notification-error { border-left: 4px solid #ef4444; }
.notification-error i { color: #ef4444; }
.notification-warning { border-left: 4px solid #f59e0b; }
.notification-warning i { color: #f59e0b; }
.notification-info { border-left: 4px solid #3b82f6; }
.notification-info i { color: #3b82f6; }

#warehouse3d.rain-enabled {
    cursor: pointer;
    position: relative;
}

#warehouse3d.rain-enabled::after {
    content: 'Click para lluvia mágica';
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.75rem;
    opacity: 0;
    transition: opacity 0.3s ease;
    pointer-events: none;
}

#warehouse3d.rain-enabled:hover::after {
    opacity: 1;
}
`;

document.head.appendChild(style);

console.log('Dashboard Inventory con sistema de lluvia inicializado!');
console.log('Click en el robot para activar lluvia de dulces');