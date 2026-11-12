const fileInput = document.getElementById("file-input");
fileInput.addEventListener("change", readFile);

function readFile() {
    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.addEventListener("load", () => {
        console.log(reader.result);
    });

    if (file) {
        reader.readAsText(file)
    }
}
