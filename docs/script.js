const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", readFile);

function readFile() {
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.addEventListener("load", () => { onLoad(reader) });

    if (file) {
        reader.readAsText(file)
    }
}

function onLoad(reader) {
    let lines = reader.result.split("\n");
    lines.pop(); // Remove last blank line.
    console.log(lines);

    let num_lines = lines.length;
    let line_index = 0;

    while (line_index < num_lines) {
        let num_atoms = Number(lines[line_index++]);
        console.log(num_atoms);

        let comment = lines[line_index++];
        console.log(comment);

        for (let i = 0; i < num_atoms; i++) {
            let line = lines[line_index++];
            let split = line.split(/\s+/);

            let [element, x, y, z] = split;
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
