import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { 
  type KayakParameters, 
  generateHullMesh, 
  generateDeckMesh, 
  generateRibStations,
  getDeckZ,
  getRibStation 
} from "../kayakGeometry";

interface ThreeViewportProps {
  params: KayakParameters;
  viewMode: "perspective" | "plan" | "side";
  showPhysics: boolean;
  showRibs: boolean;
  showStrips: boolean;
  showDimensions: boolean;
  draft: number;
  vcb: number; // Vertical center of buoyancy
  lcb: number; // Longitudinal center of buoyancy
}

// Canvas-based Sprite Text Helper for CAD dimensions
function createTextSprite(text: string, colorStr = "#14231a", fontSize = 24): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Technical CAD font
    ctx.font = `bold ${fontSize}px "JetBrains Mono", monospace`;
    ctx.fillStyle = colorStr;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  }
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(16, 4, 1); // Aspect ratio matches canvas (256/64 = 4)
  return sprite;
}

export default function ThreeViewport({
  params,
  viewMode,
  showPhysics,
  showRibs,
  showStrips,
  showDimensions,
  draft,
  vcb,
  lcb,
}: ThreeViewportProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  
  // Keep values in refs to avoid re-initializing the whole Three.js scene on every parameter slider move
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
  const showStripsRef = useRef(showStrips);
  showStripsRef.current = showStrips;
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

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xeae7df); // Driftwood tan CAD background
    sceneRef.current = scene;

    // Add subtle fog matching background
    scene.fog = new THREE.FogExp2(0xeae7df, 0.002);

    // 2. Setup Cameras
    const initialWidth = mountRef.current.clientWidth || 800;
    const initialHeight = mountRef.current.clientHeight || 500;

    const pCamera = new THREE.PerspectiveCamera(40, initialWidth / initialHeight, 1, 1000);
    pCamera.position.set(120, 80, 160);
    pCameraRef.current = pCamera;

    const oCamera = new THREE.OrthographicCamera(
      initialWidth / -4,
      initialWidth / 4,
      initialHeight / 4,
      initialHeight / -4,
      1,
      1000
    );
    oCamera.position.set(0, 150, 0); // Looking down
    oCameraRef.current = oCamera;

    // 3. Setup Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(initialWidth, initialHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Setup ResizeObserver to dynamically resize the canvas to its container size
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width || mountRef.current?.clientWidth || 800;
        const h = entry.contentRect.height || mountRef.current?.clientHeight || 500;

        if (rendererRef.current) {
          renderer.setSize(w, h);
        }
        if (pCameraRef.current) {
          pCamera.aspect = w / h;
          pCamera.updateProjectionMatrix();
        }
        if (oCameraRef.current) {
          oCamera.left = w / -4;
          oCamera.right = w / 4;
          oCamera.top = h / 4;
          oCamera.bottom = h / -4;
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
    controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't orbit fully under ground
    controls.minDistance = 20;
    controls.maxDistance = 400;
    controlsRef.current = controls;

    // 5. Add Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(100, 150, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-100, 50, -50);
    scene.add(fillLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(300, 30, 0x888888, 0xdddddd);
    gridHelper.position.y = -1; // place slightly below keel
    scene.add(gridHelper);

    // Add Kayak geometries group
    scene.add(kayakGroupRef.current);

    // Initial render trigger
    updateKayakGeometries();

    // 6. Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const activeCamera = viewModeRef.current === "perspective" ? pCameraRef.current : oCameraRef.current;
      
      if (viewModeRef.current === "perspective" && controlsRef.current) {
        controlsRef.current.update();
      }

      if (rendererRef.current && activeCamera && sceneRef.current) {
        rendererRef.current.render(sceneRef.current, activeCamera);
      }
    };
    animate();

    // 7. Handle Resize
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !pCameraRef.current || !oCameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;

      pCameraRef.current.aspect = w / h;
      pCameraRef.current.updateProjectionMatrix();

      oCameraRef.current.left = w / -4;
      oCameraRef.current.right = w / 4;
      oCameraRef.current.top = h / 4;
      oCameraRef.current.bottom = h / -4;
      oCameraRef.current.updateProjectionMatrix();

      rendererRef.current.setSize(w, h);
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
    if (!controlsRef.current || !pCameraRef.current || !oCameraRef.current || !mountRef.current) return;

    if (viewMode === "plan") {
      // Top down
      oCameraRef.current.position.set(0, 120, 0);
      oCameraRef.current.lookAt(0, 0, 0);
      oCameraRef.current.zoom = 2.2;
      oCameraRef.current.updateProjectionMatrix();
    } else if (viewMode === "side") {
      // Profile side view
      oCameraRef.current.position.set(0, 0, 120);
      oCameraRef.current.lookAt(0, 0, 0);
      oCameraRef.current.zoom = 2.2;
      oCameraRef.current.updateProjectionMatrix();
    } else {
      // Perspective Orbiting
      controlsRef.current.target.set(0, params.hullHeight / 3, 0);
      controlsRef.current.update();
    }
  }, [viewMode, params.length, params.hullHeight]);

  // Trigger geometry rebuilds when parameters or overlays change
  useEffect(() => {
    updateKayakGeometries();
  }, [params, showPhysics, showRibs, showStrips, showDimensions, draft, vcb, lcb]);

  const updateKayakGeometries = () => {
    const group = kayakGroupRef.current;
    if (!group) return;

    // Clear old children
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
    }

    const currentParams = paramsRef.current;
    const L = currentParams.length * 12;
    const halfL = L / 2;

    // Materials
    // Elegant forest green hull material with subtle wireframe overlay
    const hullMaterial = new THREE.MeshStandardMaterial({
      color: 0x2c4a3e, // Moss leaf green
      roughness: 0.15,
      metalness: 0.1,
      side: THREE.DoubleSide,
      flatShading: false,
    });

    const deckMaterial = new THREE.MeshStandardMaterial({
      color: 0x8fbc8f, // Sage meadow green
      roughness: 0.3,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    const ribMaterial = new THREE.LineBasicMaterial({
      color: 0x14231a, // Pine shadow (dark green/black) for high contrast on tan
      linewidth: 2,
    });

    // 1. Generate Hull Mesh
    const hullData = generateHullMesh(currentParams);
    const hullGeo = new THREE.BufferGeometry();
    hullGeo.setAttribute("position", new THREE.BufferAttribute(hullData.vertices, 3));
    hullGeo.setAttribute("uv", new THREE.BufferAttribute(hullData.uvs, 1));
    
    // Shift mesh vertices to center the boat in the view
    const posAttr = hullGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      posAttr.setX(i, x - halfL); // shift so center is X=0
    }
    hullGeo.setIndex(new THREE.BufferAttribute(hullData.indices, 1));
    hullGeo.computeVertexNormals();

    const hullMesh = new THREE.Mesh(hullGeo, hullMaterial);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    group.add(hullMesh);

    // 2. Generate Deck Mesh
    const deckData = generateDeckMesh(currentParams);
    const deckGeo = new THREE.BufferGeometry();
    deckGeo.setAttribute("position", new THREE.BufferAttribute(deckData.vertices, 3));
    deckGeo.setAttribute("uv", new THREE.BufferAttribute(deckData.uvs, 1));
    
    const dPosAttr = deckGeo.attributes.position;
    for (let i = 0; i < dPosAttr.count; i++) {
      const x = dPosAttr.getX(i);
      dPosAttr.setX(i, x - halfL);
    }
    deckGeo.setIndex(new THREE.BufferAttribute(deckData.indices, 1));
    deckGeo.computeVertexNormals();

    const deckMesh = new THREE.Mesh(deckGeo, deckMaterial);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    group.add(deckMesh);

    // 2b. Generate Cockpit Coaming Rim (Extruded along Tapered Deck Facet Normal)
    const facetStartX = currentParams.deckLongitudinalPeak * L;
    const activeCpStart = Math.min(currentParams.cockpitStart, facetStartX - 1.0 - currentParams.cockpitLength);
    const cpStart = activeCpStart;
    const cpLength = currentParams.cockpitLength;
    const cpWidth = currentParams.cockpitWidth;
    const cpCenterX = cpStart + cpLength / 2;
    
    const N = 40;
    const coamingVertices: number[] = [];
    const coamingIndices: number[] = [];
    
    const sternDeckZ = getDeckZ(0, currentParams);
    const peakDeckZ = currentParams.totalHeight;
    const getPlaneZ = (xVal: number) => {
      return sternDeckZ + (peakDeckZ - sternDeckZ) * (xVal / (facetStartX || 1));
    };

    // Calculate normal vector of the tilted deck facet plane in XZ (tx, ty)
    const dx = facetStartX - 0;
    const dyPlane = peakDeckZ - sternDeckZ; // height change
    const planeLen = Math.sqrt(dx * dx + dyPlane * dyPlane);
    // Normal vector pointing perpendicular/upwards from sloping plane:
    const nx = -dyPlane / (planeLen || 1);
    const ny = dx / (planeLen || 1);

    const coamingHeight = currentParams.coamingHeight !== undefined ? currentParams.coamingHeight : 0.75;
    
    const pPower = 1.0 + currentParams.deckVerticalCurvature * 2.2;
    
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * Math.PI * 2;
      const xc = (cpLength / 2) * Math.cos(angle);
      const yc = (cpWidth / 2) * Math.sin(angle);
      
      const xVal = cpCenterX + xc;
      const zVal = getPlaneZ(xVal); // Sloping flat deck plane height
      
      // Retrieve natural rib dimensions at this longitudinal position
      const station = getRibStation(xVal, currentParams);
      const gY = Math.abs(station.gunwaleLeft.y);
      const gZ = station.gunwaleLeft.z;
      const dZ_center = station.deckPt.z;
      
      // Calculate natural flat facet width and cap cockpit to naturalFacetY - 1.0 inch
      const yPctInt = Math.max(0, Math.min(1, (dZ_center - zVal) / (dZ_center - gZ || 1)));
      const naturalFacetY = Math.pow(yPctInt, 1 / pPower) * gY;
      const maxAllowedHalfWidth = Math.max(1.0, naturalFacetY - 1.0);
      const activeYc = Math.min(Math.abs(yc), maxAllowedHalfWidth) * Math.sign(yc);

      // Bottom point on the deck (Three.js coordinates: X=length, Y=height, Z=width)
      const tx = xVal - halfL;
      const ty = zVal;
      const tz = activeYc;
      
      // Top point extruded along the facet normal (nx, ny, 0)
      const txTop = tx + coamingHeight * nx;
      const tyTop = ty + coamingHeight * ny;
      const tzTop = tz; // no lateral tilt
      
      // Bottom vertex
      coamingVertices.push(tx, ty, tz);
      // Top vertex
      coamingVertices.push(txTop, tyTop, tzTop);
    }
    
    // Connect coaming loop with triangles
    for (let i = 0; i < N; i++) {
      const b1 = i * 2;
      const t1 = b1 + 1;
      const b2 = ((i + 1) % N) * 2;
      const t2 = b2 + 1;
      
      // Triangle 1: bottom1 -> bottom2 -> top1
      coamingIndices.push(b1, b2, t1);
      // Triangle 2: bottom2 -> top2 -> top1
      coamingIndices.push(b2, t2, t1);
    }
    
    const coamingGeo = new THREE.BufferGeometry();
    coamingGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(coamingVertices), 3));
    coamingGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(coamingIndices), 1));
    coamingGeo.computeVertexNormals();
    
    const coamingMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d2314, // Deep rich mahogany wood color
      roughness: 0.25,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    
    const coamingMesh = new THREE.Mesh(coamingGeo, coamingMaterial);
    coamingMesh.castShadow = true;
    coamingMesh.receiveShadow = true;
    group.add(coamingMesh);

    // 3. Render Cedar Strips (Procedural Longitudinal Lines)
    if (showStripsRef.current) {
      const stripLinesCount = 14;
      const uSegments = 50;
      const stripMaterial = new THREE.LineBasicMaterial({
        color: 0x8b5a2b, // Sienna wood brown for high contrast on green hull
        opacity: 0.4,
        transparent: true,
      });

      // We extract longitudinal lines by tracing constant V values in the hull mesh
      for (let s = 1; s < stripLinesCount; s++) {
        // vPct represents the girth slice percentage
        const vPct = s / stripLinesCount;
        const linePoints: THREE.Vector3[] = [];

        // Alternative direct mesh extraction (simpler and runs fast)
        const verticesPerRow = 21; // vSegments + 1
        for (let u = 0; u <= uSegments; u++) {
          // Map slider percentage to actual vertex coordinate
          const vIdx = Math.floor(vPct * 20);
          const baseIndex = (u * verticesPerRow + vIdx) * 3;
          const vx = hullData.vertices[baseIndex] - halfL;
          const vy = hullData.vertices[baseIndex + 1];
          const vz = hullData.vertices[baseIndex + 2];
          linePoints.push(new THREE.Vector3(vx, vy, vz));
        }

        const stripGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
        const stripLine = new THREE.Line(stripGeo, stripMaterial);
        group.add(stripLine);
      }
    }

    // 4. Render Transverse Ribs (Forms / Frames)
    if (showRibsRef.current) {
      const stations = generateRibStations(currentParams, 0);
      stations.forEach((st) => {
        const xOffset = st.x - halfL;

        // Draw Left Hull curve
        const hullLeftPts = st.hullCurveLeft.map(p => new THREE.Vector3(xOffset, p.z, p.y));
        const hlGeo = new THREE.BufferGeometry().setFromPoints(hullLeftPts);
        const hlLine = new THREE.Line(hlGeo, ribMaterial);
        group.add(hlLine);

        // Draw Right Hull curve
        const hullRightPts = st.hullCurveRight.map(p => new THREE.Vector3(xOffset, p.z, p.y));
        const hrGeo = new THREE.BufferGeometry().setFromPoints(hullRightPts);
        const hrLine = new THREE.Line(hrGeo, ribMaterial);
        group.add(hrLine);

        // Draw Left Deck curve
        const deckLeftPts = st.deckCurveLeft.map(p => new THREE.Vector3(xOffset, p.z, p.y));
        const dlGeo = new THREE.BufferGeometry().setFromPoints(deckLeftPts);
        const dlLine = new THREE.Line(dlGeo, ribMaterial);
        group.add(dlLine);

        // Draw Right Deck curve
        const deckRightPts = st.deckCurveRight.map(p => new THREE.Vector3(xOffset, p.z, p.y));
        const drGeo = new THREE.BufferGeometry().setFromPoints(deckRightPts);
        const drLine = new THREE.Line(drGeo, ribMaterial);
        group.add(drLine);

        // Add visual thickness to ribs (a 3D wireframe outline to make them look like 3/4" plywood)
        // Offset in X by +/- 0.375" (half of 3/4")
        const pt = currentParams.plywoodThickness;
        const offsets = [-pt / 2, pt / 2];
        offsets.forEach(off => {
          const xOffOff = xOffset + off;
          
          // Connect keel to gunwale
          const plyPoints = [
            new THREE.Vector3(xOffOff, st.keelPt.z, st.keelPt.y),
            new THREE.Vector3(xOffOff, st.gunwaleLeft.z, st.gunwaleLeft.y),
            new THREE.Vector3(xOffOff, st.deckPt.z, st.deckPt.y),
            new THREE.Vector3(xOffOff, st.gunwaleRight.z, st.gunwaleRight.y),
            new THREE.Vector3(xOffOff, st.keelPt.z, st.keelPt.y)
          ];
          const plyGeo = new THREE.BufferGeometry().setFromPoints(plyPoints);
          const plyLine = new THREE.Line(plyGeo, new THREE.LineBasicMaterial({ color: 0x8fbc8f, opacity: 0.3, transparent: true }));
          group.add(plyLine);
        });
      });
    }

    // 5. Physics Overlays
    if (showPhysicsRef.current) {
      const activeDraft = draftRef.current;

      // Waterline plane (semitransparent light blue)
      const wlGeo = new THREE.PlaneGeometry(300, 80);
      const wlMat = new THREE.MeshBasicMaterial({
        color: 0x6495ed, // Cornflower blue
        transparent: true,
        opacity: 0.25,
        side: THREE.DoubleSide,
      });
      const wlMesh = new THREE.Mesh(wlGeo, wlMat);
      wlMesh.rotation.x = -Math.PI / 2; // flat
      wlMesh.position.set(0, activeDraft, 0); // set height to current draft
      group.add(wlMesh);

      // Center of Buoyancy marker (Green Sphere)
      const cbGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const cbMat = new THREE.MeshBasicMaterial({ color: 0x8fbc8f });
      const cbMarker = new THREE.Mesh(cbGeo, cbMat);
      // LCB is measured from stern (X=0), shift by halfL for viewport coordinates
      cbMarker.position.set(lcbRef.current - halfL, vcbRef.current, 0);
      group.add(cbMarker);

      // Center of Gravity marker (Coral Sphere)
      // Approximate CG height (see calculation formula in hydrostatics)
      const occupantKG = 2.0;
      const kayakKG = currentParams.hullHeight * 0.6;
      const cgZ = (180 * occupantKG + 45 * kayakKG) / (180 + 45); // approximate CG height
      
      const cgGeo = new THREE.SphereGeometry(1.2, 16, 16);
      const cgMat = new THREE.MeshBasicMaterial({ color: 0xff7a5c });
      const cgMarker = new THREE.Mesh(cgGeo, cgMat);
      cgMarker.position.set(lcbRef.current - halfL, cgZ, 0);
      group.add(cgMarker);

      // Connect CB and CG with a vertical vector line to show stability alignment
      const vectorPoints = [
        new THREE.Vector3(lcbRef.current - halfL, vcbRef.current, 0),
        new THREE.Vector3(lcbRef.current - halfL, cgZ, 0)
      ];
      const vectorGeo = new THREE.BufferGeometry().setFromPoints(vectorPoints);
      const vectorLine = new THREE.Line(vectorGeo, new THREE.LineBasicMaterial({ color: 0xeae7df }));
      group.add(vectorLine);
    }

    // 6. CAD Dimension Overlays (Length & Beam)
    if (showDimensionsRef.current) {
      const dimensionLineMaterial = new THREE.LineBasicMaterial({
        color: 0x14231a, // Dark pine green/gray for technical vector line
        linewidth: 1,
      });

      const lengthY = -8; // Positioned below the boat keel
      const lengthZ = 0;
      
      // --- Length Line ---
      const lengthPoints = [
        // Left Tick
        new THREE.Vector3(-halfL, lengthY - 2, lengthZ),
        new THREE.Vector3(-halfL, lengthY + 2, lengthZ),
        new THREE.Vector3(-halfL, lengthY, lengthZ),
        
        // Main Line
        new THREE.Vector3(halfL, lengthY, lengthZ),
        
        // Right Tick
        new THREE.Vector3(halfL, lengthY + 2, lengthZ),
        new THREE.Vector3(halfL, lengthY - 2, lengthZ)
      ];
      const lengthLineGeo = new THREE.BufferGeometry().setFromPoints(lengthPoints);
      const lengthLine = new THREE.Line(lengthLineGeo, dimensionLineMaterial);
      group.add(lengthLine);

      // Text label for Length
      const lengthLabel = createTextSprite(`L: ${currentParams.length.toFixed(1)} ft`, "#14231a", 24);
      lengthLabel.position.set(0, lengthY - 3.5, lengthZ);
      group.add(lengthLabel);

      // --- Beam Line ---
      const beamX = (currentParams.beamPlacement * L) - halfL;
      const beamY = -8;
      const halfBeamVal = currentParams.beam / 2;

      const beamPoints = [
        // Top Tick (along X axis)
        new THREE.Vector3(beamX - 2, beamY, -halfBeamVal),
        new THREE.Vector3(beamX + 2, beamY, -halfBeamVal),
        new THREE.Vector3(beamX, beamY, -halfBeamVal),

        // Main Line
        new THREE.Vector3(beamX, beamY, halfBeamVal),

        // Bottom Tick (along X axis)
        new THREE.Vector3(beamX + 2, beamY, halfBeamVal),
        new THREE.Vector3(beamX - 2, beamY, halfBeamVal)
      ];
      const beamLineGeo = new THREE.BufferGeometry().setFromPoints(beamPoints);
      const beamLine = new THREE.Line(beamLineGeo, dimensionLineMaterial);
      group.add(beamLine);

      // Text label for Beam
      const beamLabel = createTextSprite(`B: ${currentParams.beam.toFixed(1)} in`, "#14231a", 24);
      beamLabel.position.set(beamX, beamY - 3.5, 0);
      group.add(beamLabel);
    }

    // Center of Buoyancy camera targeting (Dynamic LCB tracking)
    if (viewModeRef.current === "perspective" && controlsRef.current) {
      controlsRef.current.target.set(lcbRef.current - halfL, currentParams.hullHeight / 3, 0);
      controlsRef.current.update();
    }
  };

  return <div ref={mountRef} className="canvas-container" />;
}
