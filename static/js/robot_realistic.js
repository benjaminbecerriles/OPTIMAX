// =============================================
// OPTIMAX ROBOT REALISTA - Versión GLB
// =============================================

let scene, camera, renderer;
let robot, mixer;
let mouseX = 0, mouseY = 0;
let clock = new THREE.Clock();
let robotBaseY = 0; // Posición base del robot

// Configuración
const config = {
    modelPath: '/static/models/robot/robotmiov2.glb', // ACTUALIZADO A ROBOTMIOV2.GLB
    backgroundColor: 0xf0f0f0,
    cameraPosition: { x: 0, y: 1.5, z: 5 } // Cámara frontal a la altura del robot
};

// Estado del robot
const robotState = {
    loaded: false,
    animations: {},
    currentAnimation: null
};

// Inicializar
function initRealisticRobot() {
    console.log('🤖 Iniciando OptiBot Realista GLB...');
    
    const container = document.getElementById('warehouse3d');
    if (!container) {
        console.error('❌ No se encontró el contenedor #warehouse3d');
        return;
    }
    
    // Limpiar contenedor
    container.innerHTML = '<div class="robot-loading"><div class="loader"></div><p>Cargando robot...</p></div>';
    
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    scene.fog = new THREE.Fog(config.backgroundColor, 8, 30);
    
    // Configurar cámara
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(config.cameraPosition.x, config.cameraPosition.y, config.cameraPosition.z);
    camera.lookAt(0, 1, 0); // Mirar al centro del robot
    
    // Configurar renderer
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: false,
        powerPreference: "high-performance"
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    
    // Ajustar el canvas para que no corte el contenido
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    // Limpiar y agregar canvas
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    // Iluminación
    setupLighting();
    
    // Piso
    createFloor();
    
    // Cargar robot
    loadRobotModel();
    
    // Eventos
    setupEvents();
    
    // Iniciar animación
    animate();
}

// Configurar iluminación
function setupLighting() {
    // Luz ambiental
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
    // Luz principal (key light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(5, 12, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.1;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -10;
    keyLight.shadow.camera.right = 10;
    keyLight.shadow.camera.top = 10;
    keyLight.shadow.camera.bottom = -10;
    scene.add(keyLight);
    
    // Luz de relleno (fill light)
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.7);
    fillLight.position.set(-5, 2, 5);
    scene.add(fillLight);
    
    // Luz trasera (rim light)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 10, -10);
    scene.add(rimLight);
}

// Crear piso
function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(30, 30);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xe0e0e0,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);
}

// Cargar modelo del robot
function loadRobotModel() {
    console.log('📦 Cargando modelo robotmiov2.glb...');
    
    const loader = new THREE.GLTFLoader();
    
    // Configurar el manager para manejar errores
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onError = (url) => {
        console.warn('⚠️ Error cargando recurso:', url);
    };
    loader.manager = loadingManager;
    
    loader.load(
        config.modelPath,
        // Éxito
        (gltf) => {
            console.log('✅ Modelo GLB cargado exitosamente!', gltf);
            
            robot = gltf.scene;
            
            // Configuración de rotación para robotmiov2.glb
            // Ajustar según la orientación del modelo
            robot.rotation.x = 0; // Sin rotación en X
            robot.rotation.y = Math.PI; // 180 grados para que mire de frente
            robot.rotation.z = 0; // Sin rotación en Z
            
            // Calcular dimensiones y centrar
            const box = new THREE.Box3().setFromObject(robot);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            console.log('=== Dimensiones del modelo ===');
            console.log('Tamaño:', size);
            console.log('Centro:', center);
            console.log('Box Min:', box.min);
            console.log('Box Max:', box.max);
            console.log('📍 La cámara está en Z=5 (positivo), mirando hacia Z negativo');
            
            // Escalar si es necesario
            const targetHeight = 3; // Altura deseada del robot
            const currentHeight = size.y;
            const scale = targetHeight / currentHeight;
            robot.scale.set(scale, scale, scale);
            
            // Recalcular después del escalado
            const newBox = new THREE.Box3().setFromObject(robot);
            const newCenter = newBox.getCenter(new THREE.Vector3());
            
            // Posicionar el robot con los pies en el suelo
            robot.position.x = -newCenter.x;
            robot.position.y = -newBox.min.y; // Pies en Y=0
            robot.position.z = -newCenter.z;
            
            // Guardar posición base para animaciones
            robotBaseY = robot.position.y;
            
            console.log('=== Posición final del robot ===');
            console.log('Posición:', robot.position);
            console.log('Escala:', robot.scale);
            console.log('Rotación (radianes):', robot.rotation);
            console.log('Rotación (grados):', {
                x: (robot.rotation.x * 180 / Math.PI).toFixed(2),
                y: (robot.rotation.y * 180 / Math.PI).toFixed(2),
                z: (robot.rotation.z * 180 / Math.PI).toFixed(2)
            });
            console.log('ℹ️ Rotación Y = 180° para que mire de frente');
            
            // Configurar materiales y sombras
            robot.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // El modelo GLB ya tiene sus propios materiales y colores
                    console.log('Mesh encontrado:', child.name, 'Material:', child.material);
                }
            });
            
            scene.add(robot);
            
            // Configurar animaciones si existen
            if (gltf.animations && gltf.animations.length > 0) {
                console.log('🎬 Animaciones encontradas:', gltf.animations.length);
                
                mixer = new THREE.AnimationMixer(robot);
                
                gltf.animations.forEach((clip, index) => {
                    robotState.animations[clip.name] = mixer.clipAction(clip);
                    console.log(`  - ${index}: ${clip.name}`);
                });
                
                // Reproducir primera animación si existe
                const firstAnimation = Object.values(robotState.animations)[0];
                if (firstAnimation) {
                    firstAnimation.play();
                    robotState.currentAnimation = firstAnimation;
                }
            }
            
            robotState.loaded = true;
            
            // Mostrar mensaje de éxito
            showMessage("¡Hola! Soy OptiBot 🤖", 'success');
            
            // Tips para ajustar orientación si fuera necesario
            console.log('=== ORIENTACIÓN DEL ROBOT ===');
            console.log('✅ El robot debería estar mirando de frente');
            console.log('Si necesitas ajustar la orientación:');
            console.log('• window.OptiBot3D.setRotation(0, 0, 0)  // Sin rotación');
            console.log('• window.OptiBot3D.setRotation(0, Math.PI/2, 0)  // 90°');
            console.log('• window.OptiBot3D.testRotations()  // Probar automáticamente');
            console.log('===============================');
        },
        // Progreso
        (progress) => {
            const percentComplete = (progress.loaded / progress.total * 100).toFixed(2);
            console.log(`⏳ Cargando: ${percentComplete}%`);
            
            // Actualizar UI de carga
            const loadingText = document.querySelector('.robot-loading p');
            if (loadingText) {
                loadingText.textContent = `Cargando robot... ${percentComplete}%`;
            }
        },
        // Error
        (error) => {
            console.error('❌ Error al cargar el modelo:', error);
            showMessage("Error al cargar el robot 😢", 'error');
        }
    );
}

// Configurar eventos
function setupEvents() {
    const container = renderer.domElement;
    
    // Mouse move
    container.addEventListener('mousemove', onMouseMove, false);
    
    // Click
    container.addEventListener('click', onRobotClick, false);
    
    // Resize
    window.addEventListener('resize', onWindowResize, false);
}

// Eventos
function onMouseMove(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouseY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onRobotClick() {
    if (!robotState.loaded) return;
    
    // Hacer que el robot salude o cambie animación
    playNextAnimation();
    
    // Mostrar mensaje
    const messages = [
        "¡Hola! 👋",
        "¿Cómo va el inventario?",
        "¡Mira este movimiento!",
        "Stock óptimo al 95% 📊",
        "¿Ya revisaste las caducidades?"
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    showMessage(randomMessage, 'info');
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
    
    // Actualizar mixer de animaciones
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }
    
    // Solo mantener el robot estático, sin rotación automática
    if (robot && robotState.loaded) {
        // Animación idle (balanceo suave vertical)
        robot.position.y = robotBaseY + Math.sin(Date.now() * 0.001) * 0.05;
    }
    
    renderer.render(scene, camera);
}

// Cambiar animación
function playNextAnimation() {
    if (!mixer || Object.keys(robotState.animations).length === 0) return;
    
    // Detener animación actual
    if (robotState.currentAnimation) {
        robotState.currentAnimation.fadeOut(0.5);
    }
    
    // Obtener siguiente animación
    const animationNames = Object.keys(robotState.animations);
    const currentIndex = animationNames.indexOf(robotState.currentAnimation?._clip.name);
    const nextIndex = (currentIndex + 1) % animationNames.length;
    const nextAnimationName = animationNames[nextIndex];
    
    // Reproducir siguiente
    robotState.currentAnimation = robotState.animations[nextAnimationName];
    robotState.currentAnimation.reset().fadeIn(0.5).play();
    
    console.log(`🎬 Reproduciendo animación: ${nextAnimationName}`);
}

// Sistema de mensajes
let messageTimeout;
function showMessage(text, type = 'info') {
    // Limpiar mensaje anterior
    if (messageTimeout) clearTimeout(messageTimeout);
    
    // Buscar o crear contenedor
    let container = document.getElementById('robot-message-container');
    if (!container) {
        container = document.createElement('div');
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
    
    // Limpiar mensajes anteriores
    container.innerHTML = '';
    
    // Crear burbuja
    const bubble = document.createElement('div');
    bubble.className = `robot-bubble ${type}`;
    bubble.innerHTML = `
        <div class="bubble-tail"></div>
        <div class="bubble-content">
            <div class="bubble-text">${text}</div>
            <div class="bubble-time">${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;
    
    // Estilos según tipo
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    bubble.style.cssText = `
        background: white;
        border-radius: 20px;
        padding: 12px 16px;
        margin-bottom: 10px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        position: relative;
        animation: bubbleIn 0.3s ease-out;
        border: 2px solid ${colors[type] || colors.info};
    `;
    
    container.appendChild(bubble);
    
    // Auto-remover después de 5 segundos
    messageTimeout = setTimeout(() => {
        bubble.style.animation = 'bubbleOut 0.3s ease-in';
        setTimeout(() => bubble.remove(), 300);
    }, 5000);
}

// API pública
window.OptiBot3D = {
    loaded: () => robotState.loaded,
    
    showMessage: (text, type) => {
        showMessage(text, type);
    },
    
    playAnimation: (name) => {
        if (robotState.animations[name]) {
            if (robotState.currentAnimation) {
                robotState.currentAnimation.fadeOut(0.5);
            }
            robotState.currentAnimation = robotState.animations[name];
            robotState.currentAnimation.reset().fadeIn(0.5).play();
        }
    },
    
    setMood: (mood) => {
        // Implementar cambios visuales según mood
        console.log(`🎭 Cambiando mood a: ${mood}`);
    },
    
    // Nuevos métodos para control manual
    rotateRobot: (angleY) => {
        if (robot && robotState.loaded) {
            robot.rotation.y += angleY;
        }
    },
    
    resetRotation: () => {
        if (robot && robotState.loaded) {
            robot.rotation.y = Math.PI; // 180 grados, mirando de frente
        }
    },
    
    // Método para ajustar rotación directamente
    setRotation: (x, y, z) => {
        if (robot && robotState.loaded) {
            if (x !== undefined) robot.rotation.x = x;
            if (y !== undefined) robot.rotation.y = y;
            if (z !== undefined) robot.rotation.z = z;
            console.log('Nueva rotación:', {
                x: (robot.rotation.x * 180 / Math.PI).toFixed(2) + '°',
                y: (robot.rotation.y * 180 / Math.PI).toFixed(2) + '°',
                z: (robot.rotation.z * 180 / Math.PI).toFixed(2) + '°'
            });
        }
    },
    
    // Método de prueba para encontrar el frente
    testRotations: () => {
        if (robot && robotState.loaded) {
            console.log('🔄 Probando rotaciones...');
            let rotationIndex = 0;
            const rotations = [0, Math.PI/2, Math.PI, -Math.PI/2];
            
            const interval = setInterval(() => {
                robot.rotation.y = rotations[rotationIndex];
                console.log(`Rotación Y = ${(rotations[rotationIndex] * 180 / Math.PI).toFixed(0)}°`);
                rotationIndex++;
                
                if (rotationIndex >= rotations.length) {
                    clearInterval(interval);
                    console.log('✅ Prueba completada. Usa setRotation(0, [ángulo], 0) con el ángulo correcto');
                }
            }, 2000);
        }
    }
};

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealisticRobot);
} else {
    setTimeout(initRealisticRobot, 100);
}

// Debug info
console.log('📁 Robot Realistic JS cargado');
console.log('📍 Ruta del modelo:', config.modelPath);