import { XyzReader } from "./xyz-reader.js";
import { Visualizer } from "./visualizer.js";

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

const app = new App();
app.run();
