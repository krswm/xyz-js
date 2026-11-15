import * as THREE from "three";
import { TrackballControls } from "three/addons/controls/TrackballControls.js";

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
  constructor(atoms) {
    this.atoms = atoms;
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
    const isExtendedXyz = properties !== undefined;

    const atoms = [];

    for (let i = 0; i < numAtoms; i++) {
      const line = this.lines[this.lineIndex++];

      if (isExtendedXyz) {
        atoms.push(this.toAtomExtendedXyz(line, properties));
      } else {
        atoms.push(this.toAtomXyz(line));
      }
    }

    return new Molecule(atoms);
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
    const [species, x, y, z] = line.split(/\s+/);
    const pos = [x, y, z];
    const forces = undefined;

    return new Atom(species, pos);
  }
}

class Visualizer {
  constructor() {
    this.scene = new THREE.Scene();

    const ambientLight = new THREE.AmbientLight("white", 1);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight("white", 2);
    this.scene.add(directionalLight);

    const canvas = document.getElementById("canvas");

    this.renderer = new THREE.WebGLRenderer({ canvas });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.sortObjects = false;

    this.camera = new THREE.PerspectiveCamera();
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.position.set(0, 0, 100);

    this.controls = new TrackballControls(this.camera, canvas);
    this.controls.update();

    this.molecules = undefined;
    this.prevMoleculeIndex = undefined;
    this.removableObjects = [];

    this.renderer.setAnimationLoop((time) => {
      this.render(time);
    });
  }

  changeMolecules(molecules) {
    this.molecules = molecules;
    this.prevMoleculeIndex = undefined;
  }

  render(time) {
    if (this.molecules !== undefined) {
      let moleculeIndex = Math.floor(time / 1000) % this.molecules.length;

      if (moleculeIndex !== this.prevMoleculeIndex) {
        this.prevMoleculeIndex = moleculeIndex;
        console.log(
          `render molecule frame ${moleculeIndex}/${this.molecules.length}`,
        );

        for (const removableObject of this.removableObjects) {
          this.scene.remove(removableObject);
        }

        const centerSpheres = [];
        const forceVectorLines = [];
        const ghostAtomSpheres = [];
        const atomSpheres = [];

        for (const atom of this.molecules[moleculeIndex].atoms) {
          // Van der Waars radii are according to [A. Bondi, 1964].
          // A. Bondi: van der Waals Volumes and Radii.
          // doi 10.1021/j100785a001
          // TODO: Cite more properly.
          // TODO: Consider different sources.

          if (atom.species === undefined) {
            continue;
          }
          const { radius, color } = {
            H: { radius: 1.1, color: "white" },
            C: { radius: 1.7, color: "gray" },
            O: { radius: 1.52, color: "red" },
          }[atom.species] || { radius: 1, color: "magenta" };

          if (atom.pos === undefined) {
            continue;
          }
          const [x, y, z] = atom.pos;

          const centerSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1 / 4, 32, 16),
            new THREE.MeshPhongMaterial({ color: "cyan" }),
          );
          centerSphere.position.set(x, y, z);
          centerSpheres.push(centerSphere);

          const ghostAtomSphere = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 16),
            new THREE.MeshPhongMaterial({ colorWrite: false }),
          );
          ghostAtomSphere.position.set(x, y, z);
          ghostAtomSpheres.push(ghostAtomSphere);

          const atomSphere = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 32, 16),
            new THREE.MeshPhongMaterial({
              color: color,
              transparent: true,
              opacity: 0.5,
            }),
          );
          atomSphere.position.set(x, y, z);
          atomSpheres.push(atomSphere);

          if (atom.forces === undefined) {
            continue;
          }
          const [fx, fy, fz] = atom.forces;

          const forceVectorLine = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
              new THREE.Vector3(x, y, z),
              new THREE.Vector3(x + fx, y + fy, z + fz),
            ]),
            new THREE.LineBasicMaterial({ color: "magenta" }),
          );
          forceVectorLines.push(forceVectorLine);
        }

        for (const centerSphere of centerSpheres) {
          this.scene.add(centerSphere);
          this.removableObjects.push(centerSphere);
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

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

const app = new App();
app.run();
