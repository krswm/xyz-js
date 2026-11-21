import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

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

    this.forceLines = [];
    this.innerSpheres = [];
    this.groups = [];
    this.disposables = [];

    this.molecules = [];
    this.prevMoleculeIndex = undefined;

    this.forceMagnification = 16;
    document
      .getElementById("force-magnification-input")
      .addEventListener("input", (event) => {
        this.forceMagnification = event.target.valueAsNumber;
      });

    this.moleculeIndex = 0;
    document
      .getElementById("frame-prev-button")
      .addEventListener("click", () => {
        if (this.molecules.length >= 1) {
          this.moleculeIndex--;
          if (this.moleculeIndex < 0) {
            this.moleculeIndex = this.molecules.length - 1;
          }

          this.updateText();
        }
      });
    document
      .getElementById("frame-next-button")
      .addEventListener("click", () => {
        if (this.molecules.length >= 1) {
          this.moleculeIndex++;
          if (this.moleculeIndex >= this.molecules.length) {
            this.moleculeIndex = 0;
          }

          this.updateText();
        }
      });

    this.updateText();
    this.renderer.setAnimationLoop(() => {
      this.render();
    });
  }

  changeMolecules(molecules) {
    this.molecules = molecules;
    this.prevMoleculeIndex = undefined;
    this.moleculeIndex = 0;
    this.updateText();
  }

  updateText() {
    const emDash = "\u2014";
    const hyphenMinus = "\u002d";
    const minusSign = "\u2212";

    document.getElementById("frame-value").innerHTML =
      this.molecules.length === 0
        ? emDash
        : "<span>" +
          `${this.moleculeIndex + 1}` +
          `<span id="frame-value-fraction">/${this.molecules.length}</span>` +
          "</span>";

    document.getElementById("energy-value").innerText =
      this.molecules.length === 0 ||
      this.molecules[this.moleculeIndex].energy === undefined
        ? emDash
        : this.molecules[this.moleculeIndex].energy
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

    if (this.moleculeIndex !== this.prevMoleculeIndex) {
      this.prevMoleculeIndex = this.moleculeIndex;
      this.removePrevMolecule();
      if (this.molecules.length >= 1) {
        const molecule = this.molecules[this.moleculeIndex];
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

    for (const group of this.groups) {
      this.scene.remove(group);
    }

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  drawMolecule(molecule) {
    const innerSphereGroup = new THREE.Group();
    const forceLineGroup = new THREE.Group();
    const outerSphereDepthGroup = new THREE.Group();
    const outerSphereGroup = new THREE.Group();

    for (const atom of molecule.atoms) {
      if (atom.species === undefined) {
        continue;
      }
      if (atom.pos === undefined) {
        continue;
      }

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
      }[atom.species] || {
        radius: 1.5,
        color: "#7FC08C", // oklch(0.75 0.1 150) (green)
        textColor: "#337344", // oklch(0.5 0.1 150)
      };

      const innerSphere = this.getInnerSphere(
        atom.pos,
        color,
        textColor,
        atom.species,
      );
      innerSphereGroup.add(innerSphere);

      const [outerSphereDepth, outerSphere] = this.getOuterSphere(
        atom.pos,
        color,
        radius,
      );
      outerSphereDepthGroup.add(outerSphereDepth);
      outerSphereGroup.add(outerSphere);

      if (atom.forces === undefined) {
        continue;
      }

      const forceLine = this.getForceLine(atom.pos, color, atom.forces);
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

  getInnerSphere(pos, color, textColor, species) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    context.canvas.width = 128;
    context.canvas.height = 64;

    context.fillStyle = color;
    context.fillRect(0, 0, 128, 64);

    context.font = "bold 32px system-ui";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = textColor;
    context.fillText(species, 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const geometry = new THREE.SphereGeometry(1 / 4, 32, 16);
    const material = new THREE.MeshPhongMaterial({ map: texture });

    this.disposables.push(texture);
    this.disposables.push(geometry);
    this.disposables.push(material);

    const innerSphere = new THREE.Mesh(geometry, material);
    innerSphere.position.set(...pos);

    this.innerSpheres.push(innerSphere);

    return innerSphere;
  }

  getOuterSphere(pos, color, radius) {
    const geometry = new THREE.SphereGeometry(radius, 32, 16);
    const depthMaterial = new THREE.MeshPhongMaterial({
      colorWrite: false,
    });
    const material = new THREE.MeshPhongMaterial({
      color,
      transparent: true,
      opacity: 0.5,
    });

    this.disposables.push(geometry);
    this.disposables.push(depthMaterial);
    this.disposables.push(material);

    const outerSphereDepth = new THREE.Mesh(geometry, depthMaterial);
    const outerSphere = new THREE.Mesh(geometry, material);

    outerSphereDepth.position.set(...pos);
    outerSphere.position.set(...pos);

    return [outerSphereDepth, outerSphere];
  }

  getForceLine(pos, color, forces) {
    const geometry = new LineGeometry();
    const material = new LineMaterial({
      color,
      worldUnits: true,
      linewidth: 1 / 16,
    });

    this.disposables.push(geometry);
    this.disposables.push(material);

    const forceLine = new Line2(geometry, material);
    forceLine.position.set(...pos);

    this.forceLines.push({ geometry, forces });

    return forceLine;
  }
}
