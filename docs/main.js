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

      for (let atom of molecules[moleculeIndex]) {
        // Van der Waars radii are according to [A. Bondi, 1964].
        // A. Bondi: van der Waals Volumes and Radii.
        // doi 10.1021/j100785a001
        // TODO: Cite more properly.
        // TODO: Consider different sources.

        let radius;
        let color;
        switch (atom.species[0]) {
          case "H":
            radius = 1.1;
            color = "white";
            break;
          case "C":
            radius = 1.7;
            color = "gray";
            break;
          case "O":
            radius = 1.52;
            color = "red";
            break;
          default:
            color = "magenta";
            break;
        }

        {
          let [x, y, z] = atom.pos;
          const sphereGeometry = new THREE.SphereGeometry(1 / 16, 32, 16);
          const sphereMaterial = new THREE.MeshPhongMaterial({
            color: "lime",
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.set(x, y, z);
          centerSpheres.push(sphere);
        }

        {
          let [x, y, z] = atom.pos;

          const forces = atom.forces || atom.MACE_forces;
          if (forces !== undefined) {
            let [fx, fy, fz] = forces;
            const lineMaterial = new THREE.LineBasicMaterial({
              color: "magenta",
            });
            const linePoints = [];
            linePoints.push(new THREE.Vector3(x, y, z));
            linePoints.push(new THREE.Vector3(x + fx, y + fy, z + fz));
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(
              linePoints,
            );
            const line = new THREE.Line(lineGeometry, lineMaterial);
            forceVectorLines.push(line);
          }
        }

        {
          let [x, y, z] = atom.pos;
          const sphereGeometry = new THREE.SphereGeometry(radius, 32, 16);
          const sphereMaterial = new THREE.MeshPhongMaterial({
            colorWrite: false,
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.set(x, y, z);
          ghostAtomSpheres.push(sphere);
        }

        {
          let [x, y, z] = atom.pos;
          const sphereGeometry = new THREE.SphereGeometry(radius, 32, 16);
          const sphereMaterial = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
          });
          const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
          sphere.position.set(x, y, z);
          atomSpheres.push(sphere);
        }
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
