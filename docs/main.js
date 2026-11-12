import * as THREE from 'three';

function main() {
    const fileInput = document.getElementById("file-input");
    fileInput.addEventListener("change", () => { readFile(fileInput) });
}

function readFile(fileInput) {
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();
        reader.addEventListener("load", () => { onLoad(reader) });
        reader.readAsText(file)
    }
}

function onLoad(reader) {
    let lines = reader.result.split("\n");
    lines.pop(); // Remove the blank line at the end.
    console.log(lines);

    let numLines = lines.length;
    let lineIndex = 0;

    let molecules = []
    while (lineIndex < numLines) {
        let numAtoms = Number(lines[lineIndex++]);
        console.log(numAtoms);

        let metadata = toMetadata(lines[lineIndex++]);
        console.log(metadata);

        let properties = toProperties(metadata);
        console.log(properties);

        let molecule = [];
        for (let i = 0; i < numAtoms; i++) {
            let line = lines[lineIndex++];
            let splits = line.split(/\s+/);

            let atom = {}
            let j = 0;
            for (let property of properties) {
                let values = [];
                for (let i = 0; i < property.num; i++) {
                    let value = splits[j];
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
                    j++;
                }
                atom[property.name] = values;
            }
            molecule.push(atom);
        }
        console.log(molecule);
	molecules.push(molecule);
    }

    visualize(molecules[0]);
}

function toMetadata(line) {
    console.log(line);

    // Specification:
    // https://www.ovito.org/docs/current/reference/file_formats/input/xyz.html

    let matches = line.matchAll(/("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)=("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)/g);

    let metadata = {}
    for (let match of matches) {
        let [_, key, value] = match;

        if (value.startsWith('"')) {
            value = value.slice(1, -1); // Remove double quote delimiters.
            value = value.replaceAll(/\\(.)/g, "$1");
        }

        metadata[key] = value;
    }

    return metadata;
}

function toProperties(metadata) {
    let text = metadata["Properties"];
    let splits = text.split(":");

    let properties = []
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
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    for (let atom of molecule) {
        const geometry = new THREE.SphereGeometry(0.02, 32, 16);
        const material = new THREE.MeshBasicMaterial({color: 0xffffff});
        const cube = new THREE.Mesh(geometry, material);
        let [x, y, z] = atom.pos;
        cube.position.x = x / 3;
        cube.position.y = y / 3;
        cube.position.z = z / 3;
        scene.add(cube);
    }

    camera.position.z = 5;

    function animate(time) {
        renderer.render(scene, camera);
    }
    renderer.setAnimationLoop(animate);
}

main()
