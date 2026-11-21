import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { ArcballControls } from "three/addons/controls/ArcballControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

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
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.sortObjects = false;

    this.camera = new THREE.PerspectiveCamera();
    this.camera.aspect = this.canvas.clientWidth / this.canvas.clientHeight;
    this.camera.position.set(0, 0, 16);

    this.controls = new ArcballControls(this.camera, this.canvas);
    this.controls.update();

    this.molecules = undefined;
    this.prevMoleculeIndex = undefined;

    this.renderer.setAnimationLoop((time) => {
      this.render(time);
    });

    this.moleculeIndex = 0;
    this.updateHTMLTexts();
    document
      .getElementById("frame-prev-button")
      .addEventListener("click", () => {
        this.moleculeIndex--;
        if (this.moleculeIndex < 0) {
          this.moleculeIndex = this.molecules.length - 1;
        }
        this.updateHTMLTexts();
      });
    document
      .getElementById("frame-next-button")
      .addEventListener("click", () => {
        this.moleculeIndex++;
        if (this.moleculeIndex >= this.molecules.length) {
          this.moleculeIndex = 0;
        }
        this.updateHTMLTexts();
      });

    this.forceMagnification = 1.0;
    document
      .getElementById("force-magnification-input")
      .addEventListener("input", (event) => {
        this.forceMagnification = event.target.valueAsNumber;
      });

    this.innerSpheres = [];
    this.forceLineGeometries = [];
    this.groups = [];
    this.disposables = [];
  }

  updateHTMLTexts() {
    const emDash = "—";
    const hyphenMinus = "-";
    const minusSign = "−";

    const moleculeFrame =
      this.molecules === undefined
        ? emDash
        : `<span>${this.moleculeIndex + 1}<span id="frame-value-fraction">/${this.molecules.length}</span></span>`;
    // Enclose with <span>
    // because it's inside flex box
    // and the fraction part will raised (visually wrong)!
    document.getElementById("frame-value").innerHTML = moleculeFrame;

    const energy =
      this.molecules === undefined ||
      this.molecules[this.moleculeIndex].energy === undefined
        ? emDash
        : `${this.molecules[this.moleculeIndex].energy.toFixed(6).replaceAll(hyphenMinus, minusSign)}`;
    document.getElementById("energy-value").innerText = energy;
  }

  changeMolecules(molecules) {
    this.molecules = molecules;
    this.prevMoleculeIndex = undefined;
    this.updateHTMLTexts();
  }

  render(time) {
    const width = Math.floor(window.innerWidth * window.devicePixelRatio);
    const height = Math.floor(window.innerHeight * window.devicePixelRatio);
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    if (this.moleculeIndex !== this.prevMoleculeIndex) {
      this.prevMoleculeIndex = this.moleculeIndex;
      if (this.molecules !== undefined && this.molecules.length >= 1) {
        const molecule = this.molecules[this.moleculeIndex];
        this.renderMolecule(molecule);
      }
    }

    for (const innerSphere of this.innerSpheres) {
      innerSphere.lookAt(this.camera.position);
      innerSphere.up = this.camera.up;
    }

    if (this.molecules !== undefined && this.molecules.length >= 1) {
      for (
        let i = 0;
        i < this.molecules[this.moleculeIndex].atoms.length;
        i++
      ) {
        const atom = this.molecules[this.moleculeIndex].atoms[i];

        if (atom.pos === undefined) {
          continue;
        }
        const [x, y, z] = atom.pos;

        if (atom.forces === undefined) {
          continue;
        }
        const [fx, fy, fz] = atom.forces;

        const line = this.forceLineGeometries[i];

        line.setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(
            this.forceMagnification * fx,
            this.forceMagnification * fy,
            this.forceMagnification * fz,
          ),
        ]);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  renderMolecule(molecule) {
    this.removePrevMolecule();
    this.drawMolecule(molecule);
  }

  removePrevMolecule() {
    this.innerSpheres.length = 0;
    this.forceLineGeometries.length = 0;

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

      const [x, y, z] = atom.pos;

      {
        const outerSphereGeometry = new THREE.SphereGeometry(radius, 32, 16);

        const outerSphereDepthMaterial = new THREE.MeshPhongMaterial({
          colorWrite: false,
          transparent: true,
        });
        const outerSphereDepth = new THREE.Mesh(
          outerSphereGeometry,
          outerSphereDepthMaterial,
        );
        outerSphereDepth.position.set(x, y, z);

        const outerSphereMaterial = new THREE.MeshPhongMaterial({
          color,
          transparent: true,
          opacity: 0.5,
        });
        const outerSphere = new THREE.Mesh(
          outerSphereGeometry,
          outerSphereMaterial,
        );
        outerSphere.position.set(x, y, z);

        this.disposables.push(outerSphereGeometry);
        this.disposables.push(outerSphereDepthMaterial);
        this.disposables.push(outerSphereDepth);
        this.disposables.push(outerSphereMaterial);

        outerSphereDepthGroup.add(outerSphereDepth);
        outerSphereGroup.add(outerSphere);
      }

      if (atom.forces === undefined) {
        continue;
      }

      const [fx, fy, fz] = atom.forces;

      {
        const forceLineGeometry = new LineGeometry();

        forceLineGeometry.setFromPoints([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(
            this.forceMagnification * fx,
            this.forceMagnification * fy,
            this.forceMagnification * fz,
          ),
        ]);

        const forceLineMaterial = new LineMaterial({
          linewidth: 1 / 16,
          color,
          worldUnits: true,
        });

        const forceLine = new Line2(forceLineGeometry, forceLineMaterial);
        forceLine.position.set(x, y, z);

        this.disposables.push(forceLineGeometry);
        this.disposables.push(forceLineMaterial);

        this.forceLineGeometries.push(forceLineGeometry);

        forceLineGroup.add(forceLine);
      }
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
}
