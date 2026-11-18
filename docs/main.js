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
      this.readFile(fileInput.files[0]);
    });

    document.addEventListener("drop", (event) => {
      event.preventDefault();
      fileInput.files = event.dataTransfer.files;
    });

    window.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    const canvas = document.getElementById("canvas");

    canvas.addEventListener("drop", (event) => {
      event.preventDefault();
      console.log(event);
      const files = [...event.dataTransfer.items]
        .map((item) => item.getAsFile())
        .filter((file) => file);
      this.readFile(files[0]);
    });

    canvas.addEventListener("dragover", (event) => {
      const fileItems = [...event.dataTransfer.items].filter(
        (item) => item.kind === "file",
      );
      if (fileItems.length > 0) {
        event.preventDefault();
      }
    });
  }

  readFile(file) {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const xyzReader = new XyzReader(reader.result);
      this.visualizer.changeMolecules(xyzReader.getMolecules());
    });

    reader.readAsText(file);
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

    this.controls = new TrackballControls(this.camera, this.canvas);
    this.controls.update();

    this.molecules = undefined;
    this.prevMoleculeIndex = undefined;
    this.removableObjects = [];

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

    this.centerSpheres = [];

    this.forceMagnification = 1.0;
    document
      .getElementById("force-magnification-input")
      .addEventListener("input", (event) => {
        console.log(event);
        this.forceMagnification = event.target.valueAsNumber;
        console.log(this.forceMagnification);
      });

    this.count = 0;

    this.lineGeometries = [];
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
        this.renderRemovableObjects(this.moleculeIndex);
      }
    }

    for (const centerSphere of this.centerSpheres) {
      centerSphere.lookAt(this.camera.position);
      centerSphere.up = this.camera.up;
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

        const line = this.lineGeometries[i];
        if (this.count++ < 100) {
          console.log(this.lineGeometries);
        }

        line.setFromPoints([
          new THREE.Vector3(x, y, z),
          new THREE.Vector3(
            x + this.forceMagnification * fx,
            y + this.forceMagnification * fy,
            z + this.forceMagnification * fz,
          ),
        ]);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  renderRemovableObjects(moleculeIndex) {
    console.log(
      `render molecule frame ${moleculeIndex}/${this.molecules.length}`,
    );

    const molecule = this.molecules[moleculeIndex];

    for (const removableObject of this.removableObjects) {
      this.scene.remove(removableObject);
    }

    const centerSpheres = new THREE.Group();
    const forceVectorLines = new THREE.Group();
    const ghostAtomSpheres = new THREE.Group();
    const atomSpheres = new THREE.Group();

    for (const atom of molecule.atoms) {
      if (atom.species === undefined) {
        continue;
      }

      // `radius` is an approximate Van der Waals radius.
      const { radius, color, symbolColor } = {
        H: {
          radius: 1.1,
          color: "#FFFFFF", // oklch(1.0 0.0 0) (white)
          symbolColor: "#AEAEAE", // oklch(0.75 0.0 0)
        },
        C: {
          radius: 1.7,
          color: "#636363", // oklch(0.5 0.0 0) (gray)
          symbolColor: "#222222", // oklch(0.25 0.0 0)
        },
        N: {
          radius: 1.6,
          color: "#95ABEE", // oklch(0.75 0.1 270) (blue)
          symbolColor: "#4D5F9C", // oklch(0.5 0.1 270)
        },
        O: {
          radius: 1.5,
          color: "#E69688", // oklch(0.75 0.1 30) (red)
          symbolColor: "#944B40", // oklch(0.5 0.1 30)
        },
      }[atom.species] || {
        radius: 1.5,
        color: "#7FC08C", // oklch(0.75 0.1 150) (green)
        symbolColor: "#337344", // oklch(0.5 0.1 150)
      };

      if (atom.pos === undefined) {
        continue;
      }
      const [x, y, z] = atom.pos;

      {
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.canvas.width = 128;
        ctx.canvas.height = 64;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 128, 64);
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        ctx.font = "bold 32px system-ui";
        ctx.fillStyle = symbolColor;
        const text = atom.species;
        ctx.fillText(text, 32, 32);

        const canvas = ctx.canvas;

        const texture = new THREE.CanvasTexture(canvas);

        const centerSphere = new THREE.Mesh(
          new THREE.SphereGeometry(1 / 4, 32, 16),
          new THREE.MeshPhongMaterial({ map: texture }),
          // yes! transparent object inside transparent object
        );
        centerSphere.position.set(x, y, z);
        centerSpheres.add(centerSphere);
        this.centerSpheres.push(centerSphere);
      }

      const ghostAtomSphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 16),
        new THREE.MeshPhongMaterial({ colorWrite: false, transparent: true }),
      );
      ghostAtomSphere.position.set(x, y, z);
      ghostAtomSpheres.add(ghostAtomSphere);

      const atomSphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 32, 16),
        new THREE.MeshPhongMaterial({
          color,
          transparent: true,
          opacity: 0.5,
        }),
      );
      atomSphere.position.set(x, y, z);
      atomSpheres.add(atomSphere);

      if (atom.forces === undefined) {
        continue;
      }
      const [fx, fy, fz] = atom.forces;

      const lineGeometry = new LineGeometry();

      lineGeometry.setFromPoints([
        new THREE.Vector3(x, y, z),
        new THREE.Vector3(
          x + this.forceMagnification * fx,
          y + this.forceMagnification * fy,
          z + this.forceMagnification * fz,
        ),
      ]);

      const line = new Line2(
        lineGeometry,
        new LineMaterial({
          linewidth: 1 / 16,
          color,
          worldUnits: true,
        }),
      );
      forceVectorLines.add(line);
      this.lineGeometries.push(lineGeometry);
    }

    this.scene.add(centerSpheres);
    this.scene.add(forceVectorLines);
    this.scene.add(ghostAtomSpheres);
    this.scene.add(atomSpheres);

    this.removableObjects.push(centerSpheres);
    this.removableObjects.push(forceVectorLines);
    this.removableObjects.push(ghostAtomSpheres);
    this.removableObjects.push(atomSpheres);
  }
}

const app = new App();
app.run();
