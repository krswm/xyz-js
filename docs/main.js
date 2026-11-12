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

  visualize(molecules[0]);
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

function visualize(molecule) {
  const scene = new THREE.Scene();

  for (let atom of molecule) {
    const geometry = new THREE.SphereGeometry(1, 32, 16);
    const material = new THREE.MeshBasicMaterial({ color: "white" });
    const sphere = new THREE.Mesh(geometry, material);

    let [x, y, z] = atom.pos;
    sphere.position.set(x, y, z);

    scene.add(sphere);
  }

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );

  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  camera.position.set(0, 0, 1);
  controls.update();

  renderer.setAnimationLoop(() => {
    controls.update();
    renderer.render(scene, camera);
  });
}

main();
