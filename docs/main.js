import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

function main() {
  const fileInput = document.getElementById("file-input");
  fileInput.addEventListener("change", () => {
    readFile(fileInput);
  });
}

function readFile(fileInput) {
  const file = fileInput.files[0];

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    onLoad(reader);
  });
  reader.readAsText(file);
}

function onLoad(reader) {
  let lines = reader.result.split("\n");
  lines.pop(); // Remove the blank line at the end.

  let molecules = [];
  let lineIndex = 0;
  while (lineIndex < lines.length) {
    let numAtoms = Number(lines[lineIndex++]);
    let metadata = toMetadata(lines[lineIndex++]);
    let properties = toProperties(metadata);

    let molecule = [];
    for (let i = 0; i < numAtoms; i++) {
      let line = lines[lineIndex++];
      let splits = line.split(/\s+/);

      let atom = {};
      let splitIndex = 0;
      for (let property of properties) {
        let values = [];
        for (let j = 0; j < property.num; j++) {
          let value = splits[splitIndex];
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
          splitIndex++;
        }
        atom[property.name] = values;
      }
      molecule.push(atom);
    }
    molecules.push(molecule);
  }
  console.log(molecules);

  visualize(molecules);
}

function toMetadata(line) {
  // Specification:
  // https://www.ovito.org/docs/current/reference/file_formats/input/xyz.html

  let matches = line.matchAll(
    /("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)=("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)/g,
  );

  let metadata = {};
  for (let match of matches) {
    let [, key, value] = match;

    if (value.startsWith('"')) {
      value = value.slice(1, -1); // Remove the double quote delimiters.
      value = value.replaceAll(/\\(.)/g, "$1"); // De-escape characters.
    }

    metadata[key] = value;
  }

  return metadata;
}

function toProperties(metadata) {
  let text = metadata["Properties"];
  let splits = text.split(":");

  let properties = [];
  for (let i = 0; i < splits.length; i += 3) {
    let property = {
      name: splits[i],
      type: splits[i + 1],
      num: Number(splits[i + 2]),
    };
    properties.push(property);
  }

  return properties;
}

function visualize(molecules) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);

  renderer.sortObjects = false; // This line!!!
  // Success!!! Now I don't see transparent sphere intersection artiacts!!!

  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set(0, 0, 1);
  controls.update();

  let prevMoleculeIndex = undefined;
  renderer.setAnimationLoop((time) => {
    let moleculeIndex = Math.floor(time / 1000) % molecules.length;

    if (moleculeIndex !== prevMoleculeIndex) {
      prevMoleculeIndex = moleculeIndex;
      console.log(moleculeIndex);

      while (scene.children.length) {
        scene.remove(scene.children[0]);
      }

      const centerSpheres = [];
      const forceVectorLines = [];
      const ghostAtomSpheres = [];
      const atomSpheres = [];

      for (const atom of molecules[moleculeIndex]) {
        // Van der Waars radii are according to [A. Bondi, 1964].
        // A. Bondi: van der Waals Volumes and Radii.
        // doi 10.1021/j100785a001
        // TODO: Cite more properly.
        // TODO: Consider different sources.

        const species = atom.species;
        if (species === undefined) {
          continue;
        }
        const { radius, color } = {
          H: { radius: 1.1, color: "white" },
          C: { radius: 1.7, color: "gray" },
          O: { radius: 1.52, color: "red" },
        }[species[0]] || { radius: 1, color: "magenta" };

        const pos = atom.pos;
        if (pos === undefined) {
          continue;
        }
        const [x, y, z] = pos;

        const centerSphere = new THREE.Mesh(
          new THREE.SphereGeometry(1 / 4, 32, 16),
          new THREE.MeshPhongMaterial({ color: "lime" }),
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

        const forces = atom.forces || atom.MACE_forces;
        if (forces === undefined) {
          continue;
        }
        const [fx, fy, fz] = forces;

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
        scene.add(centerSphere);
      }
      for (const forceVectorLine of forceVectorLines) {
        scene.add(forceVectorLine);
      }
      for (const ghostAtomSphere of ghostAtomSpheres) {
        scene.add(ghostAtomSphere);
      }
      for (const atomSphere of atomSpheres) {
        scene.add(atomSphere);
      }

      const ambientLight = new THREE.AmbientLight("white", 1);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight("white", 2);
      scene.add(directionalLight);
    }

    controls.update();
    renderer.render(scene, camera);
  });
}

main();
