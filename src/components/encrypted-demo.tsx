"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import styles from "./encrypted-demo.module.css";

const phases = [
  {
    id: "sealed",
    label: "Encrypted",
    heading: "Encrypted transport",
    description:
      "The seller’s sample enters a protected channel. The buyer never receives the file.",
    signal: "INPUT SEALED",
  },
  {
    id: "evaluated",
    label: "Evaluated",
    heading: "Private evaluation",
    description:
      "0G evaluates the buyer’s question inside protected compute while the raw rows stay sealed.",
    signal: "COMPUTE ACTIVE",
  },
  {
    id: "verified",
    label: "Verified",
    heading: "Verified answer",
    description:
      "Only a question-level score, explanation, and TEE verification leave the chamber.",
    signal: "PROOF READY",
  },
] as const;

export function EncryptedDemo() {
  const [phase, setPhase] = useState(0);
  const activePhase = phases[phase];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <span aria-hidden="true">C</span>
          CipherQuery
        </Link>
        <p>Interaction study · protected evaluation</p>
        <Link className={styles.exit} href="/">
          Exit demo
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.copy} aria-labelledby="demo-title">
          <p className={styles.eyebrow}>Private data intelligence</p>
          <h1 id="demo-title">
            See the answer.
            <span>Never the rows.</span>
          </h1>
          <p className={styles.lede}>
            CipherQuery turns a buyer’s question and a seller’s private sample
            into one verified result—without handing over the source data.
          </p>

          <div className={styles.actions}>
            <Link className={styles.primaryAction} href="/new">
              Create an evaluation
              <span aria-hidden="true">↗</span>
            </Link>
            <Link className={styles.textAction} href="/docs">
              Read how privacy works
            </Link>
          </div>

          <div className={styles.phasePanel}>
            <div
              className={styles.phaseTabs}
              role="tablist"
              aria-label="Protected evaluation stages"
            >
              {phases.map((item, index) => (
                <button
                  aria-controls={`phase-panel-${item.id}`}
                  aria-selected={phase === index}
                  className={phase === index ? styles.activeTab : undefined}
                  id={`phase-tab-${item.id}`}
                  key={item.id}
                  onClick={() => setPhase(index)}
                  role="tab"
                  type="button"
                >
                  <span>0{index + 1}</span>
                  {item.label}
                </button>
              ))}
            </div>

            <div
              aria-live="polite"
              className={styles.phaseCopy}
              id={`phase-panel-${activePhase.id}`}
              role="tabpanel"
              aria-labelledby={`phase-tab-${activePhase.id}`}
            >
              <p>{activePhase.heading}</p>
              <span>{activePhase.description}</span>
            </div>
          </div>
        </section>

        <section className={styles.visual} aria-label="Encrypted evaluation model">
          <div className={styles.visualTopline}>
            <span>Protected computation chamber</span>
            <span className={styles.liveSignal}>
              <i aria-hidden="true" />
              {activePhase.signal}
            </span>
          </div>

          <CipherChamber phase={phase} />

          <div className={styles.visualFooter}>
            <div>
              <span>Raw rows exposed</span>
              <strong>0</strong>
            </div>
            <div>
              <span>Output</span>
              <strong>Question-level result</strong>
            </div>
            <div>
              <span>Execution</span>
              <strong>TEE verified</strong>
            </div>
          </div>
        </section>
      </main>

      <p className={styles.caption}>
        Drag your pointer across the chamber to inspect the privacy boundary.
      </p>
    </div>
  );
}

function CipherChamber({ phase }: { phase: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(phase);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0.15, 7.4);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.domElement.setAttribute("aria-hidden", "true");
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const chamber = new THREE.Group();
    scene.add(chamber);

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x172019,
      emissive: 0xb9f45a,
      emissiveIntensity: 0.14,
      metalness: 0.62,
      roughness: 0.24,
      clearcoat: 0.9,
      clearcoatRoughness: 0.18,
    });
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.15, 4),
      coreMaterial,
    );
    chamber.add(core);

    const boundaryMaterial = new THREE.MeshBasicMaterial({
      color: 0xdde8e2,
      opacity: 0.18,
      transparent: true,
      wireframe: true,
    });
    const boundary = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.62, 2),
      boundaryMaterial,
    );
    chamber.add(boundary);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xb9f45a,
      opacity: 0.055,
      side: THREE.BackSide,
      transparent: true,
    });
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(1.85, 48, 48),
      glowMaterial,
    );
    chamber.add(glow);

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x8f9b94,
      opacity: 0.35,
      transparent: true,
    });
    const rings = [
      new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.012, 6, 160), ringMaterial),
      new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.012, 6, 160), ringMaterial),
    ];
    rings[0].rotation.x = Math.PI / 2.65;
    rings[1].rotation.set(Math.PI / 2.25, Math.PI / 2.2, 0);
    chamber.add(...rings);

    const packetMaterial = new THREE.MeshStandardMaterial({
      color: 0xb9f45a,
      emissive: 0xb9f45a,
      emissiveIntensity: 1.1,
      metalness: 0.1,
      roughness: 0.3,
    });
    const packetGeometry = new THREE.OctahedronGeometry(0.075, 0);
    const packets = Array.from({ length: 9 }, (_, index) => {
      const mesh = new THREE.Mesh(packetGeometry, packetMaterial);
      mesh.userData.angle = (index / 9) * Math.PI * 2;
      mesh.userData.speed = 0.12 + (index % 3) * 0.025;
      chamber.add(mesh);
      return mesh;
    });

    const ambient = new THREE.HemisphereLight(0xd8e8df, 0x07100a, 1.25);
    scene.add(ambient);

    const keyLight = new THREE.SpotLight(
      0xb9f45a,
      65,
      16,
      Math.PI / 5,
      0.85,
      2,
    );
    keyLight.position.set(3.8, 4.5, 5);
    keyLight.target.position.set(0, 0, 0);
    scene.add(keyLight, keyLight.target);

    const fillLight = new THREE.PointLight(0x8ea8ff, 24, 12, 2);
    fillLight.position.set(-3.5, -1.5, 4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xe8fff1, 38, 10, 2);
    rimLight.position.set(1.8, 2.5, -3);
    scene.add(rimLight);

    const pointer = new THREE.Vector2();
    let lastTime = window.performance.now();
    let elapsed = 0;
    let animationFrame = 0;

    const resize = () => {
      const { clientHeight, clientWidth } = container;
      renderer.setSize(clientWidth, clientHeight, false);
      camera.aspect = clientWidth / Math.max(clientHeight, 1);
      camera.updateProjectionMatrix();
    };

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect();
      pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    container.addEventListener("pointermove", handlePointerMove);
    resize();

    const render = (now = window.performance.now()) => {
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += delta;
      const activePhase = phaseRef.current;
      const motion = prefersReducedMotion ? 0 : 1;
      const targetScale = [0.9, 1.02, 1.08][activePhase];

      chamber.scale.lerp(
        new THREE.Vector3(targetScale, targetScale, targetScale),
        1 - Math.pow(0.001, delta),
      );
      chamber.rotation.y += delta * (0.09 + activePhase * 0.035) * motion;
      chamber.rotation.x +=
        (pointer.y * 0.1 * motion - chamber.rotation.x) * delta * 2.5;
      chamber.rotation.z +=
        (-pointer.x * 0.08 * motion - chamber.rotation.z) * delta * 2.5;
      camera.position.x +=
        (pointer.x * 0.24 * motion - camera.position.x) * delta * 2.2;
      camera.position.y +=
        (0.15 + pointer.y * 0.18 * motion - camera.position.y) * delta * 2.2;
      camera.lookAt(0, 0, 0);

      core.rotation.x += delta * 0.07 * motion;
      core.rotation.y -= delta * 0.12 * motion;
      boundary.rotation.x -= delta * 0.06 * motion;
      boundary.rotation.y += delta * 0.1 * motion;
      boundaryMaterial.opacity +=
        ([0.1, 0.2, 0.34][activePhase] - boundaryMaterial.opacity) *
        delta *
        3;
      coreMaterial.emissiveIntensity +=
        ([0.08, 0.2, 0.42][activePhase] - coreMaterial.emissiveIntensity) *
        delta *
        3;
      glowMaterial.opacity +=
        ([0.035, 0.07, 0.12][activePhase] - glowMaterial.opacity) * delta * 3;
      keyLight.intensity +=
        ([32, 62, 88][activePhase] - keyLight.intensity) * delta * 3;

      packets.forEach((packet, index) => {
        const angle =
          packet.userData.angle +
          elapsed * packet.userData.speed * motion * (activePhase + 1);
        const radius = [2.7, 2.2, 1.82][activePhase];
        packet.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle * 1.3 + index) * 0.8,
          Math.sin(angle) * radius * 0.42,
        );
        packet.scale.setScalar(activePhase === 2 ? 1.25 : 1);
      });

      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      container.removeEventListener("pointermove", handlePointerMove);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return <div className={styles.chamber} ref={containerRef} />;
}
