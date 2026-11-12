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

        for (let i = 0; i < numAtoms; i++) {
            let line = lines[lineIndex++];
            let splits = line.split(/\s+/);

            let [element, x, y, z] = splits;
            x = Number(x);
            y = Number(y);
            z = Number(z);

            console.log(element);
            console.log(x);
            console.log(y);
            console.log(z);
        }
    }
}

function toMetadata(line) {
    console.log(line);

    // TODO: Improve regex.
    let matches = line.match(/[0-9A-Za-z_]+=(?:"[^"]*"|[^" ]*)/g);

    let metadata = {}
    for (match of matches) {
        let [_, key, value] = match.match(/([0-9A-Za-z_]+)=("[^"]*"|[^" ]*)/);
        metadata[key] = value;
    }

    return metadata;
}

main()
