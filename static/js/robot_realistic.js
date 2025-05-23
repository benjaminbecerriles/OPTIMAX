// =============================================
// OPTIMAX ROBOT REALISTA - Versión Simplificada
// =============================================

let scene, camera, renderer;
let robot, mixer;
let mouseX = 0, mouseY = 0;
let clock = new THREE.Clock();

// Configuración
const config = {
    modelPath: '/static/models/robot/scene.gltf', // Actualizado a scene.gltf
    backgroundColor: 0xf0f0f0,
    cameraPosition: { x: 0, y: 1, z: 5 }
};

// Estado del robot
const robotState = {
    loaded: false,
    animations: {},
    currentAnimation: null
};

// Inicializar
function initRealisticRobot() {
    console.log('🤖 Iniciando OptiBot Realista...');
    
    const container = document.getElementById('warehouse3d');
    if (!container) {
        console.error('❌ No se encontró el contenedor #warehouse3d');
        return;
    }
    
    // Limpiar contenedor
    container.innerHTML = '<div class="robot-loading"><div class="loader"></div><p>Cargando robot realista...</p></div>';
    
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    scene.fog = new THREE.Fog(config.backgroundColor, 10, 50);
    
    // Configurar cámara
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
    camera.position.set(config.cameraPosition.x, config.cameraPosition.y, config.cameraPosition.z);
    camera.lookAt(0, 0, 0);
    
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    // Luz principal (key light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1);
    keyLight.position.set(5, 10, 5);
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
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.5);
    fillLight.position.set(-5, 5, -5);
    scene.add(fillLight);
    
    // Luz trasera (rim light)
    const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
    rimLight.position.set(0, 10, -10);
    scene.add(rimLight);
}

// Crear piso
function createFloor() {
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xe0e0e0,
        roughness: 0.8,
        metalness: 0.2
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1;
    floor.receiveShadow = true;
    scene.add(floor);
}

// Cargar modelo del robot
function loadRobotModel() {
    console.log('📦 Cargando modelo del robot...');
    
    const loader = new THREE.GLTFLoader();
    
    loader.load(
        config.modelPath,
        // Éxito
        (gltf) => {
            console.log('✅ Modelo cargado exitosamente!', gltf);
            
            robot = gltf.scene;
            robot.position.set(0, -1, 0);
            
            // Ajustar escala si es necesario
            const box = new THREE.Box3().setFromObject(robot);
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 2 / maxDim; // Escalar para que mida ~2 unidades
            robot.scale.multiplyScalar(scale);
            
            // Centrar el modelo
            const center = box.getCenter(new THREE.Vector3());
            robot.position.x = -center.x * scale;
            robot.position.z = -center.z * scale;
            
            // Configurar materiales y sombras
            robot.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    
                    // Si no tiene texturas, agregar color
                    if (child.material && (!child.material.map || child.material.color.getHex() === 0xffffff)) {
                        // Crear material con color
                        child.material = new THREE.MeshPhongMaterial({
                            color: 0x10b981, // Verde OptiMax
                            shininess: 100,
                            specular: 0x222222
                        });
                        
                        // Colores específicos por nombre de parte
                        if (child.name.toLowerCase().includes('eye')) {
                            child.material.color.setHex(0xffffff);
                            child.material.emissive = new THREE.Color(0xffffff);
                            child.material.emissiveIntensity = 0.5;
                        } else if (child.name.toLowerCase().includes('antenna')) {
                            child.material.color.setHex(0xff0000);
                            child.material.emissive = new THREE.Color(0xff0000);
                            child.material.emissiveIntensity = 0.8;
                        }
                    }
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
                
                // Reproducir primera animación
                const firstAnimation = Object.values(robotState.animations)[0];
                if (firstAnimation) {
                    firstAnimation.play();
                    robotState.currentAnimation = firstAnimation;
                }
            }
            
            robotState.loaded = true;
            
            // Mostrar mensaje de éxito
            showMessage("¡Hola! Soy OptiBot 🤖", 'success');
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
    
    // Rotación suave del robot siguiendo el mouse
    if (robot && robotState.loaded) {
        // Rotación horizontal siguiendo el mouse
        robot.rotation.y = mouseX * 0.5;
        
        // Inclinación vertical sutil
        robot.rotation.x = mouseY * 0.1;
        
        // Animación idle (balanceo suave)
        robot.position.y = -1 + Math.sin(Date.now() * 0.001) * 0.02;
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