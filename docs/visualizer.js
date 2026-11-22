import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { Line2 } from "three/addons/lines/Line2.js";

// To prevent transparency artifacts, I used `sortObjects = false` and
// `outerSphereDepth`.

export class Visualizer {
  constructor() {
    this.canvas = document.getElementById("canvas");

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("black");

    const ambientLight = new THREE.AmbientLight("white", 1);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight("white", 2);
    this.scene.add(directionalLight);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas });
    this.renderer.sortObjects = false;

    this.camera = new THREE.PerspectiveCamera();
    this.camera.position.set(0, 0, 16);

    this.controls = new TrackballControls(this.camera, this.canvas);

    this.species3dMemoizer = new Species3dMemoizer();

    this.forceLines = [];
    this.innerSpheres = [];
    this.groups = [];

    this.molecules = [];
    this.prevFrame = undefined;

    this.forceMagnification = 16;
    document
      .getElementById("force-magnification-input")
      .addEventListener("input", (event) => {
        this.forceMagnification = event.target.valueAsNumber;
      });

    this.frame = 0;
    document
      .getElementById("frame-prev-button")
      .addEventListener("click", () => {
        this.decrementFrame();
      });
    document
      .getElementById("frame-next-button")
      .addEventListener("click", () => {
        this.incrementFrame();
      });
    window.addEventListener("keydown", (event) => {
      switch (event.key) {
        case "ArrowLeft":
          event.preventDefault();
          this.decrementFrame();
          break;
        case "ArrowRight":
          event.preventDefault();
          this.incrementFrame();
          break;
      }
    });

    this.updateText();
    this.renderer.setAnimationLoop(() => {
      this.render();
    });
  }

  changeMolecules(molecules) {
    this.molecules = molecules;
    this.prevFrame = undefined;
    this.frame = 0;
    this.updateText();
  }

  decrementFrame() {
    if (this.molecules.length >= 1) {
      this.frame--;
      if (this.frame < 0) {
        this.frame = this.molecules.length - 1;
      }

      this.updateText();
    }
  }

  incrementFrame() {
    if (this.molecules.length >= 1) {
      this.frame++;
      if (this.frame >= this.molecules.length) {
        this.frame = 0;
      }

      this.updateText();
    }
  }

  updateText() {
    const emDash = "\u2014";
    const hyphenMinus = "\u002d";
    const minusSign = "\u2212";

    document.getElementById("frame-value").innerHTML =
      this.molecules.length === 0
        ? emDash
        : "<span>" +
          `${this.frame + 1}` +
          `<span id="frame-value-fraction">/${this.molecules.length}</span>` +
          "</span>";

    document.getElementById("energy-value").innerText =
      this.molecules.length === 0 ||
      this.molecules[this.frame].energy === undefined
        ? emDash
        : this.molecules[this.frame].energy
            .toFixed(6)
            .replaceAll(hyphenMinus, minusSign);
  }

  render() {
    const width = Math.floor(window.innerWidth * window.devicePixelRatio);
    const height = Math.floor(window.innerHeight * window.devicePixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    if (this.frame !== this.prevFrame) {
      this.prevFrame = this.frame;
      this.removePrevMolecule();
      if (this.molecules.length >= 1) {
        const molecule = this.molecules[this.frame];
        this.drawMolecule(molecule);
      }
    }

    for (const { geometry, forces } of this.forceLines) {
      const [fx, fy, fz] = forces;
      geometry.setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(
          this.forceMagnification * fx,
          this.forceMagnification * fy,
          this.forceMagnification * fz,
        ),
      ]);
    }

    for (const innerSphere of this.innerSpheres) {
      innerSphere.lookAt(this.camera.position);
      innerSphere.up = this.camera.up;
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  removePrevMolecule() {
    this.forceLines.length = 0;
    this.innerSpheres.length = 0;

    while (this.groups.length > 0) {
      const group = this.groups.pop();
      this.scene.remove(group);
    }
  }

  drawMolecule(molecule) {
    const innerSphereGroup = new THREE.Group();
    const forceLineGroup = new THREE.Group();
    const outerSphereDepthGroup = new THREE.Group();
    const outerSphereGroup = new THREE.Group();

    for (const atom of molecule.atoms) {
      if (atom.pos === undefined) {
        continue;
      }

      const {
        innerSphereGeometry,
        innerSphereMaterial,
        outerSphereGeometry,
        outerSphereDepthMaterial,
        outerSphereMaterial,
        forceLineMaterial,
      } = this.species3dMemoizer.getSpecies3d(atom.species);

      const innerSphere = new THREE.Mesh(
        innerSphereGeometry,
        innerSphereMaterial,
      );

      // To make the species text direct correctly even at the moment
      // immediately after a frame change, I need `up` here as well.
      innerSphere.up = this.camera.up;

      this.innerSpheres.push(innerSphere);

      innerSphere.position.set(...atom.pos);
      innerSphereGroup.add(innerSphere);

      const outerSphereDepth = new THREE.Mesh(
        outerSphereGeometry,
        outerSphereDepthMaterial,
      );
      const outerSphere = new THREE.Mesh(
        outerSphereGeometry,
        outerSphereMaterial,
      );

      outerSphereDepth.position.set(...atom.pos);
      outerSphere.position.set(...atom.pos);
      outerSphereDepthGroup.add(outerSphereDepth);
      outerSphereGroup.add(outerSphere);

      if (atom.forces === undefined) {
        continue;
      }

      const forceLineGeometry = new LineGeometry();

      const forceLine = new Line2(forceLineGeometry, forceLineMaterial);

      this.forceLines.push({
        geometry: forceLineGeometry,
        forces: atom.forces,
      });

      forceLine.position.set(...atom.pos);
      forceLineGroup.add(forceLine);
    }

    this.scene.add(forceLineGroup);
    this.scene.add(innerSphereGroup);
    this.scene.add(outerSphereDepthGroup);
    this.scene.add(outerSphereGroup);

    this.groups.push(forceLineGroup);
    this.groups.push(innerSphereGroup);
    this.groups.push(outerSphereDepthGroup);
    this.groups.push(outerSphereGroup);
  }
}

class Species3dMemoizer {
  constructor() {
    this.species3ds = {};
  }

  getSpecies3d(species) {
    return this.species3ds[species] || this.memoizeSpecies3d(species);
  }

  memoizeSpecies3d(species) {
    console.log(`Species3dMemoizer: ${species}`);

    // `radius` is an approximate Van der Waals radius.
    const { radius, color, textColor } = {
      H: {
        radius: 1.1,
        color: "#FFFFFF", // oklch(1.0 0.0 0) (white)
        textColor: "#AEAEAE", // oklch(0.75 0.0 0)
      },
      C: {
        radius: 1.7,
        color: "#636363", // oklch(0.5 0.0 0) (gray)
        textColor: "#222222", // oklch(0.25 0.0 0)
      },
      N: {
        radius: 1.6,
        color: "#95ABEE", // oklch(0.75 0.1 270) (blue)
        textColor: "#4D5F9C", // oklch(0.5 0.1 270)
      },
      O: {
        radius: 1.5,
        color: "#E69688", // oklch(0.75 0.1 30) (red)
        textColor: "#944B40", // oklch(0.5 0.1 30)
      },
    }[species] || {
      radius: 1.5,
      color: "#7FC08C", // oklch(0.75 0.1 150) (green)
      textColor: "#337344", // oklch(0.5 0.1 150)
    };

    const canvas = document.createElement("canvas");

    const context = canvas.getContext("2d");
    context.canvas.width = 128;
    context.canvas.height = 64;

    context.fillStyle = color;
    context.fillRect(0, 0, 128, 64);

    if (species !== undefined) {
      context.font = "bold 32px system-ui";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = textColor;
      context.fillText(species, 32, 32);
    }

    const texture = new THREE.CanvasTexture(canvas);

    const innerSphereGeometry = new THREE.SphereGeometry(1 / 4, 32, 16);
    const innerSphereMaterial = new THREE.MeshPhongMaterial({ map: texture });

    const outerSphereGeometry = new THREE.SphereGeometry(radius, 32, 16);
    const outerSphereDepthMaterial = new THREE.MeshPhongMaterial({
      colorWrite: false,
    });
    const outerSphereMaterial = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.5,
    });

    const forceLineMaterial = new LineMaterial({
      color,
      worldUnits: true,
      linewidth: 1 / 16,
    });

    const species3d = {
      innerSphereGeometry,
      innerSphereMaterial,
      outerSphereGeometry,
      outerSphereDepthMaterial,
      outerSphereMaterial,
      forceLineMaterial,
    };
    this.species3ds[species] = species3d;
    return species3d;
  }
}
