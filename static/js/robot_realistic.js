// =============================================
// OPTIMAX ROBOT REALISTA - Versión GLB con Lluvia de Dulces
// =============================================

let scene, camera, renderer;
let robot, mixer;
let mouseX = 0, mouseY = 0;
let clock = new THREE.Clock();
let robotBaseY = 0;

// Variables para seguimiento del cursor
let targetRotationX = 0;
let targetRotationY = 0;
let currentRotationX = 0;
let currentRotationY = 0;
let maxRotationY = Math.PI / 6;
let maxRotationX = Math.PI / 12;
let rotationSpeed = 0.15;

// Variables de inversión de ejes para debugging
window._invertX = false;
window._invertY = false;
window._verticalScale = 1.0;

// Sistema de física
let world;
let robotBody;
let candyBodies = [];
let strawberryBodies = [];

// Modelos de dulces
let candyModel = null;
let strawberryModel = null;
let candyMeshes = [];
let strawberryMeshes = [];

// Estado de la lluvia
let isRaining = false;
let rainType = 'candy'; // Alterna entre 'candy' y 'strawberry'
let lastClickTime = 0;
let rainCooldown = 8000; // 8 segundos entre lluvias
let maxCandies = 80; // Máximo de dulces activos
let spawnInterval = null;
let cleanupTimeout = null;

// Configuración
const config = {
    modelPath: '/static/models/robot/robotmiov2.glb',
    candyPath: '/static/models/robot/candy.glb',
    strawberryPath: '/static/models/robot/strawberry.glb',
    backgroundColor: 0xf0f0f0,
    cameraPosition: { x: 0, y: 1.0, z: 6.5 }
};

// Estado del robot
const robotState = {
    loaded: false,
    animations: {},
    currentAnimation: null,
    isHovered: false,
    isFollowing: true,
    baseRotation: { x: 0, y: 0.1, z: 0 }
};

// Inicializar
function initRealisticRobot() {
    console.log('Iniciando OptiBot Realista GLB con sistema de lluvia...');
    
    const container = document.getElementById('warehouse3d');
    if (!container) {
        console.error('❌ No se encontró el contenedor #warehouse3d');
        return;
    }
    
    container.innerHTML = '<div class="robot-loading"><div class="loader"></div><p>Cargando robot...</p></div>';
    
    // Crear escena
    scene = new THREE.Scene();
    scene.background = new THREE.Color(config.backgroundColor);
    scene.fog = new THREE.Fog(config.backgroundColor, 8, 30);
    
    // Configurar cámara
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 1000);
    camera.position.set(config.cameraPosition.x, config.cameraPosition.y, config.cameraPosition.z);
    camera.lookAt(0, 0.6, 0);
    
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
    
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    
    // Inicializar física
    initPhysics();
    
    // Iluminación
    setupLighting();
    
    // Piso
    createFloor();
    
    // Cargar modelos
    loadRobotModel();
    loadCandyModels();
    
    // Eventos
    setupEvents();
    
    // Iniciar animación
    animate();
}

// Inicializar sistema de física
function initPhysics() {
    world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 10;
}

// Cargar modelos de dulces
function loadCandyModels() {
    const loader = new THREE.GLTFLoader();
    
    // Cargar candy.glb
    loader.load(config.candyPath, (gltf) => {
        candyModel = gltf.scene;
        candyModel.scale.set(0.15, 0.15, 0.15); // Ajustar tamaño
        console.log('🍬 Modelo candy.glb cargado');
    }, undefined, (error) => {
        console.error('Error cargando candy.glb:', error);
    });
    
    // Cargar strawberry.glb
    loader.load(config.strawberryPath, (gltf) => {
        strawberryModel = gltf.scene;
        strawberryModel.scale.set(0.15, 0.15, 0.15); // Ajustar tamaño
        console.log('🍓 Modelo strawberry.glb cargado');
    }, undefined, (error) => {
        console.error('Error cargando strawberry.glb:', error);
    });
}

// Configurar iluminación
function setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);
    
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
    
    const fillLight = new THREE.DirectionalLight(0x88ccff, 0.7);
    fillLight.position.set(-5, 2, 5);
    scene.add(fillLight);
    
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
    
    // Añadir piso físico
    const floorShape = new CANNON.Plane();
    const floorBody = new CANNON.Body({ mass: 0 });
    floorBody.addShape(floorShape);
    floorBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    world.addBody(floorBody);
}

// Cargar modelo del robot
function loadRobotModel() {
    console.log('📦 Cargando modelo robotmiov2.glb...');
    
    const loader = new THREE.GLTFLoader();
    const loadingManager = new THREE.LoadingManager();
    loadingManager.onError = (url) => {
        console.warn('⚠️ Error cargando recurso:', url);
    };
    loader.manager = loadingManager;
    
    loader.load(
        config.modelPath,
        (gltf) => {
            console.log('✅ Modelo GLB cargado exitosamente!', gltf);
            
            robot = gltf.scene;
            
            robot.rotation.x = 0;
            robot.rotation.y = 0.1;
            robot.rotation.z = 0;
            
            robotState.baseRotation.x = robot.rotation.x;
            robotState.baseRotation.y = robot.rotation.y;
            robotState.baseRotation.z = robot.rotation.z;
            
            const box = new THREE.Box3().setFromObject(robot);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            const targetHeight = 2.3;
            const currentHeight = size.y;
            const scale = targetHeight / currentHeight;
            robot.scale.set(scale, scale, scale);
            
            robot.scale._baseScale = scale;
            
            const newBox = new THREE.Box3().setFromObject(robot);
            const newCenter = newBox.getCenter(new THREE.Vector3());
            
            robot.position.x = -newCenter.x * 0.95;
            robot.position.y = -newBox.min.y;
            robot.position.z = -newCenter.z;
            
            robotBaseY = robot.position.y;
            
            // Crear cuerpo físico para el robot
            const robotShape = new CANNON.Box(new CANNON.Vec3(size.x/2 * scale, size.y/2 * scale, size.z/2 * scale));
            robotBody = new CANNON.Body({ mass: 0 }); // Masa 0 = estático
            robotBody.addShape(robotShape);
            robotBody.position.set(robot.position.x, robot.position.y + size.y/2 * scale, robot.position.z);
            world.addBody(robotBody);
            
            robot.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            scene.add(robot);
            
            if (gltf.animations && gltf.animations.length > 0) {
                console.log('🎬 Animaciones encontradas:', gltf.animations.length);
                
                mixer = new THREE.AnimationMixer(robot);
                
                gltf.animations.forEach((clip, index) => {
                    robotState.animations[clip.name] = mixer.clipAction(clip);
                    console.log(`  - ${index}: ${clip.name}`);
                });
                
                const firstAnimation = Object.values(robotState.animations)[0];
                if (firstAnimation) {
                    firstAnimation.play();
                    robotState.currentAnimation = firstAnimation;
                }
            }
            
            robotState.loaded = true;
            
            showMessage("¡Hola! Soy OptiBot 🤖 ¡Haz clic en mí para una sorpresa!", 'success');
        },
        (progress) => {
            const percentComplete = (progress.loaded / progress.total * 100).toFixed(2);
            console.log(`⏳ Cargando: ${percentComplete}%`);
            
            const loadingText = document.querySelector('.robot-loading p');
            if (loadingText) {
                loadingText.textContent = `Cargando robot... ${percentComplete}%`;
            }
        },
        (error) => {
            console.error('❌ Error al cargar el modelo:', error);
            showMessage("Error al cargar el robot 😢", 'error');
        }
    );
}

// Iniciar lluvia de dulces
function startCandyRain() {
    const currentTime = Date.now();
    if (currentTime - lastClickTime < rainCooldown || isRaining) {
        return; // Cooldown activo o ya está lloviendo
    }
    
    lastClickTime = currentTime;
    isRaining = true;
    
    console.log(`🍬 Iniciando lluvia de ${rainType}`);
    showMessage(rainType === 'candy' ? "¡Lluvia de caramelos! 🍬" : "¡Lluvia de fresas! 🍓", 'happy');
    
    let spawnedCount = 0;
    const totalToSpawn = 60; // Total de dulces a generar
    
    // Spawn gradual de dulces
    spawnInterval = setInterval(() => {
        if (spawnedCount >= totalToSpawn) {
            clearInterval(spawnInterval);
            return;
        }
        
        for (let i = 0; i < 3; i++) { // 3 dulces por intervalo
            if (spawnedCount < totalToSpawn) {
                spawnCandy();
                spawnedCount++;
            }
        }
    }, 100); // Cada 100ms
    
    // Limpiar después de 7 segundos
    cleanupTimeout = setTimeout(() => {
        stopCandyRain();
    }, 7000);
}

// Crear un dulce individual
function spawnCandy() {
    const model = rainType === 'candy' ? candyModel : strawberryModel;
    if (!model) return;
    
    // Clonar el modelo
    const candy = model.clone();
    
    // Posición aleatoria en el cielo
    const x = (Math.random() - 0.5) * 8;
    const y = 8 + Math.random() * 2;
    const z = (Math.random() - 0.5) * 8;
    
    candy.position.set(x, y, z);
    
    // Rotación aleatoria
    candy.rotation.x = Math.random() * Math.PI * 2;
    candy.rotation.y = Math.random() * Math.PI * 2;
    candy.rotation.z = Math.random() * Math.PI * 2;
    
    // Añadir sombras
    candy.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    
    scene.add(candy);
    
    // Crear cuerpo físico
    const shape = new CANNON.Sphere(0.2); // Radio de colisión
    const body = new CANNON.Body({
        mass: 0.1,
        shape: shape,
        position: new CANNON.Vec3(x, y, z)
    });
    
    // Añadir velocidad angular aleatoria
    body.angularVelocity.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
    );
    
    // Añadir un poco de velocidad lateral
    body.velocity.set(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
    );
    
    world.addBody(body);
    
    // Guardar referencia
    if (rainType === 'candy') {
        candyMeshes.push(candy);
        candyBodies.push(body);
    } else {
        strawberryMeshes.push(candy);
        strawberryBodies.push(body);
    }
}

// Detener lluvia y limpiar
function stopCandyRain() {
    isRaining = false;
    
    if (spawnInterval) {
        clearInterval(spawnInterval);
        spawnInterval = null;
    }
    
    if (cleanupTimeout) {
        clearTimeout(cleanupTimeout);
        cleanupTimeout = null;
    }
    
    // Fade out y limpiar dulces
    const fadeOutDuration = 1000;
    const startTime = Date.now();
    
    const fadeOut = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / fadeOutDuration, 1);
        const opacity = 1 - progress;
        
        // Aplicar fade a todos los dulces
        [...candyMeshes, ...strawberryMeshes].forEach(candy => {
            candy.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material.opacity = opacity;
                    child.material.transparent = true;
                }
            });
        });
        
        if (progress < 1) {
            requestAnimationFrame(fadeOut);
        } else {
            // Limpiar completamente
            cleanupCandies();
            
            // Alternar tipo para próxima lluvia
            rainType = rainType === 'candy' ? 'strawberry' : 'candy';
        }
    };
    
    fadeOut();
}

// Limpiar todos los dulces
function cleanupCandies() {
    // Remover meshes de candy
    candyMeshes.forEach(candy => {
        scene.remove(candy);
        candy.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    });
    
    // Remover cuerpos físicos de candy
    candyBodies.forEach(body => {
        world.removeBody(body);
    });
    
    // Remover meshes de strawberry
    strawberryMeshes.forEach(strawberry => {
        scene.remove(strawberry);
        strawberry.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    });
    
    // Remover cuerpos físicos de strawberry
    strawberryBodies.forEach(body => {
        world.removeBody(body);
    });
    
    // Limpiar arrays
    candyMeshes = [];
    candyBodies = [];
    strawberryMeshes = [];
    strawberryBodies = [];
}

// Configurar eventos
function setupEvents() {
    const container = renderer.domElement;
    
    document.addEventListener('mousemove', onDocumentMouseMove, false);
    
    // Click en el robot para lluvia
    container.addEventListener('click', onRobotClick, false);
    
    window.addEventListener('resize', onWindowResize, false);
    
    container.addEventListener('mouseenter', () => {
        robotState.isHovered = true;
    });
    
    container.addEventListener('mouseleave', () => {
        robotState.isHovered = false;
    });
}

// Eventos
function onDocumentMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
    
    const xMultiplier = window._invertY ? 1 : -1;
    const yMultiplier = window._invertX ? -1 : 1;
    
    targetRotationY = mouseX * window.maxRotationY * yMultiplier;
    targetRotationX = mouseY * window.maxRotationX * xMultiplier * window._verticalScale;
}

function onRobotClick() {
    if (!robotState.loaded) return;
    
    // Iniciar lluvia de dulces
    startCandyRain();
    
    // Pequeño salto del robot
    if (robot) {
        const jumpAnimation = () => {
            const startY = robotBaseY;
            const jumpHeight = 0.2;
            const duration = 300;
            const startTime = Date.now();
            
            const animateJump = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
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
    
    // Actualizar física
    if (world) {
        world.step(1/60);
        
        // Sincronizar dulces con física
        candyMeshes.forEach((candy, index) => {
            if (candyBodies[index]) {
                candy.position.copy(candyBodies[index].position);
                candy.quaternion.copy(candyBodies[index].quaternion);
            }
        });
        
        strawberryMeshes.forEach((strawberry, index) => {
            if (strawberryBodies[index]) {
                strawberry.position.copy(strawberryBodies[index].position);
                strawberry.quaternion.copy(strawberryBodies[index].quaternion);
            }
        });
    }
    
    // Actualizar mixer de animaciones
    if (mixer) {
        const delta = clock.getDelta();
        mixer.update(delta);
    }
    
    // Animaciones del robot
    if (robot && robotState.loaded) {
        robot.position.y = robotBaseY + Math.sin(Date.now() * 0.001) * 0.05;
        
        if (robotState.isFollowing) {
            currentRotationY += (targetRotationY - currentRotationY) * window.rotationSpeed;
            currentRotationX += (targetRotationX - currentRotationX) * window.rotationSpeed;
        } else {
            currentRotationY += (0 - currentRotationY) * window.rotationSpeed;
            currentRotationX += (0 - currentRotationX) * window.rotationSpeed;
        }
        
        robot.rotation.y = robotState.baseRotation.y + currentRotationY;
        robot.rotation.x = robotState.baseRotation.x + currentRotationX;
        
        const breathingEffect = Math.sin(Date.now() * 0.002) * 0.005;
        if (robot.scale._baseScale) {
            robot.scale.y = robot.scale._baseScale * (1 + breathingEffect);
        }
        
        // Actualizar posición del cuerpo físico del robot
        if (robotBody) {
            robotBody.position.y = robot.position.y + 1.15; // Centrar el cuerpo
        }
        
        const container = document.getElementById('warehouse3d');
        if (container) {
            if (Math.abs(currentRotationY) > window.maxRotationY * 0.9 || 
                Math.abs(currentRotationX) > window.maxRotationX * 0.9) {
                container.classList.add('at-limit');
            } else {
                container.classList.remove('at-limit');
            }
            
            if (robotState.isFollowing) {
                container.classList.add('following-cursor');
            } else {
                container.classList.remove('following-cursor');
            }
        }
    }
    
    renderer.render(scene, camera);
}

// Sistema de mensajes
let messageTimeout;
function showMessage(text, type = 'info') {
    if (messageTimeout) clearTimeout(messageTimeout);
    
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
    
    container.innerHTML = '';
    
    const bubble = document.createElement('div');
    bubble.className = `robot-bubble ${type}`;
    bubble.innerHTML = `
        <div class="bubble-tail"></div>
        <div class="bubble-content">
            <div class="bubble-text">${text}</div>
            <div class="bubble-time">${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
    `;
    
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
        happy: '#ec4899'
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
        console.log(`🎭 Cambiando mood a: ${mood}`);
    },
    
    setFollowSpeed: (speed) => {
        window.rotationSpeed = Math.max(0.01, Math.min(0.2, speed));
        console.log('⚡ Velocidad de seguimiento:', window.rotationSpeed);
    },
    
    setMaxRotation: (horizontal, vertical) => {
        if (horizontal !== undefined) {
            window.maxRotationY = horizontal;
        }
        if (vertical !== undefined) {
            window.maxRotationX = vertical;
        }
    },
    
    toggleFollowing: () => {
        robotState.isFollowing = !robotState.isFollowing;
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
    },
    
    rotateRobot: (angleY) => {
        if (robot && robotState.loaded) {
            robot.rotation.y += angleY;
            robotState.baseRotation.y = robot.rotation.y;
        }
    },
    
    resetRotation: () => {
        if (robot && robotState.loaded) {
            robot.rotation.y = 0.1;
            robotState.baseRotation.y = robot.rotation.y;
        }
    },
    
    // Método adicional para forzar lluvia (debugging)
    forceRain: (type) => {
        if (type) rainType = type;
        lastClickTime = 0; // Reset cooldown
        startCandyRain();
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

// Cargar Cannon.js (versión clásica que funciona en navegador)
const cannonScript = document.createElement('script');
cannonScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/cannon.js/0.6.2/cannon.min.js';
cannonScript.onload = () => {
    console.log('✅ Cannon.js cargado correctamente');
    
    // Iniciar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initRealisticRobot);
    } else {
        setTimeout(initRealisticRobot, 100);
    }
};
cannonScript.onerror = () => {
    console.error('❌ Error cargando Cannon.js');
};
document.head.appendChild(cannonScript);

console.log('Sistema de lluvia de dulces activado');
console.log('Haz clic en el robot para ver la lluvia');
console.log('Cooldown de 8 segundos entre lluvias');
console.log('Alterna entre candy.glb y strawberry.glb');