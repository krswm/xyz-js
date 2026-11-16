// TODO: Empty file

import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

class App {
  constructor() {
    this.visualizer = new Visualizer();
  }

  run() {
    const fileInput = document.getElementById("file-input");
    fileInput.addEventListener("change", () => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const xyzReader = new XyzReader(reader.result);
        this.visualizer.changeMolecules(xyzReader.getMolecules());
      });

      const file = fileInput.files[0];
      reader.readAsText(file);
    });
  }
}

class Molecule {
  constructor(atoms, energy) {
    this.atoms = atoms;
    this.energy = energy; // Number or `undefined`
  }
}

class Atom {
  constructor(species, pos, forces) {
    this.species = species; // String or `undefined`
    this.pos = pos; // `[x, y, z]` or `undefined`
    this.forces = forces; // `[fx, fy, fz]` or `undefined`
  }
}

class XyzReader {
  // I referred to this specification of the XYZ and Extended XYZ format:
  // https://www.ovito.org/docs/current/reference/file_formats/input/xyz.html

  constructor(xyzFileContent) {
    console.log("%c%s", "font-family: monospace;", xyzFileContent);

    this.lines = xyzFileContent.split("\n");
    this.lines.pop(); // Remove the blank line at the end.

    this.lineIndex = 0;
  }

  getMolecules() {
    const molecules = [];

    while (this.lineIndex < this.lines.length) {
      molecules.push(this.getNextMolecule());
    }

    console.log(molecules);
    return molecules;
  }

  getNextMolecule() {
    const numAtoms = Number(this.lines[this.lineIndex++]);
    const metadata = this.toMetadata(this.lines[this.lineIndex++]);
    const properties = this.toProperties(metadata);

    const atoms = [];

    for (let i = 0; i < numAtoms; i++) {
      const line = this.lines[this.lineIndex++];

      const isExtendedXyz = properties !== undefined;
      if (isExtendedXyz) {
        atoms.push(this.toAtomExtendedXyz(line, properties));
      } else {
        atoms.push(this.toAtomXyz(line));
      }
    }

    const energy = Number(metadata.energy) || undefined;

    return new Molecule(atoms, energy);
  }

  toMetadata(line) {
    const matches = line.matchAll(
      /("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)=("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)/g,
    );

    const metadata = {};

    for (const match of matches) {
      const key = match[1];
      let value = match[2];

      if (value.startsWith('"')) {
        value = value.slice(1, -1); // Remove the double quote delimiters.
        value = value.replaceAll(/\\(.)/g, "$1"); // De-escape characters.
      }

      metadata[key] = value;
    }

    return metadata;
  }

  toProperties(metadata) {
    const text = metadata["Properties"];
    if (text === undefined) {
      return undefined;
    }

    const splits = text.split(":");

    const properties = [];

    let i = 0;
    while (i < splits.length) {
      const property = {
        name: splits[i++],
        type: splits[i++],
        num: Number(splits[i++]),
      };

      properties.push(property);
    }

    return properties;
  }

  toAtomExtendedXyz(line, properties) {
    const splits = line.split(/\s+/);

    const data = {};

    let splitIndex = 0;
    for (const property of properties) {
      const values = [];

      for (let i = 0; i < property.num; i++) {
        const value = splits[splitIndex++];

        switch (property.type) {
          case "S":
            values.push(value);
            break;
          case "I":
          case "R":
          case "L":
            values.push(Number(value));
            break;
        }
      }

      data[property.name] = values;
    }

    const species = data.species[0];
    const pos = data.pos;
    const forces = data.forces || data.MACE_forces;

    return new Atom(species, pos, forces);
  }

  toAtomXyz(line) {
    const [species, x, y, z] = line.trim().split(/\s+/);
    const pos = [x, y, z];
    const forces = undefined;

    return new Atom(species, pos);
  }
}

class Visualizer {
  constructor() {
    this.canvas = document.getElementById("canvas");

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("lightblue");

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

    this.controls = new TrackballControls(this.camera, this.canvas);
    this.controls.update();

    this.molecules = undefined;
    this.prevMoleculeIndex = undefined;
    this.removableObjects = [];

    this.renderer.setAnimationLoop((time) => {
      this.render(time);
    });

    this.newMoleculeIndex = 0;
    document
      .getElementById("molecule-frame-back")
      .addEventListener("click", () => {
        this.newMoleculeIndex--;
        if (this.newMoleculeIndex < 0) {
          this.newMoleculeIndex = this.molecules.length - 1;
        }
      });
    document
      .getElementById("molecule-frame-fore")
      .addEventListener("click", () => {
        this.newMoleculeIndex++;
        if (this.newMoleculeIndex >= this.molecules.length) {
          this.newMoleculeIndex = 0;
        }
      });

    this.centerSpheres = [];
  }

  changeMolecules(molecules) {
    this.molecules = molecules;
    this.prevMoleculeIndex = undefined;
  }

  render() {
    const width = Math.floor(window.innerWidth * window.devicePixelRatio);
    const height = Math.floor(window.innerHeight * window.devicePixelRatio);
    const needResize =
      this.canvas.width !== width || this.canvas.height !== height;
    if (needResize) {
      this.renderer.setSize(width, height, false);
    }

    if (needResize) {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    }

    if (this.molecules !== undefined && this.molecules.length >= 1) {
      if (this.newMoleculeIndex !== this.prevMoleculeIndex) {
        this.prevMoleculeIndex = this.newMoleculeIndex;
        this.renderRemovableObjects(this.newMoleculeIndex);

        document.getElementById("molecule-frame").innerText =
          `${this.newMoleculeIndex}/${this.molecules.length}`;
      }
    }

    for (const centerSphere of this.centerSpheres) {
      // let [xx, yy, zz] = this.camera.position
      centerSphere.up = this.camera.up;
      centerSphere.lookAt(this.camera.position);
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  renderRemovableObjects(moleculeIndex) {
    console.log(
      `render molecule frame ${moleculeIndex}/${this.molecules.length}`,
    );

    const molecule = this.molecules[moleculeIndex];

    document.getElementById("energy").innerText = molecule.energy;

    for (const removableObject of this.removableObjects) {
      this.scene.remove(removableObject);
    }

    const centerSpheres = [];
    const forceVectorLines = [];
    const ghostAtomSpheres = [];
    const atomSpheres = [];
    const ghostLabels = [];
    const labels = [];

    for (const atom of molecule.atoms) {
      // Van der Waars radii are according to [A. Bondi, 1964].
      // A. Bondi: van der Waals Volumes and Radii.
      // doi 10.1021/j100785a001
      // TODO: Cite more properly.
      // TODO: Consider different sources.

      if (atom.species === undefined) {
        continue;
      }
      const { radius, color } = {
        H: { radius: 1.1, color: "#FFFFFF" },
        C: { radius: 1.7, color: "#808080" },
        N: { radius: 1.55, color: "#4040FF" },
        O: { radius: 1.52, color: "#FF4040" },
      }[atom.species] || { radius: 1, color: "#FF40FF" };

      if (atom.pos === undefined) {
        continue;
      }
      const [x, y, z] = atom.pos;

      {
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.canvas.width = 2000;
        ctx.canvas.height = 1000;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 1000, 1000);
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.font = "25em system-ui";
        ctx.fillStyle = "lime";
        const text = atom.species;
        ctx.fillText(text, 500, 500);

        const canvas = ctx.canvas;

        const texture = new THREE.CanvasTexture(canvas);
        /*
        const labelMaterial = new THREE.SpriteMaterial({
          map: texture,
          depthTest: false,
          depthWrite: false,
        });
        */
        /*
        const labelMaterial = new THREE.SpriteMaterial({
          map: texture,
        });
        const label = new THREE.Sprite(labelMaterial);
        label.position.set(x, y, z + 1);
        labels.push(label);
        */

        const centerSphere = new THREE.Mesh(
          new THREE.SphereGeometry(1 / 4, 32, 16),
          new THREE.MeshPhongMaterial({ map: texture }),
          // yes! transparent object inside transparent object
        );
        centerSphere.position.set(x, y, z);
        centerSpheres.push(centerSphere);
      }

      const ghostAtomSphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 16),
        new THREE.MeshPhongMaterial({ colorWrite: false, transparent: true }),
      );
      ghostAtomSphere.position.set(x, y, z);
      ghostAtomSpheres.push(ghostAtomSphere);

      const atomSphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 16),
        new THREE.MeshPhongMaterial({
          color,
          transparent: true,
          opacity: 0.25,
        }),
      );
      atomSphere.position.set(x, y, z);
      atomSpheres.push(atomSphere);

      if (atom.forces === undefined) {
        continue;
      }
      const [fx, fy, fz] = atom.forces;

      const forceMagnification = 10;
      const line = new Line2(
        new LineGeometry().setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(
            x + forceMagnification * fx,
            y + forceMagnification * fy,
            z + forceMagnification * fz,
          ),
        ]),
        new LineMaterial({
          linewidth: 1 / 16,
          color,
          worldUnits: true,
        }),
      );
      forceVectorLines.push(line);
    }

    /*
    for (const ghostLabel of ghostLabels) {
      this.scene.add(ghostLabel);
      this.removableObjects.push(ghostLabel);
    }
    for (const label of labels) {
      this.scene.add(label);
      this.removableObjects.push(label);
    }
    */
    for (const centerSphere of centerSpheres) {
      this.scene.add(centerSphere);
      this.removableObjects.push(centerSphere);
      this.centerSpheres.push(centerSphere);
    }
    for (const forceVectorLine of forceVectorLines) {
      this.scene.add(forceVectorLine);
      this.removableObjects.push(forceVectorLine);
    }
    for (const ghostAtomSphere of ghostAtomSpheres) {
      this.scene.add(ghostAtomSphere);
      this.removableObjects.push(ghostAtomSphere);
    }
    for (const atomSphere of atomSpheres) {
      this.scene.add(atomSphere);
      this.removableObjects.push(atomSphere);
    }
  }
}

const app = new App();
app.run();
