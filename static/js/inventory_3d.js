// =============================================
// OPTIMAX ROBOT 3D - OptiBot Assistant
// =============================================

let scene, camera, renderer;
let robot, currentProduct;
let mouseX = 0, mouseY = 0;
let targetRotationX = 0, targetRotationY = 0;
let windowHalfX = window.innerWidth / 2;
let windowHalfY = window.innerHeight / 2;

// Variable global para controlar rotación
window.isRotating = true;

// Estado del robot
let robotState = {
    mood: 'happy', // happy, worried, sleeping, celebrating, thinking
    currentCategory: 0,
    lastActivity: Date.now(),
    blinkTimer: 0,
    productRotationTimer: 0,
    isFollowingMouse: true
};

// Productos 3D por categoría
const CATEGORY_PRODUCTS = {
    "abarrotes secos": { emoji: "🌾", color: "#FFA500", name: "Arroz" },
    "enlatados y conservas": { emoji: "🥫", color: "#DAA520", name: "Lata de frijoles" },
    "botanas, dulces y snacks": { emoji: "🍿", color: "#FF69B4", name: "Papitas" },
    "bebidas no alcohólicas": { emoji: "🥤", color: "#1E90FF", name: "Refresco" },
    "bebidas alcohólicas": { emoji: "🍺", color: "#800080", name: "Cerveza" },
    "panadería y repostería": { emoji: "🍞", color: "#D2B48C", name: "Pan dulce" },
    "lácteos y huevos": { emoji: "🥛", color: "#F5DEB3", name: "Leche" },
    "carnes frías y embutidos": { emoji: "🍖", color: "#B22222", name: "Jamón" },
    "congelados y refrigerados": { emoji: "🧊", color: "#00CED1", name: "Helado" },
    "frutas y verduras frescas": { emoji: "🍎", color: "#32CD32", name: "Manzana" },
    "productos de limpieza y hogar": { emoji: "🧹", color: "#87CEFA", name: "Detergente" },
    "cuidado personal e higiene": { emoji: "🧴", color: "#FFC0CB", name: "Shampoo" },
    "medicamentos de mostrador (otc)": { emoji: "💊", color: "#FF6347", name: "Aspirinas" },
    "productos para bebés": { emoji: "🍼", color: "#FFB6C1", name: "Pañales" },
    "productos para mascotas": { emoji: "🐕", color: "#8FBC8F", name: "Croquetas" },
    "artículos de papelería": { emoji: "✏️", color: "#9370DB", name: "Cuadernos" },
    "ferretería básica": { emoji: "🔨", color: "#708090", name: "Martillo" },
    "artesanías y manualidades": { emoji: "🎨", color: "#DDA0DD", name: "Pinturas" },
    "productos a granel": { emoji: "🌾", color: "#BDB76B", name: "Frijol" },
    "productos orgánicos": { emoji: "🥬", color: "#6B8E23", name: "Lechuga orgánica" },
    "productos gourmet": { emoji: "🍯", color: "#CD853F", name: "Miel artesanal" },
    "suplementos alimenticios": { emoji: "💪", color: "#DA70D6", name: "Proteína" },
    "otros (miscelánea)": { emoji: "📦", color: "#A9A9A9", name: "Varios" }
};

// Configuración
const config = {
    robotColor: '#10b981',
    robotAccent: '#0f172a',
    animationSpeed: 0.001,
    blinkInterval: 3000,
    productChangeInterval: 8000,
    sleepTimeout: 30000
};

// Inicializar OptiBot
function initOptiBot() {
    const container = document.getElementById('warehouse3d');
    if (!container) return;
    
    // Limpiar loading
    container.innerHTML = '';
    
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    
    // Configurar cámara
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 0, 15);
    camera.lookAt(0, 0, 0);
    
    // Configurar renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    
    // Iluminación
    setupLighting();
    
    // Crear robot
    createRobot();
    
    // Crear producto inicial
    changeProduct();
    
    // Agregar interactividad
    setupInteractivity();
    
    // Iniciar animación
    animate();
    
    // Iniciar timers
    startTimers();
    
    // Manejar resize
    window.addEventListener('resize', onWindowResize, false);
}

// Configurar iluminación
function setupLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Luz direccional principal
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);
    
    // Luz de relleno
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
}

// Crear el robot
function createRobot() {
    robot = new THREE.Group();
    
    // Base flotante
    const baseGeometry = new THREE.CylinderGeometry(1.5, 1.8, 0.3, 32);
    const baseMaterial = new THREE.MeshPhongMaterial({ 
        color: config.robotAccent,
        emissive: config.robotAccent,
        emissiveIntensity: 0.1
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -3;
    base.castShadow = true;
    robot.add(base);
    
    // Cuerpo
    const bodyGeometry = new THREE.BoxGeometry(2.5, 3, 2);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
        color: config.robotColor,
        emissive: config.robotColor,
        emissiveIntensity: 0.1
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = -1;
    body.castShadow = true;
    robot.add(body);
    
    // Cabeza
    const headGroup = new THREE.Group();
    headGroup.position.y = 1.5;
    
    const headGeometry = new THREE.BoxGeometry(3, 2.5, 2.5);
    const headMaterial = new THREE.MeshPhongMaterial({ 
        color: config.robotColor
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.castShadow = true;
    headGroup.add(head);
    
    // Ojos
    const eyeGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const eyeMaterial = new THREE.MeshPhongMaterial({ 
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.5
    });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.6, 0.3, 1.3);
    headGroup.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.6, 0.3, 1.3);
    headGroup.add(rightEye);
    
    // Párpados (para parpadear)
    const eyelidGeometry = new THREE.BoxGeometry(0.4, 0.1, 0.1);
    const eyelidMaterial = new THREE.MeshPhongMaterial({ 
        color: config.robotColor
    });
    
    const leftEyelid = new THREE.Mesh(eyelidGeometry, eyelidMaterial);
    leftEyelid.position.set(-0.6, 0.3, 1.35);
    leftEyelid.scale.y = 0;
    headGroup.add(leftEyelid);
    robot.leftEyelid = leftEyelid;
    
    const rightEyelid = new THREE.Mesh(eyelidGeometry, eyelidMaterial);
    rightEyelid.position.set(0.6, 0.3, 1.35);
    rightEyelid.scale.y = 0;
    headGroup.add(rightEyelid);
    robot.rightEyelid = rightEyelid;
    
    // Antena
    const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1);
    const antennaMaterial = new THREE.MeshPhongMaterial({ 
        color: config.robotAccent
    });
    const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
    antenna.position.y = 1.5;
    headGroup.add(antenna);
    
    // Luz de la antena
    const antennaLightGeometry = new THREE.SphereGeometry(0.15, 8, 8);
    const antennaLightMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x00ff00,
        emissive: 0x00ff00,
        emissiveIntensity: 0.8
    });
    const antennaLight = new THREE.Mesh(antennaLightGeometry, antennaLightMaterial);
    antennaLight.position.y = 2;
    headGroup.add(antennaLight);
    robot.antennaLight = antennaLight;
    
    robot.head = headGroup;
    robot.add(headGroup);
    
    // Brazos
    const armGeometry = new THREE.BoxGeometry(0.4, 2, 0.4);
    const armMaterial = new THREE.MeshPhongMaterial({ 
        color: config.robotColor
    });
    
    // Brazo izquierdo
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-1.7, -0.5, 0);
    
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.y = -0.8;
    leftArmGroup.add(leftArm);
    
    robot.leftArm = leftArmGroup;
    robot.add(leftArmGroup);
    
    // Brazo derecho (sostendrá productos)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(1.7, -0.5, 0);
    
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.y = -0.8;
    rightArmGroup.add(rightArm);
    
    robot.rightArm = rightArmGroup;
    robot.add(rightArmGroup);
    
    // Agregar robot a la escena
    scene.add(robot);
}

// Crear producto 3D
function create3DProduct(categoryKey) {
    const productData = CATEGORY_PRODUCTS[categoryKey];
    if (!productData) return null;
    
    const productGroup = new THREE.Group();
    
    // Crear forma basada en la categoría
    let geometry;
    const color = new THREE.Color(productData.color);
    
    // Diferentes geometrías según el tipo de producto
    switch(categoryKey) {
        case "bebidas no alcohólicas":
        case "bebidas alcohólicas":
            // Botella
            geometry = new THREE.CylinderGeometry(0.3, 0.4, 1.5, 16);
            break;
        case "enlatados y conservas":
            // Lata
            geometry = new THREE.CylinderGeometry(0.4, 0.4, 0.8, 16);
            break;
        case "botanas, dulces y snacks":
            // Bolsa
            geometry = new THREE.BoxGeometry(0.8, 1.2, 0.3);
            break;
        case "panadería y repostería":
            // Pan
            geometry = new THREE.SphereGeometry(0.5, 16, 12);
            break;
        case "lácteos y huevos":
            // Caja de leche
            geometry = new THREE.BoxGeometry(0.6, 1, 0.4);
            break;
        case "frutas y verduras frescas":
            // Fruta (esfera)
            geometry = new THREE.SphereGeometry(0.5, 16, 16);
            break;
        default:
            // Caja genérica
            geometry = new THREE.BoxGeometry(0.7, 0.7, 0.7);
    }
    
    const material = new THREE.MeshPhongMaterial({ 
        color: color,
        emissive: color,
        emissiveIntensity: 0.1
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    productGroup.add(mesh);
    
    // Agregar etiqueta con emoji
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 128, 128);
    ctx.font = '80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(productData.emoji, 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const labelGeometry = new THREE.PlaneGeometry(0.5, 0.5);
    const labelMaterial = new THREE.MeshBasicMaterial({ 
        map: texture, 
        transparent: true 
    });
    const label = new THREE.Mesh(labelGeometry, labelMaterial);
    label.position.z = 0.4;
    productGroup.add(label);
    
    return productGroup;
}

// Cambiar producto
function changeProduct() {
    // Remover producto anterior
    if (currentProduct) {
        robot.rightArm.remove(currentProduct);
    }
    
    // Obtener categorías
    const categories = Object.keys(CATEGORY_PRODUCTS);
    robotState.currentCategory = (robotState.currentCategory + 1) % categories.length;
    
    // Crear nuevo producto
    const categoryKey = categories[robotState.currentCategory];
    currentProduct = create3DProduct(categoryKey);
    
    if (currentProduct) {
        currentProduct.position.set(0, -1.5, 0.5);
        currentProduct.scale.set(0.8, 0.8, 0.8);
        robot.rightArm.add(currentProduct);
        
        // Animar entrada del producto
        gsap.from(currentProduct.scale, {
            x: 0,
            y: 0,
            z: 0,
            duration: 0.5,
            ease: "back.out(1.7)"
        });
        
        // Mostrar frase sobre el producto
        const productData = CATEGORY_PRODUCTS[categoryKey];
        showRobotMessage(`Sosteniendo: ${productData.name} de ${categoryKey}`, 'info');
    }
}

// Configurar interactividad
function setupInteractivity() {
    const container = renderer.domElement;
    
    // Mouse move para seguimiento
    container.addEventListener('mousemove', onDocumentMouseMove, false);
    
    // Click en el robot
    container.addEventListener('click', onRobotClick, false);
    
    // Touch para móviles
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
}

// Handlers de eventos
function onDocumentMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Actualizar última actividad
    robotState.lastActivity = Date.now();
    
    // Despertar robot si está dormido
    if (robotState.mood === 'sleeping') {
        wakeUpRobot();
    }
}

function onRobotClick(event) {
    // Hacer que el robot haga un truco
    performTrick();
}

function onTouchStart(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        const rect = renderer.domElement.getBoundingClientRect();
        mouseX = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
    }
}

function onTouchMove(event) {
    if (event.touches.length === 1) {
        event.preventDefault();
        const rect = renderer.domElement.getBoundingClientRect();
        mouseX = ((event.touches[0].clientX - rect.left) / rect.width) * 2 - 1;
        mouseY = -((event.touches[0].clientY - rect.top) / rect.height) * 2 + 1;
    }
}

function onWindowResize() {
    const container = document.getElementById('warehouse3d');
    if (!container) return;
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

// Animación principal
function animate() {
    requestAnimationFrame(animate);
    
    if (!robot) return;
    
    // Rotación base del robot
    if (window.isRotating) {
        robot.rotation.y += config.animationSpeed * 2;
    }
    
    // Seguimiento del mouse con la cabeza
    if (robotState.isFollowingMouse && robotState.mood !== 'sleeping') {
        targetRotationX = mouseX * 0.5;
        targetRotationY = mouseY * 0.3;
        
        robot.head.rotation.x += (targetRotationY - robot.head.rotation.x) * 0.1;
        robot.head.rotation.y += (targetRotationX - robot.head.rotation.y) * 0.1;
    }
    
    // Animación de levitación
    robot.position.y = Math.sin(Date.now() * 0.001) * 0.2;
    
    // Animación del producto
    if (currentProduct) {
        currentProduct.rotation.y += 0.01;
        currentProduct.position.y = -1.5 + Math.sin(Date.now() * 0.002) * 0.1;
    }
    
    // Animación de parpadeo
    robotState.blinkTimer += 16; // ~60fps
    if (robotState.blinkTimer > config.blinkInterval) {
        blink();
        robotState.blinkTimer = 0;
    }
    
    // Actualizar color de antena según mood
    updateAntenna();
    
    renderer.render(scene, camera);
}

// Funciones de animación
function blink() {
    if (robotState.mood === 'sleeping') return;
    
    gsap.to([robot.leftEyelid.scale, robot.rightEyelid.scale], {
        y: 8,
        duration: 0.1,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut"
    });
}

function updateAntenna() {
    if (!robot.antennaLight) return;
    
    const colors = {
        happy: 0x00ff00,
        worried: 0xffff00,
        sleeping: 0x0000ff,
        celebrating: 0xff00ff,
        thinking: 0x00ffff
    };
    
    const color = new THREE.Color(colors[robotState.mood] || 0x00ff00);
    robot.antennaLight.material.color = color;
    robot.antennaLight.material.emissive = color;
}

function performTrick() {
    // Girar el robot
    gsap.to(robot.rotation, {
        y: robot.rotation.y + Math.PI * 2,
        duration: 1,
        ease: "power2.inOut"
    });
    
    // Lanzar y atrapar el producto
    if (currentProduct) {
        gsap.to(currentProduct.position, {
            y: 1,
            duration: 0.5,
            ease: "power2.out",
            yoyo: true,
            repeat: 1
        });
        
        gsap.to(currentProduct.rotation, {
            x: Math.PI * 2,
            z: Math.PI,
            duration: 1,
            ease: "power2.inOut"
        });
    }
    
    // Cambiar mood temporalmente
    const previousMood = robotState.mood;
    changeMood('celebrating');
    setTimeout(() => changeMood(previousMood), 2000);
    
    showRobotMessage('¡Weee! ¡Mira este truco!', 'happy');
}

function wakeUpRobot() {
    changeMood('happy');
    showRobotMessage('¡Oh! ¡Ya desperté! ¿Qué hay de nuevo?', 'happy');
}

function changeMood(newMood) {
    robotState.mood = newMood;
    
    // Ajustar expresión de ojos según mood
    switch(newMood) {
        case 'sleeping':
            gsap.to([robot.leftEyelid.scale, robot.rightEyelid.scale], {
                y: 8,
                duration: 0.5
            });
            break;
        case 'worried':
            gsap.to(robot.head.rotation, {
                z: 0.1,
                duration: 0.3,
                yoyo: true,
                repeat: -1
            });
            break;
        case 'celebrating':
            gsap.to(robot.position, {
                y: 2,
                duration: 0.3,
                yoyo: true,
                repeat: 3,
                ease: "power2.out"
            });
            break;
        default:
            gsap.to([robot.leftEyelid.scale, robot.rightEyelid.scale], {
                y: 0,
                duration: 0.3
            });
            gsap.killTweensOf(robot.head.rotation);
            gsap.to(robot.head.rotation, {
                z: 0,
                duration: 0.3
            });
    }
}

// Iniciar timers
function startTimers() {
    // Cambiar producto periódicamente
    setInterval(() => {
        if (robotState.mood !== 'sleeping') {
            changeProduct();
        }
    }, config.productChangeInterval);
    
    // Verificar inactividad para dormir
    setInterval(() => {
        if (Date.now() - robotState.lastActivity > config.sleepTimeout) {
            if (robotState.mood !== 'sleeping') {
                changeMood('sleeping');
                showRobotMessage('Zzz... 😴', 'info');
            }
        }
    }, 5000);
}

// Mostrar mensaje del robot
function showRobotMessage(message, type = 'info') {
    // Enviar evento al dashboard principal
    window.dispatchEvent(new CustomEvent('robot-message', {
        detail: { message, type }
    }));
}

// Funciones públicas para el dashboard
window.OptiBot = {
    updateMood: function(mood) {
        changeMood(mood);
    },
    
    performTrick: function() {
        performTrick();
    },
    
    changeProduct: function() {
        changeProduct();
    },
    
    sayMessage: function(message, type = 'info') {
        showRobotMessage(message, type);
    },
    
    updateFromInventory: function(stats) {
        // Actualizar mood basado en estadísticas
        if (stats.stockCritico > 5) {
            changeMood('worried');
        } else if (stats.ventasHoy > stats.promedioVentas * 1.5) {
            changeMood('celebrating');
        } else {
            changeMood('happy');
        }
    }
};

// Inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOptiBot);
} else {
    setTimeout(initOptiBot, 100);
}

// Limpiar al salir
window.addEventListener('beforeunload', () => {
    if (renderer) {
        renderer.dispose();
    }
});