import { XyzReader } from "./xyz-reader.js";
import { Visualizer } from "./visualizer.js";

class App {
  constructor() {
    this.visualizer = new Visualizer();
  }

  run() {
    window.addEventListener("dragover", (event) => {
      event.preventDefault();
    });

    window.addEventListener("drop", (event) => {
      event.preventDefault();

      const file = event.dataTransfer.files[0];
      this.readFile(file);
    });

    document
      .getElementById("file-input")
      .addEventListener("change", (event) => {
        const file = event.target.files[0];
        this.readFile(file);
      });
  }

  readFile(file) {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const fileContent = reader.result;
      const xyzReader = new XyzReader(fileContent);
      this.visualizer.changeMolecules(xyzReader.getMolecules());
    });

    reader.readAsText(file);
  }
}

const app = new App();
app.run();
