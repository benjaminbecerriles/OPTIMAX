// =============================================
// DASHBOARD INVENTORY - Lógica Principal
// Sistema Profesional de Inventario
// =============================================

document.addEventListener('DOMContentLoaded', function() {
    // Prevenir scroll horizontal
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    document.body.style.maxWidth = '100vw';
    
    // Inicializar componentes
    initTypedTitle();
    initCounters();
    initKPICharts();
    initVanillaTilt();
    initTableInteractions();
    initFAB();
    initKeyboardShortcuts();
    animateToolsOnScroll();
    
    // Marcar como cargado para animaciones CSS
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
});

// ========== Typed.js para el título ==========
function initTypedTitle() {
    const element = document.getElementById('heroTitle');
    if (!element) return;
    
    // Frases optimizadas para mejor ajuste visual
    const phrases = [
        'Control Total de Inventario',
        'Gestión Inteligente de Stock',
        'Optimización de Productos',
        'Análisis en Tiempo Real',
        'Predicciones con IA Avanzada'
    ];
    
    new Typed(element, {
        strings: phrases,
        typeSpeed: 50,
        backSpeed: 30,
        backDelay: 2000,
        loop: true,
        showCursor: false,
        contentType: 'html',
        onStringTyped: function() {
            // Asegurar que el cursor esté siempre bien posicionado
            const cursor = document.querySelector('.cursor');
            if (cursor) {
                cursor.style.display = 'inline-block';
            }
        },
        preStringTyped: function() {
            // Ocultar el cursor durante el borrado
            const cursor = document.querySelector('.cursor');
            if (cursor) {
                cursor.style.opacity = '1';
            }
        }
    });
}

// ========== Contadores Animados ==========
function initCounters() {
    const counters = document.querySelectorAll('.counter');
    
    const observerOptions = {
        threshold: 0.5,
        rootMargin: '0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                entry.target.classList.add('counted');
                animateCounter(entry.target);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target')) || 0;
    const format = element.getAttribute('data-format');
    const duration = 800; // Reducido de 2000 a 800ms
    const step = target / (duration / 16);
    let current = 0;
    
    const updateCounter = () => {
        current += step;
        
        if (current < target) {
            element.textContent = formatNumber(Math.floor(current), format);
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = formatNumber(target, format);
        }
    };
    
    updateCounter();
}

function formatNumber(num, format) {
    if (format === 'currency' && num > 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (format === 'currency' && num > 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString('es-MX');
}

// ========== KPI Charts con ApexCharts ==========
function initKPICharts() {
    const chartOptions = {
        chart: {
            type: 'area',
            height: 50,
            sparkline: { enabled: true },
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 1000
            }
        },
        stroke: {
            curve: 'smooth',
            width: 2
        },
        fill: {
            opacity: 0.2
        },
        tooltip: { enabled: false }
    };
    
    // Chart 1 - Total Productos
    if (document.querySelector("#kpiChart1")) {
        const chart1 = new ApexCharts(document.querySelector("#kpiChart1"), {
            ...chartOptions,
            series: [{
                data: [31, 40, 28, 51, 42, 55, 62, 69, 75, 81]
            }],
            colors: ['#3b82f6']
        });
        chart1.render();
    }
    
    // Chart 2 - Stock
    if (document.querySelector("#kpiChart2")) {
        const chart2 = new ApexCharts(document.querySelector("#kpiChart2"), {
            ...chartOptions,
            series: [{
                data: [15, 25, 35, 30, 45, 50, 55, 65, 60, 70]
            }],
            colors: ['#10b981']
        });
        chart2.render();
    }
    
    // Chart 3 - Valor
    if (document.querySelector("#kpiChart3")) {
        const chart3 = new ApexCharts(document.querySelector("#kpiChart3"), {
            ...chartOptions,
            series: [{
                data: [100, 120, 115, 134, 145, 160, 165, 170, 185, 195]
            }],
            colors: ['#8b5cf6']
        });
        chart3.render();
    }
    
    // Chart 4 - Críticos
    if (document.querySelector("#kpiChart4")) {
        const chart4 = new ApexCharts(document.querySelector("#kpiChart4"), {
            ...chartOptions,
            series: [{
                data: [12, 15, 11, 9, 7, 5, 8, 6, 4, 3]
            }],
            colors: ['#f59e0b']
        });
        chart4.render();
    }
}

// ========== Vanilla Tilt para efecto 3D ==========
function initVanillaTilt() {
    const tiltElements = document.querySelectorAll('[data-tilt]');
    
    VanillaTilt.init(tiltElements, {
        max: 5,
        speed: 400,
        glare: true,
        "max-glare": 0.2,
        scale: 1.02
    });
}

// ========== Interacciones de la tabla ==========
function initTableInteractions() {
    // Ordenamiento
    const sortableHeaders = document.querySelectorAll('.sortable');
    let currentSort = { column: null, direction: 'asc' };
    
    sortableHeaders.forEach(header => {
        header.addEventListener('click', function() {
            const column = this.getAttribute('data-sort');
            
            // Cambiar dirección si es la misma columna
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            
            // Actualizar iconos
            sortableHeaders.forEach(h => {
                h.querySelector('i').className = 'fas fa-sort';
            });
            
            const icon = this.querySelector('i');
            icon.className = currentSort.direction === 'asc' ? 
                'fas fa-sort-up' : 'fas fa-sort-down';
            
            // Aquí iría la lógica de ordenamiento real
            console.log(`Ordenando por ${column} ${currentSort.direction}`);
        });
    });
    
    // Hover en filas
    const rows = document.querySelectorAll('.product-row');
    rows.forEach(row => {
        row.addEventListener('mouseenter', function() {
            this.style.transform = 'scale(1.01)';
        });
        
        row.addEventListener('mouseleave', function() {
            this.style.transform = 'scale(1)';
        });
    });
}

// ========== Floating Action Button ==========
function initFAB() {
    const fabContainer = document.querySelector('.fab-container');
    const fabButton = document.getElementById('fabButton');
    
    if (fabButton) {
        fabButton.addEventListener('click', function() {
            fabContainer.classList.toggle('active');
        });
        
        // Cerrar al hacer click fuera
        document.addEventListener('click', function(e) {
            if (!fabContainer.contains(e.target)) {
                fabContainer.classList.remove('active');
            }
        });
    }
}

// ========== Atajos de teclado ==========
function initKeyboardShortcuts() {
    // Mostrar información sobre atajos al cargar
    console.log('🎯 Atajos de teclado disponibles:');
    console.log('Ctrl+Q: Nuevo Producto | Ctrl+E: Ajuste Stock | Ctrl+G: Precios');
    console.log('Ctrl+B: Descuentos | Ctrl+U: Ubicación | Ctrl+K: Escanear | Ctrl+L: Buscar');
    
    document.addEventListener('keydown', function(e) {
        // Ctrl + tecla (evitando conflictos con navegador)
        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'q': // Registrar producto
                    e.preventDefault();
                    window.location.href = '/nuevo-producto';
                    break;
                case 'e': // Ajuste de stock
                    e.preventDefault();
                    window.location.href = '/ajuste-stock';
                    break;
                case 'g': // Cambiar precios
                    e.preventDefault();
                    window.location.href = '/cambiar-precios';
                    break;
                case 'b': // Descuentos
                    e.preventDefault();
                    window.location.href = '/descuentos';
                    break;
                case 'u': // Ubicación
                    e.preventDefault();
                    window.location.href = '/ubicacion-productos';
                    break;
                case 'k': // Escanear (K de sKan para evitar conflicto con Ctrl+S)
                    e.preventDefault();
                    scanBarcode();
                    break;
                case 'l': // Buscar (L de Look para evitar conflicto con Ctrl+F)
                    e.preventDefault();
                    document.getElementById('productSearch')?.focus();
                    break;
            }
        }
        
        // Escape para cerrar modales
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}

// ========== Animación mejorada para herramientas ==========
function animateToolsOnScroll() {
    const tools = document.querySelectorAll('.tool-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.animation = 'toolPop 0.5s ease forwards';
                }, index * 50);
            }
        });
    }, { threshold: 0.5 });
    
    tools.forEach(tool => observer.observe(tool));
}

// Añadir animación al CSS
const toolAnimation = `
@keyframes toolPop {
    from {
        opacity: 0;
        transform: scale(0.8) translateY(20px);
    }
    to {
        opacity: 1;
        transform: scale(1) translateY(0);
    }
}
`;

// Inyectar la animación
const styleSheet = document.createElement('style');
styleSheet.textContent = toolAnimation;
document.head.appendChild(styleSheet);

// ========== Funciones de utilidad ==========
window.viewProduct = function(id) {
    console.log(`Ver producto ${id}`);
    // Aquí iría la lógica para mostrar detalles del producto
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
    
    // Animación de entrada
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Remover después del tiempo especificado
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
    // Cerrar FAB
    document.querySelector('.fab-container')?.classList.remove('active');
    
    // Aquí se cerrarían otros modales si los hubiera
}

// ========== Sistema de Frases del Robot ==========
const robotPhrases = {
    // Saludos según hora
    morning: [
        "¡Buenos días! 📊 Tu inventario está listo para un gran día",
        "¡Arriba! Tienes {total_productos} productos esperando gestión",
        "Buenos días, {stock_critico} productos necesitan tu atención",
        "¡Madrugador! El inventario está al {porcentaje_optimo}% de capacidad"
    ],
    afternoon: [
        "¡Buenas tardes! Has movido {productos_vendidos} productos hoy",
        "La gestión va excelente, {porcentaje_vendido}% del objetivo diario",
        "Esta tarde tu inventario vale ${valor_inventario}",
        "¿Todo bajo control? Tienes {alertas} alertas pendientes"
    ],
    evening: [
        "¡Gran día de gestión! {movimientos} movimientos registrados",
        "Casi es hora de cerrar, ¿revisamos los críticos?",
        "Tu inventario creció {crecimiento}% hoy 📈",
        "Excelente trabajo, mañana será otro día productivo"
    ],
    
    // Estados del inventario
    stock_ok: [
        "Tu inventario está en perfectas condiciones ✅",
        "Todo en orden por aquí, ¡sigue así! 👍",
        "Stock optimizado al 95%, eres un pro 🌟",
        "Me encanta cuando todo está organizado así"
    ],
    stock_low: [
        "¡Alerta! {categoria} está en zona crítica 🚨",
        "Psst... solo quedan {cantidad} de {producto}",
        "Hora de llamar a tu proveedor de {categoria} 📞",
        "¡Cuidado! {producto} se agota rápidamente"
    ],
    stock_empty: [
        "¡Oh no! Se acabó {producto} completamente 😱",
        "Cliente preguntando por {producto}... y no hay 😅",
        "Urgente: reabastecer {categoria} YA",
        "Houston, tenemos un problema con {producto} 🚀"
    ],
    
    // Actividad
    high_sales: [
        "¡WOW! {ventas} ventas en la última hora 🚀",
        "¡Esto está que arde! Nuevo récord de ventas 🔥",
        "¡{producto} está volando de los estantes!",
        "A este ritmo necesitarás más stock pronto 📈"
    ],
    low_sales: [
        "Hmm... {producto} lleva 3 días sin venderse 🤔",
        "¿Qué tal una promoción para mover {categoria}?",
        "Las ventas están tranquilas, perfecto para organizar 🧹",
        "Momento ideal para revisar precios competitivos"
    ],
    
    // Tips y datos
    tips: [
        "¿Sabías que los viernes se venden 40% más bebidas? 🥤",
        "Tu producto más rentable es {producto_top} 💰",
        "Tip: Coloca {categoria} cerca de la caja para más ventas",
        "Los productos a la altura de los ojos se venden 35% más",
        "¿Ya revisaste las fechas de caducidad esta semana?",
        "Recuerda: First In, First Out (FIFO) 📦"
    ],
    
    // Motivacionales
    motivation: [
        "¡Vas excelente! 20% más ventas que ayer 📊",
        "Tu tienda es la más organizada que he visto 🏆",
        "¡Esa última venta estuvo increíble! 🎯",
        "Me encanta trabajar contigo, ¡hacemos buen equipo!",
        "¡Sigue así y romperás tu récord mensual! 💪"
    ],
    
    // Especiales (cuando hace trucos)
    tricks: [
        "¡Ta-dá! ¿Te gustó mi truco? 🎩",
        "¡Mira cómo giro este {producto}! 🌀",
        "¿Viste eso? ¡Soy todo un malabarista! 🤹",
        "¡Weee! Me encanta hacer esto 🎪"
    ]
};

// Obtener frase contextual
function getRobotPhrase(context = 'general', data = {}) {
    const hour = new Date().getHours();
    let category;
    
    // Determinar categoría por hora si no se especifica
    if (context === 'greeting') {
        if (hour >= 5 && hour < 12) category = 'morning';
        else if (hour >= 12 && hour < 19) category = 'afternoon';
        else category = 'evening';
    } else {
        category = context;
    }
    
    // Obtener frases de la categoría
    const phrases = robotPhrases[category] || robotPhrases.tips;
    const phrase = phrases[Math.floor(Math.random() * phrases.length)];
    
    // Reemplazar variables en la frase
    let finalPhrase = phrase;
    Object.keys(data).forEach(key => {
        finalPhrase = finalPhrase.replace(`{${key}}`, data[key]);
    });
    
    return finalPhrase;
}

// Inicializar sistema de mensajes del robot
function initRobotMessaging() {
    // Crear contenedor de mensajes si no existe
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
    
    // Escuchar mensajes del robot
    window.addEventListener('robot-message', function(e) {
        showRobotBubble(e.detail.message, e.detail.type);
    });
    
    // Mensaje de bienvenida
    setTimeout(() => {
        const greeting = getRobotPhrase('greeting');
        if (window.OptiBot3D && window.OptiBot3D.loaded()) {
            window.OptiBot3D.showMessage(greeting, 'success');
        }
    }, 3000); // Esperar más para que cargue el modelo 3D
    
    // Mensajes periódicos basados en datos
    setInterval(() => {
        checkInventoryAndNotify();
    }, 30000); // Cada 30 segundos
}

// Mostrar burbuja de mensaje
function showRobotBubble(message, type = 'info') {
    const container = document.getElementById('robot-message-container');
    
    // Crear burbuja
    const bubble = document.createElement('div');
    bubble.className = `robot-bubble ${type}`;
    bubble.innerHTML = `
        <div class="bubble-tail"></div>
        <div class="bubble-content">
            <div class="bubble-text">${message}</div>
            <div class="bubble-time">${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;
    
    // Estilos de la burbuja
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
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        bubble.style.animation = 'bubbleOut 0.3s ease-in';
        setTimeout(() => bubble.remove(), 300);
    }, 5000);
}

// Verificar inventario y notificar
function checkInventoryAndNotify() {
    // Obtener datos del dashboard
    const stockCritico = document.querySelectorAll('.stock-value.critical').length;
    const ventasHoy = parseInt(document.querySelector('.hero-stat .stat-value')?.textContent) || 0;
    
    // Actualizar mood del robot
    if (window.OptiBot3D && window.OptiBot3D.loaded()) {
        window.OptiBot3D.setMood(stockCritico > 3 ? 'worried' : 'happy');
    }
    
    // Generar mensaje contextual
    if (stockCritico > 3) {
        const producto = document.querySelector('.stock-value.critical')?.closest('tr')?.querySelector('.product-name')?.textContent || 'varios productos';
        const phrase = getRobotPhrase('stock_low', {
            producto: producto,
            cantidad: stockCritico
        });
        
        if (window.OptiBot3D && window.OptiBot3D.loaded()) {
            window.OptiBot3D.showMessage(phrase, 'warning');
        }
    } else if (Math.random() > 0.7) {
        // 30% de probabilidad de dar un tip aleatorio
        const phrase = getRobotPhrase('tips', {
            producto_top: 'Coca Cola 600ml' // Ejemplo
        });
        
        if (window.OptiBot3D && window.OptiBot3D.loaded()) {
            window.OptiBot3D.showMessage(phrase, 'info');
        }
    }
}

// ========== Animaciones con GSAP ==========
if (typeof gsap !== 'undefined') {
    // Timeline principal
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    
    // Animar elementos del hero
    tl.from('.hero-title', {
        y: 30,
        opacity: 0,
        duration: 0.8
    })
    .from('.hero-subtitle', {
        y: 20,
        opacity: 0,
        duration: 0.8
    }, '-=0.4')
    .from('.hero-stat', {
        y: 20,
        opacity: 0,
        duration: 0.6,
        stagger: 0.1
    }, '-=0.4');
    
    // Animar herramientas al scroll
    gsap.utils.toArray('.tool-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top bottom-=100',
                toggleActions: 'play none none reverse'
            },
            y: 30,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.1
        });
    });
}

// Inicializar mensajería del robot
initRobotMessaging();

// ========== Optimización de Performance ==========
// Throttle para eventos frecuentes
function throttle(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Lazy loading para imágenes
const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            img.src = img.dataset.src;
            img.classList.add('loaded');
            imageObserver.unobserve(img);
        }
    });
});

document.querySelectorAll('img[data-src]').forEach(img => {
    imageObserver.observe(img);
});

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

.notification-success {
    border-left: 4px solid #10b981;
}

.notification-success i {
    color: #10b981;
}

.notification-error {
    border-left: 4px solid #ef4444;
}

.notification-error i {
    color: #ef4444;
}

.notification-warning {
    border-left: 4px solid #f59e0b;
}

.notification-warning i {
    color: #f59e0b;
}

.notification-info {
    border-left: 4px solid #3b82f6;
}

.notification-info i {
    color: #3b82f6;
    flex-shrink: 0;
    margin-top: 2px;
}

/* Animación de carga para acciones */
.loading-spinner {
    display: inline-block;
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.notification strong {
    display: block;
    margin-bottom: 8px;
    font-size: 16px;
}

.notification span > span {
    font-family: 'SF Mono', Monaco, monospace;
    font-weight: 600;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}
`;

document.head.appendChild(style);

console.log('Dashboard Inventory inicializado correctamente! 🚀');