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

    while (lineIndex < numLines) {
        let numAtoms = Number(lines[lineIndex++]);
        console.log(numAtoms);

        let metadata = toMetadata(lines[lineIndex++]);
        console.log(metadata);

        let properties = toProperties(metadata);
        console.log(properties);

        let atoms = [];
        for (let i = 0; i < numAtoms; i++) {
            let line = lines[lineIndex++];
            let splits = line.split(/\s+/);

            let atom = {}
            let j = 0;
            for (property of properties) {
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
            atoms.push(atom);
        }
        console.log(atoms);
    }
}

function toMetadata(line) {
    console.log(line);

    // Specification:
    // https://www.ovito.org/docs/current/reference/file_formats/input/xyz.html

    let matches = line.matchAll(/("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)=("(?:[^"\\]|\\.)*"|[^ ="[\]{}\\]*)/g);

    let metadata = {}
    for (match of matches) {
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

main()
