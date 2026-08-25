import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { KayakParameters } from "../kayakGeometry/types";
import { KayakBuilder } from "../kayakGeometry/KayakBuilder";

interface ThreeViewportProps {
  params: KayakParameters;
  builder: KayakBuilder;
  viewMode: "perspective" | "plan" | "side";
  showPhysics: boolean;
  showRibs: boolean;
  showDimensions: boolean;
  draft: number;
  vcb: number;
  lcb: number;
}

// Technical Sprite Text for CAD dimensions
function createTextSprite(text: string, colorStr = "#14231a", fontSize = 24): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const lines = text.split("\n");
  canvas.width = 256;
  canvas.height = lines.length > 1 ? 96 : 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    ctx.fillStyle = colorStr;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (lines.length > 1) {
      ctx.fillText(lines[0], canvas.width / 2, canvas.height / 3);
      ctx.fillText(lines[1], canvas.width / 2, (canvas.height * 2) / 3);
    } else {
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(16, lines.length > 1 ? 6 : 4, 1);
  return sprite;
}

export default function ThreeViewport({
  params,
  builder,
  viewMode,
  showPhysics,
  showRibs,
  showDimensions,
  draft,
  vcb,
  lcb,
}: ThreeViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const paramsRef = useRef(params);
  paramsRef.current = params;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const vcbRef = useRef(vcb);
  vcbRef.current = vcb;
  const lcbRef = useRef(lcb);
  lcbRef.current = lcb;

  const showPhysicsRef = useRef(showPhysics);
  showPhysicsRef.current = showPhysics;
  const showRibsRef = useRef(showRibs);
  showRibsRef.current = showRibs;
  const showDimensionsRef = useRef(showDimensions);
  showDimensionsRef.current = showDimensions;

  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  const pCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const oCameraRef = useRef<THREE.OrthographicCamera | null>(null);

  // Group holds all dynamic kayak geometries
  const kayakGroupRef = useRef<THREE.Group>(new THREE.Group());

  const sternSpriteRef = useRef<THREE.Sprite | null>(null);
  const bowSpriteRef = useRef<THREE.Sprite | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeae7df); // Driftwood tan CAD background
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0xeae7df, 0.0015);

    // 2. Setup Cameras
    const w = mountRef.current.clientWidth || 800;
    const h = mountRef.current.clientHeight || 500;

    const pCamera = new THREE.PerspectiveCamera(38, w / h, 1, 1000);
    pCamera.position.set(130, 75, 150);
    pCameraRef.current = pCamera;

    const oCamera = new THREE.OrthographicCamera(w / -4, w / 4, h / 4, h / -4, 1, 1000);
    oCamera.position.set(0, 150, 0);
    oCameraRef.current = oCamera;

    // 3. Setup Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const widthVal = entry.contentRect.width || mountRef.current?.clientWidth || 800;
        const heightVal = entry.contentRect.height || mountRef.current?.clientHeight || 500;

        if (rendererRef.current) {
          renderer.setSize(widthVal, heightVal);
        }
        if (pCameraRef.current) {
          pCamera.aspect = widthVal / heightVal;
          pCamera.updateProjectionMatrix();
        }
        if (oCameraRef.current) {
          oCamera.left = widthVal / -4;
          oCamera.right = widthVal / 4;
          oCamera.top = heightVal / 4;
          oCamera.bottom = heightVal / -4;
          oCamera.updateProjectionMatrix();
        }
      }
    });

    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }

    // 4. Setup Controls
    const controls = new OrbitControls(pCamera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 20;
    controls.maxDistance = 450;
    controlsRef.current = controls;

    // 5. Add Lights (Rhino Shaded Mode emulation with key light and fill light)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
    keyLight.position.set(80, 160, 60);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.001;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xfff5ea, 0.35);
    fillLight.position.set(-80, 60, -60);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xe0f0ff, 0.25);
    rimLight.position.set(0, -50, 0);
    scene.add(rimLight);

    // Dynamic grid floor (CAD style)
    const gridHelper = new THREE.GridHelper(300, 30, 0xb0b7b2, 0xdcdfd9);
    gridHelper.position.y = -1.5;
    scene.add(gridHelper);

    // Rhino style axis indicator
    const axesHelper = new THREE.AxesHelper(15);
    axesHelper.position.set(-150, -1.0, -40);
    scene.add(axesHelper);

    // Add Bow and Stern annotation sprites
    const sternSprite = createTextSprite("STERN", "#ff5555", 28);
    sternSprite.scale.set(16, 4, 1);
    scene.add(sternSprite);
    sternSpriteRef.current = sternSprite;

    const bowSprite = createTextSprite("BOW", "#33a3ff", 28);
    bowSprite.scale.set(16, 4, 1);
    scene.add(bowSprite);
    bowSpriteRef.current = bowSprite;

    // Add Kayak geometries group
    scene.add(kayakGroupRef.current);

    // Rebuild mesh initially
    updateKayakGeometries();

    // 6. Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const activeCamera = viewModeRef.current === "perspective" ? pCamera : oCamera;

      if (viewModeRef.current === "perspective") {
        controls.update();
      }

      renderer.render(scene, activeCamera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current) return;
      const widthVal = mountRef.current.clientWidth;
      const heightVal = mountRef.current.clientHeight;

      pCamera.aspect = widthVal / heightVal;
      pCamera.updateProjectionMatrix();

      oCamera.left = widthVal / -4;
      oCamera.right = widthVal / 4;
      oCamera.top = heightVal / 4;
      oCamera.bottom = heightVal / -4;
      oCamera.updateProjectionMatrix();

      rendererRef.current.setSize(widthVal, heightVal);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      window.removeEventListener("resize", handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
      controls.dispose();
    };
  }, []);

  // Handle camera switching
  useEffect(() => {
    if (!controlsRef.current || !pCameraRef.current || !oCameraRef.current) return;

    if (viewMode === "plan") {
      oCameraRef.current.position.set(0, 160, 0);
      oCameraRef.current.lookAt(0, 0, 0);
      oCameraRef.current.zoom = 2.4;
      oCameraRef.current.updateProjectionMatrix();
    } else if (viewMode === "side") {
      oCameraRef.current.position.set(0, 0, 160);
      oCameraRef.current.lookAt(0, 0, 0);
      oCameraRef.current.zoom = 2.4;
      oCameraRef.current.updateProjectionMatrix();
    } else {
      controlsRef.current.target.set(0, params.hullHeight / 3, 0);
      controlsRef.current.update();
    }
  }, [viewMode, params.length, params.hullHeight]);

  useEffect(() => {
    updateKayakGeometries();
  }, [params, showPhysics, showRibs, showDimensions, draft, vcb, lcb]);

  const updateKayakGeometries = () => {
    const group = kayakGroupRef.current;
    if (!group) return;

    // Clear old children
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const currentParams = paramsRef.current;
    const L = currentParams.length * 12;
    const halfL = L / 2;



    // Elegant materials: Option A (Scandinavian Birch & Clay CAD palette)
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0xb0b9b3,      // Warm Pewter / Pale Satin Slate
      roughness: 0.30,
      metalness: 0.06,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0xe2e8e4,      // Chalk Satin / Off-White Clay
      roughness: 0.38,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });

    const technicalLineMaterial = new THREE.LineBasicMaterial({
      color: 0x181e1a,      // Deep Charcoal
      linewidth: 1.5,
      transparent: true,
      opacity: 0.85
    });

    // 1. Generate and Shift Hull Mesh
    const hullData = builder.generateHullMesh();
    const hullGeo = new THREE.BufferGeometry();
    hullGeo.setAttribute("position", new THREE.BufferAttribute(hullData.vertices, 3));
    hullGeo.setAttribute("uv", new THREE.BufferAttribute(hullData.uvs, 2));

    const posAttr = hullGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setX(i, posAttr.getX(i) - halfL); // shift center to X=0
    }
    hullGeo.setIndex(new THREE.BufferAttribute(hullData.indices, 1));
    hullGeo.computeVertexNormals();

    const hullMesh = new THREE.Mesh(hullGeo, hullMaterial);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    group.add(hullMesh);

    // 2. Generate and Shift Deck Mesh
    const deckData = builder.generateDeckMesh();
    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute("position", new THREE.BufferAttribute(deckData.vertices, 3));
    deckGeo.setAttribute("uv", new THREE.BufferAttribute(deckData.uvs, 2));

    const dPosAttr = deckGeo.attributes.position;
    for (let i = 0; i < dPosAttr.count; i++) {
      dPosAttr.setX(i, dPosAttr.getX(i) - halfL);
    }
    deckGeo.setIndex(new THREE.BufferAttribute(deckData.indices, 1));
    deckGeo.computeVertexNormals();

    const deckMesh = new THREE.Mesh(deckGeo, deckMaterial);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    group.add(deckMesh);

    // 3. Generate Cockpit Coaming Rim
    const sternDeckZ = builder.sternDeckZ;

    const getGunwaleAndDeckHeight = (xVal: number) => {
      const gunLeft = builder.gunwale.getLeftPointAtX(xVal);
      const dPtUntrimmed = builder.deckLine.getUntrimmedPointAtX(xVal);
      const planeZ = sternDeckZ + xVal * builder.slope;
      const yFlat = builder.getFlatPlaneWidth(xVal, planeZ, Math.abs(gunLeft.y), dPtUntrimmed.z);
      return {
        gunwaleY: Math.abs(gunLeft.y),
        gunwaleZ: gunLeft.z,
        deckZ: dPtUntrimmed.z,
        yFlat
      };
    };

    const coamingData = builder.cockpit.generateCoamingMesh(
      currentParams,
      sternDeckZ,
      builder.slope,
      halfL,
      getGunwaleAndDeckHeight,
      builder.facetOutlineCurve
    );

    const coamingGeo = new THREE.BufferGeometry();
    coamingGeo.setAttribute("position", new THREE.BufferAttribute(coamingData.vertices, 3));
    coamingGeo.setIndex(new THREE.BufferAttribute(coamingData.indices, 1));
    coamingGeo.computeVertexNormals();

    const coamingMaterial = new THREE.MeshStandardMaterial({
      color: 0x422918, // Rich Walnut
      roughness: 0.32,
      metalness: 0.08,
      side: THREE.DoubleSide
    });

    const coamingMesh = new THREE.Mesh(coamingGeo, coamingMaterial);
    coamingMesh.castShadow = true;
    coamingMesh.receiveShadow = true;
    group.add(coamingMesh);

    // 4. Draw CAD Style Outlines (Rhino Edge outlines)
    // Keel profile curve outline
    const keelPoints: THREE.Vector3[] = [];
    const keelDivs = 60;
    for (let i = 0; i <= keelDivs; i++) {
      const x = (i / keelDivs) * L;
      const pt = builder.keel.getPointAtX(x);
      keelPoints.push(new THREE.Vector3(pt.x - halfL, pt.z, pt.y));
    }
    const keelLineGeo = new THREE.BufferGeometry().setFromPoints(keelPoints);
    const keelLine = new THREE.Line(keelLineGeo, technicalLineMaterial);
    group.add(keelLine);

    // Gunwale left outline
    const gLeftPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= keelDivs; i++) {
      const x = (i / keelDivs) * L;
      const pt = builder.gunwale.getLeftPointAtX(x);
      gLeftPoints.push(new THREE.Vector3(pt.x - halfL, pt.z, pt.y));
    }
    const glGeo = new THREE.BufferGeometry().setFromPoints(gLeftPoints);
    const glLine = new THREE.Line(glGeo, technicalLineMaterial);
    group.add(glLine);

    // Gunwale right outline
    const gRightPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= keelDivs; i++) {
      const x = (i / keelDivs) * L;
      const pt = builder.gunwale.getRightPointAtX(x);
      gRightPoints.push(new THREE.Vector3(pt.x - halfL, pt.z, pt.y));
    }
    const grGeo = new THREE.BufferGeometry().setFromPoints(gRightPoints);
    const grLine = new THREE.Line(grGeo, technicalLineMaterial);
    group.add(grLine);

    // Flat deck facet boundary outline (evaluated from the smooth NURBS curve)
    if (showRibsRef.current) {
      const facetPoints: THREE.Vector3[] = [];
      if (builder.facetOutlineCurve) {
        const facetDivs = 80;
        const domain = builder.facetOutlineCurve.domain;
        for (let i = 0; i <= facetDivs; i++) {
          const t = domain[0] + (i / facetDivs) * (domain[1] - domain[0]);
          const pt = builder.facetOutlineCurve.pointAt(t);
          // Map to Three.js coordinates: X = length - halfL, Y = height, Z = width
          facetPoints.push(new THREE.Vector3(pt[0] - halfL, pt[1], pt[2]));
        }
      }

      const facetLineGeo = new THREE.BufferGeometry().setFromPoints(facetPoints);
      const facetLineMaterial = new THREE.LineBasicMaterial({
        color: 0x14231a, // Black
        linewidth: 1
      });
      const facetLine = new THREE.Line(facetLineGeo, facetLineMaterial);
      group.add(facetLine);
    }

    // Deck Centerline outline
    const deckCenterPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= keelDivs; i++) {
      const x = (i / keelDivs) * L;
      const pt = builder.deckLine.getPointAtX(x);
      deckCenterPoints.push(new THREE.Vector3(pt.x - halfL, pt.z, pt.y));
    }
    const dcGeo = new THREE.BufferGeometry().setFromPoints(deckCenterPoints);
    const dcLine = new THREE.Line(dcGeo, technicalLineMaterial);
    group.add(dcLine);

    // 5. Render Plywood Stations/Ribs (Continuous Closed Profile Curves)
    if (showRibsRef.current) {
      const stations = builder.generateStations(0);
      const ribMaterial = new THREE.LineBasicMaterial({
        color: 0x111614, // Deep Charcoal / Jet Black
        linewidth: 2,
      });

      stations.forEach((st) => {
        const xOffset = st.x - halfL;
        const pts = st.closedProfile.map(p => new THREE.Vector3(xOffset, p.z, p.y));
        const ribGeo = new THREE.BufferGeometry().setFromPoints(pts);
        group.add(new THREE.LineLoop(ribGeo, ribMaterial));
      });
    }

    // 7. Physics Overlays
    if (showPhysicsRef.current) {
      const activeDraft = draftRef.current;

      // Waterline plane (semitransparent light blue)
      const wlGeo = new THREE.PlaneGeometry(350, 90);
      const wlMat = new THREE.MeshBasicMaterial({
        color: 0x5a9be5,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      });
      const wlMesh = new THREE.Mesh(wlGeo, wlMat);
      wlMesh.rotation.x = -Math.PI / 2;
      wlMesh.position.set(0, activeDraft, 0);
      group.add(wlMesh);

      // Center of Buoyancy (Green)
      const cbGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const cbMat = new THREE.MeshBasicMaterial({ color: 0x8fbc8f });
      const cbMarker = new THREE.Mesh(cbGeo, cbMat);
      cbMarker.position.set(lcbRef.current - halfL, vcbRef.current, 0);
      group.add(cbMarker);

      // Center of Gravity (Coral)
      const occupantKG = 2.0;
      const kayakKG = currentParams.hullHeight * 0.6;
      const cgZ = (180 * occupantKG + 45 * kayakKG) / (180 + 45);

      const cgGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const cgMat = new THREE.MeshBasicMaterial({ color: 0xff7a5c });
      const cgMarker = new THREE.Mesh(cgGeo, cgMat);
      cgMarker.position.set(lcbRef.current - halfL, cgZ, 0);
      group.add(cgMarker);

      // Stability Vector line
      const vectorPoints = [
        new THREE.Vector3(lcbRef.current - halfL, vcbRef.current, 0),
        new THREE.Vector3(lcbRef.current - halfL, cgZ, 0)
      ];
      const vectorGeo = new THREE.BufferGeometry().setFromPoints(vectorPoints);
      group.add(new THREE.Line(vectorGeo, new THREE.LineBasicMaterial({ color: 0x14231a, transparent: true, opacity: 0.5 })));
    }

    // 8. CAD Dimensions
    if (sternSpriteRef.current) sternSpriteRef.current.visible = showDimensionsRef.current;
    if (bowSpriteRef.current) bowSpriteRef.current.visible = showDimensionsRef.current;

    if (showDimensionsRef.current) {
      const dimensionLineMaterial = new THREE.LineBasicMaterial({
        color: 0x14231a,
        transparent: true,
        opacity: 0.35, // Lighter to look half as thick
      });

      const lengthY = -8;
      const lengthZ = 0;

      if (sternSpriteRef.current) {
        sternSpriteRef.current.position.set(-halfL - 8, lengthY, lengthZ);
      }
      if (bowSpriteRef.current) {
        bowSpriteRef.current.position.set(halfL + 8, lengthY, lengthZ);
      }

      // Length Dimension Line
      const lengthPoints = [
        new THREE.Vector3(-halfL, lengthY - 2, lengthZ),
        new THREE.Vector3(-halfL, lengthY + 2, lengthZ),
        new THREE.Vector3(-halfL, lengthY, lengthZ),
        new THREE.Vector3(halfL, lengthY, lengthZ),
        new THREE.Vector3(halfL, lengthY + 2, lengthZ),
        new THREE.Vector3(halfL, lengthY - 2, lengthZ)
      ];
      const lengthLineGeo = new THREE.BufferGeometry().setFromPoints(lengthPoints);
      group.add(new THREE.Line(lengthLineGeo, dimensionLineMaterial));

      // 6-inch Ticks along the length axis
      const tickPoints: THREE.Vector3[] = [];
      for (let xOffset = -halfL; xOffset <= halfL; xOffset += 6) {
        tickPoints.push(new THREE.Vector3(xOffset, lengthY - 0.6, lengthZ));
        tickPoints.push(new THREE.Vector3(xOffset, lengthY + 0.6, lengthZ));
      }
      const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPoints);
      const tickLine = new THREE.LineSegments(tickGeo, dimensionLineMaterial);
      group.add(tickLine);

      const dimensionsText = `L: ${currentParams.length.toFixed(1)} ft\nB: ${currentParams.beam.toFixed(1)} in`;
      const dimensionsLabel = createTextSprite(dimensionsText, "#14231a", 24);
      dimensionsLabel.position.set(0, lengthY - 4.5, lengthZ);
      group.add(dimensionsLabel);
    }

  };

  return <div ref={mountRef} className="canvas-container" />;
}
