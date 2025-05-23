// =============================================
// OPTIMAX ROBOT REALISTA - Versión GLB
// =============================================

let scene, camera, renderer;
let robot, mixer;
let mouseX = 0, mouseY = 0;
let clock = new THREE.Clock();
let robotBaseY = 0; // Posición base del robot

// Variables para seguimiento del cursor
let targetRotationX = 0;
let targetRotationY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
let maxRotationY = Math.PI / 6; // 30 grados máximo horizontal
let maxRotationX = Math.PI / 12; // 15 grados máximo vertical
let rotationSpeed = 0.15; // Velocidad de interpolación (aumentada de 0.08)

// Variables de inversión de ejes para debugging
window._invertX = false;
window._invertY = false;

// Factor de escala para sensibilidad vertical
window._verticalScale = 1.0;

// Configuración ACTUALIZADA con cámara más cercana y centrada
const config = {
    modelPath: '/static/models/robot/robotmiov2.glb',
    backgroundColor: 0xf0f0f0,
    cameraPosition: { x: 0, y: 1.0, z: 6.5 } // Acercamos la cámara y ajustamos altura
};

// Estado del robot
const robotState = {
    loaded: false,
    animations: {},
    currentAnimation: null,
    isHovered: false,
    isFollowing: true, // Seguimiento activo por defecto
    baseRotation: { x: 0, y: 0.1, z: 0 } // Rotación base del modelo
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
    
    // Configurar cámara con FOV ajustado para mejor encuadre
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000); // FOV reducido a 35 para menos distorsión
    camera.position.set(config.cameraPosition.x, config.cameraPosition.y, config.cameraPosition.z);
    camera.lookAt(0, 0.6, 0); // Miramos al centro del robot
    
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
            
            // CORRECCIÓN: Rotación para que mire de frente (ajuste fino)
            robot.rotation.x = 0;
            robot.rotation.y = 0.1; // Ligera rotación para compensar orientación del modelo
            robot.rotation.z = 0;
            
            // Guardar rotación base para el seguimiento del cursor
            robotState.baseRotation.x = robot.rotation.x;
            robotState.baseRotation.y = robot.rotation.y;
            robotState.baseRotation.z = robot.rotation.z;
            
            // Calcular dimensiones y centrar
            const box = new THREE.Box3().setFromObject(robot);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            console.log('=== Dimensiones del modelo ===');
            console.log('Tamaño:', size);
            console.log('Centro:', center);
            console.log('Box Min:', box.min);
            console.log('Box Max:', box.max);
            
            // Escalar a altura deseada (ajustada para nueva distancia)
            const targetHeight = 2.3; // Altura ligeramente aumentada para mejor visibilidad con seguimiento
            const currentHeight = size.y;
            const scale = targetHeight / currentHeight;
            robot.scale.set(scale, scale, scale);
            
            // Guardar escala base para efectos
            robot.scale._baseScale = scale;
            
            // Recalcular después del escalado
            const newBox = new THREE.Box3().setFromObject(robot);
            const newCenter = newBox.getCenter(new THREE.Vector3());
            
            // Posicionar el robot con los pies en el suelo y centrado
            robot.position.x = -newCenter.x * 0.95; // Ajuste fino para centrado perfecto
            robot.position.y = -newBox.min.y;
            robot.position.z = -newCenter.z;
            
            // Guardar posición base para animaciones
            robotBaseY = robot.position.y;
            
            console.log('=== Posición final del robot ===');
            console.log('Posición:', robot.position);
            console.log('Escala:', robot.scale);
            console.log('Rotación (grados):', {
                x: (robot.rotation.x * 180 / Math.PI).toFixed(2),
                y: (robot.rotation.y * 180 / Math.PI).toFixed(2),
                z: (robot.rotation.z * 180 / Math.PI).toFixed(2)
            });
            
            // Configurar materiales y sombras
            robot.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
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
            showMessage("¡Hola! Soy OptiBot 🤖 Sígueme con tu cursor 👀", 'success');
            
            // Mensaje adicional después de un segundo
            setTimeout(() => {
                showMessage("Mi mirada ahora sigue correctamente tu cursor ✨", 'info');
            }, 2000);
            
            console.log('=== ROBOT CARGADO CORRECTAMENTE ===');
            console.log('✅ El robot debería estar mirando de frente y centrado');
            console.log('🎯 SEGUIMIENTO DEL CURSOR ACTIVADO');
            console.log('');
            console.log('📍 Características del seguimiento:');
            console.log('• El robot sigue tu cursor en toda la página');
            console.log('• Rotación máxima: ±30° horizontal, ±15° vertical');
            console.log('• Movimiento suave e interpolado');
            console.log('• Eje Y invertido para corrección de mirada');
            console.log('');
            console.log('🎮 Comandos disponibles:');
            console.log('• window.OptiBot3D.setFollowSpeed(0.2)  // Velocidad máxima');
            console.log('• window.OptiBot3D.setFollowSpeed(0.15)  // Velocidad rápida (actual)');
            console.log('• window.OptiBot3D.setFollowSpeed(0.08)  // Velocidad normal');
            console.log('• window.OptiBot3D.setFollowSpeed(0.05)  // Velocidad lenta');
            console.log('• window.OptiBot3D.setMaxRotation(Math.PI/4, Math.PI/8)  // Cambiar límites');
            console.log('• window.OptiBot3D.resetView()  // Volver al centro');
            console.log('• window.OptiBot3D.getFollowInfo()  // Ver información actual');
            console.log('• window.OptiBot3D.debugRotation()  // Debug de rotaciones');
            console.log('');
            console.log('🔧 Si la mirada está invertida:');
            console.log('• window.OptiBot3D.invertAxisY()  // Invertir vertical');
            console.log('• window.OptiBot3D.invertAxisX()  // Invertir horizontal');
            console.log('• window.OptiBot3D.setVerticalScale(0.5)  // Reducir sensibilidad vertical');
            console.log('• window.OptiBot3D.setVerticalScale(1.5)  // Aumentar sensibilidad vertical');
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
    
    // Mouse move en TODA la página para seguimiento global
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    
    // Click en el canvas del robot
    container.addEventListener('click', onRobotClick, false);
    
    // Resize
    window.addEventListener('resize', onWindowResize, false);
    
    // Mouse enter/leave para activar/desactivar seguimiento
    container.addEventListener('mouseenter', () => {
        robotState.isHovered = true;
    });
    
    container.addEventListener('mouseleave', () => {
        robotState.isHovered = false;
    });
}

// Eventos
function onDocumentMouseMove(event) {
    // Normalizar coordenadas del mouse para toda la ventana
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Calcular rotaciones objetivo basadas en la posición del cursor
    // Aplicar inversión dinámica si está activada (para debugging)
    const xMultiplier = window._invertY ? 1 : -1; // Invertido por defecto para corrección
    const yMultiplier = window._invertX ? -1 : 1;
    
    targetRotationY = mouseX * window.maxRotationY * yMultiplier;
    targetRotationX = mouseY * window.maxRotationX * xMultiplier * window._verticalScale;
}

function onRobotClick() {
    if (!robotState.loaded) return;
    
    // Hacer que el robot salude o cambie animación
    playNextAnimation();
    
    // Mostrar mensaje
    const messages = [
        "¡Hola! 👋",
        "¿Me estás siguiendo con el cursor? 👀",
        "¡Mira hacia donde miro! 🎯",
        "Stock óptimo al 95% 📊",
        "¿Ya revisaste las caducidades?"
    ];
    const randomMessage = messages[Math.floor(Math.random() * messages.length)];
    showMessage(randomMessage, 'info');
    
    // Efecto visual cuando hace click
    if (robot) {
        // Pequeño "salto" del robot
        const jumpAnimation = () => {
            const startY = robotBaseY;
            const jumpHeight = 0.2;
            const duration = 300;
            const startTime = Date.now();
            
            const animateJump = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Curva de salto parabólica
                const jumpCurve = Math.sin(progress * Math.PI);
                robot.position.y = startY + (jumpHeight * jumpCurve);
                
                if (progress < 1) {
                    requestAnimationFrame(animateJump);
                } else {
                    robot.position.y = startY;
                }
            };
            
            animateJump();
        };
        
        jumpAnimation();
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
    
    // Actualizar mixer de animaciones
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }
    
    // Animaciones del robot
    if (robot && robotState.loaded) {
        // Animación idle (balanceo suave vertical)
        robot.position.y = robotBaseY + Math.sin(Date.now() * 0.001) * 0.05;
        
        // SEGUIMIENTO DEL CURSOR - Solo si está activado
        if (robotState.isFollowing) {
            currentRotationY += (targetRotationY - currentRotationY) * window.rotationSpeed;
            currentRotationX += (targetRotationX - currentRotationX) * window.rotationSpeed;
        } else {
            // Volver suavemente a la posición neutral cuando no está siguiendo
            currentRotationY += (0 - currentRotationY) * window.rotationSpeed;
            currentRotationX += (0 - currentRotationX) * window.rotationSpeed;
        }
        
        // Aplicar rotaciones con límites
        robot.rotation.y = robotState.baseRotation.y + currentRotationY;
        robot.rotation.x = robotState.baseRotation.x + currentRotationX;
        
        // Efecto de "respiración" sutil (solo en altura)
        const breathingEffect = Math.sin(Date.now() * 0.002) * 0.005;
        if (robot.scale._baseScale) {
            robot.scale.y = robot.scale._baseScale * (1 + breathingEffect);
        }
        
        // Indicador visual cuando el robot alcanza el límite de rotación
        const container = document.getElementById('warehouse3d');
        if (container) {
            if (Math.abs(currentRotationY) > window.maxRotationY * 0.9 || 
                Math.abs(currentRotationX) > window.maxRotationX * 0.9) {
                container.classList.add('at-limit');
            } else {
                container.classList.remove('at-limit');
            }
            
            // Agregar clase cuando está siguiendo
            if (robotState.isFollowing) {
                container.classList.add('following-cursor');
            } else {
                container.classList.remove('following-cursor');
            }
        }
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

// API pública con métodos de debugging adicionales
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
        console.log(`🎭 Cambiando mood a: ${mood}`);
    },
    
    // Control del seguimiento del cursor
    setFollowSpeed: (speed) => {
        window.rotationSpeed = Math.max(0.01, Math.min(0.2, speed));
        console.log('⚡ Velocidad de seguimiento:', window.rotationSpeed);
        
        // Mostrar mensaje visual
        let speedText = 'Normal';
        if (window.rotationSpeed >= 0.18) speedText = 'Máxima';
        else if (window.rotationSpeed >= 0.12) speedText = 'Rápida';
        else if (window.rotationSpeed <= 0.06) speedText = 'Lenta';
        
        showMessage(`Velocidad de seguimiento: ${speedText} (${window.rotationSpeed})`, 'info');
    },
    
    setMaxRotation: (horizontal, vertical) => {
        if (horizontal !== undefined) {
            window.maxRotationY = horizontal;
            console.log('Rotación máxima horizontal:', (window.maxRotationY * 180 / Math.PI).toFixed(0) + '°');
        }
        if (vertical !== undefined) {
            window.maxRotationX = vertical;
            console.log('Rotación máxima vertical:', (window.maxRotationX * 180 / Math.PI).toFixed(0) + '°');
        }
    },
    
    toggleFollowing: () => {
        robotState.isFollowing = !robotState.isFollowing;
        console.log('Seguimiento del cursor:', robotState.isFollowing ? 'Activado' : 'Desactivado');
        
        // Actualizar botón visual
        const btn = document.getElementById('followToggle');
        if (btn) {
            if (robotState.isFollowing) {
                btn.classList.add('active');
                btn.innerHTML = '<i class="fas fa-eye"></i>';
            } else {
                btn.classList.remove('active');
                btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            }
        }
        
        if (!robotState.isFollowing) {
            targetRotationX = 0;
            targetRotationY = 0;
        }
    },
    
    resetView: () => {
        targetRotationX = 0;
        targetRotationY = 0;
        currentRotationX = 0;
        currentRotationY = 0;
        if (robot && robotState.loaded) {
            robot.rotation.x = robotState.baseRotation.x;
            robot.rotation.y = robotState.baseRotation.y;
        }
        console.log('Vista reseteada al frente');
    },
    
    rotateRobot: (angleY) => {
        if (robot && robotState.loaded) {
            robot.rotation.y += angleY;
            robotState.baseRotation.y = robot.rotation.y;
        }
    },
    
    resetRotation: () => {
        if (robot && robotState.loaded) {
            robot.rotation.y = 0.1; // Rotación óptima para este modelo
            robotState.baseRotation.y = robot.rotation.y;
        }
    },
    
    setRotation: (x, y, z) => {
        if (robot && robotState.loaded) {
            if (x !== undefined) {
                robot.rotation.x = x;
                robotState.baseRotation.x = x;
            }
            if (y !== undefined) {
                robot.rotation.y = y;
                robotState.baseRotation.y = y;
            }
            if (z !== undefined) {
                robot.rotation.z = z;
                robotState.baseRotation.z = z;
            }
            console.log('Nueva rotación base:', {
                x: (robot.rotation.x * 180 / Math.PI).toFixed(2) + '°',
                y: (robot.rotation.y * 180 / Math.PI).toFixed(2) + '°',
                z: (robot.rotation.z * 180 / Math.PI).toFixed(2) + '°'
            });
        }
    },
    
    // Métodos de debugging para ajustar cámara
    setCameraPosition: (x, y, z) => {
        if (camera) {
            if (x !== undefined) camera.position.x = x;
            if (y !== undefined) camera.position.y = y;
            if (z !== undefined) camera.position.z = z;
            console.log('Nueva posición de cámara:', camera.position);
        }
    },
    
    setCameraLookAt: (x, y, z) => {
        if (camera) {
            camera.lookAt(x, y, z);
            console.log('Cámara mirando a:', x, y, z);
        }
    },
    
    // Métodos de debugging adicionales
    debugRotation: () => {
        if (robot && robotState.loaded) {
            console.log('=== DEBUG ROTACIÓN ===');
            console.log('Mouse Position:', { x: mouseX.toFixed(3), y: mouseY.toFixed(3) });
            console.log('Target Rotation:', { 
                x: (targetRotationX * 180 / Math.PI).toFixed(2) + '°', 
                y: (targetRotationY * 180 / Math.PI).toFixed(2) + '°' 
            });
            console.log('Current Rotation:', { 
                x: (currentRotationX * 180 / Math.PI).toFixed(2) + '°', 
                y: (currentRotationY * 180 / Math.PI).toFixed(2) + '°' 
            });
            console.log('Robot Rotation:', { 
                x: (robot.rotation.x * 180 / Math.PI).toFixed(2) + '°', 
                y: (robot.rotation.y * 180 / Math.PI).toFixed(2) + '°' 
            });
            console.log('Inversión de ejes:', {
                X: window._invertX ? 'Invertido' : 'Normal',
                Y: window._invertY ? 'Invertido' : 'Normal (corregido)'
            });
            console.log('===================');
        }
    },
    
    // Invertir ejes individualmente para pruebas
    invertAxisX: () => {
        window._invertX = !window._invertX;
        console.log('❌ Eje X (horizontal) invertido:', window._invertX ? 'Sí' : 'No');
        console.log('ℹ️ Ahora el robot mirará en dirección opuesta horizontalmente');
    },
    
    invertAxisY: () => {
        window._invertY = !window._invertY;
        console.log('↕️ Eje Y (vertical) invertido:', window._invertY ? 'Sí' : 'No');
        console.log('ℹ️ Estado actual:', window._invertY ? 'Sin corrección (problema original)' : 'Con corrección (normal)');
    },
    
    // Obtener info del seguimiento
    getFollowInfo: () => {
        return {
            mouseX: mouseX.toFixed(3),
            mouseY: mouseY.toFixed(3),
            targetRotationX: (targetRotationX * 180 / Math.PI).toFixed(2) + '°',
            targetRotationY: (targetRotationY * 180 / Math.PI).toFixed(2) + '°',
            currentRotationX: (currentRotationX * 180 / Math.PI).toFixed(2) + '°',
            currentRotationY: (currentRotationY * 180 / Math.PI).toFixed(2) + '°',
            speed: window.rotationSpeed,
            maxRotationY: (window.maxRotationY * 180 / Math.PI).toFixed(0) + '°',
            maxRotationX: (window.maxRotationX * 180 / Math.PI).toFixed(0) + '°',
            isFollowing: robotState.isFollowing
        };
    },
    
    // Ajustar sensibilidad vertical
    setVerticalScale: (scale) => {
        window._verticalScale = Math.max(0.1, Math.min(2.0, scale));
        console.log('Escala vertical ajustada a:', window._verticalScale);
    },
    
    testRotations: () => {
        if (robot && robotState.loaded) {
            console.log('🔄 Probando rotaciones...');
            let rotationIndex = 0;
            const rotations = [0, Math.PI/2, Math.PI, -Math.PI/2];
            
            const interval = setInterval(() => {
                robot.rotation.y = rotations[rotationIndex];
                robotState.baseRotation.y = robot.rotation.y;
                console.log(`Rotación Y = ${(rotations[rotationIndex] * 180 / Math.PI).toFixed(0)}°`);
                rotationIndex++;
                
                if (rotationIndex >= rotations.length) {
                    clearInterval(interval);
                    console.log('✅ Prueba completada');
                    window.OptiBot3D.resetView();
                }
            }, 2000);
        }
    }
};

// Hacer disponibles globalmente para debugging
window.scene = scene;
window.camera = camera;
window.renderer = renderer;
window.robot = robot;
window.rotationSpeed = rotationSpeed;
window.maxRotationY = maxRotationY;
window.maxRotationX = maxRotationX;

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRealisticRobot);
} else {
    setTimeout(initRealisticRobot, 100);
}

// Debug info
console.log('📁 Robot Realistic JS cargado');
console.log('📍 Ruta del modelo:', config.modelPath);
console.log('📷 Posición inicial de cámara:', config.cameraPosition);
console.log('👁️ Punto de mira: x:0, y:0.6, z:0');
console.log('🎯 Seguimiento del cursor: ACTIVADO');
console.log('⚡ Velocidad de seguimiento:', window.rotationSpeed);
console.log('📐 Límites de rotación: ±30° horizontal, ±15° vertical');
console.log('🔄 Corrección de eje Y aplicada (el robot ahora mira correctamente)');
console.log('🚀 Velocidad aumentada para respuesta más rápida');